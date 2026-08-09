import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/adminAptitude.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = Router();

router.use(authenticateToken, requireAdmin);

// Questions
router.post('/questions', upload.single('image'), ctrl.createQuestion);
router.post('/questions/bulk', upload.array('images', 100), ctrl.bulkCreateQuestions);
router.get('/questions', ctrl.listQuestions);
router.put('/questions/:id', upload.single('image'), ctrl.updateQuestion);
router.patch('/questions/:id/status', ctrl.toggleQuestionStatus);
router.delete('/questions/:id', ctrl.deleteQuestion);

// Tests
router.post('/tests', ctrl.createTest);
router.get('/tests', ctrl.listTests);
router.put('/tests/:id', ctrl.updateTest);
router.patch('/tests/:id/publish', ctrl.togglePublishTest);

// Dashboard / Students
router.get('/dashboard', ctrl.getDashboardStats);
router.get('/students', ctrl.listStudentPerformance);
router.patch('/students/:userId/block', ctrl.toggleStudentBlock);

export default router;