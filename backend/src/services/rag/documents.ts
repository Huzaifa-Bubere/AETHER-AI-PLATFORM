import { createHash } from 'crypto';
import axios from 'axios';
import { promises as dns } from 'dns';
import { Agent } from 'https';
import { isIP } from 'net';
import { AIUnavailableError } from '../ai/provider';

export function validateSourceUrl(value: string): URL {
  const url = new URL(value);
  const hosts = (process.env.RAG_ALLOWED_HOSTS || 'developer.mozilla.org,react.dev,nodejs.org,docs.python.org,www.mongodb.com,docs.oracle.com').split(',').map(s => s.trim());
  if (url.protocol !== 'https:' || url.username || url.password || isIP(url.hostname) || url.hostname === 'localhost' ||
    (url.port && url.port !== '443') || !hosts.includes(url.hostname)) {
    throw Object.assign(new Error('Source must use HTTPS on an explicitly allowed documentation host.'), { statusCode: 400 });
  }
  url.hash = '';
  return url;
}

export function cleanDocument(value: string): string {
  return value.replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?[a-z][^>]*>/gi, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function chunkDocument(text: string, size = 1800, overlap = 200): string[] {
  if (size < 200 || overlap < 0 || overlap >= size) throw new Error('Invalid chunk configuration.');
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf(' ', end);
      if (boundary > start + size / 2) end = boundary;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end === text.length) break;
    start = end - overlap;
  }
  return [...new Set(chunks)];
}
export const contentHash = (value: string) => createHash('sha256').update(value).digest('hex');

// Conservatively honor every Disallow, even if targeted at another agent.
export function robotsDisallows(robots: string, path: string): boolean {
  return robots.split('\n').some(line => {
    const rule = line.replace(/#.*/, '').match(/^\s*disallow\s*:\s*(\S+)/i)?.[1];
    if (!rule) return false;
    const anchored = rule.endsWith('$');
    const pattern = (anchored ? rule.slice(0, -1) : rule).split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${pattern}${anchored ? '$' : ''}`).test(path);
  });
}

export async function fetchDocument(value: string): Promise<string> {
  const url = validateSourceUrl(value);
  try {
    const { address } = await dns.lookup(url.hostname, { family: 4 });
    if (!isPublicIPv4(address)) throw new Error('Source resolved to a non-public address.');
    // Pin the validated address for both requests, preventing DNS rebinding.
    const agent = new Agent({ lookup: ((_host: string, options: any, callback: any) => {
      if (options?.all) callback(null, [{ address, family: 4 }]);
      else callback(null, address, 4);
    }) as any });
    const config = { timeout: 15000, maxRedirects: 0, maxContentLength: 1024 * 1024, proxy: false as const, httpsAgent: agent,
      responseType: 'text' as const, headers: { 'User-Agent': 'ATHER-KnowledgeIngestion/1.0', Accept: 'text/html,text/plain,text/markdown' } };
    const robots = await axios.get(`${url.origin}/robots.txt`, { ...config, validateStatus: status => status === 200 || status === 404 });
    if (robots.status === 200 && robotsDisallows(String(robots.data), url.pathname + url.search)) {
      throw new Error('Source disallows automated retrieval.');
    }
    const response = await axios.get(url.toString(), config);
    if (!/text\/(html|plain|markdown)/i.test(String(response.headers['content-type']))) throw new Error('Unsupported document type.');
    return String(response.data);
  } catch {
    throw new AIUnavailableError('Source could not be retrieved within its access policy. Import permitted text or check the source configuration.');
  }
}

export function isPublicIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) ||
    (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}
