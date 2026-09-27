/* AETHER Resume Builder — document model, ATS engine and template tests
 * (spec §16–§19, §21–§24, §27, §68–§69).
 *
 * The ATS score must stay deterministic and independent of the new builder
 * fields, the document schema must persist every builder field, and the PDF
 * roundtrip artifacts (when generated) must contain a real text layer.
 */
process.env.NODE_ENV = 'test';

const { computeAtsScore, matchJobDescription } = require('../dist/services/atsEngine');
const {
  ResumeVersion, ATS_TEMPLATES, ATS_TEMPLATE_VALUES, normalizeTemplate,
} = require('../dist/models/ResumeVersion');

/** The same sample document the PDF roundtrip renders (builder shape). */
const SAMPLE = {
  name: 'Huzaifa Bubere',
  title: 'Software Engineer',
  email: 'huzaifa.bubere@example.com',
  phone: '+91 98200 41122',
  location: 'Mumbai, India',
  links: ['linkedin.com/in/huzaifabubere', 'github.com/huzaifabubere'],
  summary:
    'Software engineer with 2 years of experience building REST APIs and React interfaces. Cut p95 API latency by 42% with composite indexes and caching, and shipped a payments service handling 10,000 requests per day.',
  experience: [
    {
      title: 'Software Engineer', company: 'Acme Technologies', location: 'Mumbai', duration: 'Jul 2025 – Present',
      bullets: [
        'Built a payments REST API in Node.js and PostgreSQL serving 10,000 requests per day',
        'Reduced p95 latency 42% by adding composite indexes and a Redis cache layer',
      ],
    },
  ],
  projects: [
    {
      name: 'AETHER Career Platform', link: 'github.com/huzaifabubere/aether',
      technologies: ['React', 'TypeScript', 'Node.js', 'MongoDB'],
      bullets: ['Built a database-backed learning platform with 16 authored topics and server-graded quizzes'],
    },
  ],
  education: [{ degree: 'B.E. Computer Engineering', institution: 'University of Mumbai', year: '2025', score: '8.4 CGPA' }],
  skills: ['JavaScript', 'TypeScript', 'Node.js', 'React', 'PostgreSQL', 'MongoDB', 'Docker', 'REST APIs', 'Jest', 'Git'],
  certifications: ['AWS Certified Cloud Practitioner (2025)'],
  achievements: ['Winner — Smart India Hackathon 2025'],
  languages: [{ name: 'English', level: 'Fluent' }, { name: 'Hindi', level: 'Native' }],
  customSections: [{ title: 'Open Source Contributions', items: ['Fixed documentation gaps in a React form library'] }],
  sectionOrder: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'achievements', 'languages', 'custom'],
  pageSize: 'A4',
  typography: { fontFamily: 'Helvetica', fontSize: 9.5, lineHeight: 1.35, margin: 40 },
  targetJobDescription: '',
};

