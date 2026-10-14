import fs from 'fs';
import path from 'path';

/**
 * AETHER — reader for the backend's real error log.
 *
 * Two defects in the first version of the admin panel are fixed here, both found
 * by reading the actual files in `backend/logs`:
 *
 * 1. WINSTON'S TIMESTAMP IS NOT A DATE. The file format writes
 *    `YYYY-MM-DD HH:mm:ss:ms` (note the colon before the milliseconds), and
 *    `new Date('2026-09-24 18:10:47:1047')` is **Invalid Date**. Every row in the
 *    panel therefore rendered "unknown". `parseLogTimestamp` handles that shape
 *    explicitly, plus ISO strings, and returns null for anything it cannot read.
 *
 * 2. THE NEWEST ERRORS ARE IN A ROTATED FILE. Winston's `maxFiles` rotation
 *    renamed the live file, so `logs/error.log` stopped on 2026-09-24 while
 *    `logs/error1.log` kept receiving writes through today. Reading only
 *    `error.log` made a panel called "Recent error logs" show month-old entries.
 *    Every `error*.log` file is now read and merged by timestamp.
 *
 * Entries are grouped by level+message with a real occurrence count and the
 * first/last time each was seen: repeating an identical error twenty times tells
 * an operator nothing that "×20, last 8 min ago" does not tell them better.
 */

export interface ErrorLogGroup {
  level: string;
  message: string;
  /** Number of stored log lines with this level+message. */
  count: number;
  /** ISO timestamp of the earliest occurrence, or null when unreadable. */
  firstAt: string | null;
  /** ISO timestamp of the latest occurrence, or null when unreadable. */
  lastAt: string | null;
  /** Longest stack trace found for this message, truncated. */
  stack: string | null;
}

export interface ErrorLogReport {
  entries: ErrorLogGroup[];
  meta: {
    /** Files actually read, oldest first. */
    files: string[];
    /** Raw lines scanned across those files. */
    scanned: number;
    /** Lines that were not parseable JSON. */
    unreadable: number;
    /** Distinct levels+messages found. */
    distinct: number;
    /** True when at least one entry had no usable timestamp. */
    hasUndatedEntries: boolean;
  };
}

type RawEntry = {
  level: string;
  message: string;
  at: number | null;
  stack: string | null;
};

const WINSTON_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?::(\d{1,4}))?$/;

/**
 * Parse a logged timestamp into epoch milliseconds.
 *
 * Winston's own format is parsed field-by-field as LOCAL time (which is how it
 * was written), so "x minutes ago" is computed against the same clock. The
 * sub-second fragment is ignored: log ordering needs second resolution, and the
 * formatter emits 3-4 digits inconsistently.
 */
export function parseLogTimestamp(value: unknown): number | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (!text) return null;

  const winston = WINSTON_TIMESTAMP.exec(text);
  if (winston) {
    const [, year, month, day, hour, minute, second] = winston;
    const date = new Date(
      Number(year), Number(month) - 1, Number(day),
      Number(hour), Number(minute), Number(second),
    );
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

/** Every rotated error log, oldest file first (rotation renames the live file). */
export function errorLogFiles(dir: string): string[] {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }

  return names
    .filter(name => /^error.*\.log$/i.test(name))
    .map(name => path.join(dir, name))
    .sort((a, b) => {
      const aTime = safeStat(a)?.mtimeMs ?? 0;
      const bTime = safeStat(b)?.mtimeMs ?? 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.localeCompare(b);
    });
}

function safeStat(file: string): fs.Stats | null {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value === null || value === undefined) return null;
  try {
    const serialised = JSON.stringify(value);
    return serialised && serialised !== '{}' ? serialised : null;
  } catch {
    return null;
  }
}

function truncate(value: string, max = 400): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Read the newest errors across every rotated file.
 *
 * Entries are ordered by their parsed timestamp when every line in the read set
 * has one — which is the case for files this logger writes. When a line has no
 * readable timestamp the raw entry keeps its position in the file rather than
 * being given a guessed one, and its group sorts to the bottom of the report.
 */
export function readRecentErrors(options: { dir: string; limit?: number }): ErrorLogReport {
  const { dir } = options;
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));

  const files = errorLogFiles(dir);
  const entries: RawEntry[] = [];
  let scanned = 0;
  let unreadable = 0;

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const line of content.split('\n')) {
      const text = line.trim();
      if (!text) continue;
      scanned += 1;

      let record: Record<string, unknown>;
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') {
          unreadable += 1;
          continue;
        }
        record = parsed as Record<string, unknown>;
      } catch {
        unreadable += 1;
        continue;
      }

      entries.push({
        level: String(record.level ?? 'error'),
        message: typeof record.message === 'string' && record.message.trim()
          ? record.message.trim()
          : '(no message)',
        at: parseLogTimestamp(record.timestamp ?? record.at ?? record.date),
        stack: toStringOrNull(record.stack),
      });
    }
  }

  const everyEntryIsDated = entries.every(entry => entry.at !== null);
  if (everyEntryIsDated) entries.sort((a, b) => (a.at as number) - (b.at as number));

  const groups = new Map<string, ErrorLogGroup>();
  for (const entry of entries) {
    const key = `${entry.level}\u0000${entry.message}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        level: entry.level,
        message: entry.message,
        count: 1,
        firstAt: entry.at === null ? null : new Date(entry.at).toISOString(),
        lastAt: entry.at === null ? null : new Date(entry.at).toISOString(),
        stack: entry.stack ? truncate(entry.stack) : null,
      });
      continue;
    }

    existing.count += 1;
    if (entry.at !== null) {
      const iso = new Date(entry.at).toISOString();
      if (existing.firstAt === null || entry.at < Date.parse(existing.firstAt)) existing.firstAt = iso;
      if (existing.lastAt === null || entry.at > Date.parse(existing.lastAt)) existing.lastAt = iso;
    }
    if (!existing.stack && entry.stack) existing.stack = truncate(entry.stack);
  }

  // Newest first. A group with no readable timestamp cannot be placed in the
  // timeline, so it is listed last rather than assigned an invented position —
  // `meta.hasUndatedEntries` tells the caller that this happened.
  const ordered = [...groups.values()].sort((a, b) => {
    const aTime = a.lastAt ? Date.parse(a.lastAt) : Number.NEGATIVE_INFINITY;
    const bTime = b.lastAt ? Date.parse(b.lastAt) : Number.NEGATIVE_INFINITY;
    if (aTime !== bTime) return bTime - aTime;
    return a.message.localeCompare(b.message);
  });

  return {
    entries: ordered.slice(0, limit),
    meta: {
      files: files.map(file => path.basename(file)),
      scanned,
      unreadable,
      distinct: groups.size,
      hasUndatedEntries: entries.some(entry => entry.at === null),
    },
  };
}
