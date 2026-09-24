import mongoose from 'mongoose';
import 'dotenv/config';
import { Course } from '../models/Course';
import { ensureDnsFallback, forcePublicDns } from '../../utils/dnsFallback';

/**
 * AETHER Career Learning — course seeder.
 * Usage: npx ts-node src/career/seed/seedCourses.ts
 * Idempotent: upserts by slug. All content is ORIGINAL AETHER content
 * (no copyrighted course copies); external links point to official docs.
 */

const REST_MODULES = [
  {
    id: 'rest-http-fundamentals',
    title: 'HTTP Fundamentals',
    description: 'The protocol every REST API speaks.',
    order: 1,
    lessons: [
      {
        id: 'rest-http-verbs',
        title: 'Methods, Status Codes & Stateless Requests',
        estimatedMinutes: 20,
        order: 1,
        content: `## What HTTP does
HTTP is a stateless request/response protocol. A client sends a request with a **method**, a **path**, optional **headers**, and an optional **body**. The server replies with a **status code** and a body. Because requests are stateless, any state the API needs must arrive with each request (credentials, parameters) or live in a shared store.

## Methods you will actually use
- **GET** — read a resource. Safe and idempotent: repeating it must not change state.
- **POST** — create a resource or trigger a process. Not idempotent.
- **PUT** — replace a resource entirely. Idempotent.
- **PATCH** — partially update a resource.
- **DELETE** — remove a resource. Idempotent.

## Status code families
- **2xx** success: 200 OK, 201 Created (return it after a POST that creates), 204 No Content (successful DELETE).
- **4xx** the client made a mistake: 400 validation failed, 401 not authenticated, 403 authenticated but not allowed, 404 not found, 409 conflict, 429 too many requests.
- **5xx** the server failed: 500 unexpected error, 502/503 upstream or unavailable.

## Why statelessness matters for design
Because no session lives on the server, horizontal scaling becomes straightforward — any instance can answer any request. The cost: every request must carry what it needs (that is why tokens like JWT exist).

## Official documentation
- MDN HTTP overview: https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview
- RFC 9110 (HTTP semantics): https://httpwg.org/specs/rfc9110.html`,
        codeExamples: [
          {
            language: 'http',
            caption: 'A minimal POST request that creates a task',
            code: `POST /api/tasks HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer <token>

{"title": "Write API tests", "priority": "high"}`,
          },
        ],
        resources: [
          { title: 'MDN HTTP Overview', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview', provider: 'MDN', type: 'DOCUMENTATION' },
          { title: 'HTTP Status Codes', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status', provider: 'MDN', type: 'DOCUMENTATION' },
        ],
        exercises: [
          {
            prompt: 'Your DELETE endpoint returns 200 with the deleted object, but your team standard is 204. What changes?',
            hint: 'Think about the body of a 204 response.',
            expectedKeywords: ['204', 'no content', 'body'],
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'rest-q1',
        question: 'Which method should a "create task" endpoint use, and which status code should it return on success?',
        options: [
          'POST, 201 Created',
          'PUT, 200 OK',
          'GET, 204 No Content',
          'POST, 200 OK only',
        ],
        correctIndex: 0,
        explanation: 'POST creates resources; the standard success status for creation is 201 with a Location or representation of the new resource.',
        topicTag: 'http-methods',
      },
      {
        id: 'rest-q2',
        question: 'Which status code means "authenticated, but not allowed to perform this action"?',
        options: ['401 Unauthorized', '403 Forbidden', '400 Bad Request', '409 Conflict'],
        correctIndex: 1,
        explanation: '401 = who are you (authentication failed/missing). 403 = I know who you are, but you lack permission.',
        topicTag: 'http-status',
      },
    ],
    project: {
      title: 'HTTP Contract Sheet',
      description: 'Design the full HTTP contract (paths, methods, request/response bodies, status codes) for a task-management API with tasks and users.',
      deliverables: ['Endpoint table with methods and paths', 'Request/response examples per endpoint', 'Status code decisions with one-line justifications'],
      skillsDemonstrated: ['REST', 'API Design'],
    },
  },
  {
    id: 'rest-express-routing',
    title: 'Express Routing & Validation',
    description: 'Structure a Node/Express API the way real teams do.',
    order: 2,
    lessons: [
      {
        id: 'rest-express-router',
        title: 'Routers, Middleware Chains & Input Validation',
        estimatedMinutes: 25,
        order: 1,
        content: `## Routers keep APIs sane
An Express \`Router\` groups routes under a common path. A production app separates routers per resource (\`/tasks\`, \`/users\`) instead of one giant file. Each router can carry its own middleware chain: authenticate → validate → handle.

## Middleware is a pipeline
Every request flows through middleware in order. Each handler either ends the response or calls \`next()\`. Authentication, rate limiting, validation, and error handling are all middleware — keeping them separate makes each testable.

## Validate every input at the boundary
Never trust \`req.body\`. Validate types, required fields, lengths, and formats before handlers run. In the AETHER codebase, \`express-validator\` chains (like \`body('email').isEmail()\`) do this declaratively; unvalidated fields are rejected with 400 before business logic executes.

## Error handling middleware
A final error-handling middleware (\`(err, req, res, next)\`) turns thrown errors into consistent JSON responses, so clients always receive the same error shape.

## Official documentation
- Express routing guide: https://expressjs.com/en/guide/routing.html
- express-validator: https://express-validator.github.io/docs/`,
        codeExamples: [
          {
            language: 'javascript',
            caption: 'A resource router with validation middleware',
            code: `const router = require('express').Router();

router.post(
  '/tasks',
  authenticateToken,                 // 401 when missing/invalid token
  body('title').isString().isLength({ min: 1, max: 200 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    // ... create the task
    res.status(201).json({ success: true, data: task });
  }
);`,
          },
        ],
        resources: [
          { title: 'Express Routing', url: 'https://expressjs.com/en/guide/routing.html', provider: 'Express', type: 'DOCUMENTATION' },
          { title: 'express-validator Docs', url: 'https://express-validator.github.io/docs/', provider: 'express-validator', type: 'DOCUMENTATION' },
        ],
        exercises: [
          {
            prompt: 'Why should validation middleware run before the business-logic handler rather than inside it?',
            hint: 'Think separation of concerns and reuse across routes.',
            expectedKeywords: ['boundary', 'reuse', 'consistency'],
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'rest-q3',
        question: 'What is the correct order of middleware for a POST endpoint that requires login?',
        options: [
          'authenticate → validate → handler',
          'validate → authenticate → handler',
          'handler → validate → authenticate',
          'validate → handler → error handler',
        ],
        correctIndex: 0,
        explanation: 'Authenticate first so unauthenticated requests never reach validation or business logic; validation runs before the handler touches untrusted input.',
        topicTag: 'express-middleware',
      },
    ],
    project: null,
  },
  {
    id: 'rest-auth-security',
    title: 'Authentication & Error Handling',
    description: 'JWT auth, refresh flows and consistent failure responses.',
    order: 3,
    lessons: [
      {
        id: 'rest-auth-jwt',
        title: 'JWTs, Refresh Tokens & Error Contracts',
        estimatedMinutes: 30,
        order: 1,
        content: `## Statelessness meets authentication
Because HTTP is stateless, credentials must travel with every request. JWTs encode signed claims; the server verifies the signature and never needs a session store. Short-lived access tokens (minutes) limit the blast radius of a leak; long-lived refresh tokens let clients silently re-authenticate.

## What belongs in a token
Identity claims (user id, role) and expiry — never secrets, never passwords. The AETHER codebase separates \`auth.role\` from subscription \`plan\` precisely so authorization checks cannot be spoofed by plan changes.

## Consistent error contracts
Clients should never guess. Every failure returns the same JSON shape (\`{ success: false, message, details? }\`) with an accurate status code. Validation errors list per-field messages; auth errors return 401/403 without revealing whether the username or password was wrong.

## Rate limiting as abuse protection
Public endpoints get rate limits per IP; authenticated ones per user. A login route always applies a stricter limiter because it is a credential-guessing target.

## Official documentation
- JWT standard: https://datatracker.ietf.org/doc/html/rfc7519
- Express error handling: https://expressjs.com/en/guide/error-handling.html`,
        codeExamples: [
          {
            language: 'javascript',
            caption: 'Authorization middleware verifying role claims',
            code: `function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.auth?.role !== role) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  };
}`,
          },
        ],
        resources: [
          { title: 'RFC 7519 — JWT', url: 'https://datatracker.ietf.org/doc/html/rfc7519', provider: 'IETF', type: 'DOCUMENTATION' },
          { title: 'Express Error Handling', url: 'https://expressjs.com/en/guide/error-handling.html', provider: 'Express', type: 'DOCUMENTATION' },
        ],
        exercises: [
          {
            prompt: 'A teammate stores the user plan inside the JWT and checks role against it. What is the risk?',
            hint: 'What happens when a subscription changes before the token expires?',
            expectedKeywords: ['stale', 'role', 'authorization'],
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'rest-q4',
        question: 'Why pair short-lived access tokens with refresh tokens?',
        options: [
          'A leaked access token expires quickly, limiting damage, while users avoid frequent logins',
          'Refresh tokens are faster to verify',
          'Access tokens cannot carry roles',
          'It avoids the need for HTTPS',
        ],
        correctIndex: 0,
        explanation: 'Short access-token lifetime limits the window of abuse; refresh tokens restore convenience. This is the standard trade-off.',
        topicTag: 'auth-tokens',
      },
    ],
    project: {
      title: 'Task Management REST API',
      description: 'Build a complete CRUD task API with JWT authentication, input validation, consistent error responses and tests.',
      deliverables: ['CRUD endpoints for tasks', 'Register/login with JWT + refresh', 'Validation on every input', 'Automated tests for happy and failure paths'],
      skillsDemonstrated: ['REST', 'Express', 'Authentication', 'Validation'],
    },
  },
];

const DB_MODULES = [
  {
    id: 'db-indexing-fundamentals',
    title: 'Database Indexing Fundamentals',
    description: 'Why queries get slow and how indexes fix them.',
    order: 1,
    lessons: [
      {
        id: 'db-index-btree',
        title: 'B-Trees, Selectivity & Composite Indexes',
        estimatedMinutes: 25,
        order: 1,
        content: `## The problem indexes solve
Without an index, a query must scan every row (a full table scan). An index is a sorted structure — usually a **B-tree** — that turns a lookup from O(n) into roughly O(log n).

## Selectivity decides usefulness
An index on a column with many distinct values (e.g. \`email\`) filters aggressively; an index on a boolean column rarely helps because almost half the rows match either value.

## Composite index ordering
For a query \`WHERE user_id = ? AND created_at > ?\`, the composite index \`(user_id, created_at)\` works because equality columns come first and range columns after. An index ordered the other way cannot serve the equality filter efficiently.

## The cost side
Indexes accelerate reads but slow writes and consume storage. Every INSERT/UPDATE must maintain each index. Index the fields your real queries filter and sort on — measured with \`EXPLAIN\` — not every field "just in case".

## Official documentation
- MongoDB indexes: https://www.mongodb.com/docs/manual/indexes/
- PostgreSQL indexing: https://www.postgresql.org/docs/current/indexes.html`,
        codeExamples: [
          {
            language: 'javascript',
            caption: 'Compound index matching a real query pattern',
            code: `// Query: Task.find({ userId, status: 'open' }).sort({ createdAt: -1 })
taskSchema.index({ userId: 1, status: 1, createdAt: -1 });
// Equality fields first (userId, status), sort field last (createdAt)`,
          },
        ],
        resources: [
          { title: 'MongoDB Index Strategies', url: 'https://www.mongodb.com/docs/manual/indexes/', provider: 'MongoDB', type: 'DOCUMENTATION' },
          { title: 'PostgreSQL Indexes', url: 'https://www.postgresql.org/docs/current/indexes.html', provider: 'PostgreSQL', type: 'DOCUMENTATION' },
        ],
        exercises: [
          {
            prompt: 'A query filters by is_active (true/false) and is slow. Why might an index not help here?',
            hint: 'How many rows match is_active = true when half the table is active?',
            expectedKeywords: ['selectivity', 'cardinality'],
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'db-q1',
        question: 'For the query WHERE user_id = 7 AND status = "open" ORDER BY created_at DESC, which index serves it best?',
        options: [
          '(user_id, status, created_at)',
          '(created_at, user_id, status)',
          '(status) alone',
          '(created_at) alone',
        ],
        correctIndex: 0,
        explanation: 'Equality fields first (user_id, status), then the sort field (created_at) — the index order lets the engine both filter and read rows in sort order.',
        topicTag: 'composite-index',
      },
      {
        id: 'db-q2',
        question: 'What is the main downside of adding many indexes to a write-heavy collection?',
        options: [
          'Every write must update every index, slowing inserts and updates',
          'Reads become slower',
          'Indexes prevent backups',
          'It is free — there is no downside',
        ],
        correctIndex: 0,
        explanation: 'Index maintenance happens on every write, so write latency and storage grow with each additional index.',
        topicTag: 'index-cost',
      },
    ],
    project: {
      title: 'Slow Query Autopsy',
      description: 'Take a slow real-world query (provided or from your own project), run EXPLAIN before and after adding the right index, and document the measurements.',
      deliverables: ['EXPLAIN output before', 'Index added with justification', 'EXPLAIN output after + timing comparison'],
      skillsDemonstrated: ['DBMS', 'Indexing', 'Query Optimization'],
    },
  },
];

const DOCKER_LESSONS = [
  {
    id: 'docker-images-containers',
    title: 'Images, Containers & the Dockerfile',
    estimatedMinutes: 25,
    order: 1,
    content: `## Images are blueprints, containers are instances
A Docker image packages your application with its runtime and dependencies into an immutable file system. A container is a running instance of that image, isolated from other processes on the host.

## The Dockerfile is a build recipe
Each instruction creates a layer. Layers are cached, so the order matters: put rarely-changing steps (installing dependencies) before frequently-changing ones (copying source code). This is why you copy \`package.json\` and install **before** copying the rest of the source — a code change then reuses the dependency layer.

## Containers stay small
Multi-stage builds let a heavy build stage (compilers, dev dependencies) produce an artifact that a slim runtime stage copies. The final image ships only what is needed to run.

## Official documentation
- Dockerfile reference: https://docs.docker.com/reference/dockerfile/
- Multi-stage builds: https://docs.docker.com/build/building/multi-stage/`,
    codeExamples: [
      {
        language: 'dockerfile',
        caption: 'Layer-ordered Node image',
        code: `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./    # rarely-changing layer first
RUN npm ci --omit=dev
COPY . .                 # source changes don't bust the dependency cache
CMD ["node", "dist/server.js"]`,
      },
    ],
    resources: [
      { title: 'Dockerfile Reference', url: 'https://docs.docker.com/reference/dockerfile/', provider: 'Docker', type: 'DOCUMENTATION' },
      { title: 'Multi-stage Builds', url: 'https://docs.docker.com/build/building/multi-stage/', provider: 'Docker', type: 'DOCUMENTATION' },
    ],
    exercises: [
      {
        prompt: 'Your image rebuilds npm install on every code change. Which Dockerfile line order fixes it?',
        hint: 'Which lines change most often?',
        expectedKeywords: ['package.json', 'copy', 'order'],
      },
    ],
  },
];

const COURSES = [
  {
    title: 'REST API Development',
    slug: 'rest-api-development',
    description: 'Design, build and secure production REST APIs: HTTP semantics, Express routing and validation, JWT authentication, and testing.',
    roleSlugs: ['backend-developer', 'full-stack-developer'],
    skillSlugs: ['REST', 'Express', 'Authentication', 'API Design', 'Node.js'],
    difficulty: 'intermediate',
    estimatedHours: 8,
    prerequisites: [],
    modules: REST_MODULES,
  },
  {
    title: 'Database Indexing & Query Performance',
    slug: 'database-indexing-query-performance',
    description: 'Make queries fast on purpose: B-tree indexes, composite index ordering, selectivity, and measuring with real query plans.',
    roleSlugs: ['backend-developer', 'data-analyst'],
    skillSlugs: ['DBMS', 'MongoDB', 'SQL', 'Indexing'],
    difficulty: 'beginner',
    estimatedHours: 5,
    prerequisites: [],
    modules: DB_MODULES,
  },
  {
    title: 'Docker Fundamentals',
    slug: 'docker-fundamentals',
    description: 'Ship software reproducibly: images, layers, Dockerfiles and multi-stage builds for real applications.',
    roleSlugs: ['backend-developer', 'devops-engineer', 'full-stack-developer'],
    skillSlugs: ['Docker', 'CI/CD'],
    difficulty: 'beginner',
    estimatedHours: 4,
    prerequisites: [],
    modules: [
      {
        id: 'docker-basics',
        title: 'Docker Basics',
        description: 'Images, layers and your first Dockerfile.',
        order: 1,
        lessons: DOCKER_LESSONS,
        quiz: [
          {
            id: 'docker-q1',
            question: 'Why does copying package.json and running npm install before copying the rest of the source speed up builds?',
            options: [
              'Docker caches layers — source changes then reuse the dependency layer',
              'npm install is faster on smaller files',
              'Docker requires this order or it errors',
              'It compresses the final image',
            ],
            correctIndex: 0,
            explanation: 'Each Dockerfile instruction forms a cached layer; reordering so stable steps come first avoids invalidating the dependency layer on every code change.',
            topicTag: 'docker-layers',
          },
        ],
        project: {
          title: 'Containerize the Task API',
          description: 'Write a production-shaped Dockerfile for the REST API you built, using multi-stage build and a non-root user.',
          deliverables: ['Dockerfile with ordered layers', '.dockerignore', 'Image builds and runs the API'],
          skillsDemonstrated: ['Docker'],
        },
      },
    ],
  },
];

async function seed(): Promise<void> {
  await ensureDnsFallback();
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI not set — cannot seed courses');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  } catch {
    console.warn('Connection failed — retrying with public DNS resolvers...');
    forcePublicDns();
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  }

  for (const c of COURSES) {
    await Course.updateOne({ slug: c.slug }, { $set: { ...c, status: 'published' } }, { upsert: true });
    console.log(`✓ course: ${c.slug}`);
  }
  await mongoose.disconnect();
  console.log('Course seeding complete.');
}

seed().catch(err => {
  console.error('Course seeding failed:', err);
  process.exit(1);
});
