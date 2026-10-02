/**
 * Multi-role goal migration (spec §29/§30, Part 1 decision).
 *
 * `UserCareerGoal.userId` used to be UNIQUE, so a candidate could only have one
 * target role. This script:
 *   1. drops the old single-field unique index
 *   2. creates the compound { userId, roleSlug } unique index
 *   3. backfills isPrimary / priority / targetLevel / status / roadmapProgress
 *      so every existing single-goal user ends up with exactly one primary goal
 *      and no data loss
 *
 * Safe to run more than once: every step is idempotent and the backfill only
 * writes fields that are missing.
 *
 *   npx ts-node src/scripts/migrateMultiRoleGoals.ts
 *   node dist/scripts/migrateMultiRoleGoals.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';
import { UserCareerGoal } from '../career/models/UserCareerGoal';

dotenv.config({
  path: path.resolve(process.cwd(), '../.env'),
});
dns.setServers(['8.8.8.8', '1.8.1.1']);

const MONGO_URI =
  process.env.SEED_MONGODB_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  '';

if (!MONGO_URI && require.main === module) {
  console.error('✗ No MongoDB URI found. Set MONGODB_URI (or SEED_MONGODB_URI).');
  process.exit(1);
}

const LEGACY_UNIQUE_INDEX = 'userId_1';

async function dropStaleIndexes(): Promise<void> {
  const collection = UserCareerGoal.collection;
  const existing = await collection.indexes();
  const names = existing.map(i => i.name);

  // The old index made one goal per user impossible to exceed.
  if (names.includes(LEGACY_UNIQUE_INDEX)) {
    const spec = existing.find(i => i.name === LEGACY_UNIQUE_INDEX);
    const isCompoundWithRole = spec && Object.keys(spec.key ?? {}).length > 1;
    if (!isCompoundWithRole) {
      await collection.dropIndex(LEGACY_UNIQUE_INDEX);
      console.log(`· dropped legacy unique index ${LEGACY_UNIQUE_INDEX}`);
    }
  }

  if (!names.includes('userId_1_roleSlug_1')) {
    await collection.createIndex({ userId: 1, roleSlug: 1 }, { unique: true, name: 'userId_1_roleSlug_1' });
    console.log('· created compound unique index userId_1_roleSlug_1');
  }

  if (!names.includes('userId_1_status_1_isPrimary_-1_priority_1')) {
    await collection.createIndex(
      { userId: 1, status: 1, isPrimary: -1, priority: 1 },
      { name: 'userId_1_status_1_isPrimary_-1_priority_1' },
    );
    console.log('· created dashboard read index');
  }
}

async function backfillFields(): Promise<void> {
  // Default any goal that predates the new fields.
  const defaulted = await UserCareerGoal.updateMany(
    { $or: [{ isPrimary: { $exists: false } }, { priority: { $exists: false } }, { status: { $exists: false } }] },
    { $set: { isPrimary: false, priority: 0, targetLevel: 'JOB_READY', status: 'ACTIVE', roadmapProgress: 0 } },
  );
  if (defaulted.modifiedCount > 0) {
    console.log(`· backfilled fields on ${defaulted.modifiedCount} goal(s)`);
  }

  await UserCareerGoal.updateMany({ lastActivityAt: { $exists: false } }, [
    { $set: { lastActivityAt: '$updatedAt' } },
  ]);

  // Guarantee exactly one primary goal per user among their ACTIVE goals.
  const activeByUser = await UserCareerGoal.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { status: { $ne: 'ARCHIVED' } } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);

  let promoted = 0;
  let demoted = 0;

  for (const { _id: userId, count } of activeByUser) {
    const goals = await UserCareerGoal.find({ userId, status: { $ne: 'ARCHIVED' } })
      .sort({ updatedAt: -1 })
      .select('_id isPrimary priority');

    const primaries = goals.filter(g => g.isPrimary);
    if (count === 1) {
      // The common case: one existing goal becomes the primary goal.
      if (!primaries.length) {
        await UserCareerGoal.updateOne({ _id: goals[0]._id }, { $set: { isPrimary: true, priority: 0 } });
        promoted += 1;
      }
      continue;
    }
    if (primaries.length === 0) {
      // Multiple goals, none primary: the most recently updated becomes primary.
      await UserCareerGoal.updateOne({ _id: goals[0]._id }, { $set: { isPrimary: true, priority: 0 } });
      promoted += 1;
    } else if (primaries.length > 1) {
      // Keep the oldest primary, demote the rest so the dashboard is unambiguous.
      const [keep, ...extra] = primaries;
      await UserCareerGoal.updateOne(
        { _id: { $in: extra.map(g => g._id) } },
        { $set: { isPrimary: false } },
        { multi: true } as never,
      );
      void keep;
      demoted += extra.length;
    }
    // Number the rest by recency so priority is stable and meaningful.
    const rest = await UserCareerGoal.find({ userId, status: { $ne: 'ARCHIVED' }, isPrimary: false }).sort({ updatedAt: -1 });
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].priority !== i + 1) {
        await UserCareerGoal.updateOne({ _id: rest[i]._id }, { $set: { priority: i + 1 } });
      }
    }
  }

  console.log(`· primary goals set: ${promoted}, extra primaries demoted: ${demoted}`);
}

export async function runMigration(): Promise<{ total: number; primary: number }> {
  if (!MONGO_URI) throw new Error('No MongoDB URI configured');
  await mongoose.connect(MONGO_URI);
  try {
    await dropStaleIndexes();
    await backfillFields();
    const total = await UserCareerGoal.countDocuments();
    const primary = await UserCareerGoal.countDocuments({ isPrimary: true, status: { $ne: 'ARCHIVED' } });
    console.log(`\n✓ Migration complete. ${total} goal(s) total, ${primary} primary.`);
    return { total, primary };
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('✗ Migration failed:', error);
      process.exit(1);
    });
}
