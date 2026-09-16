import { AlgorithmApproachId } from '../types/coding.types';

export interface SeedProblem {
  title: string;
  slug: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  tags: string[];
  companies?: string[];
  examples: Array<{ input: string; output: string; explanation?: string }>;
  constraints: string[];
  sampleTests: Array<{ input: string; expectedOutput: string }>;
  hiddenTests: Array<{ input: string; expectedOutput: string }>;
  functionName: string;
  params: string[]; // parameter names for starter-code generation
  javaSignature: { returnType: string; paramTypes: string[] };
  cppSignature: { returnType: string; paramTypes: string[] };
  knownApproaches: Array<{
    name: string;
    approachId: AlgorithmApproachId;
    timeComplexity: string;
    spaceComplexity: string;
    outline: string;
    optimal: boolean;
  }>;
  expectedTimeComplexity: string;
  expectedSpaceComplexity: string;
  points: number;
  hints: string[];
  solutionOutline: string;
}

export const PROBLEMS_PART1: SeedProblem[] = [
  {
    title: 'Two Sum',
    slug: 'two-sum',
    description:
      'Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target.\n\nYou may assume that each input has exactly one solution, and you may not use the same element twice. Return the answer in ascending index order.',
    difficulty: 'Easy',
    category: 'Arrays',
    tags: ['Array', 'Hash Table'],
    companies: ['Google', 'Amazon', 'Microsoft', 'Adobe'],
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] = 2 + 7 = 9' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]', explanation: 'nums[1] + nums[2] = 2 + 4 = 6' },
    ],
    constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9', 'Exactly one valid answer exists.'],
    sampleTests: [
      { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]' },
      { input: '[3,2,4]\n6', expectedOutput: '[1,2]' },
    ],
    hiddenTests: [
      { input: '[3,3]\n6', expectedOutput: '[0,1]' },
      { input: '[-1,-2,-3,-4,-5]\n-8', expectedOutput: '[2,4]' },
      { input: '[5,75,25]\n100', expectedOutput: '[1,2]' },
      { input: '[0,4,3,0]\n0', expectedOutput: '[0,3]' },
    ],
    functionName: 'twoSum',
    params: ['nums', 'target'],
    javaSignature: { returnType: 'int[]', paramTypes: ['int[]', 'int'] },
    cppSignature: { returnType: 'vector<int>', paramTypes: ['vector<int>&', 'int'] },
    knownApproaches: [
      {
        name: 'Brute Force',
        approachId: 'BRUTE_FORCE',
        timeComplexity: 'O(n^2)',
        spaceComplexity: 'O(1)',
        outline: 'Check every pair (i, j) with nested loops until the target pair is found.',
        optimal: false,
      },
      {
        name: 'Hash Map',
        approachId: 'HASHING',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        outline: 'Single pass: for each element check whether target - element is already in the map; otherwise store element → index.',
        optimal: true,
      },
    ],
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(n)',
    points: 10,
    hints: [
      'Think about what information you need when you visit each element.',
      'A hash map can store values you have already seen with their indices.',
      'For each nums[i], check if target - nums[i] exists in the map before inserting nums[i].',
    ],
    solutionOutline:
      'Single pass with a hash map: for each element, compute complement = target - nums[i]. If complement is in the map, return [map[complement], i]. Otherwise store nums[i] → i. O(n) time, O(n) space.',
  },
  {
    title: 'Valid Parentheses',
    slug: 'valid-parentheses',
    description:
      'Given a string s containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.\n\nAn input string is valid if open brackets are closed by the same type of bracket, and in the correct order.',
    difficulty: 'Easy',
    category: 'Stacks',
    tags: ['String', 'Stack'],
    companies: ['Amazon', 'Facebook', 'Bloomberg'],
    examples: [
      { input: 's = "()"', output: 'true' },
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
    ],
    constraints: ['1 <= s.length <= 10^4', 's consists of bracket characters only.'],
    sampleTests: [
      { input: '()', expectedOutput: 'true' },
      { input: '()[]{}', expectedOutput: 'true' },
      { input: '(]', expectedOutput: 'false' },
    ],
    hiddenTests: [
      { input: '([)]', expectedOutput: 'false' },
      { input: '{[]}', expectedOutput: 'true' },
      { input: '(', expectedOutput: 'false' },
      { input: ']]', expectedOutput: 'false' },
    ],
    functionName: 'isValid',
    params: ['s'],
    javaSignature: { returnType: 'boolean', paramTypes: ['String'] },
    cppSignature: { returnType: 'bool', paramTypes: ['string'] },
    knownApproaches: [
      {
        name: 'Stack Matching',
        approachId: 'STACK',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        outline: 'Push open brackets; on a close bracket, pop and verify it matches.',
        optimal: true,
      },
    ],
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(n)',
    points: 10,
    hints: [
      'The most recently opened bracket must be closed first — LIFO order.',
      'Use a stack to track open brackets.',
      'Map each closing bracket to its matching opening bracket.',
    ],
    solutionOutline: 'Stack: push opens, on close pop and compare. Valid iff stack is empty at the end and every pop matched. O(n)/O(n).',
  },
  {
    title: 'Binary Search',
    slug: 'binary-search',
    description:
      'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, return its index; otherwise return -1.',
    difficulty: 'Easy',
    category: 'Binary Search',
    tags: ['Array', 'Binary Search'],
    companies: ['Microsoft', 'Amazon'],
    examples: [
      { input: 'nums = [-1,0,3,5,9,12], target = 9', output: '4' },
      { input: 'nums = [-1,0,3,5,9,12], target = 2', output: '-1' },
    ],
    constraints: ['1 <= nums.length <= 10^4', 'nums is sorted ascending.'],
    sampleTests: [
      { input: '[-1,0,3,5,9,12]\n9', expectedOutput: '4' },
      { input: '[-1,0,3,5,9,12]\n2', expectedOutput: '-1' },
    ],
    hiddenTests: [
      { input: '[5]\n5', expectedOutput: '0' },
      { input: '[5]\n-5', expectedOutput: '-1' },
      { input: '[1,2,3,4,5,6,7,8,9,10]\n10', expectedOutput: '9' },
    ],
    functionName: 'search',
    params: ['nums', 'target'],
    javaSignature: { returnType: 'int', paramTypes: ['int[]', 'int'] },
    cppSignature: { returnType: 'int', paramTypes: ['vector<int>&', 'int'] },
    knownApproaches: [
      {
        name: 'Linear Scan',
        approachId: 'BRUTE_FORCE',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        outline: 'Scan every element comparing to target.',
        optimal: false,
      },
      {
        name: 'Binary Search',
        approachId: 'BINARY_SEARCH',
        timeComplexity: 'O(log n)',
        spaceComplexity: 'O(1)',
        outline: 'Halve the search space each iteration using a mid index.',
        optimal: true,
      },
    ],
    expectedTimeComplexity: 'O(log n)',
    expectedSpaceComplexity: 'O(1)',
    points: 10,
    hints: [
      'The array is sorted — you can discard half the candidates each step.',
      'Maintain left/right pointers and compute mid = (left + right) / 2.',
      'Compare nums[mid] with target and move the corresponding pointer past mid.',
    ],
    solutionOutline: 'Classic binary search: while left <= right, compare nums[mid] to target and halve the interval. O(log n)/O(1).',
  },
  {
    title: 'Maximum Subarray',
    slug: 'maximum-subarray',
    description:
      'Given an integer array nums, find the contiguous subarray with the largest sum, and return its sum.',
    difficulty: 'Medium',
    category: 'Dynamic Programming',
    tags: ['Array', 'Dynamic Programming', 'Divide and Conquer'],
    companies: ['Amazon', 'Google', 'Apple'],
    examples: [
      { input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: '[4,-1,2,1] has the largest sum 6.' },
      { input: 'nums = [5,4,-1,7,8]', output: '23' },
    ],
    constraints: ['1 <= nums.length <= 10^5', '-10^4 <= nums[i] <= 10^4'],
    sampleTests: [
      { input: '[-2,1,-3,4,-1,2,1,-5,4]', expectedOutput: '6' },
      { input: '[5,4,-1,7,8]', expectedOutput: '23' },
    ],
    hiddenTests: [
      { input: '[1]', expectedOutput: '1' },
      { input: '[-1]', expectedOutput: '-1' },
      { input: '[-3,-2,-5]', expectedOutput: '-2' },
    ],
    functionName: 'maxSubArray',
    params: ['nums'],
    javaSignature: { returnType: 'int', paramTypes: ['int[]'] },
    cppSignature: { returnType: 'int', paramTypes: ['vector<int>&'] },
    knownApproaches: [
      {
        name: "Kadane's Algorithm",
        approachId: 'DYNAMIC_PROGRAMMING',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        outline: 'Track the running best sum ending at each index: current = max(nums[i], current + nums[i]).',
        optimal: true,
      },
      {
        name: 'Brute Force',
        approachId: 'BRUTE_FORCE',
        timeComplexity: 'O(n^2)',
        spaceComplexity: 'O(1)',
        outline: 'Try every subarray start/end pair and track the maximum sum.',
        optimal: false,
      },
    ],
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(1)',
    points: 15,
    hints: [
      'A subarray must be contiguous — each element either extends the previous subarray or starts a new one.',
      'Track the best sum ending at the current index.',
      'current = max(nums[i], current + nums[i]); answer = max(answer, current).',
    ],
    solutionOutline: "Kadane's algorithm — one pass, running sum with reset. O(n)/O(1).",
  },
  {
    title: 'Best Time to Buy and Sell Stock',
    slug: 'best-time-to-buy-and-sell-stock',
    description:
      'You are given an array prices where prices[i] is the price of a stock on day i. Maximize your profit by choosing a single day to buy and a different day in the future to sell. Return the maximum profit, or 0 if no profit is possible.',
    difficulty: 'Easy',
    category: 'Dynamic Programming',
    tags: ['Array', 'Dynamic Programming', 'Greedy'],
    companies: ['Amazon', 'Facebook', 'Uber'],
    examples: [
      { input: 'prices = [7,1,5,3,6,4]', output: '5', explanation: 'Buy on day 2 (price = 1), sell on day 5 (price = 6).' },
      { input: 'prices = [7,6,4,3,1]', output: '0' },
    ],
    constraints: ['1 <= prices.length <= 10^5', '0 <= prices[i] <= 10^4'],
    sampleTests: [
      { input: '[7,1,5,3,6,4]', expectedOutput: '5' },
      { input: '[7,6,4,3,1]', expectedOutput: '0' },
    ],
    hiddenTests: [
      { input: '[1]', expectedOutput: '0' },
      { input: '[2,4,1,7]', expectedOutput: '6' },
      { input: '[3,2,6,5,0,3]', expectedOutput: '4' },
    ],
    functionName: 'maxProfit',
    params: ['prices'],
    javaSignature: { returnType: 'int', paramTypes: ['int[]'] },
    cppSignature: { returnType: 'int', paramTypes: ['vector<int>&'] },
    knownApproaches: [
      {
        name: 'Single Pass Min Tracking',
        approachId: 'GREEDY',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        outline: 'Track the minimum price so far; at each day compute price - minSoFar.',
        optimal: true,
      },
      {
        name: 'Brute Force',
        approachId: 'BRUTE_FORCE',
        timeComplexity: 'O(n^2)',
        spaceComplexity: 'O(1)',
        outline: 'Try every buy/sell pair.',
        optimal: false,
      },
    ],
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(1)',
    points: 10,
    hints: [
      'For each day, the best profit selling today uses the cheapest price before today.',
      'Track the running minimum price in one pass.',
      'Answer = max over all days of (price - minSoFar).',
    ],
    solutionOutline: 'One pass tracking min price and max profit. O(n)/O(1).',
  },
  {
    title: 'Valid Anagram',
    slug: 'valid-anagram',
    description:
      'Given two strings s and t, return true if t is an anagram of s, and false otherwise.',
    difficulty: 'Easy',
    category: 'Hashing',
    tags: ['String', 'Hash Table', 'Sorting'],
    companies: ['Amazon', 'Spotify'],
    examples: [
      { input: 's = "anagram", t = "nagaram"', output: 'true' },
      { input: 's = "rat", t = "car"', output: 'false' },
    ],
    constraints: ['1 <= s.length, t.length <= 5*10^4', 'Lowercase English letters only.'],
    sampleTests: [
      { input: 'anagram\nnagaram', expectedOutput: 'true' },
      { input: 'rat\ncar', expectedOutput: 'false' },
    ],
    hiddenTests: [
      { input: 'a\nab', expectedOutput: 'false' },
      { input: 'aa\naa', expectedOutput: 'true' },
      { input: 'ab\nba', expectedOutput: 'true' },
    ],
    functionName: 'isAnagram',
    params: ['s', 't'],
    javaSignature: { returnType: 'boolean', paramTypes: ['String', 'String'] },
    cppSignature: { returnType: 'bool', paramTypes: ['string', 'string'] },
    knownApproaches: [
      {
        name: 'Character Count',
        approachId: 'HASHING',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        outline: 'Count character frequencies (26 letters) and compare.',
        optimal: true,
      },
      {
        name: 'Sort and Compare',
        approachId: 'SORTING_BASED',
        timeComplexity: 'O(n log n)',
        spaceComplexity: 'O(1)',
        outline: 'Sort both strings and compare the results.',
        optimal: false,
      },
    ],
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(1)',
    points: 10,
    hints: [
      'Anagrams contain exactly the same characters with the same frequencies.',
      'Count each character occurrence.',
      'Two length checks first can short-circuit the work.',
    ],
    solutionOutline: 'Frequency count of 26 letters, compare counts. O(n)/O(1).',
  },
  {
    title: 'Longest Substring Without Repeating Characters',
    slug: 'longest-substring-without-repeating-characters',
    description:
      'Given a string s, find the length of the longest substring without repeating characters.',
    difficulty: 'Medium',
    category: 'Sliding Window',
    tags: ['String', 'Sliding Window', 'Hash Table'],
    companies: ['Amazon', 'Google', 'Bloomberg'],
    examples: [
      { input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc".' },
      { input: 's = "bbbbb"', output: '1' },
    ],
    constraints: ['0 <= s.length <= 5*10^4'],
    sampleTests: [
      { input: 'abcabcbb', expectedOutput: '3' },
      { input: 'bbbbb', expectedOutput: '1' },
    ],
    hiddenTests: [
      { input: 'pwwkew', expectedOutput: '3' },
      { input: '', expectedOutput: '0' },
      { input: 'dvdf', expectedOutput: '3' },
    ],
    functionName: 'lengthOfLongestSubstring',
    params: ['s'],
    javaSignature: { returnType: 'int', paramTypes: ['String'] },
    cppSignature: { returnType: 'int', paramTypes: ['string'] },
    knownApproaches: [
      {
        name: 'Sliding Window with Set',
        approachId: 'SLIDING_WINDOW',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(min(n, charset))',
        outline: 'Expand right edge; when a duplicate appears, move the left edge until the window is unique.',
        optimal: true,
      },
      {
        name: 'Brute Force',
        approachId: 'BRUTE_FORCE',
        timeComplexity: 'O(n^2)',
        spaceComplexity: 'O(min(n, charset))',
        outline: 'Check every substring for uniqueness.',
        optimal: false,
      },
    ],
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(n)',
    points: 15,
    hints: [
      'A substring window can grow and shrink as you scan.',
      'Use two pointers for the window bounds and a set for characters inside.',
      'When s[right] is a duplicate, shrink from the left until it is unique again.',
    ],
    solutionOutline: 'Sliding window with a set/map of the current window. O(n)/O(charset).',
  },
  {
    title: 'Climbing Stairs',
    slug: 'climbing-stairs',
    description:
      'You are climbing a staircase with n steps. Each time you can climb either 1 or 2 steps. In how many distinct ways can you reach the top?',
    difficulty: 'Easy',
    category: 'Dynamic Programming',
    tags: ['Dynamic Programming', 'Math', 'Memoization'],
    companies: ['Amazon', 'Adobe'],
    examples: [
      { input: 'n = 2', output: '2', explanation: '1+1 or 2.' },
      { input: 'n = 3', output: '3' },
    ],
    constraints: ['1 <= n <= 45'],
    sampleTests: [
      { input: '2', expectedOutput: '2' },
      { input: '3', expectedOutput: '3' },
    ],
    hiddenTests: [
      { input: '1', expectedOutput: '1' },
      { input: '10', expectedOutput: '89' },
      { input: '45', expectedOutput: '1836311903' },
    ],
    functionName: 'climbStairs',
    params: ['n'],
    javaSignature: { returnType: 'int', paramTypes: ['int'] },
    cppSignature: { returnType: 'int', paramTypes: ['int'] },
    knownApproaches: [
      {
        name: 'Recursion (no memo)',
        approachId: 'RECURSION',
        timeComplexity: 'O(2^n)',
        spaceComplexity: 'O(n)',
        outline: 'ways(n) = ways(n-1) + ways(n-2) computed by plain recursion.',
        optimal: false,
      },
      {
        name: 'Iterative DP',
        approachId: 'DYNAMIC_PROGRAMMING',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        outline: 'Fibonacci-style rolling variables.',
        optimal: true,
      },
      {
        name: 'Memoized Recursion',
        approachId: 'MEMOIZATION',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        outline: 'Recursion with a cache of computed values.',
        optimal: true,
      },
    ],
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(1)',
    points: 10,
    hints: [
      'To reach step n you came from n-1 (1 step) or n-2 (2 steps).',
      'So ways(n) = ways(n-1) + ways(n-2) — the Fibonacci sequence.',
      'Two rolling variables give O(1) space.',
    ],
    solutionOutline: 'Iterative Fibonacci with two variables. O(n)/O(1).',
  },
  {
    title: 'Merge Two Sorted Lists',
    slug: 'merge-two-sorted-lists',
    description:
      'You are given the heads of two sorted linked lists list1 and list2. Merge the two lists into one sorted list by splicing together the nodes of the first two lists. Return the head of the merged list.\n\nThe list is represented as a sequence of (value, nextIndex) pairs in the test input; -1 for nextIndex means end of list. Your function receives the values as arrays — return the merged values as an array.',
    difficulty: 'Easy',
    category: 'Linked Lists',
    tags: ['Linked List', 'Recursion'],
    companies: ['Amazon', 'Microsoft', 'Adobe'],
    examples: [
      { input: 'list1 = [1,2,4], list2 = [1,3,4]', output: '[1,1,2,3,4,4]' },
      { input: 'list1 = [], list2 = [0]', output: '[0]' },
    ],
    constraints: ['0 <= list lengths <= 50', '-100 <= values <= 100', 'Both lists are sorted non-decreasing.'],
    sampleTests: [
      { input: '[1,2,4]\n[1,3,4]', expectedOutput: '[1,1,2,3,4,4]' },
      { input: '[]\n[0]', expectedOutput: '[0]' },
    ],
    hiddenTests: [
      { input: '[]\n[]', expectedOutput: '[]' },
      { input: '[-9,3]\n[5,7]', expectedOutput: '[-9,3,5,7]' },
    ],
    functionName: 'mergeTwoLists',
    params: ['list1', 'list2'],
    javaSignature: { returnType: 'int[]', paramTypes: ['int[]', 'int[]'] },
    cppSignature: { returnType: 'vector<int>', paramTypes: ['vector<int>', 'vector<int>'] },
    knownApproaches: [
      {
        name: 'Iterative Two Pointer Merge',
        approachId: 'TWO_POINTER',
        timeComplexity: 'O(n + m)',
        spaceComplexity: 'O(n + m)',
        outline: 'Compare front values of both lists, appending the smaller each step.',
        optimal: true,
      },
    ],
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(n)',
    points: 10,
    hints: [
      'Both lists are sorted — always take the smaller front element next.',
      'Handle the empty-list cases explicitly.',
      'After one list is exhausted, append the remainder of the other.',
    ],
    solutionOutline: 'Standard merge from merge-sort: two pointers, append smaller, append remainder. O(n+m).',
  },
  {
    title: 'Reverse Linked List',
    slug: 'reverse-linked-list',
    description:
      'Given the head of a singly linked list represented as an array of values, reverse the list and return the reversed values as an array.',
    difficulty: 'Easy',
    category: 'Linked Lists',
    tags: ['Linked List', 'Recursion'],
    companies: ['Amazon', 'Google'],
    examples: [
      { input: 'head = [1,2,3,4,5]', output: '[5,4,3,2,1]' },
      { input: 'head = []', output: '[]' },
    ],
    constraints: ['0 <= list length <= 5000'],
    sampleTests: [
      { input: '[1,2,3,4,5]', expectedOutput: '[5,4,3,2,1]' },
      { input: '[]', expectedOutput: '[]' },
    ],
    hiddenTests: [
      { input: '[1]', expectedOutput: '[1]' },
      { input: '[1,2]', expectedOutput: '[2,1]' },
    ],
    functionName: 'reverseList',
    params: ['head'],
    javaSignature: { returnType: 'int[]', paramTypes: ['int[]'] },
    cppSignature: { returnType: 'vector<int>', paramTypes: ['vector<int>'] },
    knownApproaches: [
      {
        name: 'Iterative Pointer Reversal',
        approachId: 'RECURSION',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        outline: 'Walk the list flipping each next pointer to the previous node.',
        optimal: true,
      },
    ],
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(1)',
    points: 10,
    hints: [
      'Track previous, current and next nodes while walking the list.',
      'Each step: reverse the current node pointer, then advance.',
      'The final previous node is the new head.',
    ],
    solutionOutline: 'Iterate flipping pointers with prev/curr/next. O(n)/O(1).',
  },
];