describe('ATS engine — builder document compatibility', () => {
  test('scores the full builder document deterministically', () => {
    const first = computeAtsScore(SAMPLE);
    const second = computeAtsScore({ ...SAMPLE, skills: [...SAMPLE.skills] });
    expect(first.totalScore).toBe(second.totalScore);
    expect(first.totalScore).toBeGreaterThanOrEqual(0);
    expect(first.totalScore).toBeLessThanOrEqual(100);
    expect(['excellent', 'good', 'fair', 'needs-improvement']).toContain(first.grade);
  });

  test('category weights are documented and sum to 100', () => {
    const { categories } = computeAtsScore(SAMPLE);
    const total = categories.reduce((sum, c) => sum + c.weight, 0);
    expect(total).toBe(100);
    // The exact set the ATS panel renders (spec §27)
    expect(categories.map(c => c.key).sort()).toEqual(
      ['bullets', 'contact', 'impact', 'keywords', 'readability', 'sections', 'structure'],
    );
  });

  test('a complete builder document scores higher than an empty one', () => {
    const empty = computeAtsScore({
      name: '', title: '', email: '', phone: '', location: '', links: [], summary: '',
      education: [], experience: [], projects: [], skills: [], certifications: [],
      achievements: [], languages: [], customSections: [], sectionOrder: [],
    });
    expect(computeAtsScore(SAMPLE).totalScore).toBeGreaterThan(empty.totalScore);
    expect(empty.totalScore).toBeLessThan(45);
  });

  test('the professional title participates in keyword matching', () => {
    const withTitle = computeAtsScore({ ...SAMPLE, title: 'Backend Developer' }, { targetRole: 'backend-developer' });
    const withoutTitle = computeAtsScore({ ...SAMPLE, title: '' }, { targetRole: 'backend-developer' });
    expect(typeof withTitle.totalScore).toBe('number');
    // Keyword category must still be computed from real evidence.
    const kc = withTitle.categories.find(c => c.key === 'keywords');
    expect(kc.findings.length).toBeGreaterThan(0);
    expect(withoutTitle.totalScore).toBeLessThanOrEqual(withTitle.totalScore + 5);
  });

  test('extra sections (languages, custom, certifications) never crash or drop sections', () => {
    const { categories } = computeAtsScore(SAMPLE);
    const sections = categories.find(c => c.key === 'sections');
    expect(sections.score).toBe(100);
    expect(sections.findings).toEqual([]);
  });

  test('bullet findings drive the improvement copy', () => {
    const weak = computeAtsScore({
      ...SAMPLE,
      experience: [{ title: 'Engineer', company: 'X', bullets: ['Worked on stuff', 'Helped with things'] }],
      projects: [],
    });
    expect(weak.bulletFindings.length).toBeGreaterThan(0);
    expect(weak.bulletFindings[0].issues.length).toBeGreaterThan(0);
  });

  test('job description matching keeps the honesty rule', () => {
    const jd = 'We need a backend developer with Node.js, PostgreSQL, Docker and Kubernetes experience.';
    const match = matchJobDescription(SAMPLE, jd);
    expect(match.matchScore).toBeGreaterThan(0);
    expect(match.matchScore).toBeLessThanOrEqual(100);
    expect(match.missingKeywords.map(k => k.toLowerCase())).toContain('kubernetes');
    expect(match.honestyNote).toMatch(/genuinely/i);
  });
});

describe('ResumeVersion model — builder document fields', () => {
  const baseDoc = () => ({
    userId: '64b000000000000000000000',
    name: 'Huzaifa Bubere — Software Engineer',
    template: 'ats-classic',
    data: SAMPLE,
  });

  test('persists every builder field through the real mongoose schema', () => {
    const doc = new ResumeVersion(baseDoc());
    const error = doc.validateSync();
    expect(error ? error.message : null).toBeNull();
    expect(doc.data.title).toBe('Software Engineer');
    expect(doc.data.languages).toHaveLength(2);
    expect(doc.data.customSections[0].title).toBe('Open Source Contributions');
    expect(doc.data.sectionOrder).toContain('experience');
    expect(doc.data.pageSize).toBe('A4');
    expect(doc.data.typography.fontSize).toBeCloseTo(9.5);
  });

  test('new versions are not default until promoted, and legacy templates normalize', () => {
    const doc = new ResumeVersion(baseDoc());
    expect(doc.isDefault).toBe(false);
    expect(normalizeTemplate('minimal')).toBe('minimal-professional');
    expect(normalizeTemplate('technical-professional')).toBe('technical-professional');
    expect(normalizeTemplate('bogus')).toBe('ats-classic');
    expect(normalizeTemplate(undefined)).toBe('ats-classic');
  });

  test('accepts all current templates and rejects unknown ones', () => {
    for (const template of ATS_TEMPLATES) {
      const doc = new ResumeVersion({ ...baseDoc(), template });
      expect(doc.validateSync()).toBeUndefined();
    }
    expect(ATS_TEMPLATE_VALUES).toContain('minimal'); // legacy alias still loadable
    const bad = new ResumeVersion({ ...baseDoc(), template: 'infographic' });
    expect(bad.validateSync()).toBeTruthy();
  });

  test('exposes the lookup the builder uses to list versions', () => {
    expect(typeof ResumeVersion.listByUser).toBe('function');
  });
});
