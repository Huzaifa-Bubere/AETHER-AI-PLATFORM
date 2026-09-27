/**
 * AETHER — Chart data API (spec §10-§12, §34).
 *
 * Deterministic aggregation over real records; envelopes carry provenance.
 * Filters change the DB query window — never invent new values.
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import {
  assessmentScoreOverTime, atsScoreOverTime, careerReadiness,
  codingPerformance, dashboardAnalytics, interviewScoresOverTime,
  learningAnalytics, skillProfile, technicalAccuracyByCategory,
} from '../services/analytics.service';

const router = Router();

const VALID_RANGES = new Set(['7d', '30d', '90d', 'all']);

function range(req: any): string {
  const r = String(req.query.range || '90d');
  return VALID_RANGES.has(r) ? r : '90d';
}

router.get('/dashboard', authenticateToken, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await dashboardAnalytics(String((req as any).user.userId)) });
}));

router.get('/technical-accuracy', authenticateToken, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await technicalAccuracyByCategory(String((req as any).user.userId), range(req)) });
}));

router.get('/assessment-scores', authenticateToken, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await assessmentScoreOverTime(String((req as any).user.userId), range(req)) });
}));

router.get('/coding-performance', authenticateToken, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await codingPerformance(String((req as any).user.userId), range(req)) });
}));

router.get('/interview-scores', authenticateToken, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await interviewScoresOverTime(String((req as any).user.userId), range(req)) });
}));

router.get('/learning', authenticateToken, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await learningAnalytics(String((req as any).user.userId), range(req)) });
}));

router.get('/ats-scores', authenticateToken, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await atsScoreOverTime(String((req as any).user.userId)) });
}));

router.get('/skill-profile', authenticateToken, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await skillProfile(String((req as any).user.userId)) });
}));

router.get('/career-readiness', authenticateToken, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await careerReadiness(String((req as any).user.userId)) });
}));

export default router;
