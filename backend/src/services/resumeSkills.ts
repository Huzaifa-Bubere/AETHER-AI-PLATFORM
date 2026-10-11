/**
 * AETHER — canonical resume skill normalization.
 *
 * The Python resume parser returns skills grouped as
 *   [{ category: 'programming', skills: ['Python', 'JAVA', ...] }, ...]
 * and a free-text skills section can leak a single joined string such as
 * "pythonjavajavascripttypescriptc++sqlhtmlcssreact". Rendered directly that
 * produced the malformed skill list the Resume Analyzer was showing.
 *
 * This module is the SINGLE place that turns any raw skill payload into a
 * stable, deduplicated, categorised shape:
 *   { slug: 'python', label: 'Python', category: 'Programming' }
 *
 * It is deliberately lossless about categories (they are preserved on each
 * entry, never mixed into the label) and backwards compatible: callers that
 * still expect a flat `string[]` use `skillLabels()`.
 */

export interface SkillEntry {
  slug: string;
  label: string;
  category: string;
}

interface Canonical {
  label: string;
  category: string;
}

export const SKILL_CATEGORIES = [
  'Programming',
  'Frontend',
  'Backend',
  'Databases',
  'Data & Analytics',
  'Cloud & DevOps',
  'Testing & Tools',
  'Soft Skills',
  'Other',
] as const;

/**
 * Canonical skill table. Keys are the normalized alias (lowercase, no spaces,
 * no separators except + and #) and map to the display label + category.
 */
