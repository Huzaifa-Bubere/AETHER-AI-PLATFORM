import express from 'express';
import { uploadLimiter } from '../middleware/rateLimiter';
import multer from 'multer';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import axios from 'axios';
import Resume from '../models/Resume';
import { asyncHandler } from '../middleware/errorHandler';
import cloudinaryService from '../services/cloudinary';
import geminiService from '../services/gemini';
import logger from '../utils/logger';
import { processResume, serializeResume } from '../services/resumeProcessing';
import localStorageService from '../services/localStorage';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  },
  fileFilter: (req, file, cb) => {
    logger.info(`File filter check: ${file.originalname}, mimetype: ${file.mimetype}`);
    
    const allowedTypes = (process.env.SUPPORTED_FILE_TYPES || 'pdf,docx').split(',');
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    
    if (fileExtension && allowedTypes.includes(fileExtension)) {
      logger.info(`File type accepted: ${fileExtension}`);
      cb(null, true);
    } else {
      logger.error(`File type rejected: ${fileExtension}`);
      cb(new Error(`File type not supported. Allowed types: ${allowedTypes.join(', ')}`));
    }
  },
});

// Multer error handler middleware
const handleMulterError = (err: any, req: express.Request, res: express.Response, next: express.NextFunction): void => {
  if (err instanceof multer.MulterError) {
    logger.error('Multer error:', err);
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: 'File too large',
        message: 'File size must be less than 10MB',
      });
      return;
    }
    
    res.status(400).json({
      success: false,
      error: 'File upload error',
      message: err.message,
    });
    return;
  }
  
  if (err) {
    logger.error('Upload error:', err);
    res.status(400).json({
      success: false,
      error: 'Upload failed',
      message: err.message,
    });
    return;
  }
  
  next();
};

// Upload resume
router.post('/upload', uploadLimiter, (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
}, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'Resume file is required.' });
  const data = await processResume(req.file, req.user!.userId);
  return res.status(201).json({ success: true, data, message: data.errorMessage || 'Resume uploaded and analyzed.' });
}));

// Analyze resume
router.post('/analyze', [
  body('resumeText').notEmpty().withMessage('Resume text is required'),
  body('targetRole').optional().trim(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    });
  }

  const { resumeText, targetRole } = req.body;

  try {
    // Analyze resume with Gemini AI
    const analysis = await geminiService.analyzeResume({
      resumeText,
      targetRole,
    });

    logger.info(`Resume analyzed for user ${req.user!.userId}`);

    res.json({
      success: true,
      data: analysis,
      message: 'Resume analyzed successfully',
    });
  } catch (error: any) {
    logger.error('Resume analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Resume analysis failed',
      message: error.message,
    });
  }
}));

// Get user's latest resume (for Resume Analyzer page)
router.get('/latest', asyncHandler(async (req, res) => {
  try {
    const resume = await Resume.findOne({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!resume) {
      return res.json({
        success: true,
        data: null,
        message: 'No resume uploaded yet',
      });
    }

    const formattedData = serializeResume(resume);

    res.json({
      success: true,
      data: formattedData,
    });
  } catch (error: any) {
    logger.error('Error fetching latest resume:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resume',
      message: error.message,
    });
  }
}));

// Get user's resumes
router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  try {
    
    const resumes = await Resume.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Resume.countDocuments({ userId: req.user!.userId });

    res.json({
      success: true,
      data: resumes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching resumes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resumes',
    });
  }
}));

// Get specific resume
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const resume = await Resume.findOne({
      _id: id,
      userId: req.user!.userId,
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        error: 'Resume not found',
      });
    }

    res.json({
      success: true,
      data: resume,
    });
  } catch (error) {
    logger.error('Error fetching resume:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resume',
    });
  }
}));

