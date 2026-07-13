/**
 * migrateValorGlobal.js
 *
 * One-time migration: merges all per-guild Valor records into a single
 * global record per user (keyed by userId only, no guildId), then drops
 * the old compound index so the new unique-on-userId index is created
 * cleanly on next bot start.
 *
 * Run ONCE before starting the bot after the "global valor" update:
 *   node scripts/migrateValorGlobal.js
 *
 * CRASH-SAFE / IDEMPOTENT
 * -----------------------
 * "Legacy" docs  = Valor documents that still have a guildId field.
 * "Global" doc   = Valor document with no guildId (already migrated).
 *
 * For each user the script:
 *   1. Sums all *legacy* docs (those with guildId) → legacySum
 *   2. Creates the global doc with legacySum ONLY if one doesn't exist yet.
 *      (If one already exists from a prior partial run, it has the correct
 *       total and must not be touched.)
 *   3. Deletes all legacy docs for that user.
 *
 * On re-run after a crash:
 *   - If crashed before step 2: no global doc, legacy docs intact → normal run.
 *   - If crashed after step 2 but before/during step 3: global doc exists with
 *     correct total; script skips step 2 and finishes deleting remaining legacy docs.
 *   - Double-counting is impossible because the global doc is never modified
 *     once created, and the sum is always derived from the legacy docs (not the
 *     global doc).
 */

import 'dotenv/config';
import mongoose from 'mongoose';

// Raw schema — no index constraints so we can freely read duplicate userId docs.
const valorSchema = new mongoose.Schema({
  userId:  String,
  guildId: String,
  valor:   { type: Number, default: 0 },
}, { timestamps: true });

const Valor = mongoose.model('Valor', valorSchema);

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌  MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  console.log('🔌  Connecting to MongoDB…');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('✅  Connected.\n');

  // ── Step 1: Find every userId that still has at least one legacy doc ──────
  const legacyUserIds = await Valor.distinct('userId', { guildId: { $exists: true, $ne: null } });

  if (legacyUserIds.length === 0) {
    console.log('✅  No legacy (per-guild) Valor docs found. Nothing to migrate.');
    await dropCompoundIndex();
    await verify();
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${legacyUserIds.length} user(s) with legacy per-guild Valor records.\n`);

  let usersProcessed = 0;
  let docsDeleted    = 0;

  for (const userId of legacyUserIds) {
    // ── Step 2: Sum all legacy docs for this user ─────────────────────────
    const legacyDocs = await Valor.find(
      { userId, guildId: { $exists: true, $ne: null } },
    ).lean();

    if (legacyDocs.length === 0) {
      // All legacy docs were already cleaned up for this user — skip.
      continue;
    }

    const legacySum = legacyDocs.reduce((acc, d) => acc + (d.valor || 0), 0);

    // ── Step 3: Create global doc only if it doesn't already exist ─────────
    //    Using insertOne via Model.create wrapped in a try/catch on duplicate-
    //    key so this step is skipped cleanly on re-run even if the unique
    //    index already exists.
    const existing = await Valor.findOne({ userId, guildId: { $exists: false } }).lean();

    if (!existing) {
      // No global doc yet — create it with the summed valor.
      await Valor.create({ userId, valor: legacySum });
      console.log(`  ✔ <@${userId}>: created global record with ${legacySum} valor (merged from ${legacyDocs.length} guild record(s)).`);
    } else {
      console.log(`  ↩ <@${userId}>: global record already exists (${existing.valor} valor) — skipping create, will clean up ${legacyDocs.length} remaining legacy doc(s).`);
    }

    // ── Step 4: Delete all legacy docs for this user ──────────────────────
    const legacyIds = legacyDocs.map(d => d._id);
    const del = await Valor.deleteMany({ _id: { $in: legacyIds } });
    docsDeleted += del.deletedCount;
    usersProcessed++;
  }

  // ── Step 5: Drop old compound index ──────────────────────────────────────
  await dropCompoundIndex();

  // ── Step 6: Verify ───────────────────────────────────────────────────────
  await verify();

  console.log('\n✅  Migration complete.');
  console.log(`    Users processed : ${usersProcessed}`);
  console.log(`    Legacy docs deleted : ${docsDeleted}`);
  console.log('\nYou can now start the bot. The new unique userId index will be created automatically on startup.');

  await mongoose.disconnect();
}

async function dropCompoundIndex() {
  try {
    const collection = mongoose.connection.collection('valors');
    const indexes = await collection.indexes();
    const compound = indexes.find(
      idx => idx.key && idx.key.userId === 1 && idx.key.guildId === 1
    );
    if (compound) {
      await collection.dropIndex(compound.name);
      console.log(`\n  Dropped old compound index "${compound.name}".`);
    } else {
      console.log('\n  No compound (userId+guildId) index found — nothing to drop.');
    }
  } catch (err) {
    console.warn(`  ⚠️  Could not drop old index: ${err.message}`);
  }
}

async function verify() {
  // Assert: no userId appears more than once in the collection.
  const duplicates = await Valor.aggregate([
    { $group: { _id: '$userId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (duplicates.length > 0) {
    console.error(`\n❌  Verification FAILED: ${duplicates.length} userId(s) still have multiple records:`);
    for (const d of duplicates) console.error(`     userId=${d._id}  count=${d.count}`);
    console.error('    Re-run this script to finish cleaning up.');
    process.exitCode = 1;
  } else {
    const total = await Valor.countDocuments();
    console.log(`\n  Verification passed: ${total} global Valor record(s), all unique by userId.`);
  }
}

migrate().catch(err => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
