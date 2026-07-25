import { Router } from 'express';
import * as ctrl from '../controllers/studentAptitude.controller';
// ADAPT: import your existing JWT auth middleware, e.g.:
// import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// router.use(authenticate); // uncomment once wired to your real middleware

router.get('/tests', ctrl.listPublishedTests);
router.post('/tests/:testId/start', ctrl.startAttempt);
router.get('/attempts/:attemptId', ctrl.getAttempt);
router.post('/attempts/:attemptId/response', ctrl.saveResponse);
router.post('/attempts/:attemptId/submit', ctrl.submitAttempt);
router.get('/attempts/:attemptId/result', ctrl.getResult);

export default router;
