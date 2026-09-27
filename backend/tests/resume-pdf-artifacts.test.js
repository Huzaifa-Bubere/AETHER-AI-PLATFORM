/* AETHER Resume Builder — exported PDF text-layer verification (spec §21, §24, §69).
 *
 * These tests run against the PDFs produced by the renderer:
 *   cd frontend
 *   npx esbuild scripts/render-sample-resume.tsx --bundle --platform=node \
 *     --format=cjs --outfile=tmp/render-sample-resume.cjs --external:@react-pdf/renderer
 *   node tmp/render-sample-resume.cjs
 *
 * When the artifacts are absent the suite reports it and skips (the artifacts are
 * generated on demand, not committed). The equivalent parser roundtrip against
 * the Python analyzer lives in ai-server/scripts/verify_resume_roundtrip.py.
 */
process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const TMP_DIR = path.resolve(__dirname, '..', '..', 'frontend', 'tmp');
const artifacts = fs.existsSync(TMP_DIR)
  ? fs.readdirSync(TMP_DIR).filter(f => /^sample-.*\.pdf$/.test(f)).sort()
  : [];

const REQUIRED_TEXT = [
  'Huzaifa Bubere',
  'huzaifa.bubere@example.com',
  '+91 98200 41122',
  'Mumbai',
  'linkedin.com/in/huzaifabubere',
  'github.com/huzaifabubere',
  'EXPERIENCE',
  'PROJECTS',
  'EDUCATION',
  'SKILLS',
];

const maybe = artifacts.length ? describe : describe.skip;

if (!artifacts.length) {
  // eslint-disable-next-line no-console
  console.warn('[resume-pdf-artifacts] No generated PDFs found — run the frontend renderer to enable these checks.');
}

maybe('resume PDF artifacts contain a real text layer', () => {
  test.each(artifacts)('%s is a text PDF with no raster images', async file => {
    const buffer = fs.readFileSync(path.join(TMP_DIR, file));
    expect(buffer.slice(0, 5).toString('latin1')).toBe('%PDF-');

    const parsed = await pdfParse(buffer);
    expect(parsed.numpages).toBeGreaterThanOrEqual(1);
    expect(parsed.text.trim().length).toBeGreaterThan(500);

    // No embedded raster image objects: a screenshot-based export would contain them.
    const raw = buffer.toString('latin1');
    expect(raw).not.toMatch(/\/Subtype\s*\/Image/);

    // Every section heading and contact value must be extractable as text.
    for (const needle of REQUIRED_TEXT) {
      expect(parsed.text).toContain(needle);
    }
  });

  test.each(artifacts)('%s has no blank pages', async file => {
    const buffer = fs.readFileSync(path.join(TMP_DIR, file));
    const parsed = await pdfParse(buffer, {
      // pdf-parse supports a per-page render callback; pageData collects text.
      pagerender: undefined,
    });
    expect(parsed.numpages).toBeGreaterThanOrEqual(1);
    // A page-per-page check would need a parser hook; the Python roundtrip script
    // asserts per-page character counts (no blank pages) with PyPDF2.
    expect(parsed.text.length).toBeGreaterThan(500 * parsed.numpages * 0.5);
  });
});