const CANONICAL: Record<string, Canonical> = {
  // Programming
  python: { label: 'Python', category: 'Programming' },
  java: { label: 'Java', category: 'Programming' },
  javascript: { label: 'JavaScript', category: 'Programming' },
  js: { label: 'JavaScript', category: 'Programming' },
  typescript: { label: 'TypeScript', category: 'Programming' },
  ts: { label: 'TypeScript', category: 'Programming' },
  c: { label: 'C', category: 'Programming' },
  cpp: { label: 'C++', category: 'Programming' },
  'c++': { label: 'C++', category: 'Programming' },
  csharp: { label: 'C#', category: 'Programming' },
  'c#': { label: 'C#', category: 'Programming' },
  go: { label: 'Go', category: 'Programming' },
  golang: { label: 'Go', category: 'Programming' },
  rust: { label: 'Rust', category: 'Programming' },
  kotlin: { label: 'Kotlin', category: 'Programming' },
  swift: { label: 'Swift', category: 'Programming' },
  php: { label: 'PHP', category: 'Programming' },
  ruby: { label: 'Ruby', category: 'Programming' },
  scala: { label: 'Scala', category: 'Programming' },
  r: { label: 'R', category: 'Programming' },
  matlab: { label: 'MATLAB', category: 'Programming' },
  dart: { label: 'Dart', category: 'Programming' },

  // Frontend
  html: { label: 'HTML', category: 'Frontend' },
  html5: { label: 'HTML', category: 'Frontend' },
  css: { label: 'CSS', category: 'Frontend' },
  css3: { label: 'CSS', category: 'Frontend' },
  sass: { label: 'Sass', category: 'Frontend' },
  scss: { label: 'Sass', category: 'Frontend' },
  tailwind: { label: 'Tailwind CSS', category: 'Frontend' },
  tailwindcss: { label: 'Tailwind CSS', category: 'Frontend' },
  bootstrap: { label: 'Bootstrap', category: 'Frontend' },
  react: { label: 'React', category: 'Frontend' },
  reactjs: { label: 'React', category: 'Frontend' },
  reactnative: { label: 'React Native', category: 'Frontend' },
  nextjs: { label: 'Next.js', category: 'Frontend' },
  angular: { label: 'Angular', category: 'Frontend' },
  vue: { label: 'Vue.js', category: 'Frontend' },
  vuejs: { label: 'Vue.js', category: 'Frontend' },
  svelte: { label: 'Svelte', category: 'Frontend' },
  redux: { label: 'Redux', category: 'Frontend' },
  webpack: { label: 'Webpack', category: 'Frontend' },
  vite: { label: 'Vite', category: 'Frontend' },
  responsive: { label: 'Responsive Design', category: 'Frontend' },
  accessibility: { label: 'Web Accessibility', category: 'Frontend' },
  a11y: { label: 'Web Accessibility', category: 'Frontend' },

  // Backend
  node: { label: 'Node.js', category: 'Backend' },
  nodejs: { label: 'Node.js', category: 'Backend' },
  express: { label: 'Express.js', category: 'Backend' },
  expressjs: { label: 'Express.js', category: 'Backend' },
  nestjs: { label: 'NestJS', category: 'Backend' },
  django: { label: 'Django', category: 'Backend' },
  flask: { label: 'Flask', category: 'Backend' },
  fastapi: { label: 'FastAPI', category: 'Backend' },
  spring: { label: 'Spring', category: 'Backend' },
  springboot: { label: 'Spring Boot', category: 'Backend' },
  laravel: { label: 'Laravel', category: 'Backend' },
  rails: { label: 'Ruby on Rails', category: 'Backend' },
  dotnet: { label: '.NET', category: 'Backend' },
  rest: { label: 'REST APIs', category: 'Backend' },
  restapi: { label: 'REST APIs', category: 'Backend' },
  restapis: { label: 'REST APIs', category: 'Backend' },
  graphql: { label: 'GraphQL', category: 'Backend' },
  grpc: { label: 'gRPC', category: 'Backend' },
  websockets: { label: 'WebSockets', category: 'Backend' },
  microservices: { label: 'Microservices', category: 'Backend' },
  api: { label: 'API Development', category: 'Backend' },
  authentication: { label: 'Authentication', category: 'Backend' },
  jwt: { label: 'JWT', category: 'Backend' },
  socketio: { label: 'Socket.IO', category: 'Backend' },

  // Databases
  sql: { label: 'SQL', category: 'Databases' },
  mysql: { label: 'MySQL', category: 'Databases' },
  postgresql: { label: 'PostgreSQL', category: 'Databases' },
  postgres: { label: 'PostgreSQL', category: 'Databases' },
  mongodb: { label: 'MongoDB', category: 'Databases' },
  mongo: { label: 'MongoDB', category: 'Databases' },
  sqlite: { label: 'SQLite', category: 'Databases' },
  redis: { label: 'Redis', category: 'Databases' },
  oracle: { label: 'Oracle DB', category: 'Databases' },
  nosql: { label: 'NoSQL', category: 'Databases' },
  firebase: { label: 'Firebase', category: 'Databases' },
  supabase: { label: 'Supabase', category: 'Databases' },
  cassandra: { label: 'Cassandra', category: 'Databases' },
  dynamodb: { label: 'DynamoDB', category: 'Databases' },

  // Data & Analytics
  powerbi: { label: 'Power BI', category: 'Data & Analytics' },
  excel: { label: 'Advanced MS Excel', category: 'Data & Analytics' },
  ms: { label: 'Advanced MS Excel', category: 'Data & Analytics' },
  advancedmsexcel: { label: 'Advanced MS Excel', category: 'Data & Analytics' },
  tableau: { label: 'Tableau', category: 'Data & Analytics' },
  pandas: { label: 'Pandas', category: 'Data & Analytics' },
  numpy: { label: 'NumPy', category: 'Data & Analytics' },
  matplotlib: { label: 'Matplotlib', category: 'Data & Analytics' },
  seaborn: { label: 'Seaborn', category: 'Data & Analytics' },
  scikitlearn: { label: 'Scikit-learn', category: 'Data & Analytics' },
  sklearn: { label: 'Scikit-learn', category: 'Data & Analytics' },
  tensorflow: { label: 'TensorFlow', category: 'Data & Analytics' },
  pytorch: { label: 'PyTorch', category: 'Data & Analytics' },
  ml: { label: 'Machine Learning', category: 'Data & Analytics' },
  machinelearning: { label: 'Machine Learning', category: 'Data & Analytics' },
  deeplearning: { label: 'Deep Learning', category: 'Data & Analytics' },
  nlp: { label: 'NLP', category: 'Data & Analytics' },
  eda: { label: 'EDA', category: 'Data & Analytics' },
  datacleaning: { label: 'Data Cleaning', category: 'Data & Analytics' },
  dataanalysis: { label: 'Data Analysis', category: 'Data & Analytics' },
  datavisualization: { label: 'Data Visualization', category: 'Data & Analytics' },
  statistics: { label: 'Statistics', category: 'Data & Analytics' },
  spark: { label: 'Apache Spark', category: 'Data & Analytics' },
  hadoop: { label: 'Hadoop', category: 'Data & Analytics' },

  // Cloud & DevOps
  aws: { label: 'AWS', category: 'Cloud & DevOps' },
  azure: { label: 'Azure', category: 'Cloud & DevOps' },
  gcp: { label: 'Google Cloud', category: 'Cloud & DevOps' },
  googlecloud: { label: 'Google Cloud', category: 'Cloud & DevOps' },
  docker: { label: 'Docker', category: 'Cloud & DevOps' },
  kubernetes: { label: 'Kubernetes', category: 'Cloud & DevOps' },
  k8s: { label: 'Kubernetes', category: 'Cloud & DevOps' },
  terraform: { label: 'Terraform', category: 'Cloud & DevOps' },
  jenkins: { label: 'Jenkins', category: 'Cloud & DevOps' },
  cicd: { label: 'CI/CD', category: 'Cloud & DevOps' },
  linux: { label: 'Linux', category: 'Cloud & DevOps' },
  nginx: { label: 'Nginx', category: 'Cloud & DevOps' },
  cloudinary: { label: 'Cloudinary', category: 'Cloud & DevOps' },
  vercel: { label: 'Vercel', category: 'Cloud & DevOps' },
  netlify: { label: 'Netlify', category: 'Cloud & DevOps' },
  heroku: { label: 'Heroku', category: 'Cloud & DevOps' },

  // Testing & Tools
  git: { label: 'Git', category: 'Testing & Tools' },
  github: { label: 'GitHub', category: 'Testing & Tools' },
  gitlab: { label: 'GitLab', category: 'Testing & Tools' },
  bitbucket: { label: 'Bitbucket', category: 'Testing & Tools' },
  jest: { label: 'Jest', category: 'Testing & Tools' },
  pytest: { label: 'Pytest', category: 'Testing & Tools' },
  selenium: { label: 'Selenium', category: 'Testing & Tools' },
  cypress: { label: 'Cypress', category: 'Testing & Tools' },
  postman: { label: 'Postman', category: 'Testing & Tools' },
  jira: { label: 'Jira', category: 'Testing & Tools' },
  testing: { label: 'Testing', category: 'Testing & Tools' },
  unittesting: { label: 'Unit Testing', category: 'Testing & Tools' },
  debugging: { label: 'Debugging', category: 'Testing & Tools' },
  agile: { label: 'Agile', category: 'Testing & Tools' },
  scrum: { label: 'Scrum', category: 'Testing & Tools' },
  systemdesign: { label: 'System Design', category: 'Testing & Tools' },
  dsa: { label: 'Data Structures & Algorithms', category: 'Testing & Tools' },
  oop: { label: 'OOP', category: 'Testing & Tools' },
  datasstructures: { label: 'Data Structures', category: 'Testing & Tools' },
  algorithms: { label: 'Algorithms', category: 'Testing & Tools' },

  // Soft skills
  communication: { label: 'Communication', category: 'Soft Skills' },
  teamwork: { label: 'Teamwork', category: 'Soft Skills' },
  leadership: { label: 'Leadership', category: 'Soft Skills' },
  problemsolving: { label: 'Problem Solving', category: 'Soft Skills' },
  timemanagement: { label: 'Time Management', category: 'Soft Skills' },
  adaptability: { label: 'Adaptability', category: 'Soft Skills' },
  criticalthinking: { label: 'Critical Thinking', category: 'Soft Skills' },
  collaboration: { label: 'Collaboration', category: 'Soft Skills' },
};

