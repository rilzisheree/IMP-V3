/**
 * migrateShopGlobal.js
 *
 * One-time migration: converts per-guild ShopItem records into a single
 * global shop (keyed by name only, no guildId). If the same item name
 * exists in multiple guilds, the oldest record is kept and duplicates
 * are deleted. Then drops the old compound index.
 *
 * Run ONCE before starting the bot after the "global shop" update:
 *   node scripts/migrateShopGlobal.js
 *
 * CRASH-SAFE / IDEMPOTENT
 * -----------------------
 * "Legacy" doc  = ShopItem document that still has a guildId field.
 * "Global" doc  = ShopItem document with no guildId (already migrated).
 *
 * For each item name the script:
 *   1. Collects all legacy docs with that name.
 *   2. Creates a global doc ONLY if one doesn't already exist (uses the
 *      oldest legacy doc's price/description as the canonical values).
 *   3. Deletes all legacy docs for that name.
 *
 * On re-run after a crash between steps 2 and 3, the global doc already
 * exists so step 2 is skipped and remaining legacy docs are just deleted.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const shopItemSchema = new mongoose.Schema({
  guildId:     String,
  name:        { type: String, required: true },
  price:       { type: Number, required: true },
  description: { type: String, default: '' },
}, { timestamps: true });

const ShopItem = mongoose.model('ShopItem', shopItemSchema);

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('❌  MONGODB_URI is not set. Aborting.'); process.exit(1); }

  console.log('🔌  Connecting to MongoDB…');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('✅  Connected.\n');

  // Find every distinct item name that still has a legacy (guildId) doc.
  const legacyNames = await ShopItem.distinct('name', { guildId: { $exists: true, $ne: null } });

  if (legacyNames.length === 0) {
    console.log('✅  No legacy (per-guild) ShopItem docs found. Nothing to migrate.');
    await dropCompoundIndex();
    await verify();
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${legacyNames.length} item name(s) with legacy per-guild records.\n`);

  let itemsProcessed = 0;
  let docsDeleted    = 0;

  for (const name of legacyNames) {
    // Fetch all legacy docs for this name, oldest first.
    const legacyDocs = await ShopItem.find(
      { name, guildId: { $exists: true, $ne: null } }
    ).sort({ createdAt: 1 }).lean();

    if (legacyDocs.length === 0) continue; // already cleaned up

    // Check whether a global (no-guildId) doc already exists for this name.
    const existing = await ShopItem.findOne({ name, guildId: { $exists: false } }).lean();

    if (!existing) {
      // Use oldest legacy doc as canonical values.
      const canonical = legacyDocs[0];
      await ShopItem.create({
        name:        canonical.name,
        price:       canonical.price,
        description: canonical.description || '',
      });
      const skipped = legacyDocs.length - 1;
      console.log(
        `  ✔ "${name}": created global record (price: ${canonical.price})` +
        (skipped > 0 ? ` — ${skipped} duplicate guild version(s) discarded.` : '.')
      );
    } else {
      console.log(`  ↩ "${name}": global record already exists — skipping create, cleaning up ${legacyDocs.length} legacy doc(s).`);
    }

    // Delete all legacy docs for this name.
    const legacyIds = legacyDocs.map(d => d._id);
    const del = await ShopItem.deleteMany({ _id: { $in: legacyIds } });
    docsDeleted += del.deletedCount;
    itemsProcessed++;
  }

  await dropCompoundIndex();
  await verify();

  console.log('\n✅  Migration complete.');
  console.log(`    Item names processed : ${itemsProcessed}`);
  console.log(`    Legacy docs deleted  : ${docsDeleted}`);
  console.log('\nYou can now start the bot.');

  await mongoose.disconnect();
}

async function dropCompoundIndex() {
  try {
    const col     = mongoose.connection.collection('shopitems');
    const indexes = await col.indexes();
    const compound = indexes.find(idx => idx.key?.guildId === 1 && idx.key?.name === 1);
    if (compound) {
      await col.dropIndex(compound.name);
      console.log(`\n  Dropped old compound index "${compound.name}".`);
    } else {
      console.log('\n  No compound (guildId+name) index found — nothing to drop.');
    }
  } catch (err) {
    console.warn(`  ⚠️  Could not drop old index: ${err.message}`);
  }
}

async function verify() {
  const duplicates = await ShopItem.aggregate([
    { $group: { _id: { $toLower: '$name' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  if (duplicates.length > 0) {
    console.error(`\n❌  Verification FAILED: ${duplicates.length} item name(s) still have multiple records.`);
    duplicates.forEach(d => console.error(`     name="${d._id}"  count=${d.count}`));
    process.exitCode = 1;
  } else {
    const total = await ShopItem.countDocuments();
    console.log(`\n  Verification passed: ${total} global ShopItem record(s), all unique by name.`);
  }
}

migrate().catch(err => { console.error('❌  Migration failed:', err); process.exit(1); });
