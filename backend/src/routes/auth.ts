import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { authenticateToken } from '../middleware/auth';
import { generateTokens } from '../utils/auth';
import { 
  registrationValidation, 
  loginValidation, 
  emailValidation,
  passwordValidation 
} from '../utils/validation';
import logger from '../utils/logger';
import emailService from '../services/email';

const router = express.Router();

// Traditional registration
router.post('/register', registrationValidation(), async (req, res): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
        details: errors.array(),
      });
      return;
    }

    const { email, password, profile, preferences } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        success: false,
        error: 'User already exists with this email',
      });
      return;
    }

    // Create new user with proper defaults
    const user = new User({
      email,
      password,
      profile,
      preferences: {
        role: preferences?.role || '',
        experienceLevel: preferences?.experienceLevel || 'entry',
        industries: preferences?.industries || [],
        interviewTypes: preferences?.interviewTypes || [],
      },
    });

    // Generate verification token
    const verificationToken = jwt.sign(
      { userId: user._id, type: 'email-verification' },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '24h' }
    );
    
    user.auth.verificationToken = verificationToken;
    await user.save();

    // Generate tokens
    const tokens = generateTokens(user._id.toString());

    // Update last login
    user.auth.lastLogin = new Date();
    await user.save();

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, verificationToken);
      logger.info(`Verification email sent to: ${email}`);
    } catch (emailError) {
      logger.error(`Failed to send verification email to ${email}:`, emailError);
      // Don't fail registration if email fails
    }

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      success: true,
      data: {
        user: user.toJSON(),
        tokens,
      },
      message: 'User registered successfully',
    });
  } catch (error: any) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: error.message,
    });
  }
});

// Traditional login
router.post('/login', loginValidation(), async (req, res): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
      return;
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      res.status(423).json({
        success: false,
        error: 'Account is temporarily locked due to too many failed login attempts',
      });
      return;
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      await user.incLoginAttempts();
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
      return;
    }

    // Reset login attempts on successful login
    if (user.auth.loginAttempts > 0) {
      await user.updateOne({
        $unset: { 'auth.loginAttempts': 1, 'auth.lockUntil': 1 },
      });
    }

    // Generate tokens
    const tokens = generateTokens(user._id.toString());

    // Update last login
    user.auth.lastLogin = new Date();
    await user.save();

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      data: {
        user: user.toJSON(),
        tokens,
      },
      message: 'Login successful',
    });
  } catch (error: any) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: error.message,
    });
  }
});

// Auth0 profile creation/update
router.post('/create-profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, profile, preferences } = req.body;
    
    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required',
      });
      return;
    }

    // Check if MongoDB is connected
    const isMongoConnected = mongoose.connection.readyState === 1;

    if (!isMongoConnected) {
      if (process.env.NODE_ENV === 'production') {
        res.status(503).json({ success: false, error: 'Service temporarily unavailable' });
        return;
      }
      // Development only: return a mock profile
      logger.warn('No database connection - returning mock user profile for development');
      res.json({
        success: true,
        data: {
          id: 'dev-user-' + Date.now(),
          email,
          profile: profile || { firstName: email.split('@')[0] || 'Dev', lastName: 'User' },
          preferences: preferences || { role: '', experienceLevel: 'entry', industries: [], interviewTypes: [] },
          subscription: { plan: 'free', status: 'active' },
          stats: { totalInterviews: 0, averageScore: 0, improvementRate: 0 },
        },
        message: 'Profile created (development mode)',
      });
      return;
    }

    // Check if user already exists
    let user = await User.findOne({ email: email });

    if (user) {
      // Update existing user
      if (profile) {
        user.profile = { ...user.profile, ...profile };
      }
      if (preferences) {
        user.preferences = { ...user.preferences, ...preferences };
      }
      user.auth.lastLogin = new Date();
      await user.save();
    } else {
      // Create new user for Auth0
      user = new User({
        email,
        password: 'auth0-managed', // Placeholder password for Auth0 users
        profile: profile || {
          firstName: email.split('@')[0] || 'User',
          lastName: '',
        },
        preferences: preferences || {
          role: '',
          experienceLevel: 'entry',
          industries: [],
          interviewTypes: [],
        },
        auth: {
          isVerified: true, // Auth0 users are pre-verified
          lastLogin: new Date(),
        },
      });
      await user.save();
    }

    logger.info(`Auth0 user profile created/updated: ${email}`);

    res.json({
      success: true,
      data: user.toJSON(),
      message: 'Profile created/updated successfully',
    });
  } catch (error: any) {
    logger.error('Profile creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Profile creation failed',
      message: error.message,
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        error: 'Refresh token is required',
      });
      return;
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Generate new tokens
    const tokens = generateTokens(user._id.toString());

    res.json({
      success: true,
      data: tokens,
      message: 'Tokens refreshed successfully',
    });
  } catch (error: any) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
    });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res): Promise<void> => {
  try {
    // In a production app, you might want to blacklist the token
    // For now, we'll just return success as the client will remove the token
    
    logger.info(`User logged out: ${req.user?.userId}`);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      message: error.message,
    });
  }
});

