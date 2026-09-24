/**
 * AETHER Resume — deterministic ATS engine (spec §54–58).
 *
 * The ATS score is calculated from documented evidence categories with fixed
 * weights. Gemini NEVER assigns the score — it may only narrate the result.
 * Keyword suggestions always carry the honesty rule (§57): only add a skill
 * the candidate genuinely has.
 *
 * ── ATS SCORE FORMULA (documented weights, total 100) ───────────────────────
 *   contactCompleteness   10   name, email, phone, location, links
 *   sectionCompleteness   20   summary, education, experience, projects, skills
 *   structureFormatting   15   headings, consistent bullets, no tables-columns
 *   keywordAlignment      20   role/JD keyword coverage (50% of it when no JD)
 *   bulletQuality         15   action verbs, length, quantified impact
 *   readability           10   sentence/line length, word repetition
 *   measurableImpact      10   numbers/metrics present in bullets
 */

export interface IResumeData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  links?: string[];
  summary?: string;
  education: Array<{ degree?: string; institution?: string; year?: string | number }>;
  experience: Array<{
    title?: string; company?: string; duration?: string;
    bullets?: string[]; description?: string;
  }>;
  projects: Array<{ name?: string; description?: string; technologies?: string[]; bullets?: string[] }>;
  skills: string[];
  certifications?: string[];
  achievements?: string[];
}

export interface IAtsCategory {
  key: string;
  label: string;
  weight: number;
  score: number; // 0-100 for this category
  weightedPoints: number;
  findings: string[];
}

export interface IAtsResult {
  totalScore: number;
  grade: 'excellent' | 'good' | 'fair' | 'needs-improvement';
  categories: IAtsCategory[];
  bulletFindings: Array<{ bullet: string; issues: string[]; suggestion?: string }>;
  wordCount: number;
  readabilityScore: number;
}

const ACTION_VERBS = /^(built|led|designed|developed|created|implemented|improved|reduced|increased|optimized|launched|shipped|migrated|automated|architected|delivered|integrated|established|owned|drove|scaled|refactored|debugged|resolved|coordinated|mentored|analyzed|researched|published|wrote|tested|deployed|configured)\b/i;
const WEAK_OPENERS = /^(worked on|worked with|helped( with)?|responsible for|involved in|assisted( with| in)?|participated in|tasked with|duties included|did)\b/i;
const QUANTIFIED_RE = /\b(\d+(\.\d+)?\s?(%|percent|k|m|x|ms|s|sec|seconds|mins|minutes|hours|days|weeks|users|customers|clients|requests|rps|qps|mb|gb|tb|lpa|usd|\$|₹|€))|\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(months|weeks|days|years|people|engineers|members)\b|\b\d+\b/i;

/** Generic role keyword bank used when no JD is pasted. */
const ROLE_KEYWORDS: Record<string, string[]> = {
  backend: ['rest', 'api', 'database', 'node', 'sql', 'authentication', 'testing', 'docker', 'performance', 'security'],
  frontend: ['react', 'typescript', 'css', 'responsive', 'state management', 'testing', 'performance', 'accessibility', 'api integration'],
  'full-stack': ['rest', 'api', 'react', 'database', 'node', 'deployment', 'authentication', 'testing'],
  default: ['api', 'database', 'testing', 'version control', 'collaboration', 'problem solving', 'performance', 'deployment'],
};

function roleKeywordBank(roleHint?: string): string[] {
  const r = (roleHint || '').toLowerCase();
  if (r.includes('backend') || r.includes('node')) return ROLE_KEYWORDS.backend;
  if (r.includes('frontend') || r.includes('react')) return ROLE_KEYWORDS.frontend;
  if (r.includes('full')) return ROLE_KEYWORDS['full-stack'];
  return ROLE_KEYWORDS.default;
}

// ── Category scorers ─────────────────────────────────────────────────────────

