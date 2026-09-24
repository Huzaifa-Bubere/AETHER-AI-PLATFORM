import type { DictionaryEntry } from '../services/skillExtraction';
import type { IRoleSkill, IRoadmapNode, IRoadmapStage, ILearningResource, IProjectSuggestion } from '../models/CareerRole';

/** Canonical skill taxonomy seed — mirrors the extraction dictionary plus extras. */
export const SKILL_TAXONOMY: DictionaryEntry[] = [
  { canonical: 'javascript', name: 'JavaScript', skillType: 'LANGUAGE', aliases: ['js', 'ecmascript'] },
  { canonical: 'typescript', name: 'TypeScript', skillType: 'LANGUAGE', aliases: ['ts'] },
  { canonical: 'python', name: 'Python', skillType: 'LANGUAGE', aliases: ['python3'] },
  { canonical: 'java', name: 'Java', skillType: 'LANGUAGE', aliases: ['core java'] },
  { canonical: 'go', name: 'Go', skillType: 'LANGUAGE', aliases: ['golang'] },
  { canonical: 'c++', name: 'C++', skillType: 'LANGUAGE', aliases: ['cpp'] },
  { canonical: 'c#', name: 'C#', skillType: 'LANGUAGE', aliases: ['csharp'] },
  { canonical: 'php', name: 'PHP', skillType: 'LANGUAGE', aliases: [] },
  { canonical: 'ruby', name: 'Ruby', skillType: 'LANGUAGE', aliases: ['rails'] },
  { canonical: 'kotlin', name: 'Kotlin', skillType: 'LANGUAGE', aliases: [] },
  { canonical: 'swift', name: 'Swift', skillType: 'LANGUAGE', aliases: ['swiftui'] },
  { canonical: 'sql', name: 'SQL', skillType: 'LANGUAGE', aliases: [] },
  { canonical: 'bash', name: 'Bash/Shell', skillType: 'LANGUAGE', aliases: ['shell scripting'] },
  { canonical: 'r', name: 'R', skillType: 'LANGUAGE', aliases: ['r programming'] },
  { canonical: 'scala', name: 'Scala', skillType: 'LANGUAGE', aliases: [] },
  { canonical: 'dart', name: 'Dart', skillType: 'LANGUAGE', aliases: [] },
  { canonical: 'html-css', name: 'HTML/CSS', skillType: 'CONCEPT', aliases: ['html', 'css', 'responsive design'] },
  { canonical: 'react', name: 'React', skillType: 'FRAMEWORK', aliases: ['reactjs'] },
  { canonical: 'next.js', name: 'Next.js', skillType: 'FRAMEWORK', aliases: ['nextjs'] },
  { canonical: 'vue', name: 'Vue.js', skillType: 'FRAMEWORK', aliases: ['vuejs'] },
  { canonical: 'angular', name: 'Angular', skillType: 'FRAMEWORK', aliases: ['angularjs'] },
  { canonical: 'node.js', name: 'Node.js', skillType: 'FRAMEWORK', aliases: ['nodejs'] },
  { canonical: 'express', name: 'Express.js', skillType: 'FRAMEWORK', aliases: ['expressjs'] },
  { canonical: 'nest.js', name: 'NestJS', skillType: 'FRAMEWORK', aliases: ['nestjs'] },
  { canonical: 'spring-boot', name: 'Spring Boot', skillType: 'FRAMEWORK', aliases: ['springboot'] },
  { canonical: 'spring', name: 'Spring', skillType: 'FRAMEWORK', aliases: ['spring security'] },
  { canonical: 'hibernate', name: 'Hibernate', skillType: 'FRAMEWORK', aliases: ['jpa'] },
  { canonical: 'django', name: 'Django', skillType: 'FRAMEWORK', aliases: [] },
  { canonical: 'flask', name: 'Flask', skillType: 'FRAMEWORK', aliases: [] },
  { canonical: 'fastapi', name: 'FastAPI', skillType: 'FRAMEWORK', aliases: ['fast api'] },
  { canonical: '.net', name: '.NET', skillType: 'FRAMEWORK', aliases: ['dotnet', 'asp.net'] },
  { canonical: 'flutter', name: 'Flutter', skillType: 'FRAMEWORK', aliases: [] },
  { canonical: 'react-native', name: 'React Native', skillType: 'FRAMEWORK', aliases: [] },
  { canonical: 'android-sdk', name: 'Android SDK', skillType: 'FRAMEWORK', aliases: ['android development'] },
  { canonical: 'ios-sdk', name: 'iOS SDK', skillType: 'FRAMEWORK', aliases: ['uikit'] },
  { canonical: 'graphql', name: 'GraphQL', skillType: 'FRAMEWORK', aliases: ['apollo'] },
  { canonical: 'redux', name: 'Redux', skillType: 'FRAMEWORK', aliases: ['redux toolkit'] },
  { canonical: 'tailwind', name: 'Tailwind CSS', skillType: 'FRAMEWORK', aliases: ['tailwind css'] },
  { canonical: 'jest', name: 'Jest', skillType: 'FRAMEWORK', aliases: ['vitest'] },
  { canonical: 'pytest', name: 'Pytest', skillType: 'FRAMEWORK', aliases: [] },
  { canonical: 'selenium', name: 'Selenium', skillType: 'FRAMEWORK', aliases: ['webdriver'] },
  { canonical: 'cypress', name: 'Cypress', skillType: 'FRAMEWORK', aliases: [] },
  { canonical: 'playwright', name: 'Playwright', skillType: 'FRAMEWORK', aliases: [] },
  { canonical: 'cucumber', name: 'Cucumber/BDD', skillType: 'FRAMEWORK', aliases: ['gherkin'] },
  { canonical: 'pandas', name: 'Pandas', skillType: 'FRAMEWORK', aliases: [] },
  { canonical: 'numpy', name: 'NumPy', skillType: 'FRAMEWORK', aliases: [] },
  { canonical: 'spark', name: 'Apache Spark', skillType: 'FRAMEWORK', aliases: ['pyspark'] },
  { canonical: 'hadoop', name: 'Hadoop', skillType: 'FRAMEWORK', aliases: ['hive'] },
  { canonical: 'kafka', name: 'Apache Kafka', skillType: 'FRAMEWORK', aliases: [] },
  { canonical: 'airflow', name: 'Apache Airflow', skillType: 'FRAMEWORK', aliases: [] },
  { canonical: 'dbt', name: 'dbt', skillType: 'FRAMEWORK', aliases: ['data build tool'] },
  { canonical: 'power-bi', name: 'Power BI', skillType: 'FRAMEWORK', aliases: ['powerbi'] },
  { canonical: 'tableau', name: 'Tableau', skillType: 'FRAMEWORK', aliases: [] },
  { canonical: 'tensorflow', name: 'TensorFlow', skillType: 'FRAMEWORK', aliases: ['keras'] },
  { canonical: 'pytorch', name: 'PyTorch', skillType: 'FRAMEWORK', aliases: ['torch'] },
  { canonical: 'scikit-learn', name: 'scikit-learn', skillType: 'FRAMEWORK', aliases: ['sklearn'] },
  { canonical: 'langchain', name: 'LangChain', skillType: 'FRAMEWORK', aliases: ['langgraph'] },
  { canonical: 'hugging-face', name: 'Hugging Face', skillType: 'FRAMEWORK', aliases: ['huggingface'] },
  { canonical: 'postgresql', name: 'PostgreSQL', skillType: 'DATABASE', aliases: ['postgres'] },
  { canonical: 'mysql', name: 'MySQL', skillType: 'DATABASE', aliases: ['mariadb'] },
  { canonical: 'mongodb', name: 'MongoDB', skillType: 'DATABASE', aliases: ['mongo'] },
  { canonical: 'redis', name: 'Redis', skillType: 'DATABASE', aliases: [] },
  { canonical: 'elasticsearch', name: 'Elasticsearch', skillType: 'DATABASE', aliases: ['opensearch'] },
  { canonical: 'dynamodb', name: 'DynamoDB', skillType: 'DATABASE', aliases: [] },
  { canonical: 'cassandra', name: 'Cassandra', skillType: 'DATABASE', aliases: [] },
  { canonical: 'snowflake', name: 'Snowflake', skillType: 'DATABASE', aliases: [] },
  { canonical: 'bigquery', name: 'BigQuery', skillType: 'DATABASE', aliases: [] },
  { canonical: 'oracle-db', name: 'Oracle DB', skillType: 'DATABASE', aliases: ['pl/sql'] },
  { canonical: 'sql-server', name: 'SQL Server', skillType: 'DATABASE', aliases: ['mssql'] },
  { canonical: 'sqlite', name: 'SQLite', skillType: 'DATABASE', aliases: [] },
  { canonical: 'firebase', name: 'Firebase', skillType: 'DATABASE', aliases: ['firestore'] },
  { canonical: 'supabase', name: 'Supabase', skillType: 'DATABASE', aliases: [] },
  { canonical: 'aws', name: 'AWS', skillType: 'CLOUD', aliases: ['amazon web services'] },
  { canonical: 'azure', name: 'Azure', skillType: 'CLOUD', aliases: ['microsoft azure'] },
  { canonical: 'gcp', name: 'Google Cloud', skillType: 'CLOUD', aliases: ['google cloud platform'] },
  { canonical: 'aws-lambda', name: 'AWS Lambda', skillType: 'CLOUD', aliases: ['serverless'] },
  { canonical: 'docker', name: 'Docker', skillType: 'CLOUD', aliases: ['containers'] },
  { canonical: 'kubernetes', name: 'Kubernetes', skillType: 'CLOUD', aliases: ['k8s'] },
  { canonical: 'helm', name: 'Helm', skillType: 'CLOUD', aliases: [] },
  { canonical: 'terraform', name: 'Terraform', skillType: 'CLOUD', aliases: [] },
  { canonical: 'git', name: 'Git', skillType: 'DEVOPS', aliases: [] },
  { canonical: 'github', name: 'GitHub', skillType: 'DEVOPS', aliases: ['gitlab', 'bitbucket'] },
  { canonical: 'ci-cd', name: 'CI/CD', skillType: 'DEVOPS', aliases: ['jenkins', 'github actions', 'continuous integration'] },
  { canonical: 'ansible', name: 'Ansible', skillType: 'DEVOPS', aliases: [] },
  { canonical: 'prometheus', name: 'Prometheus/Grafana', skillType: 'DEVOPS', aliases: ['grafana'] },
  { canonical: 'linux', name: 'Linux', skillType: 'DEVOPS', aliases: ['unix', 'ubuntu'] },
  { canonical: 'nginx', name: 'Nginx', skillType: 'DEVOPS', aliases: [] },
  { canonical: 'jira', name: 'Jira', skillType: 'DEVOPS', aliases: [] },
  { canonical: 'postman', name: 'Postman', skillType: 'TOOL', aliases: [] },
  { canonical: 'vscode', name: 'VS Code', skillType: 'TOOL', aliases: ['visual studio code'] },
  { canonical: 'figma', name: 'Figma', skillType: 'TOOL', aliases: [] },
  { canonical: 'excel', name: 'Excel', skillType: 'TOOL', aliases: ['advanced excel'] },
  { canonical: 'jupyter', name: 'Jupyter', skillType: 'TOOL', aliases: ['jupyter notebook'] },
  { canonical: 'burp-suite', name: 'Burp Suite', skillType: 'TOOL', aliases: ['burpsuite'] },
  { canonical: 'metasploit', name: 'Metasploit', skillType: 'TOOL', aliases: [] },
  { canonical: 'wireshark', name: 'Wireshark', skillType: 'TOOL', aliases: [] },
  { canonical: 'nmap', name: 'Nmap', skillType: 'TOOL', aliases: [] },
  { canonical: 'rest-apis', name: 'REST APIs', skillType: 'CONCEPT', aliases: ['restful'] },
  { canonical: 'microservices', name: 'Microservices', skillType: 'CONCEPT', aliases: [] },
  { canonical: 'system-design', name: 'System Design', skillType: 'CONCEPT', aliases: ['distributed systems', 'scalability'] },
  { canonical: 'dsa', name: 'Data Structures & Algorithms', skillType: 'CONCEPT', aliases: ['data structures', 'algorithms'] },
  { canonical: 'oop', name: 'OOP', skillType: 'CONCEPT', aliases: ['object oriented'] },
  { canonical: 'dbms', name: 'DBMS', skillType: 'CONCEPT', aliases: ['database design', 'rdbms'] },
  { canonical: 'operating-systems', name: 'Operating Systems', skillType: 'CONCEPT', aliases: ['os concepts'] },
  { canonical: 'computer-networks', name: 'Computer Networks', skillType: 'CONCEPT', aliases: ['networking', 'tcp/ip'] },
  { canonical: 'authentication-security', name: 'Authentication & Security', skillType: 'CONCEPT', aliases: ['oauth', 'jwt'] },
  { canonical: 'testing', name: 'Testing', skillType: 'CONCEPT', aliases: ['unit testing', 'tdd'] },
  { canonical: 'caching', name: 'Caching', skillType: 'CONCEPT', aliases: ['cdn'] },
  { canonical: 'message-queues', name: 'Message Queues', skillType: 'CONCEPT', aliases: ['rabbitmq', 'sqs'] },
  { canonical: 'observability', name: 'Observability', skillType: 'CONCEPT', aliases: ['monitoring'] },
  { canonical: 'agile', name: 'Agile/Scrum', skillType: 'CONCEPT', aliases: ['scrum'] },
  { canonical: 'machine-learning', name: 'Machine Learning', skillType: 'CONCEPT', aliases: ['ml models'] },
  { canonical: 'deep-learning', name: 'Deep Learning', skillType: 'CONCEPT', aliases: ['neural networks'] },
  { canonical: 'nlp', name: 'NLP', skillType: 'CONCEPT', aliases: ['natural language processing'] },
  { canonical: 'computer-vision', name: 'Computer Vision', skillType: 'CONCEPT', aliases: ['opencv'] },
  { canonical: 'llm', name: 'LLMs & GenAI', skillType: 'CONCEPT', aliases: ['generative ai', 'prompt engineering'] },
  { canonical: 'mlops', name: 'MLOps', skillType: 'CONCEPT', aliases: ['mlflow'] },
  { canonical: 'statistics', name: 'Statistics', skillType: 'CONCEPT', aliases: ['hypothesis testing', 'a/b testing'] },
  { canonical: 'data-visualization', name: 'Data Visualization', skillType: 'CONCEPT', aliases: ['matplotlib', 'seaborn'] },
  { canonical: 'etl', name: 'ETL/Data Pipelines', skillType: 'CONCEPT', aliases: ['data pipelines', 'data warehouse'] },
  { canonical: 'data-modeling', name: 'Data Modeling', skillType: 'CONCEPT', aliases: ['dimensional modeling'] },
  { canonical: 'network-security', name: 'Network Security', skillType: 'CONCEPT', aliases: ['firewalls'] },
  { canonical: 'appsec', name: 'Application Security', skillType: 'CONCEPT', aliases: ['owasp', 'penetration testing'] },
  { canonical: 'siem', name: 'SIEM', skillType: 'CONCEPT', aliases: ['incident response'] },
  { canonical: 'cryptography', name: 'Cryptography', skillType: 'CONCEPT', aliases: ['encryption'] },
  { canonical: 'cloud-security', name: 'Cloud Security', skillType: 'CONCEPT', aliases: ['iam'] },
  { canonical: 'ux-research', name: 'UX Research', skillType: 'CONCEPT', aliases: ['user research'] },
  { canonical: 'ui-design', name: 'UI Design', skillType: 'CONCEPT', aliases: ['wireframing', 'prototyping'] },
  { canonical: 'accessibility', name: 'Accessibility', skillType: 'CONCEPT', aliases: ['wcag'] },
  { canonical: 'clean-code', name: 'Clean Code', skillType: 'CONCEPT', aliases: ['code quality', 'solid principles'] },
  { canonical: 'sdlc', name: 'SDLC', skillType: 'CONCEPT', aliases: ['software development lifecycle'] },
  { canonical: 'communication', name: 'Communication', skillType: 'SOFT_SKILL', aliases: [] },
  { canonical: 'collaboration', name: 'Collaboration', skillType: 'SOFT_SKILL', aliases: ['teamwork'] },
  { canonical: 'problem-solving', name: 'Problem Solving', skillType: 'SOFT_SKILL', aliases: ['analytical thinking'] },
  { canonical: 'ownership', name: 'Ownership', skillType: 'SOFT_SKILL', aliases: [] },
];

