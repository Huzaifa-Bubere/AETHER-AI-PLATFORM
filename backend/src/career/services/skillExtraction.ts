/**
 * Deterministic skill extraction + normalization.
 *
 * Job description text → canonical skill slugs. NO AI involved: extraction must be
 * reproducible and auditable. Gemini is never used to decide what a posting mentions.
 *
 * Design:
 *  - canonical dictionary with aliases (Node/NodeJS/Node.js → node.js)
 *  - longest-alias-first matching with word boundaries (no naive substring:
 *    "go" must not match inside "google", "R" must not match every word)
 *  - context guards for notoriously ambiguous aliases (go, r, scala, react-native…)
 */

export interface DictionaryEntry {
  canonical: string; // canonical slug, e.g. 'node.js'
  name: string;      // display name, e.g. 'Node.js'
  skillType: string;
  aliases: string[];
  /** Optional regex-source constraints; all must match somewhere in the context window. */
  contextHints?: string[];
}

export const SKILL_DICTIONARY: DictionaryEntry[] = [
  // ── Languages ──
  { canonical: 'javascript', name: 'JavaScript', skillType: 'LANGUAGE', aliases: ['js', 'javascript', 'java script', 'ecmascript', 'es6'] },
  { canonical: 'typescript', name: 'TypeScript', skillType: 'LANGUAGE', aliases: ['typescript', 'ts'] },
  { canonical: 'python', name: 'Python', skillType: 'LANGUAGE', aliases: ['python', 'python3'] },
  { canonical: 'java', name: 'Java', skillType: 'LANGUAGE', aliases: ['java', 'core java'], contextHints: ['\\bjava\\b'] },
  { canonical: 'go', name: 'Go', skillType: 'LANGUAGE', aliases: ['golang', 'go lang'], contextHints: ['\\bgolang\\b|\\bgo\\b(?=\\s*(lang|programming|developer|engineer))'] },
  { canonical: 'rust', name: 'Rust', skillType: 'LANGUAGE', aliases: ['rust', 'rustlang'] },
  { canonical: 'c++', name: 'C++', skillType: 'LANGUAGE', aliases: ['c++', 'cpp'] },
  { canonical: 'c#', name: 'C#', skillType: 'LANGUAGE', aliases: ['c#', 'csharp', 'c sharp'] },
  { canonical: 'php', name: 'PHP', skillType: 'LANGUAGE', aliases: ['php'] },
  { canonical: 'ruby', name: 'Ruby', skillType: 'LANGUAGE', aliases: ['ruby', 'ruby on rails', 'rails'] },
  { canonical: 'kotlin', name: 'Kotlin', skillType: 'LANGUAGE', aliases: ['kotlin'] },
  { canonical: 'swift', name: 'Swift', skillType: 'LANGUAGE', aliases: ['swift', 'swiftui'] },
  { canonical: 'sql', name: 'SQL', skillType: 'LANGUAGE', aliases: ['sql'], contextHints: ['\\bsql\\b'] },
  { canonical: 'bash', name: 'Bash/Shell', skillType: 'LANGUAGE', aliases: ['bash', 'shell scripting', 'shell', 'zsh'] },
  { canonical: 'r', name: 'R', skillType: 'LANGUAGE', aliases: ['r language', 'r programming'], contextHints: ['\\br\\b(?=\\s*(language|programming|statistical))|\\br\\s+programming\\b'] },
  { canonical: 'scala', name: 'Scala', skillType: 'LANGUAGE', aliases: ['scala'] },
  { canonical: 'dart', name: 'Dart', skillType: 'LANGUAGE', aliases: ['dart'] },

  // ── Frameworks ──
  { canonical: 'react', name: 'React', skillType: 'FRAMEWORK', aliases: ['react', 'react.js', 'reactjs'] },
  { canonical: 'next.js', name: 'Next.js', skillType: 'FRAMEWORK', aliases: ['next.js', 'nextjs', 'next js'] },
  { canonical: 'vue', name: 'Vue.js', skillType: 'FRAMEWORK', aliases: ['vue', 'vue.js', 'vuejs'] },
  { canonical: 'angular', name: 'Angular', skillType: 'FRAMEWORK', aliases: ['angular', 'angularjs'] },
  { canonical: 'node.js', name: 'Node.js', skillType: 'FRAMEWORK', aliases: ['node', 'node.js', 'nodejs', 'node js'] },
  { canonical: 'express', name: 'Express.js', skillType: 'FRAMEWORK', aliases: ['express', 'express.js', 'expressjs'] },
  { canonical: 'nest.js', name: 'NestJS', skillType: 'FRAMEWORK', aliases: ['nest.js', 'nestjs', 'nest js'] },
  { canonical: 'spring-boot', name: 'Spring Boot', skillType: 'FRAMEWORK', aliases: ['spring boot', 'springboot', 'spring framework', 'spring mvc'] },
  { canonical: 'django', name: 'Django', skillType: 'FRAMEWORK', aliases: ['django'] },
  { canonical: 'flask', name: 'Flask', skillType: 'FRAMEWORK', aliases: ['flask'] },
  { canonical: 'fastapi', name: 'FastAPI', skillType: 'FRAMEWORK', aliases: ['fastapi', 'fast api'] },
  { canonical: '.net', name: '.NET', skillType: 'FRAMEWORK', aliases: ['.net', 'dotnet', 'asp.net', 'asp.net core'] },
  { canonical: 'flutter', name: 'Flutter', skillType: 'FRAMEWORK', aliases: ['flutter'] },
  { canonical: 'react-native', name: 'React Native', skillType: 'FRAMEWORK', aliases: ['react native', 'react-native'] },
  { canonical: 'android-sdk', name: 'Android SDK', skillType: 'FRAMEWORK', aliases: ['android sdk', 'android development', 'android jetpack'] },
  { canonical: 'ios-sdk', name: 'iOS SDK', skillType: 'FRAMEWORK', aliases: ['ios development', 'ios sdk', 'uikit'] },
  { canonical: 'tailwind', name: 'Tailwind CSS', skillType: 'FRAMEWORK', aliases: ['tailwind', 'tailwind css'] },
  { canonical: 'bootstrap', name: 'Bootstrap', skillType: 'FRAMEWORK', aliases: ['bootstrap'] },
  { canonical: 'graphql', name: 'GraphQL', skillType: 'FRAMEWORK', aliases: ['graphql', 'apollo'] },
  { canonical: 'redux', name: 'Redux', skillType: 'FRAMEWORK', aliases: ['redux', 'redux toolkit', 'zustand'] },
  { canonical: 'jest', name: 'Jest', skillType: 'FRAMEWORK', aliases: ['jest', 'vitest'] },
  { canonical: 'pytest', name: 'Pytest', skillType: 'FRAMEWORK', aliases: ['pytest', 'py.test'] },
  { canonical: 'selenium', name: 'Selenium', skillType: 'FRAMEWORK', aliases: ['selenium', 'webdriver'] },
  { canonical: 'cypress', name: 'Cypress', skillType: 'FRAMEWORK', aliases: ['cypress'] },
  { canonical: 'playwright', name: 'Playwright', skillType: 'FRAMEWORK', aliases: ['playwright'] },
  { canonical: 'cucumber', name: 'Cucumber/BDD', skillType: 'FRAMEWORK', aliases: ['cucumber', 'bdd', 'gherkin'] },
  { canonical: 'spring', name: 'Spring', skillType: 'FRAMEWORK', aliases: ['spring core', 'spring security', 'spring data'] },
  { canonical: 'hibernate', name: 'Hibernate', skillType: 'FRAMEWORK', aliases: ['hibernate', 'jpa'] },
  { canonical: 'pandas', name: 'Pandas', skillType: 'FRAMEWORK', aliases: ['pandas'] },
  { canonical: 'numpy', name: 'NumPy', skillType: 'FRAMEWORK', aliases: ['numpy'] },
  { canonical: 'spark', name: 'Apache Spark', skillType: 'FRAMEWORK', aliases: ['spark', 'pyspark', 'apache spark'] },
  { canonical: 'hadoop', name: 'Hadoop', skillType: 'FRAMEWORK', aliases: ['hadoop', 'hive', 'pig'] },
  { canonical: 'kafka', name: 'Apache Kafka', skillType: 'FRAMEWORK', aliases: ['kafka', 'apache kafka'] },
  { canonical: 'airflow', name: 'Apache Airflow', skillType: 'FRAMEWORK', aliases: ['airflow', 'apache airflow'] },
  { canonical: 'databricks', name: 'Databricks', skillType: 'FRAMEWORK', aliases: ['databricks'] },
  { canonical: 'power-bi', name: 'Power BI', skillType: 'FRAMEWORK', aliases: ['power bi', 'powerbi', 'dax'] },
  { canonical: 'tableau', name: 'Tableau', skillType: 'FRAMEWORK', aliases: ['tableau'] },
  { canonical: 'tensorflow', name: 'TensorFlow', skillType: 'FRAMEWORK', aliases: ['tensorflow', 'keras'] },
  { canonical: 'pytorch', name: 'PyTorch', skillType: 'FRAMEWORK', aliases: ['pytorch', 'torch'] },
  { canonical: 'scikit-learn', name: 'scikit-learn', skillType: 'FRAMEWORK', aliases: ['scikit-learn', 'sklearn', 'scikit learn'] },
  { canonical: 'langchain', name: 'LangChain', skillType: 'FRAMEWORK', aliases: ['langchain', 'lang graph', 'langgraph'] },
  { canonical: 'hugging-face', name: 'Hugging Face', skillType: 'FRAMEWORK', aliases: ['hugging face', 'huggingface', 'transformers library'] },

  // ── Databases ──
  { canonical: 'postgresql', name: 'PostgreSQL', skillType: 'DATABASE', aliases: ['postgresql', 'postgres', 'psql'] },
  { canonical: 'mysql', name: 'MySQL', skillType: 'DATABASE', aliases: ['mysql', 'mariadb'] },
  { canonical: 'mongodb', name: 'MongoDB', skillType: 'DATABASE', aliases: ['mongodb', 'mongo', 'mongoose'] },
  { canonical: 'redis', name: 'Redis', skillType: 'DATABASE', aliases: ['redis'] },
  { canonical: 'elasticsearch', name: 'Elasticsearch', skillType: 'DATABASE', aliases: ['elasticsearch', 'elastic search', 'opensearch'] },
  { canonical: 'dynamodb', name: 'DynamoDB', skillType: 'DATABASE', aliases: ['dynamodb'] },
  { canonical: 'cassandra', name: 'Cassandra', skillType: 'DATABASE', aliases: ['cassandra'] },
  { canonical: 'snowflake', name: 'Snowflake', skillType: 'DATABASE', aliases: ['snowflake'] },
  { canonical: 'bigquery', name: 'BigQuery', skillType: 'DATABASE', aliases: ['bigquery', 'big query'] },
  { canonical: 'oracle-db', name: 'Oracle DB', skillType: 'DATABASE', aliases: ['oracle db', 'oracle database', 'pl/sql'] },
  { canonical: 'sql-server', name: 'SQL Server', skillType: 'DATABASE', aliases: ['sql server', 'mssql', 't-sql'] },
  { canonical: 'sqlite', name: 'SQLite', skillType: 'DATABASE', aliases: ['sqlite'] },
  { canonical: 'firebase', name: 'Firebase', skillType: 'DATABASE', aliases: ['firebase', 'firestore'] },
  { canonical: 'supabase', name: 'Supabase', skillType: 'DATABASE', aliases: ['supabase'] },

  // ── Cloud ──
  { canonical: 'aws', name: 'AWS', skillType: 'CLOUD', aliases: ['aws', 'amazon web services'] },
  { canonical: 'azure', name: 'Azure', skillType: 'CLOUD', aliases: ['azure', 'microsoft azure'] },
  { canonical: 'gcp', name: 'Google Cloud', skillType: 'CLOUD', aliases: ['gcp', 'google cloud', 'google cloud platform'] },
  { canonical: 'aws-lambda', name: 'AWS Lambda', skillType: 'CLOUD', aliases: ['lambda', 'aws lambda', 'serverless'] },
  { canonical: 's3', name: 'AWS S3', skillType: 'CLOUD', aliases: ['s3', 'aws s3'] },
  { canonical: 'ec2', name: 'AWS EC2', skillType: 'CLOUD', aliases: ['ec2'] },
  { canonical: 'docker', name: 'Docker', skillType: 'CLOUD', aliases: ['docker', 'containerization', 'containers'] },
  { canonical: 'kubernetes', name: 'Kubernetes', skillType: 'CLOUD', aliases: ['kubernetes', 'k8s'] },
  { canonical: 'helm', name: 'Helm', skillType: 'CLOUD', aliases: ['helm'] },
  { canonical: 'terraform', name: 'Terraform', skillType: 'CLOUD', aliases: ['terraform', 'opentofu'] },
  { canonical: 'serverless', name: 'Serverless Architecture', skillType: 'CLOUD', aliases: ['serverless architecture', 'faas'] },

  // ── DevOps ──
  { canonical: 'git', name: 'Git', skillType: 'DEVOPS', aliases: ['git'] },
  { canonical: 'github', name: 'GitHub', skillType: 'DEVOPS', aliases: ['github', 'gitlab', 'bitbucket'] },
  { canonical: 'ci-cd', name: 'CI/CD', skillType: 'DEVOPS', aliases: ['ci/cd', 'ci cd', 'continuous integration', 'continuous delivery', 'jenkins', 'github actions', 'gitlab ci', 'circleci'] },
  { canonical: 'ansible', name: 'Ansible', skillType: 'DEVOPS', aliases: ['ansible'] },
  { canonical: 'prometheus', name: 'Prometheus/Grafana', skillType: 'DEVOPS', aliases: ['prometheus', 'grafana'] },
  { canonical: 'linux', name: 'Linux', skillType: 'DEVOPS', aliases: ['linux', 'unix', 'ubuntu', 'centos'] },
  { canonical: 'nginx', name: 'Nginx', skillType: 'DEVOPS', aliases: ['nginx'] },
  { canonical: 'jira', name: 'Jira', skillType: 'DEVOPS', aliases: ['jira'] },
  { canonical: 'splunk', name: 'Splunk', skillType: 'DEVOPS', aliases: ['splunk'] },
  { canonical: 'datadog', name: 'Datadog', skillType: 'DEVOPS', aliases: ['datadog', 'new relic'] },

  // ── Tools ──
  { canonical: 'postman', name: 'Postman', skillType: 'TOOL', aliases: ['postman'] },
  { canonical: 'vscode', name: 'VS Code', skillType: 'TOOL', aliases: ['vs code', 'vscode', 'visual studio code'] },
  { canonical: 'figma', name: 'Figma', skillType: 'TOOL', aliases: ['figma'] },
  { canonical: 'excel', name: 'Excel', skillType: 'TOOL', aliases: ['excel', 'advanced excel', 'vlookup', 'pivot tables'] },
  { canonical: 'jupyter', name: 'Jupyter', skillType: 'TOOL', aliases: ['jupyter', 'jupyter notebook', 'colab'] },
  { canonical: 'burp-suite', name: 'Burp Suite', skillType: 'TOOL', aliases: ['burp suite', 'burpsuite'] },
  { canonical: 'metasploit', name: 'Metasploit', skillType: 'TOOL', aliases: ['metasploit'] },
  { canonical: 'wireshark', name: 'Wireshark', skillType: 'TOOL', aliases: ['wireshark'] },
  { canonical: 'nmap', name: 'Nmap', skillType: 'TOOL', aliases: ['nmap'] },

  // ── Concepts ──
  { canonical: 'rest-apis', name: 'REST APIs', skillType: 'CONCEPT', aliases: ['rest', 'rest api', 'rest apis', 'restful'] },
  { canonical: 'microservices', name: 'Microservices', skillType: 'CONCEPT', aliases: ['microservices', 'microservices architecture'] },
  { canonical: 'system-design', name: 'System Design', skillType: 'CONCEPT', aliases: ['system design', 'distributed systems', 'scalability', 'high availability'] },
  { canonical: 'dsa', name: 'Data Structures & Algorithms', skillType: 'CONCEPT', aliases: ['data structures', 'algorithms', 'dsa', 'problem solving'] },
  { canonical: 'oop', name: 'OOP', skillType: 'CONCEPT', aliases: ['oop', 'object oriented', 'object-oriented programming'] },
  { canonical: 'dbms', name: 'DBMS', skillType: 'CONCEPT', aliases: ['dbms', 'database design', 'normalization', 'rdbms'] },
  { canonical: 'operating-systems', name: 'Operating Systems', skillType: 'CONCEPT', aliases: ['operating systems', 'os concepts', 'multithreading', 'concurrency'] },
  { canonical: 'computer-networks', name: 'Computer Networks', skillType: 'CONCEPT', aliases: ['computer networks', 'networking', 'tcp/ip', 'http/https'] },
  { canonical: 'authentication-security', name: 'Authentication & Security', skillType: 'CONCEPT', aliases: ['authentication', 'authorization', 'oauth', 'jwt', 'oauth2', 'security best practices', 'encryption'] },
  { canonical: 'testing', name: 'Testing', skillType: 'CONCEPT', aliases: ['unit testing', 'integration testing', 'test automation', 'tdd', 'test driven development'] },
  { canonical: 'ci-cd-concepts', name: 'CI/CD Concepts', skillType: 'CONCEPT', aliases: ['devops practices', 'deployment pipelines'] },
  { canonical: 'caching', name: 'Caching', skillType: 'CONCEPT', aliases: ['caching', 'cache strategies', 'cdn'] },
  { canonical: 'message-queues', name: 'Message Queues', skillType: 'CONCEPT', aliases: ['message queue', 'rabbitmq', 'sqs', 'event-driven'] },
  { canonical: 'observability', name: 'Observability', skillType: 'CONCEPT', aliases: ['observability', 'monitoring', 'logging', 'alerting'] },
  { canonical: 'agile', name: 'Agile/Scrum', skillType: 'CONCEPT', aliases: ['agile', 'scrum', 'kanban'] },
  { canonical: 'machine-learning', name: 'Machine Learning', skillType: 'CONCEPT', aliases: ['machine learning', 'ml models', 'supervised learning', 'unsupervised learning'] },
  { canonical: 'deep-learning', name: 'Deep Learning', skillType: 'CONCEPT', aliases: ['deep learning', 'neural networks', 'cnn', 'rnn', 'transformers'] },
  { canonical: 'nlp', name: 'NLP', skillType: 'CONCEPT', aliases: ['nlp', 'natural language processing'] },
  { canonical: 'computer-vision', name: 'Computer Vision', skillType: 'CONCEPT', aliases: ['computer vision', 'opencv', 'image processing'] },
  { canonical: 'llm', name: 'LLMs & GenAI', skillType: 'CONCEPT', aliases: ['llm', 'llms', 'generative ai', 'genai', 'prompt engineering', 'rag'] },
  { canonical: 'mlops', name: 'MLOps', skillType: 'CONCEPT', aliases: ['mlops', 'model deployment', 'mlflow'] },
  { canonical: 'statistics', name: 'Statistics', skillType: 'CONCEPT', aliases: ['statistics', 'statistical analysis', 'probability', 'hypothesis testing', 'a/b testing'] },
  { canonical: 'data-visualization', name: 'Data Visualization', skillType: 'CONCEPT', aliases: ['data visualization', 'dashboards', 'matplotlib', 'seaborn', 'plotly'] },
  { canonical: 'etl', name: 'ETL/Data Pipelines', skillType: 'CONCEPT', aliases: ['etl', 'elt', 'data pipelines', 'data warehouse'] },
  { canonical: 'data-modeling', name: 'Data Modeling', skillType: 'CONCEPT', aliases: ['data modeling', 'star schema', 'dimensional modeling'] },
  { canonical: 'network-security', name: 'Network Security', skillType: 'CONCEPT', aliases: ['network security', 'firewalls', 'ids/ips', 'vpns'] },
  { canonical: 'appsec', name: 'Application Security', skillType: 'CONCEPT', aliases: ['application security', 'owasp', 'penetration testing', 'pen testing', 'vulnerability assessment'] },
  { canonical: 'siem', name: 'SIEM', skillType: 'CONCEPT', aliases: ['siem', 'security incident', 'incident response', 'soc'] },
  { canonical: 'cryptography', name: 'Cryptography', skillType: 'CONCEPT', aliases: ['cryptography', 'encryption algorithms', 'pki'] },
  { canonical: 'cloud-security', name: 'Cloud Security', skillType: 'CONCEPT', aliases: ['cloud security', 'iam', 'security groups'] },
  { canonical: 'ux-research', name: 'UX Research', skillType: 'CONCEPT', aliases: ['ux research', 'user research', 'usability testing'] },
  { canonical: 'ui-design', name: 'UI Design', skillType: 'CONCEPT', aliases: ['ui design', 'wireframing', 'prototyping', 'design systems'] },
  { canonical: 'accessibility', name: 'Accessibility', skillType: 'CONCEPT', aliases: ['accessibility', 'wcag', 'a11y'] },
  { canonical: 'html-css', name: 'HTML/CSS', skillType: 'CONCEPT', aliases: ['html', 'css', 'html5', 'css3', 'responsive design', 'flexbox', 'grid'] },

  // ── Soft skills ──
  { canonical: 'communication', name: 'Communication', skillType: 'SOFT_SKILL', aliases: ['communication skills', 'verbal communication'] },
  { canonical: 'collaboration', name: 'Collaboration', skillType: 'SOFT_SKILL', aliases: ['teamwork', 'collaboration', 'cross-functional'] },
  { canonical: 'problem-solving', name: 'Problem Solving', skillType: 'SOFT_SKILL', aliases: ['analytical thinking', 'critical thinking'] },
  { canonical: 'ownership', name: 'Ownership', skillType: 'SOFT_SKILL', aliases: ['self-starter', 'proactive', 'ownership'] },
];

