import type { SeedTopic } from './types';

/** Web frameworks, backend runtime, API design and architecture. */
export const TOPICS_PART4: SeedTopic[] = [
  {
    slug: 'react',
    title: 'React',
    shortDescription: 'Component-based UI library with hooks, props/state and a virtual DOM.',
    description:
      'React models a user interface as a tree of components that return JSX. State lives in components, data flows down through props, and React re-renders the parts that changed. This topic covers components, props, state, hooks (useState, useEffect, useMemo), lists and keys, and how state management scales past a single component.',
    whyItMatters:
      'React is the most in-demand frontend skill. It also teaches a way of thinking — declarative UI, derived state, unidirectional data flow — that transfers to React Native and to other component frameworks.',
    interviewRelevance:
      'Standard questions: props vs state, why keys are required in lists, what useEffect cleanup is for, controlled vs uncontrolled inputs, and how to avoid unnecessary re-renders.',
    group: 'Web & Frameworks',
    order: 13,
    level: 'intermediate',
    estimatedMinutes: 55,
    skillSlugs: ['react', 'typescript'],
    roleSlugs: ['frontend-developer', 'full-stack-developer'],
    prerequisites: ['javascript'],
    learningObjectives: [
      'Build components that receive props and render JSX',
      'Manage local state with useState and side effects with useEffect',
      'Render lists correctly with stable keys',
      'Lift state up or share it through context when components need it',
      'Memoise expensive work with useMemo and useCallback where it matters',
      'Explain when a component re-renders and how to reduce it',
    ],
    sections: [
      { type: 'heading', content: '1. Components and JSX' },
      {
        type: 'code',
        language: 'jsx',
        code: `function SkillBadge({ label, level }) {
  return (
    <span className="badge">
      {label} · {level}
    </span>
  );
}

export default function SkillList() {
  return (
    <div className="flex gap-2">
      <SkillBadge label="React" level="Intermediate" />
      <SkillBadge label="Node.js" level="Advanced" />
    </div>
  );
}`,
        output: 'Two reusable components built from one definition.',
        caption: 'A component is a function returning JSX',
      },
      { type: 'heading', content: '2. Props vs state' },
      {
        type: 'table',
        columns: ['Aspect', 'Props', 'State'],
        rows: [
          ['Owned by', 'the parent', 'the component itself'],
          ['Mutable by', 'nobody — read only', 'the component via its setter'],
          ['Changing it', 'triggers a re-render', 'triggers a re-render'],
          ['Use for', 'configuration and data from above', 'things the user changes'],
        ],
      },
      {
        type: 'warning',
        content:
          'Never mutate state directly. `state.count++` changes the object without telling React, so no re-render happens. Always call the setter: setCount(count + 1).',
      },
      { type: 'heading', content: '3. State and hooks' },
      {
        type: 'code',
        language: 'jsx',
        code: `import { useState, useEffect } from 'react';

export default function ProblemSearch() {
  const [query, setQuery] = useState('');
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) { setProblems([]); return; }

    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    fetch('/api/coding/problems?search=' + encodeURIComponent(query), {
      signal: controller.signal,
    })
      .then(res => res.json())
      .then(data => { if (!cancelled) setProblems(data.data.problems); })
      .catch(() => { /* aborted or offline */ })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {          // cleanup: prevents setting state after unmount
      cancelled = true;
      controller.abort();
    };
  }, [query]);

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search problems" />
      {loading && <p>Loading…</p>}
      <ul>
        {problems.map(p => (
          <li key={p._id}>{p.title}</li>     // key must be stable and unique
        ))}
      </ul>
    </div>
  );
}`,
        output: 'Typing re-runs the effect with the new query; leaving the page aborts the request.',
        caption: 'useState + useEffect with cleanup and a dependency array',
      },
      { type: 'heading', content: '4. Lists and keys' },
      {
        type: 'list',
        items: [
          'React matches list items between renders using the key',
          'A stable id prevents the wrong DOM nodes from being reused',
          'Using the array index as the key breaks when items are reordered or deleted',
          'Keys must be unique among siblings — not globally',
        ],
      },
      { type: 'heading', content: '5. Derived state and memoisation' },
      {
        type: 'code',
        language: 'jsx',
        code: `import { useMemo, useCallback } from 'react';

export default function Stats({ submissions }) {
  // Derived value: compute during render instead of storing a second state copy.
  const accepted = useMemo(
    () => submissions.filter(s => s.status === 'Accepted'),
    [submissions]
  );

  const average = useMemo(() => {
    if (submissions.length === 0) return null;
    const total = submissions.reduce((sum, s) => sum + (s.overallScore || 0), 0);
    return Math.round(total / submissions.length);
  }, [submissions]);

  return <p>{accepted.length} accepted · average {average ?? '—'}</p>;
}`,
        output: 'The filter and reduce run only when submissions actually change.',
        caption: 'Derive from props rather than duplicating state',
      },
      {
        type: 'tip',
        content:
          'Prefer deriving values during render over mirroring them in state. Two copies of the same data drift apart — that is the most common source of "the UI shows something stale" bugs.',
      },
    ],
    examples: [
      {
        title: 'Simple: a counter',
        kind: 'Simple',
        explanation: 'The smallest stateful component: read state, call the setter on click.',
        language: 'jsx',
        code: `import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  );
}`,
        output: 'Each click updates state, and React re-renders the button.',
      },
      {
        title: 'Real world: a controlled form with validation',
        kind: 'Real world',
        explanation:
          'Controlled inputs keep the value in React state so validation can run on every keystroke.',
        language: 'jsx',
        code: `import { useState } from 'react';

export default function ContactForm({ onSubmit }) {
  const [form, setForm] = useState({ name: '', email: '' });
  const [error, setError] = useState('');

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));   // spread keeps other fields
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    setError('');
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" value={form.name} onChange={handleChange} />
      <input name="email" value={form.email} onChange={handleChange} />
      {error && <p className="error">{error}</p>}
      <button type="submit">Save</button>
    </form>
  );
}`,
        output: 'Validation runs on submit; a failed validation shows a message instead of calling onSubmit.',
      },
      {
        title: 'Interview style: why does a component re-render?',
        kind: 'Interview style',
        explanation:
          'Interviewers want the trigger list plus one concrete optimisation.',
        language: 'text',
        code: `"A component re-renders when its own state changes, when its parent
 re-renders, or when a context value it consumes changes.

 To reduce it I would: keep state as local as possible, memoise expensive
 derived values with useMemo, wrap stable callbacks in useCallback, and
 split a big component so an update only re-renders the part that changed."`,
        output: 'Names the triggers, then concrete remedies.',
      },
    ],
    commonMistakes: [
      {
        title: 'Mutating state directly',
        wrong: 'items.push(newItem);\nsetItems(items);',
        wrongLanguage: 'jsx',
        why: 'The array reference is unchanged, so React sees no difference and skips the re-render.',
        fix: 'setItems(prev => [...prev, newItem]);',
        fixLanguage: 'jsx',
      },
      {
        title: 'Using the index as a list key',
        wrong: 'items.map((item, i) => <Row key={i} item={item} />)',
        wrongLanguage: 'jsx',
        why: 'When items are inserted or removed, indices shift and React reuses the wrong DOM nodes, producing mismatched input values or animation glitches.',
        fix: 'items.map(item => <Row key={item.id} item={item} />)',
        fixLanguage: 'jsx',
      },
      {
        title: 'Missing the effect dependency array',
        wrong: 'useEffect(() => { fetchData(userId); });',
        wrongLanguage: 'jsx',
        why: 'Without a dependency array the effect runs after every render, so a state update inside it causes an infinite fetch loop.',
        fix: 'useEffect(() => { fetchData(userId); }, [userId]);',
        fixLanguage: 'jsx',
      },
    ],
    interviewTips: [
      {
        question: 'What is the difference between controlled and uncontrolled components?',
        answer:
          'A controlled input takes its value from React state and reports changes through onChange, so React is the single source of truth. An uncontrolled input keeps its value in the DOM and you read it via a ref. Use controlled for validation and dynamic behaviour; uncontrolled is simpler for plain forms and file inputs.',
        difficulty: 'intermediate',
      },
      {
        question: 'When would you use context instead of props?',
        answer:
          'When data is needed by many components at different depths and passing it through every intermediate component adds noise — the classic cases are the current user, theme, and locale. Context is not a performance tool: every consumer re-renders when the value changes, so keep the value small and memoised.',
        difficulty: 'advanced',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Build a component that renders a list of skills from an array of strings.',
        hint: 'map over the array and give each item a stable key. Arrays of strings need a key too.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Build a searchable list that filters as the user types, with a loading state and an empty state.',
        hint: 'Store the query in state, derive the filtered list during render with useMemo, and render an explicit "no results" message.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Refactor a component that mirrors props in state so it derives the value instead, and explain why that removes a bug class.',
        hint: 'Two copies of the same data can drift when only one is updated. Deriving during render guarantees a single source of truth.',
      },
    ],
    quiz: [
      {
        id: 'react-q1',
        question: 'Where does component state live?',
        options: ['In the parent', 'In the component that declared it', 'In the DOM', 'In global scope'],
        correctIndex: 1,
        explanation: 'useState stores state local to the component that called it. Share it by lifting state up or using context.',
        difficulty: 'beginner',
        topicTag: 'state',
      },
      {
        id: 'react-q2',
        question: 'Why must list items have a stable key?',
        options: [
          'React requires unique strings',
          'React uses keys to match items between renders and reuse the correct DOM nodes',
          'Keys improve styling',
          'Keys are only needed for performance',
        ],
        correctIndex: 1,
        explanation: 'Keys are how React identifies which item is which across renders, which prevents mismatched DOM reuse after inserts or deletes.',
        difficulty: 'intermediate',
        topicTag: 'lists',
      },
      {
        id: 'react-q3',
        question: 'What does an empty dependency array in useEffect mean?',
        options: ['The effect never runs', 'The effect runs after every render', 'The effect runs once after the first render', 'The effect runs only on unmount'],
        correctIndex: 2,
        explanation: 'An empty array tells React the effect has no dependencies, so it runs once after mount (and cleanup runs on unmount).',
        difficulty: 'intermediate',
        topicTag: 'hooks',
      },
      {
        id: 'react-q4',
        question: 'Which update correctly triggers a re-render for an array in state?',
        options: ['items.push(x); setItems(items)', 'setItems([...items, x])', 'items[items.length] = x', 'items.concat(x)'],
        correctIndex: 1,
        explanation: 'A new array reference is required. Mutating the existing array leaves the reference unchanged, so React skips the render.',
        difficulty: 'intermediate',
        topicTag: 'immutability',
      },
      {
        id: 'react-q5',
        question: 'When does a component re-render?',
        options: [
          'Only when its own state changes',
          'When its state changes, its parent re-renders, or a consumed context value changes',
          'Only when props change',
          'On every browser event',
        ],
        correctIndex: 1,
        explanation: 'Those are the three triggers. This is why keeping state local and memoising expensive work matters.',
        difficulty: 'advanced',
        topicTag: 'rendering',
      },
    ],
    resources: [
      { title: 'React — Learn', url: 'https://react.dev/learn', provider: 'Meta / React team', type: 'DOCUMENTATION' },
      { title: 'React — Hooks reference', url: 'https://react.dev/reference/react', provider: 'Meta / React team', type: 'DOCUMENTATION' },
      { title: 'MDN — Using Fetch', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch', provider: 'MDN Web Docs', type: 'DOCUMENTATION' },
    ],
    nextTopicSlugs: ['nodejs'],
    relatedTopicSlugs: ['javascript', 'rest-api', 'nodejs'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },

  {
    slug: 'nodejs',
    title: 'Node.js',
    shortDescription: 'JavaScript runtime for servers: the event loop, non-blocking I/O, streams and npm.',
    description:
      'Node.js runs JavaScript outside the browser on the V8 engine. Its design is single-threaded with an event loop and a libuv thread pool for I/O, which makes it very efficient for many concurrent I/O-bound requests and a poor fit for heavy CPU work. This topic covers the runtime model, modules, async patterns, middleware-style servers and error handling.',
    whyItMatters:
      'Node powers the API layer of most JavaScript stacks. Understanding the event loop explains both why it scales so well and where it falls over.',
    interviewRelevance:
      'Frequent: what "non-blocking" actually means, why a CPU-heavy task destroys throughput, streams vs buffering, error handling in async code, and cluster/worker usage.',
    group: 'Web & Frameworks',
    order: 14,
    level: 'intermediate',
    estimatedMinutes: 50,
    skillSlugs: ['nodejs', 'express'],
    roleSlugs: ['backend-developer', 'full-stack-developer'],
    prerequisites: ['javascript'],
    learningObjectives: [
      'Explain the event loop phases and the difference between microtasks and macrotasks',
      'Distinguish blocking from non-blocking I/O and its throughput effect',
      'Use CommonJS and ES modules correctly',
      'Handle errors in callbacks, promises and async/await',
      'Stream large data instead of buffering it into memory',
      'Run an HTTP server with routing and middleware',
    ],
    sections: [
      { type: 'heading', content: '1. The runtime model' },
      {
        type: 'paragraph',
        content:
          'Node has one main JavaScript thread. Asynchronous I/O is handed to libuv (which uses a thread pool and the OS event notification APIs), and completed work is placed on a queue that the event loop drains. That is why Node handles thousands of idle-ish connections well: one thread is never blocked waiting on a socket.',
      },
      {
        type: 'code',
        language: 'javascript',
        code: `console.log('1 — synchronous start');

setTimeout(() => console.log('4 — macrotask (timers phase)'), 0);

Promise.resolve().then(() => console.log('3 — microtask (promise)'));

process.nextTick(() => console.log('2 — nextTick, before promises'));

console.log('1b — synchronous end');`,
        output: `1 — synchronous start
1b — synchronous end
2 — nextTick, before promises
3 — microtask (promise)
4 — macrotask (timers phase)`,
        caption: 'Synchronous code first, then nextTick, microtasks, then macrotasks',
      },
      { type: 'heading', content: '2. Blocking vs non-blocking' },
      {
        type: 'code',
        language: 'javascript',
        code: `// BLOCKING: nothing else runs until the file is read
const data = fs.readFileSync('big.json', 'utf8');
process(data);

// NON-BLOCKING: the loop stays free while the read happens
fs.readFile('big.json', 'utf8', (err, data) => {
  if (err) return handle(err);
  process(data);
});

// Or with promises anywhere in an async function
const data2 = await fs.promises.readFile('big.json', 'utf8');`,
        output: 'The sync version stalls the whole server for the duration of the read.',
        caption: 'The difference that determines scalability',
      },
      {
        type: 'warning',
        content:
          'A single CPU-heavy operation (image resizing, huge JSON parsing, synchronous crypto) blocks every other request. Move it to a worker_threads pool or a separate process — adding threads to the HTTP layer does not help.',
      },
      { type: 'heading', content: '3. Modules' },
      {
        type: 'code',
        language: 'javascript',
        code: `// CommonJS (Node default for .js without "type": "module")
const express = require('express');
module.exports = { createServer };

// ES modules ("type": "module" in package.json, or .mjs)
import express from 'express';
export function createServer() { /* ... */ }`,
        output: 'Both work; do not mix them inside one module.',
        caption: 'CommonJS vs ES modules',
      },
      { type: 'heading', content: '4. An HTTP server with middleware' },
      {
        type: 'code',
        language: 'javascript',
        code: `import express from 'express';

const app = express();
app.use(express.json());

// Middleware runs in order; it must either respond or call next()
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    console.log(req.method, req.url, res.statusCode, Date.now() - started + 'ms');
  });
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.get('/api/problems/:slug', async (req, res, next) => {
  try {
    const problem = await findProblem(req.params.slug);
    if (!problem) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: problem });
  } catch (err) {
    next(err);              // hand async errors to the error middleware
  }
});

// Error handler must be last and take four arguments
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(5001, () => console.log('API on :5001'));`,
        output: 'Requests are logged, routes are handled, and unexpected errors return a clean 500.',
        caption: 'Middleware order matters — the error handler goes last',
      },
      { type: 'heading', content: '5. Streams' },
      {
        type: 'code',
        language: 'javascript',
        code: `import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

// Serves a large file without loading it all into memory
app.get('/api/files/:name', async (req, res) => {
  try {
    await pipeline(
      createReadStream('uploads/' + req.params.name),
      res
    );
  } catch {
    if (!res.headersSent) res.status(404).end();
  }
});`,
        output: 'Memory usage stays flat regardless of file size.',
        caption: 'pipeline propagates errors and cleans up handles',
      },
      {
        type: 'tip',
        content:
          'Buffering a 500 MB export into memory will eventually crash the process. Streaming moves data in chunks so memory stays proportional to the chunk size, not the payload.',
      },
    ],
    examples: [
      {
        title: 'Simple: read a file asynchronously',
        kind: 'Simple',
        explanation: 'The promise form keeps the event loop free and composes with await.',
        language: 'javascript',
        code: `import fs from 'fs/promises';

async function loadConfig(path) {
  const raw = await fs.readFile(path, 'utf8');
  return JSON.parse(raw);
}

loadConfig('./config.json')
  .then(cfg => console.log('loaded', cfg.name))
  .catch(err => console.error('config error:', err.message));`,
        output: 'loads the config or logs the error without blocking the process.',
      },
      {
        title: 'Real world: bounded concurrency for outbound calls',
        kind: 'Real world',
        explanation:
          'Calling a rate-limited provider is the classic case for a concurrency limiter.',
        language: 'javascript',
        code: `async function mapWithLimit(items, limit, worker) {
  const results = [];
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  }

  const pool = Array.from({ length: Math.min(limit, items.length) }, runner);
  await Promise.all(pool);
  return results;
}

// Never more than 5 requests in flight at once
await mapWithLimit(userIds, 5, fetchProfile);`,
        output: 'All items processed, with at most `limit` concurrent calls.',
      },
      {
        title: 'Interview style: why is a CPU task a problem?',
        kind: 'Interview style',
        explanation:
          'Interviewers want the diagnosis plus the specific remedy, not "add more threads".',
        language: 'text',
        code: `"Node runs JavaScript on one thread, so a CPU-bound task such as resizing an
 image blocks the event loop and every pending request waits. I would move it
 to worker_threads or a separate service, keeping the HTTP layer free. Adding
 threads to the server does not help because the bottleneck is the single
 JavaScript thread."`,
        output: 'Correct diagnosis and the correct remedy.',
      },
    ],
    commonMistakes: [
      {
        title: 'Ignoring a rejected promise',
        wrong: 'doWorkAsync();   // rejection becomes an unhandled rejection',
        wrongLanguage: 'javascript',
        why: 'An unawaited promise that rejects raises an unhandledRejection and, on modern Node, terminates the process.',
        fix: 'try {\n  await doWorkAsync();\n} catch (err) {\n  logger.error("doWork failed", err);\n}',
        fixLanguage: 'javascript',
      },
      {
        title: 'Using synchronous fs calls inside a request handler',
        wrong: 'app.get("/report", (req, res) => {\n  const raw = fs.readFileSync("report.csv");\n  res.send(raw);\n});',
        wrongLanguage: 'javascript',
        why: 'The synchronous read blocks the event loop for its whole duration, so every other request in flight stalls.',
        fix: 'app.get("/report", async (req, res, next) => {\n  try {\n    res.send(await fs.promises.readFile("report.csv"));\n  } catch (err) { next(err); }\n});',
        fixLanguage: 'javascript',
      },
      {
        title: 'Placing the error handler before the routes',
        wrong: 'app.use(errorHandler);\napp.get("/api/x", handler);',
        wrongLanguage: 'javascript',
        why: 'Express runs middleware in registration order, so an error handler registered early never sees errors thrown by later routes.',
        fix: 'Register all routes first and add the error-handling middleware last.',
        fixLanguage: 'javascript',
      },
    ],
    interviewTips: [
      {
        question: 'What does non-blocking I/O mean in Node.js?',
        answer:
          'The JavaScript thread never waits for I/O to finish. The operation is delegated to libuv (thread pool or OS readiness notifications) and a callback is queued when it completes. The thread is then free to serve other requests, which is why a single Node process handles many concurrent I/O-bound connections.',
        difficulty: 'intermediate',
      },
      {
        question: 'When would you use worker_threads or multiple processes?',
        answer:
          'Use worker_threads for CPU-bound work (image processing, compression, heavy parsing) so the main thread stays responsive. Use the cluster module or multiple containers to use several CPU cores for the HTTP layer itself. A single Node process uses one core, so scaling out is normal.',
        difficulty: 'advanced',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Write an HTTP server with one JSON endpoint that returns the current server time.',
        hint: 'Use express or the built-in http module and set Content-Type: application/json.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Add request logging middleware and an error-handling middleware to a server, and prove the order matters.',
        hint: 'Log method, path, status and duration. Register the error handler last and test by throwing inside a route.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Implement a concurrency limiter that runs at most N async tasks at once and explain why it is needed.',
        hint: 'Start N runners that pull from a shared index until the list is exhausted. Useful for outbound APIs with rate limits.',
      },
    ],
    quiz: [
      {
        id: 'node-q1',
        question: 'How many JavaScript threads does a default Node process use?',
        options: ['One main thread (plus a libuv pool for I/O)', 'Two', 'One per CPU core', 'Four'],
        correctIndex: 0,
        explanation: 'JavaScript runs on one main thread. libuv handles I/O off-thread and queues completions back to the loop.',
        difficulty: 'beginner',
        topicTag: 'event-loop',
      },
      {
        id: 'node-q2',
        question: 'What happens when a request handler performs a long synchronous operation?',
        options: ['Only that request is slow', 'The event loop is blocked, so all requests wait', 'Node starts a worker automatically', 'The request is rejected'],
        correctIndex: 1,
        explanation: 'There is one JavaScript thread, so blocking it delays every other pending request.',
        difficulty: 'intermediate',
        topicTag: 'blocking',
      },
      {
        id: 'node-q3',
        question: 'Which runs first after the current synchronous code finishes?',
        options: ['setTimeout callback', 'Promise microtask', 'A new HTTP request', 'setImmediate'],
        correctIndex: 1,
        explanation: 'Microtasks (promises, queueMicrotask) drain before the event loop proceeds to the timers/macrotask phase. process.nextTick runs even earlier.',
        difficulty: 'advanced',
        topicTag: 'event-loop',
      },
      {
        id: 'node-q4',
        question: 'Why prefer stream pipeline over reading a large file into memory?',
        options: [
          'It is easier to write',
          'Memory stays proportional to the chunk size instead of the whole payload',
          'It is the only way to read files in Node',
          'It avoids using the filesystem',
        ],
        correctIndex: 1,
        explanation: 'Streaming avoids buffering the entire payload, so a large export does not exhaust the process memory limit.',
        difficulty: 'intermediate',
        topicTag: 'streams',
      },
      {
        id: 'node-q5',
        question: 'Where must Express error-handling middleware be registered?',
        options: ['First', 'Before the routes', 'After all routes, with four arguments', 'It can go anywhere'],
        correctIndex: 2,
        explanation: 'Middleware runs in order, so an error handler must come after the routes it protects and must accept (err, req, res, next).',
        difficulty: 'intermediate',
        topicTag: 'express',
      },
    ],
    resources: [
      { title: 'Node.js — The event loop', url: 'https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick', provider: 'OpenJS Foundation', type: 'DOCUMENTATION' },
      { title: 'Node.js API documentation', url: 'https://nodejs.org/api/', provider: 'OpenJS Foundation', type: 'DOCUMENTATION' },
      { title: 'Express routing guide', url: 'https://expressjs.com/en/guide/routing.html', provider: 'OpenJS Foundation', type: 'DOCUMENTATION' },
    ],
    nextTopicSlugs: ['rest-api'],
    relatedTopicSlugs: ['javascript', 'mongodb', 'docker'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },

  {
    slug: 'rest-api',
    title: 'REST API',
    shortDescription: 'Designing HTTP APIs: resources, methods, status codes, validation, auth and versioning.',
    description:
      'A REST API exposes resources over HTTP and uses the method to express intent. This topic covers resource naming, the correct method and status code for each operation, pagination, filtering, idempotency, authentication, error response shape and versioning — the decisions that make an API usable rather than merely functional.',
    whyItMatters:
      'You will build and consume APIs in every backend role. Well-designed endpoints save clients from guessing, and consistent errors turn a support ticket into a one-line fix.',
    interviewRelevance:
      'Expect to be asked to design endpoints for a small domain, to choose status codes, to explain idempotency and PUT vs PATCH, and to describe how you would authenticate a client.',
    group: 'Web & Frameworks',
    order: 15,
    level: 'intermediate',
    estimatedMinutes: 50,
    skillSlugs: ['rest-api', 'api-design'],
    roleSlugs: ['backend-developer', 'full-stack-developer'],
    prerequisites: ['computer-networks'],
    learningObjectives: [
      'Model a domain as resources with correct URI naming',
      'Choose the right HTTP method and status code for each operation',
      'Design consistent success and error response envelopes',
      'Add pagination, filtering and sorting without ambiguity',
      'Explain idempotency and where retries are safe',
      'Describe authentication and versioning strategies',
    ],
    sections: [
      { type: 'heading', content: '1. Resources and URIs' },
      {
        type: 'list',
        items: [
          'Name collections with plural nouns: /api/problems, /api/submissions',
          'Nest only when the child cannot exist independently: /api/problems/:slug/submissions',
          'Do not put verbs in the path — the method is the verb',
          'Use query parameters for filtering, sorting and pagination',
          'Keep identifiers opaque; slugs are fine for readability',
        ],
      },
      {
        type: 'table',
        columns: ['Method', 'Path', 'Meaning', 'Idempotent'],
        rows: [
          ['GET', '/api/problems', 'list problems', 'yes'],
          ['GET', '/api/problems/two-sum', 'read one problem', 'yes'],
          ['POST', '/api/problems', 'create a problem', 'no'],
          ['PUT', '/api/problems/:id', 'replace a problem', 'yes'],
          ['PATCH', '/api/problems/:id', 'update specific fields', 'no (by convention)'],
          ['DELETE', '/api/problems/:id', 'delete a problem', 'yes'],
        ],
      },
      { type: 'heading', content: '2. Status codes that carry meaning' },
      {
        type: 'code',
        language: 'javascript',
        code: `// 200 with a body
res.json({ success: true, data: problem });

// 201 for a created resource, with its location
res.status(201).json({ success: true, data: { problem } });

// 204 when there is genuinely nothing to return
res.status(204).end();

// 400 for a malformed request, 422 for semantically invalid input
if (!isValidLanguage(language)) {
  return res.status(400).json({ success: false, message: 'Unsupported language' });
}

// 401 vs 403: unauthenticated vs not permitted
// 404 when the resource does not exist or is not visible to this user
// 409 for a conflicting state (duplicate slug, already submitted)
// 429 when a rate limit is exceeded`,
        output: 'Clients can branch on the status code instead of parsing the message.',
        caption: 'Use the status code as the primary signal',
      },
      { type: 'heading', content: '3. Consistent response envelope' },
      {
        type: 'code',
        language: 'json',
        code: `// Success
{
  "success": true,
  "data": { "problem": { "slug": "two-sum", "difficulty": "Easy" } },
  "meta": { "requestId": "req_01H9..." }
}

// Error
{
  "success": false,
  "error": "VALIDATION_FAILED",
  "message": "language must be one of python, javascript, java, cpp, c",
  "details": [{ "field": "language", "issue": "unsupported value" }]
}

// List with pagination
{
  "success": true,
  "data": {
    "problems": [ /* ... */ ],
    "pagination": { "page": 2, "limit": 20, "total": 137, "totalPages": 7 }
  }
}`,
        output: 'One envelope shape for every endpoint means clients write one parser.',
        caption: 'Predictable envelopes and pagination metadata',
      },
      { type: 'heading', content: '4. Idempotency and retries' },
      {
        type: 'paragraph',
        content:
          'An idempotent request can be repeated without changing the result beyond the first successful call. This matters because clients, proxies and load balancers retry on timeouts — and a retried non-idempotent POST can create duplicates.',
      },
      {
        type: 'code',
        language: 'javascript',
        code: `// PUT with the full representation is safe to retry
PUT /api/resume/versions/42
{ "name": "Backend Developer", "template": "ats-classic" }

// Making a POST safe with an idempotency key
POST /api/payments
Idempotency-Key: 7f9c1e2a-...
// Server: if the key was already processed, return the stored response
// instead of charging again.`,
        output: 'Retries cause no duplicate side effects.',
        caption: 'Idempotency keys make payment endpoints retry-safe',
      },
      { type: 'heading', content: '5. Validation and errors' },
      {
        type: 'code',
        language: 'javascript',
        code: `import { body, validationResult } from 'express-validator';

router.post('/api/coding/submit',
  [
    body('problemSlug').isString().notEmpty(),
    body('language').isIn(['python', 'javascript', 'typescript', 'java', 'cpp', 'c']),
    body('sourceCode').isString().isLength({ min: 1, max: 20000 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        details: errors.array().map(e => ({ field: e.path, issue: e.msg })),
      });
    }
    // ... trusted input from here on
  })
);`,
        output: 'Invalid input is rejected at the edge with a field-level explanation.',
        caption: 'Validate at the boundary, then trust your inputs',
      },
      { type: 'heading', content: '6. Authentication and versioning' },
      {
        type: 'list',
        items: [
          'Use HTTPS always — tokens in plaintext are compromised tokens',
          'Bearer tokens in the Authorization header for stateless APIs',
          'Short-lived access tokens plus a refresh token reduces the blast radius of a leak',
          'Authorise per resource: owning a submission is not the same as being an admin',
          'Never log tokens or return them in error payloads',
          'Version with a path prefix (/api/v2) or a media type; never break clients silently',
        ],
      },
      {
        type: 'warning',
        content:
          'A common security bug is trusting an id from the client. Always scope the query by the authenticated user (findOne({ _id, userId })) rather than looking the record up globally and then checking ownership afterwards.',
      },
    ],
    examples: [
      {
        title: 'Simple: one REST endpoint',
        kind: 'Simple',
        explanation: 'Resource path, method, validation and a consistent envelope.',
        language: 'javascript',
        code: `router.get('/api/coding/problems/:slug', async (req, res) => {
  const problem = await Problem.findOne({ slug: req.params.slug, isPublished: true });
  if (!problem) {
    return res.status(404).json({ success: false, message: 'Problem not found' });
  }
  res.json({ success: true, data: problem });
});`,
        output: '200 with the resource, or 404 with an error envelope.',
      },
      {
        title: 'Real world: paginated, filtered list',
        kind: 'Real world',
        explanation:
          'Lists must never return the whole collection. Page, limit, filter and sort belong in the query string.',
        language: 'javascript',
        code: `router.get('/api/coding/submissions', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const filter = { user: req.user.userId };
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Submission.find(filter).sort({ submittedAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    Submission.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      submissions: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});`,
        output: 'Bounded response size with enough metadata for the client to page.',
      },
      {
        title: 'Interview style: design endpoints for a small domain',
        kind: 'Interview style',
        explanation:
          'Interviewers listen for resource modelling, status codes and the awkward cases (auth, idempotency, duplicates).',
        language: 'text',
        code: `"For a resume-builder domain:
 GET    /api/resume/versions              list my versions
 POST   /api/resume/versions              create one  -> 201
 GET    /api/resume/versions/:id          read one    -> 404 when not mine
 PUT    /api/resume/versions/:id          replace (idempotent, safe for autosave)
 DELETE /api/resume/versions/:id          delete
 POST   /api/resume/versions/:id/duplicate  non-idempotent but explicit

 Every query is scoped by the authenticated user id, and creation returns 409
 on a name conflict rather than silently overwriting."`,
        output: 'Resources, methods, status codes and the ownership rule all stated.',
      },
    ],
    commonMistakes: [
      {
        title: 'Returning 200 for every outcome',
        wrong: 'res.json({ success: false, message: "Not found" });   // HTTP 200',
        wrongLanguage: 'javascript',
        why: 'Clients, caches and monitoring all rely on the status code. A 200 with an error body is invisible to infrastructure and breaks retry logic.',
        fix: 'res.status(404).json({ success: false, error: "NOT_FOUND", message: "Problem not found" });',
        fixLanguage: 'javascript',
      },
      {
        title: 'Looking up by id without scoping to the owner',
        wrong: 'const doc = await Submission.findById(req.params.id);\nif (doc.userId !== req.user.userId) return res.status(403);',
        wrongLanguage: 'javascript',
        why: 'The record is fetched before the ownership check, so any bug in the comparison leaks data, and the extra round trip is avoidable.',
        fix: 'const doc = await Submission.findOne({ _id: req.params.id, userId: req.user.userId });\nif (!doc) return res.status(404).json({ success: false, message: "Not found" });',
        fixLanguage: 'javascript',
      },
      {
        title: 'Verbs in the URL',
        wrong: 'POST /api/getProblemById\nPOST /api/deleteSubmission',
        wrongLanguage: 'javascript',
        why: 'It hides the method semantics, breaks caching, and prevents standard tooling from understanding the API.',
        fix: 'GET /api/problems/:slug\nDELETE /api/submissions/:id',
        fixLanguage: 'javascript',
      },
    ],
    interviewTips: [
      {
        question: 'What is the difference between PUT and PATCH?',
        answer:
          'PUT replaces the entire representation, so the client sends every field and the call is idempotent — sending it twice gives the same state. PATCH applies a partial change, so it is smaller on the wire but generally not idempotent. Use PUT when the client owns the whole resource and PATCH for targeted field updates.',
        difficulty: 'intermediate',
      },
      {
        question: 'How would you secure a REST API?',
        answer:
          'HTTPS everywhere, bearer tokens with short lifetimes plus refresh, authorization checked per resource by scoping queries to the authenticated owner, input validation at the boundary, rate limiting to blunt brute force, and never logging or returning secrets. Separating authentication (who you are) from authorization (what you may do) keeps the rules auditable.',
        difficulty: 'advanced',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Design the endpoints for a to-do list: create, list, read, update and delete a task, with the status code for each.',
        hint: 'POST 201 for create, GET 200 for reads, PUT/PATCH 200, DELETE 204, 404 when missing.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Add pagination, filtering by status and sorting by creation date to a list endpoint.',
        hint: 'Read page/limit/status/sort from the query, clamp the limit, and return pagination metadata.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Make a POST endpoint safe to retry using an idempotency key and explain the storage requirement.',
        hint: 'Persist the key with the response; on a repeat key, return the stored response instead of re-executing the side effect.',
      },
    ],
    quiz: [
      {
        id: 'rest-q1',
        question: 'Which status code should a successful resource creation return?',
        options: ['200', '201', '202', '204'],
        correctIndex: 1,
        explanation: '201 Created indicates a new resource now exists, often with a Location header pointing at it.',
        difficulty: 'beginner',
        topicTag: 'status-codes',
      },
      {
        id: 'rest-q2',
        question: 'Which method pair is idempotent?',
        options: ['POST and PATCH', 'PUT and DELETE', 'POST and POST', 'PATCH and POST'],
        correctIndex: 1,
        explanation: 'PUT and DELETE can be repeated with the same end state. POST creates a new resource each time.',
        difficulty: 'intermediate',
        topicTag: 'idempotency',
      },
      {
        id: 'rest-q3',
        question: 'What is the correct way to expose "get a submission"?',
        options: ['POST /api/getSubmission', 'GET /api/submissions/:id', 'GET /api/submissions/get/:id', 'POST /api/submissions/:id/fetch'],
        correctIndex: 1,
        explanation: 'Resources are nouns in the path and the HTTP method carries the verb.',
        difficulty: 'beginner',
        topicTag: 'resource-design',
      },
      {
        id: 'rest-q4',
        question: 'Why scope a query by the authenticated user id instead of checking ownership afterwards?',
        options: [
          'It is faster only',
          'It removes an entire class of data-leak bugs and avoids a wasted round trip',
          'It is required by HTTP',
          'It enables caching',
        ],
        correctIndex: 1,
        explanation: 'If the record is never fetched for a non-owner, no comparison bug can expose it.',
        difficulty: 'advanced',
        topicTag: 'authorization',
      },
      {
        id: 'rest-q5',
        question: 'What does a consistent error envelope give the client?',
        options: [
          'Smaller payloads',
          'One predictable parsing path plus a machine-readable error code',
          'Automatic retries',
          'Better caching',
        ],
        correctIndex: 1,
        explanation: 'A single envelope shape with a stable error code lets clients handle failures programmatically instead of scraping messages.',
        difficulty: 'beginner',
        topicTag: 'error-handling',
      },
    ],
    resources: [
      { title: 'RFC 9110 — HTTP Semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110.html', provider: 'IETF', type: 'DOCUMENTATION' },
      { title: 'MDN — HTTP response status codes', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status', provider: 'MDN Web Docs', type: 'DOCUMENTATION' },
      { title: 'OWASP API Security Top 10', url: 'https://owasp.org/API-Security/editions/2023/en/0x11-t10/', provider: 'OWASP', type: 'ARTICLE' },
    ],
    nextTopicSlugs: ['system-design-basics'],
    relatedTopicSlugs: ['nodejs', 'sql', 'computer-networks'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },

  {
    slug: 'system-design-basics',
    title: 'System Design Basics',
    shortDescription: 'Scaling a system: load balancing, caching, databases, queues, CAP and reliability.',
    description:
      'System design is about making choices that still work when traffic, data and failure modes grow. This topic covers the building blocks — load balancers, caches, read replicas, sharding, queues, CDNs — plus the theory behind them (CAP, consistency models, back-of-the-envelope estimation) and how to structure a design answer.',
    whyItMatters:
      'Senior and mid-level interviews include a design round, and day-to-day work is choosing between these trade-offs. The skill is reasoning about constraints, not naming technologies.',
    interviewRelevance:
      'Expect: design a URL shortener or a feed, explain consistent hashing, choose between SQL and NoSQL, describe caching invalidation, and estimate capacity with rough numbers.',
    group: 'Architecture',
    order: 16,
    level: 'advanced',
    estimatedMinutes: 60,
    skillSlugs: ['system-design', 'architecture'],
    roleSlugs: ['backend-developer', 'software-engineer', 'devops-engineer'],
    prerequisites: ['dbms', 'computer-networks'],
    learningObjectives: [
      'Structure a design answer: requirements, estimation, components, trade-offs',
      'Choose between vertical and horizontal scaling for a given bottleneck',
      'Explain caching layers, eviction and invalidation',
      'Describe replication, sharding and their consistency consequences',
      'Use queues to decouple slow work and absorb bursts',
      'Apply CAP and the consistency models it implies',
    ],
    sections: [
      { type: 'heading', content: '1. How to answer a design question' },
      {
        type: 'steps',
        items: [
          'Clarify requirements: who uses it, which operations, how much traffic, what latency is acceptable',
          'State assumptions explicitly — a design without constraints cannot be judged',
          'Estimate: requests per second, storage per year, read/write ratio',
          'Sketch the components: client, load balancer, service, cache, database, queue',
          'Identify the bottleneck and scale that specific part',
          'Discuss trade-offs and failure modes — this is where the marks are',
        ],
      },
      {
        type: 'code',
        language: 'text',
        code: `Rough numbers worth remembering:
  ~86,400 seconds per day
  1 million requests/day  = ~12 requests/second
  1 billion requests/day  = ~11,600 requests/second
  1 KB x 1 million rows   = ~1 GB
  One SSD read            = ~0.1 ms
  One in-datacenter network call = ~0.5 ms
  One cross-region call   = ~50-150 ms`,
        output: 'Enough precision to rule out impossible designs.',
        caption: 'Back-of-the-envelope estimation',
      },
      { type: 'heading', content: '2. Scaling the application tier' },
      {
        type: 'compare',
        leftTitle: 'Vertical (bigger machine)',
        rightTitle: 'Horizontal (more machines)',
        leftItems: [
          'No code change required',
          'Single point of failure remains',
          'Costs grow non-linearly; there is a ceiling',
          'Fine for a database primary',
        ],
        rightItems: [
          'Requires stateless services',
          'Fault tolerant — one node can die',
          'Scales out cheaply and elastically',
          'Needs a load balancer and shared session/session-free auth',
        ],
      },
      {
        type: 'note',
        content:
          'Statelessness is the enabling condition for horizontal scaling. Storing sessions in memory ties a user to one instance; moving sessions to Redis or using signed tokens lets any instance serve any request.',
      },
      { type: 'heading', content: '3. Load balancing and consistent hashing' },
      {
        type: 'list',
        items: [
          'Algorithms: round robin, least connections, IP hash, weighted',
          'Health checks remove unhealthy nodes automatically',
          'Session affinity is convenient but hurts resilience — avoid it when you can',
          'Consistent hashing maps keys to a ring so adding a node moves only ~1/N of the keys instead of everything',
        ],
      },
      { type: 'heading', content: '4. Caching' },
      {
        type: 'table',
        columns: ['Layer', 'What it caches', 'Typical TTL'],
        rows: [
          ['Browser / CDN', 'static assets, cacheable API responses', 'minutes to a year'],
          ['Application', 'computed results, expensive queries', 'seconds to minutes'],
          ['Redis / Memcached', 'sessions, hot records, rate counters', 'seconds to hours'],
          ['Database', 'query plans, buffer pool', 'engine managed'],
        ],
      },
      {
        type: 'code',
        language: 'javascript',
        code: `// Cache-aside: the most common pattern
async function getProblem(slug) {
  const key = 'problem:' + slug;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const problem = await Problem.findOne({ slug }).lean();
  if (!problem) return null;

  await redis.set(key, JSON.stringify(problem), 'EX', 300);   // 5 minute TTL
  return problem;
}

// Invalidate on write — otherwise clients read stale rows for the whole TTL
async function updateProblem(slug, patch) {
  await Problem.updateOne({ slug }, { $set: patch });
  await redis.del('problem:' + slug);
}`,
        output: 'Reads are served from memory; writes evict the stale entry.',
        caption: 'Cache-aside with explicit invalidation',
      },
      {
        type: 'warning',
        content:
          'There are only two hard problems in caching: choosing a TTL and invalidating correctly. A cache without an invalidation path on write is a stale-data bug with a delay.',
      },
      { type: 'heading', content: '5. Databases at scale' },
      {
        type: 'list',
        items: [
          'Read replicas scale reads; the primary still handles all writes',
          'Replication is usually asynchronous, so a replica can lag — design for read-your-own-writes where it matters',
          'Sharding partitions data by key; pick a high-cardinality shard key or you create hot shards',
          'Denormalise for read-heavy analytics, keep normalised for transactional correctness',
          'Choose SQL when you need joins and multi-row transactions; NoSQL when you need flexible schemas and horizontal scale',
        ],
      },
      { type: 'heading', content: '6. Queues and asynchronous work' },
      {
        type: 'code',
        language: 'text',
        code: `Synchronous (fast path):
  request -> validate -> enqueue job -> 202 Accepted
  (respond in ~10 ms)

Asynchronous (slow path):
  worker -> process job -> update status -> notify
  (may take seconds or minutes)

Why it matters:
  - absorbs traffic bursts without dropping requests
  - isolates a slow or flaky dependency from the user-facing path
  - allows retries with backoff and a dead-letter queue for permanent failures`,
        output: 'The user gets a fast acknowledgement; heavy work happens off the critical path.',
        caption: 'Decouple slow work with a queue',
      },
      { type: 'heading', content: '7. CAP and consistency' },
      {
        type: 'paragraph',
        content:
          'During a network partition you must choose between consistency (refuse to serve possibly stale data) and availability (serve, possibly stale). Since partitions are unavoidable, the real choice is what to do when one occurs. Most user-facing systems choose availability with eventual consistency and make it acceptable by designing idempotent operations and showing progress states.',
      },
      {
        type: 'tip',
        content:
          'Say "eventually consistent" only when you can describe the maximum window and how the UI behaves meanwhile. Otherwise you are describing a bug.',
      },
    ],
    examples: [
      {
        title: 'Simple: URL shortener at a high level',
        kind: 'Simple',
        explanation: 'The classic warm-up: estimation, then a minimal component list.',
        language: 'text',
        code: `Requirements: create a short link; resolve it fast; links rarely change.
Estimate: 100M new links/day -> ~1,200 writes/s; reads ~100x writes.
Storage: 100M/day x 365 x ~500 B  ~= 18 TB/year.

Design:
  client -> load balancer -> redirect service (stateless, N replicas)
                                   |
                             cache (Redis, hot slugs)
                                   |
                        key-value store (slug -> long URL)
  Write path: generate a unique id (base62 of a counter or a random id),
  store slug -> URL, return the short link.
Key ideas: read-heavy so cache aggressively; resolution must be a single
lookup; slugs are immutable, which makes caching trivially safe.`,
        output: 'A design justified by numbers rather than by naming tools.',
      },
      {
        title: 'Real world: protecting a slow downstream dependency',
        kind: 'Real world',
        explanation:
          'One slow third-party call can take down an otherwise healthy service. Queues plus timeouts plus retries contain it.',
        language: 'text',
        code: `Problem: the AI provider takes 8 s and sometimes times out, and the
request handler awaits it, so threads pile up.

Fix:
  1. Queue the AI job and return 202 with a job id immediately.
  2. Worker calls the provider with a strict timeout and bounded retries
     using exponential backoff and jitter.
  3. Exhausted retries go to a dead-letter queue for inspection.
  4. Results are cached by content hash so repeated requests are free.
  5. The UI polls the job status and shows progress — never a blank spinner.`,
        output: 'The user-facing path stays fast and failure is contained.',
      },
      {
        title: 'Interview style: SQL or NoSQL?',
        kind: 'Interview style',
        explanation:
          'The answer must come from the access pattern and the consistency requirement.',
        language: 'text',
        code: `"For payments I would use a relational database: multi-row transactions,
 foreign keys and the ability to join accounts and ledgers are non-negotiable.

 For a high-volume event or log stream with a flexible per-record shape and
 no cross-record joins, I would use a wide-column or document store so I can
 scale writes horizontally and tolerate schema variation.

 The deciding factors are the access pattern and the consistency requirement,
 not popularity."`,
        output: 'Justified by requirements, not preference.',
      },
    ],
    commonMistakes: [
      {
        title: 'Optimising before measuring',
        wrong: 'Adding a cache and three replicas before identifying the bottleneck',
        wrongLanguage: 'text',
        why: 'The real bottleneck is often a single slow query. Adding infrastructure around an unmeasured problem raises cost and failure surface without fixing throughput.',
        fix: 'Measure first: profile the endpoint, look at the query plan, then scale the specific constrained component.',
        fixLanguage: 'text',
      },
      {
        title: 'Unbounded queue growth',
        wrong: 'Producers enqueue without any limit or backpressure',
        wrongLanguage: 'text',
        why: 'If producers are faster than consumers, the queue grows until it exhausts memory or disk and the whole system fails.',
        fix: 'Cap the queue, reject or shed load beyond the cap, and monitor queue depth and consumer lag as first-class metrics.',
        fixLanguage: 'text',
      },
      {
        title: 'Treating a cache as a source of truth',
        wrong: 'Writing only to Redis and letting the database fill in later',
        wrongLanguage: 'text',
        why: 'Caches are evicted and lost. Any data that only exists in the cache is data you will eventually lose.',
        fix: 'Write to the durable store first, then update or invalidate the cache.',
        fixLanguage: 'text',
      },
    ],
    interviewTips: [
      {
        question: 'How do you choose a shard key?',
        answer:
          'Look for high cardinality, even access distribution and a query pattern that includes the key so requests hit a single shard. A poor key (for example country when one country dominates) creates a hot shard that limits the whole cluster. If you cannot find a key that spreads writes and still supports single-shard reads, revisit the data model.',
        difficulty: 'advanced',
      },
      {
        question: 'What does eventually consistent actually mean in a product?',
        answer:
          'Writes propagate asynchronously, so different replicas can return different values for a short window. To make that acceptable you bound the window, route read-your-own-writes to the primary or a fresh replica, and design the UI to show the pending state. If a user can observe a wrong value in a critical flow, the flow needs strong consistency instead.',
        difficulty: 'advanced',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Estimate the requests per second and storage per year for an app with 2 million daily users making 20 requests each.',
        hint: '2M x 20 = 40M requests/day; divide by 86,400. For storage, multiply the average response size by the writes per year.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Design a rate limiter for an API used by many clients and explain the storage and algorithm you would use.',
        hint: 'Redis counters with a sliding window or token bucket; key by client, set a TTL equal to the window, and return 429 with a Retry-After header.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Design a system that ranks and displays a leaderboard for one million users updating scores continuously.',
        hint: 'Writes via a queue, scores stored in a sorted structure such as a Redis sorted set, paginated reads, and periodic snapshots for durability.',
      },
    ],
    quiz: [
      {
        id: 'sd-q1',
        question: 'What is the enabling condition for scaling an application tier horizontally?',
        options: ['Larger instances', 'Stateless services', 'A single database', 'More read replicas'],
        correctIndex: 1,
        explanation: 'If any instance can serve any request, you can run many of them behind a load balancer. In-memory sessions break that.',
        difficulty: 'intermediate',
        topicTag: 'scaling',
      },
      {
        id: 'sd-q2',
        question: 'In cache-aside, when should the cache be invalidated?',
        options: ['Never — rely on the TTL', 'On every write to the underlying record', 'Only at deploy time', 'Whenever a read misses'],
        correctIndex: 1,
        explanation: 'Invalidating on write keeps the window of stale data bounded. Relying only on the TTL means stale reads for the whole TTL.',
        difficulty: 'intermediate',
        topicTag: 'caching',
      },
      {
        id: 'sd-q3',
        question: 'During a network partition, which CAP property do you sacrifice if you serve possibly stale data?',
        options: ['Consistency', 'Availability', 'Partition tolerance', 'Durability'],
        correctIndex: 0,
        explanation: 'Serving during a partition while allowing stale reads chooses availability over strict consistency.',
        difficulty: 'advanced',
        topicTag: 'cap',
      },
      {
        id: 'sd-q4',
        question: 'Why is consistent hashing used for distributing keys across nodes?',
        options: [
          'It is faster than modulo',
          'Adding or removing a node moves only a small fraction of keys instead of almost all of them',
          'It guarantees strong consistency',
          'It compresses the data',
        ],
        correctIndex: 1,
        explanation: 'Modulo hashing remaps nearly every key when the node count changes; consistent hashing moves roughly 1/N.',
        difficulty: 'advanced',
        topicTag: 'sharding',
      },
      {
        id: 'sd-q5',
        question: 'What is the main benefit of putting slow work behind a queue?',
        options: [
          'It makes the work faster',
          'It decouples the user-facing path from slow work and absorbs bursts',
          'It removes the need for retries',
          'It guarantees exactly-once processing',
        ],
        correctIndex: 1,
        explanation: 'The request returns quickly while heavy work is processed asynchronously with retries. Exactly-once delivery is not guaranteed and still requires idempotent consumers.',
        difficulty: 'intermediate',
        topicTag: 'queues',
      },
    ],
    resources: [
      { title: 'AWS Well-Architected Framework', url: 'https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html', provider: 'Amazon Web Services', type: 'DOCUMENTATION' },
      { title: 'Redis — Distributed caching patterns', url: 'https://redis.io/docs/latest/develop/use/patterns/', provider: 'Redis Ltd.', type: 'DOCUMENTATION' },
      { title: 'Designing Data-Intensive Applications', url: 'https://dataintensive.net/', provider: 'Martin Kleppmann', type: 'BOOK' },
    ],
    nextTopicSlugs: [],
    relatedTopicSlugs: ['dbms', 'computer-networks', 'docker', 'sql'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },
];
