import { Request, Response, NextFunction } from 'express';

// Validate structure without rewriting passwords, source code or user text.
// HTML escaping belongs at the rendering/export boundary.
function invalidInput(value: unknown, depth = 0): boolean {
  if (depth > 100) return true;
  if (typeof value === 'string') return value.length > 2 * 1024 * 1024;
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) return false;
  return Object.entries(value).some(([key, child]) =>
    key.startsWith('$') || key.includes('.') || key === '__proto__' ||
    key === 'prototype' || invalidInput(child, depth + 1));
}

export const validateInput = (req: Request, res: Response, next: NextFunction): void => {
  if ([req.body, req.query, req.params].some((value) => invalidInput(value))) {
    res.status(400).json({ success: false, error: 'Invalid request structure or input size' });
    return;
  }
  next();
};

// Compatibility exports for existing callers; values are never mutated.
export const xssProtection = validateInput;
export const sanitizeData = validateInput;