/** Extra user/admin-defined entries merged at extraction time (loaded from DB). */
let customEntries: DictionaryEntry[] = [];

export function registerCustomEntries(entries: DictionaryEntry[]): void {
  customEntries = entries;
}

export function getDictionary(): DictionaryEntry[] {
  return [...SKILL_DICTIONARY, ...customEntries];
}

const entriesByCanonical = new Map<string, DictionaryEntry>();
const aliasIndex = new Map<string, DictionaryEntry>();

function rebuildIndex(): void {
  entriesByCanonical.clear();
  aliasIndex.clear();
  for (const entry of getDictionary()) {
    entriesByCanonical.set(entry.canonical, entry);
    for (const alias of [entry.canonical, entry.name, ...entry.aliases]) {
      const key = alias.toLowerCase().trim();
      // Longest alias wins for ambiguous keys.
      const existing = aliasIndex.get(key);
      if (!existing || entry.canonical.length > existing.canonical.length) aliasIndex.set(key, entry);
    }
  }
}
rebuildIndex();

/** Resolve an arbitrary string ("NodeJS", "js", "Postgres") to a canonical entry. */
export function normalizeSkillName(raw: string): DictionaryEntry | null {
  const key = String(raw || '').toLowerCase().trim().replace(/[.,;:]$/, '');
  if (!key) return null;
  if (aliasIndex.has(key)) return aliasIndex.get(key)!;
  // Trailing-punctuation variants like "node.js," handled above; try without dots spacing
  const squeezed = key.replace(/\s+/g, ' ');
  return aliasIndex.get(squeezed) ?? null;
}

