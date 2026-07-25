import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler';
import User from '../models/User';
import Interview from '../models/Interview';
import Resume from '../models/Resume';
import logger from '../utils/logger';
import os from 'os';

const router = express.Router();

// NOTE: requireAdmin middleware is applied when mounting this router in app.ts
// This allows for easier testing

// Get platform statistics
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  console.log('=== ADMIN: Getting platform stats ===');

  try {
    // Get user statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      'auth.lastLogin': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    });

    // Get interview statistics
    const totalInterviews = await Interview.countDocuments();
    const completedInterviews = await Interview.countDocuments({ status: 'completed' });
    const inProgressInterviews = await Interview.countDocuments({ status: 'in-progress' });
    
    // Calculate average success rate
    const interviewsWithScores = await Interview.find({
      status: 'completed',
      'analysis.overallScore': { $exists: true }
    }).select('analysis.overallScore');
    
    const avgSuccessRate = interviewsWithScores.length > 0
      ? Math.round(interviewsWithScores.reduce((sum, i) => sum + (i.analysis?.overallScore || 0), 0) / interviewsWithScores.length)
      : 0;

    // Get interview type breakdown
    const interviewTypes = await Interview.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Get user growth data (last 7 months)
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get subscription breakdown
    const subscriptionStats = await User.aggregate([
      { $group: { _id: '$subscription.plan', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          newThisMonth: newUsersThisMonth,
          growth: userGrowth,
          subscriptions: subscriptionStats
        },
        interviews: {
          total: totalInterviews,
          completed: completedInterviews,
          inProgress: inProgressInterviews,
          avgSuccessRate,
          byType: interviewTypes
        },
        timestamp: new Date()
      }
    });
  } catch (error: any) {
    logger.error('Admin stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get platform statistics',
      message: error.message
    });
  }
}));

// Get all users (paginated)
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;
  const plan = req.query.plan as string;

  const query: any = {};
  
  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } },
      { 'profile.firstName': { $regex: search, $options: 'i' } },
      { 'profile.lastName': { $regex: search, $options: 'i' } }
    ];
  }

  if (plan) {
    query['subscription.plan'] = plan;
  }

  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .select('-password');

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// Get specific user details
router.get('/users/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.params.id).select('-password');
  
  if (!user) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    });
    return;
  }

  // Get user's interviews
  const interviews = await Interview.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(10);

  // Get user's resumes
  const resumes = await Resume.find({ userId: user._id })
    .sort({ uploadDate: -1 })
    .limit(5);

  res.json({
    success: true,
    data: {
      user,
      interviews,
      resumes
    }
  });
}));

// Update user
router.put('/users/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { subscription, auth, profile } = req.body;
  
  const user = await User.findById(req.params.id);
  
  if (!user) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    });
    return;
  }

  // Update subscription if provided
  if (subscription) {
    if (subscription.plan) user.subscription.plan = subscription.plan;
    if (subscription.status) user.subscription.status = subscription.status;
  }

  // Update auth if provided
  if (auth) {
    if (auth.role) user.auth.role = auth.role;
    if (auth.isVerified !== undefined) user.auth.isVerified = auth.isVerified;
  }

  // Update profile if provided
  if (profile) {
    if (profile.firstName) user.profile.firstName = profile.firstName;
    if (profile.lastName) user.profile.lastName = profile.lastName;
  }

  await user.save();

  logger.info(`Admin updated user: ${user.email}`);

  res.json({
    success: true,
    data: user,
    message: 'User updated successfully'
  });
}));

// Delete user
router.delete('/users/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    res.status(404).json({
      success: false,
      error: 'User not found'
    });
    return;
  }

  // Delete user's interviews
  await Interview.deleteMany({ userId: user._id });
  
  // Delete user's resumes
  await Resume.deleteMany({ userId: user._id });
  
  // Delete user
  await User.findByIdAndDelete(req.params.id);

  logger.info(`Admin deleted user: ${user.email}`);

  res.json({
    success: true,
    message: 'User and all associated data deleted successfully'
  });
}));

