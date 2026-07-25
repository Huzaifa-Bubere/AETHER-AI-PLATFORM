import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected = false;

  async initialize(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: false, // Disable reconnection attempts
          connectTimeout: 5000, // 5 second timeout
        },
      });

      let errorLogged = false;
      this.client.on('error', (err) => {
        if (!errorLogged) {
          logger.warn('Redis not available - continuing without Redis cache');
          errorLogged = true;
        }
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis Client Connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis Client Ready');
      });

      this.client.on('end', () => {
        logger.debug('Redis Client Disconnected');
        this.isConnected = false;
      });

      // Try to connect with timeout
      const connectPromise = this.client.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
    } catch (error) {
      logger.warn('Redis not available - continuing without Redis cache');
      this.client = null;
      this.isConnected = false;
      // Don't throw error, just continue without Redis
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis client not available for GET operation');
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET error:', error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis client not available for SET operation');
      return false;
    }

    try {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis client not available for DEL operation');
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DEL error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      return false;
    }
  }

  async setJSON(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    return this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Redis JSON parse error:', error);
      return null;
    }
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      const result = await this.client.incr(key);
      if (ttlSeconds && result === 1) {
        await this.client.expire(key, ttlSeconds);
      }
      return result;
    } catch (error) {
      logger.error('Redis INCR error:', error);
      return 0;
    }
  }

  async addToSet(key: string, value: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      await this.client.sAdd(key, value);
      return true;
    } catch (error) {
      logger.error('Redis SADD error:', error);
      return false;
    }
  }

  async isInSet(key: string, value: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.sIsMember(key, value);
      return result;
    } catch (error) {
      logger.error('Redis SISMEMBER error:', error);
      return false;
    }
  }

  async getSetMembers(key: string): Promise<string[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      return await this.client.sMembers(key);
    } catch (error) {
      logger.error('Redis SMEMBERS error:', error);
      return [];
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.isConnected = false;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

const redisService = new RedisService();

export async function initializeRedis(): Promise<void> {
  await redisService.initialize();
}

export default redisService;