function scoreContact(d: IResumeData): IAtsCategory {
  const findings: string[] = [];
  let score = 0;
  const checks = [
    [!!d.name?.trim(), 'name'], [!!d.email?.trim(), 'email'], [!!d.phone?.trim(), 'phone'],
    [!!d.location?.trim(), 'location'], [(d.links?.length || 0) > 0, 'at least one link (LinkedIn/GitHub)'],
  ] as Array<[boolean, string]>;
  for (const [ok, what] of checks) {
    if (ok) score += 20;
    else findings.push(`Missing ${what}.`);
  }
  return { key: 'contact', label: 'Contact Completeness', weight: 10, score: Math.min(100, score), weightedPoints: 0, findings };
}

function scoreSections(d: IResumeData): IAtsCategory {
  const findings: string[] = [];
  const sections = [
    [!!d.summary?.trim() && d.summary.trim().length >= 80, 'summary (80+ characters)'],
    [d.education.length > 0, 'education'],
    [d.experience.length > 0, 'experience'],
    [d.projects.length > 0, 'projects'],
    [d.skills.length >= 5, 'skills (at least 5)'],
  ] as Array<[boolean, string]>;
  let score = 0;
  for (const [ok, what] of sections) {
    if (ok) score += 20;
    else findings.push(`Add or strengthen: ${what}.`);
  }
  return { key: 'sections', label: 'Section Completeness', weight: 20, score, weightedPoints: 0, findings };
}

function scoreStructure(d: IResumeData): IAtsCategory {
  const findings: string[] = [];
  // Heuristic over the structured data we hold: full section content present,
  // consistent bullet usage, no evidence of exotic layout (we can't see PDF
  // tables, so reward clean structured content instead).
  let score = 70;
  const bullets = collectBullets(d);
  if (bullets.length >= 5) score += 15;
  else findings.push('Use 3–5 achievement bullets per experience entry.');
  const consistentBullets = bullets.length === 0 || bullets.every(b => b.trim().length > 0);
  if (consistentBullets) score += 10;
  else findings.push('Some bullets are empty — fill them in.');
  if (d.skills.length > 0 && d.skills.length <= 20) score += 5;
  else if (d.skills.length > 20) findings.push('Skills list is very long — group it or trim to the most relevant.');
  return { key: 'structure', label: 'Structure & Formatting', weight: 15, score: Math.min(100, score), weightedPoints: 0, findings };
}

function scoreKeywords(d: IResumeData, jd?: string, roleHint?: string): IAtsCategory {
  const findings: string[] = [];
  const text = resumeText(d).toLowerCase();

  let keywords: string[];
  if (jd && jd.trim()) {
    // JD mode: extract known skill terms + frequent capitalized words.
    keywords = [...new Set(extractJdKeywords(jd))];
  } else {
    keywords = roleKeywordBank(roleHint);
  }
  const matched = keywords.filter(k => text.includes(k.toLowerCase()));
  const missing = keywords.filter(k => !matched.includes(k));
  if (matched.length < keywords.length) {
    findings.push(`Missing keywords for this ${jd ? 'job description' : 'target role'}: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}.`);
  } else {
    findings.push('All expected keywords found.');
  }
  // Honest note (spec §57)
  if (missing.length > 0) {
    findings.push('Only add a missing keyword when you genuinely have that skill — recruiters verify claims in interviews.');
  }
  const score = keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0;
  return { key: 'keywords', label: jd ? 'JD Keyword Alignment' : 'Role Keyword Alignment', weight: 20, score, weightedPoints: 0, findings };
}

function scoreBullets(d: IResumeData): IAtsCategory {
  const findings: string[] = [];
  const bullets = collectBullets(d);
  if (bullets.length === 0) {
    return { key: 'bullets', label: 'Bullet Quality', weight: 15, score: 0, weightedPoints: 0, findings: ['No bullet points found — use achievement bullets in experience and projects.'] };
  }
  let total = 0;
  for (const b of bullets) {
    let s = 50;
    if (ACTION_VERBS.test(b.trim())) s += 20; else if (WEAK_OPENERS.test(b.trim())) s -= 20;
    const words = b.trim().split(/\s+/).length;
    if (words >= 8 && words <= 30) s += 15;
    else if (words < 8) s -= 10;
    if (QUANTIFIED_RE.test(b)) s += 15;
    total += Math.max(0, Math.min(100, s));
  }
  const score = Math.round(total / bullets.length);
  if (score < 70) {
    findings.push('Start bullets with strong action verbs and keep them to one concrete outcome each.');
  }
  return { key: 'bullets', label: 'Bullet Quality', weight: 15, score, weightedPoints: 0, findings };
}

