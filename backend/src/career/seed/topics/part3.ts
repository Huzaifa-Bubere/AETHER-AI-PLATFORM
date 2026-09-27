import type { SeedTopic } from './types';

/** Systems fundamentals + tooling. */
export const TOPICS_PART3: SeedTopic[] = [
  {
    slug: 'dbms',
    title: 'DBMS',
    shortDescription: 'How databases work internally: ACID, normalization, transactions, concurrency control and indexing.',
    description:
      'A Database Management System is the software that stores, protects and serves data. This topic covers the theory that explains why well-modelled schemas stay consistent: ACID properties, transactions and isolation levels, normalization and denormalization, keys, and how concurrency control prevents two writers from corrupting each other.',
    whyItMatters:
      'Every interview round at a product company includes DBMS theory, and it is what separates "I can write a query" from "I can design a system that will not corrupt data".',
    interviewRelevance:
      'Near-certain questions: ACID, the four isolation levels and the anomalies each prevents, 1NF/2NF/3NF, primary vs foreign vs unique keys, and deadlock handling.',
    group: 'Core CS',
    order: 9,
    level: 'intermediate',
    estimatedMinutes: 50,
    skillSlugs: ['dbms'],
    roleSlugs: ['backend-developer', 'data-analyst', 'software-engineer'],
    prerequisites: ['sql'],
    learningObjectives: [
      'Explain each of the ACID properties with a concrete example',
      'Normalise a schema to third normal form and say when to denormalise',
      'Describe the four isolation levels and the anomalies they prevent',
      'Explain how locking and MVCC prevent lost updates',
      'Distinguish clustered, non-clustered and composite indexes',
      'Recognise and prevent deadlocks',
    ],
    sections: [
      { type: 'heading', content: 'What is a DBMS?' },
      {
        type: 'paragraph',
        content:
          'A DBMS manages persistent data for many concurrent users while guaranteeing consistency. It provides storage, indexing, transactions, concurrency control, recovery and access control. Relational systems (PostgreSQL, MySQL, SQL Server) dominate transactional workloads; document stores (MongoDB) trade strict relational guarantees for flexible schemas.',
      },
      { type: 'heading', content: '1. ACID' },
      {
        type: 'table',
        columns: ['Property', 'Meaning', 'Failure it prevents'],
        rows: [
          ['Atomicity', 'all statements in a transaction succeed or none are applied', 'a partially transferred payment'],
          ['Consistency', 'constraints hold before and after the transaction', 'a negative balance where the rule forbids it'],
          ['Isolation', 'concurrent transactions do not see each other\'s intermediate state', 'a double booking'],
          ['Durability', 'committed data survives a crash', 'a lost order after a power failure'],
        ],
      },
      {
        type: 'code',
        language: 'sql',
        code: `BEGIN;

UPDATE accounts SET balance = balance - 500 WHERE id = 1;
UPDATE accounts SET balance = balance + 500 WHERE id = 2;

-- Either both rows changed, or the whole block is rolled back.
COMMIT;`,
        output: 'The transfer is atomic: no state exists where the money left one account but never arrived.',
        caption: 'A transaction groups statements into one unit',
      },
      { type: 'heading', content: '2. Keys' },
      {
        type: 'list',
        items: [
          'Primary key — uniquely identifies a row; NOT NULL and one per table',
          'Candidate key — any column set that could have been the primary key',
          'Foreign key — references a primary key in another table and enforces referential integrity',
          'Unique key — enforces uniqueness but allows one NULL (in most engines)',
          'Composite key — uniqueness comes from the combination of columns',
          'Surrogate key — a generated id (auto-increment or UUID) with no business meaning',
        ],
      },
      { type: 'heading', content: '3. Normalization' },
      {
        type: 'table',
        columns: ['Form', 'Rule', 'Violation example'],
        rows: [
          ['1NF', 'atomic values, no repeating groups', 'a "phone_numbers" column holding "a, b"'],
          ['2NF', 'no partial dependency on part of a composite key', 'subject name stored per (student, subject) row'],
          ['3NF', 'no transitive dependency between non-key columns', 'storing dept_name in an employee row'],
          ['BCNF', 'every determinant is a candidate key', 'an instructor depends on a non-key attribute'],
        ],
      },
      {
        type: 'note',
        content:
          'Trade-off: normalization removes update anomalies; denormalization reduces joins. OLTP systems normalise, analytics/reporting systems denormalise deliberately for read speed.',
      },
      { type: 'heading', content: '4. Concurrency and isolation' },
      {
        type: 'table',
        columns: ['Isolation level', 'Dirty read', 'Non-repeatable read', 'Phantom read'],
        rows: [
          ['READ UNCOMMITTED', 'possible', 'possible', 'possible'],
          ['READ COMMITTED', 'not possible', 'possible', 'possible'],
          ['REPEATABLE READ', 'not possible', 'not possible', 'possible'],
          ['SERIALIZABLE', 'not possible', 'not possible', 'not possible'],
        ],
      },
      {
        type: 'paragraph',
        content:
          'Stronger isolation means fewer anomalies but more blocking or retries. Most production systems default to READ COMMITTED and use explicit locking or optimistic version checks where a lost update would be harmful.',
      },
      {
        type: 'code',
        language: 'sql',
        code: `-- Problem: lost update.
UPDATE accounts SET balance = balance + 100 WHERE id = 1;   -- two concurrent runs

-- Solution: row lock for the read-modify-write window
BEGIN;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
UPDATE accounts SET balance = balance + 100 WHERE id = 1;
COMMIT;

-- Or optimistic locking with a version column:
UPDATE accounts SET balance = balance + 100, version = version + 1
WHERE id = 1 AND version = 7;   -- 0 rows updated = someone else won, retry`,
        output: 'Either serialise with FOR UPDATE, or detect the conflict with a version column.',
        caption: 'Lost update prevention',
      },
      { type: 'heading', content: '5. Indexes' },
      {
        type: 'list',
        items: [
          'Clustered index — determines the physical row order; a table has at most one',
          'Non-clustered index — a separate structure with a pointer back to the row',
          'Composite index — ordered by column sequence; usable for a leftmost prefix',
          'Covering index — contains every column the query needs, so the table is never touched',
          'Cardinality matters: an index on a low-cardinality column (a boolean flag) is often skipped by the planner',
        ],
      },
      {
        type: 'warning',
        content:
          'More indexes are not better. Each one is maintained on every write and consumes storage, so index the columns your WHERE, JOIN and ORDER BY clauses actually use — verified with EXPLAIN.',
      },
    ],
    examples: [
      {
        title: 'Simple: a normalised two-table schema',
        kind: 'Simple',
        explanation: 'Splitting a repeated department name into its own table removes the update anomaly.',
        language: 'sql',
        code: `CREATE TABLE departments (
  id   INT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE employees (
  id            INT PRIMARY KEY,
  name          VARCHAR(80) NOT NULL,
  department_id INT NOT NULL REFERENCES departments(id)
);`,
        output: 'Renaming a department is now a single-row update.',
      },
      {
        title: 'Real world: a transfer that cannot half-apply',
        kind: 'Real world',
        explanation:
          'Atomicity matters most where money, inventory or seat counts are involved.',
        language: 'sql',
        code: `BEGIN;
UPDATE wallets SET balance = balance - 250 WHERE user_id = 7 AND balance >= 250;
-- If the guard affects 0 rows, the caller rolls back.
UPDATE wallets SET balance = balance + 250 WHERE user_id = 9;
INSERT INTO transfers (from_user, to_user, amount) VALUES (7, 9, 250);
COMMIT;`,
        output: 'The balance guard prevents an overdraft; the transaction keeps the ledger consistent.',
      },
      {
        title: 'Interview style: explain 3NF in one sentence',
        kind: 'Interview style',
        explanation: 'Interviewers want the rule plus a violation they can picture.',
        language: 'text',
        code: `"Third normal form says every non-key column depends on the key,
 the whole key, and nothing but the key.
 Storing department_name on an employee row violates it, because
 department_name depends on department_id, not on the employee."`,
        output: 'Rule, mechanism and a concrete violation in three lines.',
      },
    ],
    commonMistakes: [
      {
        title: 'Assuming a unique constraint is a primary key',
        wrong: 'CREATE TABLE users (email VARCHAR(120) UNIQUE);   -- no primary key',
        wrongLanguage: 'sql',
        why: 'A unique column allows NULLs (in most engines) and does not identify the row for foreign keys.',
        fix: 'CREATE TABLE users (\n  id    BIGSERIAL PRIMARY KEY,\n  email VARCHAR(120) NOT NULL UNIQUE\n);',
        fixLanguage: 'sql',
      },
      {
        title: 'Doing long work inside a transaction',
        wrong: 'BEGIN; /* call an external API for 30 seconds */ COMMIT;',
        wrongLanguage: 'sql',
        why: 'The open transaction holds locks for its whole duration, blocking other writers and increasing the chance of deadlock.',
        fix: 'Do the external call first, then open a short transaction containing only the database writes.',
        fixLanguage: 'sql',
      },
      {
        title: 'Inconsistent lock ordering',
        wrong: '-- Transaction A locks row 1 then 2; Transaction B locks row 2 then 1',
        wrongLanguage: 'sql',
        why: 'Each transaction holds a lock the other needs, so neither can proceed — a deadlock that the database must break by killing one.',
        fix: 'Always acquire locks in a deterministic order (for example by ascending id) and keep transactions short.',
        fixLanguage: 'sql',
      },
    ],
    interviewTips: [
      {
        question: 'What is the difference between a dirty read and a phantom read?',
        answer:
          'A dirty read sees uncommitted data that may still be rolled back. A phantom read happens when a repeated range query returns new rows inserted by another committed transaction. Dirty reads are prevented from READ COMMITTED upward; phantoms require SERIALIZABLE (or advisory locking / range locks).',
        difficulty: 'intermediate',
      },
      {
        question: 'Why do databases need concurrency control at all?',
        answer:
          'Without it, interleaved transactions produce lost updates, inconsistent reads and unreadable intermediate states. Concurrency control (two-phase locking, MVCC, or optimistic version checks) trades some parallelism for correctness, which is the right trade for transactional data.',
        difficulty: 'intermediate',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Design a two-table schema for students and courses that avoids storing the course name repeatedly.',
        hint: 'Courses have their own table; the enrolment table stores student_id and course_id.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Given a table with repeated customer addresses, normalise it to 3NF and list the tables you created.',
        hint: 'Customers, addresses, and a link table if a customer can have several addresses.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Two sessions run the same read-modify-write update concurrently. Show how a lost update occurs and two ways to prevent it.',
        hint: 'Explain the interleaving, then prevent it with SELECT ... FOR UPDATE (pessimistic) or a version column (optimistic).',
      },
    ],
    quiz: [
      {
        id: 'dbms-q1',
        question: 'Which ACID property guarantees that a partially applied transaction is never visible?',
        options: ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
        correctIndex: 0,
        explanation: 'Atomicity makes the transaction all-or-nothing, so intermediate states are never committed.',
        difficulty: 'beginner',
        topicTag: 'acid',
      },
      {
        id: 'dbms-q2',
        question: 'Which normal form removes transitive dependencies between non-key columns?',
        options: ['1NF', '2NF', '3NF', 'BCNF'],
        correctIndex: 2,
        explanation: '3NF requires each non-key column to depend only on the key, not on another non-key column.',
        difficulty: 'intermediate',
        topicTag: 'normalization',
      },
      {
        id: 'dbms-q3',
        question: 'Which isolation level prevents dirty reads but still allows non-repeatable reads?',
        options: ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'],
        correctIndex: 1,
        explanation: 'READ COMMITTED only exposes committed data, so no dirty reads — but the same row can change between two reads in one transaction.',
        difficulty: 'intermediate',
        topicTag: 'isolation',
      },
      {
        id: 'dbms-q4',
        question: 'What is the most likely cause of a deadlock?',
        options: [
          'Too many indexes',
          'Two transactions acquiring the same locks in different orders',
          'A missing PRIMARY KEY',
          'Using AUTO_INCREMENT',
        ],
        correctIndex: 1,
        explanation: 'Inconsistent lock ordering creates a cycle where each transaction waits for a lock the other holds.',
        difficulty: 'advanced',
        topicTag: 'concurrency',
      },
      {
        id: 'dbms-q5',
        question: 'How many clustered indexes can a table have?',
        options: ['Zero or more', 'Exactly one (at most)', 'Two', 'One per column'],
        correctIndex: 1,
        explanation: 'A clustered index defines the physical order of rows, so a table can have at most one.',
        difficulty: 'intermediate',
        topicTag: 'indexes',
      },
    ],
    resources: [
      { title: 'PostgreSQL — Transaction isolation', url: 'https://www.postgresql.org/docs/current/transaction-iso.html', provider: 'PostgreSQL Global Development Group', type: 'DOCUMENTATION' },
      { title: 'MySQL — InnoDB locking', url: 'https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html', provider: 'Oracle / MySQL', type: 'DOCUMENTATION' },
      { title: 'Use The Index, Luke!', url: 'https://use-the-index-luke.com/', provider: 'Markus Winand', type: 'BOOK' },
    ],
    nextTopicSlugs: ['system-design-basics'],
    relatedTopicSlugs: ['sql', 'mongodb', 'operating-systems'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },

  {
    slug: 'operating-systems',
    title: 'Operating Systems',
    shortDescription: 'Processes, threads, scheduling, memory management, synchronisation and deadlocks.',
    description:
      'The operating system multiplexes one machine between many programs. It decides which process runs, isolates memory between them, schedules I/O and provides the abstractions (files, sockets, processes) every program depends on. These are the concepts behind "why did my service go slow" questions.',
    whyItMatters:
      'Backend performance problems are frequently scheduling, memory or I/O issues. Understanding processes, threads and paging turns guesswork into diagnosis.',
    interviewRelevance:
      'Standard set: process vs thread, context switching, deadlock conditions, page replacement (LRU), virtual memory, and scheduling algorithms such as round robin and shortest job first.',
    group: 'Core CS',
    order: 10,
    level: 'intermediate',
    estimatedMinutes: 50,
    skillSlugs: ['operating-systems'],
    roleSlugs: ['backend-developer', 'devops-engineer', 'software-engineer'],
    prerequisites: [],
    learningObjectives: [
      'Distinguish processes from threads and explain their isolation guarantees',
      'Describe context switching and its cost',
      'Compare scheduling algorithms and their trade-offs',
      'Explain virtual memory, paging and page faults',
      'Identify the four conditions necessary for a deadlock',
      'Use synchronisation primitives to prevent race conditions',
    ],
    sections: [
      { type: 'heading', content: '1. Process vs thread' },
      {
        type: 'table',
        columns: ['Aspect', 'Process', 'Thread'],
        rows: [
          ['Memory', 'its own address space', 'shares the process address space'],
          ['Creation cost', 'high', 'low'],
          ['Communication', 'pipes, sockets, shared memory', 'directly via shared memory'],
          ['Isolation', 'a crash does not affect others', 'a crash takes down the whole process'],
          ['Context switch', 'expensive (page tables, TLB)', 'cheaper (registers, stack)'],
        ],
      },
      {
        type: 'tip',
        content:
          'A Python service is usually one process with many threads (or async tasks); a Node.js service is one process with one main thread plus a worker pool for I/O. Knowing which model you are running explains most "why does one slow request block everything" bugs.',
      },
      { type: 'heading', content: '2. Scheduling' },
      {
        type: 'list',
        items: [
          'First Come First Served — simple, but a long job delays everything (convoy effect)',
          'Shortest Job First — optimal average waiting time, needs knowing burst length in advance',
          'Round Robin — each process gets a time quantum, good for interactive fairness',
          'Priority scheduling — important work first, risk of starving low-priority work (fixed by ageing)',
          'Multilevel feedback queue — real OS behaviour: interactive tasks get short quanta, CPU-bound tasks get longer ones',
        ],
      },
      {
        type: 'note',
        content:
          'A context switch saves the current process state and loads the next one. The switch itself does no useful work, so a quantum that is too small wastes CPU on switching and one that is too large degrades interactivity.',
      },
      { type: 'heading', content: '3. Memory: virtual memory and paging' },
      {
        type: 'paragraph',
        content:
          'Each process sees a contiguous virtual address space. The MMU translates pages (typically 4 KB) to physical frames using a page table, caching recent translations in the TLB. A page not in physical memory causes a page fault and the OS loads it from disk.',
      },
      {
        type: 'code',
        language: 'text',
        code: `Virtual address -> [ page number | offset ]
                      |
                   page table
                      |
               physical frame + offset

Page fault path:
  address not mapped/resident
    -> trap to the OS
    -> pick a victim frame (LRU-ish)
    -> if dirty, write it back
    -> load the needed page
    -> update the page table and retry the instruction`,
        output: 'Memory appears larger than it is, at the cost of page faults.',
        caption: 'Address translation and the page fault cycle',
      },
      {
        type: 'warning',
        content:
          'Thrashing is the pathological case: the working set does not fit in memory, so the system spends nearly all its time handling page faults and throughput collapses. The fix is reducing memory pressure, not adding CPU.',
      },
      { type: 'heading', content: '4. Race conditions and synchronisation' },
      {
        type: 'code',
        language: 'python',
        code: `import threading

counter = 0

def increment():
    global counter
    for _ in range(100_000):
        counter += 1          # read, add, write — NOT atomic

threads = [threading.Thread(target=increment) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()
print(counter)   # usually far less than 400000`,
        output: 'Reads and writes interleave, so increments are lost.',
        caption: 'A classic race condition',
      },
      {
        type: 'code',
        language: 'python',
        code: `import threading

counter = 0
lock = threading.Lock()

def increment():
    global counter
    for _ in range(100_000):
        with lock:            # mutual exclusion around the critical section
            counter += 1

threads = [threading.Thread(target=increment) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()
print(counter)   # exactly 400000`,
        output: 'The lock makes the read-modify-write sequence atomic.',
        caption: 'Fixed with a mutex',
      },
      { type: 'heading', content: '5. Deadlock' },
      {
        type: 'list',
        items: [
          'Mutual exclusion — a resource can be held by only one process',
          'Hold and wait — a process holds one resource while requesting another',
          'No preemption — resources cannot be taken away',
          'Circular wait — a cycle of processes each waiting for the next',
          'Breaking any ONE condition prevents deadlock; the usual practical fix is consistent lock ordering, which removes circular wait',
        ],
      },
    ],
    examples: [
      {
        title: 'Simple: observe a race condition',
        kind: 'Simple',
        explanation: 'Unsynchronised increments lose updates because += is not atomic.',
        language: 'python',
        code: `count = 0
for _ in range(100_000):
    count += 1
print(count)      # correct when single-threaded — the race appears with concurrency`,
        output: '100000',
      },
      {
        title: 'Real world: bound concurrency with a semaphore',
        kind: 'Real world',
        explanation:
          'Limiting parallel work protects a downstream service and keeps memory predictable.',
        language: 'python',
        code: `import threading, time

semaphore = threading.Semaphore(3)   # at most 3 concurrent workers

def worker(job_id):
    with semaphore:
        time.sleep(0.1)              # pretend to call a slow downstream
        print("finished job", job_id)

threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
for t in threads: t.start()
for t in threads: t.join()`,
        output: 'Ten jobs run, but never more than three at a time.',
      },
      {
        title: 'Interview style: why does a blocked thread hurt?',
        kind: 'Interview style',
        explanation:
          'Interviewers want the connection between blocking, thread pools and throughput.',
        language: 'text',
        code: `"If a request handler blocks on synchronous I/O, that thread cannot serve
 anything else. With a fixed pool of N threads, N simultaneous slow calls
 exhaust the pool and new requests queue.

 Two fixes: use non-blocking I/O (async) so one thread multiplexes many
 requests, or increase the pool AND the downstream capacity so the queue
 cannot grow unbounded."`,
        output: 'Identifies the bottleneck and names the two standard remedies.',
      },
    ],
    commonMistakes: [
      {
        title: 'Assuming a compound operation is atomic',
        wrong: 'shared_dict[key] = shared_dict.get(key, 0) + 1   # from several threads',
        wrongLanguage: 'python',
        why: 'The read, the add and the write are separate steps. Another thread can interleave between them and overwrite the update.',
        fix: 'with lock:\n    shared_dict[key] = shared_dict.get(key, 0) + 1',
        fixLanguage: 'python',
      },
      {
        title: 'Acquiring locks in different orders',
        wrong: 'Thread A: lock(a); lock(b)      Thread B: lock(b); lock(a)',
        wrongLanguage: 'text',
        why: 'This creates circular wait, one of the four deadlock conditions.',
        fix: 'Establish a global order (e.g. by object id) and always acquire locks in that order.',
        fixLanguage: 'text',
      },
      {
        title: 'Unbounded thread creation',
        wrong: 'for job in jobs:\n    threading.Thread(target=handle, args=(job,)).start()',
        wrongLanguage: 'python',
        why: 'Thousands of threads cause heavy context switching and memory pressure, so throughput falls while CPU usage looks high.',
        fix: 'Use a bounded pool (concurrent.futures.ThreadPoolExecutor(max_workers=...)) or a semaphore.',
        fixLanguage: 'python',
      },
    ],
    interviewTips: [
      {
        question: 'What are the four necessary conditions for a deadlock?',
        answer:
          'Mutual exclusion, hold and wait, no preemption and circular wait. All four must hold simultaneously. In practice you break circular wait by defining a global lock order, or break hold and wait by requesting every needed resource up front.',
        difficulty: 'intermediate',
      },
      {
        question: 'Why is a context switch expensive?',
        answer:
          'The OS saves the running thread state, switches stacks, and for a process switch also changes the address space, which flushes TLB entries and can evict cache lines. The work is pure overhead, so the scheduler aims for a quantum large enough to amortise it.',
        difficulty: 'intermediate',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Explain in your own words the difference between a process and a thread, with one advantage of each.',
        hint: 'Isolation and fault tolerance for processes; cheap creation and shared memory for threads.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Given processes with burst times and arrival times, compute the average waiting time under FCFS and under SJF.',
        hint: 'Waiting time = start time - arrival time. SJF needs the shortest remaining burst first.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Write a program that demonstrates a lost update and fix it with a lock, then explain why the fix works.',
        hint: 'The critical section must contain the whole read-modify-write sequence, not just the write.',
      },
    ],
    quiz: [
      {
        id: 'os-q1',
        question: 'Which is shared between threads of the same process?',
        options: ['Stack', 'Program counter', 'Registers', 'Heap memory'],
        correctIndex: 3,
        explanation: 'Threads share the heap and address space but each has its own stack, registers and program counter.',
        difficulty: 'beginner',
        topicTag: 'threads',
      },
      {
        id: 'os-q2',
        question: 'Which is NOT a necessary condition for deadlock?',
        options: ['Mutual exclusion', 'Hold and wait', 'Preemption', 'Circular wait'],
        correctIndex: 2,
        explanation: 'The condition is NO preemption. If resources could be forcibly taken back, deadlock could not form.',
        difficulty: 'intermediate',
        topicTag: 'deadlock',
      },
      {
        id: 'os-q3',
        question: 'What happens when a process accesses a page not present in physical memory?',
        options: ['Segmentation fault always', 'A page fault is raised and the OS loads the page', 'The process is killed', 'The CPU ignores it'],
        correctIndex: 1,
        explanation: 'The MMU traps to the OS, which finds a free frame (possibly evicting a victim) and loads the page before retrying the instruction.',
        difficulty: 'intermediate',
        topicTag: 'memory',
      },
      {
        id: 'os-q4',
        question: 'What is thrashing?',
        options: [
          'Excessive context switching between threads',
          'The system spending most of its time servicing page faults',
          'A deadlock on file locks',
          'A full disk',
        ],
        correctIndex: 1,
        explanation: 'When the working set does not fit in RAM, pages are evicted and re-faulted constantly and useful throughput collapses.',
        difficulty: 'advanced',
        topicTag: 'memory',
      },
      {
        id: 'os-q5',
        question: 'Which scheduling policy gives the minimum average waiting time in theory?',
        options: ['FCFS', 'Round Robin', 'Shortest Job First', 'Priority'],
        correctIndex: 2,
        explanation: 'SJF minimises average waiting time when burst lengths are known, which is why real schedulers approximate it.',
        difficulty: 'intermediate',
        topicTag: 'scheduling',
      },
    ],
    resources: [
      { title: 'OSTEP — Operating Systems: Three Easy Pieces', url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/', provider: 'University of Wisconsin', type: 'BOOK' },
      { title: 'Linux manual — pthreads(7)', url: 'https://man7.org/linux/man-pages/man7/pthreads.7.html', provider: 'Linux man-pages project', type: 'DOCUMENTATION' },
      { title: 'Python threading documentation', url: 'https://docs.python.org/3/library/threading.html', provider: 'Python Software Foundation', type: 'DOCUMENTATION' },
    ],
    nextTopicSlugs: ['computer-networks'],
    relatedTopicSlugs: ['dbms', 'docker'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },

  {
    slug: 'computer-networks',
    title: 'Computer Networks',
    shortDescription: 'How data moves between machines: the TCP/IP stack, HTTP, DNS, TLS, load balancing and latency.',
    description:
      'Networking explains what actually happens between a browser and a server. This topic covers the layered model, TCP vs UDP, HTTP request structure, DNS resolution, TLS handshakes, status codes, caching headers and the latency budget that determines whether an application feels fast.',
    whyItMatters:
      'Web and backend work is networking. Debugging a slow endpoint or a CORS failure is impossible without knowing which layer is misbehaving.',
    interviewRelevance:
      'Frequent: TCP vs UDP, the TCP three-way handshake, what happens when you type a URL, HTTP status code families, HTTPS/TLS basics, and idempotent HTTP methods.',
    group: 'Core CS',
    order: 11,
    level: 'intermediate',
    estimatedMinutes: 50,
    skillSlugs: ['networking'],
    roleSlugs: ['backend-developer', 'devops-engineer', 'software-engineer'],
    prerequisites: [],
    learningObjectives: [
      'Map a real request onto the OSI/TCP-IP layers',
      'Compare TCP and UDP and choose appropriately',
      'Describe the TCP three-way handshake and connection teardown',
      'Read and construct HTTP requests and interpret status codes',
      'Explain DNS resolution and TLS in the request lifecycle',
      'Use caching headers and keep-alive to reduce latency',
    ],
    sections: [
      { type: 'heading', content: '1. Layered model' },
      {
        type: 'table',
        columns: ['Layer', 'Protocol examples', 'What it handles'],
        rows: [
          ['Application', 'HTTP, DNS, SMTP, WebSocket', 'the meaning of the messages'],
          ['Transport', 'TCP, UDP', 'ports, reliability, ordering'],
          ['Internet', 'IP, ICMP', 'addressing and routing between networks'],
          ['Link', 'Ethernet, Wi-Fi, ARP', 'frames on the local segment'],
        ],
      },
      { type: 'heading', content: '2. TCP vs UDP' },
      {
        type: 'compare',
        leftTitle: 'TCP',
        rightTitle: 'UDP',
        leftItems: [
          'Connection-oriented with a handshake',
          'Guarantees delivery and ordering',
          'Retransmits lost segments, so head-of-line blocking exists',
          'Used by HTTP, databases, SSH, file transfer',
        ],
        rightItems: [
          'Connectionless, fire and forget',
          'No delivery or ordering guarantee',
          'Lower overhead and latency',
          'Used by DNS, video streaming, VoIP, gaming, QUIC',
        ],
      },
      {
        type: 'code',
        language: 'text',
        code: `TCP three-way handshake:
  client -> server : SYN        (seq = x)
  server -> client : SYN-ACK    (seq = y, ack = x+1)
  client -> server : ACK        (ack = y+1)
  connection established

Teardown uses FIN/ACK in both directions (four steps).`,
        output: 'Two round trips are needed before any application data flows.',
        caption: 'Why a new TCP connection costs latency',
      },
      { type: 'heading', content: '3. HTTP' },
      {
        type: 'code',
        language: 'http',
        code: `POST /api/resume/versions HTTP/1.1
Host: api.example.com
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json

{ "name": "Backend Developer", "template": "ats-classic" }

--- response ---
HTTP/1.1 201 Created
Content-Type: application/json
Cache-Control: no-store

{ "success": true, "data": { "version": { "_id": "..." } } }`,
        output: 'A request is method + path + headers + optional body; a response is status + headers + body.',
        caption: 'The shape of an HTTP exchange',
      },
      {
        type: 'table',
        columns: ['Family', 'Meaning', 'Examples'],
        rows: [
          ['2xx', 'success', '200 OK, 201 Created, 204 No Content'],
          ['3xx', 'redirect / cache', '301 Moved Permanently, 304 Not Modified'],
          ['4xx', 'client error', '400 Bad Request, 401 Unauthorized, 403 Forbidden, 404, 409, 429'],
          ['5xx', 'server error', '500, 502 Bad Gateway, 503 Unavailable, 504 Timeout'],
        ],
      },
      {
        type: 'tip',
        content:
          'Learn the difference between 401 and 403: 401 means "not authenticated, send credentials", 403 means "authenticated but not allowed". Interviewers use it to check whether you have actually built APIs.',
      },
      { type: 'heading', content: '4. What happens when you type a URL' },
      {
        type: 'steps',
        items: [
          'Browser checks its own cache, then the OS cache, for a valid copy',
          'DNS resolution: browser cache → OS cache → resolver → root → TLD → authoritative name server → IP address',
          'TCP handshake with the server (or reuse an existing keep-alive connection)',
          'TLS handshake for HTTPS: certificate verification and key agreement',
          'HTTP request is sent; the server (possibly behind a load balancer and CDN) processes it',
          'Response arrives, browser parses HTML, then requests sub-resources (CSS, JS, images)',
        ],
      },
      { type: 'heading', content: '5. Reducing latency' },
      {
        type: 'list',
        items: [
          'Reuse connections with keep-alive instead of handshaking per request',
          'Cache at the edge with Cache-Control: max-age / ETag and 304 responses',
          'Compress responses (gzip/br) and paginate large payloads',
          'Return only the fields the client needs rather than whole documents',
          'Put a CDN in front of static assets and keep the origin closer to users',
        ],
      },
      {
        type: 'warning',
        content:
          'Cache-Control: no-store on every response is a common accidental performance problem — it forbids caching of content that barely ever changes and forces a full round trip each time.',
      },
    ],
    examples: [
      {
        title: 'Simple: inspect a request and response',
        kind: 'Simple',
        explanation: 'Reading raw headers is the fastest way to debug an API problem.',
        language: 'bash',
        code: `curl -i https://api.github.com/users/octocat`,
        output: `HTTP/2 200
content-type: application/json; charset=utf-8
cache-control: public, max-age=60
... body ...`,
      },
      {
        title: 'Real world: DNS lookup',
        kind: 'Real world',
        explanation: 'DNS failures present as "site not reachable" long before an HTTP error appears.',
        language: 'bash',
        code: `dig +short example.com
# 93.184.216.34
dig +trace example.com | head -20    # watch the delegation chain`,
        output: 'Resolves the hostname to one or more IP addresses via the resolver chain.',
      },
      {
        title: 'Interview style: choosing TCP or UDP',
        kind: 'Interview style',
        explanation:
          'The answer must connect the guarantee to the consequence for the user.',
        language: 'text',
        code: `"For a live video call I would use UDP because a late packet is useless —
 retransmitting it only adds delay. For an API that must not lose data
 (payments, records) I would use TCP, accepting the extra latency in exchange
 for guaranteed, ordered delivery."`,
        output: 'Grounds the protocol choice in the user-visible consequence.',
      },
    ],
    commonMistakes: [
      {
        title: 'Blocking the event loop with a synchronous network call',
        wrong: 'const data = fs.readFileSync(url);   // inside a request handler',
        wrongLanguage: 'javascript',
        why: 'The call blocks the single thread, so no other request can be served until the slow I/O completes.',
        fix: 'const data = await fs.promises.readFile(url);   // or use fetch()',
        fixLanguage: 'javascript',
      },
      {
        title: 'Confusing 401 and 403',
        wrong: 'return res.status(403).json({ message: "Please log in" });',
        wrongLanguage: 'javascript',
        why: '403 tells the client that logging in will not help, so frontends will not retry with credentials.',
        fix: 'if (!user) return res.status(401).json({ message: "Please log in" });\nif (!allowed) return res.status(403).json({ message: "Forbidden" });',
        fixLanguage: 'javascript',
      },
      {
        title: 'Forgetting CORS on the server',
        wrong: '// browser: "blocked by CORS policy" while curl works fine',
        wrongLanguage: 'text',
        why: 'Browsers enforce same-origin rules; the server must send Access-Control-Allow-Origin (and handle preflight OPTIONS) for the request to be permitted.',
        fix: 'app.use(cors({ origin: allowedOrigins, credentials: true }));\n// and make sure OPTIONS preflight is answered, not rejected by auth middleware',
        fixLanguage: 'javascript',
      },
    ],
    interviewTips: [
      {
        question: 'Walk me through what happens when you type a URL into a browser.',
        answer:
          'Cache check, then DNS resolution to an IP, then a TCP handshake, then TLS if HTTPS, then the HTTP request to the server (often through a CDN/load balancer), then response parsing followed by sub-resource requests. Mentioning caching and connection reuse shows you think about latency, not just correctness.',
        difficulty: 'intermediate',
      },
      {
        question: 'Which HTTP methods are idempotent and why does it matter?',
        answer:
          'GET, PUT, DELETE and HEAD are idempotent: repeating them leaves the same end state. POST and PATCH are generally not. This matters because clients, proxies and load balancers may retry a failed request — retrying an idempotent one is safe, while retrying a POST can create duplicate records.',
        difficulty: 'intermediate',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Use one command to view the status code, headers and body of an HTTPS request.',
        hint: 'curl -i prints headers plus body; -I shows headers only.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Draw the sequence of packets for a TCP handshake and explain why it needs two round trips before data flows.',
        hint: 'SYN, SYN-ACK, ACK. Each side must confirm the other can both send and receive.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'An API endpoint is slow only for users far from the server. Propose three mitigations and the expected effect of each.',
        hint: 'CDN/edge caching removes the round trip; connection reuse removes handshakes; moving the origin closer or adding a regional replica cuts propagation latency.',
      },
    ],
    quiz: [
      {
        id: 'net-q1',
        question: 'Which protocol guarantees ordered, reliable delivery?',
        options: ['UDP', 'TCP', 'ICMP', 'ARP'],
        correctIndex: 1,
        explanation: 'TCP sequences segments and retransmits lost ones, so the application receives ordered and complete data.',
        difficulty: 'beginner',
        topicTag: 'transport',
      },
      {
        id: 'net-q2',
        question: 'Which status code means the request was understood but the user is not allowed?',
        options: ['400', '401', '403', '404'],
        correctIndex: 2,
        explanation: '403 Forbidden means the identity is known but lacks permission. 401 means credentials are missing or invalid.',
        difficulty: 'beginner',
        topicTag: 'http',
      },
      {
        id: 'net-q3',
        question: 'What does DNS do?',
        options: [
          'Encrypts traffic',
          'Resolves hostnames to IP addresses',
          'Compresses responses',
          'Assigns local ports',
        ],
        correctIndex: 1,
        explanation: 'DNS maps a human-readable name to one or more IP addresses so the client can open a connection.',
        difficulty: 'beginner',
        topicTag: 'dns',
      },
      {
        id: 'net-q4',
        question: 'How many round trips does the TCP three-way handshake take?',
        options: ['0', '1', '2', '4'],
        correctIndex: 2,
        explanation: 'SYN → SYN-ACK → ACK: the client learns the server is reachable and vice versa, requiring two round trips.',
        difficulty: 'intermediate',
        topicTag: 'tcp',
      },
      {
        id: 'net-q5',
        question: 'Which header allows a browser to reuse a cached response without re-downloading it?',
        options: ['Cache-Control', 'Content-Length', 'Authorization', 'Accept-Encoding'],
        correctIndex: 0,
        explanation: 'Cache-Control (with max-age, ETag/If-None-Match) tells the client how long a response may be reused, enabling 304 Not Modified responses.',
        difficulty: 'intermediate',
        topicTag: 'http-caching',
      },
    ],
    resources: [
      { title: 'MDN HTTP reference', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP', provider: 'MDN Web Docs', type: 'DOCUMENTATION' },
      { title: 'RFC 9110 — HTTP Semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110.html', provider: 'IETF', type: 'DOCUMENTATION' },
      { title: 'High Performance Browser Networking', url: 'https://hpbn.co/', provider: 'Ilya Grigorik', type: 'BOOK' },
    ],
    nextTopicSlugs: ['rest-api'],
    relatedTopicSlugs: ['operating-systems', 'docker', 'rest-api'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },

  {
    slug: 'docker',
    title: 'Docker',
    shortDescription: 'Package an application with its dependencies into an image and run it as an isolated container.',
    description:
      'Docker builds an image from a Dockerfile and runs it as a container sharing the host kernel. That gives identical environments from a developer laptop to production, plus fast start-up compared with virtual machines. This topic covers images, layers, the Dockerfile, volumes, networking and Compose.',
    whyItMatters:
      '"Works on my machine" is a class of bug, not an excuse. Containers make the runtime environment part of the artefact, which is why every deployment pipeline now assumes Docker.',
    interviewRelevance:
      'Typical questions: container vs virtual machine, why layer order affects build time, multi-stage builds, volumes vs bind mounts, and what Docker Compose is for.',
    group: 'DevOps & Tooling',
    order: 12,
    level: 'intermediate',
    estimatedMinutes: 45,
    skillSlugs: ['docker'],
    roleSlugs: ['devops-engineer', 'backend-developer', 'full-stack-developer'],
    prerequisites: ['git-github'],
    learningObjectives: [
      'Explain what a container is and how it differs from a virtual machine',
      'Write a Dockerfile with correct layer ordering and a non-root user',
      'Use multi-stage builds to keep images small',
      'Persist data with volumes and configure container networking',
      'Orchestrate multiple services with Docker Compose',
      'Diagnose common container problems (exited immediately, port in use, permission denied)',
    ],
    sections: [
      { type: 'heading', content: '1. Container vs virtual machine' },
      {
        type: 'compare',
        leftTitle: 'Container',
        rightTitle: 'Virtual machine',
        leftItems: [
          'Shares the host kernel',
          'Starts in milliseconds to seconds',
          'Image is megabytes — only your app and its dependencies',
          'Weaker isolation boundary',
        ],
        rightItems: [
          'Runs a full guest OS with its own kernel',
          'Starts in tens of seconds',
          'Image is gigabytes',
          'Stronger isolation, heavier overhead',
        ],
      },
      { type: 'heading', content: '2. Images, layers and the Dockerfile' },
      {
        type: 'paragraph',
        content:
          'Each Dockerfile instruction creates a layer, and layers are cached by content hash. Order matters: put the things that change least often first so a code edit does not invalidate the dependency installation layer.',
      },
      {
        type: 'code',
        language: 'dockerfile',
        code: `FROM node:20-alpine

WORKDIR /app

# Dependencies first — this layer is cached until the lockfile changes
COPY package*.json ./
RUN npm ci --omit=dev

# Source last — changing code does not reinstall dependencies
COPY . .

ENV NODE_ENV=production
USER node
EXPOSE 5001
CMD ["node", "dist/server.js"]`,
        output: 'Rebuilding after a source edit reuses the cached dependency layer.',
        caption: 'Correct layer ordering',
      },
      {
        type: 'warning',
        content:
          'Never run production containers as root. Add a USER instruction — a container escape as root is far more damaging. Also add a .dockerignore for node_modules, .git and .env.',
      },
      { type: 'heading', content: '3. Multi-stage builds' },
      {
        type: 'code',
        language: 'dockerfile',
        code: `# Stage 1: build the TypeScript
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: runtime — only the compiled output and prod dependencies
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/server.js"]`,
        output: 'The final image contains no compilers or dev dependencies.',
        caption: 'Build stage and runtime stage separated',
      },
      { type: 'heading', content: '4. Volumes and networking' },
      {
        type: 'code',
        language: 'bash',
        code: `# Named volume: data survives container replacement
docker run -d --name db -v pgdata:/var/lib/postgresql/data postgres:16

# Bind mount: live code into the container during development
docker run -v $(pwd)/src:/app/src myapp

# Publish a port: host:container
docker run -p 5001:5001 myapp

# Containers on one network reach each other by service name
docker network create appnet
docker run --network appnet --name api myapp
# from another container: http://api:5001`,
        output: 'Volumes persist data; a user network gives DNS-based service discovery.',
        caption: 'Persistence and inter-container communication',
      },
      {
        type: 'tip',
        content:
          'Inside Docker Compose, connect using the service name as the hostname (mongodb:27017), not localhost. localhost inside a container refers to that container itself — the single most common Compose mistake.',
      },
      { type: 'heading', content: '5. Docker Compose' },
      {
        type: 'code',
        language: 'yaml',
        code: `services:
  backend:
    build: ./backend
    environment:
      MONGODB_URI: mongodb://mongodb:27017/aether
      PORT: "5001"
    ports:
      - "5001:5001"
    depends_on:
      - mongodb

  mongodb:
    image: mongo:7
    volumes:
      - mongodata:/data/db

volumes:
  mongodata:`,
        output: 'One command (docker compose up) starts the whole stack with correct wiring.',
        caption: 'Multi-service local environment',
      },
      { type: 'heading', content: '6. Diagnosing a container that will not start' },
      {
        type: 'steps',
        items: [
          'docker compose ps — is the container Exited, and what exit code?',
          'docker compose logs <service> — read the application error, not just the status',
          'Exit 1 with no logs usually means a bad CMD path or a missing build artifact',
          'Port already allocated means another process holds the host port',
          'Permission denied on a volume often means a UID mismatch with the non-root user',
          'docker compose config validates the YAML and shows resolved values',
        ],
      },
    ],
    examples: [
      {
        title: 'Simple: build and run',
        kind: 'Simple',
        explanation: 'The two commands you will use constantly.',
        language: 'bash',
        code: `docker build -t myapp:1.0 .
docker run --rm -p 5001:5001 myapp:1.0`,
        output: 'The service is reachable at http://localhost:5001.',
      },
      {
        title: 'Real world: a Compose stack for a Node + MongoDB app',
        kind: 'Real world',
        explanation:
          'Compose replaces a page of manual setup with one declarative file.',
        language: 'bash',
        code: `docker compose build
docker compose up -d
docker compose ps
docker compose logs -f backend
docker compose exec mongodb mongosh
docker compose down          # add -v to also delete volumes`,
        output: 'The whole stack is up, observable and reversible.',
      },
      {
        title: 'Interview style: explaining a small production image',
        kind: 'Interview style',
        explanation:
          'Interviewers look for image size, security and cache-aware ordering.',
        language: 'text',
        code: `"I use a multi-stage build: one stage compiles, the runtime stage copies only
 dist and production dependencies, so the final image has no toolchain.
 I pin the base tag, run as a non-root USER, add a .dockerignore, and order
 the Dockerfile so dependency installation stays cached when source changes."`,
        output: 'Size, security, reproducibility and build speed in one answer.',
      },
    ],
    commonMistakes: [
      {
        title: 'Copying everything before installing dependencies',
        wrong: 'COPY . .\nRUN npm install\nCOPY . .',
        wrongLanguage: 'dockerfile',
        why: 'Copying the source first invalidates the dependency layer on every code change, so npm install reruns on every build.',
        fix: 'COPY package*.json ./\nRUN npm ci\nCOPY . .',
        fixLanguage: 'dockerfile',
      },
      {
        title: 'Using localhost to reach another service',
        wrong: 'MONGODB_URI=mongodb://localhost:27017/aether',
        wrongLanguage: 'yaml',
        why: 'Inside a container, localhost is that container. The database runs in a different container, so the connection is refused.',
        fix: 'MONGODB_URI=mongodb://mongodb:27017/aether   # service name on the shared network',
        fixLanguage: 'yaml',
      },
      {
        title: 'Storing data in the container filesystem',
        wrong: 'docker run mongo:7      # database data lives in the container layer',
        wrongLanguage: 'bash',
        why: 'Deleting or recreating the container discards everything written inside it. Containers are disposable by design.',
        fix: 'docker run -v mongodata:/data/db mongo:7',
        fixLanguage: 'bash',
      },
    ],
    interviewTips: [
      {
        question: 'Why does the order of Dockerfile instructions affect build time?',
        answer:
          'Docker caches layers by hashing the instruction and its inputs. Once a layer changes, every later layer must be rebuilt. Copying dependency manifests and installing before copying source means a code change only invalidates the final copy layer instead of reinstalling every package.',
        difficulty: 'intermediate',
      },
      {
        question: 'What is the difference between a volume and a bind mount?',
        answer:
          'A volume is managed by Docker and lives in its storage area — best for persistent data such as databases. A bind mount maps a host path directly into the container — convenient in development for live code, but it couples the container to the host filesystem layout.',
        difficulty: 'intermediate',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Write a Dockerfile for a Python script that prints a message and build it.',
        hint: 'FROM python:3.12-slim, WORKDIR, COPY, CMD ["python", "app.py"].',
      },
      {
        level: 'MEDIUM',
        prompt: 'Containerise a Node API with a multi-stage build and compare the image size against a single-stage build.',
        hint: 'docker images shows sizes. The runtime stage uses npm ci --omit=dev and copies only dist.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Write a Compose file with an API, a database and a cache that share a network and use named volumes, then explain each directive.',
        hint: 'Use a user-defined network (implicit in Compose), named volumes for the database, and environment variables pointing at service names.',
      },
    ],
    quiz: [
      {
        id: 'docker-q1',
        question: 'What does a container share with the host?',
        options: ['Its kernel', 'Its filesystem', 'Its network namespace', 'Nothing'],
        correctIndex: 0,
        explanation: 'Containers share the host kernel, which is why they start so much faster and are far smaller than virtual machines.',
        difficulty: 'beginner',
        topicTag: 'fundamentals',
      },
      {
        id: 'docker-q2',
        question: 'Which instruction order keeps dependency installation cached on code changes?',
        options: [
          'COPY . . then RUN npm install',
          'COPY package*.json ./ then RUN npm ci then COPY . .',
          'RUN npm install then COPY . .',
          'COPY . . twice',
        ],
        correctIndex: 1,
        explanation: 'Dependencies are installed from the manifests first, so a source edit only invalidates the final COPY layer.',
        difficulty: 'intermediate',
        topicTag: 'dockerfile',
      },
      {
        id: 'docker-q3',
        question: 'How should one container reach another in Docker Compose?',
        options: ['http://localhost:port', 'http://127.0.0.1:port', 'http://service-name:port', 'http://host.docker.internal always'],
        correctIndex: 2,
        explanation: 'Compose gives containers DNS entries by service name on a shared network. localhost would refer to the calling container itself.',
        difficulty: 'beginner',
        topicTag: 'networking',
      },
      {
        id: 'docker-q4',
        question: 'Which mechanism persists database data across container recreation?',
        options: ['A bind mount into /tmp', 'A named volume', 'The image layer', 'An environment variable'],
        correctIndex: 1,
        explanation: 'Named volumes live outside the container lifecycle, so data survives docker compose down and image rebuilds.',
        difficulty: 'beginner',
        topicTag: 'volumes',
      },
      {
        id: 'docker-q5',
        question: 'What is the main benefit of a multi-stage build?',
        options: [
          'Faster container start',
          'A smaller final image without build tooling or dev dependencies',
          'It allows multiple base operating systems',
          'It removes the need for a Dockerfile',
        ],
        correctIndex: 1,
        explanation: 'Only the compiled output and production dependencies are copied into the final stage, which reduces size and attack surface.',
        difficulty: 'intermediate',
        topicTag: 'multi-stage',
      },
    ],
    resources: [
      { title: 'Dockerfile reference', url: 'https://docs.docker.com/reference/dockerfile/', provider: 'Docker Inc.', type: 'DOCUMENTATION' },
      { title: 'Docker Compose file reference', url: 'https://docs.docker.com/compose/compose-file/', provider: 'Docker Inc.', type: 'DOCUMENTATION' },
      { title: 'Best practices for writing Dockerfiles', url: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/', provider: 'Docker Inc.', type: 'ARTICLE' },
    ],
    nextTopicSlugs: ['system-design-basics'],
    relatedTopicSlugs: ['git-github', 'computer-networks', 'nodejs'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },
];