/** Lowercase and drop separators so "Node.js" / "node js" / "NODEJS" collapse. */
export function normalizeSkillKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[._/\\|-]/g, '')
    .replace(/[^a-z0-9+#]/g, '');
}

/** Best-effort human label for a skill we don't have in the canonical table. */
function titleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b[a-z]/g, c => c.toUpperCase());
}

/**
 * The slug is derived from the canonical LABEL, not the matched alias, so two
 * aliases of the same skill ("cpp" and "c++") collapse to one entry.
 */
function canonicalSlug(label: string): string {
  return normalizeSkillKey(label);
}

function entryFor(raw: string, category?: string): SkillEntry | null {
  const label = raw.trim();
  if (!label || label.length > 60) return null;
  const key = normalizeSkillKey(label);
  if (!key) return null;
  const canonical = CANONICAL[key];
  if (canonical) return { slug: canonicalSlug(canonical.label), label: canonical.label, category: category || canonical.category };
  // Unknown skill: keep it, but never as a category heading.
  return { slug: key, label: titleCase(label.replace(/[;:]+$/, '')), category: category || 'Other' };
}

/**
 * Extract every known canonical skill contained in a run-together string.
 * Handles "pythonjavajavascripttypescriptc++sqlhtmlcssreact" and normal spacing.
 */
