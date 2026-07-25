import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import Interview from '../models/Interview';
import { asyncHandler } from '../middleware/errorHandler';
import cloudinaryService from '../services/cloudinary';
import { profileUpdateValidation, imageFileValidation } from '../utils/validation';
import logger from '../utils/logger';

const router = express.Router();

// Get current user profile
router.get('/profile', asyncHandler(async (req, res) => {
  console.log('GET /api/user/profile - Request received');
  console.log('User from token:', req.user);
  
  if (!req.user || !req.user.userId) {
    console.error('No user ID in request');
    return res.status(401).json({
      success: false,
      error: 'User not authenticated',
      message: 'Please log in to access your profile',
    });
  }
  
  const user = await User.findById(req.user.userId);
  
  if (!user) {
    console.error(`User not found: ${req.user.userId}`);
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  console.log(`Profile fetched successfully for user: ${user.email}`);

  // Calculate real stats from Interview model
  try {
    const stats = await Interview.aggregate([
      { $match: { userId: user._id, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalInterviews: { $sum: 1 },
          averageScore: { $avg: '$analysis.overallScore' },
          lastInterviewDate: { $max: '$createdAt' },
        },
      },
    ]);

    if (stats.length > 0) {
      user.stats.totalInterviews = stats[0].totalInterviews || 0;
      user.stats.averageScore = Math.round(stats[0].averageScore || 0);
      user.stats.lastInterviewDate = stats[0].lastInterviewDate;
      
      // Calculate improvement rate (compare last 5 vs previous 5 interviews)
      const recentInterviews = await Interview.find({ 
        userId: user._id, 
        status: 'completed',
        'analysis.overallScore': { $exists: true }
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('analysis.overallScore');

      if (recentInterviews.length >= 6) {
        const recent5 = recentInterviews.slice(0, 5);
        const previous5 = recentInterviews.slice(5, 10);
        
        const recentAvg = recent5.reduce((sum: number, i: any) => sum + i.analysis.overallScore, 0) / recent5.length;
        const previousAvg = previous5.reduce((sum: number, i: any) => sum + i.analysis.overallScore, 0) / previous5.length;
        
        user.stats.improvementRate = Math.round(((recentAvg - previousAvg) / previousAvg) * 100);
      }
      
      await user.save();
    }
  } catch (error) {
    logger.error('Error calculating user stats:', error);
    // Continue without stats update
  }

  res.json({
    success: true,
    data: user.toJSON(),
  });
}));

// Update user profile
router.put('/profile', profileUpdateValidation(), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.error('Profile validation failed:', errors.array());
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    });
  }

  const { profile, preferences } = req.body;
  
  logger.info(`Profile update request for user ${req.user!.userId}`, { profile, preferences });
  
  const user = await User.findById(req.user!.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  // Update profile fields individually to avoid overwriting
  if (profile) {
    if (profile.firstName !== undefined) user.profile.firstName = profile.firstName;
    if (profile.lastName !== undefined) user.profile.lastName = profile.lastName;
    if (profile.phone !== undefined) user.profile.phone = profile.phone;
    if (profile.location !== undefined) user.profile.location = profile.location;
    if (profile.avatar !== undefined) user.profile.avatar = profile.avatar;
  }

  // Update preferences fields individually
  if (preferences) {
    if (preferences.role !== undefined) user.preferences.role = preferences.role;
    if (preferences.experienceLevel !== undefined) user.preferences.experienceLevel = preferences.experienceLevel;
    if (preferences.industries !== undefined) user.preferences.industries = preferences.industries;
    if (preferences.interviewTypes !== undefined) user.preferences.interviewTypes = preferences.interviewTypes;
  }

  await user.save();

  logger.info(`User profile updated: ${user.email}`);

  res.json({
    success: true,
    data: user.toJSON(),
    message: 'Profile updated successfully',
  });
}));

