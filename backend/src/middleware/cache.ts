import { Request, Response, NextFunction } from 'express';
import redisService from '../services/redis';
import logger from '../utils/logger';

/**
 * Cache middleware for GET requests
 * Usage: router.get('/endpoint', cache(300), handler)
 */
export function cache(ttlSeconds: number = 300) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if Redis is not available
    if (!redisService.isHealthy()) {
      return next();
    }

    try {
      // Generate cache key from URL and query params
      const cacheKey = `cache:${req.originalUrl || req.url}`;

      // Try to get cached response
      const cachedData = await redisService.get(cacheKey);

      if (cachedData) {
        logger.debug(`Cache HIT: ${cacheKey}`);
        
        try {
          const parsedData = JSON.parse(cachedData);
          return res.json(parsedData);
        } catch (error) {
          logger.error('Cache parse error:', error);
          // Continue to next middleware if cache is corrupted
        }
      }

      logger.debug(`Cache MISS: ${cacheKey}`);

      // Store original res.json function
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = function (data: any) {
        // Cache the response
        redisService.set(cacheKey, JSON.stringify(data), ttlSeconds)
          .catch(error => logger.error('Cache set error:', error));

        // Call original json function
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Invalidate cache by pattern
 * Usage: await invalidateCache('user:*')
 */
export async function invalidateCache(pattern: string): Promise<void> {
  if (!redisService.isHealthy()) {
    return;
  }

  try {
    // For simple patterns, just delete the key
    if (!pattern.includes('*')) {
      await redisService.del(`cache:${pattern}`);
      logger.debug(`Cache invalidated: cache:${pattern}`);
      return;
    }

    // For wildcard patterns, we need to get all keys and delete them
    // Note: This is a simplified implementation
    // In production, consider using Redis SCAN command
    logger.warn('Wildcard cache invalidation not fully implemented');
  } catch (error) {
    logger.error('Cache invalidation error:', error);
  }
}

/**
 * Cache user-specific data
 * Usage: router.get('/endpoint', cacheUser(300), handler)
 */
export function cacheUser(ttlSeconds: number = 300) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    if (!redisService.isHealthy()) {
      return next();
    }

    const userId = req.user?.userId;
    if (!userId) {
      return next();
    }

    try {
      const cacheKey = `cache:user:${userId}:${req.originalUrl || req.url}`;
      const cachedData = await redisService.get(cacheKey);

      if (cachedData) {
        logger.debug(`User cache HIT: ${cacheKey}`);
        try {
          const parsedData = JSON.parse(cachedData);
          return res.json(parsedData);
        } catch (error) {
          logger.error('User cache parse error:', error);
        }
      }

      logger.debug(`User cache MISS: ${cacheKey}`);

      const originalJson = res.json.bind(res);
      res.json = function (data: any) {
        redisService.set(cacheKey, JSON.stringify(data), ttlSeconds)
          .catch(error => logger.error('User cache set error:', error));
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('User cache middleware error:', error);
      next();
    }
  };
}

/**
 * Rate limiting with Redis
 * Usage: router.post('/endpoint', rateLimit(10, 60), handler)
 */
export function rateLimit(maxRequests: number, windowSeconds: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redisService.isHealthy()) {
      return next();
    }

    try {
      const identifier = req.user?.userId || req.ip;
      const key = `ratelimit:${identifier}:${req.path}`;

      const current = await redisService.increment(key, windowSeconds);

      // Set headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
      res.setHeader('X-RateLimit-Reset', Date.now() + windowSeconds * 1000);

      if (current > maxRequests) {
        logger.warn(`Rate limit exceeded for ${identifier} on ${req.path}`);
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${windowSeconds} seconds.`,
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limit middleware error:', error);
      next();
    }
  };
}

export default {
  cache,
  cacheUser,
  invalidateCache,
  rateLimit,
};
