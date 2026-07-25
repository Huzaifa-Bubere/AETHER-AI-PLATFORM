import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import { asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = express.Router();

interface ServiceStatus {
  status: 'ok' | 'error' | 'skipped';
  latencyMs?: number;
  detail?: string;
}

interface HealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptimeSeconds: number;
  services: {
    mongodb: ServiceStatus;
    gemini: ServiceStatus;
    pythonAiServer: ServiceStatus;
    stripe: ServiceStatus;
    redis: ServiceStatus;
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function checkMongoDB(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const state = mongoose.connection.readyState;
    // 1 = connected
    if (state !== 1) {
      return { status: 'error', detail: `Mongoose readyState=${state} (not connected)` };
    }
    // Ping the DB
    await mongoose.connection.db.admin().ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err: any) {
    return { status: 'error', latencyMs: Date.now() - start, detail: err.message };
  }
}

async function checkGemini(): Promise<ServiceStatus> {
  const start = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { status: 'error', detail: 'GEMINI_API_KEY not set' };

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await axios.post(
      url,
      { contents: [{ parts: [{ text: 'ping' }] }] },
      { timeout: 8000 }
    );
    if (res.status === 200) {
      return { status: 'ok', latencyMs: Date.now() - start };
    }
    return { status: 'error', latencyMs: Date.now() - start, detail: `HTTP ${res.status}` };
  } catch (err: any) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      detail: err.response?.data?.error?.message || err.message,
    };
  }
}

async function checkPythonAiServer(): Promise<ServiceStatus> {
  const start = Date.now();
  const url = process.env.PYTHON_AI_SERVER_URL;
  if (!url) return { status: 'error', detail: 'PYTHON_AI_SERVER_URL not set in backend/.env' };

  try {
    const res = await axios.get(`${url}/health`, { timeout: 6000 });
    if (res.status === 200) {
      return { status: 'ok', latencyMs: Date.now() - start, detail: JSON.stringify(res.data?.services || {}) };
    }
    return { status: 'error', latencyMs: Date.now() - start, detail: `HTTP ${res.status}` };
  } catch (err: any) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      detail: err.code === 'ECONNREFUSED'
        ? 'Python AI server not running on ' + url
        : err.message,
    };
  }
}

async function checkStripe(): Promise<ServiceStatus> {
  const start = Date.now();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { status: 'error', detail: 'STRIPE_SECRET_KEY not set' };

  try {
    // Lightweight call — list 1 customer
    const res = await axios.get('https://api.stripe.com/v1/customers?limit=1', {
      headers: { Authorization: `Bearer ${key}` },
      timeout: 6000,
    });
    if (res.status === 200) {
      return { status: 'ok', latencyMs: Date.now() - start };
    }
    return { status: 'error', latencyMs: Date.now() - start, detail: `HTTP ${res.status}` };
  } catch (err: any) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      detail: err.response?.data?.error?.message || err.message,
    };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  const start = Date.now();
  const url = process.env.REDIS_URL;
  if (!url) return { status: 'skipped', detail: 'REDIS_URL not set' };

  try {
    // Dynamically import to avoid crashing if redis package missing
    const { createClient } = await import('redis');
    const client = createClient({ url });
    await client.connect();
    await client.ping();
    await client.disconnect();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err: any) {
    return {
      status: 'skipped',
      latencyMs: Date.now() - start,
      detail: `Redis unavailable (optional): ${err.message}`,
    };
  }
}

// ── route ─────────────────────────────────────────────────────────────────────

router.get(
  '/full-check',
  asyncHandler(async (_req: Request, res: Response) => {
    logger.info('Health full-check requested');

    const [mongodb, gemini, pythonAiServer, stripe, redis] = await Promise.all([
      checkMongoDB(),
      checkGemini(),
      checkPythonAiServer(),
      checkStripe(),
      checkRedis(),
    ]);

    const services = { mongodb, gemini, pythonAiServer, stripe, redis };

    // overall: unhealthy if any critical service is down
    const criticalFailed = [mongodb, gemini, pythonAiServer, stripe].some(
      (s) => s.status === 'error'
    );
    const overall: HealthReport['overall'] = criticalFailed ? 'degraded' : 'healthy';

    const report: HealthReport = {
      overall,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      services,
    };

    logger.info(`Health check complete — overall: ${overall}`);
    res.status(criticalFailed ? 207 : 200).json({ success: true, data: report });
  })
);

// Quick liveness probe (no external calls)
router.get('/ping', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
