/* AETHER — analytics must read REAL, correctly-named collections (spec §60–§64).
 *
 * These tests exist because three analytics metrics silently returned empty
 * charts: the service queried `userId` on models that key the owner as `user`
 * (AptitudeAttempt, CodingSubmission) and resolved a model named
 * `CourseProgress` that never existed (the real model is `LearningProgress`).
 */
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const { ANALYTICS_MODELS, CALC_VERSION, confidenceFor } = require('../dist/services/analytics.service');

describe('analytics model registry', () => {
  test('every model the analytics service reads by name is registered', () => {
    for (const name of ANALYTICS_MODELS) {
      expect(() => mongoose.model(name)).not.toThrow();
    }
  });

  test('the removed CourseProgress name is not used anywhere', () => {
    expect(ANALYTICS_MODELS).not.toContain('CourseProgress');
    expect(ANALYTICS_MODELS).toContain('LearningProgress');
  });

  test('models whose owner field is `user` are declared as such', () => {
    const AptitudeAttempt = mongoose.model('AptitudeAttempt');
    const CodingSubmission = mongoose.model('CodingSubmission');
    // Owner path must exist on the schema — `userId` would be undefined here.
    expect(AptitudeAttempt.schema.path('user')).toBeDefined();
    expect(AptitudeAttempt.schema.path('userId')).toBeUndefined();
    expect(CodingSubmission.schema.path('user')).toBeDefined();
    expect(CodingSubmission.schema.path('userId')).toBeUndefined();
  });

  test('models whose owner field is `userId` are declared as such', () => {
    const LearningProgress = mongoose.model('LearningProgress');
    const ResumeVersion = mongoose.model('ResumeVersion');
    const UserSkillProfile = mongoose.model('UserSkillProfile');
    const UserCareerGoal = mongoose.model('UserCareerGoal');
    const AdaptiveInterview = mongoose.model('AdaptiveInterview');
    expect(LearningProgress.schema.path('userId')).toBeDefined();
    expect(ResumeVersion.schema.path('userId')).toBeDefined();
    expect(UserSkillProfile.schema.path('userId')).toBeDefined();
    expect(UserCareerGoal.schema.path('userId')).toBeDefined();
    // AdaptiveInterview is the exception: it uses `userId` AND is queried that way.
    expect(AdaptiveInterview.schema.path('userId')).toBeDefined();
  });

  test('per-question category evidence exists on AptitudeAttempt snapshots', () => {
    const AptitudeAttempt = mongoose.model('AptitudeAttempt');
    expect(AptitudeAttempt.schema.path('questionSnapshots.category')).toBeDefined();
    expect(AptitudeAttempt.schema.path('questionSnapshots.correctOption')).toBeDefined();
    expect(AptitudeAttempt.schema.path('responses.selectedOption')).toBeDefined();
    expect(AptitudeAttempt.schema.path('scorePercent')).toBeDefined();
  });

  test('codingSubmission exposes the stored complexity comparison (Part A)', () => {
    const CodingSubmission = mongoose.model('CodingSubmission');
    expect(CodingSubmission.schema.path('complexityCheck.level')).toBeDefined();
    expect(CodingSubmission.schema.path('complexityCheck.optimizationAvailable')).toBeDefined();
    expect(CodingSubmission.schema.path('complexityCheck.analyzerConfidence')).toBeDefined();
    expect(CodingSubmission.schema.path('complexityCheck.candidateComplexity')).toBeDefined();
    expect(CodingSubmission.schema.path('complexityCheck.expectedComplexity')).toBeDefined();
  });
});

describe('analytics helpers are deterministic', () => {
  test('confidence thresholds are fixed, not random', () => {
    expect(confidenceFor(0)).toBe('LOW');
    expect(confidenceFor(9)).toBe('LOW');
    expect(confidenceFor(10)).toBe('MEDIUM');
    expect(confidenceFor(29)).toBe('MEDIUM');
    expect(confidenceFor(30)).toBe('HIGH');
  });

  test('calculation version is pinned in the envelope', () => {
    expect(CALC_VERSION).toBe('1.0');
  });
});
