/**
 * migrateInventoryGlobal.js
 *
 * One-time migration: merges all per-guild Inventory records for each
 * user into a single global Inventory (keyed by userId only, no guildId).
 * Items with the same name across guild inventories have their quantities
 * summed. Then drops the old compound index.
 *
 * Run ONCE before starting the bot after the "global inventory" update:
 *   node scripts/migrateInventoryGlobal.js
 *
 * CRASH-SAFE / IDEMPOTENT
 * -----------------------
 * "Legacy" doc  = Inventory document that still has a guildId field.
 * "Global" doc  = Inventory document with no guildId (already migrated).
 *
 * For each user the script:
 *   1. Collects all legacy docs (those with guildId) and sums item
 *      quantities across them.
 *   2. Creates the global doc ONLY if one doesn't already exist.
 *      (If one exists from a prior partial run, it has the correct
 *       merged items and must not be modified.)
 *   3. Deletes all legacy docs for that user.
 *
 * On re-run after a crash, step 2 is skipped and remaining legacy docs
 * are just deleted — no double-counting is possible.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  userId:  String,
  guildId: String,
  items:   [{ name: String, quantity: { type: Number, default: 1 } }],
}, { timestamps: true });

const Inventory = mongoose.model('Inventory', inventorySchema);

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('❌  MONGODB_URI is not set. Aborting.'); process.exit(1); }

  console.log('🔌  Connecting to MongoDB…');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('✅  Connected.\n');

  // Find every userId that still has at least one legacy (guildId) doc.
  const legacyUserIds = await Inventory.distinct('userId', { guildId: { $exists: true, $ne: null } });

  if (legacyUserIds.length === 0) {
    console.log('✅  No legacy (per-guild) Inventory docs found. Nothing to migrate.');
    await dropCompoundIndex();
    await verify();
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${legacyUserIds.length} user(s) with legacy per-guild Inventory records.\n`);

  let usersProcessed = 0;
  let docsDeleted    = 0;

  for (const userId of legacyUserIds) {
    // Fetch all legacy docs for this user.
    const legacyDocs = await Inventory.find(
      { userId, guildId: { $exists: true, $ne: null } }
    ).lean();

    if (legacyDocs.length === 0) continue; // already cleaned up

    // Merge items across all legacy inventories — sum quantities by name.
    const merged = new Map(); // name (lowercase) → { name, quantity }
    for (const doc of legacyDocs) {
      for (const item of (doc.items || [])) {
        const key = item.name.toLowerCase();
        if (merged.has(key)) {
          merged.get(key).quantity += item.quantity;
        } else {
          merged.set(key, { name: item.name, quantity: item.quantity });
        }
      }
    }
    const mergedItems = [...merged.values()];

    // Check whether a global doc already exists.
    const existing = await Inventory.findOne({ userId, guildId: { $exists: false } }).lean();

    if (!existing) {
      await Inventory.create({ userId, items: mergedItems });
      console.log(
        `  ✔ <@${userId}>: merged ${legacyDocs.length} guild inventory/ies → ` +
        `${mergedItems.length} unique item type(s).`
      );
    } else {
      console.log(
        `  ↩ <@${userId}>: global inventory already exists — ` +
        `skipping create, cleaning up ${legacyDocs.length} remaining legacy doc(s).`
      );
    }

    // Delete all legacy docs for this user.
    const legacyIds = legacyDocs.map(d => d._id);
    const del = await Inventory.deleteMany({ _id: { $in: legacyIds } });
    docsDeleted += del.deletedCount;
    usersProcessed++;
  }

  await dropCompoundIndex();
  await verify();

  console.log('\n✅  Migration complete.');
  console.log(`    Users processed     : ${usersProcessed}`);
  console.log(`    Legacy docs deleted : ${docsDeleted}`);
  console.log('\nYou can now start the bot.');

  await mongoose.disconnect();
}

async function dropCompoundIndex() {
  try {
    const col     = mongoose.connection.collection('inventories');
    const indexes = await col.indexes();
    const compound = indexes.find(idx => idx.key?.userId === 1 && idx.key?.guildId === 1);
    if (compound) {
      await col.dropIndex(compound.name);
      console.log(`\n  Dropped old compound index "${compound.name}".`);
    } else {
      console.log('\n  No compound (userId+guildId) index found — nothing to drop.');
    }
  } catch (err) {
    console.warn(`  ⚠️  Could not drop old index: ${err.message}`);
  }
}

async function verify() {
  const duplicates = await Inventory.aggregate([
    { $group: { _id: '$userId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  if (duplicates.length > 0) {
    console.error(`\n❌  Verification FAILED: ${duplicates.length} userId(s) still have multiple records.`);
    duplicates.forEach(d => console.error(`     userId=${d._id}  count=${d.count}`));
    process.exitCode = 1;
  } else {
    const total = await Inventory.countDocuments();
    console.log(`\n  Verification passed: ${total} global Inventory record(s), all unique by userId.`);
  }
}

migrate().catch(err => { console.error('❌  Migration failed:', err); process.exit(1); });
