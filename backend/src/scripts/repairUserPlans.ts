/**
 * User plan repair (login blocker).
 *
 * Some legacy user documents hold `subscription.plan` values that are not in the
 * schema enum (e.g. 'Pro'). Any full `user.save()` then fails validation — which
 * used to break LOGIN, because login saved the document to stamp `lastLogin`.
 *
 * Login now uses a targeted updateOne and the schema normalises the value on
 * write, so new bad values cannot appear. This script repairs the EXISTING rows.
 *
 * Idempotent and safe to re-run. It reports what it changed.
 *
 *   npm run repair:plans
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const MONGO_URI =
  process.env.SEED_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_URI || '';

const VALID = ['free', 'pro', 'enterprise'];

/** Same coercion as the schema setter, so script and schema never disagree. */
function normalizePlan(value: unknown): string {
  if (typeof value !== 'string') return 'free';
  const lowered = value.trim().toLowerCase();
  if (VALID.includes(lowered)) return lowered;
  if (['pro', 'professional', 'aether pro', 'premium', 'paid'].includes(lowered)) return 'pro';
  if (['enterprise', 'team', 'business'].includes(lowered)) return 'enterprise';
  return 'free';
}

export async function repairPlans(): Promise<{ scanned: number; fixed: number }> {
  if (!MONGO_URI) throw new Error('No MongoDB URI configured');
  await mongoose.connect(MONGO_URI);
  try {
    const users = await mongoose.connection.collection('users').find(
      {},
      { projection: { 'subscription.plan': 1, email: 1 } },
    ).toArray();

    let fixed = 0;
    const offenders: Array<{ email: string; was: unknown; now: string }> = [];

    for (const user of users) {
      const current = user.subscription?.plan;
      // Missing/valid values need no write at all.
      if (current === undefined || current === null) continue;
      const normalized = normalizePlan(current);
      if (normalized === current) continue;

      await mongoose.connection
        .collection('users')
        .updateOne({ _id: user._id }, { $set: { 'subscription.plan': normalized } });
      fixed += 1;
      offenders.push({ email: user.email ?? String(user._id), was: current, now: normalized });
    }

    if (offenders.length > 0) {
      console.log('\nRepaired subscription.plan values:');
      for (const o of offenders) {
        console.log(`  ${o.email}: ${JSON.stringify(o.was)} → ${o.now}`);
      }
    }

    console.log(`\n✓ Scanned ${users.length} user(s), repaired ${fixed}.`);
    return { scanned: users.length, fixed };
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  repairPlans()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('✗ Plan repair failed:', error);
      process.exit(1);
    });
}