// ── Compact authoring helpers ───────────────────────────────────────────────

type NodeSpec = {
  id: string; title: string; why?: string; learn?: string[]; concepts?: string[];
  skills?: string[]; prereq?: string[]; hours?: number; resources?: string[];
  quiz?: Array<{ q: string; opts: string[]; correct: number; why?: string }>;
  project?: { title: string; description: string; deliverables: string[] };
  interview?: string[];
};

type StageSpec = { id: string; title: string; description?: string; nodes: string[] };

type RoleSpec = {
  slug: string; name: string; category: string; description: string;
  responsibilities?: string[];
  stages: StageSpec[];
  nodes: NodeSpec[];
  projects?: IProjectSuggestion[];
  resources?: ILearningResource[];
  marketAliases?: string[];
  experienceExpectations?: string;
  portfolioExpectations?: string;
  extraSkills?: Array<{ name: string; priority: 'ESSENTIAL' | 'RECOMMENDED' | 'OPTIONAL'; type: string }>;
};

function skillFromSpecs(spec: RoleSpec): IRoleSkill[] {
  const seen = new Map<string, IRoleSkill>();
  const stageOf = new Map<string, string>();
  for (const st of spec.stages) for (const nid of st.nodes) stageOf.set(nid, st.id);
  for (const node of spec.nodes) {
    for (const slug of node.skills || []) {
      if (!seen.has(slug)) {
        const dict = SKILL_TAXONOMY.find(s => s.canonical === slug);
        seen.set(slug, {
          skillSlug: slug,
          name: dict?.name || slug,
          priority: 'ESSENTIAL',
          skillType: (dict?.skillType as any) || 'CONCEPT',
          stageId: stageOf.get(node.id),
        });
      }
    }
  }
  for (const extra of spec.extraSkills || []) {
    const slug = extra.name.toLowerCase().replace(/\s+/g, '-');
    if (!seen.has(slug)) {
      const dict = SKILL_TAXONOMY.find(s => s.canonical === slug || s.name === extra.name);
      seen.set(slug, { skillSlug: slug, name: dict?.name || extra.name, priority: extra.priority, skillType: (dict?.skillType as any) || extra.type, stageId: undefined });
    }
  }
  // Recommended/optional demotion via extraSkills duplicates handled; mark last-stage node skills essential.
  return [...seen.values()];
}

function nodesFromSpecs(spec: RoleSpec): IRoadmapNode[] {
  return spec.nodes.map(n => ({
    id: n.id,
    title: n.title,
    description: n.why,
    whyItMatters: n.why,
    whatYouWillLearn: n.learn || [],
    keyConcepts: n.concepts || [],
    skillSlugs: n.skills || [],
    prerequisites: n.prereq || [],
    estimatedHours: n.hours,
    resourceIds: n.resources || [],
    quiz: (n.quiz || []).map(q => ({ question: q.q, options: q.opts, correctIndex: q.correct, explanation: q.why })),
    project: n.project,
    interviewQuestions: n.interview || [],
  }));
}

function stagesFromSpecs(spec: RoleSpec): IRoadmapStage[] {
  return spec.stages.map((s, i) => ({ id: s.id, title: s.title, description: s.description, order: i + 1, nodeIds: s.nodes }));
}

const sharedResources = (extra: ILearningResource[] = []): ILearningResource[] => [
  { id: 'res-roadmap', title: 'roadmap.sh — community role roadmaps', type: 'DOCUMENTATION', provider: 'roadmap.sh', url: 'https://roadmap.sh/roadmaps', difficulty: 'beginner' },
  ...extra,
];

