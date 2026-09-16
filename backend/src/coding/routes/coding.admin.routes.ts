import express from 'express';
import { body, param } from 'express-validator';
import { codingAdminController } from '../controllers/coding.admin.controller';
import { asyncHandler } from '../../middleware/errorHandler';

const router = express.Router();

router.get(
  '/problems',
  asyncHandler((req, res) => codingAdminController.listAllProblems(req, res))
);

router.get(
  '/problems/:id',
  [param('id').isMongoId()],
  asyncHandler((req, res) => codingAdminController.getProblemById(req, res))
);

router.post(
  '/problems',
  [
    body('title').isString().trim().notEmpty(),
    body('description').isString().notEmpty(),
    body('difficulty').isIn(['Easy', 'Medium', 'Hard']),
    body('category').isString().notEmpty(),
  ],
  asyncHandler((req, res) => codingAdminController.createProblem(req, res))
);

router.put(
  '/problems/:id',
  [param('id').isMongoId()],
  asyncHandler((req, res) => codingAdminController.updateProblem(req, res))
);

router.delete(
  '/problems/:id',
  [param('id').isMongoId()],
  asyncHandler((req, res) => codingAdminController.archiveProblem(req, res))
);

export default router;
