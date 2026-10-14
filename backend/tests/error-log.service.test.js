/**
 * Error log reader (admin "Recent error logs").
 *
 * The panel it backs was wrong twice over, and both defects are pinned here:
 *  - `new Date('2026-09-24 18:10:47:1047')` is Invalid Date, so every row showed
 *    "unknown" — winston writes `YYYY-MM-DD HH:mm:ss:ms`, not an ISO string;
 *  - only `logs/error.log` was read, but that file had been rotated: the live
 *    errors were being appended to `logs/error1.log`, so a "recent" panel showed
 *    month-old entries.
 */

process.env.NODE_ENV = 'test';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseLogTimestamp, errorLogFiles, readRecentErrors } = require('../dist/services/errorLog.service');

const tempDirs = [];
function makeDir(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aether-errorlog-'));
  tempDirs.push(dir);
  for (const [name, lines] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), lines.join('\n') + '\n', 'utf8');
  }
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp dir */ }
  }
});

const line = (timestamp, message, extra = {}) =>
  JSON.stringify({ level: 'error', message, timestamp, ...extra });

describe('winston timestamp parsing', () => {
  test('the stored format is NOT parseable by new Date — which is why every row said "unknown"', () => {
    const stored = '2026-09-24 18:10:47:1047';
    expect(Number.isNaN(new Date(stored).getTime())).toBe(true);
    expect(parseLogTimestamp(stored)).toBe(new Date(2026, 8, 24, 18, 10, 47).getTime());
  });

  test('seconds-only and 3-digit millisecond variants both parse', () => {
    expect(parseLogTimestamp('2026-10-14 17:55:00:512')).toBe(new Date(2026, 9, 14, 17, 55, 0).getTime());
    expect(parseLogTimestamp('2026-10-14 17:55:00')).toBe(new Date(2026, 9, 14, 17, 55, 0).getTime());
  });

  test('ISO strings still work', () => {
    expect(parseLogTimestamp('2026-10-14T17:55:00.000Z')).toBe(Date.parse('2026-10-14T17:55:00.000Z'));
  });

  test('anything unreadable is null, never a guess', () => {
    for (const value of [undefined, null, '', '   ', 'not a date', 12345, {}, []]) {
      expect(parseLogTimestamp(value)).toBeNull();
    }
  });
});

describe('rotation', () => {
  test('every rotated file is read and merged newest-first', () => {
    const dir = makeDir({
      'error.log': [line('2026-09-24 10:00:00:0', 'old failure')],
      'error1.log': [line('2026-10-14 18:19:23:1923', 'newest failure')],
      'error2.log': [line('2026-10-01 09:30:00:0', 'middle failure')],
    });

    const report = readRecentErrors({ dir, limit: 10 });

    expect(report.entries.map(entry => entry.message)).toEqual(['newest failure', 'middle failure', 'old failure']);
    expect(report.meta.files.sort()).toEqual(['error.log', 'error1.log', 'error2.log']);
    expect(report.meta.scanned).toBe(3);
  });

  test('the live rotated file is not skipped just because its name is not "error.log"', () => {
    const dir = makeDir({
      'error.log': [line('2026-05-14 20:43:50:4350', 'ancient failure')],
      'error1.log': [line('2026-10-14 18:19:23:1923', 'today failure')],
    });

    // This is exactly the situation that made the panel show 20-day-old errors.
    expect(readRecentErrors({ dir }).entries[0].message).toBe('today failure');
  });

  test('a missing directory is an empty report, not an exception', () => {
    const report = readRecentErrors({ dir: path.join(os.tmpdir(), 'aether-does-not-exist-xyz') });
    expect(report.entries).toEqual([]);
    expect(report.meta.files).toEqual([]);
    expect(report.meta.scanned).toBe(0);
  });

  test('unrelated log files are ignored', () => {
    const dir = makeDir({
      'error.log': [line('2026-10-14 18:00:00:0', 'real error')],
      'combined.log': [line('2026-10-14 18:00:00:0', 'not an error file')],
      'verify-run.log': [line('2026-10-14 18:00:00:0', 'not an error file')],
    });
    expect(errorLogFiles(dir).map(file => path.basename(file))).toEqual(['error.log']);
    expect(readRecentErrors({ dir }).entries).toHaveLength(1);
  });
});

