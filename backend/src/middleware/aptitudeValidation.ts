import { Request, Response, NextFunction } from 'express';
import { isObjectIdOrHexString } from 'mongoose';

export function aptitudeId(_req: Request, res: Response, next: NextFunction, id: string) {
  if (!isObjectIdOrHexString(id)) { res.status(400).json({ message: 'Invalid resource ID.' }); return; }
  next();
}

// Keep the aptitude API's error contract consistent for JSON and multipart requests.
export function aptitudeError(error: any, _req: Request, res: Response, next: NextFunction) {
  if (error.name === 'ValidationError' || error.name === 'CastError' || error.name === 'MulterError' || error.statusCode) {
    res.status(error.statusCode || (error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)).json({ message: error.message });
    return;
  }
  next(error);
}

export function invalidInput(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}
