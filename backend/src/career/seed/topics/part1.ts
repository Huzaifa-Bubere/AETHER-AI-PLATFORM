import type { SeedTopic } from './types';

/** Programming languages + version control. */
export const TOPICS_PART1: SeedTopic[] = [
  {
    slug: 'python',
    title: 'Python',
    shortDescription: 'Readable, general-purpose language used for backend services, automation, data analysis and AI.',
    description:
      'Python is a high-level, dynamically typed language known for readable syntax and a huge standard library. It powers backend APIs, data pipelines, machine learning, scripting and automation. Learning Python means learning to think in terms of variables, control flow, functions and collections, then composing them into programs.',
    whyItMatters:
      'Python is the fastest language to become productive in and it appears in almost every placement stack: backend services (FastAPI/Django/Flask), data analysis (pandas), AI/ML (PyTorch, scikit-learn) and automation scripts. Because the syntax is clean, interviewers use it to test problem-solving rather than language trivia.',
    interviewRelevance:
      'Python is accepted in most coding rounds. Interviewers probe mutability, comprehensions, shallow vs deep copy, generators, the GIL and the difference between lists, tuples, sets and dictionaries.',
    group: 'Programming Languages',
    order: 1,
    level: 'beginner',
    estimatedMinutes: 45,
    skillSlugs: ['python'],
    roleSlugs: ['backend-developer', 'data-analyst', 'ai-ml-engineer'],
    courseSlugs: ['python-fundamentals'],
    prerequisites: [],
    optionalPrerequisites: ['programming-basics'],
    learningObjectives: [
      'Write and run a Python program with variables and expressions',
      'Use the core data types: int, float, str, bool and None',
      'Control program flow with if/elif/else and for/while loops',
      'Define and call functions with parameters and return values',
      'Work with the four core collections: list, tuple, set and dict',
      'Read user input and format output with f-strings',
      'Recognise and avoid beginner mistakes like index errors and mutable default arguments',
    ],
    sections: [
      { type: 'heading', content: 'What is Python?' },
      {
        type: 'paragraph',
        content:
          'Python is an interpreted, dynamically typed language. You write a .py file, the Python interpreter reads it line by line and executes it. There is no compilation step you have to manage yourself, and no type declarations required — a variable takes the type of whatever value you assign to it.',
      },
      {
        type: 'list',
        items: [
          'Interpreted — runs directly from source, great for quick iteration',
          'Dynamically typed — types are checked while the program runs',
          'Indentation matters — indentation is the block structure, not decoration',
          'Batteries included — the standard library covers files, JSON, HTTP, dates and more',
        ],
      },
      { type: 'heading', content: '1. Syntax and variables' },
      {
        type: 'paragraph',
        content:
          'A variable is a name bound to a value. Python is dynamically typed, so you never declare the type — but the value still has a type, and understanding it prevents most beginner bugs.',
      },
      {
        type: 'code',
        language: 'python',
        code: `name = "Huzaifa"      # str
age = 21              # int
percentage = 87.5     # float
is_placed = False     # bool
address = None        # NoneType

print(type(age))      # <class 'int'>`,
        output: `<class 'int'>`,
        caption: 'Variables take the type of the assigned value',
      },
      { type: 'heading', content: '2. Operators' },
      {
        type: 'list',
        items: [
          'Arithmetic: +  -  *  /  // (floor division)  % (remainder)  ** (power)',
          'Comparison: ==  !=  <  <=  >  >=  — always produce a bool',
          'Logical: and  or  not  — short-circuit evaluation',
          'Membership: in / not in — works on strings and collections',
        ],
      },
      {
        type: 'warning',
        content:
          'Division with / always returns a float (7 / 2 is 3.5). Use // when you need an integer result (7 // 2 is 3). In coding rounds this difference silently breaks index arithmetic.',
      },
      { type: 'heading', content: '3. Conditions and loops' },
      {
        type: 'code',
        language: 'python',
        code: `score = 72

if score >= 85:
    grade = "A"
elif score >= 70:
    grade = "B"
else:
    grade = "C"

total = 0
for number in range(1, 6):   # 1,2,3,4,5
    total += number

attempts = 0
while total < 100 and attempts < 5:
    attempts += 1
    total += 10`,
        output: `grade = "B"; total = 115; attempts = 3`,
        caption: 'if/elif/else plus for and while loops',
      },
      { type: 'heading', content: '4. Functions' },
      {
        type: 'paragraph',
        content:
          'A function packages logic behind a name. Parameters pass data in, return sends a result out. Use type hints to document intent — they are checked by tools, not by the interpreter.',
      },
      {
        type: 'code',
        language: 'python',
        code: `def apply_discount(price: float, percent: float = 10.0) -> float:
    """Return the price after a percentage discount."""
    if percent < 0 or percent > 100:
        raise ValueError("percent must be between 0 and 100")
    return round(price * (1 - percent / 100), 2)

print(apply_discount(799))        # uses the default
print(apply_discount(799, 25))    # explicit discount`,
        output: `719.1\n599.25`,
        caption: 'Default parameters and a docstring',
      },
      { type: 'heading', content: '5. The four core collections' },
      {
        type: 'table',
        columns: ['Collection', 'Ordered', 'Mutable', 'Duplicates', 'Typical use'],
        rows: [
          ['list', 'yes', 'yes', 'yes', 'an ordered sequence you change often'],
          ['tuple', 'yes', 'no', 'yes', 'a fixed record you never modify'],
          ['set', 'no', 'yes', 'no', 'fast membership tests and de-duplication'],
          ['dict', 'yes (3.7+)', 'yes', 'keys unique', 'key → value lookup'],
        ],
      },
      {
        type: 'code',
        language: 'python',
        code: `marks = [78, 91, 65, 91]
marks.append(88)              # list: mutable
unique_marks = set(marks)     # set: duplicates removed
point = (4.5, 7.2)            # tuple: cannot be changed
student = {"name": "Aisha", "cgpa": 8.7}
student["branch"] = "CSE"     # dict: add a key

print(len(marks), sorted(unique_marks), student["name"])`,
        output: `5 [65, 78, 88, 91] Aisha`,
        caption: 'list, set, tuple and dict in one place',
      },
      {
        type: 'tip',
        content:
          'Prefer a set or dict for lookups. `value in some_list` scans every element (O(n)); `value in some_set` is a hash lookup (O(1)). This single change turns many brute-force solutions into efficient ones.',
      },
    ],
    examples: [
      {
        title: 'Simple variables and output',
        kind: 'Simple',
        explanation: 'The smallest complete program: bind values to names and print them.',
        language: 'python',
        code: `name = "Huzaifa"
age = 21
print(name, "is", age, "years old")`,
        output: `Huzaifa is 21 years old`,
      },
      {
        title: 'Reading user input',
        kind: 'User input',
        explanation:
          'input() always returns a string. Convert with int() or float() before doing arithmetic — this is the most common beginner error.',
        language: 'python',
        code: `name = input("Enter your name: ")
marks = int(input("Enter your marks: "))

if marks >= 40:
    print("Hello", name, "- you passed")
else:
    print("Hello", name, "- please reappear")`,
        output: `Enter your name: Ali
Enter your marks: 67
Hello Ali - you passed`,
      },
      {
        title: 'Real-world: a shopping total',
        kind: 'Real world',
        explanation: 'Real programs combine variables, arithmetic and formatting.',
        language: 'python',
        code: `PRODUCT_PRICE = 799
QUANTITY = 2
GST_PERCENT = 18

subtotal = PRODUCT_PRICE * QUANTITY
gst = subtotal * GST_PERCENT / 100
total = subtotal + gst

print(f"Subtotal: {subtotal}")
print(f"GST 18%:  {gst:.2f}")
print(f"Total:    {total:.2f}")`,
        output: `Subtotal: 1598
GST 18%:  287.64
Total:    1885.64`,
      },
      {
        title: 'Interview style: swapping and comprehensions',
        kind: 'Interview style',
        explanation:
          'Python allows tuple-unpacking swaps with no temporary variable, and list comprehensions replace many explicit loops. Interviewers expect both.',
        language: 'python',
        code: `a, b = 10, 20
a, b = b, a                  # swap without a temp variable

squares = [n * n for n in range(6)]
evens = [n for n in squares if n % 2 == 0]
lookup = {n: n * n for n in range(4)}

print(a, b)          # 20 10
print(squares)       # [0, 1, 4, 9, 16, 25]
print(evens)         # [0, 4, 16]
print(lookup)        # {0: 0, 1: 1, 2: 4, 3: 9}`,
        output: `20 10
[0, 1, 4, 9, 16, 25]
[0, 4, 16]
{0: 0, 1: 1, 2: 4, 3: 9}`,
      },
    ],
    commonMistakes: [
      {
        title: 'Index out of range',
        wrong: 'arr = [10, 20, 30]\nprint(arr[3])',
        wrongLanguage: 'python',
        why: 'Valid indices are 0 to len(arr) - 1. arr[3] asks for a fourth element in a three-element list, so Python raises IndexError.',
        fix: 'arr = [10, 20, 30]\nprint(arr[len(arr) - 1])   # 30\nprint(arr[-1])             # 30, the idiomatic last element',
        fixLanguage: 'python',
      },
      {
        title: 'Forgetting that input() returns a string',
        wrong: 'age = input("Age: ")\nprint(age + 1)',
        wrongLanguage: 'python',
        why: 'input() always returns str. Adding an int to a str raises TypeError.',
        fix: 'age = int(input("Age: "))\nprint(age + 1)',
        fixLanguage: 'python',
      },
      {
        title: 'Using a mutable default argument',
        wrong: 'def add_item(item, bucket=[]):\n    bucket.append(item)\n    return bucket',
        wrongLanguage: 'python',
        why: 'Default arguments are evaluated once, when the function is defined. Every call reuses the same list, so results leak between calls.',
        fix: 'def add_item(item, bucket=None):\n    if bucket is None:\n        bucket = []\n    bucket.append(item)\n    return bucket',
        fixLanguage: 'python',
      },
    ],
    interviewTips: [
      {
        question: 'When would you use a tuple instead of a list?',
        answer:
          'Use a tuple for a fixed-shape record that should not change (coordinates, a database row, a dict key). Immutability documents intent, is slightly cheaper, and tuples can be dictionary keys or set members because they are hashable — lists cannot.',
        difficulty: 'beginner',
      },
      {
        question: 'What is the difference between a shallow copy and a deep copy?',
        answer:
          'A shallow copy (list(), slicing, copy.copy) creates a new outer container but the inner objects are still shared. A deep copy (copy.deepcopy) recursively copies everything. For a list of lists, modifying an inner list of a shallow copy also changes the original.',
        difficulty: 'intermediate',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Read two numbers from the user and print their sum, difference, product and quotient.',
        hint: 'Convert both inputs with float() before calculating. Guard the division against zero.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Given a list of marks, print the highest, lowest and average score rounded to 2 decimals.',
        hint: 'Built-ins max(), min() and sum() combined with len() keep this to a few lines.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Remove duplicates from a list while preserving the original order, then print both the original and the cleaned list.',
        hint: 'A set tracks what you have already seen, while a separate list keeps the ordering. A dict also preserves insertion order.',
      },
    ],
    quiz: [
      {
        id: 'python-q1',
        question: 'What does 7 // 2 evaluate to in Python 3?',
        options: ['3.5', '3', '4', '2'],
        correctIndex: 1,
        explanation: '// is floor division, so 7 // 2 is 3. The single slash 7 / 2 would return the float 3.5.',
        difficulty: 'beginner',
        topicTag: 'operators',
      },
      {
        id: 'python-q2',
        question: 'Which collection cannot contain duplicate values?',
        options: ['list', 'tuple', 'set', 'str'],
        correctIndex: 2,
        explanation: 'A set stores unique hashable elements, so adding a duplicate is a no-op.',
        difficulty: 'beginner',
        topicTag: 'collections',
      },
      {
        id: 'python-q3',
        question: 'What type does input() return?',
        options: ['int', 'float', 'str', 'bool'],
        correctIndex: 2,
        explanation: 'input() always returns a string. You must convert it with int() or float() before arithmetic.',
        difficulty: 'beginner',
        topicTag: 'user-input',
      },
      {
        id: 'python-q4',
        question: 'What is printed by: x = [1, 2]; y = x; y.append(3); print(x)',
        options: ['[1, 2]', '[1, 2, 3]', 'Error', '[3]'],
        correctIndex: 1,
        explanation: 'y = x binds a second name to the SAME list object, so appending through y is visible through x. Use y = x[:] or y = list(x) for a copy.',
        difficulty: 'intermediate',
        topicTag: 'references',
      },
      {
        id: 'python-q5',
        question: 'Which lookup is fastest on average for 10,000 elements?',
        options: ['value in a_list', 'value in a_tuple', 'value in a_set', 'value in a_string'],
        correctIndex: 2,
        explanation: 'Sets are hash-based, giving average O(1) membership tests. Lists, tuples and strings scan linearly in O(n).',
        difficulty: 'intermediate',
        topicTag: 'collections',
      },
    ],
    resources: [
      { title: 'The Python Tutorial', url: 'https://docs.python.org/3/tutorial/', provider: 'Python Software Foundation', type: 'DOCUMENTATION' },
      { title: 'Python Built-in Types', url: 'https://docs.python.org/3/library/stdtypes.html', provider: 'Python Software Foundation', type: 'DOCUMENTATION' },
      { title: 'PEP 8 — Style Guide for Python Code', url: 'https://peps.python.org/pep-0008/', provider: 'Python Software Foundation', type: 'ARTICLE' },
    ],
    nextTopicSlugs: ['data-structures'],
    relatedTopicSlugs: ['git-github', 'sql', 'algorithms'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },

  {
    slug: 'javascript',
    title: 'JavaScript',
    shortDescription: 'The language of the web — used in browsers, Node.js backends and modern full-stack apps.',
    description:
      'JavaScript runs everywhere: in every browser, on servers through Node.js, in mobile apps and even in databases. It is single-threaded with an event loop, prototype-based, and historically loosely typed — which is why understanding its quirks matters more than memorising syntax.',
    whyItMatters:
      'Any frontend role requires JavaScript, and with Node.js it covers the backend too. Because it is ubiquitous, interviewers use it to test asynchronous thinking (callbacks, promises, async/await), scope and closures, and equality semantics.',
    interviewRelevance:
      'Common round topics: let vs const vs var, the event loop, closures, == vs ===, this binding, array methods (map/filter/reduce) and promise ordering.',
    group: 'Programming Languages',
    order: 2,
    level: 'beginner',
    estimatedMinutes: 50,
    skillSlugs: ['javascript'],
    roleSlugs: ['frontend-developer', 'full-stack-developer', 'backend-developer'],
    courseSlugs: [],
    prerequisites: [],
    optionalPrerequisites: ['programming-basics'],
    learningObjectives: [
      'Declare variables with let and const and explain why var is avoided',
      'Use functions, arrow functions and scope correctly',
      'Work with objects and arrays plus their most useful methods',
      'Understand == vs === and when coercion surprises you',
      'Reason about asynchronous code: callbacks, promises and async/await',
      'Use the event loop model to predict output order',
    ],
    sections: [
      { type: 'heading', content: 'What is JavaScript?' },
      {
        type: 'paragraph',
        content:
          'JavaScript is a dynamically typed, prototype-based scripting language with a single-threaded execution model. "Single-threaded" does not mean it cannot handle concurrency — it means one call stack, with asynchronous work queued and executed by the event loop.',
      },
      { type: 'heading', content: '1. Variables: let, const, var' },
      {
        type: 'code',
        language: 'javascript',
        code: `const PI = 3.14159;      // cannot be reassigned
let count = 0;           // reassignable, block-scoped
count = count + 1;

var legacy = 'avoid';    // function-scoped, hoisted — legacy only

// const means the BINDING is constant, not the value:
const marks = [78, 91];
marks.push(65);          // allowed — the array itself changed`,
        output: 'marks is now [78, 91, 65]',
        caption: 'const prevents reassignment, not mutation',
      },
      {
        type: 'warning',
        content:
          'Use const by default and let only when you must reassign. Avoid var: it is function-scoped and hoisted, which hides bugs that let surfaces immediately.',
      },
      { type: 'heading', content: '2. Functions and arrow functions' },
      {
        type: 'code',
        language: 'javascript',
        code: `function add(a, b) {
  return a + b;
}

const multiply = (a, b) => a * b;          // implicit return
const square = n => n * n;                 // single parameter

// Arrow functions do NOT have their own 'this'
const counter = {
  value: 0,
  increment() {
    setTimeout(() => { this.value += 1; }, 10);
  }
};`,
        output: 'add(2,3) → 5, multiply(2,3) → 6, square(5) → 25',
        caption: 'Function declarations vs arrow functions',
      },
      { type: 'heading', content: '3. Objects and arrays' },
      {
        type: 'code',
        language: 'javascript',
        code: `const student = { name: 'Aisha', cgpa: 8.7, skills: ['js', 'sql'] };

// Destructuring
const { name, cgpa = 0 } = student;

// Spread creates a new object (shallow copy)
const updated = { ...student, cgpa: 9.1 };

// The three array methods that matter most
const nums = [1, 2, 3, 4, 5];
const doubled = nums.map(n => n * 2);
const evens = nums.filter(n => n % 2 === 0);
const total = nums.reduce((acc, n) => acc + n, 0);`,
        output: 'doubled = [2,4,6,8,10]  evens = [2,4]  total = 15',
        caption: 'map, filter and reduce replace most manual loops',
      },
      { type: 'heading', content: '4. Equality: == vs ===' },
      {
        type: 'list',
        items: [
          '=== compares value AND type — use this everywhere',
          '== performs type coercion first: "5" == 5 is true, 0 == "" is true',
          'null == undefined is true, but null === undefined is false',
          'NaN is never equal to itself — use Number.isNaN(x)',
        ],
      },
      { type: 'heading', content: '5. Asynchronous JavaScript' },
      {
        type: 'code',
        language: 'javascript',
        code: `// Promise chain
fetch('/api/user')
  .then(res => res.json())
  .then(user => console.log(user.name))
  .catch(err => console.error('failed', err));

// async/await is the same thing, written linearly
async function loadUser() {
  try {
    const res = await fetch('/api/user');
    const user = await res.json();
    return user.name;
  } catch (err) {
    console.error('failed', err);
    return null;
  }
}`,
        output: 'Both forms log the user name or handle the error.',
        caption: 'await pauses the async function, never the whole thread',
      },
      {
        type: 'tip',
        content:
          'await only pauses the enclosing async function. Everything after the await runs in a microtask once the promise settles — which is why it never blocks the browser UI.',
      },
    ],
    examples: [
      {
        title: 'Simple: variables and template output',
        kind: 'Simple',
        explanation: 'The default building block — declare with const and log with a template literal.',
        language: 'javascript',
        code: `const name = 'Huzaifa';
const age = 21;
console.log(name + ' is ' + age + ' years old');`,
        output: 'Huzaifa is 21 years old',
      },
      {
        title: 'Working with data',
        kind: 'Real world',
        explanation: 'Shaping API-shaped data is the daily job in a frontend or Node service.',
        language: 'javascript',
        code: `const submissions = [
  { problem: 'Two Sum', score: 92, status: 'Accepted' },
  { problem: 'Valid Parentheses', score: 55, status: 'Wrong Answer' },
  { problem: 'Binary Search', score: 88, status: 'Accepted' }
];

const accepted = submissions.filter(s => s.status === 'Accepted');
const average = submissions.reduce((sum, s) => sum + s.score, 0) / submissions.length;

console.log(accepted.map(s => s.problem));
console.log('average', average.toFixed(1));`,
        output: `[ 'Two Sum', 'Binary Search' ]
average 78.3`,
      },
      {
        title: 'Asynchronous fetch with error handling',
        kind: 'Real world',
        explanation:
          'Every real frontend needs loading and error states. async/await with try/catch is the readable form.',
        language: 'javascript',
        code: `async function loadProblems() {
  try {
    const res = await fetch('/api/coding/problems');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return data.problems;
  } catch (err) {
    console.error('Could not load problems:', err.message);
    return [];
  }
}`,
        output: 'Returns an array, or [] plus a logged error when it fails.',
      },
      {
        title: 'Interview style: closures and the classic loop bug',
        kind: 'Interview style',
        explanation:
          'var is function-scoped, so all three callbacks share one variable. let creates a fresh binding per iteration — the standard interview answer.',
        language: 'javascript',
        code: `// Buggy with var
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log('var:', i), 0);   // 3, 3, 3
}

// Correct with let
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log('let:', j), 0);   // 0, 1, 2
}`,
        output: `var: 3
var: 3
var: 3
let: 0
let: 1
let: 2`,
      },
    ],
    commonMistakes: [
      {
        title: 'Relying on == coercion',
        wrong: "if (userInput == 0) { /* runs for '' , '0' and [] */ }",
        wrongLanguage: 'javascript',
        why: '== coerces types, so an empty string, the string "0" and an empty array all compare equal to 0. This produces bugs that look impossible.',
        fix: "if (Number(userInput) === 0) { /* explicit and predictable */ }",
        fixLanguage: 'javascript',
      },
      {
        title: 'Mutating instead of copying state',
        wrong: 'const next = state;\nnext.count += 1;   // state changed too!',
        wrongLanguage: 'javascript',
        why: 'Objects and arrays are reference types. Assigning does not copy, so both names point at the same object and React will not re-render.',
        fix: 'const next = { ...state, count: state.count + 1 };',
        fixLanguage: 'javascript',
      },
      {
        title: 'Forgetting to await a promise',
        wrong: 'const user = getUser();\nconsole.log(user.name);   // TypeError: undefined',
        wrongLanguage: 'javascript',
        why: 'An async function returns a promise. Reading .name before awaiting reads a property of the promise, not of the resolved value.',
        fix: 'const user = await getUser();\nconsole.log(user.name);',
        fixLanguage: 'javascript',
      },
    ],
    interviewTips: [
      {
        question: 'Explain the event loop and why setTimeout(fn, 0) does not run immediately.',
        answer:
          'Synchronous code runs to completion on the call stack. setTimeout schedules its callback in the macrotask queue, and the event loop only moves it to the stack once the current stack is empty (after all pending microtasks such as promise callbacks have drained). So the 0 ms delay really means "after the current synchronous work".',
        difficulty: 'intermediate',
      },
      {
        question: 'What is a closure and where would you actually use one?',
        answer:
          'A closure is a function that keeps access to variables from the scope in which it was created, even after that scope has returned. Practical uses: memoisation caches, private counters, once-only guards, and React hooks that capture the latest props.',
        difficulty: 'intermediate',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Given an array of numbers, return a new array containing only the even numbers doubled.',
        hint: 'Chain filter then map. Both return new arrays and leave the input untouched.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Write a function that counts how many times each word appears in a sentence and returns an object of word → count.',
        hint: 'Use reduce with an object accumulator; start each missing word at 0.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Implement a debounce function that delays a callback until the caller has stopped invoking it for N milliseconds, and explain where you would use it.',
        hint: 'Keep a timer id in a closure; clear the previous timeout on each call. Useful for search inputs and resize handlers.',
      },
    ],
    quiz: [
      {
        id: 'js-q1',
        question: 'What is logged: console.log("5" === 5)',
        options: ['true', 'false', 'undefined', 'TypeError'],
        correctIndex: 1,
        explanation: '=== compares type as well as value. The string "5" is not the number 5, so the result is false.',
        difficulty: 'beginner',
        topicTag: 'equality',
      },
      {
        id: 'js-q2',
        question: 'Which declaration is block-scoped and cannot be reassigned?',
        options: ['var', 'let', 'const', 'function'],
        correctIndex: 2,
        explanation: 'const is block-scoped like let, but the binding cannot be reassigned. (Objects it points to can still be mutated.)',
        difficulty: 'beginner',
        topicTag: 'variables',
      },
      {
        id: 'js-q3',
        question: 'What does [1,2,3,4].filter(n => n % 2).map(n => n * 10) return?',
        options: ['[10, 30]', '[2, 4]', '[10, 20, 30, 40]', '[1, 3]'],
        correctIndex: 0,
        explanation: 'filter keeps the odd numbers [1,3] because n % 2 is truthy for them, then map multiplies each by 10 giving [10, 30].',
        difficulty: 'beginner',
        topicTag: 'array-methods',
      },
      {
        id: 'js-q4',
        question: 'Why does the callback capture the final value of a var loop counter but not a let counter?',
        options: [
          'var is slower',
          'let creates a new binding per iteration while var shares one function-scoped binding',
          'Callbacks cannot read var',
          'let is asynchronous',
        ],
        correctIndex: 1,
        explanation: 'let is block-scoped, so each iteration gets its own binding. var is function-scoped, so every callback closes over the same variable.',
        difficulty: 'intermediate',
        topicTag: 'closures',
      },
      {
        id: 'js-q5',
        question: 'What does an async function always return?',
        options: ['The resolved value directly', 'A Promise', 'undefined', 'A callback'],
        correctIndex: 1,
        explanation: 'An async function always returns a Promise. A returned value resolves it; a thrown error rejects it.',
        difficulty: 'intermediate',
        topicTag: 'async',
      },
    ],
    resources: [
      { title: 'MDN JavaScript Guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', provider: 'MDN Web Docs', type: 'DOCUMENTATION' },
      { title: 'MDN Array reference', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array', provider: 'MDN Web Docs', type: 'DOCUMENTATION' },
      { title: 'ECMAScript Language Specification', url: 'https://tc39.es/ecma262/', provider: 'TC39', type: 'DOCUMENTATION' },
    ],
    nextTopicSlugs: ['react', 'nodejs'],
    relatedTopicSlugs: ['rest-api', 'git-github'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },

  {
    slug: 'java',
    title: 'Java',
    shortDescription: 'Statically typed, class-based language behind enterprise backends and Android apps.',
    description:
      'Java is a statically typed, object-oriented language that compiles to bytecode and runs on the Java Virtual Machine. Its strong typing and mature ecosystem make it the default for large backends, and it is still the most common language in service-based placement interviews.',
    whyItMatters:
      'A large share of product companies run Java services (Spring Boot). Java also forces you to think about types, memory and object design — skills that transfer to every other language.',
    interviewRelevance:
      'Expect questions on the difference between an interface and an abstract class, String immutability, == vs equals(), collections complexity, exceptions and JVM memory areas.',
    group: 'Programming Languages',
    order: 3,
    level: 'beginner',
    estimatedMinutes: 50,
    skillSlugs: ['java'],
    roleSlugs: ['backend-developer', 'full-stack-developer'],
    courseSlugs: [],
    prerequisites: [],
    optionalPrerequisites: ['programming-basics'],
    learningObjectives: [
      'Write a class with fields, methods and constructors',
      'Use Java primitive types and understand the wrapper-class difference',
      'Control flow with if, switch, for, while and enhanced for',
      'Explain String immutability and use StringBuilder for concatenation loops',
      'Understand == vs equals() and implement equals/hashCode correctly',
      'Use List, Set and Map from the collections framework appropriately',
    ],
    sections: [
      { type: 'heading', content: 'What is Java?' },
      {
        type: 'paragraph',
        content:
          'Java source compiles to bytecode that the Java Virtual Machine executes. That indirection gives Java its "write once, run anywhere" property. Java is statically typed — every variable has a declared type checked at compile time, which catches whole categories of bugs before the program runs.',
      },
      { type: 'heading', content: '1. Types and variables' },
      {
        type: 'code',
        language: 'java',
        code: `public class Basics {
    public static void main(String[] args) {
        int age = 21;              // 32-bit integer
        long population = 1_400_000_000L;
        double percentage = 87.5;  // 64-bit floating point
        boolean isPlaced = false;
        char grade = 'A';
        String name = "Huzaifa";   // reference type, not a primitive

        System.out.println(name + " is " + age);
    }
}`,
        output: 'Huzaifa is 21',
        caption: 'Primitives vs String, which is a reference type',
      },
      {
        type: 'note',
        content:
          'Java requires a semicolon at the end of every statement and a matching brace for every block. `public static void main(String[] args)` is the entry point.',
      },
      { type: 'heading', content: '2. Classes, objects and constructors' },
      {
        type: 'code',
        language: 'java',
        code: `public class Student {
    private final String name;      // encapsulated state
    private double cgpa;

    public Student(String name, double cgpa) {
        this.name = name;
        this.cgpa = cgpa;
    }

    public double getCgpa() { return cgpa; }

    public void addSemester(double gpa) {   // behaviour lives with the data
        this.cgpa = (this.cgpa + gpa) / 2;
    }

    @Override
    public String toString() {
        return name + " (" + cgpa + ")";
    }
}`,
        output: 'A Student object exposes behaviour (addSemester) but keeps fields private',
        caption: 'Encapsulation: private fields, public methods',
      },
      { type: 'heading', content: '3. == vs equals()' },
      {
        type: 'list',
        items: [
          '== on primitives compares values',
          '== on objects compares REFERENCES (same memory address)',
          'equals() compares content — but only if the class overrides it',
          'String literals are interned, so two identical literals may be the same object (which makes == appear to work until it does not)',
        ],
      },
      {
        type: 'code',
        language: 'java',
        code: `String a = "hello";
String b = "hello";
String c = new String("hello");

System.out.println(a == b);        // true  (same interned literal)
System.out.println(a == c);        // false (different objects)
System.out.println(a.equals(c));   // true  (same content)`,
        output: `true
false
true`,
        caption: 'Content comparison must use equals()',
      },
      { type: 'heading', content: '4. Collections' },
      {
        type: 'table',
        columns: ['Interface', 'Implementation', 'get', 'add', 'contains'],
        rows: [
          ['List', 'ArrayList', 'O(1)', 'O(1) amortised', 'O(n)'],
          ['List', 'LinkedList', 'O(n)', 'O(1)', 'O(n)'],
          ['Set', 'HashSet', 'not indexed', 'O(1)', 'O(1)'],
          ['Set', 'TreeSet', 'not indexed', 'O(log n)', 'O(log n)'],
          ['Map', 'HashMap', 'O(1)', 'O(1)', 'O(1)'],
        ],
      },
      {
        type: 'tip',
        content:
          'Interview favourite: ArrayList for fast indexed reads, HashSet/HashMap for O(1) lookup. Switching from a nested loop over a List to a single pass with a HashMap is the standard O(n²) → O(n) optimisation.',
      },
      {
        type: 'code',
        language: 'java',
        code: `import java.util.*;

List<String> skills = new ArrayList<>();
skills.add("java");
skills.add("sql");

Map<String, Integer> counts = new HashMap<>();
for (String s : skills) {
    counts.put(s, counts.getOrDefault(s, 0) + 1);
}

Set<String> unique = new HashSet<>(skills);
System.out.println(skills.size() + " " + unique.size());`,
        output: '2 2',
        caption: 'List, Map and Set working together',
      },
      { type: 'heading', content: '5. Strings are immutable' },
      {
        type: 'paragraph',
        content:
          'A String cannot be changed. Every "modification" creates a new String object. In a loop, that allocates one object per iteration — use StringBuilder instead.',
      },
      {
        type: 'warning',
        content:
          'String concatenation inside a loop is O(n²) in the number of characters. Prefer StringBuilder: it appends in place and calls toString() once at the end.',
      },
    ],
    examples: [
      {
        title: 'Hello world with typed variables',
        kind: 'Simple',
        explanation: 'The smallest compilable Java program, showing declared types.',
        language: 'java',
        code: `public class Hello {
    public static void main(String[] args) {
        String name = "Huzaifa";
        int age = 21;
        System.out.println(name + " is " + age + " years old");
    }
}`,
        output: 'Huzaifa is 21 years old',
      },
      {
        title: 'Reading input with Scanner',
        kind: 'User input',
        explanation: 'Scanner converts text input into the type you ask for.',
        language: 'java',
        code: `import java.util.Scanner;

public class InputDemo {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter your name: ");
        String name = sc.nextLine();
        System.out.print("Enter your marks: ");
        int marks = sc.nextInt();

        if (marks >= 40) {
            System.out.println("Hello " + name + " - you passed");
        } else {
            System.out.println("Hello " + name + " - please reappear");
        }
        sc.close();
    }
}`,
        output: 'Enter your name: Ali / Enter your marks: 67 / Hello Ali - you passed',
      },
      {
        title: 'Real world: O(n²) → O(n) with a HashMap',
        kind: 'Real world',
        explanation:
          'The single most useful Java interview pattern: replace a nested scan with one pass and a map.',
        language: 'java',
        code: `import java.util.*;

public class TwoSum {
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int need = target - nums[i];
            if (seen.containsKey(need)) {
                return new int[] { seen.get(need), i };
            }
            seen.put(nums[i], i);
        }
        return new int[0];
    }

    public static void main(String[] args) {
        System.out.println(Arrays.toString(twoSum(new int[] { 2, 7, 11, 15 }, 9)));
    }
}`,
        output: '[0, 1]',
      },
      {
        title: 'Interview style: StringBuilder in a loop',
        kind: 'Interview style',
        explanation:
          'Interviewers often ask you to justify StringBuilder. The reason is object allocation: each + on a String copies the whole string.',
        language: 'java',
        code: `StringBuilder sb = new StringBuilder();
for (int i = 1; i <= 5; i++) {
    sb.append(i);
    if (i < 5) sb.append("-");
}
System.out.println(sb.toString());   // 1-2-3-4-5`,
        output: '1-2-3-4-5',
      },
    ],
    commonMistakes: [
      {
        title: 'Comparing Strings with ==',
        wrong: 'if (input == "yes") { ... }',
        wrongLanguage: 'java',
        why: '== compares object references. A string built at runtime is a different object from the interned literal, so the check fails unpredictably.',
        fix: 'if ("yes".equals(input)) { ... }   // null-safe ordering',
        fixLanguage: 'java',
      },
      {
        title: 'Integer division truncating silently',
        wrong: 'double average = 7 / 2;   // 3.0 not 3.5',
        wrongLanguage: 'java',
        why: 'Both operands are ints, so the division happens in integer arithmetic and truncates before assignment to double.',
        fix: 'double average = 7 / 2.0;   // or cast one side: (double) 7 / 2',
        fixLanguage: 'java',
      },
      {
        title: 'Modifying a list while iterating it',
        wrong: 'for (String s : list) {\n    if (s.isEmpty()) list.remove(s);   // ConcurrentModificationException\n}',
        wrongLanguage: 'java',
        why: 'The enhanced for loop uses an iterator; removing through the list invalidates that iterator.',
        fix: 'list.removeIf(String::isEmpty);   // or use an explicit Iterator.remove()',
        fixLanguage: 'java',
      },
    ],
    interviewTips: [
      {
        question: 'Why is String immutable in Java?',
        answer:
          'Immutability makes String safe to share (including as HashMap keys, whose hash must not change), makes string pooling possible, and removes thread-safety concerns. The cost is allocation on every modification, which is why StringBuilder exists.',
        difficulty: 'intermediate',
      },
      {
        question: 'Interface vs abstract class — when do you choose which?',
        answer:
          'Use an interface to declare a capability that unrelated types can implement (Comparable, Runnable). Use an abstract class when related types share state or partial implementation. A class can implement many interfaces but extend only one class, so interfaces give more flexibility.',
        difficulty: 'intermediate',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Print the numbers 1 to 10, but print "Even" instead of even numbers.',
        hint: 'Use the remainder operator n % 2 == 0 inside the loop.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Reverse a String without using StringBuilder.reverse() and print the result.',
        hint: 'Iterate from the last character down to index 0 and append to a StringBuilder.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Given an array and a target, return the indices of the two numbers that add to the target in O(n) time. Justify the complexity.',
        hint: 'One pass with a HashMap of value → index. Explain why the nested-loop version is O(n²) and how the map removes the inner scan.',
      },
    ],
    quiz: [
      {
        id: 'java-q1',
        question: 'What does 7 / 2 evaluate to when both operands are int?',
        options: ['3.5', '3', '4', 'Compile error'],
        correctIndex: 1,
        explanation: 'Integer division truncates toward zero, so 7 / 2 is 3. Use 7 / 2.0 for 3.5.',
        difficulty: 'beginner',
        topicTag: 'operators',
      },
      {
        id: 'java-q2',
        question: 'Which comparison correctly compares String content?',
        options: ['s1 == s2', 's1.equals(s2)', 's1.compare(s2)', 's1.isEqual(s2)'],
        correctIndex: 1,
        explanation: 'equals() compares content. == compares object references, which only appears to work for interned literals.',
        difficulty: 'beginner',
        topicTag: 'strings',
      },
      {
        id: 'java-q3',
        question: 'Which collection gives average O(1) membership testing with no duplicates?',
        options: ['ArrayList', 'LinkedList', 'HashSet', 'TreeSet'],
        correctIndex: 2,
        explanation: 'HashSet is hash-based with average O(1) add/contains and stores unique elements. TreeSet is ordered but O(log n).',
        difficulty: 'intermediate',
        topicTag: 'collections',
      },
      {
        id: 'java-q4',
        question: 'Why is StringBuilder preferred over String concatenation inside a loop?',
        options: [
          'StringBuilder is thread-safe',
          'String is immutable so each concatenation allocates a new object',
          'String cannot be concatenated in a loop',
          'StringBuilder sorts characters',
        ],
        correctIndex: 1,
        explanation: 'String is immutable. Every + creates a new String, making the loop O(n²) in characters. StringBuilder appends in place.',
        difficulty: 'intermediate',
        topicTag: 'strings',
      },
      {
        id: 'java-q5',
        question: 'Is Java passed by value or by reference?',
        options: [
          'Always by reference',
          'Always by value — object references are passed by value',
          'Primitives by value, objects by reference',
          'Depends on the JVM',
        ],
        correctIndex: 1,
        explanation: 'Java is always pass-by-value. For objects, the VALUE that is copied is the reference, so you can mutate the object but cannot reassign the caller\'s variable.',
        difficulty: 'advanced',
        topicTag: 'memory',
      },
    ],
    resources: [
      { title: 'Java Tutorials (Oracle)', url: 'https://docs.oracle.com/javase/tutorial/', provider: 'Oracle', type: 'DOCUMENTATION' },
      { title: 'Java Collections Framework', url: 'https://docs.oracle.com/javase/8/docs/technotes/guides/collections/overview.html', provider: 'Oracle', type: 'DOCUMENTATION' },
      { title: 'Java Language Specification', url: 'https://docs.oracle.com/javase/specs/', provider: 'Oracle', type: 'DOCUMENTATION' },
    ],
    nextTopicSlugs: ['data-structures'],
    relatedTopicSlugs: ['sql', 'algorithms'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },

  {
    slug: 'git-github',
    title: 'Git & GitHub',
    shortDescription: 'Distributed version control plus the collaboration platform every team uses.',
    description:
      'Git records snapshots of your project so you can branch, experiment and merge safely. GitHub hosts those repositories and adds pull requests, reviews and CI. Together they are the backbone of professional software work.',
    whyItMatters:
      'Every engineering team assumes Git fluency. An interviewer who opens your GitHub profile learns more about how you work than any single answer you give — clean, small, well-described commits matter.',
    interviewRelevance:
      'Typical questions: merge vs rebase, how you resolve a conflict, what a pull request should contain, and how you would undo a commit that is already pushed.',
    group: 'DevOps & Tooling',
    order: 4,
    level: 'beginner',
    estimatedMinutes: 40,
    skillSlugs: ['git'],
    roleSlugs: ['backend-developer', 'frontend-developer', 'devops-engineer', 'full-stack-developer'],
    courseSlugs: [],
    prerequisites: [],
    learningObjectives: [
      'Explain the working directory, staging area and commit history',
      'Create branches and integrate work with merge or rebase',
      'Resolve a merge conflict deliberately instead of panicking',
      'Undo changes safely at each stage of the workflow',
      'Open a reviewable pull request with a meaningful description',
      'Keep a history that a teammate can read later',
    ],
    sections: [
      { type: 'heading', content: 'What is Git?' },
      {
        type: 'paragraph',
        content:
          'Git is a distributed version control system. Every clone contains the full history, so most operations are local and fast. GitHub is a hosting service built on top of Git — Git is the tool, GitHub is the place you share it.',
      },
      {
        type: 'list',
        items: [
          'Working directory — the files you are editing right now',
          'Staging area (index) — the exact snapshot you are about to commit',
          'Repository — the committed history',
          'Remote — another copy of the repository, usually on GitHub',
        ],
      },
      { type: 'heading', content: '1. The everyday loop' },
      {
        type: 'code',
        language: 'bash',
        code: `git status                      # what changed?
git add src/app.ts              # stage one file
git add .                       # stage everything
git commit -m "Fix login redirect for expired tokens"
git push origin feature/login-fix`,
        output: 'Your change is now in the remote branch.',
        caption: 'status → add → commit → push',
      },
      { type: 'heading', content: '2. Branching' },
      {
        type: 'code',
        language: 'bash',
        code: `git checkout -b feature/resume-pdf     # create and switch
git switch main                        # modern equivalent of checkout
git branch -d feature/resume-pdf       # delete a merged branch
git fetch --prune                      # remove stale remote branches`,
        output: 'Branches are pointers to commits — creating one is instant.',
        caption: 'Branch names should describe the change',
      },
      { type: 'heading', content: '3. Merge vs rebase' },
      {
        type: 'compare',
        leftTitle: 'merge',
        rightTitle: 'rebase',
        leftItems: [
          'Preserves the real history including the merge commit',
          'Safe on branches that others already have',
          'Can make history look like a tangle of parallel lines',
        ],
        rightItems: [
          'Replays your commits on top of the target branch',
          'Produces a linear, easy-to-read history',
          'Rewrites commit hashes — never rebase shared branches',
        ],
      },
      {
        type: 'tip',
        content:
          'A practical rule: rebase your own feature branch to keep it current, then merge it into main with a pull request. Avoid rebasing anything that has already been pushed and shared.',
      },
      { type: 'heading', content: '4. Resolving a conflict' },
      {
        type: 'paragraph',
        content:
          'A conflict happens when two commits change the same lines. Git marks the region and asks you to decide — it never guesses.',
      },
      {
        type: 'code',
        language: 'bash',
        code: `<<<<<<< HEAD
const timeout = 30000;
=======
const timeout = 60000;
>>>>>>> feature/longer-timeout

# Edit the file to keep exactly one correct version, remove the markers, then:
git add src/config/timeouts.ts
git commit`,
        output: 'The conflict is resolved and recorded as a normal merge commit.',
        caption: 'Conflict markers show both sides',
      },
      { type: 'heading', content: '5. Undoing things safely' },
      {
        type: 'table',
        columns: ['Situation', 'Command', 'Effect'],
        rows: [
          ['Unstaged file edits', 'git restore file', 'Discards local changes to that file'],
          ['Staged but not committed', 'git restore --staged file', 'Unstages, keeps the edits'],
          ['Last commit not pushed', 'git commit --amend', 'Rewrites the last commit'],
          ['Last commit already pushed', 'git revert <hash>', 'Adds a new commit that undoes it — safe'],
        ],
      },
      {
        type: 'warning',
        content:
          '`git reset --hard` destroys uncommitted work and `git push --force` can erase teammates\' commits. On a shared branch, prefer `git revert`, which adds a new undo commit instead of rewriting history.',
      },
      { type: 'heading', content: '6. A pull request people can review' },
      {
        type: 'list',
        items: [
          'One logical change per PR — a reviewer should finish it in one sitting',
          'A title that states the outcome: "Add ATS resume templates", not "changes"',
          'A description: what changed, why, how you tested it, screenshots if it is UI',
          'Tests or a manual verification note for anything non-trivial',
          'Small commits with imperative messages: "Fix null check in parser", not "fixed stuff"',
        ],
      },
    ],
    examples: [
      {
        title: 'Starting a repository',
        kind: 'Simple',
        explanation: 'Create a repo, make the first commit and connect it to GitHub.',
        language: 'bash',
        code: `git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/user/project.git
git push -u origin main`,
        output: 'Local repository is now published to origin/main.',
      },
      {
        title: 'A complete feature workflow',
        kind: 'Real world',
        explanation: 'The loop you will repeat every day at work.',
        language: 'bash',
        code: `git switch main
git pull --ff-only
git switch -c feature/ats-score
# ... edit files ...
git add .
git commit -m "Add deterministic ATS scoring engine"
git push -u origin feature/ats-score
# open a pull request on GitHub, get it reviewed, then merge`,
        output: 'Main stays green while work happens on an isolated branch.',
      },
      {
        title: 'Recovering from a mistaken commit',
        kind: 'Real world',
        explanation: 'Which undo command to use depends on whether the commit was pushed.',
        language: 'bash',
        code: `# Not pushed yet — amend the message or content
git commit --amend -m "Correct the commit message"

# Already pushed — create an explicit undo commit
git revert 9f3c1ab
git push origin main`,
        output: 'A revert commit is added; history is not rewritten.',
      },
      {
        title: 'Interview style: explaining your Git workflow',
        kind: 'Interview style',
        explanation:
          'Interviewers listen for branching discipline, review habits and safe undo strategy.',
        language: 'text',
        code: `"For each task I create a short-lived branch off main.
I commit in small logical steps with messages that explain the why.
Before opening a PR I rebase onto the latest main and run the tests locally.
The PR includes a description of what changed and how I verified it.
If a bug reaches main, I use git revert rather than rewriting shared history."`,
        output: 'This answers the question with process, not just commands.',
      },
    ],
    commonMistakes: [
      {
        title: 'Committing secrets',
        wrong: 'git add .env\ngit commit -m "add config"',
        wrongLanguage: 'bash',
        why: 'Once a secret is committed it stays in history, and rotating the key is the only real fix. Anyone with clone access sees it.',
        fix: 'echo ".env" >> .gitignore\ngit rm --cached .env        # untrack without deleting locally',
        fixLanguage: 'bash',
      },
      {
        title: 'Force-pushing a shared branch',
        wrong: 'git push --force origin main',
        wrongLanguage: 'bash',
        why: 'Force-push replaces the remote branch, discarding commits your teammates pushed after you last fetched.',
        fix: 'git pull --rebase origin main\ngit push origin main        # or git push --force-with-lease if truly required',
        fixLanguage: 'bash',
      },
      {
        title: 'One giant commit',
        wrong: 'git add . && git commit -m "various changes"',
        wrongLanguage: 'bash',
        why: 'A reviewer cannot tell what belongs to what, and a later revert removes unrelated work.',
        fix: 'Stage and commit one logical change at a time:\ngit add src/services/atsEngine.ts\ngit commit -m "Add deterministic ATS weights"',
        fixLanguage: 'bash',
      },
    ],
    interviewTips: [
      {
        question: 'Explain the difference between merge and rebase.',
        answer:
          'Merge joins two histories and creates a merge commit, preserving exactly what happened. Rebase replays your commits onto a new base, producing a linear history but new commit hashes. Use merge for shared branches, rebase for tidying your own unpushed work.',
        difficulty: 'intermediate',
      },
      {
        question: 'How do you undo a commit that is already on the remote?',
        answer:
          'git revert <hash> creates a new commit that reverses the change, so history stays intact for everyone else. force-push would rewrite shared history and break other clones, so it is reserved for your own unshared branch.',
        difficulty: 'intermediate',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Create a repository, make two commits with descriptive messages, and view the log in one line per commit.',
        hint: 'git log --oneline --graph --decorate shows the branch structure compactly.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Create a branch, change the same line of a file as main, then merge and resolve the conflict deliberately.',
        hint: 'Conflict markers show both versions. Delete the markers, keep the correct code, then git add and commit.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Simulate a bad commit pushed to a shared branch, then undo it on the remote without rewriting history.',
        hint: 'git revert finds the commit and adds the inverse change; then push normally.',
      },
    ],
    quiz: [
      {
        id: 'git-q1',
        question: 'Which command stages all current changes?',
        options: ['git commit -a', 'git add .', 'git push', 'git stage --all-files'],
        correctIndex: 1,
        explanation: 'git add . stages changes in the current directory tree into the index.',
        difficulty: 'beginner',
        topicTag: 'workflow',
      },
      {
        id: 'git-q2',
        question: 'What is the safest way to undo a commit that is already pushed to a shared branch?',
        options: ['git reset --hard', 'git revert', 'git push --force', 'Delete the branch'],
        correctIndex: 1,
        explanation: 'git revert adds a new commit that cancels the change, leaving shared history intact for everyone else.',
        difficulty: 'intermediate',
        topicTag: 'undo',
      },
      {
        id: 'git-q3',
        question: 'Why should you avoid rebasing a branch others have already pulled?',
        options: [
          'It is slower',
          'It rewrites commit hashes, so their local history no longer matches',
          'It deletes the branch',
          'It cannot be done on GitHub',
        ],
        correctIndex: 1,
        explanation: 'Rebase creates new commits with new hashes. Anyone who based work on the old commits now has a diverged history and will hit confusing conflicts.',
        difficulty: 'intermediate',
        topicTag: 'rebase',
      },
      {
        id: 'git-q4',
        question: 'What does merge conflict markers such as <<<<<<< HEAD indicate?',
        options: [
          'The file is corrupt',
          'Git could not choose between two changes and needs your decision',
          'The branch was deleted',
          'The commit failed',
        ],
        correctIndex: 1,
        explanation: 'Git never guesses. It marks both versions and expects you to keep the correct one, then stage and commit the resolution.',
        difficulty: 'beginner',
        topicTag: 'conflicts',
      },
      {
        id: 'git-q5',
        question: 'Which file tells Git to ignore certain paths?',
        options: ['.gitconfig', '.gitignore', 'git.exclude', '.ignore'],
        correctIndex: 1,
        explanation: '.gitignore lists patterns such as node_modules/, .env and dist/ that Git should not track.',
        difficulty: 'beginner',
        topicTag: 'basics',
      },
    ],
    resources: [
      { title: 'Pro Git (free book)', url: 'https://git-scm.com/book/en/v2', provider: 'Scott Chacon & Ben Straub', type: 'BOOK' },
      { title: 'Git reference manual', url: 'https://git-scm.com/docs', provider: 'Git SCM', type: 'DOCUMENTATION' },
      { title: 'GitHub Docs — Pull requests', url: 'https://docs.github.com/en/pull-requests', provider: 'GitHub', type: 'DOCUMENTATION' },
    ],
    nextTopicSlugs: ['rest-api'],
    relatedTopicSlugs: ['docker', 'javascript', 'python'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },
];
