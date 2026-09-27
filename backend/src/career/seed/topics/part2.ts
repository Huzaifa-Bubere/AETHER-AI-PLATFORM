import type { SeedTopic } from './types';

/** Core CS fundamentals + databases. */
export const TOPICS_PART2: SeedTopic[] = [
  {
    slug: 'data-structures',
    title: 'Data Structures',
    shortDescription: 'Ways of organising data so operations on it become fast: arrays, lists, stacks, queues, hash maps, trees and graphs.',
    description:
      'A data structure is a way of arranging data plus the operations it supports efficiently. Choosing the right one is what turns an O(n²) solution into O(n): the same problem solved with a hash map instead of a nested loop runs a thousand times faster on a 1,000-element input.',
    whyItMatters:
      'Almost every coding interview question is a data-structure choice in disguise. Databases index with B-trees, caches use hash maps, schedulers use heaps and file systems use trees — the structures are everywhere in production systems.',
    interviewRelevance:
      'You will be asked to justify a structure: "why a hash map here?", "why a deque instead of a list?", "what is the complexity of this operation?". Stating the operation costs is expected in every round.',
    group: 'Core CS',
    order: 5,
    level: 'intermediate',
    estimatedMinutes: 60,
    skillSlugs: ['data-structures'],
    roleSlugs: ['backend-developer', 'full-stack-developer', 'software-engineer'],
    prerequisites: ['python'],
    optionalPrerequisites: ['java', 'javascript'],
    learningObjectives: [
      'State the time and space cost of the core operations of each structure',
      'Choose between array, hash map, set, stack, queue and heap for a problem',
      'Implement a stack and a queue using the structures your language provides',
      'Traverse a tree and a graph with BFS and DFS',
      'Recognise when a hash map removes a nested loop',
      'Explain the trade-off between memory and speed for each choice',
    ],
    sections: [
      { type: 'heading', content: 'What is a data structure?' },
      {
        type: 'paragraph',
        content:
          'A data structure defines how values are stored and which operations are cheap. The same set of values can be organised several ways, and the right organisation is what makes an algorithm fast. Complexity is therefore a property of the structure plus the operation, not of the data alone.',
      },
      { type: 'heading', content: '1. The complexity cheat sheet' },
      {
        type: 'table',
        columns: ['Structure', 'Access', 'Search', 'Insert', 'Delete', 'Notes'],
        rows: [
          ['Array / list', 'O(1)', 'O(n)', 'O(n)', 'O(n)', 'fast index, slow middle insert'],
          ['Dynamic array', 'O(1)', 'O(n)', 'O(1)*', 'O(n)', '* amortised when appending at the end'],
          ['Hash map / set', '—', 'O(1)*', 'O(1)*', 'O(1)*', '* average case, worst case O(n)'],
          ['Stack (LIFO)', '—', 'O(n)', 'O(1)', 'O(1)', 'push/pop at one end'],
          ['Queue (FIFO)', '—', 'O(n)', 'O(1)', 'O(1)', 'enqueue at tail, dequeue at head'],
          ['Heap', 'O(1) top', 'O(n)', 'O(log n)', 'O(log n)', 'min/max access is O(1)'],
          ['Balanced BST', '—', 'O(log n)', 'O(log n)', 'O(log n)', 'kept in sorted order'],
          ['Graph (adjacency list)', '—', 'O(V+E)', 'O(1)', 'O(1)', 'traversal is O(V+E)'],
        ],
      },
      { type: 'heading', content: '2. Arrays and lists' },
      {
        type: 'paragraph',
        content:
          'An array stores elements contiguously, so index access is a single arithmetic step. Inserting or deleting in the middle shifts every later element. Appending to a dynamic array is usually O(1) because capacity is doubled when it runs out — that is what "amortised O(1)" means.',
      },
      {
        type: 'code',
        language: 'python',
        code: `arr = [10, 20, 30, 40]

print(arr[2])          # O(1) index access

arr.append(50)         # O(1) amortised (usually no shifting)
arr.insert(0, 5)       # O(n) — every element shifts right
arr.pop()              # O(1) from the end
arr.pop(0)             # O(n) from the front`,
        output: `30`,
        caption: 'Why "remove from the front" is expensive',
      },
      { type: 'heading', content: '3. Hash maps and sets' },
      {
        type: 'paragraph',
        content:
          'A hash map computes a hash of the key to decide where to store the value, giving average O(1) insert, lookup and delete. Hash collisions are resolved internally, which is why "average" matters — a pathological hash function degrades to O(n).',
      },
      {
        type: 'code',
        language: 'python',
        code: `# Nested loop: O(n^2)
def has_duplicate_slow(values):
    for i in range(len(values)):
        for j in range(i + 1, len(values)):
            if values[i] == values[j]:
                return True
    return False

# Hash set: O(n)
def has_duplicate_fast(values):
    seen = set()
    for value in values:
        if value in seen:
            return True
        seen.add(value)
    return False`,
        output: 'Both return the same answer; the second is O(n) instead of O(n²).',
        caption: 'The classic hash-map speedup',
      },
      { type: 'heading', content: '4. Stacks and queues' },
      {
        type: 'compare',
        leftTitle: 'Stack — LIFO',
        rightTitle: 'Queue — FIFO',
        leftItems: [
          'Last in, first out',
          'Operations: push, pop, peek',
          'Used by: undo history, function calls, bracket matching, DFS',
        ],
        rightItems: [
          'First in, first out',
          'Operations: enqueue, dequeue, front',
          'Used by: task schedulers, BFS, rate-limited request buffers',
        ],
      },
      {
        type: 'code',
        language: 'python',
        code: `from collections import deque

stack = []
stack.append("a")          # push
stack.append("b")
print(stack.pop())         # "b" — last in, first out

queue = deque()
queue.append("job1")       # enqueue
queue.append("job2")
print(queue.popleft())     # "job1" — first in, first out`,
        output: `b
job1`,
        caption: 'A list works as a stack; use deque for a queue',
      },
      {
        type: 'warning',
        content:
          'Never use a plain list as a queue with pop(0): that shifts every remaining element and makes the queue O(n) per dequeue. collections.deque gives O(1) popleft().',
      },
      { type: 'heading', content: '5. Trees and graphs' },
      {
        type: 'paragraph',
        content:
          'A tree is a hierarchy with one root and no cycles; a graph is a set of nodes plus edges and may contain cycles. Both are traversed with depth-first (stack/recursion) or breadth-first (queue) search.',
      },
      {
        type: 'code',
        language: 'python',
        code: `from collections import deque

graph = {
    "A": ["B", "C"],
    "B": ["D"],
    "C": ["E"],
    "D": [],
    "E": [],
}

def bfs(graph, start):
    visited, order = {start}, []
    queue = deque([start])
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbour in graph.get(node, []):
            if neighbour not in visited:
                visited.add(neighbour)
                queue.append(neighbour)
    return order

def dfs(graph, node, visited=None, order=None):
    if visited is None:
        visited, order = set(), []
    visited.add(node)
    order.append(node)
    for neighbour in graph.get(node, []):
        if neighbour not in visited:
            dfs(graph, neighbour, visited, order)
    return order

print(bfs(graph, "A"))    # ['A', 'B', 'C', 'D', 'E']
print(dfs(graph, "A"))    # ['A', 'B', 'D', 'C', 'E']`,
        output: `['A', 'B', 'C', 'D', 'E']
['A', 'B', 'D', 'C', 'E']`,
        caption: 'BFS uses a queue, DFS uses recursion (a stack)',
      },
      {
        type: 'tip',
        content:
          'Always track a visited set in graph traversal. Without it, a cycle makes the search loop forever — the single most common graph bug in interviews.',
      },
    ],
    examples: [
      {
        title: 'Simple: remove duplicates with a set',
        kind: 'Simple',
        explanation: 'A set is the fastest way to enforce uniqueness while keeping O(n) time.',
        language: 'python',
        code: `values = [3, 1, 3, 7, 1, 9]
unique = list(dict.fromkeys(values))   # preserves first-seen order
print(unique)`,
        output: `[3, 1, 7, 9]`,
      },
      {
        title: 'Real world: request log analysis',
        kind: 'Real world',
        explanation:
          'Counting occurrences is the most common production use of a hash map.',
        language: 'python',
        code: `logs = ["/home", "/api/user", "/home", "/home", "/api/login"]

counts = {}
for path in logs:
    counts[path] = counts.get(path, 0) + 1

top = sorted(counts.items(), key=lambda item: item[1], reverse=True)[:2]
for path, hits in top:
    print(f"{path}: {hits} requests")`,
        output: `/home: 3 requests
/api/user: 1 requests`,
      },
      {
        title: 'Interview style: balanced brackets with a stack',
        kind: 'Interview style',
        explanation:
          'A stack is the canonical solution because the most recently opened bracket must close first.',
        language: 'python',
        code: `def is_balanced(text):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for char in text:
        if char in pairs:
            if not stack or stack.pop() != pairs[char]:
                return False
        else:
            stack.append(char)
    return not stack

print(is_balanced("({[]})"))   # True
print(is_balanced("({[})"))    # False`,
        output: `True
False`,
      },
    ],
    commonMistakes: [
      {
        title: 'Using a list where a set belongs',
        wrong: 'if value in big_list:   # scans every element — O(n)',
        wrongLanguage: 'python',
        why: 'Membership on a list is linear, so a loop with this check inside becomes O(n²).',
        fix: 'seen = set(big_list)\nif value in seen:      # O(1) average',
        fixLanguage: 'python',
      },
      {
        title: 'Forgetting the visited set in graph traversal',
        wrong: 'def dfs(node):\n    for nxt in graph[node]:\n        dfs(nxt)',
        wrongLanguage: 'python',
        why: 'With any cycle this recurses forever and crashes with a stack overflow.',
        fix: 'def dfs(node, visited=None):\n    visited = visited or set()\n    if node in visited: return\n    visited.add(node)\n    for nxt in graph[node]: dfs(nxt, visited)',
        fixLanguage: 'python',
      },
      {
        title: 'Assuming a hash map is always O(1)',
        wrong: 'Using a custom object as a key without implementing hash/equality',
        wrongLanguage: 'python',
        why: 'If hashing degrades (bad hash function, or objects that all hash equal) lookups become O(n) and the structure loses its advantage.',
        fix: 'Hash on immutable, well-distributed fields and implement equality alongside hashing.',
        fixLanguage: 'python',
      },
    ],
    interviewTips: [
      {
        question: 'When would you use a heap instead of sorting an array?',
        answer:
          'When you need repeated access to only the smallest or largest element. Building a heap is O(n) and each push/pop is O(log n), so finding the k largest of a stream costs O(n log k) instead of re-sorting. Full sorting is O(n log n) and unnecessary if you never need the whole order.',
        difficulty: 'intermediate',
      },
      {
        question: 'Why is a hash map lookup described as O(1) if it can be O(n)?',
        answer:
          'O(1) describes the average case with a good hash distribution: the map computes a bucket index directly instead of scanning. The worst case happens when many keys collide, which good hash functions and resizing make rare. Interviewers expect you to say "average O(1), worst case O(n)".',
        difficulty: 'intermediate',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Given a list of numbers, return the first duplicate value using a set in one pass.',
        hint: 'Add each value to a set and return as soon as you see one already present.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Implement a queue with two stacks and state the amortised complexity of each operation.',
        hint: 'Push onto the input stack; when dequeuing, move everything to the output stack only if it is empty.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Given a directed graph, detect whether it contains a cycle and explain your approach.',
        hint: 'DFS with three node states (unvisited, in-progress, done) — an edge back to an in-progress node is a cycle. Kahn\'s algorithm by in-degree counting also works.',
      },
    ],
    quiz: [
      {
        id: 'ds-q1',
        question: 'What is the average time complexity of a lookup in a hash map?',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        correctIndex: 0,
        explanation: 'Hashing computes the bucket directly, giving average O(1). The worst case with many collisions is O(n).',
        difficulty: 'beginner',
        topicTag: 'hashing',
      },
      {
        id: 'ds-q2',
        question: 'Which structure gives first-in, first-out behaviour?',
        options: ['Stack', 'Queue', 'Set', 'Heap'],
        correctIndex: 1,
        explanation: 'A queue removes the oldest element first. A stack removes the newest (LIFO).',
        difficulty: 'beginner',
        topicTag: 'linear-structures',
      },
      {
        id: 'ds-q3',
        question: 'Why is pop(0) on a Python list O(n)?',
        options: [
          'It rehashes the list',
          'Every remaining element must shift one position left',
          'It sorts the list',
          'It creates a new list internally',
        ],
        correctIndex: 1,
        explanation: 'Removing from the front shifts all n-1 remaining elements. Use collections.deque for O(1) popleft.',
        difficulty: 'intermediate',
        topicTag: 'arrays',
      },
      {
        id: 'ds-q4',
        question: 'Which traversal uses a queue?',
        options: ['Depth-first search', 'Breadth-first search', 'Binary search', 'Merge sort'],
        correctIndex: 1,
        explanation: 'BFS explores level by level and needs a FIFO queue so nearer nodes are processed first. DFS uses a stack or recursion.',
        difficulty: 'beginner',
        topicTag: 'graphs',
      },
      {
        id: 'ds-q5',
        question: 'Finding the k largest elements of a stream is most efficient with which structure?',
        options: ['A sorted array re-sorted each time', 'A min-heap of size k', 'A linked list', 'A stack'],
        correctIndex: 1,
        explanation: 'Keeping a min-heap of size k gives O(n log k): each new element is compared with the heap minimum and the smallest is evicted.',
        difficulty: 'advanced',
        topicTag: 'heaps',
      },
    ],
    resources: [
      { title: 'Python collections module', url: 'https://docs.python.org/3/library/collections.html', provider: 'Python Software Foundation', type: 'DOCUMENTATION' },
      { title: 'Big-O Cheat Sheet', url: 'https://www.bigocheatsheet.com/', provider: 'bigocheatsheet.com', type: 'ARTICLE' },
      { title: 'Java Collections reference', url: 'https://docs.oracle.com/javase/tutorial/collections/', provider: 'Oracle', type: 'DOCUMENTATION' },
    ],
    nextTopicSlugs: ['algorithms'],
    relatedTopicSlugs: ['python', 'algorithms', 'system-design-basics'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },

  {
    slug: 'algorithms',
    title: 'Algorithms',
    shortDescription: 'Recipes for solving problems: searching, sorting, recursion, dynamic programming and complexity analysis.',
    description:
      'An algorithm is a precise sequence of steps that transforms input into output. This topic covers the patterns that appear again and again in interviews and production code: traversal, two pointers, sliding windows, binary search, sorting, recursion with memoisation and the analysis that tells you whether a solution is fast enough.',
    whyItMatters:
      'Interviews measure whether you can find a correct AND efficient approach. Recognising a pattern (this is a sliding window, this needs binary search) is the skill that turns a 45-minute panic into a five-minute plan.',
    interviewRelevance:
      'Expect to state the complexity of your own solution before you are asked, and to explain why a brute-force approach is too slow at the given input bounds.',
    group: 'Core CS',
    order: 6,
    level: 'intermediate',
    estimatedMinutes: 60,
    skillSlugs: ['algorithms', 'problem-solving'],
    roleSlugs: ['backend-developer', 'full-stack-developer', 'software-engineer'],
    prerequisites: ['data-structures'],
    learningObjectives: [
      'Analyse time and space complexity of your own code',
      'Apply binary search to any monotonic search space',
      'Use two pointers and sliding windows for array and string problems',
      'Write recursive solutions and add memoisation to remove repeated work',
      'Choose an appropriate sorting algorithm and know its cost',
      'Explain how input bounds tell you the required complexity',
    ],
    sections: [
      { type: 'heading', content: 'What is an algorithm?' },
      {
        type: 'paragraph',
        content:
          'An algorithm is a definite procedure: a finite sequence of steps that always terminates with the correct output. Two algorithms can both be correct and still differ by orders of magnitude in cost — that difference is what complexity analysis measures.',
      },
      { type: 'heading', content: '1. Reading the input bounds' },
      {
        type: 'table',
        columns: ['Input size n', 'Max acceptable complexity', 'What it rules out'],
        rows: [
          ['n ≤ 10', 'O(n!) or O(2^n)', 'nothing — brute force is fine'],
          ['n ≤ 500', 'O(n^3)', 'fine for nested loops'],
          ['n ≤ 5,000', 'O(n^2)', 'too slow for cubic'],
          ['n ≤ 10^5', 'O(n log n)', 'rules out O(n²)'],
          ['n ≤ 10^6', 'O(n) or O(n log n)', 'rules out anything nested'],
          ['n ≤ 10^8', 'O(n) with a small constant', 'needs a single pass'],
        ],
      },
      {
        type: 'tip',
        content:
          'Read the constraints first. The bound tells you the complexity you must reach, which narrows the technique before you write any code.',
      },
      { type: 'heading', content: '2. Binary search' },
      {
        type: 'paragraph',
        content:
          'Binary search halves the search space on every step, giving O(log n). It requires a monotonic property: either sorted data, or a predicate that is false for a while and then true forever.',
      },
      {
        type: 'code',
        language: 'python',
        code: `def binary_search(nums, target):
    low, high = 0, len(nums) - 1
    while low <= high:
        mid = (low + high) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1

print(binary_search([1, 3, 5, 7, 9, 11], 7))   # 3`,
        output: `3`,
        caption: 'Halving the range each iteration — O(log n)',
      },
      { type: 'heading', content: '3. Two pointers and sliding windows' },
      {
        type: 'code',
        language: 'python',
        code: `# Two pointers on sorted data — O(n) instead of O(n^2)
def has_pair_with_sum(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        current = nums[left] + nums[right]
        if current == target:
            return True
        if current < target:
            left += 1
        else:
            right -= 1
    return False

# Sliding window: longest substring without repeating characters
def longest_unique(text):
    seen = {}
    start, best = 0, 0
    for end, char in enumerate(text):
        if char in seen and seen[char] >= start:
            start = seen[char] + 1
        seen[char] = end
        best = max(best, end - start + 1)
    return best

print(has_pair_with_sum([1, 2, 4, 6, 9], 10))   # True
print(longest_unique("abcabcbb"))                # 3`,
        output: `True
3`,
        caption: 'Both patterns run in a single pass',
      },
      { type: 'heading', content: '4. Recursion and memoisation' },
      {
        type: 'code',
        language: 'python',
        code: `# Without memoisation: O(2^n)
def fib_slow(n):
    if n <= 1:
        return n
    return fib_slow(n - 1) + fib_slow(n - 2)

# With memoisation: O(n)
def fib_fast(n, memo=None):
    if memo is None:
        memo = {}
    if n <= 1:
        return n
    if n in memo:
        return memo[n]
    memo[n] = fib_fast(n - 1, memo) + fib_fast(n - 2, memo)
    return memo[n]

print(fib_fast(40))   # 102334155 — instant`,
        output: `102334155`,
        caption: 'The same recurrence, cached instead of re-explored',
      },
      { type: 'heading', content: '5. Sorting' },
      {
        type: 'list',
        items: [
          'Comparison sorting is Ω(n log n) in the worst case — merge sort and heap sort achieve it',
          'Quicksort averages O(n log n) with O(log n) stack space but degrades to O(n²) on already-sorted input with a naive pivot',
          'Counting sort achieves O(n + k) when values are small integers',
          'Python\'s sorted() and Java\'s Arrays.sort use Timsort/P dual-pivot quicksort tuned for real data',
          'If the input is already sorted, check whether you even need to sort again',
        ],
      },
      {
        type: 'warning',
        content:
          'Do not sort inside a loop. Sorting once is O(n log n); sorting on every one of n iterations is O(n² log n) and is a common cause of time-limit failures.',
      },
    ],
    examples: [
      {
        title: 'Simple: find the maximum in one pass',
        kind: 'Simple',
        explanation: 'A single pass with a running best is O(n) time and O(1) space.',
        language: 'python',
        code: `def find_max(values):
    if not values:
        return None
    best = values[0]
    for value in values[1:]:
        if value > best:
            best = value
    return best

print(find_max([4, 19, -3, 8]))`,
        output: `19`,
      },
      {
        title: 'Real world: the O(n²) → O(n) optimization',
        kind: 'Real world',
        explanation:
          'Best Time to Buy and Sell Stock is the standard example: nested loops compare every pair, one pass tracks the running minimum.',
        language: 'python',
        code: `# Slow: O(n^2)
def max_profit_slow(prices):
    best = 0
    for i in range(len(prices)):
        for j in range(i + 1, len(prices)):
            best = max(best, prices[j] - prices[i])
    return best

# Fast: O(n) — track the cheapest day so far
def max_profit_fast(prices):
    min_price = float("inf")
    best = 0
    for price in prices:
        min_price = min(min_price, price)
        best = max(best, price - min_price)
    return best

print(max_profit_fast([7, 1, 5, 3, 6, 4]))   # 5`,
        output: `5`,
      },
      {
        title: 'Interview style: explain complexity before writing code',
        kind: 'Interview style',
        explanation:
          'Interviewers score your reasoning. Stating the plan and its cost before coding is expected behaviour, not showing off.',
        language: 'text',
        code: `"Input length can be up to 100,000, so O(n^2) would time out.
I will keep a running minimum and update the best profit in one pass,
which gives O(n) time and O(1) extra space.
I will handle the empty and single-element cases first."`,
        output: 'A concise plan that demonstrates the reasoning behind the code.',
      },
    ],
    commonMistakes: [
      {
        title: 'Off-by-one in loop bounds',
        wrong: 'for i in range(len(nums) + 1):\n    print(nums[i])',
        wrongLanguage: 'python',
        why: 'range(len(nums) + 1) produces one index too many, causing an IndexError on the last iteration.',
        fix: 'for i in range(len(nums)):   # or simply: for value in nums:',
        fixLanguage: 'python',
      },
      {
        title: 'Ignoring the input bounds',
        wrong: 'Writing O(n^2) for n = 10^5 and never checking',
        wrongLanguage: 'python',
        why: '10^10 operations will not finish inside a typical 2-second limit, so a correct answer still fails.',
        fix: 'Read the constraints, estimate the operation count, and pick a technique that meets it before coding.',
        fixLanguage: 'python',
      },
      {
        title: 'Mutating the search space in binary search incorrectly',
        wrong: 'if nums[mid] < target:\n    low = mid      # infinite loop',
        wrongLanguage: 'python',
        why: 'If low stays at mid, the range never shrinks and the loop runs forever.',
        fix: 'if nums[mid] < target:\n    low = mid + 1\nelse:\n    high = mid - 1',
        fixLanguage: 'python',
      },
    ],
    interviewTips: [
      {
        question: 'How do you decide between a greedy approach and dynamic programming?',
        answer:
          'Try greedy when a locally optimal choice can be proven never to hurt the global answer (interval scheduling, minimum-price tracking). Reach for DP when the same sub-problem recurs and the optimal answer depends on combinations of earlier choices (coin change, edit distance). If greedy is hard to justify with an exchange argument, use DP.',
        difficulty: 'advanced',
      },
      {
        question: 'What is the difference between recursion and iteration, and when is recursion the right choice?',
        answer:
          'Iteration uses a loop and constant extra space; recursion uses the call stack and matches the shape of the problem (trees, divide-and-conquer, backtracking). Use recursion when the structure is naturally recursive and depth is bounded, then add memoisation if sub-problems repeat.',
        difficulty: 'intermediate',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Print the numbers 1 to 10 and their squares using a single loop.',
        hint: 'One pass, no nested loop. The square of n is n * n.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Find the largest number in a list, then find the second largest in a single pass.',
        hint: 'Track two variables (best and secondBest) and update both carefully when a new maximum appears.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Remove duplicates from a sorted list in place, without allocating a second array, and return the new length.',
        hint: 'Two pointers: one reads, one writes. Since the data is sorted, duplicates are adjacent.',
      },
    ],
    quiz: [
      {
        id: 'algo-q1',
        question: 'What is the time complexity of binary search on a sorted array of n elements?',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        correctIndex: 1,
        explanation: 'Each comparison halves the remaining range, so the number of steps is logarithmic in n.',
        difficulty: 'beginner',
        topicTag: 'searching',
      },
      {
        id: 'algo-q2',
        question: 'Which technique fits "find the longest substring without repeating characters"?',
        options: ['Dynamic programming', 'Sliding window', 'Backtracking', 'Binary search'],
        correctIndex: 1,
        explanation: 'A window expands on the right and shrinks from the left when a duplicate appears, giving O(n).',
        difficulty: 'intermediate',
        topicTag: 'sliding-window',
      },
      {
        id: 'algo-q3',
        question: 'Why does naive recursive Fibonacci take exponential time?',
        options: [
          'It sorts the input',
          'It recomputes the same sub-problems many times',
          'Recursion is always exponential',
          'It uses too much memory',
        ],
        correctIndex: 1,
        explanation: 'fib(n) calls fib(n-1) and fib(n-2), which overlap heavily. Caching each result with memoisation reduces it to O(n).',
        difficulty: 'intermediate',
        topicTag: 'recursion',
      },
      {
        id: 'algo-q4',
        question: 'For n up to 100,000, roughly which complexity is the practical ceiling?',
        options: ['O(n^2)', 'O(n^3)', 'O(n log n)', 'O(2^n)'],
        correctIndex: 2,
        explanation: 'O(n log n) is about 1.7 million operations at n = 10^5, which fits a typical limit. O(n²) would be 10^10 operations.',
        difficulty: 'intermediate',
        topicTag: 'complexity',
      },
      {
        id: 'algo-q5',
        question: 'What is the worst-case time complexity of quicksort with a naive first-element pivot?',
        options: ['O(n log n)', 'O(n^2)', 'O(n)', 'O(log n)'],
        correctIndex: 1,
        explanation: 'On already-sorted input a first-element pivot splits off only one element per level, giving O(n²). Randomised or median pivots avoid this.',
        difficulty: 'advanced',
        topicTag: 'sorting',
      },
    ],
    resources: [
      { title: 'Big-O Cheat Sheet', url: 'https://www.bigocheatsheet.com/', provider: 'bigocheatsheet.com', type: 'ARTICLE' },
      { title: 'Python time complexity wiki', url: 'https://wiki.python.org/moin/TimeComplexity', provider: 'Python Software Foundation', type: 'DOCUMENTATION' },
      { title: 'Introduction to Algorithms (CLRS) — reference text', url: 'https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/', provider: 'MIT Press', type: 'BOOK' },
    ],
    nextTopicSlugs: ['system-design-basics'],
    relatedTopicSlugs: ['data-structures', 'python'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },

  {
    slug: 'sql',
    title: 'SQL',
    shortDescription: 'The relational query language — SELECT, JOIN, GROUP BY, indexes and query plans.',
    description:
      'SQL is the declarative language for relational databases. You describe the result you want and the database decides how to produce it. This topic covers reading data (SELECT), combining tables (JOIN), aggregating (GROUP BY / HAVING), modifying data, and the indexing and plan reading that make queries fast.',
    whyItMatters:
      'Almost every backend role requires SQL. Interview rounds frequently include a written query against a small schema, and production performance problems are very often missing or misused indexes.',
    interviewRelevance:
      'Expect: INNER vs LEFT JOIN, WHERE vs HAVING, GROUP BY semantics, what an index accelerates (and what it does not), how NULL behaves, and finding the second-highest salary or duplicate rows.',
    group: 'Databases',
    order: 7,
    level: 'beginner',
    estimatedMinutes: 55,
    skillSlugs: ['sql', 'mysql', 'postgresql'],
    roleSlugs: ['backend-developer', 'data-analyst', 'full-stack-developer'],
    prerequisites: [],
    learningObjectives: [
      'Write SELECT queries with filtering, ordering and limits',
      'Combine tables with INNER, LEFT and FULL joins and explain the difference',
      'Aggregate with GROUP BY and filter aggregates with HAVING',
      'Use subqueries and common table expressions for readable analysis',
      'Explain how an index changes a query plan and when it is ignored',
      'Handle NULL correctly in comparisons and aggregates',
    ],
    sections: [
      { type: 'heading', content: 'What is SQL?' },
      {
        type: 'paragraph',
        content:
          'SQL (Structured Query Language) is declarative: you state which rows and columns you want, not how to fetch them. The database planner chooses an execution strategy, which is why the same query can run in 5 ms or 5 seconds depending on indexes and statistics.',
      },
      {
        type: 'note',
        content:
          'Logical processing order: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT. This order explains why you cannot use a SELECT alias inside WHERE but can inside ORDER BY.',
      },
      { type: 'heading', content: '1. Reading data' },
      {
        type: 'code',
        language: 'sql',
        code: `SELECT name, cgpa
FROM students
WHERE cgpa >= 7.5
  AND branch IN ('CSE', 'IT')
ORDER BY cgpa DESC
LIMIT 10;

-- COUNT, AVG and friends
SELECT COUNT(*) AS total_students,
       ROUND(AVG(cgpa), 2) AS average_cgpa
FROM students;`,
        output: 'Two result sets: the top ten eligible students, then the totals.',
        caption: 'Filter with WHERE, shape with ORDER BY and LIMIT',
      },
      { type: 'heading', content: '2. Joins' },
      {
        type: 'table',
        columns: ['Join', 'Keeps rows', 'Use when'],
        rows: [
          ['INNER JOIN', 'only matching rows from both tables', 'you need records that exist on both sides'],
          ['LEFT JOIN', 'all rows from the left table, NULLs where unmatched', 'you want results even when there is no match'],
          ['RIGHT JOIN', 'all rows from the right table', 'rare — usually rewritten as a LEFT JOIN'],
          ['FULL OUTER JOIN', 'all rows from both sides', 'reconciliation and diff reports'],
        ],
      },
      {
        type: 'code',
        language: 'sql',
        code: `-- Every student with the number of submissions (0 when none)
SELECT s.name,
       COUNT(c.id) AS submission_count
FROM students s
LEFT JOIN coding_submissions c
       ON c.student_id = s.id
GROUP BY s.name
ORDER BY submission_count DESC;

-- LEFT JOIN + IS NULL is the standard "find the missing" pattern
SELECT s.name
FROM students s
LEFT JOIN coding_submissions c ON c.student_id = s.id
WHERE c.id IS NULL;`,
        output: 'Students with a count of zero appear — required for a complete report.',
        caption: 'LEFT JOIN keeps unmatched left rows',
      },
      { type: 'heading', content: '3. Aggregation: GROUP BY and HAVING' },
      {
        type: 'code',
        language: 'sql',
        code: `SELECT category,
       COUNT(*)        AS attempts,
       AVG(score)      AS average_score
FROM submissions
WHERE submitted_at >= DATE('now', '-30 days')   -- filters ROWS
GROUP BY category
HAVING COUNT(*) >= 5                            -- filters GROUPS
ORDER BY average_score DESC;`,
        output: 'Only categories with at least five attempts are returned.',
        caption: 'WHERE filters rows before grouping; HAVING filters after',
      },
      {
        type: 'warning',
        content:
          'WHERE cannot reference an aggregate such as COUNT(*). Aggregates become available only after grouping, which is exactly what HAVING is for.',
      },
      { type: 'heading', content: '4. Subqueries and CTEs' },
      {
        type: 'code',
        language: 'sql',
        code: `-- Second highest distinct salary (classic interview question)
SELECT MAX(salary) AS second_highest
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);

-- The same idea with a window function (modern SQL)
SELECT salary
FROM (
  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk
  FROM employees
) ranked
WHERE rnk = 2;`,
        output: 'The second-highest salary, robust against duplicates.',
        caption: 'Subqueries compose; window functions rank without collapsing rows',
      },
      { type: 'heading', content: '5. Indexes' },
      {
        type: 'list',
        items: [
          'An index is a sorted structure (usually a B-tree) that turns a full table scan into a targeted lookup',
          'It accelerates WHERE, JOIN ON and ORDER BY on the indexed columns',
          'It slows down INSERT, UPDATE and DELETE because the index must also change',
          'A composite index (a, b) helps queries filtering on a, or on a and b — but not on b alone (leftmost-prefix rule)',
          'Wrapping the column in a function (WHERE YEAR(created_at) = 2026) usually prevents index use; compare ranges instead',
        ],
      },
      {
        type: 'code',
        language: 'sql',
        code: `CREATE INDEX idx_submissions_student ON submissions (student_id, submitted_at);

-- Index-friendly: range comparison on the raw column
SELECT * FROM submissions
WHERE submitted_at >= '2026-01-01'
  AND submitted_at <  '2027-01-01';

-- Index-hostile: the function wraps the column
SELECT * FROM submissions WHERE strftime('%Y', submitted_at) = '2026';`,
        output: 'The first query can use the index; the second usually cannot.',
        caption: 'Keep the indexed column bare in the WHERE clause',
      },
    ],
    examples: [
      {
        title: 'Simple: filter and sort',
        kind: 'Simple',
        explanation: 'The most common query shape — select named columns, filter, order.',
        language: 'sql',
        code: `SELECT title, difficulty, points
FROM coding_problems
WHERE difficulty = 'Easy'
ORDER BY points DESC;`,
        output: 'All easy problems, hardest-worth first.',
      },
      {
        title: 'Real world: a learner progress report',
        kind: 'Real world',
        explanation:
          'Combines a join, an aggregate and a having clause — the shape of most reporting queries.',
        language: 'sql',
        code: `SELECT u.name,
       COUNT(l.lesson_id)                              AS lessons_completed,
       ROUND(AVG(q.score), 1)                          AS avg_quiz_score
FROM users u
JOIN learning_progress l ON l.user_id = u.id AND l.state = 'COMPLETED'
LEFT JOIN quiz_attempts q ON q.user_id = u.id
GROUP BY u.name
HAVING COUNT(l.lesson_id) >= 3
ORDER BY lessons_completed DESC;`,
        output: 'Active learners with at least three completed lessons, plus their quiz average.',
      },
      {
        title: 'Interview style: find duplicate rows',
        kind: 'Interview style',
        explanation:
          'GROUP BY with HAVING COUNT(*) > 1 is the standard duplicate detector; the window alternative avoids collapsing rows.',
        language: 'sql',
        code: `-- Grouped form
SELECT email, COUNT(*) AS occurrences
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- Window form: returns the duplicate rows themselves
SELECT *
FROM (
  SELECT *, COUNT(*) OVER (PARTITION BY email) AS dup_count
  FROM users
) t
WHERE dup_count > 1;`,
        output: 'The first lists duplicated emails with counts; the second returns the offending rows.',
      },
    ],
    commonMistakes: [
      {
        title: 'Turning a LEFT JOIN into an INNER JOIN with a WHERE filter',
        wrong: "SELECT s.name, c.id\nFROM students s\nLEFT JOIN coding_submissions c ON c.student_id = s.id\nWHERE c.status = 'Accepted';",
        wrongLanguage: 'sql',
        why: 'Filtering a right-hand column in WHERE removes the NULL rows the LEFT JOIN produced, silently degrading it to an INNER JOIN.',
        fix: "SELECT s.name, c.id\nFROM students s\nLEFT JOIN coding_submissions c\n       ON c.student_id = s.id AND c.status = 'Accepted';",
        fixLanguage: 'sql',
      },
      {
        title: 'Comparing with NULL using =',
        wrong: 'SELECT * FROM users WHERE phone = NULL;   -- returns nothing',
        wrongLanguage: 'sql',
        why: 'Any comparison with NULL evaluates to unknown, not true. = NULL never matches.',
        fix: 'SELECT * FROM users WHERE phone IS NULL;\n-- or: WHERE phone IS NOT NULL',
        fixLanguage: 'sql',
      },
      {
        title: 'Selecting a column that is not grouped or aggregated',
        wrong: 'SELECT category, name, COUNT(*)\nFROM submissions\nGROUP BY category;',
        wrongLanguage: 'sql',
        why: 'name is not part of the grouping key and is not aggregated, so each group has many possible values. PostgreSQL rejects it; MySQL historically returned an arbitrary value (a silent correctness bug).',
        fix: 'SELECT category, COUNT(*) FROM submissions GROUP BY category;\n-- include name in GROUP BY only if you truly want per-name rows',
        fixLanguage: 'sql',
      },
    ],
    interviewTips: [
      {
        question: 'What is the difference between WHERE and HAVING?',
        answer:
          'WHERE filters individual rows before grouping, so it can use indexes and cannot reference aggregates. HAVING filters groups after aggregation and is the only place an aggregate condition such as COUNT(*) >= 5 can appear.',
        difficulty: 'beginner',
      },
      {
        question: 'How would you find and fix a slow query?',
        answer:
          'Run EXPLAIN (or EXPLAIN ANALYZE) and look for a full table scan on a large table. Then add or correct an index on the columns used in WHERE/JOIN/ORDER BY, keep the indexed column bare (no function wrapping), and check that the query is not fetching far more rows than it needs. Verify the plan changed rather than assuming.',
        difficulty: 'intermediate',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'List all employees ordered by salary descending, showing only name and salary.',
        hint: 'SELECT with ORDER BY DESC. No aggregation needed.',
      },
      {
        level: 'MEDIUM',
        prompt: 'For each department, show the department name and the number of employees, including departments with zero employees.',
        hint: 'LEFT JOIN from departments to employees, then GROUP BY the department. COUNT(employee.id) rather than COUNT(*) so empty groups count zero.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Write a query that finds the second-highest salary per department without using window functions, then rewrite it with a window function.',
        hint: 'The correlated version compares each department against its own MAX. The window version uses DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC).',
      },
    ],
    quiz: [
      {
        id: 'sql-q1',
        question: 'Which join returns all rows from the left table even when there is no match?',
        options: ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'SELF JOIN'],
        correctIndex: 1,
        explanation: 'A LEFT JOIN keeps every left row and fills unmatched right columns with NULL.',
        difficulty: 'beginner',
        topicTag: 'joins',
      },
      {
        id: 'sql-q2',
        question: 'Which clause filters groups after aggregation?',
        options: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'],
        correctIndex: 1,
        explanation: 'WHERE filters rows before grouping. HAVING filters the aggregated groups, so it is where aggregate conditions belong.',
        difficulty: 'beginner',
        topicTag: 'grouping',
      },
      {
        id: 'sql-q3',
        question: 'What does WHERE phone = NULL return?',
        options: ['All rows with a NULL phone', 'No rows', 'A syntax error', 'All rows without a phone'],
        correctIndex: 1,
        explanation: 'Comparisons with NULL are unknown, never true, so = NULL matches nothing. Use IS NULL.',
        difficulty: 'intermediate',
        topicTag: 'null-handling',
      },
      {
        id: 'sql-q4',
        question: 'Which statement about indexes is correct?',
        options: [
          'Indexes speed up writes',
          'Indexes speed up reads at some cost to writes',
          'Indexes are required for every column',
          'Indexes remove the need for WHERE clauses',
        ],
        correctIndex: 1,
        explanation: 'An index accelerates lookups but must be maintained on every insert/update/delete, so writes get slightly slower and storage grows.',
        difficulty: 'intermediate',
        topicTag: 'indexes',
      },
      {
        id: 'sql-q5',
        question: 'Why can WHERE YEAR(created_at) = 2026 prevent index usage?',
        options: [
          'YEAR is not valid SQL',
          'The function wraps the indexed column, so the index cannot be compared directly',
          'Indexes only work on text columns',
          'It returns too many rows',
        ],
        correctIndex: 1,
        explanation: 'Applying a function to the column hides the raw value from the index. Compare a range on the bare column instead.',
        difficulty: 'advanced',
        topicTag: 'indexes',
      },
    ],
    resources: [
      { title: 'PostgreSQL SELECT reference', url: 'https://www.postgresql.org/docs/current/sql-select.html', provider: 'PostgreSQL Global Development Group', type: 'DOCUMENTATION' },
      { title: 'MySQL SQL statement syntax', url: 'https://dev.mysql.com/doc/refman/8.0/en/sql-statements.html', provider: 'Oracle / MySQL', type: 'DOCUMENTATION' },
      { title: 'Use The Index, Luke!', url: 'https://use-the-index-luke.com/', provider: 'Markus Winand', type: 'BOOK' },
    ],
    nextTopicSlugs: ['mongodb'],
    relatedTopicSlugs: ['dbms', 'mongodb', 'rest-api'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },

  {
    slug: 'mongodb',
    title: 'MongoDB',
    shortDescription: 'Document database with flexible schemas, indexes and the aggregation pipeline.',
    description:
      'MongoDB stores JSON-like documents in collections instead of rows in tables. Documents embed related data, which removes many joins but shifts the design question to "embed or reference?". This topic covers document modelling, CRUD, indexes and the aggregation pipeline, plus the trade-offs against a relational database.',
    whyItMatters:
      'MongoDB is the default database in the MERN stack and in this platform. It is also a common interview topic because its data-modelling decisions differ sharply from SQL and reveal how deeply you understand the trade-off.',
    interviewRelevance:
      'Expect: embed vs reference, when to use the aggregation pipeline, what indexes MongoDB supports, why `$lookup` is expensive, and how you would model one-to-many relationships.',
    group: 'Databases',
    order: 8,
    level: 'intermediate',
    estimatedMinutes: 50,
    skillSlugs: ['mongodb', 'mongoose'],
    roleSlugs: ['backend-developer', 'full-stack-developer'],
    prerequisites: ['sql'],
    learningObjectives: [
      'Model documents and decide when to embed versus reference',
      'Perform CRUD operations with the shell and with a driver',
      'Query with filters, projections and sorting',
      'Aggregate data with $match, $group, $sort and $lookup',
      'Create and reason about indexes including compound and text indexes',
      'Explain when a relational database would be the better choice',
    ],
    sections: [
      { type: 'heading', content: 'What is MongoDB?' },
      {
        type: 'paragraph',
        content:
          'MongoDB is a document-oriented database. A document is a BSON object (JSON with extra types such as ObjectId and Date), documents live in collections, and a collection does not enforce one rigid column layout across every document. The trade-off is flexibility versus the relational engine\'s strong constraints and joins.',
      },
      { type: 'heading', content: '1. Documents and collections' },
      {
        type: 'code',
        language: 'javascript',
        code: `// One document — everything about a candidate in one place
{
  _id: ObjectId("6512f0c9a1b2c3d4e5f60718"),
  name: "Huzaifa Bubere",
  email: "huzaifa@example.com",
  skills: ["javascript", "node.js", "mongodb"],
  education: [
    { degree: "B.E. Computer Engineering", year: 2026 }
  ],
  profile: { city: "Mumbai", openToRemote: true }
}`,
        output: 'Arrays and nested objects are first-class — no join needed for embedded data.',
        caption: 'A document is a self-contained record',
      },
      { type: 'heading', content: '2. Embed or reference?' },
      {
        type: 'compare',
        leftTitle: 'Embed (denormalise)',
        rightTitle: 'Reference (normalise)',
        leftItems: [
          'Data is read together almost every time',
          'Child data is small and bounded',
          'One document write updates everything atomically',
          'Risk: documents grow unbounded, hitting the 16 MB limit',
        ],
        rightItems: [
          'Child data is large, unbounded or shared',
          'You need to query the child independently',
          'Updates are frequent and would duplicate data',
          'Cost: an extra query or a $lookup per read',
        ],
      },
      {
        type: 'tip',
        content:
          'The rule interviewers look for: model around your access patterns. "Data you always read together stays together" — unless the array can grow without limit.',
      },
      { type: 'heading', content: '3. CRUD' },
      {
        type: 'code',
        language: 'javascript',
        code: `db.students.insertOne({ name: "Aisha", cgpa: 8.7, skills: ["js", "sql"] });

db.students.find({ cgpa: { $gte: 8 } }, { name: 1, cgpa: 1, _id: 0 })
           .sort({ cgpa: -1 })
           .limit(5);

db.students.updateOne(
  { name: "Aisha" },
  { $set: { cgpa: 9.1 }, $addToSet: { skills: "mongodb" } }
);

db.students.deleteMany({ cgpa: { $lt: 5 } });`,
        output: 'Insert, query with a projection, update with operators, delete by filter.',
        caption: 'Update operators change fields instead of replacing the document',
      },
      {
        type: 'warning',
        content:
          'Use update operators such as $set, $inc and $addToSet. Passing a whole object to updateOne replaces the document and silently drops the fields you omitted.',
      },
      { type: 'heading', content: '4. Aggregation pipeline' },
      {
        type: 'code',
        language: 'javascript',
        code: `db.submissions.aggregate([
  // Stage 1: filter as early as possible
  { $match: { status: "Accepted" } },
  // Stage 2: group and compute
  { $group: {
      _id: "$category",
      attempts: { $sum: 1 },
      avgScore: { $avg: "$score" }
  } },
  { $sort: { avgScore: -1 } },
  { $limit: 5 }
])`,
        output: 'Top five categories by average accepted score.',
        caption: 'The pipeline runs stage by stage, like a Unix pipe',
      },
      { type: 'heading', content: '5. Indexes' },
      {
        type: 'list',
        items: [
          'A single-field index accelerates equality and range queries on that field',
          'A compound index follows the leftmost-prefix rule, like SQL',
          'A multikey index is created automatically when you index an array field',
          'A text index enables $text search across string fields',
          'A unique index enforces uniqueness (and fails inserts, so handle the duplicate error)',
          'explain("executionStats") tells you whether a COLLSCAN or an IXSCAN ran',
        ],
      },
      {
        type: 'code',
        language: 'javascript',
        code: `db.submissions.createIndex({ user: 1, submittedAt: -1 });
db.submissions.createIndex({ title: "text", tags: "text" });

// Verify index usage instead of assuming
db.submissions.find({ user: someId }).sort({ submittedAt: -1 }).explain("executionStats");`,
        output: 'The plan should report IXSCAN. COLLSCAN means the index was not used.',
        caption: 'Always verify with explain()',
      },
    ],
    examples: [
      {
        title: 'Simple: insert and read a document',
        kind: 'Simple',
        explanation: 'The minimum you need to store and retrieve a record.',
        language: 'javascript',
        code: `db.problems.insertOne({
  title: "Two Sum",
  difficulty: "Easy",
  tags: ["array", "hash-table"]
});

db.problems.find({ difficulty: "Easy" }).pretty();`,
        output: 'The inserted document is returned by the find.',
      },
      {
        title: 'Real world: dashboard numbers with the pipeline',
        kind: 'Real world',
        explanation:
          'Real dashboards need counts and averages; computed on the server so the payload stays small.',
        language: 'javascript',
        code: `db.coding_submissions.aggregate([
  { $match: {
      user: userId,
      submittedAt: { $gte: new Date(Date.now() - 90 * 86400000) }
  } },
  { $group: {
      _id: null,
      total: { $sum: 1 },
      accepted: { $sum: { $cond: [{ $eq: ["$status", "Accepted"] }, 1, 0] } },
      avgScore: { $avg: "$overallScore" }
  } },
  { $project: {
      _id: 0,
      total: 1,
      accepted: 1,
      acceptanceRate: { $round: [{ $multiply: [{ $divide: ["$accepted", "$total"] }, 100] }, 0] },
      avgScore: { $round: ["$avgScore", 1] }
  } }
])`,
        output: '{ total: 12, accepted: 9, acceptanceRate: 75, avgScore: 82.4 }',
      },
      {
        title: 'Interview style: model one-to-many',
        kind: 'Interview style',
        explanation:
          'Interviewers want to see you justify embed vs reference using the access pattern, not a preference.',
        language: 'javascript',
        code: `// Short, bounded list read with the parent → EMBED
{ _id: 1, name: "Course", modules: [{ id: "m1", title: "Basics" }] }

// Unbounded, queried independently → REFERENCE
// courses:  { _id: 1, title: "Course" }
// lessons:  { _id: 10, courseId: 1, title: "Variables" }
// Then: db.lessons.find({ courseId: 1 }).sort({ order: 1 })`,
        output: 'Bounded data is embedded; unbounded, independently queried data is referenced.',
      },
    ],
    commonMistakes: [
      {
        title: 'Replacing a document instead of updating a field',
        wrong: 'db.users.updateOne({ _id: id }, { name: "New Name" });',
        wrongLanguage: 'javascript',
        why: 'Without update operators this replaces the whole document, deleting every other field — including fields the schema relied on.',
        fix: 'db.users.updateOne({ _id: id }, { $set: { name: "New Name" } });',
        fixLanguage: 'javascript',
      },
      {
        title: 'Embedding an unbounded child array',
        wrong: '{ _id: 1, title: "Problem", submissions: [ /* grows forever */ ] }',
        wrongLanguage: 'javascript',
        why: 'The array grows without limit, eventually hitting the 16 MB document ceiling and making every read fetch the entire history.',
        fix: 'Keep submissions in their own collection with a problemId reference and index problemId.',
        fixLanguage: 'javascript',
      },
      {
        title: 'Assuming a query uses an index',
        wrong: 'db.submissions.find({ status: "Accepted" }).sort({ submittedAt: -1 });   // with no index',
        wrongLanguage: 'javascript',
        why: 'Without an index this is a full collection scan plus an in-memory sort, and MongoDB aborts sorts above 100 MB without allowDiskUse.',
        fix: 'db.submissions.createIndex({ status: 1, submittedAt: -1 });\n// then confirm with explain("executionStats")',
        fixLanguage: 'javascript',
      },
    ],
    interviewTips: [
      {
        question: 'When would you choose MongoDB over a relational database?',
        answer:
          'When the data shape varies or evolves, when documents are read as a whole unit and are not heavily joined, and when horizontal scaling through sharding matters more than multi-table transactions. Choose relational when you need strict relational integrity, complex joins and multi-row ACID transactions across entities.',
        difficulty: 'intermediate',
      },
      {
        question: 'Why is $lookup considered expensive, and how do you reduce its use?',
        answer:
          '$lookup performs a join at aggregation time; without an index on the foreign field it scans the other collection for every input document, and it cannot use the same query planner shortcuts as a native join. Reduce it by embedding bounded data that is always read together, or by denormalising the few fields you actually need.',
        difficulty: 'advanced',
      },
    ],
    practice: [
      {
        level: 'EASY',
        prompt: 'Insert three documents into a collection and query the ones with a numeric field above a threshold.',
        hint: 'insertMany followed by find with a $gte filter.',
      },
      {
        level: 'MEDIUM',
        prompt: 'Write an aggregation that returns the number of documents per category, sorted by count descending.',
        hint: '$group with _id set to the category field and $sum: 1, then $sort.',
      },
      {
        level: 'CHALLENGE',
        prompt: 'Model a course with modules and lessons, then justify each embed/reference decision using the access pattern.',
        hint: 'Modules are few and always read with the course (embed). Lessons are numerous and queried one at a time (reference with an index on courseId).',
      },
    ],
    quiz: [
      {
        id: 'mongo-q1',
        question: 'Which operator should you use to change a single field without replacing the document?',
        options: ['$replace', '$set', '$field', '$put'],
        correctIndex: 1,
        explanation: '$set modifies the named fields and leaves the rest of the document untouched. A plain object replaces the document.',
        difficulty: 'beginner',
        topicTag: 'updates',
      },
      {
        id: 'mongo-q2',
        question: 'When should a child array be referenced in another collection instead of embedded?',
        options: [
          'When it is small and always read with the parent',
          'When it is unbounded or queried independently',
          'When it contains only strings',
          'Never — always embed',
        ],
        correctIndex: 1,
        explanation: 'Unbounded arrays hit the 16 MB document limit and force every read to fetch the whole history, so they belong in their own collection.',
        difficulty: 'intermediate',
        topicTag: 'data-modelling',
      },
      {
        id: 'mongo-q3',
        question: 'Which aggregation stage filters documents?',
        options: ['$group', '$match', '$project', '$sort'],
        correctIndex: 1,
        explanation: '$match filters documents and should be placed as early as possible so later stages process fewer documents.',
        difficulty: 'beginner',
        topicTag: 'aggregation',
      },
      {
        id: 'mongo-q4',
        question: 'What does a COLLSCAN in explain() mean?',
        options: [
          'The query used an index',
          'The query scanned the whole collection',
          'The collection is empty',
          'The query returned an error',
        ],
        correctIndex: 1,
        explanation: 'COLLSCAN means no index was used and every document was examined — usually the cause of a slow query.',
        difficulty: 'intermediate',
        topicTag: 'indexes',
      },
      {
        id: 'mongo-q5',
        question: 'What is the default maximum size of a single BSON document?',
        options: ['4 MB', '8 MB', '16 MB', '64 MB'],
        correctIndex: 2,
        explanation: 'The limit is 16 MB, which is exactly why unbounded embedded arrays must be split into their own collection.',
        difficulty: 'advanced',
        topicTag: 'limits',
      },
    ],
    resources: [
      { title: 'MongoDB Manual — Data modelling', url: 'https://www.mongodb.com/docs/manual/data-modeling/', provider: 'MongoDB Inc.', type: 'DOCUMENTATION' },
      { title: 'MongoDB Manual — Aggregation pipeline', url: 'https://www.mongodb.com/docs/manual/core/aggregation-pipeline/', provider: 'MongoDB Inc.', type: 'DOCUMENTATION' },
      { title: 'Indexes in MongoDB', url: 'https://www.mongodb.com/docs/manual/indexes/', provider: 'MongoDB Inc.', type: 'DOCUMENTATION' },
    ],
    nextTopicSlugs: ['dbms'],
    relatedTopicSlugs: ['sql', 'nodejs', 'dbms'],
    source: 'ORIGINAL',
    reviewedBy: 'AETHER curriculum',
  },
];
