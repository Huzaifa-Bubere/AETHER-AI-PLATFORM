/* AETHER Coding — AST analyzer tests (spec section 53). */
process.env.NODE_ENV = 'test';

const { analyzeSource } = require('../dist/coding/ast/AstAnalyzer');

describe('AETHER AST analyzer — representative patterns', () => {
  test('nested loops → BRUTE_FORCE, O(n^2) (Two Sum brute force, JS)', () => {
    const code = `function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [i, j];
    }
  }
  return [];
}`;
    const r = analyzeSource(code, 'javascript');
    expect(r.parseSuccess).toBe(true);
    expect(r.parser).toBe('acorn');
    expect(r.metrics.loops).toBe(2);
    expect(r.metrics.nestedLoopDepth).toBe(2);
    expect(r.approach.detectedApproach).toBe('BRUTE_FORCE');
    expect(r.complexity.estimatedTime).toBe('O(n^2)');
  });

  test('single loop + Map → HASHING, O(n) (Two Sum optimal, JS)', () => {
    const code = `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (map.has(need)) return [map.get(need), i];
    map.set(nums[i], i);
  }
  return [];
}`;
    const r = analyzeSource(code, 'javascript');
    expect(r.metrics.loops).toBe(1);
    expect(r.dataStructures).toContain('HashMap');
    expect(r.approach.detectedApproach).toBe('HASHING');
    expect(r.complexity.estimatedTime).toBe('O(n)');
    expect(r.complexity.estimatedSpace).toBe('O(n)');
  });

  test('single loop + dict → HASHING (Python)', () => {
    const code = `def twoSum(nums, target):
    seen = {}
    for i in range(len(nums)):
        need = target - nums[i]
        if need in seen:
            return [seen[need], i]
        seen[nums[i]] = i
    return []`;
    const r = analyzeSource(code, 'python');
    expect(r.parseSuccess).toBe(true);
    expect(r.parser).toBe('heuristic');
    expect(r.metrics.loops).toBe(1);
    expect(r.dataStructures).toContain('HashMap');
    expect(r.approach.detectedApproach).toBe('HASHING');
    expect(r.complexity.estimatedTime).toBe('O(n)');
  });

  test('Python nested loops → BRUTE_FORCE, O(n^2)', () => {
    const code = `def twoSum(nums, target):
    n = len(nums)
    for i in range(n):
        for j in range(i + 1, n):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []`;
    const r = analyzeSource(code, 'python');
    expect(r.metrics.loops).toBe(2);
    expect(r.metrics.nestedLoopDepth).toBe(2);
    expect(r.approach.detectedApproach).toBe('BRUTE_FORCE');
    expect(r.complexity.estimatedTime).toBe('O(n^2)');
  });

  test('binary search halving → BINARY_SEARCH, O(log n)', () => {
    const code = `function search(nums, target) {
  let left = 0, right = nums.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}`;
    const r = analyzeSource(code, 'javascript');
    expect(r.approach.detectedApproach).toBe('BINARY_SEARCH');
    expect(r.complexity.estimatedTime).toBe('O(log n)');
  });

  test('recursion detection (factorial, JS)', () => {
    const code = `function fact(n) {
  if (n <= 1) return 1;
  return n * fact(n - 1);
}`;
    const r = analyzeSource(code, 'javascript');
    expect(r.metrics.recursionDetected).toBe(true);
  });

  test('stack detection → STACK approach (Valid Parentheses, Python)', () => {
    const code = `def isValid(s):
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for ch in s:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
        else:
            stack.append(ch)
    return not stack`;
    const r = analyzeSource(code, 'python');
    expect(r.dataStructures).toContain('Stack');
    expect(r.approach.detectedApproach).toBe('STACK');
  });

  test('DP tabulation detection (Climbing Stairs, Python)', () => {
    const code = `def climbStairs(n):
    if n <= 2:
        return n
    dp = [0] * (n + 1)
    dp[1] = 1
    dp[2] = 2
    for i in range(3, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]`;
    const r = analyzeSource(code, 'python');
    expect(r.approach.detectedApproach).toBe('TABULATION');
  });

  test('sorting call lifts baseline to O(n log n)', () => {
    const code = `function merge(intervals) {
  intervals.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const iv of intervals) {
    if (out.length && iv[0] <= out[out.length - 1][1]) {
      out[out.length - 1][1] = Math.max(out[out.length - 1][1], iv[1]);
    } else {
      out.push(iv);
    }
  }
  return out;
}`;
    const r = analyzeSource(code, 'javascript');
    expect(r.complexity.estimatedTime).toBe('O(n log n)');
  });

  test('sliding window single pass (Longest Substring, JS)', () => {
    const code = `function lengthOfLongestSubstring(s) {
  const seen = new Set();
  let left = 0, best = 0;
  for (let right = 0; right < s.length; right++) {
    while (seen.has(s[right])) {
      seen.delete(s[left]);
      left++;
    }
    seen.add(s[right]);
    best = Math.max(best, right - left + 1);
  }
  return best;
}`;
    const r = analyzeSource(code, 'javascript');
    expect(r.metrics.loops).toBeGreaterThanOrEqual(1);
    expect(r.dataStructures).toContain('HashSet');
    expect(r.approach.detectedApproach).toBe('SLIDING_WINDOW');
  });

  test('two pointers (Sorted Square comparison pattern)', () => {
    const code = `function hasPair(nums, target) {
  let left = 0;
  let right = nums.length - 1;
  while (left < right) {
    const sum = nums[left] + nums[right];
    if (sum === target) return true;
    if (sum < target) left++;
    else right--;
  }
  return false;
}`;
    const r = analyzeSource(code, 'javascript');
    expect(r.approach.detectedApproach).toBe('TWO_POINTER');
  });

  test('memoized recursion → MEMOIZATION', () => {
    const code = `function fib(n, memo = {}) {
  if (n in memo) return memo[n];
  if (n <= 1) return n;
  memo[n] = fib(n - 1, memo) + fib(n - 2, memo);
  return memo[n];
}`;
    const r = analyzeSource(code, 'javascript');
    expect(r.metrics.recursionDetected).toBe(true);
    expect(r.approach.detectedApproach).toBe('MEMOIZATION');
  });

  test('UNKNOWN for plain single loop without signals (no false classification)', () => {
    const code = `function sumArr(arr) {
  let total = 0;
  for (const x of arr) {
    total += x;
  }
  return total;
}`;
    const r = analyzeSource(code, 'javascript');
    expect(r.approach.detectedApproach).toBe('UNKNOWN');
    expect(r.complexity.estimatedTime).toBe('O(n)');
  });

  test('brute force NOT detected when hash map present (no false positives)', () => {
    const code = `function twoSumHash(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < 3; j++) {
      if (map.has(target - nums[i])) return [i, j];
    }
    map.set(nums[i], i);
  }
  return [];
}`;
    const r = analyzeSource(code, 'javascript');
    expect(r.dataStructures).toContain('HashMap');
    expect(r.approach.detectedApproach).not.toBe('BRUTE_FORCE');
  });

  test('binary search NOT classified as TWO_POINTER despite left/right names', () => {
    const code = `function search(nums, target) {
  let left = 0, right = nums.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}`;
    const r = analyzeSource(code, 'javascript');
    expect(r.approach.detectedApproach).toBe('BINARY_SEARCH');
    expect(r.approach.detectedApproach).not.toBe('TWO_POINTER');
  });

  test('parse failure degrades gracefully (AST_UNAVAILABLE shape)', () => {
    // Heuristic languages rarely "fail", so simulate with an unsupported language path
    const r = analyzeSource('', 'python');
    expect(r.parseSuccess).toBe(true); // empty is structurally valid
    const r2 = analyzeSource('function oops( {', 'javascript');
    expect(r2.parseSuccess).toBe(false);
    expect(r2.reason).toContain('parse error');
    expect(r2.approach.detectedApproach).toBe('UNKNOWN');
  });
});