// Upload avatar
router.post('/upload-avatar', 
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }).single('avatar'),
  asyncHandler(async (req, res) => {
    // Validate file
    const validation = imageFileValidation(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Avatar file is required',
      });
    }

    try {
      const user = await User.findById(req.user!.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      logger.info(`Uploading avatar for user: ${user.email}`);

      // Upload to Cloudinary
      let avatarUrl: string;
      
      if (cloudinaryService.isHealthy()) {
        try {
          const uploadResult = await cloudinaryService.uploadImage(req.file.buffer, {
            folder: 'smart-interview-ai/avatars',
            public_id: `avatar_${req.user!.userId}_${Date.now()}`,
            transformation: {
              width: 400,
              height: 400,
              crop: 'fill',
              gravity: 'face',
              quality: 'auto',
            },
          });
          
          avatarUrl = uploadResult.secure_url;
          logger.info(`Avatar uploaded to Cloudinary: ${avatarUrl}`);
        } catch (cloudinaryError: any) {
          logger.warn('Cloudinary upload failed, falling back to local storage');
          
          // Fallback to local storage
          const localStorageService = require('../services/localStorage').default;
          const localResult = await localStorageService.uploadImage(req.file.buffer, {
            filename: `avatar_${req.user!.userId}_${Date.now()}.jpg`,
            userId: req.user!.userId,
          });
          
          avatarUrl = localResult.secure_url;
          logger.info(`Avatar uploaded to local storage: ${avatarUrl}`);
        }
      } else {
        // Use local storage if Cloudinary not configured
        const localStorageService = require('../services/localStorage').default;
        const localResult = await localStorageService.uploadImage(req.file.buffer, {
          filename: `avatar_${req.user!.userId}_${Date.now()}.jpg`,
          userId: req.user!.userId,
        });
        
        avatarUrl = localResult.secure_url;
        logger.info(`Avatar uploaded to local storage: ${avatarUrl}`);
      }

      // Update user profile
      user.profile.avatar = avatarUrl;
      await user.save();

      logger.info(`Avatar updated for user: ${user.email}`);

      res.json({
        success: true,
        data: { avatarUrl },
        message: 'Avatar updated successfully',
      });
    } catch (error: any) {
      logger.error('Avatar upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload avatar',
        message: error.message,
      });
    }
  })
);

// Get user statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  try {
    
    // Get recent interviews
    const recentInterviews = await Interview.find({ 
      userId: user._id,
      status: 'completed'
    })
      .sort({ createdAt: -1 })
      .select('type createdAt analysis.overallScore session.actualDuration');

    // Get upcoming interviews
    const upcomingInterviews = await Interview.find({ 
      userId: user._id,
      status: 'scheduled'
    })
      .sort({ createdAt: 1 })
      .limit(5)
      .select('type settings.role createdAt');

    // Calculate skill progress from recent interviews
    const skillProgress = [];
    if (recentInterviews.length >= 2) {
      const skills = ['Communication', 'Technical Knowledge', 'Problem Solving'];
      for (const skill of skills) {
        // This is a simplified calculation - you can enhance it based on actual interview data
        const currentLevel = Math.min(10, Math.floor(user.stats.averageScore / 10));
        const previousLevel = Math.max(1, currentLevel - 1);
        skillProgress.push({
          skill,
          currentLevel,
          previousLevel,
          trend: currentLevel > previousLevel ? 'improving' : currentLevel < previousLevel ? 'declining' : 'stable'
        });
      }
    }

    const stats = {
      totalInterviews: user.stats.totalInterviews,
      averageScore: user.stats.averageScore,
      improvementRate: user.stats.improvementRate,
      lastInterviewDate: user.stats.lastInterviewDate,
      skillProgress,
      recentInterviews: recentInterviews.map((i: any) => ({
        id: i._id,
        type: i.type,
        date: i.createdAt,
        score: i.analysis?.overallScore || 0,
        duration: i.session?.actualDuration || 0,
        status: 'completed'
      })),
      upcomingInterviews: upcomingInterviews.map((i: any) => ({
        id: i._id,
        type: i.type,
        role: i.settings?.role || '',
        date: i.createdAt,
        status: 'scheduled'
      })),
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    // Return basic stats if calculation fails
    res.json({
      success: true,
      data: {
        totalInterviews: user.stats.totalInterviews,
        averageScore: user.stats.averageScore,
        improvementRate: user.stats.improvementRate,
        lastInterviewDate: user.stats.lastInterviewDate,
        skillProgress: [],
        recentInterviews: [],
        upcomingInterviews: [],
      },
    });
  }
}));

// Update user preferences
router.put('/preferences', [
  body('role').optional().trim().isLength({ min: 1 }),
  body('experienceLevel').optional().isIn(['entry', 'mid', 'senior', 'executive']),
  body('industries').optional().isArray(),
  body('interviewTypes').optional().isArray(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    });
  }

  const preferences = req.body;
  
  const user = await User.findById(req.user!.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  user.preferences = { ...user.preferences, ...preferences };
  await user.save();

  res.json({
    success: true,
    data: user.preferences,
    message: 'Preferences updated successfully',
  });
}));

// Delete user account
router.delete('/account', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  // TODO: Delete related data (interviews, resumes, etc.)
  await User.findByIdAndDelete(req.user!.userId);

  logger.info(`User account deleted: ${user.email}`);

  res.json({
    success: true,
    message: 'Account deleted successfully',
  });
}));

export default router;