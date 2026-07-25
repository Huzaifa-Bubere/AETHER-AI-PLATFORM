import { body, ValidationChain } from 'express-validator';

/**
 * Comprehensive validation utilities
 */

// Password validation
export const passwordValidation = (): ValidationChain => {
  return body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character');
};

// Email validation
export const emailValidation = (): ValidationChain => {
  return body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .custom((value) => {
      // Additional email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error('Invalid email format');
      }
      return true;
    });
};

// Name validation
export const nameValidation = (field: string): ValidationChain => {
  return body(field)
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage(`${field} must be between 1 and 50 characters`)
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(`${field} can only contain letters, spaces, hyphens, and apostrophes`);
};

// Phone validation
export const phoneValidation = (): ValidationChain => {
  return body('profile.phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage('Please provide a valid phone number')
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone number must be between 10 and 20 characters');
};

// URL validation
export const urlValidation = (field: string): ValidationChain => {
  return body(field)
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage(`${field} must be a valid URL`);
};

// Interview settings validation
export const interviewSettingsValidation = (): ValidationChain[] => {
  return [
    body('settings.role')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Role must be between 1 and 100 characters'),
    body('settings.difficulty')
      .isIn(['easy', 'medium', 'hard'])
      .withMessage('Difficulty must be easy, medium, or hard'),
    body('settings.duration')
      .isInt({ min: 15, max: 120 })
      .withMessage('Duration must be between 15 and 120 minutes'),
  ];
};

// Resume file validation
export const resumeFileValidation = (file: Express.Multer.File | undefined): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: 'Resume file is required' };
  }

  // Check file size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  // Check file type
  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: 'File must be PDF, DOC, or DOCX format' };
  }

  // Check file extension
  const allowedExtensions = ['.pdf', '.doc', '.docx'];
  const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  if (!allowedExtensions.includes(fileExtension)) {
    return { valid: false, error: 'File extension must be .pdf, .doc, or .docx' };
  }

  return { valid: true };
};

// Image file validation
export const imageFileValidation = (file: Express.Multer.File | undefined): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: 'Image file is required' };
  }

  // Check file size (5MB max)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'Image size must be less than 5MB' };
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: 'Image must be JPEG, PNG, GIF, or WebP format' };
  }

  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  if (!allowedExtensions.includes(fileExtension)) {
    return { valid: false, error: 'File extension must be .jpg, .jpeg, .png, .gif, or .webp' };
  }

  return { valid: true };
};

// Sanitize input
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
};

// Validate MongoDB ObjectId
export const isValidObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// Validate date range
export const validateDateRange = (startDate: Date, endDate: Date): { valid: boolean; error?: string } => {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    return { valid: false, error: 'Invalid date format' };
  }

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { valid: false, error: 'Invalid date values' };
  }

  if (startDate > endDate) {
    return { valid: false, error: 'Start date must be before end date' };
  }

  return { valid: true };
};

// Validate pagination parameters
export const validatePagination = (page: any, limit: any): { page: number; limit: number; error?: string } => {
  const parsedPage = parseInt(page) || 1;
  const parsedLimit = parseInt(limit) || 10;

  if (parsedPage < 1) {
    return { page: 1, limit: parsedLimit, error: 'Page must be greater than 0' };
  }

  if (parsedLimit < 1 || parsedLimit > 100) {
    return { page: parsedPage, limit: 10, error: 'Limit must be between 1 and 100' };
  }

  return { page: parsedPage, limit: parsedLimit };
};

// Validate score (0-100)
export const validateScore = (score: any): { valid: boolean; error?: string } => {
  const parsedScore = parseFloat(score);

  if (isNaN(parsedScore)) {
    return { valid: false, error: 'Score must be a number' };
  }

  if (parsedScore < 0 || parsedScore > 100) {
    return { valid: false, error: 'Score must be between 0 and 100' };
  }

  return { valid: true };
};

// Comprehensive registration validation
export const registrationValidation = (): ValidationChain[] => {
  return [
    emailValidation(),
    passwordValidation(),
    nameValidation('profile.firstName'),
    nameValidation('profile.lastName'),
    phoneValidation(),
  ];
};

// Comprehensive login validation
export const loginValidation = (): ValidationChain[] => {
  return [
    emailValidation(),
    body('password')
      .isLength({ min: 1 })
      .withMessage('Password is required'),
  ];
};

// Profile update validation - RELAXED for better UX
export const profileUpdateValidation = (): ValidationChain[] => {
  return [
    body('profile.firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('First name must be between 1 and 100 characters'),
    body('profile.lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Last name must be between 1 and 100 characters'),
    body('profile.phone')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .custom((value) => {
        // Allow empty string or valid phone
        if (!value || value === '') return true;
        if (!/^[\d\s\-\+\(\)]+$/.test(value)) {
          throw new Error('Please provide a valid phone number');
        }
        if (value.length < 10 || value.length > 20) {
          throw new Error('Phone number must be between 10 and 20 characters');
        }
        return true;
      }),
    body('profile.location')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isLength({ max: 200 })
      .withMessage('Location must be less than 200 characters'),
    body('preferences.role')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isLength({ max: 200 })
      .withMessage('Role must be less than 200 characters'),
    body('preferences.experienceLevel')
      .optional({ nullable: true, checkFalsy: true })
      .custom((value) => {
        if (!value || value === '') return true;
        if (!['entry', 'mid', 'senior', 'executive'].includes(value)) {
          throw new Error('Experience level must be entry, mid, senior, or executive');
        }
        return true;
      }),
  ];
};

export default {
  passwordValidation,
  emailValidation,
  nameValidation,
  phoneValidation,
  urlValidation,
  interviewSettingsValidation,
  resumeFileValidation,
  imageFileValidation,
  sanitizeInput,
  isValidObjectId,
  validateDateRange,
  validatePagination,
  validateScore,
  registrationValidation,
  loginValidation,
  profileUpdateValidation,
};
