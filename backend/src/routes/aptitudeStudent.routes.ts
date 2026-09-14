import express from 'express';
import { questionImageDirectory } from '../utils/aptitudeImageUpload';
import { aptitudeId, aptitudeError } from '../middleware/aptitudeValidation';
import { Router } from 'express';
import * as ctrl from '../controllers/studentAptitude.controller';
import { authenticateToken } from '../middleware/auth';
import { assessmentLimiter } from '../middleware/rateLimiter';

const router = Router();
router.param('testId', aptitudeId);
router.param('attemptId', aptitudeId);

router.use('/images', express.static(questionImageDirectory, { dotfiles: 'deny', index: false, maxAge: '1d', setHeaders: res => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin') }));
router.use(authenticateToken);
router.use(assessmentLimiter);

router.get('/tests', ctrl.listPublishedTests);
router.get('/attempts', ctrl.listAttempts);
router.post('/tests/:testId/start', ctrl.startAttempt);
router.get('/attempts/:attemptId', ctrl.getAttempt);
router.post('/attempts/:attemptId/response', ctrl.saveResponse);
router.post('/attempts/:attemptId/submit', ctrl.submitAttempt);
router.get('/attempts/:attemptId/result', ctrl.getResult);

router.use(aptitudeError);
export default router;
