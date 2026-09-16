import dns from 'dns';

/**
 * Some Windows networks block Node's c-ares resolver from reaching the local
 * router DNS, which breaks mongodb+srv:// SRV discovery with
 * `querySrv ECONNREFUSED` (system tools like nslookup still work).
 *
 * This utility probes the system resolver and, only when it is actually
 * refusing/failing, falls back to public resolvers (8.8.8.8, 1.1.1.1).
 */

const PUBLIC_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

/** Codes that indicate the resolver itself is unreachable/broken (NOT NXDOMAIN). */
const RESOLVER_FAILURE_CODES = new Set(['ECONNREFUSED', 'ESERVFAIL', 'ETIMEOUT']);

let probePromise: Promise<void> | null = null;

/**
 * Probe the system resolver once; if it fails, switch to public DNS.
 * Safe to call multiple times — the probe runs at most once per process.
 */
export function ensureDnsFallback(): Promise<void> {
  if (!probePromise) {
    probePromise = new Promise<void>(resolve => {
      dns.resolveSrv('_mongodb._tcp.example.invalid', err => {
        const code = (err as NodeJS.ErrnoException | null)?.code;
        if (err && code && RESOLVER_FAILURE_CODES.has(code)) {
          console.warn(
            `[dns] system DNS resolver failing (${code}) — switching to public resolvers (${PUBLIC_DNS_SERVERS.join(', ')})`
          );
          dns.setServers(PUBLIC_DNS_SERVERS);
        }
        resolve();
      });
      // Never block startup longer than this on the probe.
      setTimeout(resolve, 3000);
    });
  }
  return probePromise;
}

/** Force public DNS servers — used before connection retries. */
export function forcePublicDns(): void {
  dns.setServers(PUBLIC_DNS_SERVERS);
}

/** Detect DNS-flavored connection errors (e.g. from mongodb+srv discovery). */
export function isDnsError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | undefined;
  if (!e) return false;
  if (e.code && RESOLVER_FAILURE_CODES.has(e.code)) return true;
  return typeof e.message === 'string' && e.message.includes('querySrv');
}
