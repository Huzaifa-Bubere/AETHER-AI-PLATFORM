const { generateTrace } = require('../../dist/coding/trace/trace.service');

describe('Coding Execution Visualizer Real Trace Engine', () => {
  beforeAll(() => {
    process.env.ALLOW_UNSAFE_LOCAL_CODE_EXECUTION = 'true';
    process.env.NODE_ENV = 'development';
  });

  // TEST 1 — Two Sum (Array + HashMap)
  test('Test 1: Python Two Sum generates real trace with variables and hashmap', async () => {
    const code = `def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []`;

    const trace = await generateTrace({
      language: 'python',
      sourceCode: code,
      testInput: '[2, 7, 11, 15]\n9',
      functionName: 'twoSum',
    });

    expect(trace.ok).toBe(true);
    expect(trace.events.length).toBeGreaterThan(5);
    expect(trace.metadata.engine).toBe('python-instrumented');

    // Verify trace captured hashmap in collections
    const stepsWithSeen = trace.events.filter(e => e.collections && 'seen' in e.collections);
    expect(stepsWithSeen.length).toBeGreaterThan(0);

    // Verify final return value is [0, 1]
    const returnEvent = trace.events.find(e => e.event === 'FUNCTION_RETURN');
    expect(returnEvent).toBeDefined();
    expect(trace.metadata.returnValue).toBe('[0, 1]');
  }, 15000);

  // TEST 2 — Best Time to Buy and Sell Stock (Array + Pointer)
  test('Test 2: Python Stock Profit tracks minPrice, maxProfit, and returns 5', async () => {
    const code = `def maxProfit(prices):
    min_price = 999999
    max_profit = 0
    for price in prices:
        if price < min_price:
            min_price = price
        elif price - min_price > max_profit:
            max_profit = price - min_price
    return max_profit`;

    const trace = await generateTrace({
      language: 'python',
      sourceCode: code,
      testInput: '[7, 1, 5, 3, 6, 4]',
      functionName: 'maxProfit',
    });

    expect(trace.ok).toBe(true);
    expect(trace.events.length).toBeGreaterThan(10);
    expect(trace.metadata.returnValue).toBe('5');

    // Verify min_price and max_profit are tracked
    const hasMinPrice = trace.events.some(e => e.variables && 'min_price' in e.variables);
    const hasMaxProfit = trace.events.some(e => e.variables && 'max_profit' in e.variables);
    expect(hasMinPrice).toBe(true);
    expect(hasMaxProfit).toBe(true);
  }, 15000);

  // TEST 3 — Binary Search (Two Pointer low, mid, high)
  test('Test 3: Python Binary Search shows low, mid, high range updates', async () => {
    const code = `def binarySearch(nums, target):
    low, high = 0, len(nums) - 1
    while low <= high:
        mid = (low + high) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1`;

    const trace = await generateTrace({
      language: 'python',
      sourceCode: code,
      testInput: '[1, 3, 5, 7, 9, 11]\n7',
      functionName: 'binarySearch',
    });

    expect(trace.ok).toBe(true);
    expect(trace.events.length).toBeGreaterThan(5);
    // In [1, 3, 5, 7, 9, 11], target 7 is at index 3
    expect(trace.metadata.returnValue).toBe('3');

    // Verify low, high, and mid are recorded as scalars
    const midSteps = trace.events.filter(e => e.variables && 'mid' in e.variables);
    expect(midSteps.length).toBeGreaterThan(0);
  }, 15000);

  // TEST 4 — Stack (Push and Pop)
  test('Test 4: Stack operations record push/pop on stack collection', async () => {
    const code = `def testStack(ops):
    stack = []
    for item in ops:
        if item == 'pop':
            if stack:
                stack.pop()
        else:
            stack.append(item)
    return stack`;

    const trace = await generateTrace({
      language: 'python',
      sourceCode: code,
      testInput: '["push1", "push2", "pop", "push3"]',
      functionName: 'testStack',
    });

    expect(trace.ok).toBe(true);
    expect(trace.events.length).toBeGreaterThan(5);
    expect(trace.metadata.returnValue).toContain('push1');
    expect(trace.metadata.returnValue).toContain('push3');
  }, 15000);

  // TEST 5 — BFS (Graph Adjacency + Queue)
  test('Test 5: BFS graph traversal records queue and visited nodes', async () => {
    const code = `def bfs(adj, start):
    queue = [start]
    visited = [start]
    while queue:
        curr = queue.pop(0)
        for neighbor in adj.get(curr, []):
            if neighbor not in visited:
                visited.append(neighbor)
                queue.append(neighbor)
    return visited`;

    const trace = await generateTrace({
      language: 'python',
      sourceCode: code,
      testInput: '{"A": ["B", "C"], "B": ["D"], "C": ["D"], "D": []}\n"A"',
      functionName: 'bfs',
    });

    expect(trace.ok).toBe(true);
    expect(trace.events.length).toBeGreaterThan(10);
    // Return value should visit A, B, C, D
    expect(trace.metadata.returnValue).toContain('A');
    expect(trace.metadata.returnValue).toContain('D');
  }, 15000);

  // TEST 6 — Recursion (Call Tree & Call Stack)
  test('Test 6: Recursive Fibonacci captures function calls and call depth', async () => {
    const code = `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)`;

    const trace = await generateTrace({
      language: 'python',
      sourceCode: code,
      testInput: '4',
      functionName: 'fib',
    });

    expect(trace.ok).toBe(true);
    expect(trace.events.length).toBeGreaterThan(15);
    expect(trace.metadata.returnValue).toBe('3');

    // Verify callStack and recursion call events
    const recursiveEvents = trace.events.filter(e => e.event === 'RECURSION_CALL' || e.event === 'FUNCTION_CALL');
    expect(recursiveEvents.length).toBeGreaterThan(3);

    // Call depth should reach at least 2
    const maxDepth = Math.max(...trace.events.map(e => e.callDepth || 0));
    expect(maxDepth).toBeGreaterThanOrEqual(2);
  }, 15000);

  // SAFETY TEST — Infinite loop is gracefully capped
  test('Safety: Infinite loop safely terminates with step limit without crashing', async () => {
    const code = `def infiniteLoop(n):
    count = 0
    while True:
        count += 1
    return count`;

    const trace = await generateTrace({
      language: 'python',
      sourceCode: code,
      testInput: '1',
      functionName: 'infiniteLoop',
    });

    expect(trace.ok).toBe(true);
    expect(trace.metadata.truncated).toBe(true);
    expect(trace.events.length).toBeLessThanOrEqual(2050);
  }, 20000);
});
