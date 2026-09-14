import jwt from 'jsonwebtoken';
import { Request } from 'express';

export interface TokenPayload {
  userId: string;
  type: 'access' | 'refresh';
  tokenVersion: number;
  email?: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Generate JWT tokens
export function generateTokens(userId: string, tokenVersion = 0): AuthTokens {
  const payload = { userId, tokenVersion };
  
  const accessToken = jwt.sign(
    { ...payload, type: 'access' },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' } as jwt.SignOptions
  );

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } as jwt.SignOptions
  );

  return { accessToken, refreshToken };
}

// Verify JWT token
export function verifyToken(token: string, secret: string, type: 'access' | 'refresh' = 'access'): TokenPayload {
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as TokenPayload;
  if (!payload || payload.type !== type || typeof payload.userId !== 'string' ||
      !/^[a-f\d]{24}$/i.test(payload.userId) || !Number.isInteger(payload.tokenVersion) || payload.tokenVersion < 0) {
    throw new Error('Invalid token purpose or payload');
  }
  return payload;
}

// Extract token from request
export function extractTokenFromRequest(req: Request): string | null {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check query parameter (for file downloads/views in new tabs)
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }
  
  return null;
}

// Auth0 is unavailable until an issuer/audience and signature verifier are configured.
export async function verifyAuth0Token(_token: string): Promise<TokenPayload | null> {
  return null;
}

// Generate random string for tokens
export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

// Hash password (used in User model pre-save hook)
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

// Compare password (used in User model method)
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(password, hash);
}