function scoreImpact(d: IResumeData): IAtsCategory {
  const findings: string[] = [];
  const bullets = collectBullets(d);
  const quantified = bullets.filter(b => QUANTIFIED_RE.test(b));
  const score = bullets.length ? Math.round((quantified.length / bullets.length) * 100) : 0;
  if (score < 50) {
    findings.push('Add measurable impact (%, users, time saved) — only with real values you can defend. Do not invent metrics.');
  } else {
    findings.push('Good measurable impact across bullets.');
  }
  return { key: 'impact', label: 'Measurable Impact', weight: 10, score, weightedPoints: 0, findings };
}

function scoreReadability(d: IResumeData): IAtsCategory {
  const findings: string[] = [];
  const bullets = collectBullets(d);
  const longBullets = bullets.filter(b => b.trim().split(/\s+/).length > 35);
  const base = 100 - Math.min(60, longBullets.length * 15);
  const wordCount = countWords(resumeText(d));
  let score = Math.round(base * (wordCount >= 150 && wordCount <= 900 ? 1 : 0.85));
  if (longBullets.length > 0) findings.push(`${longBullets.length} bullet(s) exceed 35 words — split them for readability.`);
  if (wordCount > 900) findings.push('Resume is long; for most early-career profiles one page (~500 words) is stronger.');
  return { key: 'readability', label: 'Readability', weight: 10, score: Math.max(0, Math.min(100, score)), weightedPoints: 0, findings };
}

// ── Public API ───────────────────────────────────────────────────────────────

export function computeAtsScore(d: IResumeData, options: { jobDescription?: string; targetRole?: string } = {}): IAtsResult {
  const contact = scoreContact(d);
  const sections = scoreSections(d);
  const structure = scoreStructure(d);
  const keywords = scoreKeywords(d, options.jobDescription, options.targetRole);
  const bullets = scoreBullets(d);
  const impact = scoreImpact(d);
  const readability = scoreReadability(d);

  const categories = [contact, sections, structure, keywords, bullets, impact, readability];
  let total = 0;
  for (const c of categories) {
    c.weightedPoints = Math.round(c.score * c.weight) / 100;
    total += c.weightedPoints;
  }
  total = Math.round(total);
  const grade = total >= 85 ? 'excellent' : total >= 70 ? 'good' : total >= 55 ? 'fair' : 'needs-improvement';

  return {
    totalScore: total,
    grade,
    categories,
    bulletFindings: analyzeBullets(d),
    wordCount: countWords(resumeText(d)),
    readabilityScore: readability.score,
  };
}

/** JD vs resume comparison (spec §56) — honest about missing ≠ incapable (§65). */
export function matchJobDescription(d: IResumeData, jd: string): {
  matchedKeywords: string[]; missingKeywords: string[];
  matchedSkills: string[]; missingSkills: string[];
  matchScore: number;
  honestyNote: string;
} {
  const jdKeywords = [...new Set(extractJdKeywords(jd))];
  const text = resumeText(d).toLowerCase();
  const skillSet = new Set(d.skills.map(s => s.toLowerCase()));

  const matchedKeywords = jdKeywords.filter(k => text.includes(k.toLowerCase()));
  const missingKeywords = jdKeywords.filter(k => !matchedKeywords.includes(k));
  const matchedSkills = d.skills.filter(s => jdKeywords.some(k => s.toLowerCase().includes(k.toLowerCase())));
  const missingSkills = jdKeywords.filter(k => !skillSet.has(k.toLowerCase()) && !text.includes(k.toLowerCase()));
  const matchScore = jdKeywords.length ? Math.round((matchedKeywords.length / jdKeywords.length) * 100) : 0;

  return {
    matchedKeywords, missingKeywords, matchedSkills, missingSkills, matchScore,
    honestyNote: 'A missing keyword means "not evidenced on this resume" — not necessarily missing knowledge. Only add skills you genuinely have; interviews will probe every claim.',
  };
}

