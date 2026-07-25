import mongoSanitize from 'express-mongo-sanitize';
import { Request, Response, NextFunction } from 'express';

// MongoDB injection sanitizer
export const sanitizeData = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized potentially malicious data in ${key}`);
  },
});

// XSS protection middleware
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Helper function to sanitize objects recursively
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
  }

  return sanitized;
}

// Helper function to sanitize strings
function sanitizeString(value: any): any {
  if (typeof value !== 'string') {
    return value;
  }

  // Remove potentially dangerous characters
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframes
    .trim();
}

// Input validation middleware
export const validateInput = (req: Request, res: Response, next: NextFunction): void => {
  // Check for excessively long inputs
  const maxLength = 2 * 1024 * 1024; // 10KB

  const checkLength = (obj: any, path: string = ''): boolean => {
    if (typeof obj === 'string' && obj.length > maxLength) {
      console.warn(`Input too long at ${path}: ${obj.length} characters`);
      return false;
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (!checkLength(obj[key], `${path}.${key}`)) {
            return false;
          }
        }
      }
    }

    return true;
  };

  if (req.body && !checkLength(req.body, 'body')) {
    res.status(400).json({
      success: false,
      error: 'Input too long',
      message: 'Request data exceeds maximum allowed length',
    });
    return;
  }

  next();
};
