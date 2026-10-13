/**
 * Ranking context construction (spec §B).
 *
 * Regression: buildRankingContext read UserCareerGoal.findActiveByUser — which
 * by its own contract returns ONE goal or NULL — as if it returned an array.
 * For a candidate with no target role the jobs page returned
 *
 *   TypeError: Cannot read properties of null (reading 'find')   (the `primary` line)
 *
 * and for a candidate WITH a goal it would have thrown
 * ".map is not a function" on the `targetRoleSlugs` line. Either way GET
 * /api/jobs 500'd, so the Jobs page never loaded.
 *
 * The context needs EVERY active goal, so it must use findAllByUser (an array).
 * These tests pin that contract, including a null resolution (a driver/shape
 * change must degrade, not crash).
 */

jest.mock('../dist/career/services/skillEvidence.service', () => ({
  getSkillProfileSnapshot: jest.fn(),
}));
jest.mock('../dist/models/ResumeVersion', () => ({
  ResumeVersion: { findOne: jest.fn() },
}));
jest.mock('../dist/career/models/UserCareerGoal', () => ({
  UserCareerGoal: { findAllByUser: jest.fn(), findActiveByUser: jest.fn() },
}));
jest.mock('../dist/jobs/models/JobSearchPreference', () => ({
  JobSearchPreference: { find: jest.fn() },
}));

const { getSkillProfileSnapshot } = require('../dist/career/services/skillEvidence.service');
const { ResumeVersion } = require('../dist/models/ResumeVersion');
const { UserCareerGoal } = require('../dist/career/models/UserCareerGoal');
const { JobSearchPreference } = require('../dist/jobs/models/JobSearchPreference');
const { buildRankingContext } = require('../dist/jobs/services/jobRecommendation.service');

beforeEach(() => {
  jest.clearAllMocks();
  getSkillProfileSnapshot.mockResolvedValue({ skills: [] });
  ResumeVersion.findOne.mockResolvedValue(null);
  JobSearchPreference.find.mockResolvedValue([]);
  // Matches the model's real contract: ONE goal or null.
  UserCareerGoal.findActiveByUser.mockResolvedValue(null);
});

test('a candidate with NO target role resolves to empty targets instead of throwing', async () => {
  // The exact shape a Mongo findOne yields when nothing matches: null.
  UserCareerGoal.findAllByUser.mockResolvedValue(null);

  const ctx = await buildRankingContext('507f1f77bcf86cd799439011');

  expect(ctx.targetRoleSlugs).toEqual([]);
  expect(ctx.primaryRoleSlug).toBeNull();
});

test('a candidate with NO target role does not even consult the singular helper', async () => {
  UserCareerGoal.findAllByUser.mockResolvedValue([]);
  await buildRankingContext('507f1f77bcf86cd799439011');
  expect(UserCareerGoal.findAllByUser).toHaveBeenCalledTimes(1);
  expect(UserCareerGoal.findActiveByUser).not.toHaveBeenCalled();
});

test('every active goal becomes a target role, and the primary is identified', async () => {
  UserCareerGoal.findAllByUser.mockResolvedValue([
    { roleSlug: 'Backend Developer', isPrimary: true },
    { roleSlug: 'Data Analyst', isPrimary: false },
  ]);

  const ctx = await buildRankingContext('507f1f77bcf86cd799439011');

  expect(ctx.targetRoleSlugs).toEqual(['backend developer', 'data analyst']);
  expect(ctx.primaryRoleSlug).toBe('backend developer');
});

test('a single goal object is handled even if the shape is not an array', async () => {
  // Defensive: a non-array resolution must still produce a usable context.
  UserCareerGoal.findAllByUser.mockResolvedValue({ roleSlug: 'AI/ML Engineer', isPrimary: true });

  const ctx = await buildRankingContext('507f1f77bcf86cd799439011');

  expect(ctx.targetRoleSlugs).toEqual(['ai/ml engineer']);
  expect(ctx.primaryRoleSlug).toBe('ai/ml engineer');
});

test('a failing goal lookup degrades to an empty context rather than a 500', async () => {
  UserCareerGoal.findAllByUser.mockRejectedValue(new Error('mongo down'));

  const ctx = await buildRankingContext('507f1f77bcf86cd799439011');

  expect(ctx.targetRoleSlugs).toEqual([]);
  expect(ctx.primaryRoleSlug).toBeNull();
});
