import { Response } from 'express';

/**
 * Standardized API response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Send standardized success response
 */
export const sendSuccess = <T = any>(
  res: Response,
  data?: T,
  statusCode: number = 200,
  pagination?: ApiResponse['pagination']
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    ...(data !== undefined && { data }),
    ...(pagination && { pagination }),
  };
  
  return res.status(statusCode).json(response);
};

/**
 * Send standardized error response
 */
export const sendError = (
  res: Response,
  error: string,
  statusCode: number = 400
): Response => {
  const response: ApiResponse = {
    success: false,
    error,
  };
  
  return res.status(statusCode).json(response);
};

/**
 * Send paginated response
 */
export const sendPaginated = <T = any>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  statusCode: number = 200
): Response => {
  const pages = Math.ceil(total / limit);
  
  return sendSuccess(res, data, statusCode, {
    page,
    limit,
    total,
    pages,
  });
};