// Get all interviews (paginated)
router.get('/interviews', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const type = req.query.type as string;

  const query: any = {};
  
  if (status) query.status = status;
  if (type) query.type = type;

  const interviews = await Interview.find(query)
    .populate('userId', 'email profile.firstName profile.lastName')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);

  const total = await Interview.countDocuments(query);

  res.json({
    success: true,
    data: interviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// Get system metrics
router.get('/system-metrics', asyncHandler(async (_req: Request, res: Response) => {
  const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

  // Get database stats
  const dbStats = await mongoose.connection.db.stats();

  res.json({
    success: true,
    data: {
      cpu: Math.round(cpuUsage),
      memory: Math.round(memoryUsage),
      uptime: process.uptime(),
      platform: os.platform(),
      nodeVersion: process.version,
      database: {
        size: dbStats.dataSize,
        collections: dbStats.collections,
        indexes: dbStats.indexes
      },
      timestamp: new Date()
    }
  });
}));

// Get error logs — reads from real Winston log file
router.get('/error-logs', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const logFile = require('path').join(process.cwd(), 'logs', 'error.log');
  const fs = require('fs');

  if (!fs.existsSync(logFile)) {
    res.json({ success: true, data: [], message: 'No error log file found yet' });
    return;
  }

  try {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content
      .split('\n')
      .filter((l: string) => l.trim())
      .map((l: string) => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter(Boolean)
      .reverse()
      .slice(0, limit);

    res.json({ success: true, data: lines, total: lines.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to read log file', message: err.message });
  }
}));

// Get recent activity
router.get('/activity', asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;

  // Get recent interviews
  const recentInterviews = await Interview.find()
    .populate('userId', 'email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('userId type status createdAt analysis.overallScore');

  const activities = recentInterviews.map(interview => ({
    user: (interview.userId as any)?.email || 'Unknown',
    action: `${interview.status === 'completed' ? 'Completed' : 'Started'} ${interview.type} Interview`,
    time: interview.createdAt,
    score: interview.status === 'completed' ? interview.analysis?.overallScore : null
  }));

  res.json({
    success: true,
    data: activities
  });
}));

// Get AI performance metrics — real DB aggregations
router.get('/ai-metrics', asyncHandler(async (_req: Request, res: Response) => {
  const completedInterviews = await Interview.find({
    status: 'completed',
    'analysis.overallScore': { $exists: true, $gt: 0 },
  }).select('analysis createdAt feedback');

  const totalAnalyzed = completedInterviews.length;

  // Average overall score as accuracy proxy
  const accuracy = totalAnalyzed > 0
    ? Math.round(
        completedInterviews.reduce((sum, i) => sum + (i.analysis?.overallScore ?? 0), 0) / totalAnalyzed
      )
    : 0;

  // Average content metrics
  const avgRelevance = totalAnalyzed > 0
    ? Math.round(
        completedInterviews.reduce((sum, i) => sum + (i.analysis?.contentMetrics?.relevanceScore ?? 0), 0) / totalAnalyzed
      )
    : 0;

  const avgClarity = totalAnalyzed > 0
    ? Math.round(
        completedInterviews.reduce((sum, i) => sum + (i.analysis?.contentMetrics?.communicationClarity ?? 0), 0) / totalAnalyzed
      )
    : 0;

  // Interviews with feedback = user satisfaction proxy
  const withFeedback = completedInterviews.filter(i => i.feedback?.overallRating).length;
  const userSatisfaction = withFeedback > 0
    ? Math.round(
        completedInterviews
          .filter(i => i.feedback?.overallRating)
          .reduce((sum, i) => sum + (i.feedback?.overallRating ?? 0), 0) / withFeedback
      )
    : 0;

  res.json({
    success: true,
    data: {
      accuracy,
      avgRelevanceScore: avgRelevance,
      avgClarityScore: avgClarity,
      userSatisfaction,
      totalAnalyzed,
      note: 'All values derived from real interview data',
    },
  });
}));

// ==================== RESUME MANAGEMENT ====================

// Get all resumes (paginated)
router.get('/resumes', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;

  const query: any = {};
  
  if (search) {
    query.filename = { $regex: search, $options: 'i' };
  }

  const resumes = await Resume.find(query)
    .populate('userId', 'email profile.firstName profile.lastName')
    .sort({ uploadDate: -1 })
    .limit(limit)
    .skip((page - 1) * limit);

  const total = await Resume.countDocuments(query);

  res.json({
    success: true,
    data: resumes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// Get specific resume
router.get('/resumes/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const resume = await Resume.findById(req.params.id)
    .populate('userId', 'email profile.firstName profile.lastName');
  
  if (!resume) {
    res.status(404).json({
      success: false,
      error: 'Resume not found'
    });
    return;
  }

  res.json({
    success: true,
    data: resume
  });
}));

// Delete resume
router.delete('/resumes/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const resume = await Resume.findById(req.params.id);
  
  if (!resume) {
    res.status(404).json({
      success: false,
      error: 'Resume not found'
    });
    return;
  }

  await Resume.findByIdAndDelete(req.params.id);

  logger.info(`Admin deleted resume: ${resume.filename}`);

  res.json({
    success: true,
    message: 'Resume deleted successfully'
  });
}));

// ==================== INTERVIEW DETAIL MANAGEMENT ====================

// Get specific interview
router.get('/interviews/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const interview = await Interview.findById(req.params.id)
    .populate('userId', 'email profile.firstName profile.lastName');
  
  if (!interview) {
    res.status(404).json({
      success: false,
      error: 'Interview not found'
    });
    return;
  }

  res.json({
    success: true,
    data: interview
  });
}));

