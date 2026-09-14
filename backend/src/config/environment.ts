import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';
import { isIP } from 'net';

export function validateEnvironment(env: NodeJS.ProcessEnv): void {
  const missing = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']
    .filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }
  const port = Number(env.PORT || '5001');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  if (!/^mongodb(?:\+srv)?:\/\//.test(env.MONGODB_URI!)) {
    throw new Error('MONGODB_URI must use mongodb:// or mongodb+srv://');
  }
  if (env.DNS_SERVERS && env.DNS_SERVERS.split(',').some(server => !isIP(server.trim()))) {
    throw new Error('DNS_SERVERS must be a comma-separated list of IP addresses');
  }
}

export function loadEnvironment(): void {
  // Both src/config and dist/config resolve to backend/.env.
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  validateEnvironment(process.env);
  if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(',').map(server => server.trim()));
}
