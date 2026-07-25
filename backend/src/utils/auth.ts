import jwt from 'jsonwebtoken';
import { Request } from 'express';

export interface TokenPayload {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Generate JWT tokens
export function generateTokens(userId: string): AuthTokens {
  const payload = { userId };
  
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' } as jwt.SignOptions
  );

  const refreshToken = jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } as jwt.SignOptions
  );

  return { accessToken, refreshToken };
}

// Verify JWT token
export function verifyToken(token: string, secret: string): TokenPayload {
  return jwt.verify(token, secret) as TokenPayload;
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

// Verify Auth0 token (for future implementation)
export async function verifyAuth0Token(token: string): Promise<TokenPayload | null> {
  try {
    // TODO: Implement Auth0 token verification
    // This would typically involve verifying the JWT with Auth0's public key
    // For now, we'll decode without verification (not recommended for production)
    const decoded = jwt.decode(token) as any;
    
    if (decoded && decoded.sub) {
      return {
        userId: decoded.sub,
        email: decoded.email,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Auth0 token verification error:', error);
    return null;
  }
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