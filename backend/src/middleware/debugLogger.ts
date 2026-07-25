import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Debug logging middleware for development
 * Logs all incoming requests with details
 */
export const debugLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // Log request details
  logger.info('📥 Incoming Request', {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body && Object.keys(req.body).length > 0 ? {
      ...req.body,
      password: req.body.password ? '***HIDDEN***' : undefined,
    } : undefined,
    headers: {
      'content-type': req.headers['content-type'],
      'authorization': req.headers.authorization ? 'Bearer ***' : undefined,
      'origin': req.headers.origin,
    },
    ip: req.ip,
  });

  // Log response
  const originalSend = res.send;
  res.send = function (data: any): Response {
    const duration = Date.now() - startTime;
    
    logger.info('📤 Outgoing Response', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: data ? Buffer.byteLength(JSON.stringify(data)) : 0,
    });

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Environment variables logger
 * Logs loaded environment variables (safely)
 */
export const logEnvironmentVariables = (): void => {
  logger.info('🔧 Environment Variables Status:');
  
  const envVars = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'GEMINI_API_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'FRONTEND_URL',
    'PYTHON_AI_SERVER_URL',
  ];

  envVars.forEach(key => {
    const value = process.env[key];
    if (value) {
      // Hide sensitive values
      if (key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD') || key.includes('URI')) {
        logger.info(`  ✅ ${key}: ${value.substring(0, 10)}...`);
      } else {
        logger.info(`  ✅ ${key}: ${value}`);
      }
    } else {
      logger.warn(`  ❌ ${key}: NOT SET`);
    }
  });
};

/**
 * Service health logger
 * Logs the health status of external services
 */
export const logServiceHealth = async (): Promise<void> => {
  logger.info('🏥 Service Health Check:');
  
  // MongoDB
  const mongoose = require('mongoose');
  const mongoStatus = mongoose.connection.readyState;
  const mongoStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  logger.info(`  MongoDB: ${mongoStates[mongoStatus]} (${mongoStatus})`);
  
  // Gemini API
  const geminiKey = process.env.GEMINI_API_KEY;
  logger.info(`  Gemini API: ${geminiKey ? 'Configured' : 'NOT Configured'}`);
  
  // Cloudinary
  const cloudinaryName = process.env.CLOUDINARY_CLOUD_NAME;
  logger.info(`  Cloudinary: ${cloudinaryName ? 'Configured' : 'NOT Configured'}`);
  
  // Python AI Server
  const pythonUrl = process.env.PYTHON_AI_SERVER_URL;
  logger.info(`  Python AI Server: ${pythonUrl || 'NOT Configured'}`);
};
