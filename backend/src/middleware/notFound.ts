import { Request, Response, NextFunction } from 'express';

export function notFound(req: Request, res: Response, next: NextFunction) {
  const error = new Error(`Not found - ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
  });
}