describe('grouping', () => {
  test('a repeated error becomes one row with a real count and both times', () => {
    const dir = makeDir({
      'error1.log': [
        line('2026-10-14 17:55:00:0', 'Judge0 execution error: Request failed with status code 429'),
        line('2026-10-14 18:00:00:0', 'Judge0 execution error: Request failed with status code 429'),
        line('2026-10-14 18:19:23:1923', 'Judge0 execution error: Request failed with status code 429'),
        line('2026-10-14 18:19:23:1923', 'A different error'),
      ],
    });

    const entry = readRecentErrors({ dir }).entries.find(e => e.message.includes('429'));
    expect(entry.count).toBe(3);
    expect(entry.firstAt).toBe(new Date(2026, 9, 14, 17, 55, 0).toISOString());
    expect(entry.lastAt).toBe(new Date(2026, 9, 14, 18, 19, 23).toISOString());
    expect(readRecentErrors({ dir }).meta.distinct).toBe(2);
  });

  test('the same message at a different level is not merged', () => {
    const dir = makeDir({
      'error.log': [
        line('2026-10-14 18:00:00:0', 'same text'),
        JSON.stringify({ level: 'warn', message: 'same text', timestamp: '2026-10-14 18:01:00:0' }),
      ],
    });
    expect(readRecentErrors({ dir }).entries).toHaveLength(2);
  });

  test('a stack trace is carried through and truncated', () => {
    const dir = makeDir({
      'error.log': [line('2026-10-14 18:00:00:0', 'boom', { stack: 'E'.repeat(5000) })],
    });
    const entry = readRecentErrors({ dir }).entries[0];
    expect(entry.stack).not.toBeNull();
    expect(entry.stack.length).toBeLessThanOrEqual(401);
  });
});

describe('limits and malformed input', () => {
  test('the limit caps the returned groups but the meta still counts everything', () => {
    const lines = [];
    for (let i = 0; i < 12; i++) lines.push(line(`2026-10-14 18:${String(i).padStart(2, '0')}:00:0`, `error ${i}`));
    const dir = makeDir({ 'error.log': lines });

    const report = readRecentErrors({ dir, limit: 5 });
    expect(report.entries).toHaveLength(5);
    expect(report.entries[0].message).toBe('error 11');   // newest first
    expect(report.meta.distinct).toBe(12);
    expect(report.meta.scanned).toBe(12);
  });

  test('malformed lines are counted, skipped, and never crash the reader', () => {
    const dir = makeDir({
      'error.log': [
        line('2026-10-14 18:00:00:0', 'good error'),
        'this is not json',
        '{"level":"error","message":"no timestamp at all"}',
        '',
      ],
    });

    const report = readRecentErrors({ dir });
    expect(report.entries).toHaveLength(2);
    expect(report.meta.unreadable).toBe(1);
    expect(report.meta.hasUndatedEntries).toBe(true);
  });

  test('an undated error is reported as undated, not given an invented time', () => {
    const dir = makeDir({
      'error.log': [
        line('2026-10-14 18:00:00:0', 'dated one'),
        JSON.stringify({ level: 'error', message: 'undated one' }),
        line('2026-10-14 18:05:00:0', 'dated two'),
      ],
    });

    const report = readRecentErrors({ dir });
    // Dated entries are ordered by time; the undated one has no place on that
    // timeline, so it is listed last with null timestamps the UI can label.
    expect(report.entries.map(entry => entry.message)).toEqual(['dated two', 'dated one', 'undated one']);
    const undated = report.entries[report.entries.length - 1];
    expect(undated).toMatchObject({ firstAt: null, lastAt: null });
    expect(report.meta.hasUndatedEntries).toBe(true);
  });
});