export function canonicalName(raw: string): string | null {
  return normalizeSkillName(raw)?.name ?? null;
}

interface Match {
  entry: DictionaryEntry;
  index: number;
  length: number;
}

/** Find all dictionary matches in text using word-boundary-aware longest-match. */
function findMatches(text: string): Match[] {
  const matches: Match[] = [];
  // Sort aliases longest-first so 'react native' beats 'react', 'rest api' beats 'rest'.
  const aliases = [...aliasIndex.entries()].sort((a, b) => b[0].length - a[0].length);
  const lower = text.toLowerCase();
  for (const [alias, entry] of aliases) {
    if (!alias) continue;
    // Word-boundary regex; escape everything. Allow internal spaces/punct variants.
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const re = new RegExp(`(?<![a-z0-9+#.])${escaped}(?![a-z0-9+#])`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      matches.push({ entry, index: m.index, length: m[0].length });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  // Longest-match filtering: drop a match fully inside another longer match's span.
  const kept: Match[] = [];
  for (const candidate of matches.sort((a, b) => (b.length - a.length) || (a.index - b.index))) {
    const overlapping = kept.some(k => candidate.index >= k.index && candidate.index + candidate.length <= k.index + k.length);
    if (!overlapping) kept.push(candidate);
  }
  return kept;
}

function contextWindow(text: string, index: number, length: number, size = 60): string {
  const start = Math.max(0, index - size);
  const end = Math.min(text.length, index + length + size);
  return text.slice(start, end).toLowerCase();
}

export interface ExtractionResult {
  skills: string[];       // canonical slugs
  matchedNames: string[]; // canonical display names, ordered by first appearance
}

/**
 * Extract skills from free job-description text.
 * Deterministic: same input → same output, no AI, no network.
 */
export function extractSkills(text: string): ExtractionResult {
  if (!text || typeof text !== 'string') return { skills: [], matchedNames: [] };
  const matches = findMatches(text);
  const seen = new Map<string, string>();
  for (const { entry, index, length } of matches.sort((a, b) => a.index - b.index)) {
    if (entry.contextHints?.length) {
      const ctx = contextWindow(text, index, length);
      const ok = entry.contextHints.every(hint => new RegExp(hint, 'i').test(ctx));
      if (!ok) continue;
    }
    if (!seen.has(entry.canonical)) seen.set(entry.canonical, entry.name);
  }
  return { skills: [...seen.keys()], matchedNames: [...seen.values()] };
}

/** Resolve a job title to a role slug via CareerRole.marketAliases (falls back to NONE). */
export function mapRoleToSlug(title: string, roleAliases: Array<{ slug: string; aliases: string[] }>): string | null {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return null;
  let best: { slug: string; score: number } | null = null;
  for (const { slug, aliases } of roleAliases) {
    for (const alias of [slug.replace(/-/g, ' '), ...aliases]) {
      const a = alias.toLowerCase().trim();
      if (!a) continue;
      if (t.includes(a)) {
        const score = a.length; // more specific alias wins
        if (!best || score > best.score) best = { slug, score };
      }
    }
  }
  return best?.slug ?? null;
}