// Update interview
router.put('/interviews/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { status, type } = req.body;
  
  const interview = await Interview.findById(req.params.id);
  
  if (!interview) {
    res.status(404).json({
      success: false,
      error: 'Interview not found'
    });
    return;
  }

  if (status) interview.status = status;
  if (type) interview.type = type;

  await interview.save();

  logger.info(`Admin updated interview: ${interview._id}`);

  res.json({
    success: true,
    data: interview,
    message: 'Interview updated successfully'
  });
}));

// Delete interview
router.delete('/interviews/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const interview = await Interview.findById(req.params.id);
  
  if (!interview) {
    res.status(404).json({
      success: false,
      error: 'Interview not found'
    });
    return;
  }

  await Interview.findByIdAndDelete(req.params.id);

  logger.info(`Admin deleted interview: ${interview._id}`);

  res.json({
    success: true,
    message: 'Interview deleted successfully'
  });
}));

// ==================== BULK OPERATIONS ====================

// Bulk delete users
router.post('/users/bulk-delete', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    res.status(400).json({
      success: false,
      error: 'userIds array is required'
    });
    return;
  }

  // Delete users' interviews
  await Interview.deleteMany({ userId: { $in: userIds } });
  
  // Delete users' resumes
  await Resume.deleteMany({ userId: { $in: userIds } });
  
  // Delete users
  const result = await User.deleteMany({ _id: { $in: userIds } });

  logger.info(`Admin bulk deleted ${result.deletedCount} users`);

  res.json({
    success: true,
    message: `Successfully deleted ${result.deletedCount} users and their associated data`
  });
}));

// ==================== EXPORT FEATURES ====================

// Export users to CSV
router.get('/export/users', asyncHandler(async (req: Request, res: Response) => {
  const users = await User.find().select('-password').lean();

  // Convert to CSV format
  const csvHeader = 'Email,First Name,Last Name,Role,Plan,Status,Created At\n';
  const csvRows = users.map(user => 
    `${user.email},${user.profile.firstName},${user.profile.lastName},${user.auth.role || 'user'},${user.subscription.plan},${user.subscription.status},${user.createdAt}`
  ).join('\n');

  const csv = csvHeader + csvRows;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
  res.send(csv);
}));

// Export interviews to CSV
router.get('/export/interviews', asyncHandler(async (req: Request, res: Response) => {
  const interviews = await Interview.find()
    .populate('userId', 'email')
    .lean();

  // Convert to CSV format
  const csvHeader = 'User Email,Type,Status,Score,Created At\n';
  const csvRows = interviews.map(interview => 
    `${(interview.userId as any)?.email || 'Unknown'},${interview.type},${interview.status},${interview.analysis?.overallScore || 'N/A'},${interview.createdAt}`
  ).join('\n');

  const csv = csvHeader + csvRows;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=interviews.csv');
  res.send(csv);
}));

export default router;