// Forgot password
router.post('/forgot-password', emailValidation(), async (req, res): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
      });
      return;
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
      return;
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user._id, type: 'password-reset' },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '1h' }
    );

    // Save reset token
    user.auth.resetPasswordToken = resetToken;
    user.auth.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(user.email, resetToken);
      logger.info(`Password reset email sent to: ${email}`);
    } catch (emailError) {
      logger.error(`Email send failed for user ${user._id}:`, emailError);      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error: any) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Password reset request failed',
    });
  }
});

// Reset password
router.post('/reset-password', [
  passwordValidation(),
], async (req, res): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
        details: errors.array(),
      });
      return;
    }

    const { token, password } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Reset token is required',
      });
      return;
    }

    // Verify reset token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;
    
    if (decoded.type !== 'password-reset') {
      res.status(400).json({
        success: false,
        error: 'Invalid reset token',
      });
      return;
    }

    // Find user
    const user = await User.findOne({
      _id: decoded.userId,
      'auth.resetPasswordToken': token,
      'auth.resetPasswordExpires': { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
      return;
    }

    // Update password
    user.password = password;
    user.auth.resetPasswordToken = undefined;
    user.auth.resetPasswordExpires = undefined;
    user.auth.loginAttempts = 0;
    user.auth.lockUntil = undefined;
    await user.save();

    logger.info(`Password reset successful for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error: any) {
    logger.error('Password reset error:', error);
    res.status(400).json({
      success: false,
      error: 'Password reset failed',
    });
  }
});

// Verify email
router.get('/verify-email', async (req, res): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Verification token is required',
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token as string, process.env.JWT_ACCESS_SECRET!) as any;
    
    if (decoded.type !== 'email-verification') {
      res.status(400).json({
        success: false,
        error: 'Invalid verification token',
      });
      return;
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    if (user.auth.isVerified) {
      res.json({
        success: true,
        message: 'Email already verified',
      });
      return;
    }

    // Verify email
    user.auth.isVerified = true;
    user.auth.verificationToken = undefined;
    await user.save();

    // Send welcome email
    await emailService.sendWelcomeEmail(user.email, user.profile.firstName);

    logger.info(`Email verified for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error: any) {
    logger.error('Email verification error:', error);
    res.status(400).json({
      success: false,
      error: 'Email verification failed',
      message: error.message,
    });
  }
});

// Resend verification email
router.post('/resend-verification', [
  body('email').isEmail().normalizeEmail(),
], async (req, res): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Invalid email address',
      });
      return;
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      res.json({
        success: true,
        message: 'If an account with that email exists, a verification link has been sent.',
      });
      return;
    }

    if (user.auth.isVerified) {
      res.json({
        success: true,
        message: 'Email is already verified',
      });
      return;
    }

    // Generate verification token
    const verificationToken = jwt.sign(
      { userId: user._id, type: 'email-verification' },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '24h' }
    );

    user.auth.verificationToken = verificationToken;
    await user.save();

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, verificationToken);
      logger.info(`Verification email resent to: ${email}`);
    } catch (emailError) {
      logger.error(`Failed to resend verification email to ${email}:`, emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Verification email sent successfully',
    });
  } catch (error: any) {
    logger.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification email',
    });
  }
});

// Verify OTP (placeholder for future implementation)
router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
], async (req, res): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    // TODO: Implement OTP verification logic
    // For now, we'll just return success
    res.json({
      success: true,
      data: { verified: true },
      message: 'OTP verified successfully',
    });
  } catch (error: any) {
    logger.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      error: 'OTP verification failed',
    });
  }
});

export default router;