function extractEmbedded(text: string): SkillEntry[] {
  const haystack = text.toLowerCase();
  const keys = Object.keys(CANONICAL).sort((a, b) => b.length - a.length);
  const found: SkillEntry[] = [];
  let cursor = 0;
  while (cursor < haystack.length) {
    let matched: string | null = null;
    for (const key of keys) {
      if (key.length < 2) continue; // avoid matching "c"/"r" mid-word
      if (haystack.startsWith(key, cursor)) { matched = key; break; }
    }
    if (matched) {
      const canonical = CANONICAL[matched];
      found.push({ slug: canonicalSlug(canonical.label), label: canonical.label, category: canonical.category });
      cursor += matched.length;
    } else {
      cursor += 1;
    }
  }
  return found;
}

/** True when a raw string is one joined blob with no separators. */
function looksJoined(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 8) return false;
  if (/[,;|/•·\n]/.test(trimmed)) return false;
  if (/\s{2,}/.test(trimmed)) return true;
  return !/\s/.test(trimmed) && extractEmbedded(trimmed).length >= 2;
}

function splitRaw(value: string): string[] {
  if (looksJoined(value)) {
    const embedded = extractEmbedded(value);
    if (embedded.length >= 2) return embedded.map(e => e.label);
  }
  return value
    .split(/[,;|•·\n\t]+|\s{2,}/)
    .map(part => part.trim())
    .filter(Boolean);
}

type RawGroup = string | { category?: unknown; skills?: unknown; name?: unknown } | null | undefined;

/**
 * Normalize any raw `skills` payload into deduplicated, categorised entries.
 * Accepts: string[], { category, skills[] }[], { name }[], or joined strings.
 */
export function normalizeSkillEntries(raw: unknown): SkillEntry[] {
  const groups: RawGroup[] = Array.isArray(raw) ? raw : [];
  const out: SkillEntry[] = [];
  const seen = new Set<string>();

  const push = (entry: SkillEntry | null) => {
    if (!entry || seen.has(entry.slug)) return;
    seen.add(entry.slug);
    out.push(entry);
  };

  for (const group of groups) {
    if (typeof group === 'string') {
      for (const part of splitRaw(group)) push(entryFor(part));
      continue;
    }
    if (!group || typeof group !== 'object') continue;
    const groupCategory = typeof group.category === 'string' ? titleCase(group.category) : undefined;
    if (Array.isArray(group.skills)) {
      for (const item of group.skills) {
        if (typeof item !== 'string') continue;
        for (const part of splitRaw(item)) push(entryFor(part, groupCategory));
      }
    } else if (typeof group.name === 'string') {
      for (const part of splitRaw(group.name)) push(entryFor(part, groupCategory));
    } else if (typeof group.category === 'string') {
      // A category heading with no skills is NOT a skill — skip it.
      continue;
    }
  }

  return out;
}

/** Flat, canonical display labels — backwards compatible with the old string[]. */
export function skillLabels(entries: SkillEntry[]): string[] {
  return entries.map(e => e.label);
}

/** Group entries by category in the canonical category order. */
export function groupSkills(entries: SkillEntry[]): Array<{ category: string; skills: SkillEntry[] }> {
  const byCategory = new Map<string, SkillEntry[]>();
  for (const entry of entries) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }
  const order = new Map<string, number>((SKILL_CATEGORIES as readonly string[]).map((c, i) => [c, i]));
  return [...byCategory.entries()]
    .sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99))
    .map(([category, skills]) => ({ category, skills }));
}

/** Convenience: raw payload → flat canonical labels. */
export function normalizeSkillLabels(raw: unknown): string[] {
  return skillLabels(normalizeSkillEntries(raw));
}
