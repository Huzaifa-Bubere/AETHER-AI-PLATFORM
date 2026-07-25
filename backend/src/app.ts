import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import resumeRoutes from './routes/resume';
import interviewRoutes from './routes/interview';
import feedbackRoutes from './routes/feedback';
import adminRoutes from './routes/admin';
import codeExecutionRoutes from './routes/codeExecution';
import paymentRoutes from './routes/payment';
import practiceRoutes from './routes/practice';
import schedulingRoutes from './routes/scheduling';
import healthRoutes from './routes/health';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { authenticateToken, requireAdmin } from './middleware/auth';
import { apiLimiter, authLimiter, passwordResetLimiter, uploadLimiter } from './middleware/rateLimiter';
import { sanitizeData, xssProtection, validateInput } from './middleware/sanitizer';
import logger from './utils/logger';

/**
 * Create and configure Express application
 * Separated from server.ts for testing purposes
 */
export function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "https://js.stripe.com"],
        imgSrc: ["'self'", "data:", "https:", "https://*.stripe.com"],
        frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        fontSrc: ["'self'", "https:", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        scriptSrcAttr: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    originAgentCluster: true,
  }));

  // CORS configuration
  const corsOptions = {
    origin: function (origin: string | undefined, callback: Function) {
      // Allow requests with no origin (Render health checks, curl, mobile)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        'http://localhost:5175',
        'http://localhost:5174',
        'http://localhost:3000',
        process.env.FRONTEND_URL,
      ].filter(Boolean) as string[];

      // Allow any *.vercel.app URL (covers all preview + production deployments)
      const isVercel = /^https:\/\/.*\.vercel\.app$/.test(origin);
      // Allow any *.onrender.com URL (covers Render preview services)
      const isRender = /^https:\/\/.*\.onrender\.com$/.test(origin);

      if (
        allowedOrigins.includes(origin) ||
        isVercel ||
        isRender ||
        process.env.NODE_ENV === 'test'
      ) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        // In development, allow anyway to avoid blocking local testing
        if (process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 600
  };

  app.use(cors(corsOptions));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Security middleware - Sanitization
  app.use(sanitizeData);
  app.use(xssProtection);
  app.use(validateInput);

  // Compression middleware
  app.use(compression());

  // Logging middleware (skip in test environment)
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    }));
  }

  // Root route — confirms API is live
  app.get('/', (req, res) => {
    res.status(200).json({
      name: 'Smart Interview AI — Backend API',
      status: 'running',
      version: '1.0.0',
      health: '/health',
      api: '/api',
    });
  });

  // Health check endpoints
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // API routes - EXACT paths that tests expect
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/user', apiLimiter, authenticateToken, userRoutes);
  app.use('/api/resume', uploadLimiter, authenticateToken, resumeRoutes);
  app.use('/api/interview', apiLimiter, authenticateToken, interviewRoutes);
  app.use('/api/feedback', apiLimiter, authenticateToken, feedbackRoutes);
  app.use('/api/admin', apiLimiter, authenticateToken, requireAdmin, adminRoutes);
  app.use('/api/code', apiLimiter, codeExecutionRoutes);
  app.use('/api/payment', apiLimiter, paymentRoutes);
  app.use('/api/practice', apiLimiter, authenticateToken, practiceRoutes);
  app.use('/api/scheduling', apiLimiter, authenticateToken, schedulingRoutes);
  app.use('/api/health', healthRoutes); // no auth — public health check

  // Error handling middleware (must be last)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

// Export app instance for testing
export default createApp();
