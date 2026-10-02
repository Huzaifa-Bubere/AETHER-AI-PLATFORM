/**
 * Authentication regression tests.
 *
 * Two real login blockers found during the multi-role upgrade:
 *
 *  1. `subscription.plan: 'Pro'` failed enum validation, and because login did a
 *     full `user.save()` to stamp lastLogin, the rejected write locked the
 *     account out entirely.
 *  2. Mongoose does NOT lowercase query values, so `findOne({ email })` with
 *     mixed-case input missed the stored lowercase email and the user got
 *     "Invalid credentials" despite a correct password.
 *
 * These lock both fixes so neither can silently return.
 */

const { normalizePlanValue, normalizeEmailForLookup } = require('../dist/models/User');

describe('login blocker 1 — malformed subscription.plan', () => {
  test('the exact value that broke login is coerced to a valid enum member', () => {
    // This is the literal value reported in the production error.
    expect(normalizePlanValue('Pro')).toBe('pro');
  });

  test('case variants all resolve to a valid plan', () => {
    expect(normalizePlanValue('PRO')).toBe('pro');
    expect(normalizePlanValue('Enterprise')).toBe('enterprise');
    expect(normalizePlanValue('FREE')).toBe('free');
  });

  test('surrounding whitespace is tolerated', () => {
    expect(normalizePlanValue('  Pro  ')).toBe('pro');
    expect(normalizePlanValue('\tenterprise\n')).toBe('enterprise');
  });

  test('known aliases map to the right plan', () => {
    expect(normalizePlanValue('Aether Pro')).toBe('pro');
    expect(normalizePlanValue('Premium')).toBe('pro');
    expect(normalizePlanValue('paid')).toBe('pro');
    expect(normalizePlanValue('Team')).toBe('enterprise');
  });

  test('already-valid values pass through unchanged', () => {
    expect(normalizePlanValue('free')).toBe('free');
    expect(normalizePlanValue('pro')).toBe('pro');
    expect(normalizePlanValue('enterprise')).toBe('enterprise');
  });

  test('unrecognised and non-string values fall back to free, never throw', () => {
    // Falling back to free must not silently grant paid entitlements.
    expect(normalizePlanValue('lifetime-ultra')).toBe('free');
    expect(normalizePlanValue(undefined)).toBe('free');
    expect(normalizePlanValue(null)).toBe('free');
    expect(normalizePlanValue(123)).toBe('free');
    expect(normalizePlanValue({})).toBe('free');
  });

  test('every result is a member of the schema enum', () => {
    const VALID = ['free', 'pro', 'enterprise'];
    for (const input of ['Pro', 'PRO', 'Enterprise', 'weird', '', undefined, 42]) {
      expect(VALID).toContain(normalizePlanValue(input));
    }
  });
});

describe('login blocker 2 — email lookup case sensitivity', () => {
  test('mixed-case input is normalized to match the stored lowercase email', () => {
    // Stored value is 'user@example.com' because the schema sets lowercase:true.
    expect(normalizeEmailForLookup('User@Example.com')).toBe('user@example.com');
    expect(normalizeEmailForLookup('USER@EXAMPLE.COM')).toBe('user@example.com');
  });

  test('surrounding whitespace does not cause a miss', () => {
    expect(normalizeEmailForLookup('  user@example.com  ')).toBe('user@example.com');
  });

  test('an already-normalized email is unchanged (idempotent)', () => {
    expect(normalizeEmailForLookup('user@example.com')).toBe('user@example.com');
    expect(normalizeEmailForLookup(normalizeEmailForLookup('A@B.COM'))).toBe('a@b.com');
  });

  test('missing or non-string email degrades to an empty string, not a throw', () => {
    expect(normalizeEmailForLookup(undefined)).toBe('');
    expect(normalizeEmailForLookup(null)).toBe('');
    expect(normalizeEmailForLookup(42)).toBe('42');
  });

  test('distinct accounts are never merged by normalization', () => {
    expect(normalizeEmailForLookup('a@x.com')).not.toBe(normalizeEmailForLookup('b@x.com'));
  });
});

describe('both fixes together', () => {
  test('a legacy user with plan "Pro" and mixed-case email can be authenticated', () => {
    // Reproduces the exact production scenario, at the level the fixed code sees it.
    const storedEmail = 'huzaifa@example.com'; // stored lowercased by the schema
    const legacyPlan = 'Pro'; // written before the normaliser existed

    const lookupEmail = normalizeEmailForLookup('Huzaifa@Example.com');
    expect(lookupEmail).toBe(storedEmail);

    // When the document is next written, the setter repairs the plan before
    // enum validation runs, so the save no longer throws.
    expect(normalizePlanValue(legacyPlan)).toBe('pro');
  });
});