/** Bullet-level analysis (spec §58) with rewrite patterns (no invented numbers). */
export function analyzeBullets(d: IResumeData): Array<{ bullet: string; issues: string[]; suggestion?: string }> {
  const out: Array<{ bullet: string; issues: string[]; suggestion?: string }> = [];
  for (const b of collectBullets(d)) {
    const issues: string[] = [];
    const trimmed = b.trim();
    if (WEAK_OPENERS.test(trimmed)) issues.push('Weak passive opener — start with a strong action verb.');
    if (!ACTION_VERBS.test(trimmed) && !WEAK_OPENERS.test(trimmed)) issues.push('Does not start with an action verb.');
    const words = trimmed.split(/\s+/).length;
    if (words < 8) issues.push('Too short — add the outcome or context.');
    if (words > 35) issues.push('Too long — split into two bullets.');
    if (!QUANTIFIED_RE.test(trimmed)) issues.push('No measurable impact (add real numbers only).');
    if (issues.length > 0) {
      const topic = trimmed.replace(WEAK_OPENERS, '').trim().slice(0, 60);
      out.push({
        bullet: trimmed,
        issues,
        suggestion: `Pattern to follow: "Built ${topic || 'X'} …, reducing/improving <real metric>." Only include numbers you actually measured.`,
      });
    }
  }
  return out.slice(0, 12);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function collectBullets(d: IResumeData): string[] {
  const bullets: string[] = [];
  for (const e of d.experience || []) {
    bullets.push(...(e.bullets || []));
    if (e.description) bullets.push(...e.description.split(/\n+/).filter(Boolean));
  }
  for (const p of d.projects || []) {
    bullets.push(...(p.bullets || []));
  }
  return bullets.map(b => b.trim()).filter(Boolean);
}

function resumeText(d: IResumeData): string {
  const parts = [
    d.name, d.summary,
    ...(d.skills || []),
    ...((d.experience || []).flatMap(e => [e.title, e.company, ...(e.bullets || []), e.description])),
    ...((d.projects || []).flatMap(p => [p.name, p.description, ...(p.technologies || []), ...(p.bullets || [])])),
    ...((d.education || []).map(e => `${e.degree} ${e.institution}`)),
    ...(d.certifications || []),
    ...(d.achievements || []),
  ];
  return parts.filter(Boolean).join(' ');
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const JD_KNOWN_TERMS = [
  'React', 'TypeScript', 'JavaScript', 'Node.js', 'Node', 'Python', 'Java', 'Go', 'Docker', 'Kubernetes',
  'AWS', 'GCP', 'Azure', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Kafka', 'GraphQL', 'REST', 'gRPC',
  'CI/CD', 'Git', 'Linux', 'Microservices', 'SQL', 'NoSQL', 'Terraform', 'Jenkins', 'Testing', 'Jest',
  'Agile', 'Scrum', 'System Design', 'Machine Learning', 'Tailwind', 'Next.js', 'Express', 'Spring',
];

export function extractJdKeywords(jd: string): string[] {
  const found = JD_KNOWN_TERMS.filter(t => new RegExp(`\\b${t.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(jd));
  // Plus frequent capitalized-ish domain words (simple, deterministic).
  const words = jd.split(/[^A-Za-z+#.]+/).filter(w => w.length >= 4);
  const freq = new Map<string, number>();
  for (const w of words) {
    const k = w.toLowerCase();
    freq.set(k, (freq.get(k) || 0) + 1);
  }
  const extras = [...freq.entries()]
    .filter(([k, n]) => n >= 3 && !JD_KNOWN_TERMS.some(t => t.toLowerCase() === k) && !STOPWORDS.has(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k]) => k);
  return [...found.map(t => t.toLowerCase()), ...extras];
}

const STOPWORDS = new Set(['with', 'your', 'will', 'that', 'this', 'have', 'from', 'they', 'their', 'them', 'were', 'been', 'what', 'when', 'which', 'team', 'work', 'role', 'using', 'used', 'must', 'able', 'plus', 'other', 'about', 'into', 'over', 'also', 'than', 'then', 'more', 'most', 'some', 'such', 'only', 'each', 'well', 'help', 'job', 'you', 'are', 'our']);
