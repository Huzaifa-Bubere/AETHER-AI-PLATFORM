import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import { extractTokenFromRequest, verifyToken } from '../utils/auth';
import logger from '../utils/logger';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email?: string;
        role?: string;
      };
    }
  }
}

// Main authentication middleware
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      res.status(401).json({ success: false, error: 'Access token is required' });
      return;
    }

    // Verify token with our own secret — this is the ONLY verification path.
    // Auth0 tokens are not accepted here; users must log in via our /auth/login
    // endpoint which issues our own JWTs.
    let decoded;
    try {
      decoded = verifyToken(token, process.env.JWT_ACCESS_SECRET!);
    } catch {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    // Check DB connectivity — in production, never bypass with a mock user
    const isMongoConnected = mongoose.connection.readyState === 1;
    if (!isMongoConnected) {
      if (process.env.NODE_ENV === 'production') {
        res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
        return;
      }
      // Development only: allow request through with token payload
      logger.warn('No DB connection — using token payload as user (dev only)');
      req.user = { userId: decoded.userId, email: decoded.email || '', role: 'free' };
      next();
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    if (user.isAccountLocked()) {
      res.status(423).json({ success: false, error: 'Account is locked' });
      return;
    }

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      role: user.subscription.plan,
    };

    next();
  } catch (error: any) {
    logger.error('Authentication error:', error);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}

// Optional authentication (doesn't fail if no token)
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractTokenFromRequest(req);
    if (token) {
      try {
        const decoded = verifyToken(token, process.env.JWT_ACCESS_SECRET!);
        const user = await User.findById(decoded.userId);
        if (user && !user.isAccountLocked()) {
          req.user = { userId: user._id.toString(), email: user.email, role: user.subscription.plan };
        }
      } catch {
        // Ignore token errors in optional auth
      }
    }
    next();
  } catch (error: any) {
    logger.error('Optional auth error:', error);
    next();
  }
}

// Role-based authorization middleware
export function requireRole(roles: string | string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    const userRole = req.user.role || 'free';
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

// Admin only middleware
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    if (user.auth.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }
    next();
  } catch (error: any) {
    logger.error('Admin authorization error:', error);
    res.status(500).json({ success: false, error: 'Authorization failed' });
  }
}

// Rate limiting by user (in-memory, per-process)
export function rateLimitByUser(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  const userRequests = new Map<string, { count: number; resetTime: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.userId || req.ip || 'unknown';
    const now = Date.now();
    const userLimit = userRequests.get(userId);
    if (!userLimit || now > userLimit.resetTime) {
      userRequests.set(userId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }
    if (userLimit.count >= maxRequests) {
      res.status(429).json({ success: false, error: 'Too many requests, please try again later' });
      return;
    }
    userLimit.count++;
    next();
  };
}