// Delete resume
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const resume = await Resume.findOne({ _id: id, userId: req.user!.userId });

    if (!resume) {
      return res.status(404).json({
        success: false,
        error: 'Resume not found',
      });
    }

    // Delete from Cloudinary if stored there
    if (resume.storageType === 'cloudinary' && resume.publicId) {
      try {
        await cloudinaryService.deleteFile(resume.publicId, 'raw');
        logger.info(`Deleted from Cloudinary: ${resume.publicId}`);
      } catch (cloudErr: any) {
        logger.warn(`Cloudinary delete failed (continuing): ${cloudErr.message}`);
      }
    }

    // Delete from local storage if stored locally
    if (resume.storageType === 'local' && resume.fileUrl) {
      try {
        const path = require('path');
        const fs = require('fs');
        const urlPath = resume.fileUrl.replace(/^https?:\/\/[^/]+/, '');
        const filePath = localStorageService.getFilePath(resume.publicId || urlPath.replace('/uploads/', ''));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info(`Deleted local file: ${filePath}`);
        }
      } catch (fsErr: any) {
        logger.warn(`Local file delete failed (continuing): ${fsErr.message}`);
      }
    }

    await Resume.findByIdAndDelete(id);
    logger.info(`Resume ${id} deleted by user ${req.user!.userId}`);

    res.json({
      success: true,
      message: 'Resume deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting resume:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete resume',
      message: error.message,
    });
  }
}));

// Cloudinary URL is never exposed to the browser
router.get('/:id/view', asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const resume = await Resume.findOne({ _id: id, userId: req.user!.userId });
    if (!resume) return res.status(404).json({ success: false, error: 'Resume not found' });

    logger.info(`View resume ${id} storageType=${resume.storageType}`);

    if (resume.storageType === 'cloudinary' && resume.fileUrl) {
      // Fetch the file from Cloudinary on the server side, stream it to the client
      const fileRes = await axios.get(resume.fileUrl, {
        responseType: 'stream',
        timeout: 15000,
      });
      res.setHeader('Content-Type', resume.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      (fileRes.data as any).pipe(res);
      return;
    }

    // Local storage
    const path = require('path');
    const fs = require('fs');
    const urlPath = resume.fileUrl.replace(/^https?:\/\/[^/]+/, '');
    const filePath = localStorageService.getFilePath(resume.publicId || urlPath.replace('/uploads/', ''));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Resume file not found on server' });
    }
    res.setHeader('Content-Type', resume.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    fs.createReadStream(filePath).pipe(res);
  } catch (error: any) {
    logger.error('Error viewing resume:', error);
    res.status(500).json({ success: false, error: 'Failed to view resume', message: error.message });
  }
}));

// Download resume â€” backend fetches from Cloudinary internally and streams to client
// Cloudinary URL is never exposed to the browser
router.get('/:id/download', asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const resume = await Resume.findOne({ _id: id, userId: req.user!.userId });
    if (!resume) return res.status(404).json({ success: false, error: 'Resume not found' });

    logger.info(`Download resume ${id} storageType=${resume.storageType}`);

    if (resume.storageType === 'cloudinary' && resume.fileUrl) {
      // Fetch the file from Cloudinary on the server side, stream it to the client
      const fileRes = await axios.get(resume.fileUrl, {
        responseType: 'stream',
        timeout: 15000,
      });
      const safeFilename = resume.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      res.setHeader('Content-Type', resume.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      (fileRes.data as any).pipe(res);
      return;
    }

    // Local storage
    const path = require('path');
    const fs = require('fs');
    const urlPath = resume.fileUrl.replace(/^https?:\/\/[^/]+/, '');
    const filePath = localStorageService.getFilePath(resume.publicId || urlPath.replace('/uploads/', ''));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Resume file not found on server' });
    }
    res.setHeader('Content-Type', resume.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${resume.filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error: any) {
    logger.error('Error downloading resume:', error);
    res.status(500).json({ success: false, error: 'Failed to download resume', message: error.message });
  }
}));

export default router;
