/**
 * Admin account tool.
 *
 * Creating an admin by running the full question seed is awkward, and there is
 * no supported way to promote an existing candidate to admin or to reset a
 * forgotten admin password. This script does all three, idempotently.
 *
 *   npm run seed:admin                      create if missing (default creds)
 *   npm run seed:admin -- --email a@b.com  create/promote a specific account
 *   npm run seed:admin -- --password X      set a specific password
 *   npm run seed:admin -- --promote         make an EXISTING user an admin
 *   npm run seed:admin -- --reset-password  reset the password of an existing admin
 *   npm run seed:admin -- --unlock          clear a "too many failed attempts" lockout
 *   npm run seed:admin -- --list            show all current admins
 *   npm run seed:admin -- --email x --password y --verify
 *                                             check whether credentials work, without a browser
 *
 * Flags combine, e.g.
 *   npm run seed:admin -- --email you@example.com --promote
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';
import User, { normalizeEmailForLookup } from '../models/User';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dns.setServers(['8.8.8.8', '1.8.8.8']);

const MONGO_URI =
  process.env.SEED_MONGODB_URI || process.env.MONGODB_URI || process.env.MONGO_URI || '';

interface Flags {
  email?: string;
  password?: string;
  promote: boolean;
  resetPassword: boolean;
  list: boolean;
  verify: boolean;
  unlock: boolean;
}

function parseFlags(argv: string[]): Flags {
  const get = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    email: get('email'),
    password: get('password'),
    promote: argv.includes('--promote'),
    resetPassword: argv.includes('--reset-password'),
    list: argv.includes('--list'),
    verify: argv.includes('--verify'),
    unlock: argv.includes('--unlock'),
  };
}

export async function runSeedAdmin(flags: Flags) {
  if (!MONGO_URI) throw new Error('No MongoDB URI configured');
  await mongoose.connect(MONGO_URI);

  try {
    // ── List current admins ─────────────────────────────────────────────────
    if (flags.list) {
      const admins = await User.find({ 'auth.role': 'admin' })
        .select('email profile.firstName profile.lastName auth.isVerified auth.loginAttempts auth.lockUntil subscription.plan')
        .lean();
      if (admins.length === 0) {
        console.log('No admin accounts exist.');
      } else {
        console.log(`\n${admins.length} admin account(s):`);
        for (const a of admins) {
          const locked = Boolean(a.auth?.lockUntil && new Date(a.auth.lockUntil) > new Date());
          console.log(
            `  ${a.email}  (${a.profile?.firstName ?? ''} ${a.profile?.lastName ?? ''})`.trimEnd() +
              `  verified=${a.auth?.isVerified ?? false} plan=${a.subscription?.plan ?? 'free'}` +
              `  locked=${locked} failedAttempts=${a.auth?.loginAttempts ?? 0}`,
          );
        }
        console.log('\n  Sign in with the email EXACTLY as shown above (note the domain).');
      }
      return { created: 0, promoted: 0, reset: 0 };
    }

    const email = normalizeEmailForLookup(
      flags.email ?? process.env.SEED_ADMIN_EMAIL ?? 'admin@aether.local',
    );
    const password = flags.password ?? process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';

    const existing = await User.findOne({ email });

    // ── Verify credentials from the CLI, without touching the browser ───────
    if (flags.verify) {
      const target = existing ?? (await User.findOne({ email: normalizeEmailForLookup(flags.email ?? '') }));
      if (!target) {
        console.log(`✗ No account found for "${flags.email}".`);
        console.log('  Check the domain — this script normalizes case but not typos.');
        console.log('  Run --list to see the exact emails that exist.');
        return { created: 0, promoted: 0, reset: 0 };
      }
      const locked = Boolean(target.auth?.lockUntil && new Date(target.auth.lockUntil) > new Date());
      const matches = await bcrypt.compare(String(flags.password ?? ''), target.password);

      console.log(`\nAccount:  ${target.email}`);
      console.log(`Role:     ${target.auth?.role ?? 'user'}`);
      console.log(`Verified: ${target.auth?.isVerified ?? false}`);
      console.log(`Locked:   ${locked}`);
      console.log(`Attempts: ${target.auth?.loginAttempts ?? 0}`);
      console.log(`Password: ${matches ? 'CORRECT' : 'WRONG'}`);
      console.log(
        `\nResult: ${matches && !locked && target.auth?.role === 'admin'
          ? '✓ These credentials WILL log in to /admin/login'
          : '✗ These credentials will NOT work — see the fields above'}`,
      );
      return { created: 0, promoted: 0, reset: 0 };
    }

    // ── Promote an existing account ─────────────────────────────────────────
    if (flags.promote) {
      if (!existing) {
        console.log(`✗ No user found for ${email}. Register it first, then re-run with --promote.`);
        return { created: 0, promoted: 0, reset: 0 };
      }
      existing.auth.role = 'admin';
      existing.auth.isVerified = true;
      // Only grant the admin plan when it is not already something valid.
      if (!['pro', 'enterprise'].includes(existing.subscription?.plan)) {
        existing.subscription.plan = 'enterprise';
      }
      existing.subscription.status = 'active';
      await existing.save();
      console.log(`✓ Promoted ${email} to admin.`);
      return { created: 0, promoted: 1, reset: 0 };
    }

    // ── Reset the password of an existing account ───────────────────────────
    if (flags.resetPassword || flags.unlock) {
      if (!existing) {
        console.log(`✗ No user found for ${email}. Nothing to reset.`);
        return { created: 0, promoted: 0, reset: 0 };
      }

      // A direct DB write rather than `existing.save()`: save() revalidates the
      // whole document, so any unrelated malformed legacy value would throw and
      // leave the lockout in place — the exact failure this tool exists to fix.
      const updates: { $set: Record<string, unknown> } = {
        $set: { 'auth.loginAttempts': 0, 'auth.lockUntil': null },
      };
      if (flags.resetPassword) {
        updates.$set.password = await bcrypt.hash(password, 12);
      }
      await User.updateOne({ _id: existing._id }, updates);

      const actions = [flags.resetPassword && 'password reset', flags.unlock && 'lockout cleared'];
      console.log(
        `✓ ${actions.filter(Boolean).join(' + ')} for ${email}.` +
          (flags.resetPassword ? `\n  New password: ${password}` : ''),
      );
      return { created: 0, promoted: 0, reset: 1 };
    }

    // ── Create if missing (idempotent) ──────────────────────────────────────
    if (existing) {
      // Repair common problems on an existing admin without touching the password.
      let repaired = false;
      if (existing.auth.role !== 'admin') {
        existing.auth.role = 'admin';
        repaired = true;
      }
      if (existing.auth.isVerified !== true) {
        existing.auth.isVerified = true;
        repaired = true;
      }
      if (existing.auth.loginAttempts > 0) {
        existing.auth.loginAttempts = 0;
        existing.auth.lockUntil = undefined;
        repaired = true;
      }
      if (repaired) {
        await existing.save();
        console.log(`✓ Repaired ${email} (role/verification/lockout). Password unchanged.`);
      } else {
        console.log(`• ${email} already exists as a healthy admin. Password unchanged.`);
      }
      console.log('  To set a new password: npm run seed:admin -- --reset-password');
      return { created: 0, promoted: 0, reset: 0 };
    }

    await User.create({
      email,
      password: await bcrypt.hash(password, 12),
      profile: { firstName: 'AETHER', lastName: 'Administrator' },
      // experienceLevel belongs under preferences — the earlier admin seed put
      // it at the top level, where it was silently dropped.
      preferences: { experienceLevel: 'mid' },
      subscription: { plan: 'enterprise', status: 'active' },
      auth: { role: 'admin', isVerified: true },
    });

    console.log(`\n✓ Created admin account:
    email:    ${email}
    password: ${password}

  Sign in at /admin/login, then change this password immediately.`);
    return { created: 1, promoted: 0, reset: 0 };
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  const flags = parseFlags(process.argv.slice(2));
  runSeedAdmin(flags)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('✗ Admin seed failed:', error);
      process.exit(1);
    });
}