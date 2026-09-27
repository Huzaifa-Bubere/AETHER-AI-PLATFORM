import type { SeedTopic } from './types';

/**
 * The foundation topic. `programming-basics` is the first node of every role
 * roadmap and the prerequisite referenced by python/javascript/java, so it must
 * be a real lesson rather than a dangling link.
 */
export const TOPICS_PART5: SeedTopic[] = [
  {
    slug: 'programming-basics',
    title: 'Programming Fundamentals',
    shortDescription: 'How programs actually work: values, variables, control flow, functions, and how to debug them.',
    description:
      'Programming is the skill of breaking a problem into precise steps a computer can execute. Before any language or framework, you need the small set of ideas every programming language shares: storing values in variables, making decisions with conditions, repeating work with loops, grouping logic into functions, and finding mistakes with a debugger. This topic teaches those ideas without tying you to one language.',
    whyItMatters:
      'Every later topic is a variation on these fundamentals. A candidate who can reason about variables, control flow, and functions can learn Python, Java, or JavaScript quickly; a candidate who skipped them gets stuck on syntax instead of problem solving. Interviews test this layer constantly — often disguised as a simple coding question.',
    interviewRelevance:
      'Coding rounds assume these ideas are automatic. Interviewers watch how you decompose a problem, how you name things, how you handle edge cases, and whether you can explain your reasoning out loud. "Walk me through your logic" is the most common follow-up in any interview.',
    group: 'Core CS',
    order: 0,
    level: 'beginner',
    estimatedMinutes: 40,
    skillSlugs: ['programming-basics', 'problem-solving', 'debugging'],
    roleSlugs: ['software-engineer', 'backend-developer', 'frontend-developer', 'fullstack-developer', 'data-analyst'],
    prerequisites: [],
    learningObjectives: [
      'Explain what a program, a variable and a value are',
      'Store and update data in variables of different types',
      'Control the flow of a program with conditions and loops',
      'Break repeated logic into functions with parameters and return values',
      'Trace a program line by line to predict its output',
      'Find and fix errors using a debugger and print statements',
      'Recognise the three main kinds of programming error: syntax, runtime and logic',
    ],
    sections: [
      { type: 'heading', content: 'What is a program?' },
      {
        type: 'paragraph',
        content:
          'A program is an ordered list of instructions that a computer executes one after another. The computer has no common sense: it does exactly what you wrote, in the order you wrote it. Most programming mistakes are not "the computer being wrong" — they are a mismatch between what you meant and what you actually wrote.',
      },
      {
        type: 'list',
        items: [
          'Source code — the instructions you write, as text',
          'Variables — named boxes that hold a value while the program runs',
          'Control flow — conditions and loops that decide which instructions run next',
          'Functions — named groups of instructions you can reuse',
          'Input / output — reading data in and showing results out',
        ],
      },
      { type: 'heading', content: 'Variables and values' },
      {
        type: 'paragraph',
        content:
          'A variable is a name that points at a value in memory. You assign a value with = and read it later by using its name. The value has a type (a number, a piece of text, a true/false flag), and the type determines what operations make sense. Adding two numbers is arithmetic; joining two pieces of text is concatenation.',
      },
      {
        type: 'table',
        columns: ['Type', 'Example', 'Typical use'],
        rows: [
          ['Number', '42, 3.14', 'counts, prices, measurements'],
          ['Text (string)', '"AETHER"', 'names, messages, identifiers'],
          ['Boolean', 'true / false', 'flags and conditions'],
          ['List / array', '[10, 20, 30]', 'ordered collections of values'],
        ],
      },
      {
        type: 'tip',
        content:
          'Name variables after their meaning (totalPrice), not their type or a placeholder (x, temp, data2). Good names remove the need for most comments and are read by interviewers as evidence of how you think.',
      },
      { type: 'heading', content: 'Control flow: conditions and loops' },
      {
        type: 'paragraph',
        content:
          'A condition runs a block of code only when something is true. A loop repeats a block either a fixed number of times or until a condition changes. Almost every algorithm you will ever write is a combination of these two ideas plus arithmetic.',
      },
      {
        type: 'compare',
        leftTitle: 'Condition (if / else)',
        leftItems: ['Choose between paths', 'Each branch runs at most once', 'Used for validation, branching logic'],
        rightTitle: 'Loop (for / while)',
        rightItems: ['Repeat work', 'Runs zero or many times', 'Used for aggregation, search, transformation'],
      },
      { type: 'heading', content: 'Functions' },
      {
        type: 'paragraph',
        content:
          'A function takes inputs (parameters), does one job, and returns a result. Functions let you name an idea and reuse it, which is how programs stay readable as they grow. The rule of thumb: if you wrote the same three lines twice, they belong in a function.',
      },
      {
        type: 'code',
        language: 'python',
        caption: 'A function that names one idea and returns a value',
        code: `def average(numbers):
    if not numbers:
        return 0
    return sum(numbers) / len(numbers)

print(average([10, 20, 30]))   # 20.0`,
        output: '20.0',
      },
      { type: 'heading', content: 'How to debug' },
      {
        type: 'steps',
        items: [
          'Read the error message and note the line number — it usually names the real problem.',
          'Print the values just before the failure; the wrong value tells you which line is actually broken.',
          'Shrink the input to the smallest example that still fails.',
          'Fix one thing at a time and re-run; changing three lines at once hides which fix worked.',
          'Once it passes, test the edge cases: empty input, single item, very large input.',
        ],
      },
      {
        type: 'warning',
        content:
          'Fixing an error by changing code you do not understand often hides a second bug. Always explain to yourself why the fix works before moving on.',
      },
      { type: 'heading', content: 'Where programs run' },
      {
        type: 'table',
        columns: ['Kind', 'What happens', 'Typical languages'],
        rows: [
          ['Compiled', 'Source is translated to machine code before running', 'C, C++, Java (to bytecode), Go'],
          ['Interpreted', 'A program reads and executes your source directly', 'Python, JavaScript, Ruby'],
        ],
      },
      {
        type: 'note',
        content:
          'Compiled vs interpreted affects startup time and error timing, not the fundamentals. Your variables, loops and functions mean the same thing in both.',
      },
    ],
    examples: [
      {
        title: 'Variables and arithmetic',
        kind: 'Simple',
        explanation: 'Store values, compute with them, print a result. This is the smallest complete program shape.',
        language: 'python',
        code: `price = 799
quantity = 2
total = price * quantity
print(total)`,
        output: '1598',
      },
      {
        title: 'Reading user input',
        kind: 'User input',
        explanation: 'input() always returns text, so convert it before doing arithmetic.',
        language: 'python',
        code: `name = input("Enter your name: ")
age = int(input("Enter your age: "))
print(f"Hello {name}, next year you will be {age + 1}.")`,
        output: `Enter your name: Huzaifa
Enter your age: 21
Hello Huzaifa, next year you will be 22.`,
      },
      {
        title: 'Real world: total of a shopping list',
        kind: 'Real world',
        explanation: 'A loop plus an accumulator is the pattern behind almost every running total, score or counter in real software.',
        language: 'python',
        code: `cart = [799, 1299, 249]
total = 0
for price in cart:
    total += price

if total > 2000:
    total = total * 0.9      # 10% discount
print(f"Payable: {total:.2f}")`,
        output: 'Payable: 2112.30',
      },
      {
        title: 'Interview style: find the maximum',
        kind: 'Interview style',
        explanation:
          'The classic "walk through your logic" question. Describe the invariant: best always holds the largest value seen so far.',
        language: 'python',
        code: `def largest(values):
    best = values[0]          # start with the first value
    for v in values[1:]:
        if v > best:          # invariant: best is the largest so far
            best = v
    return best

print(largest([3, 9, 4, 9, 1]))`,
        output: '9',
      },
    ],
    commonMistakes: [
      {
        title: 'Mixing text and numbers',
        wrong: `age = input("Age: ")       # returns text
print(age + 1)`,
        wrongLanguage: 'python',
        why:
          'input() returns a string. Adding a number to text is a type error — the language refuses rather than guessing what you meant.',
        fix: `age = int(input("Age: "))  # convert first
print(age + 1)`,
        fixLanguage: 'python',
      },
      {
        title: 'Off-by-one in a loop',
        wrong: `items = [10, 20, 30]
for i in range(1, 4):
    print(items[i])      # IndexError on the last pass`,
        wrongLanguage: 'python',
        why:
          'range(1, 4) produces 1, 2, 3 — but the valid indexes are 0, 1, 2. The loop reads one element past the end.',
        fix: `for i in range(len(items)):
    print(items[i])      # or simply: for item in items`,
        fixLanguage: 'python',
      },
      {
        title: 'Using a variable before assigning it',
        wrong: `def total(cart):
    for price in cart:
        running = price      # re-created on every iteration
    return running           # NameError when cart is empty`,
        wrongLanguage: 'python',
        why:
          'The variable only exists if the loop body ran at least once. An empty list therefore crashes at the return statement.',
        fix: `def total(cart):
    running = 0              # always defined
    for price in cart:
        running += price
    return running`,
        fixLanguage: 'python',
      },
      {
        title: 'Comparing values with the wrong operator',
        wrong: `if score = 100:
    print("perfect")`,
        wrongLanguage: 'python',
        why:
          'A single = assigns a value; comparison uses ==. In Python this is a syntax error, which is exactly the fault a debugger points at immediately.',
        fix: `if score == 100:
    print("perfect")`,
        fixLanguage: 'python',
      },
    ],
    interviewTips: [
      {
        question: 'Walk me through what your code does, line by line.',
        answer:
          'Describe the shape first (variable → loop → condition → return), then the invariant. For a max-finding loop: "best holds the largest value seen so far; every iteration either keeps it or replaces it, so after the final iteration it holds the maximum." Naming the invariant is what separates a clear explanation from narrating syntax.',
        difficulty: 'beginner',
      },
      {
        question: 'What is the difference between a syntax error, a runtime error and a logic error?',
        answer:
          'A syntax error means the program never starts — the code is not valid (a missing bracket). A runtime error happens while running and crashes at a specific line (index out of range, dividing by zero). A logic error runs fine but produces the wrong answer — the hardest kind, because nothing tells you where it went wrong; you need tests and tracing.',
        difficulty: 'beginner',
      },
      {
        question: 'How would you test this function?',
        answer:
          'List the edge cases out loud: empty input, a single element, all-equal values, negative numbers, and the largest expected input. Interviewers ask this to see whether you think about boundaries rather than only the happy path.',
        difficulty: 'intermediate',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Write a program that prints the numbers 1 to 10, one per line.',
        hint: 'A single loop over a range prints all ten values; no condition needed.',
        expectedKeywords: ['for', 'range', 'print'],
      },
      {
        level: 'MEDIUM',
        prompt:
          'Given a list of numbers, print the largest and the smallest without using the built-in max()/min() functions.',
        hint: 'Start both trackers with the first element and update them inside one loop.',
        expectedKeywords: ['loop', 'compare', 'best', 'worst'],
      },
      {
        level: 'CHALLENGE',
        prompt:
          'Write a function that returns the average of the numbers in a list, and returns 0 for an empty list. Then explain what your function does for a list containing one number.',
        hint: 'Guard the empty case before dividing — dividing by zero is a runtime error.',
        expectedKeywords: ['len', 'sum', 'empty', 'division'],
      },
    ],
    quiz: [
      {
        id: 'basics-q1',
        question: 'What does a variable store?',
        options: ['A name pointing at a value in memory', 'A file on disk', 'A compiler setting', 'A network address'],
        correctIndex: 0,
        explanation:
          'A variable is a named reference to a value. The value has a type; the name is how your code reads and reassigns it.',
        difficulty: 'beginner',
        topicTag: 'variables',
      },
      {
        id: 'basics-q2',
        question: 'Which construct repeats a block of instructions?',
        options: ['An if statement', 'A loop', 'A function definition', 'A comment'],
        correctIndex: 1,
        explanation: 'Loops (for/while) repeat work; an if statement chooses a path and runs at most once.',
        difficulty: 'beginner',
        topicTag: 'loops',
      },
      {
        id: 'basics-q3',
        question: 'In Python, what is wrong with `if score = 100:`?',
        options: [
          '= assigns instead of compares, so it is a syntax error',
          'Nothing, it works',
          'score must be a string',
          'The 100 must be quoted',
        ],
        correctIndex: 0,
        explanation: 'Comparison uses ==; a single = is assignment, and using it in a condition is a syntax error.',
        difficulty: 'beginner',
        topicTag: 'conditions',
      },
      {
        id: 'basics-q4',
        question: 'A program runs without crashing but prints the wrong total. What kind of error is that?',
        options: ['Syntax error', 'Runtime error', 'Logic error', 'Compile error'],
        correctIndex: 2,
        explanation:
          'The program is valid and does not crash, but its behaviour does not match the intent — a logic error, usually found with tests and tracing.',
        difficulty: 'beginner',
        topicTag: 'debugging',
      },
      {
        id: 'basics-q5',
        question: 'Why prefer a function over copy-pasting the same logic in three places?',
        options: [
          'It makes the code execute faster',
          'One named place to fix and reuse, so behaviour stays consistent',
          'Functions are required by the compiler',
          'It reduces the file size on disk',
        ],
        correctIndex: 1,
        explanation:
          'The benefit is maintainability: a single definition means a single fix, and the name documents the intent. Performance is a separate concern.',
        difficulty: 'intermediate',
        topicTag: 'functions',
      },
    ],
    resources: [
      {
        title: 'Python: an informal introduction',
        url: 'https://docs.python.org/3/tutorial/introduction.html',
        provider: 'Python',
        type: 'DOCUMENTATION',
      },
      {
        title: 'MDN: JavaScript first steps',
        url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting',
        provider: 'MDN',
        type: 'DOCUMENTATION',
      },
      {
        title: 'Harvard CS50: Introduction to Computer Science',
        url: 'https://cs50.harvard.edu/x/',
        provider: 'Harvard University',
        type: 'PRACTICE',
      },
    ],
    nextTopicSlugs: ['python', 'javascript', 'git-github'],
    relatedTopicSlugs: ['algorithms', 'data-structures'],
  },
];
