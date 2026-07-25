import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import axios from 'axios';
import Resume from '../models/Resume';
import { asyncHandler } from '../middleware/errorHandler';
import cloudinaryService from '../services/cloudinary';
import geminiService from '../services/gemini';
import logger from '../utils/logger';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  },
  fileFilter: (req, file, cb) => {
    logger.info(`File filter check: ${file.originalname}, mimetype: ${file.mimetype}`);
    
    const allowedTypes = (process.env.SUPPORTED_FILE_TYPES || 'pdf,doc,docx').split(',');
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
router.post('/upload', (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
}, asyncHandler(async (req, res) => {
  // Debug logging
  logger.info('=== Resume Upload Request ===');
  logger.info(`User ID: ${req.user?.userId}`);
  logger.info(`File received: ${req.file ? 'Yes' : 'No'}`);
  logger.info(`File details: ${req.file ? JSON.stringify({
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  }) : 'N/A'}`);
  logger.info(`Headers: ${JSON.stringify(req.headers)}`);

  // Check if file exists
  if (!req.file) {
    logger.error('No file in request');
    return res.status(400).json({
      success: false,
      error: 'Resume file is required',
      message: 'Please select a file to upload',
      debug: {
        fileReceived: false,
        fieldName: 'resume',
        contentType: req.headers['content-type']
      }
    });
  }

  // Check authentication
  if (!req.user || !req.user.userId) {
    logger.error('No user authentication');
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please log in to upload resume'
    });
  }

  try {
    logger.info('Starting file upload...');
    
    let uploadResult: any;
    let storageType: 'cloudinary' | 'local' = 'local';

    // Try Cloudinary first if available
    if (cloudinaryService.isHealthy()) {
      try {
        logger.info('Attempting Cloudinary upload...');
        uploadResult = await cloudinaryService.uploadResume(req.file.buffer, {
          folder: 'smart-interview-ai/resumes',
          public_id: `resume_${req.user.userId}_${Date.now()}`,
        });
        storageType = 'cloudinary';
        logger.info(`âœ“ Cloudinary upload successful: ${uploadResult.secure_url}`);
      } catch (cloudinaryError: any) {
        logger.warn('Cloudinary upload failed, falling back to local storage');
        logger.warn('Cloudinary error:', cloudinaryError.message);
        
        // Fall back to local storage
        const localStorageService = require('../services/localStorage').default;
        uploadResult = await localStorageService.uploadResume(req.file.buffer, {
          filename: req.file.originalname,
          userId: req.user.userId,
        });
        storageType = 'local';
        logger.info(`âœ“ Local storage upload successful: ${uploadResult.secure_url}`);
      }
    }

    logger.info('File upload complete, starting AI parsing...');

    // Call Python AI server for resume parsing
    let parsedData: any = null;
    try {
      const pythonServerUrl = process.env.PYTHON_AI_SERVER_URL;
      const apiKey = process.env.PYTHON_AI_SERVER_API_KEY;

      if (!pythonServerUrl || !apiKey) {
        logger.warn('PYTHON_AI_SERVER_URL or PYTHON_AI_SERVER_API_KEY not set â€” skipping AI parsing');
      } else {
        logger.info(`Calling Python AI server at: ${pythonServerUrl}/api/resume/parse`);

        // Create FormData for Python server
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('resume_file', req.file.buffer, {
          filename: req.file.originalname,
          contentType: req.file.mimetype,
        });

        const parseResponse = await axios.post(
          `${pythonServerUrl}/api/resume/parse`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: 30000,
          }
        );

        if (parseResponse.data && parseResponse.data.success) {
          parsedData = parseResponse.data.data;
          logger.info('âœ“ Resume parsed successfully by AI server');
          logger.info(`Extracted ${parsedData.skills?.length || 0} skill categories`);
        } else {
          logger.warn('AI parsing returned unsuccessful response');
        }
      }
    } catch (parseError: any) {
      logger.error('AI parsing error:', parseError.message);
      if (parseError.response) {
        logger.error('AI server response:', parseError.response.data);
      }
      // Continue without parsing â€” upload still succeeds
    }

    // Extract skills for database storage
    const extractedSkills: string[] = [];
    if (parsedData && parsedData.skills) {
      parsedData.skills.forEach((skillCategory: any) => {
        if (skillCategory.skills && Array.isArray(skillCategory.skills)) {
          extractedSkills.push(...skillCategory.skills);
        }
      });
    }

    // Use parsed data or fallback to defaults
    const skillsToStore = extractedSkills.length > 0 
      ? extractedSkills 
      : ['React', 'TypeScript', 'Node.js', 'Express', 'MongoDB'];

    const experienceYears = parsedData?.experience?.length || 0;
    const educationData = parsedData?.education || [];
    const certificationsData = parsedData?.certifications || [];
    const achievementsData = parsedData?.achievements || [];
    const summaryText = parsedData?.summary || 'Experienced professional with strong technical skills';

    // Calculate resume score based on parsed data
    const calculateScore = () => {
      let score = 50; // Base score
      
      // Skills (up to 20 points)
      score += Math.min(extractedSkills.length * 2, 20);
      
      // Experience (up to 15 points)
      score += Math.min(experienceYears * 5, 15);
      
      // Education (up to 10 points)
      score += Math.min(educationData.length * 5, 10);
      
      // Certifications (up to 5 points)
      score += Math.min(certificationsData.length * 2, 5);
      
      return Math.min(score, 100);
    };

    // Calculate sub-scores for detailed breakdown
    const calculateSubScores = () => {
      // Content Quality: based on skills, experience, achievements
      const contentQuality = Math.min(
        50 + 
        (extractedSkills.length * 3) + 
        (experienceYears * 5) + 
        (achievementsData.length * 5),
        100
      );

      // Formatting: based on structure and completeness
      const formatting = Math.min(
        60 + 
        (educationData.length > 0 ? 10 : 0) +
        (certificationsData.length > 0 ? 10 : 0) +
        (summaryText.length > 50 ? 10 : 0) +
        (achievementsData.length > 0 ? 10 : 0),
        100
      );

      // Keywords: based on technical skills and industry terms
      const keywords = Math.min(
        40 + (extractedSkills.length * 4),
        100
      );

      // Impact: based on achievements and quantifiable results
      const impact = Math.min(
        50 + (achievementsData.length * 10),
        100
      );

      return { contentQuality, formatting, keywords, impact };
    };

    const resumeScore = calculateScore();
    const subScores = calculateSubScores();

    // Sanitize education â€” fill missing fields with defaults
    const sanitizedEducation = educationData.map((edu: any) => ({
      degree:      edu.degree      || edu.qualification || 'Not specified',
      institution: edu.institution || edu.university    || edu.college || 'Not specified',
      year:        parseInt(edu.year) || new Date().getFullYear(),
      gpa:         parseFloat(edu.gpa) || undefined,
    })).filter((edu: any) => edu.degree !== 'Not specified' || edu.institution !== 'Not specified');

    // Create resume record in database with parsed data
    const resume = new Resume({
      userId: req.user.userId,
      filename: req.file.originalname,
      fileUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      storageType: storageType, // 'cloudinary' or 'local'
      analysis: {
        skills: skillsToStore,
        experience: experienceYears,
        education: sanitizedEducation,
        certifications: certificationsData,
        achievements: achievementsData,
        industries: [],
        leadership: [],
        summary: summaryText,
        score: resumeScore,
        recommendations: [
          'Add quantifiable achievements with metrics',
          'Include relevant certifications',
          'Highlight leadership experience',
          'Update technical stack with modern tools'
        ],
      },
      metadata: {
        uploadedAt: new Date(),
        lastAnalyzedAt: new Date(),
        processingStatus: 'completed',
        parsedData: parsedData || undefined, // Store full parsed data
      },
    });

    await resume.save();

    logger.info(`Resume saved to database: ${resume._id}`);

    // Generate missing skills based on extracted skills
    const commonSkills = ['Kubernetes', 'GraphQL', 'Redis', 'CI/CD', 'Microservices', 'Docker', 'AWS', 'Azure'];
    const missingSkills = commonSkills.filter(skill => 
      !skillsToStore.some(s => s.toLowerCase().includes(skill.toLowerCase()))
    );

    // Return formatted response with parsed data
    const responseData = {
      _id: resume._id,
      id: resume._id,
      fileName: resume.filename,
      uploadDate: resume.metadata.uploadedAt,
      fileUrl: resume.fileUrl,
      localFilePath: resume.localFilePath,
      score: resumeScore,
      contentQuality: subScores.contentQuality,
      formatting: subScores.formatting,
      keywords: subScores.keywords,
      impact: subScores.impact,
      extractedSkills: skillsToStore,
      missingSkills: missingSkills,
      parsedData: parsedData,
      suggestions: [
        {
          title: 'Add Quantifiable Achievements',
          description: 'Include metrics like "Improved app performance by 40%" instead of just "Improved performance"',
          priority: 'high'
        },
        {
          title: 'Highlight Leadership Experience',
          description: 'Add examples of leading projects or mentoring team members',
          priority: 'medium'
        },
        {
          title: 'Update Technical Stack',
          description: 'Add modern tools like Docker, Kubernetes, and cloud platforms',
          priority: 'high'
        },
        {
          title: 'Improve Action Verbs',
          description: 'Use stronger verbs like "Architected", "Orchestrated", "Spearheaded"',
          priority: 'medium'
        }
      ],
      contactInfo: parsedData?.contact_info || {},
      experience: parsedData?.experience || [],
      education: parsedData?.education || [],
      certifications: parsedData?.certifications || [],
      projects: parsedData?.projects || [],
      summary: summaryText
    };

    logger.info('Resume upload completed successfully');

    res.json({
      success: true,
      data: responseData,
      message: 'Resume uploaded successfully',
    });
  } catch (error: any) {
    logger.error('Resume upload error:', error);
    logger.error('Error stack:', error.stack);
    
    // Determine error type and provide specific guidance
    let errorMessage = error.message || 'An error occurred while uploading your resume';
    let statusCode = 500;
    let debugInfo: any = {
      errorType: error.name,
      cloudinaryHealthy: cloudinaryService.isHealthy(),
    };

    if (error.message?.includes('Invalid cloud_name')) {
      errorMessage = 'Cloudinary configuration error: Invalid cloud name';
      statusCode = 503;
      debugInfo.solution = 'Administrator needs to update CLOUDINARY_CLOUD_NAME in backend/.env';
      debugInfo.helpUrl = 'https://cloudinary.com/console';
    } else if (error.message?.includes('Invalid API key')) {
      errorMessage = 'Cloudinary configuration error: Invalid API key';
      statusCode = 503;
      debugInfo.solution = 'Administrator needs to update CLOUDINARY_API_KEY in backend/.env';
    } else if (error.message?.includes('Invalid signature') || error.message?.includes('Invalid API secret')) {
      errorMessage = 'Cloudinary configuration error: Invalid API secret';
      statusCode = 503;
      debugInfo.solution = 'Administrator needs to update CLOUDINARY_API_SECRET in backend/.env';
    } else if (error.message?.includes('not initialized') || error.message?.includes('not configured')) {
      errorMessage = 'File upload service is not configured';
      statusCode = 503;
      debugInfo.solution = 'Administrator needs to configure Cloudinary credentials';
      debugInfo.helpUrl = 'Run: node verify-cloudinary.js';
    }
    
    res.status(statusCode).json({
      success: false,
      error: 'Resume upload failed',
      message: errorMessage,
      debug: debugInfo
    });
  }
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

    // Calculate sub-scores if not already present
    const skills = resume.analysis.skills || [];
    const experience = resume.analysis.experience || 0;
    const achievements = resume.analysis.achievements || [];
    const education = resume.analysis.education || [];
    const certifications = resume.analysis.certifications || [];
    const summary = resume.analysis.summary || '';

    const contentQuality = Math.min(
      50 + (skills.length * 3) + (experience * 5) + (achievements.length * 5),
      100
    );

    const formatting = Math.min(
      60 + 
      (education.length > 0 ? 10 : 0) +
      (certifications.length > 0 ? 10 : 0) +
      (summary.length > 50 ? 10 : 0) +
      (achievements.length > 0 ? 10 : 0),
      100
    );

    const keywords = Math.min(40 + (skills.length * 4), 100);
    const impact = Math.min(50 + (achievements.length * 10), 100);

    // Format response for Resume Analyzer page
    const formattedData = {
      _id: resume._id,
      id: resume._id,
      fileName: resume.filename,
      uploadDate: resume.createdAt,
      fileUrl: resume.fileUrl,
      localFilePath: resume.localFilePath,
      score: resume.analysis.score || 0,
      contentQuality,
      formatting,
      keywords,
      impact,
      extractedSkills: skills,
      missingSkills: [],
      parsedData: resume.metadata.parsedData,
      suggestions: resume.analysis.recommendations || [],
    };

    // Generate missing skills
    const commonSkills = ['Kubernetes', 'GraphQL', 'Redis', 'CI/CD', 'Microservices', 'Docker', 'AWS', 'Azure'];
    formattedData.missingSkills = commonSkills.filter(skill => 
      !skills.some((s: string) => s.toLowerCase().includes(skill.toLowerCase()))
    );

    // Format suggestions
    if (!formattedData.suggestions || formattedData.suggestions.length === 0) {
      formattedData.suggestions = [
        {
          title: 'Add Quantifiable Achievements',
          description: 'Include metrics like "Improved app performance by 40%" instead of just "Improved performance"',
          priority: 'high'
        },
        {
          title: 'Highlight Leadership Experience',
          description: 'Add examples of leading projects or mentoring team members',
          priority: 'medium'
        },
        {
          title: 'Update Technical Stack',
          description: 'Include modern technologies and frameworks you\'ve worked with',
          priority: 'medium'
        }
      ];
    } else {
      // Format existing recommendations
      formattedData.suggestions = formattedData.suggestions.map((rec: string, index: number) => ({
        title: rec,
        description: rec,
        priority: index === 0 ? 'high' : 'medium'
      }));
    }

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
        await cloudinaryService.deleteFile(resume.publicId);
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
        const urlPath = resume.fileUrl.replace(/^https?:\/\/[^\/]+/, '');
        const filePath = path.join(process.cwd(), 'uploads', urlPath.replace('/uploads/', ''));
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
    const filePath = path.join(process.cwd(), 'uploads', urlPath.replace('/uploads/', ''));
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
    const filePath = path.join(process.cwd(), 'uploads', urlPath.replace('/uploads/', ''));
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