/** Common foundation nodes reused by software engineering roles. */
const foundationNodes = (opts: { dsaHours?: number } = {}): NodeSpec[] => [
  {
    id: 'programming-basics', title: 'Programming Fundamentals', hours: 12,
    why: 'Everything else in software rests on writing clear, correct code.',
    learn: ['Variables, control flow, functions', 'Collections and iteration', 'Debugging basics', 'Reading error messages'],
    concepts: ['Loops', 'Functions', 'Recursion basics'],
    skills: ['problem-solving'],
    quiz: [
      { q: 'What does a function primarily help with?', opts: ['Reusing logic', 'Faster CPUs', 'Styling UIs', 'Database storage'], correct: 0, why: 'Functions package reusable logic.' },
      { q: 'Which is a typical debugging first step?', opts: ['Rewrite everything', 'Read the error and reproduce', 'Delete tests', 'Deploy faster'], correct: 1 },
      { q: 'An array is…', opts: ['An ordered collection', 'A network protocol', 'A styling language', 'A database'], correct: 0 },
    ],
    interview: ['Explain the difference between a loop and recursion.', 'How do you approach fixing a bug you cannot reproduce?'],
  },
  {
    id: 'git-basics', title: 'Git & GitHub', hours: 6, prereq: ['programming-basics'],
    why: 'Version control is non-negotiable in every professional team.',
    learn: ['commits, branches, merges', 'Pull requests and code review', 'Resolving conflicts'],
    concepts: ['VCS', 'Branching models'],
    skills: ['git', 'github'],
    quiz: [
      { q: 'What does `git commit` do?', opts: ['Records a snapshot of staged changes', 'Uploads code to GitHub', 'Deletes history', 'Creates a branch'], correct: 0 },
      { q: 'A pull request is used to…', opts: ['Request code review and merge a branch', 'Delete a repo', 'Rename files', 'Install packages'], correct: 0 },
    ],
    interview: ['Explain merge vs rebase.', 'What is a good commit message?'],
  },
  {
    id: 'dsa-core', title: 'Data Structures & Algorithms', hours: opts.dsaHours ?? 40, prereq: ['programming-basics'],
    why: 'DSA is the backbone of technical interviews and efficient code.',
    learn: ['Arrays, strings, hash maps', 'Stacks, queues, linked lists', 'Trees and graphs', 'Sorting and searching', 'Big-O analysis'],
    concepts: ['Time complexity', 'Hashing', 'Traversal'],
    skills: ['dsa'],
    quiz: [
      { q: 'Big-O of hash map lookup (average)?', opts: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'], correct: 0 },
      { q: 'Binary search requires…', opts: ['Sorted input', 'A linked list', 'Random data', 'A graph'], correct: 0 },
      { q: 'BFS uses which structure?', opts: ['Queue', 'Stack', 'Heap only', 'Tree'], correct: 0 },
    ],
    interview: ['Reverse a linked list.', 'Detect a cycle in a graph.', 'Explain quicksort complexity.'],
  },
  {
    id: 'dbms-core', title: 'Databases & SQL', hours: 14, prereq: ['programming-basics'],
    why: 'Nearly every application persists data — you must model and query it well.',
    learn: ['Relational modeling', 'SQL joins and indexes', 'Transactions (ACID)', 'NoSQL vs SQL trade-offs'],
    concepts: ['Normalization', 'Indexing', 'ACID'],
    skills: ['dbms', 'sql'],
    quiz: [
      { q: 'Which query returns all users older than 30?', opts: ['SELECT * FROM users WHERE age > 30', 'GET users age>30', 'SELECT * FROM users HAVING age>30', 'FILTER users BY age>30'], correct: 0 },
      { q: 'An index mainly improves…', opts: ['Read performance', 'Backup size', 'UI speed', 'Network latency'], correct: 0 },
      { q: 'ACID stands for?', opts: ['Atomicity, Consistency, Isolation, Durability', 'A Compiler In Docker', 'API Consistency In Data', 'None'], correct: 0 },
    ],
    interview: ['Explain normalization to 3NF.', 'When would you denormalize?'],
  },
  {
    id: 'os-networks', title: 'OS & Networking Essentials', hours: 12, prereq: ['programming-basics'],
    why: 'Processes, threads, TCP/IP and HTTP explain how systems actually run and talk.',
    learn: ['Processes vs threads', 'Memory basics', 'HTTP/HTTPS, DNS, TCP/IP', 'Sockets'],
    concepts: ['Concurrency', 'HTTP lifecycle'],
    skills: ['operating-systems', 'computer-networks'],
    quiz: [
      { q: 'A thread is…', opts: ['A unit of execution within a process', 'A database index', 'A CSS rule', 'A DNS record'], correct: 0 },
      { q: 'HTTP status 404 means…', opts: ['Not Found', 'Server Error', 'Unauthorized', 'Redirect'], correct: 0 },
    ],
    interview: ['What happens when you type a URL and press Enter?', 'Process vs thread?'],
  },
];

export const ROLES: RoleSpec[] = [
  {
    slug: 'software-engineer', name: 'Software Engineer', category: 'Software Development',
    description: 'Builds and maintains software systems across the stack with strong fundamentals in data structures, algorithms, and engineering practice.',
    responsibilities: ['Design and implement software features', 'Write tested, maintainable code', 'Participate in code reviews', 'Debug and fix production issues'],
    marketAliases: ['sde', 'software developer', 'developer', 'programmer', 'software engineer'],
    experienceExpectations: 'Entry-level: strong DSA + one language depth + git. Mid: system design + ownership of features.',
    portfolioExpectations: '2–3 substantial projects with tests and README; clean git history.',
    stages: [
      { id: 'foundations', title: 'Foundations', description: 'Core computer science and tooling', nodes: ['programming-basics', 'git-basics', 'dsa-core', 'dbms-core', 'os-networks'] },
      { id: 'engineering', title: 'Engineering Practice', nodes: ['oop-clean', 'web-basics', 'testing', 'apis'] },
      { id: 'tools', title: 'Tools & Workflow', nodes: ['docker-intro', 'ci-cd-basics'] },
      { id: 'advanced', title: 'Advanced', nodes: ['system-design', 'caching-queues'] },
    ],
    nodes: [
      ...foundationNodes(),
      { id: 'oop-clean', title: 'OOP & Clean Code', hours: 10, prereq: ['programming-basics'], why: 'Readable, extensible code is what teams ship.', learn: ['Encapsulation, inheritance, polymorphism', 'SOLID principles', 'Refactoring smells'], concepts: ['SOLID', 'DRY'], skills: ['oop', 'clean-code'], quiz: [{ q: 'SOLID principles primarily improve…', opts: ['Maintainability', 'Compile speed', 'Network use', 'Battery life'], correct: 0 }], interview: ['Explain SOLID with an example.'] },
      { id: 'web-basics', title: 'Web & HTTP Fundamentals', hours: 8, prereq: ['os-networks'], why: 'Most software is web software.', learn: ['HTML/CSS/JS triad', 'How requests work', 'Browser devtools'], concepts: ['DOM', 'HTTP methods'], skills: ['html-css'], quiz: [{ q: 'CSS flexbox is used for…', opts: ['Layout', 'Databases', 'Encryption', 'Routing'], correct: 0 }] },
      { id: 'testing', title: 'Testing & Quality', hours: 8, prereq: ['oop-clean'], why: 'Tests keep features working while code changes.', learn: ['Unit vs integration tests', 'TDD basics', 'Mocking'], concepts: ['Test pyramid'], skills: ['testing'], quiz: [{ q: 'A unit test…', opts: ['Tests one unit in isolation', 'Tests the whole app', 'Is manual', 'Measures speed'], correct: 0 }] },
      { id: 'apis', title: 'REST APIs & Integration', hours: 10, prereq: ['dbms-core', 'web-basics'], why: 'Services communicate through APIs.', learn: ['REST design', 'Status codes & verbs', 'Auth basics (JWT/OAuth)'], concepts: ['Resource modeling'], skills: ['rest-apis', 'authentication-security'], quiz: [{ q: 'Which HTTP verb is idempotent?', opts: ['GET', 'POST', 'PATCH', 'CONNECT'], correct: 0 }], interview: ['Design an API for a todo app.'] },
      { id: 'docker-intro', title: 'Docker & Containers', hours: 8, prereq: ['os-networks'], why: 'Containers make "works on my machine" obsolete.', learn: ['Images vs containers', 'Dockerfile', 'Docker Compose'], concepts: ['Image layers'], skills: ['docker'], quiz: [{ q: 'A Docker image is…', opts: ['A build template for containers', 'A running process', 'A VM snapshot only', 'A git branch'], correct: 0 }] },
      { id: 'ci-cd-basics', title: 'CI/CD Pipelines', hours: 6, prereq: ['git-basics', 'testing'], why: 'Automation ships code safely and often.', learn: ['Pipeline stages', 'GitHub Actions basics', 'Deploy strategies'], concepts: ['Build → test → deploy'], skills: ['ci-cd'], quiz: [{ q: 'CI stands for…', opts: ['Continuous Integration', 'Code Inspection', 'Central Index', 'Cache Invalidation'], correct: 0 }] },
      { id: 'system-design', title: 'System Design Fundamentals', hours: 20, prereq: ['apis', 'dbms-core'], why: 'Senior conversations are design conversations.', learn: ['Load balancing', 'Sharding & replication', 'CAP theorem', 'Estimation'], concepts: ['Availability vs consistency'], skills: ['system-design'], quiz: [{ q: 'Vertical scaling means…', opts: ['Bigger single machine', 'More machines', 'More databases', 'More caches'], correct: 0 }], interview: ['Design a URL shortener.', 'Design a chat system.'] },
      { id: 'caching-queues', title: 'Caching & Message Queues', hours: 10, prereq: ['system-design'], why: 'The standard answers to scale and decoupling.', learn: ['Cache patterns (aside/through)', 'Redis basics', 'Queue semantics'], concepts: ['TTL', 'At-least-once delivery'], skills: ['caching', 'message-queues'], quiz: [{ q: 'Cache-aside means…', opts: ['App checks cache first, then DB', 'DB writes to cache only', 'Cache is never invalidated', 'Cache replaces DB'], correct: 0 }] },
    ],
    projects: [
      { title: 'Personal Library REST API', difficulty: 'beginner', estimatedDuration: '1–2 weeks', description: 'CRUD API for a book collection with validation and error handling.', deliverables: ['Repo with README', 'Postman collection', 'Basic tests'], skillSlugs: ['rest-apis', 'dbms'] },
      { title: 'Auth-protected Task Manager', difficulty: 'intermediate', estimatedDuration: '2–3 weeks', description: 'Full app with JWT auth, roles, and a relational database.', deliverables: ['Auth flows', 'DB schema', 'CI pipeline'], skillSlugs: ['authentication-security', 'sql', 'ci-cd'] },
      { title: 'Scalable URL Shortener', difficulty: 'advanced', estimatedDuration: '3–4 weeks', description: 'Shortener with caching, analytics, and load-tested design doc.', deliverables: ['Design document', 'Cache layer', 'Benchmark results'], skillSlugs: ['system-design', 'caching', 'docker'] },
    ],
    resources: sharedResources(),
  },
  {
    slug: 'frontend-developer', name: 'Frontend Developer', category: 'Software Development',
    description: 'Builds user interfaces and experiences in the browser with a focus on accessibility, performance, and component architecture.',
    responsibilities: ['Implement UIs from designs', 'Manage client state', 'Optimize web performance', 'Ensure accessibility'],
    marketAliases: ['front end developer', 'frontend engineer', 'ui developer', 'react developer', 'web developer'],
    stages: [
      { id: 'foundations', title: 'Web Foundations', nodes: ['html-css-deep', 'js-deep', 'git-basics'] },
      { id: 'frameworks', title: 'Frameworks', nodes: ['react-core', 'state-mgmt', 'styling'] },
      { id: 'quality', title: 'Quality & Tooling', nodes: ['fe-testing', 'fe-performance'] },
      { id: 'advanced', title: 'Advanced', nodes: ['ssr-meta', 'fe-system-design'] },
    ],
    nodes: [
      { id: 'html-css-deep', title: 'HTML & CSS Mastery', hours: 14, why: 'Semantic, responsive markup is the floor of frontend craft.', learn: ['Semantic HTML', 'Flexbox/Grid', 'Responsive design', 'Accessibility basics'], skills: ['html-css', 'accessibility'], quiz: [{ q: 'Semantic HTML helps…', opts: ['Accessibility and SEO', 'Bundle size only', 'Server speed', 'Nothing'], correct: 0 }] },
      { id: 'js-deep', title: 'JavaScript Deep Dive', hours: 20, prereq: ['html-css-deep'], learn: ['Closures, prototypes', 'async/await, event loop', 'ES modules'], skills: ['javascript'], quiz: [{ q: 'The event loop…', opts: ['Processes the callback queue when the stack is empty', 'Is a CSS feature', 'Parallelizes everything', 'Is a DB driver'], correct: 0 }], interview: ['Explain the event loop with an example.'] },
      { id: 'git-basics', title: 'Git & GitHub', hours: 6, prereq: ['js-deep'], skills: ['git', 'github'], learn: ['Branching', 'PRs'], quiz: [{ q: 'git push uploads…', opts: ['Local commits to remote', 'Node modules', 'Nothing', 'Only tags'], correct: 0 }] },
      { id: 'react-core', title: 'React Fundamentals', hours: 18, prereq: ['js-deep'], learn: ['Components & props', 'Hooks (useState/useEffect)', 'Lists & keys', 'Forms'], skills: ['react'], quiz: [{ q: 'Keys in lists help React…', opts: ['Track items across renders', 'Style items', 'Fetch data', 'Sort automatically'], correct: 0 }], interview: ['What problem do keys solve?'] },
      { id: 'state-mgmt', title: 'Client State Management', hours: 10, prereq: ['react-core'], learn: ['Local vs global state', 'Context', 'Redux/Zustand patterns'], skills: ['redux'], quiz: [{ q: 'Global state is warranted when…', opts: ['Many components share it', 'One component uses it', 'Never', 'Only for forms'], correct: 0 }] },
      { id: 'styling', title: 'Modern Styling & Design Systems', hours: 8, prereq: ['html-css-deep'], learn: ['Tailwind utility patterns', 'Design tokens', 'Component libraries'], skills: ['tailwind', 'ui-design'] },
      { id: 'fe-testing', title: 'Frontend Testing', hours: 8, prereq: ['react-core'], learn: ['Component tests', 'Jest', 'React Testing Library'], skills: ['jest', 'testing'], quiz: [{ q: 'RTL encourages testing…', opts: ['Behavior users see', 'Internal state only', 'CSS values', 'Network speed'], correct: 0 }] },
      { id: 'fe-performance', title: 'Web Performance', hours: 8, prereq: ['react-core'], learn: ['Core Web Vitals', 'Code splitting', 'Image optimization'], skills: ['system-design'], quiz: [{ q: 'LCP measures…', opts: ['Largest content paint time', 'Login count', 'Server load', 'Latency to first byte only'], correct: 0 }] },
      { id: 'ssr-meta', title: 'SSR & Meta-frameworks', hours: 10, prereq: ['react-core'], learn: ['SSR vs CSR vs SSG', 'Next.js basics'], skills: ['next.js'] },
      { id: 'fe-system-design', title: 'Frontend System Design', hours: 10, prereq: ['fe-performance', 'state-mgmt'], learn: ['Component APIs', 'Design systems at scale', 'Micro-frontends overview'], skills: ['system-design'], interview: ['Design an autocomplete component.'] },
    ],
    projects: [
      { title: 'Responsive Portfolio Site', difficulty: 'beginner', estimatedDuration: '1 week', description: 'Accessible, responsive personal site.', deliverables: ['Lighthouse 90+ scores'], skillSlugs: ['html-css'] },
      { title: 'Kanban Board App', difficulty: 'intermediate', estimatedDuration: '2–3 weeks', description: 'Drag-and-drop tasks with persistent state.', deliverables: ['State tests', 'Keyboard accessible DnD'], skillSlugs: ['react', 'redux'] },
      { title: 'Design System + Docs', difficulty: 'advanced', estimatedDuration: '3 weeks', description: 'Reusable component library with docs and visual tests.', deliverables: ['Storybook', 'Versioned package'], skillSlugs: ['ui-design', 'react', 'accessibility'] },
    ],
    resources: sharedResources([
      { id: 'res-react-docs', title: 'React Official Docs', type: 'DOCUMENTATION', provider: 'react.dev', url: 'https://react.dev/learn', difficulty: 'beginner' },
      { id: 'res-mdn', title: 'MDN Web Docs', type: 'DOCUMENTATION', provider: 'Mozilla', url: 'https://developer.mozilla.org', difficulty: 'beginner' },
    ]),
  },
  {
    slug: 'backend-developer', name: 'Backend Developer', category: 'Software Development',
    description: 'Designs and builds server-side systems: APIs, databases, authentication, and the infrastructure that keeps applications reliable.',
    responsibilities: ['Design REST/GraphQL APIs', 'Model databases', 'Implement auth and security', 'Optimize performance'],
    marketAliases: ['back end developer', 'backend engineer', 'node developer', 'api developer', 'java backend'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['programming-basics', 'git-basics', 'db-core', 'net-core'] },
      { id: 'backend-core', title: 'Backend Core', nodes: ['language-depth', 'framework-depth', 'rest-auth'] },
      { id: 'data-scale', title: 'Data & Scale', nodes: ['db-advanced', 'caching-queues'] },
      { id: 'production', title: 'Production', nodes: ['docker-intro', 'cloud-basics', 'be-system-design'] },
    ],
    nodes: [
      { id: 'programming-basics', title: 'Programming Fundamentals', hours: 12, skills: ['problem-solving'], learn: ['Functions & data flow', 'Debugging'], quiz: [{ q: 'Good variable names…', opts: ['Describe purpose', 'Are always short', 'Use numbers', 'Are random'], correct: 0 }] },
      { id: 'git-basics', title: 'Git & GitHub', hours: 6, prereq: ['programming-basics'], skills: ['git', 'github'], learn: ['Branching', 'PRs'] },
      { id: 'db-core', title: 'Relational Databases & SQL', hours: 12, prereq: ['programming-basics'], skills: ['dbms', 'sql'], learn: ['Schema design', 'Joins', 'Indexes'], quiz: [{ q: 'A foreign key…', opts: ['References another table’s key', 'Encrypts data', 'Speeds UI', 'Is a JS feature'], correct: 0 }] },
      { id: 'net-core', title: 'Networking & OS Basics', hours: 10, prereq: ['programming-basics'], skills: ['computer-networks', 'operating-systems'], learn: ['TCP/IP, HTTP', 'Processes/threads'] },
      { id: 'language-depth', title: 'Pick Your Language (JS/Python/Java/Go)', hours: 24, prereq: ['programming-basics'], skills: ['javascript', 'python', 'java', 'go'], learn: ['Language idioms', 'Async patterns', 'Testing in that language'] },
      { id: 'framework-depth', title: 'Backend Framework', hours: 16, prereq: ['language-depth'], skills: ['node.js', 'express', 'spring-boot', 'django', 'fastapi'], learn: ['Routing & middleware', 'ORM/ODM', 'Validation'], quiz: [{ q: 'Middleware in Express is…', opts: ['A function in the request pipeline', 'A DB driver', 'A CSS tool', 'A scheduler'], correct: 0 }] },
      { id: 'rest-auth', title: 'REST APIs, Auth & Security', hours: 14, prereq: ['framework-depth', 'db-core'], skills: ['rest-apis', 'authentication-security'], learn: ['Resource design', 'JWT/OAuth2', 'OWASP top 10 awareness'], interview: ['Where do you store JWTs and why?'] },
      { id: 'db-advanced', title: 'Advanced Databases', hours: 14, prereq: ['db-core'], skills: ['postgresql', 'mongodb', 'redis'], learn: ['NoSQL patterns', 'Transactions', 'Query optimization'] },
      { id: 'caching-queues', title: 'Caching & Queues', hours: 10, prereq: ['db-advanced'], skills: ['caching', 'message-queues', 'redis'], learn: ['Cache invalidation', 'Queue workers'] },
      { id: 'docker-intro', title: 'Docker & Deployment', hours: 8, prereq: ['net-core'], skills: ['docker', 'linux'], learn: ['Dockerfile', 'Compose', 'Logs & processes'] },
      { id: 'cloud-basics', title: 'Cloud Essentials', hours: 10, prereq: ['docker-intro'], skills: ['aws', 'ci-cd'], learn: ['Core managed services', 'IAM basics', 'CI/CD deploy'] },
      { id: 'be-system-design', title: 'Backend System Design', hours: 18, prereq: ['caching-queues', 'rest-auth'], skills: ['system-design', 'microservices'], learn: ['Load balancing', 'Sharding', 'API rate limiting'], interview: ['Design a rate limiter.', 'Design a job queue.'] },
    ],
    projects: [
      { title: 'REST API with Auth & DB', difficulty: 'beginner', estimatedDuration: '1–2 weeks', description: 'CRUD + JWT auth + relational storage.', deliverables: ['API docs', 'Tests'], skillSlugs: ['rest-apis', 'authentication-security'] },
      { title: 'Multi-service App with Queues', difficulty: 'intermediate', estimatedDuration: '2–3 weeks', description: 'API + worker via a queue, Dockerized.', deliverables: ['docker-compose', 'Worker logs'], skillSlugs: ['message-queues', 'docker'] },
      { title: 'Scalable Job Processing Service', difficulty: 'advanced', estimatedDuration: '3–4 weeks', description: 'Retries, idempotency, rate limits, monitoring.', deliverables: ['Design doc', 'Load test results'], skillSlugs: ['system-design', 'caching', 'microservices'] },
    ],
    resources: sharedResources([
      { id: 'res-node-docs', title: 'Node.js Official Docs', type: 'DOCUMENTATION', provider: 'nodejs.org', url: 'https://nodejs.org/docs', difficulty: 'beginner' },
    ]),
  },
  {
    slug: 'fullstack-developer', name: 'Full Stack Developer', category: 'Software Development',
    description: 'Ships complete features across frontend and backend, owning the path from database schema to deployed UI.',
    responsibilities: ['Build end-to-end features', 'Own both client and server code', 'Deploy and monitor apps'],
    marketAliases: ['full stack developer', 'fullstack engineer', 'mern developer', 'mean developer'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['web-fund', 'js-ts', 'git-basics', 'db-fund'] },
      { id: 'stack', title: 'The Stack', nodes: ['fe-framework', 'be-framework', 'api-layer'] },
      { id: 'ship', title: 'Ship It', nodes: ['auth-payments', 'deploy-cloud'] },
      { id: 'advanced', title: 'Advanced', nodes: ['fs-system-design'] },
    ],
    nodes: [
      { id: 'web-fund', title: 'HTML/CSS & Web Basics', hours: 10, skills: ['html-css'], learn: ['Layouts', 'HTTP'] },
      { id: 'js-ts', title: 'JavaScript & TypeScript', hours: 18, prereq: ['web-fund'], skills: ['javascript', 'typescript'], learn: ['Types', 'Async', 'Modules'] },
      { id: 'git-basics', title: 'Git & GitHub', hours: 6, prereq: ['js-ts'], skills: ['git', 'github'], learn: ['PR flow'] },
      { id: 'db-fund', title: 'Databases (SQL + NoSQL)', hours: 12, prereq: ['js-ts'], skills: ['dbms', 'sql', 'mongodb'], learn: ['Modeling', 'Migrations'] },
      { id: 'fe-framework', title: 'Frontend Framework (React)', hours: 16, prereq: ['js-ts'], skills: ['react'], learn: ['Hooks', 'Data fetching'] },
      { id: 'be-framework', title: 'Backend Framework (Node/Express or similar)', hours: 14, prereq: ['db-fund'], skills: ['node.js', 'express'], learn: ['Routing', 'ORMs'] },
      { id: 'api-layer', title: 'APIs & Integration', hours: 10, prereq: ['be-framework', 'fe-framework'], skills: ['rest-apis'], learn: ['REST design', 'Client caching'] },
      { id: 'auth-payments', title: 'Auth & Real Features', hours: 12, prereq: ['api-layer'], skills: ['authentication-security'], learn: ['Sessions vs JWT', 'Stripe basics'] },
      { id: 'deploy-cloud', title: 'Deployment & Cloud', hours: 10, prereq: ['auth-payments'], skills: ['docker', 'ci-cd', 'aws'], learn: ['Containers', 'Pipelines', 'Managed hosting'] },
      { id: 'fs-system-design', title: 'Full-stack System Design', hours: 14, prereq: ['deploy-cloud'], skills: ['system-design', 'caching'], learn: ['End-to-end architecture', 'Performance budgets'] },
    ],
    projects: [
      { title: 'Notes App (CRUD + Auth)', difficulty: 'beginner', estimatedDuration: '1 week', description: 'Classic full-stack starter.', deliverables: ['Deployed URL'], skillSlugs: ['react', 'node.js'] },
      { title: 'E-commerce-lite with Payments', difficulty: 'intermediate', estimatedDuration: '3 weeks', description: 'Catalog, cart, checkout with Stripe test mode.', deliverables: ['Order schema', 'Webhook handler'], skillSlugs: ['rest-apis', 'authentication-security', 'mongodb'] },
      { title: 'Realtime Collaboration Board', difficulty: 'advanced', estimatedDuration: '3–4 weeks', description: 'Websockets, presence, conflict handling.', deliverables: ['Architecture diagram'], skillSlugs: ['system-design', 'react', 'node.js'] },
    ],
    resources: sharedResources(),
  },
  {
    slug: 'java-developer', name: 'Java Developer', category: 'Software Development',
    description: 'Builds enterprise backend systems with Java, Spring, and relational databases at organizational scale.',
    responsibilities: ['Develop Spring services', 'Design JPA entities', 'Write JUnit tests'],
    marketAliases: ['java backend', 'java developer', 'spring developer', 'java engineer'],
    stages: [
      { id: 'foundations', title: 'Java Foundations', nodes: ['java-core', 'oop-java', 'git-basics'] },
      { id: 'platform', title: 'Platform', nodes: ['collections-jvm', 'spring-core', 'jpa-db'] },
      { id: 'production', title: 'Production Java', nodes: ['spring-boot-rest', 'testing-java', 'build-deploy'] },
      { id: 'advanced', title: 'Advanced', nodes: ['java-system-design'] },
    ],
    nodes: [
      { id: 'java-core', title: 'Java Language Core', hours: 20, skills: ['java'], learn: ['Syntax & OOP in Java', 'Exceptions', 'Generics'], quiz: [{ q: 'Checked exceptions are…', opts: ['Enforced at compile time', 'Runtime only', 'Always ignored', 'JS-only'], correct: 0 }] },
      { id: 'oop-java', title: 'OOP & Clean Code in Java', hours: 10, prereq: ['java-core'], skills: ['oop', 'clean-code'], learn: ['Interfaces vs abstract classes', 'SOLID in Java'] },
      { id: 'git-basics', title: 'Git & GitHub', hours: 6, prereq: ['java-core'], skills: ['git', 'github'], learn: ['PR flow'] },
      { id: 'collections-jvm', title: 'Collections & JVM Internals', hours: 12, prereq: ['java-core'], skills: ['dsa', 'operating-systems'], learn: ['List/Set/Map contracts', 'GC basics', 'Big-O of collections'] },
      { id: 'spring-core', title: 'Spring Framework', hours: 14, prereq: ['oop-java'], skills: ['spring'], learn: ['IoC & DI', 'Bean lifecycle', 'AOP basics'], quiz: [{ q: 'Dependency Injection helps with…', opts: ['Loose coupling & testability', 'Faster JVM', 'Smaller jars', 'Nothing'], correct: 0 }] },
      { id: 'jpa-db', title: 'JPA, Hibernate & SQL', hours: 12, prereq: ['spring-core'], skills: ['hibernate', 'sql', 'dbms'], learn: ['Entities & relationships', 'N+1 problem', 'Transactions'] },
      { id: 'spring-boot-rest', title: 'Spring Boot REST', hours: 14, prereq: ['spring-core', 'jpa-db'], skills: ['spring-boot', 'rest-apis'], learn: ['Spring MVC', 'Validation', 'Actuator'] },
      { id: 'testing-java', title: 'Testing in Java', hours: 8, prereq: ['spring-boot-rest'], skills: ['testing'], learn: ['JUnit 5', 'Mockito', 'Test slices'] },
      { id: 'build-deploy', title: 'Build, Containers & CI', hours: 8, prereq: ['spring-boot-rest'], skills: ['ci-cd', 'docker', 'linux'], learn: ['Maven/Gradle', 'Dockerize a jar', 'GitHub Actions'] },
      { id: 'java-system-design', title: 'Java System Design', hours: 16, prereq: ['testing-java'], skills: ['system-design', 'microservices', 'kafka'], learn: ['Spring Cloud overview', 'Kafka integration', 'Resilience patterns'] },
    ],
    projects: [
      { title: 'Spring Boot CRUD + JPA', difficulty: 'beginner', estimatedDuration: '1 week', description: 'REST API backed by JPA.', deliverables: ['Swagger/OpenAPI'], skillSlugs: ['spring-boot', 'hibernate'] },
      { title: 'Spring Security App', difficulty: 'intermediate', estimatedDuration: '2 weeks', description: 'Roles, JWT, protected endpoints.', deliverables: ['Auth tests'], skillSlugs: ['spring', 'authentication-security'] },
      { title: 'Event-driven Microservices', difficulty: 'advanced', estimatedDuration: '4 weeks', description: 'Kafka-based services with resilience.', deliverables: ['Service registry', 'Load tests'], skillSlugs: ['kafka', 'microservices', 'spring-boot'] },
    ],
    resources: sharedResources([
      { id: 'res-spring', title: 'Spring Official Guides', type: 'DOCUMENTATION', provider: 'spring.io', url: 'https://spring.io/guides', difficulty: 'beginner' },
    ]),
  },
  {
    slug: 'python-developer', name: 'Python Developer', category: 'Software Development',
    description: 'Builds applications, APIs, and automation with Python and its web/data ecosystem.',
    responsibilities: ['Develop Python services', 'Write tested, typed code', 'Automate workflows'],
    marketAliases: ['python developer', 'python engineer', 'django developer'],
    stages: [
      { id: 'foundations', title: 'Python Foundations', nodes: ['py-core', 'py-idioms', 'git-basics'] },
      { id: 'web', title: 'Web with Python', nodes: ['py-web-framework', 'py-db', 'py-apis'] },
      { id: 'quality', title: 'Quality', nodes: ['py-testing'] },
      { id: 'advanced', title: 'Advanced', nodes: ['py-async-deploy', 'py-system-design'] },
    ],
    nodes: [
      { id: 'py-core', title: 'Python Core', hours: 16, skills: ['python'], learn: ['Data structures', 'Comprehensions', 'Errors'], quiz: [{ q: 'List comprehensions…', opts: ['Build lists concisely', 'Are SQL', 'Replace functions', 'Are async'], correct: 0 }] },
      { id: 'py-idioms', title: 'Idiomatic & Clean Python', hours: 8, prereq: ['py-core'], skills: ['clean-code', 'oop'], learn: ['Type hints', 'Dataclasses', 'Context managers'] },
      { id: 'git-basics', title: 'Git & GitHub', hours: 6, prereq: ['py-core'], skills: ['git', 'github'], learn: ['PR flow'] },
      { id: 'py-web-framework', title: 'Web Framework (Django/FastAPI/Flask)', hours: 16, prereq: ['py-idioms'], skills: ['django', 'fastapi', 'flask'], learn: ['Routing', 'ORMs', 'Validation (Pydantic)'] },
      { id: 'py-db', title: 'Databases with Python', hours: 10, prereq: ['py-web-framework'], skills: ['sql', 'postgresql', 'mongodb'], learn: ['SQLAlchemy/Django ORM', 'Migrations'] },
      { id: 'py-apis', title: 'REST APIs in Python', hours: 10, prereq: ['py-web-framework'], skills: ['rest-apis', 'authentication-security'], learn: ['API design', 'JWT auth'] },
      { id: 'py-testing', title: 'Testing with Pytest', hours: 8, prereq: ['py-apis'], skills: ['pytest', 'testing'], learn: ['Fixtures', 'Parametrization', 'Mocks'] },
      { id: 'py-async-deploy', title: 'Async, Tasks & Deployment', hours: 12, prereq: ['py-testing'], skills: ['docker', 'ci-cd', 'linux'], learn: ['asyncio', 'Celery', 'Docker deploy'] },
      { id: 'py-system-design', title: 'Python System Design', hours: 12, prereq: ['py-async-deploy'], skills: ['system-design', 'caching', 'message-queues'], learn: ['Scaling Django/FastAPI', 'Redis caching', 'Queues'] },
    ],
    projects: [
      { title: 'FastAPI Todo + Postgres', difficulty: 'beginner', estimatedDuration: '1 week', description: 'Typed API with ORM.', deliverables: ['OpenAPI docs'], skillSlugs: ['fastapi', 'postgresql'] },
      { title: 'Django Blog with Auth', difficulty: 'intermediate', estimatedDuration: '2 weeks', description: 'Full-featured blog.', deliverables: ['Admin screenshots'], skillSlugs: ['django', 'authentication-security'] },
      { title: 'Automation Pipeline Service', difficulty: 'advanced', estimatedDuration: '3 weeks', description: 'Celery workers + Redis + monitoring.', deliverables: ['Dashboard'], skillSlugs: ['message-queues', 'docker', 'redis'] },
    ],
    resources: sharedResources([
      { id: 'res-py-docs', title: 'Python Official Docs', type: 'DOCUMENTATION', provider: 'python.org', url: 'https://docs.python.org/3/', difficulty: 'beginner' },
    ]),
  },
  {
    slug: 'mobile-developer', name: 'Mobile Developer', category: 'Mobile',
    description: 'Builds native or cross-platform mobile applications with attention to offline behavior, performance, and platform conventions.',
    responsibilities: ['Implement mobile UIs', 'Integrate APIs', 'Handle offline & lifecycle'],
    marketAliases: ['mobile developer', 'android developer', 'ios developer', 'flutter developer', 'react native developer'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['prog-mobile', 'ui-mobile', 'git-basics'] },
      { id: 'platform', title: 'Platform Track', nodes: ['android-track', 'cross-track'] },
      { id: 'quality', title: 'Quality', nodes: ['mobile-data', 'mobile-testing'] },
      { id: 'advanced', title: 'Advanced', nodes: ['mobile-advanced'] },
    ],
    nodes: [
      { id: 'prog-mobile', title: 'Programming for Mobile', hours: 14, skills: ['problem-solving', 'javascript', 'kotlin', 'dart'], learn: ['Pick a stack', 'Language basics'] },
      { id: 'ui-mobile', title: 'Mobile UI Fundamentals', hours: 12, prereq: ['prog-mobile'], skills: ['ui-design', 'html-css'], learn: ['Layout systems', 'Platform conventions'] },
      { id: 'git-basics', title: 'Git & GitHub', hours: 6, prereq: ['prog-mobile'], skills: ['git', 'github'], learn: ['PR flow'] },
      { id: 'android-track', title: 'Android Development (Kotlin)', hours: 24, prereq: ['ui-mobile'], skills: ['android-sdk', 'kotlin'], learn: ['Activities & fragments', 'Jetpack Compose', 'Lifecycle'] },
      { id: 'cross-track', title: 'Cross-platform (Flutter or React Native)', hours: 20, prereq: ['ui-mobile'], skills: ['flutter', 'react-native', 'react'], learn: ['Widgets/components', 'Navigation', 'Platform channels'] },
      { id: 'mobile-data', title: 'Data, Offline & APIs', hours: 12, prereq: ['android-track', 'cross-track'], skills: ['rest-apis', 'firebase'], learn: ['Local storage', 'Sync strategies', 'Push notifications'] },
      { id: 'mobile-testing', title: 'Mobile Testing & Release', hours: 10, prereq: ['mobile-data'], skills: ['testing', 'ci-cd'], learn: ['Unit & UI tests', 'Store deployment', 'Crash reporting'] },
      { id: 'mobile-advanced', title: 'Advanced Mobile', hours: 12, prereq: ['mobile-testing'], skills: ['system-design'], learn: ['Battery & memory', 'Modularization', 'Deep links'] },
    ],
    projects: [
      { title: 'Weather App', difficulty: 'beginner', estimatedDuration: '1 week', description: 'API-driven single-screen app.', deliverables: ['APK/bundle'], skillSlugs: ['rest-apis'] },
      { title: 'Offline-first Notes App', difficulty: 'intermediate', estimatedDuration: '2–3 weeks', description: 'Local DB + sync.', deliverables: ['Sync tests'], skillSlugs: ['firebase', 'android-sdk'] },
      { title: 'Feature-rich Tracker App', difficulty: 'advanced', estimatedDuration: '4 weeks', description: 'Notifications, background work, analytics.', deliverables: ['Store listing draft'], skillSlugs: ['flutter', 'ci-cd'] },
    ],
    resources: sharedResources([
      { id: 'res-android', title: 'Android Developers Docs', type: 'DOCUMENTATION', provider: 'developer.android.com', url: 'https://developer.android.com', difficulty: 'beginner' },
    ]),
  },
  {
    slug: 'android-developer', name: 'Android Developer', category: 'Mobile',
    description: 'Specializes in native Android applications with Kotlin, Jetpack, and Play Store delivery.',
    responsibilities: ['Build Android features', 'Optimize for devices', 'Ship Play releases'],
    marketAliases: ['android developer', 'android engineer', 'kotlin developer'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['kotlin-core', 'android-start', 'git-basics'] },
      { id: 'android', title: 'Android Core', nodes: ['compose-ui', 'android-arch', 'android-data'] },
      { id: 'quality', title: 'Quality & Release', nodes: ['android-testing', 'android-release'] },
      { id: 'advanced', title: 'Advanced', nodes: ['android-advanced'] },
    ],
    nodes: [
      { id: 'kotlin-core', title: 'Kotlin Language', hours: 16, skills: ['kotlin'], learn: ['Null safety', 'Coroutines', 'Data classes'] },
      { id: 'android-start', title: 'Android Platform Basics', hours: 12, prereq: ['kotlin-core'], skills: ['android-sdk'], learn: ['Activities', 'Manifest', 'Gradle'] },
      { id: 'git-basics', title: 'Git & GitHub', hours: 6, prereq: ['kotlin-core'], skills: ['git'], learn: ['PR flow'] },
      { id: 'compose-ui', title: 'Jetpack Compose UI', hours: 16, prereq: ['android-start'], skills: ['android-sdk', 'ui-design'], learn: ['Composables', 'State hoisting', 'Navigation'] },
      { id: 'android-arch', title: 'Android Architecture', hours: 14, prereq: ['compose-ui'], skills: ['clean-code'], learn: ['ViewModel', 'Repository pattern', 'DI (Hilt)'] },
      { id: 'android-data', title: 'Data: Room, Network, Offline', hours: 12, prereq: ['android-arch'], skills: ['rest-apis', 'sqlite'], learn: ['Room', 'Retrofit', 'WorkManager'] },
      { id: 'android-testing', title: 'Testing Android Apps', hours: 8, prereq: ['android-data'], skills: ['testing'], learn: ['Unit tests', 'Compose UI tests'] },
      { id: 'android-release', title: 'Play Store Release', hours: 6, prereq: ['android-testing'], skills: ['ci-cd'], learn: ['Signing', 'Play Console', 'Crashlytics'] },
      { id: 'android-advanced', title: 'Advanced Android', hours: 10, prereq: ['android-release'], skills: ['system-design'], learn: ['Modularization', 'Performance', 'Baselines profiles'] },
    ],
    projects: [
      { title: 'Compose Demo App', difficulty: 'beginner', estimatedDuration: '1 week', description: 'Multi-screen Compose app.', deliverables: ['Screenshots'], skillSlugs: ['android-sdk'] },
      { title: 'Offline Notes with Room', difficulty: 'intermediate', estimatedDuration: '2 weeks', description: 'Room + ViewModel + tests.', deliverables: ['Test report'], skillSlugs: ['sqlite'] },
      { title: 'Play-store-ready Utility App', difficulty: 'advanced', estimatedDuration: '3–4 weeks', description: 'Billing, settings, CI release.', deliverables: ['Internal test track'], skillSlugs: ['ci-cd'] },
    ],
    resources: sharedResources([
      { id: 'res-android', title: 'Android Developers Docs', type: 'DOCUMENTATION', provider: 'developer.android.com', url: 'https://developer.android.com', difficulty: 'beginner' },
    ]),
  },
  {
    slug: 'devops-engineer', name: 'DevOps Engineer', category: 'Cloud & DevOps',
    description: 'Automates build, deployment and operations so software ships reliably, quickly, and observably.',
    responsibilities: ['Own CI/CD pipelines', 'Manage containers & clusters', 'Instrument monitoring', 'Respond to incidents'],
    marketAliases: ['devops engineer', 'devops', 'platform engineer', 'build engineer'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['linux-core', 'net-core', 'git-basics'] },
      { id: 'automation', title: 'Automation', nodes: ['containers', 'orchestration', 'iac'] },
      { id: 'platform', title: 'Platform', nodes: ['cicd-pipelines', 'cloud-core'] },
      { id: 'advanced', title: 'Advanced', nodes: ['observability', 'sre-practices'] },
    ],
    nodes: [
      { id: 'linux-core', title: 'Linux & Scripting', hours: 14, skills: ['linux', 'bash'], learn: ['Filesystem & permissions', 'systemd', 'Bash scripting'], quiz: [{ q: 'chmod 644 means…', opts: ['Owner rw, group/others r', 'All execute', 'Owner only', 'Nothing'], correct: 0 }] },
      { id: 'net-core', title: 'Networking for DevOps', hours: 10, prereq: ['linux-core'], skills: ['computer-networks', 'nginx'], learn: ['DNS, TLS, proxies', 'Load balancing L4/L7'] },
      { id: 'git-basics', title: 'Git & GitHub', hours: 6, prereq: ['linux-core'], skills: ['git', 'github'], learn: ['Branching', 'Actions basics'] },
      { id: 'containers', title: 'Docker Deep Dive', hours: 14, prereq: ['linux-core'], skills: ['docker'], learn: ['Image best practices', 'Volumes & networking', 'Multi-stage builds'] },
      { id: 'orchestration', title: 'Kubernetes', hours: 20, prereq: ['containers'], skills: ['kubernetes', 'helm'], learn: ['Pods, deployments, services', 'ConfigMaps/secrets', 'Helm charts'] },
      { id: 'iac', title: 'Infrastructure as Code', hours: 12, prereq: ['containers'], skills: ['terraform', 'ansible'], learn: ['Terraform modules', 'State management', 'Ansible playbooks'] },
      { id: 'cicd-pipelines', title: 'CI/CD Engineering', hours: 12, prereq: ['git-basics', 'containers'], skills: ['ci-cd'], learn: ['Pipeline design', 'Artifact management', 'Deploy strategies (blue/green, canary)'] },
      { id: 'cloud-core', title: 'Cloud Platform Core', hours: 14, prereq: ['iac'], skills: ['aws', 'azure', 'gcp'], learn: ['Compute & storage services', 'IAM', 'Networking (VPC)'] },
      { id: 'observability', title: 'Monitoring & Observability', hours: 10, prereq: ['cicd-pipelines'], skills: ['observability', 'prometheus'], learn: ['Metrics, logs, traces', 'Prometheus/Grafana', 'Alert design'] },
      { id: 'sre-practices', title: 'SRE Practices', hours: 12, prereq: ['observability'], skills: ['system-design'], learn: ['SLOs/SLIs/error budgets', 'Incident response', 'Postmortems'] },
    ],
    projects: [
      { title: 'Dockerize an App', difficulty: 'beginner', estimatedDuration: '1 week', description: 'Multi-stage build + compose.', deliverables: ['Dockerfile review checklist'], skillSlugs: ['docker'] },
      { title: 'Full CI/CD Pipeline', difficulty: 'intermediate', estimatedDuration: '2 weeks', description: 'Test → build → deploy to cloud with rollback.', deliverables: ['Pipeline YAML', 'Rollback demo'], skillSlugs: ['ci-cd', 'aws'] },
      { title: 'K8s Platform with Observability', difficulty: 'advanced', estimatedDuration: '4 weeks', description: 'Helm-deployed cluster with monitoring stack.', deliverables: ['Dashboards', 'SLO doc'], skillSlugs: ['kubernetes', 'prometheus', 'terraform'] },
    ],
    resources: sharedResources([
      { id: 'res-k8s', title: 'Kubernetes Official Docs', type: 'DOCUMENTATION', provider: 'kubernetes.io', url: 'https://kubernetes.io/docs/home/', difficulty: 'intermediate' },
    ]),
  },
  {
    slug: 'cloud-engineer', name: 'Cloud Engineer', category: 'Cloud & DevOps',
    description: 'Designs and operates cloud infrastructure: networking, compute, storage, security, and cost.',
    responsibilities: ['Provision cloud infra', 'Secure workloads', 'Optimize cost'],
    marketAliases: ['cloud engineer', 'cloud administrator', 'aws engineer', 'azure engineer'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['linux-core', 'cloud-net', 'git-basics'] },
      { id: 'cloud', title: 'Cloud Core', nodes: ['aws-core', 'storage-db-cloud'] },
      { id: 'automation', title: 'Automation', nodes: ['terraform-cloud', 'containers-cloud'] },
      { id: 'advanced', title: 'Advanced', nodes: ['cloud-security', 'cloud-arch'] },
    ],
    nodes: [
      { id: 'linux-core', title: 'Linux & Scripting', hours: 14, skills: ['linux', 'bash'], learn: ['Admin basics', 'Bash'] },
      { id: 'cloud-net', title: 'Cloud Networking', hours: 12, prereq: ['linux-core'], skills: ['computer-networks'], learn: ['VPC/subnets', 'DNS & routing', 'TLS'] },
      { id: 'git-basics', title: 'Git & GitHub', hours: 6, prereq: ['linux-core'], skills: ['git'], learn: ['PR flow'] },
      { id: 'aws-core', title: 'Core Cloud Services (AWS-first)', hours: 18, prereq: ['cloud-net'], skills: ['aws', 'aws-lambda', 'ec2'], learn: ['EC2/ECS/Lambda', 'S3', 'IAM users & roles'], quiz: [{ q: 'S3 is…', opts: ['Object storage', 'A database', 'A DNS service', 'A container runtime'], correct: 0 }] },
      { id: 'storage-db-cloud', title: 'Cloud Databases & Storage', hours: 12, prereq: ['aws-core'], skills: ['dynamodb', 's3', 'sql'], learn: ['Managed SQL vs NoSQL', 'Backups & snapshots'] },
      { id: 'terraform-cloud', title: 'Terraform for Cloud', hours: 14, prereq: ['aws-core'], skills: ['terraform'], learn: ['Providers & state', 'Modules', 'Environments'] },
      { id: 'containers-cloud', title: 'Containers in Cloud', hours: 12, prereq: ['terraform-cloud'], skills: ['docker', 'kubernetes', 'ci-cd'], learn: ['EKS/ECS', 'Registry', 'Deploy pipelines'] },
      { id: 'cloud-security', title: 'Cloud Security', hours: 12, prereq: ['aws-core'], skills: ['cloud-security', 'authentication-security'], learn: ['IAM least privilege', 'Security groups', 'KMS/encryption'] },
      { id: 'cloud-arch', title: 'Cloud Architecture & Cost', hours: 14, prereq: ['containers-cloud', 'cloud-security'], skills: ['system-design', 'observability'], learn: ['HA & DR patterns', 'Cost optimization', 'Well-architected review'] },
    ],
    projects: [
      { title: 'Static Site on S3 + CloudFront', difficulty: 'beginner', estimatedDuration: 'few days', description: 'CDN-backed static hosting.', deliverables: ['Live URL'], skillSlugs: ['s3'] },
      { title: 'Terraform VPC + EC2 + RDS', difficulty: 'intermediate', estimatedDuration: '2 weeks', description: 'Reusable modules.', deliverables: ['Module docs'], skillSlugs: ['terraform'] },
      { title: 'Multi-env EKS Platform', difficulty: 'advanced', estimatedDuration: '4 weeks', description: 'Staging + prod with CI/CD and budgets.', deliverables: ['Cost report'], skillSlugs: ['kubernetes', 'aws', 'ci-cd'] },
    ],
    resources: sharedResources([
      { id: 'res-aws', title: 'AWS Documentation', type: 'DOCUMENTATION', provider: 'AWS', url: 'https://docs.aws.amazon.com', difficulty: 'beginner' },
    ]),
  },
  {
    slug: 'sre', name: 'Site Reliability Engineer (SRE)', category: 'Cloud & DevOps',
    description: 'Applies software engineering to operations: reliability, capacity, incident response, and error budgets.',
    responsibilities: ['Define SLOs', 'Automate toil away', 'Lead incident response'],
    marketAliases: ['sre', 'site reliability engineer', 'reliability engineer'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['linux-core', 'net-core', 'code-sre'] },
      { id: 'platform', title: 'Platform', nodes: ['containers', 'k8s-sre', 'obs-sre'] },
      { id: 'practice', title: 'SRE Practice', nodes: ['slo-sli', 'incident-mgmt'] },
      { id: 'advanced', title: 'Advanced', nodes: ['capacity-chaos'] },
    ],
    nodes: [
      { id: 'linux-core', title: 'Linux Deep Skills', hours: 16, skills: ['linux', 'bash'], learn: ['Performance tools', 'strace/top/vmstat'] },
      { id: 'net-core', title: 'Networking & DNS', hours: 10, prereq: ['linux-core'], skills: ['computer-networks'], learn: ['TCP tuning', 'DNS debugging'] },
      { id: 'code-sre', title: 'Scripting & Automation', hours: 12, prereq: ['linux-core'], skills: ['python'], learn: ['Python for ops', 'APIs & automation'] },
      { id: 'containers', title: 'Docker', hours: 12, prereq: ['linux-core'], skills: ['docker'], learn: ['Runtime internals', 'Resource limits'] },
      { id: 'k8s-sre', title: 'Kubernetes Operations', hours: 18, prereq: ['containers'], skills: ['kubernetes', 'helm'], learn: ['Probes & quotas', 'Node management', 'Upgrades'] },
      { id: 'obs-sre', title: 'Observability Engineering', hours: 14, prereq: ['k8s-sre'], skills: ['prometheus', 'observability'], learn: ['PromQL', 'Trace analysis', 'Dashboards that answer questions'] },
      { id: 'slo-sli', title: 'SLOs, SLIs & Error Budgets', hours: 10, prereq: ['obs-sre'], skills: ['system-design'], learn: ['Choosing SLIs', 'Budget policy', 'Burn-rate alerts'] },
      { id: 'incident-mgmt', title: 'Incident Management', hours: 10, prereq: ['slo-sli'], skills: ['communication', 'collaboration'], learn: ['Roles (IC, comms)', 'On-call health', 'Blameless postmortems'] },
      { id: 'capacity-chaos', title: 'Capacity, Chaos & Cost', hours: 12, prereq: ['incident-mgmt'], skills: ['system-design', 'ci-cd'], learn: ['Load modeling', 'Chaos experiments', 'Cost/perf trade-offs'] },
    ],
    projects: [
      { title: 'Monitoring Stack for a Demo App', difficulty: 'intermediate', estimatedDuration: '2 weeks', description: 'Prometheus + Grafana + alerts.', deliverables: ['Dashboard JSON', 'Alert rules'], skillSlugs: ['prometheus'] },
      { title: 'Chaos Experiment Suite', difficulty: 'advanced', estimatedDuration: '3 weeks', description: 'Pod kills, latency injection, verify SLOs.', deliverables: ['Experiment reports'], skillSlugs: ['kubernetes', 'system-design'] },
    ],
    resources: sharedResources([
      { id: 'res-sre-book', title: 'Google SRE Book (free online)', type: 'BOOK' as any, provider: 'Google', url: 'https://sre.google/books/', difficulty: 'intermediate' },
    ]),
  },
  {
    slug: 'data-analyst', name: 'Data Analyst', category: 'Data & AI',
    description: 'Turns raw data into decisions with SQL, spreadsheets, visualization, and statistics.',
    responsibilities: ['Write analyses and queries', 'Build dashboards', 'Present insights'],
    marketAliases: ['data analyst', 'business analyst', 'bi analyst', 'analytics'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['sql-analyst', 'excel-sheets', 'stats-core'] },
      { id: 'tools', title: 'Analysis Tools', nodes: ['python-analyst', 'bi-tool'] },
      { id: 'practice', title: 'Practice', nodes: ['viz-storytelling', 'ab-testing'] },
      { id: 'advanced', title: 'Advanced', nodes: ['analyst-advanced'] },
    ],
    nodes: [
      { id: 'sql-analyst', title: 'SQL for Analysis', hours: 16, skills: ['sql', 'dbms'], learn: ['Joins & aggregates', 'Window functions', 'Query performance'], quiz: [{ q: 'A window function…', opts: ['Computes across rows without collapsing them', 'Is a UI feature', 'Only sorts', 'Replaces WHERE'], correct: 0 }] },
      { id: 'excel-sheets', title: 'Excel / Sheets Power Use', hours: 8, skills: ['excel'], learn: ['Pivot tables', 'Lookups', 'Charts'] },
      { id: 'stats-core', title: 'Applied Statistics', hours: 12, prereq: ['sql-analyst'], skills: ['statistics'], learn: ['Descriptive stats', 'Distributions', 'Hypothesis testing'] },
      { id: 'python-analyst', title: 'Python for Analysis', hours: 14, prereq: ['stats-core'], skills: ['python', 'pandas', 'numpy'], learn: ['pandas dataframes', 'Grouping & joins', 'Notebooks'] },
      { id: 'bi-tool', title: 'BI Tool (Power BI or Tableau)', hours: 10, prereq: ['sql-analyst'], skills: ['power-bi', 'tableau'], learn: ['Data models', 'Measures (DAX)', 'Dashboard design'] },
      { id: 'viz-storytelling', title: 'Visualization & Storytelling', hours: 8, prereq: ['bi-tool'], skills: ['data-visualization', 'communication'], learn: ['Chart choice', 'Narrative structure'] },
      { id: 'ab-testing', title: 'A/B Testing in Practice', hours: 8, prereq: ['stats-core'], skills: ['statistics'], learn: ['Experiment design', 'Significance & power', 'Pitfalls'] },
      { id: 'analyst-advanced', title: 'Analytics Engineering Basics', hours: 10, prereq: ['python-analyst', 'bi-tool'], skills: ['etl', 'data-modeling'], learn: ['dbt models', 'Semantic layers', 'Data quality checks'] },
    ],
    projects: [
      { title: 'Sales Dashboard', difficulty: 'beginner', estimatedDuration: '1 week', description: 'Interactive BI dashboard on a public dataset.', deliverables: ['Published dashboard'], skillSlugs: ['power-bi'] },
      { title: 'Cohort Retention Analysis', difficulty: 'intermediate', estimatedDuration: '2 weeks', description: 'SQL + notebook cohort study.', deliverables: ['Findings memo'], skillSlugs: ['sql', 'pandas'] },
      { title: 'End-to-end KPI Pipeline', difficulty: 'advanced', estimatedDuration: '3 weeks', description: 'dbt models + tests + dashboard.', deliverables: ['dbt repo'], skillSlugs: ['etl', 'data-modeling'] },
    ],
    resources: sharedResources([
      { id: 'res-sqlbolt', title: 'SQLBolt — interactive SQL lessons', type: 'PRACTICE', provider: 'sqlbolt.com', url: 'https://sqlbolt.com', difficulty: 'beginner' },
    ]),
  },
  {
    slug: 'data-scientist', name: 'Data Scientist', category: 'Data & AI',
    description: 'Combines statistics, programming, and domain thinking to model problems and extract insight and predictive power from data.',
    responsibilities: ['Frame questions as models', 'Build and evaluate models', 'Communicate findings'],
    marketAliases: ['data scientist', 'data science', 'applied scientist'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['py-ds', 'stats-ds', 'sql-ds'] },
      { id: 'ml', title: 'Machine Learning', nodes: ['ml-core', 'dl-intro'] },
      { id: 'practice', title: 'Practice', nodes: ['feature-eng', 'model-eval'] },
      { id: 'advanced', title: 'Advanced', nodes: ['mlops-ds'] },
    ],
    nodes: [
      { id: 'py-ds', title: 'Python Data Stack', hours: 16, skills: ['python', 'pandas', 'numpy'], learn: ['Vectorized ops', 'Reshaping', 'EDA workflow'] },
      { id: 'stats-ds', title: 'Statistics for Data Science', hours: 14, prereq: ['py-ds'], skills: ['statistics'], learn: ['Probability', 'Estimation', 'Bayesian basics'] },
      { id: 'sql-ds', title: 'SQL for Data Science', hours: 10, prereq: ['py-ds'], skills: ['sql'], learn: ['Complex queries', 'Feature extraction in SQL'] },
      { id: 'ml-core', title: 'Classical Machine Learning', hours: 20, prereq: ['stats-ds'], skills: ['machine-learning', 'scikit-learn'], learn: ['Regression & classification', 'Trees & ensembles', 'Cross-validation'], quiz: [{ q: 'Overfitting means…', opts: ['Great on train, poor on test', 'Great on test only', 'Slow training', 'Small model'], correct: 0 }], interview: ['Explain bias–variance trade-off.'] },
      { id: 'feature-eng', title: 'Feature Engineering', hours: 10, prereq: ['ml-core'], skills: ['machine-learning'], learn: ['Encoding', 'Scaling', 'Leakage risks'] },
      { id: 'model-eval', title: 'Model Evaluation & Metrics', hours: 8, prereq: ['ml-core'], skills: ['statistics'], learn: ['Precision/recall/F1', 'ROC-AUC', 'Calibration'] },
      { id: 'dl-intro', title: 'Deep Learning Introduction', hours: 16, prereq: ['ml-core'], skills: ['deep-learning', 'pytorch', 'tensorflow'], learn: ['Neural nets', 'Training loops', 'Transfer learning'] },
      { id: 'mlops-ds', title: 'From Notebook to Production', hours: 12, prereq: ['model-eval'], skills: ['mlops', 'docker', 'ci-cd'], learn: ['Experiment tracking', 'Model serving', 'Monitoring drift'] },
    ],
    projects: [
      { title: 'Titanic-style Classifier', difficulty: 'beginner', estimatedDuration: '1 week', description: 'End-to-end sklearn baseline.', deliverables: ['Notebook'], skillSlugs: ['scikit-learn'] },
      { title: 'Churn Prediction with Metrics Report', difficulty: 'intermediate', estimatedDuration: '2–3 weeks', description: 'Business-framed model + evaluation.', deliverables: ['Metrics deck'], skillSlugs: ['machine-learning', 'statistics'] },
      { title: 'Deployed ML Service', difficulty: 'advanced', estimatedDuration: '4 weeks', description: 'FastAPI-served model with monitoring.', deliverables: ['Live endpoint', 'Drift dashboard'], skillSlugs: ['mlops', 'fastapi', 'docker'] },
    ],
    resources: sharedResources([
      { id: 'res-sklearn', title: 'scikit-learn User Guide', type: 'DOCUMENTATION', provider: 'scikit-learn.org', url: 'https://scikit-learn.org/stable/user_guide.html', difficulty: 'intermediate' },
    ]),
  },
  {
    slug: 'data-engineer', name: 'Data Engineer', category: 'Data & AI',
    description: 'Builds the pipelines and platforms that move and transform data reliably at scale.',
    responsibilities: ['Build ETL/ELT pipelines', 'Model warehouses', 'Ensure data quality'],
    marketAliases: ['data engineer', 'big data engineer', 'etl developer'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['py-de', 'sql-de', 'git-basics'] },
      { id: 'pipelines', title: 'Pipelines', nodes: ['etl-core', 'orchestration-de'] },
      { id: 'platform', title: 'Platform', nodes: ['warehouse-lake', 'streaming-de'] },
      { id: 'advanced', title: 'Advanced', nodes: ['de-advanced'] },
    ],
    nodes: [
      { id: 'py-de', title: 'Python for Data Engineering', hours: 14, skills: ['python'], learn: ['Batch processing', 'APIs & connectors'] },
      { id: 'sql-de', title: 'Advanced SQL', hours: 14, prereq: ['py-de'], skills: ['sql', 'dbms'], learn: ['Window functions', 'Query optimization', 'DDL design'] },
      { id: 'git-basics', title: 'Git & GitHub', hours: 6, prereq: ['py-de'], skills: ['git'], learn: ['PR flow'] },
      { id: 'etl-core', title: 'ETL/ELT Patterns', hours: 14, prereq: ['sql-de'], skills: ['etl'], learn: ['Batch vs incremental', 'Idempotency', 'Data quality gates'] },
      { id: 'orchestration-de', title: 'Orchestration (Airflow/dbt)', hours: 12, prereq: ['etl-core'], skills: ['airflow', 'dbt'], learn: ['DAGs', 'Sensors & retries', 'dbt models & tests'] },
      { id: 'warehouse-lake', title: 'Warehouses & Lakes', hours: 14, prereq: ['etl-core'], skills: ['snowflake', 'bigquery', 'spark'], learn: ['Columnar storage', 'Partitioning', 'Lakehouse basics'] },
      { id: 'streaming-de', title: 'Streaming Pipelines', hours: 12, prereq: ['warehouse-lake'], skills: ['kafka', 'spark'], learn: ['Topics & partitions', 'Exactly-once semantics'] },
      { id: 'de-advanced', title: 'Platform Engineering for Data', hours: 12, prereq: ['streaming-de'], skills: ['docker', 'ci-cd', 'system-design'], learn: ['Infra for pipelines', 'Catalogs & lineage', 'Cost control'] },
    ],
    projects: [
      { title: 'CSV → Warehouse Pipeline', difficulty: 'beginner', estimatedDuration: '1 week', description: 'Ingest + model + validate.', deliverables: ['dbt repo'], skillSlugs: ['sql', 'etl'] },
      { title: 'Airflow DAG Suite', difficulty: 'intermediate', estimatedDuration: '2 weeks', description: 'Scheduled, retried, observable pipelines.', deliverables: ['DAG docs'], skillSlugs: ['airflow'] },
      { title: 'Streaming Analytics Job', difficulty: 'advanced', estimatedDuration: '3–4 weeks', description: 'Kafka → Spark → sink with monitoring.', deliverables: ['Latency benchmarks'], skillSlugs: ['kafka', 'spark'] },
    ],
    resources: sharedResources(),
  },
  {
    slug: 'ai-engineer', name: 'AI Engineer', category: 'Data & AI',
    description: 'Builds applications on top of modern AI models: LLM apps, RAG systems, agents, and evaluation.',
    responsibilities: ['Integrate LLM APIs', 'Build RAG pipelines', 'Evaluate & guardrail outputs'],
    marketAliases: ['ai engineer', 'genai engineer', 'llm engineer', 'applied ai'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['py-ai', 'api-ai', 'git-basics'] },
      { id: 'llm-core', title: 'LLM Core', nodes: ['prompting', 'rag-core', 'agents-tools'] },
      { id: 'production', title: 'Production AI', nodes: ['eval-guardrails', 'ai-infra'] },
      { id: 'advanced', title: 'Advanced', nodes: ['ai-advanced'] },
    ],
    nodes: [
      { id: 'py-ai', title: 'Python for AI', hours: 12, skills: ['python'], learn: ['Env & deps', 'APIs & async'] },
      { id: 'api-ai', title: 'REST & Backend Basics', hours: 10, prereq: ['py-ai'], skills: ['rest-apis', 'fastapi'], learn: ['Serve endpoints', 'Streaming responses'] },
      { id: 'git-basics', title: 'Git & GitHub', hours: 6, prereq: ['py-ai'], skills: ['git'], learn: ['PR flow'] },
      { id: 'prompting', title: 'Prompt Engineering', hours: 8, prereq: ['py-ai'], skills: ['llm'], learn: ['Instruction design', 'Structured outputs', 'Few-shot & chains'] },
      { id: 'rag-core', title: 'RAG Systems', hours: 16, prereq: ['prompting'], skills: ['llm', 'elasticsearch'], learn: ['Chunking & embedding', 'Vector search', 'Grounding & citations'] },
      { id: 'agents-tools', title: 'Agents & Tool Use', hours: 12, prereq: ['rag-core'], skills: ['langchain', 'llm'], learn: ['Tool/function calling', 'Planning loops', 'Guardrails'] },
      { id: 'eval-guardrails', title: 'Evaluation & Safety', hours: 10, prereq: ['agents-tools'], skills: ['llm'], learn: ['Golden datasets', 'LLM-as-judge caveats', 'Injection defenses'] },
      { id: 'ai-infra', title: 'AI Infrastructure & Cost', hours: 10, prereq: ['eval-guardrails'], skills: ['docker', 'redis', 'ci-cd'], learn: ['Caching & rate limits', 'Vector DB ops', 'Cost per request'] },
      { id: 'ai-advanced', title: 'Fine-tuning & Multimodality', hours: 12, prereq: ['ai-infra'], skills: ['hugging-face', 'deep-learning'], learn: ['When to fine-tune', 'LoRA basics', 'Vision/audio APIs'] },
    ],
    projects: [
      { title: 'Docs Q&A Bot (RAG)', difficulty: 'intermediate', estimatedDuration: '2 weeks', description: 'Grounded answers with citations.', deliverables: ['Eval set + scores'], skillSlugs: ['llm', 'rag'] },
      { title: 'Support Agent with Tools', difficulty: 'advanced', estimatedDuration: '3 weeks', description: 'Tool-calling agent with guardrails.', deliverables: ['Trace logs'], skillSlugs: ['langchain', 'llm'] },
    ],
    resources: sharedResources([
      { id: 'res-gemini-docs', title: 'Gemini API Docs', type: 'DOCUMENTATION', provider: 'Google', url: 'https://ai.google.dev/docs', difficulty: 'beginner' },
    ]),
  },
  {
    slug: 'machine-learning-engineer', name: 'Machine Learning Engineer', category: 'Data & AI',
    description: 'Puts machine learning into production: training pipelines, serving, monitoring, and performance.',
    responsibilities: ['Productionize models', 'Build training pipelines', 'Monitor model health'],
    marketAliases: ['ml engineer', 'machine learning engineer', 'ml developer', 'ml ops'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['py-ml', 'math-ml', 'sql-ml'] },
      { id: 'ml', title: 'ML Engineering', nodes: ['ml-prod', 'dl-prod'] },
      { id: 'serving', title: 'Serving & Ops', nodes: ['serving-ml', 'monitoring-ml'] },
      { id: 'advanced', title: 'Advanced', nodes: ['ml-advanced'] },
    ],
    nodes: [
      { id: 'py-ml', title: 'Python ML Stack', hours: 16, skills: ['python', 'scikit-learn', 'pandas'], learn: ['Pipelines API', 'Model persistence'] },
      { id: 'math-ml', title: 'Math for ML', hours: 14, prereq: ['py-ml'], skills: ['statistics'], learn: ['Linear algebra', 'Calculus intuition', 'Probability'] },
      { id: 'sql-ml', title: 'Data Handling with SQL', hours: 8, prereq: ['py-ml'], skills: ['sql'], learn: ['Feature queries', 'Sampling at scale'] },
      { id: 'ml-prod', title: 'Classical ML at Production Quality', hours: 16, prereq: ['math-ml'], skills: ['machine-learning', 'mlflow'], learn: ['Leakage-proof pipelines', 'Experiment tracking', 'Reproducibility'] },
      { id: 'dl-prod', title: 'Deep Learning Workflows', hours: 18, prereq: ['ml-prod'], skills: ['deep-learning', 'pytorch'], learn: ['Training at scale', 'Checkpointing', 'Mixed precision'] },
      { id: 'serving-ml', title: 'Model Serving', hours: 14, prereq: ['dl-prod'], skills: ['fastapi', 'docker'], learn: ['Batch vs realtime', 'Latency budgets', 'Autoscaling'] },
      { id: 'monitoring-ml', title: 'Model Monitoring & Drift', hours: 10, prereq: ['serving-ml'], skills: ['mlops', 'observability'], learn: ['Drift metrics', 'Retraining triggers', 'Shadow deploys'] },
      { id: 'ml-advanced', title: 'Advanced MLOps', hours: 12, prereq: ['monitoring-ml'], skills: ['kubernetes', 'ci-cd', 'system-design'], learn: ['Feature stores', 'A/B infra', 'GPU cost management'] },
    ],
    projects: [
      { title: 'Reproducible Training Pipeline', difficulty: 'intermediate', estimatedDuration: '2 weeks', description: 'Tracked, tested, containerized.', deliverables: ['MLflow runs'], skillSlugs: ['mlflow', 'docker'] },
      { title: 'Low-latency Model API', difficulty: 'advanced', estimatedDuration: '3 weeks', description: 'Served with perf benchmarks.', deliverables: ['p99 latency report'], skillSlugs: ['fastapi', 'pytorch'] },
    ],
    resources: sharedResources(),
  },
  {
    slug: 'cybersecurity-analyst', name: 'Cybersecurity Analyst', category: 'Security',
    description: 'Defends systems by monitoring, investigating, and responding to security threats, and hardening infrastructure.',
    responsibilities: ['Monitor SOC alerts', 'Investigate incidents', 'Harden systems', 'Run vulnerability scans'],
    marketAliases: ['cybersecurity analyst', 'security analyst', 'soc analyst', 'information security'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['net-sec-basics', 'os-security', 'linux-sec'] },
      { id: 'defense', title: 'Defensive Core', nodes: ['siem-ops', 'vuln-mgmt'] },
      { id: 'offense', title: 'Offense-informed Defense', nodes: ['pentest-basics', 'appsec-core'] },
      { id: 'advanced', title: 'Advanced', nodes: ['ir-forensics'] },
    ],
    nodes: [
      { id: 'net-sec-basics', title: 'Networking & Security Basics', hours: 14, skills: ['computer-networks', 'network-security'], learn: ['Protocols & ports', 'Firewalls & IDS', 'Common attacks'] },
      { id: 'os-security', title: 'OS & Security Concepts', hours: 12, prereq: ['net-sec-basics'], skills: ['operating-systems', 'cryptography'], learn: ['Auth mechanisms', 'Crypto basics', 'Permissions'] },
      { id: 'linux-sec', title: 'Linux for Security', hours: 10, prereq: ['os-security'], skills: ['linux', 'bash'], learn: ['Logs & auditd', 'Hardening basics'] },
      { id: 'siem-ops', title: 'SIEM & SOC Operations', hours: 14, prereq: ['linux-sec'], skills: ['siem', 'splunk'], learn: ['Alert triage', 'Correlation rules', 'Case notes'] },
      { id: 'vuln-mgmt', title: 'Vulnerability Management', hours: 10, prereq: ['siem-ops'], skills: ['appsec'], learn: ['Scanning (CVSS)', 'Prioritization', 'Remediation tracking'] },
      { id: 'pentest-basics', title: 'Penetration Testing Basics', hours: 12, prereq: ['vuln-mgmt'], skills: ['appsec', 'burp-suite', 'nmap'], learn: ['Recon', 'Web exploitation basics', 'Reporting'] },
      { id: 'appsec-core', title: 'Application Security (OWASP)', hours: 12, prereq: ['pentest-basics'], skills: ['appsec', 'authentication-security'], learn: ['OWASP Top 10', 'Secure code review', 'Dependency risk'] },
      { id: 'ir-forensics', title: 'Incident Response & Forensics', hours: 14, prereq: ['appsec-core'], skills: ['siem', 'network-security'], learn: ['IR lifecycle', 'Evidence handling', 'Malware triage basics'] },
    ],
    projects: [
      { title: 'Home SOC Lab', difficulty: 'intermediate', estimatedDuration: '2 weeks', description: 'SIEM + sample attacks + detections.', deliverables: ['Detection rules'], skillSlugs: ['siem'] },
      { title: 'Vulnerability Assessment Report', difficulty: 'advanced', estimatedDuration: '3 weeks', description: 'Full scan, prioritize, remediation plan.', deliverables: ['Executive report'], skillSlugs: ['appsec', 'nmap'] },
    ],
    resources: sharedResources([
      { id: 'res-owasp', title: 'OWASP Top 10', type: 'DOCUMENTATION', provider: 'OWASP', url: 'https://owasp.org/www-project-top-ten/', difficulty: 'beginner' },
    ]),
  },
  {
    slug: 'qa-engineer', name: 'QA Engineer / SDET', category: 'Quality & Testing',
    description: 'Guards product quality through test strategy, automation frameworks, and shift-left practices.',
    responsibilities: ['Design test plans', 'Build automation suites', 'Integrate tests into CI'],
    marketAliases: ['qa engineer', 'sdet', 'test engineer', 'automation tester', 'quality assurance'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['qa-basics', 'prog-qa', 'git-basics'] },
      { id: 'automation', title: 'Test Automation', nodes: ['api-testing', 'ui-automation'] },
      { id: 'framework', title: 'Framework Engineering', nodes: ['test-frameworks', 'ci-testing'] },
      { id: 'advanced', title: 'Advanced', nodes: ['perf-testing', 'qa-strategy'] },
    ],
    nodes: [
      { id: 'qa-basics', title: 'Testing Fundamentals', hours: 10, skills: ['testing'], learn: ['Test design techniques', 'Bug life cycle', 'Smoke vs regression'], quiz: [{ q: 'Regression tests verify…', opts: ['Old features still work', 'New features only', 'Performance', 'Security only'], correct: 0 }] },
      { id: 'prog-qa', title: 'Programming for Testers', hours: 12, prereq: ['qa-basics'], skills: ['javascript', 'python', 'java'], learn: ['Pick a language', 'Basic DS & scripting'] },
      { id: 'git-basics', title: 'Git & GitHub', hours: 6, prereq: ['prog-qa'], skills: ['git'], learn: ['PR flow'] },
      { id: 'api-testing', title: 'API Test Automation', hours: 12, prereq: ['prog-qa'], skills: ['rest-apis', 'postman', 'pytest'], learn: ['Request/assertion patterns', 'Contract testing', 'Mocking'] },
      { id: 'ui-automation', title: 'UI Automation (Selenium/Playwright)', hours: 14, prereq: ['api-testing'], skills: ['selenium', 'playwright', 'cypress'], learn: ['Locators', 'Waits & flakiness', 'Page object model'] },
      { id: 'test-frameworks', title: 'Framework Design', hours: 12, prereq: ['ui-automation'], skills: ['clean-code'], learn: ['Reporting', 'Parallelization', 'Data-driven tests'] },
      { id: 'ci-testing', title: 'CI Integration', hours: 8, prereq: ['test-frameworks'], skills: ['ci-cd'], learn: ['Triggers & gates', 'Flaky test policy', 'Artifacts'] },
      { id: 'perf-testing', title: 'Performance Testing Basics', hours: 10, prereq: ['ci-testing'], skills: ['system-design'], learn: ['Load profiles', 'Bottlenecks', 'k6/JMeter'] },
      { id: 'qa-strategy', title: 'Test Strategy & Shift-left', hours: 8, prereq: ['perf-testing'], skills: ['communication', 'agile'], learn: ['Risk-based testing', 'Definition of done', 'Quality advocacy'] },
    ],
    projects: [
      { title: 'API Test Suite', difficulty: 'beginner', estimatedDuration: '1 week', description: 'Automated API checks with CI.', deliverables: ['HTML report'], skillSlugs: ['pytest', 'rest-apis'] },
      { title: 'Playwright E2E Framework', difficulty: 'intermediate', estimatedDuration: '2–3 weeks', description: 'POM + parallel + reporting.', deliverables: ['Framework repo'], skillSlugs: ['playwright'] },
      { title: 'Performance Test Plan & Runs', difficulty: 'advanced', estimatedDuration: '2 weeks', description: 'Load model, execute, analyze.', deliverables: ['Findings deck'], skillSlugs: ['system-design'] },
    ],
    resources: sharedResources([
      { id: 'res-playwright', title: 'Playwright Docs', type: 'DOCUMENTATION', provider: 'Microsoft', url: 'https://playwright.dev/docs/intro', difficulty: 'beginner' },
    ]),
  },
  {
    slug: 'uiux-engineer', name: 'UI/UX Engineer', category: 'Design',
    description: 'Bridges design and engineering: research-informed interfaces, design systems, and production-quality UI code.',
    responsibilities: ['Design & prototype flows', 'Build component libraries', 'Run usability checks'],
    marketAliases: ['ui ux designer', 'product designer', 'ux engineer', 'design engineer'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['design-basics', 'ux-research-core', 'html-css-uiux'] },
      { id: 'craft', title: 'Craft', nodes: ['figma-core', 'design-systems'] },
      { id: 'build', title: 'Build', nodes: ['frontend-for-designers', 'accessibility-deep'] },
      { id: 'advanced', title: 'Advanced', nodes: ['ux-advanced'] },
    ],
    nodes: [
      { id: 'design-basics', title: 'Visual Design Fundamentals', hours: 10, skills: ['ui-design'], learn: ['Typography', 'Color systems', 'Layout & spacing'] },
      { id: 'ux-research-core', title: 'UX Research Methods', hours: 10, prereq: ['design-basics'], skills: ['ux-research'], learn: ['Interviews', 'Usability testing', 'Personas & journeys'] },
      { id: 'html-css-uiux', title: 'HTML/CSS for Designers', hours: 10, prereq: ['design-basics'], skills: ['html-css'], learn: ['How browsers render', 'Responsive behavior'] },
      { id: 'figma-core', title: 'Figma Mastery', hours: 8, prereq: ['design-basics'], skills: ['figma'], learn: ['Auto layout', 'Components & variants', 'Prototyping'] },
      { id: 'design-systems', title: 'Design Systems', hours: 12, prereq: ['figma-core'], skills: ['ui-design'], learn: ['Tokens', 'Component APIs', 'Documentation'] },
      { id: 'frontend-for-designers', title: 'Frontend Implementation', hours: 14, prereq: ['html-css-uiux', 'design-systems'], skills: ['react', 'tailwind'], learn: ['Component code', 'State basics', 'Handoff precision'] },
      { id: 'accessibility-deep', title: 'Accessibility (WCAG)', hours: 10, prereq: ['frontend-for-designers'], skills: ['accessibility'], learn: ['Semantics', 'Keyboard & screen readers', 'Contrast & motion'] },
      { id: 'ux-advanced', title: 'Product & Interaction Design', hours: 10, prereq: ['accessibility-deep'], skills: ['communication'], learn: ['Metrics-informed design', 'Experimentation', 'Storytelling'] },
    ],
    projects: [
      { title: 'App Redesign Case Study', difficulty: 'beginner', estimatedDuration: '1–2 weeks', description: 'Research → wireframes → hi-fi.', deliverables: ['Case study page'], skillSlugs: ['ux-research', 'figma'] },
      { title: 'Component Library in Figma + Code', difficulty: 'advanced', estimatedDuration: '3 weeks', description: 'Tokens synced to React components.', deliverables: ['Storybook'], skillSlugs: ['design-systems', 'react'] },
    ],
    resources: sharedResources([
      { id: 'res-figma', title: 'Figma Learn', type: 'DOCUMENTATION', provider: 'Figma', url: 'https://help.figma.com/hc/en-us/categories/360002051613', difficulty: 'beginner' },
    ]),
  },
  {
    slug: 'database-engineer', name: 'Database Engineer', category: 'Software Development',
    description: 'Owns database design, performance, reliability, and data integrity across environments.',
    responsibilities: ['Design schemas', 'Tune performance', 'Manage replication/backup'],
    marketAliases: ['database engineer', 'database administrator', 'dba', 'database developer'],
    stages: [
      { id: 'foundations', title: 'Foundations', nodes: ['rdbms-core', 'sql-advanced', 'os-db'] },
      { id: 'engines', title: 'Engines', nodes: ['postgres-deep', 'nosql-db'] },
      { id: 'operations', title: 'Operations', nodes: ['db-performance', 'db-ops'] },
      { id: 'advanced', title: 'Advanced', nodes: ['db-architecture'] },
    ],
    nodes: [
      { id: 'rdbms-core', title: 'Relational Model & SQL', hours: 16, skills: ['dbms', 'sql'], learn: ['Normalization', 'Constraints', 'Transactions & ACID'] },
      { id: 'sql-advanced', title: 'Advanced SQL', hours: 14, prereq: ['rdbms-core'], skills: ['sql'], learn: ['Window functions', 'CTEs', 'Query plans'] },
      { id: 'os-db', title: 'OS & Storage Basics', hours: 10, prereq: ['rdbms-core'], skills: ['operating-systems', 'linux'], learn: ['Filesystems & IO', 'Memory & caches'] },
      { id: 'postgres-deep', title: 'PostgreSQL Internals', hours: 16, prereq: ['sql-advanced'], skills: ['postgresql'], learn: ['MVCC', 'Indexes (B-tree/GIN)', 'VACUUM'] },
      { id: 'nosql-db', title: 'NoSQL Engines', hours: 12, prereq: ['rdbms-core'], skills: ['mongodb', 'redis', 'cassandra'], learn: ['Document & KV models', 'Consistency trade-offs'] },
      { id: 'db-performance', title: 'Performance Tuning', hours: 14, prereq: ['postgres-deep'], skills: ['db-performance' as any], learn: ['EXPLAIN analysis', 'Index strategy', 'Connection pooling'] },
      { id: 'db-ops', title: 'Backup, Replication & HA', hours: 12, prereq: ['db-performance'], skills: ['linux', 'ci-cd'], learn: ['PITR', 'Streaming replication', 'Failover'] },
      { id: 'db-architecture', title: 'Data Architecture at Scale', hours: 14, prereq: ['db-ops'], skills: ['system-design', 'data-modeling'], learn: ['Sharding', 'Read replicas', 'Polyglot persistence'] },
    ],
    projects: [
      { title: 'Schema Design Portfolio', difficulty: 'beginner', estimatedDuration: '1 week', description: '3 domains with ERDs + rationale.', deliverables: ['ERD docs'], skillSlugs: ['dbms'] },
      { title: 'Query Tuning Case Study', difficulty: 'intermediate', estimatedDuration: '2 weeks', description: 'Slow query → optimized, documented.', deliverables: ['Before/after plans'], skillSlugs: ['postgresql'] },
      { title: 'HA Postgres Cluster', difficulty: 'advanced', estimatedDuration: '3 weeks', description: 'Replication + failover + backup restore drill.', deliverables: ['Runbook'], skillSlugs: ['db-ops' as any, 'linux'] },
    ],
    resources: sharedResources([
      { id: 'res-pg', title: 'PostgreSQL Documentation', type: 'DOCUMENTATION', provider: 'postgresql.org', url: 'https://www.postgresql.org/docs/', difficulty: 'intermediate' },
    ]),
  },
];

export function buildRoleDoc(spec: RoleSpec) {
  return {
    slug: spec.slug,
    name: spec.name,
    description: spec.description,
    category: spec.category,
    responsibilities: spec.responsibilities || [],
    skills: skillFromSpecs(spec),
    roadmapStages: stagesFromSpecs(spec),
    roadmapNodes: nodesFromSpecs(spec),
    resources: spec.resources || [],
    projects: spec.projects || [],
    marketAliases: spec.marketAliases || [spec.name.toLowerCase()],
    experienceExpectations: spec.experienceExpectations,
    portfolioExpectations: spec.portfolioExpectations,
    isActive: true,
    lastReviewedAt: new Date(),
  };
}

export const DEFAULT_RESOURCES: ILearningResource[] = sharedResources();
