import { SeedProblem } from './problems.part1';
import { canonicalizeComplexity } from '../complexity/complexity';

/**
 * AETHER Coding — validated complexity guidance for the seeded problem bank.
 *
 * IMPORTANT (spec §6): the canonical expected complexity is NEVER decided by
 * Gemini. It comes from human-curated seed data:
 *   1. an explicit override in `COMPLEXITY_OVERRIDES` below, or
 *   2. the hand-curated `knownApproaches` entry flagged `optimal: true`
 *      (+ the problem's curated `expectedTimeComplexity`).
 *
 * `verified: true` therefore means "asserted by curated content", which is the
 * only thing that can justify a RED optimization warning. Problems without
 * curated optimal approaches get `verified: false` and can at most produce the
 * AMBER "possibly improvable" state.
 *
 * Reference optimized code is written by hand and reviewed — it is served only
 * behind an explicit "Show Optimized Approach" click, after a submission.
 */

export interface SeedComplexityGuidance {
  expectedTime: string;
  expectedSpace: string;
  acceptedTimeClasses: string[];
  explanation: string;
  optimizationHint?: string;
  source: string;
  verified: boolean;
}

export interface SeedReferenceApproach {
  title: string;
  approachId: string;
  explanation: string;
  timeComplexity: string;
  spaceComplexity: string;
  code: Record<string, string>;
}

interface SeedComplexityOverride {
  guidance?: Partial<SeedComplexityGuidance>;
  referenceApproach?: SeedReferenceApproach;
}

// ── Explicit curated overrides ───────────────────────────────────────────────

export const COMPLEXITY_OVERRIDES: Record<string, SeedComplexityOverride> = {
  'best-time-to-buy-and-sell-stock': {
    guidance: {
      expectedTime: 'O(n)',
      expectedSpace: 'O(1)',
      acceptedTimeClasses: ['O(n)'],
      explanation: 'A single pass tracking the minimum price seen so far is sufficient.',
      optimizationHint: 'Track the minimum price seen so far and update the best profit during one pass.',
      source: 'CURATED',
      verified: true,
    },
    referenceApproach: {
      title: 'Single Pass Minimum-Price Tracking',
      approachId: 'GREEDY',
      explanation:
        'Walk the prices once. Keep the cheapest price seen so far; at each day the best profit selling today is price - minPrice. One pass, no nested iteration.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      code: {
        python: `def maxProfit(prices):
    min_price = float('inf')
    best = 0
    for price in prices:
        if price < min_price:
            min_price = price
        else:
            best = max(best, price - min_price)
    return best
`,
        javascript: `function maxProfit(prices) {
  let minPrice = Infinity;
  let best = 0;
  for (const price of prices) {
    if (price < minPrice) minPrice = price;
    else best = Math.max(best, price - minPrice);
  }
  return best;
}
`,
        java: `class Solution {
    public int maxProfit(int[] prices) {
        int minPrice = Integer.MAX_VALUE;
        int best = 0;
        for (int price : prices) {
            if (price < minPrice) minPrice = price;
            else best = Math.max(best, price - minPrice);
        }
        return best;
    }
}
`,
        cpp: `class Solution {
public:
    int maxProfit(vector<int>& prices) {
        int minPrice = INT_MAX, best = 0;
        for (int price : prices) {
            if (price < minPrice) minPrice = price;
            else best = max(best, price - minPrice);
        }
        return best;
    }
};
`,
      },
    },
  },

  'two-sum': {
    guidance: {
      expectedTime: 'O(n)',
      expectedSpace: 'O(n)',
      acceptedTimeClasses: ['O(n)'],
      explanation: 'A hash map of value → index resolves the complement in one pass.',
      optimizationHint: 'Store each value in a hash map as you go and look up the complement instead of comparing every pair.',
      source: 'CURATED',
      verified: true,
    },
    referenceApproach: {
      title: 'Single Pass Hash Map',
      approachId: 'HASHING',
      explanation:
        'Iterate once. For each value check whether target - value was already seen; store the current value with its index otherwise. One pass, O(n) extra space.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
      code: {
        python: `def twoSum(nums, target):
    seen = {}
    for i, value in enumerate(nums):
        need = target - value
        if need in seen:
            return [seen[need], i]
        seen[value] = i
    return []
`,
        javascript: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}
`,
      },
    },
  },

  'maximum-subarray': {
    guidance: {
      expectedTime: 'O(n)',
      expectedSpace: 'O(1)',
      acceptedTimeClasses: ['O(n)'],
      explanation: "Kadane's algorithm: keep the best sum ending at the current position.",
      optimizationHint: 'Keep a running sum and reset it to the current element whenever it turns negative.',
      source: 'CURATED',
      verified: true,
    },
    referenceApproach: {
      title: "Kadane's Algorithm",
      approachId: 'GREEDY',
      explanation:
        'Track the best sum that must end at the current index. If extending the previous sum makes it smaller than the element itself, restart from the element.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      code: {
        python: `def maxSubArray(nums):
    best = nums[0]
    current = nums[0]
    for value in nums[1:]:
        current = max(value, current + value)
        best = max(best, current)
    return best
`,
        javascript: `function maxSubArray(nums) {
  let best = nums[0];
  let current = nums[0];
  for (let i = 1; i < nums.length; i++) {
    current = Math.max(nums[i], current + nums[i]);
    best = Math.max(best, current);
  }
  return best;
}
`,
      },
    },
  },

  'valid-parentheses': {
    guidance: {
      expectedTime: 'O(n)',
      expectedSpace: 'O(n)',
      acceptedTimeClasses: ['O(n)'],
      explanation: 'A single stack pass matches each closer with the most recent opener.',
      optimizationHint: 'Push openers onto a stack and pop when a matching closer appears; the stack must end empty.',
      source: 'CURATED',
      verified: true,
    },
    referenceApproach: {
      title: 'Stack Matching',
      approachId: 'STACK',
      explanation:
        'Scan the string once. Push openers; on a closer pop the stack and verify the pair. An empty stack at the end means the string is balanced.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
      code: {
        python: `def isValid(s):
    pairs = {')': '(', ']': '[', '}': '{'}
    stack = []
    for ch in s:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
        else:
            stack.append(ch)
    return not stack
`,
        javascript: `function isValid(s) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const stack = [];
  for (const ch of s) {
    if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false;
    } else {
      stack.push(ch);
    }
  }
  return stack.length === 0;
}
`,
      },
    },
  },

  'valid-anagram': {
    guidance: {
      expectedTime: 'O(n)',
      expectedSpace: 'O(1)',
      acceptedTimeClasses: ['O(n)'],
      explanation: 'A single character-frequency pass over both strings decides anagram equality.',
      optimizationHint: 'Count characters once with a fixed-size frequency map instead of sorting both strings.',
      source: 'CURATED',
      verified: true,
    },
    referenceApproach: {
      title: 'Character Frequency Counting',
      approachId: 'HASHING',
      explanation:
        'Increment counts for the first string and decrement for the second. If every counter returns to zero the strings are anagrams — O(n) time regardless of length.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      code: {
        python: `def isAnagram(s, t):
    if len(s) != len(t):
        return False
    counts = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    for ch in t:
        if counts.get(ch, 0) == 0:
            return False
        counts[ch] -= 1
    return True
`,
        javascript: `function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) || 0) + 1);
  for (const ch of t) {
    const c = counts.get(ch) || 0;
    if (c === 0) return false;
    counts.set(ch, c - 1);
  }
  return true;
}
`,
      },
    },
  },
};

// ── Derivation from curated seed data ────────────────────────────────────────

/**
 * Build validated complexity guidance for a seeded problem.
 * Returns null when the seed record has no curated optimal approach — such a
 * problem cannot produce a RED warning.
 */
export function buildComplexityGuidance(p: SeedProblem): SeedComplexityGuidance | null {
  const override = COMPLEXITY_OVERRIDES[p.slug]?.guidance;
  const optimal = (p.knownApproaches || []).filter(a => a.optimal);

  if (override) {
    const accepted = (override.acceptedTimeClasses || [])
      .map(c => canonicalizeComplexity(c)?.canonical)
      .filter((c): c is string => !!c);
    return {
      expectedTime: override.expectedTime || p.expectedTimeComplexity,
      expectedSpace: override.expectedSpace || p.expectedSpaceComplexity,
      acceptedTimeClasses: accepted.length
        ? Array.from(new Set(accepted))
        : [canonicalizeComplexity(p.expectedTimeComplexity)?.canonical || p.expectedTimeComplexity],
      explanation: override.explanation || '',
      optimizationHint: override.optimizationHint || optimal[0]?.outline,
      source: override.source || 'CURATED',
      verified: override.verified !== false,
    };
  }

  if (optimal.length === 0) return null;

  const accepted = Array.from(new Set(
    [p.expectedTimeComplexity, ...optimal.map(a => a.timeComplexity)]
      .map(c => canonicalizeComplexity(c)?.canonical)
      .filter((c): c is string => !!c)
  ));

  return {
    expectedTime: canonicalizeComplexity(p.expectedTimeComplexity)?.canonical || p.expectedTimeComplexity,
    expectedSpace: canonicalizeComplexity(p.expectedSpaceComplexity)?.canonical || p.expectedSpaceComplexity,
    acceptedTimeClasses: accepted,
    explanation: optimal[0]?.outline || '',
    optimizationHint: optimal[0]?.outline || undefined,
    // Derived from the hand-curated, human-reviewed seed record.
    source: 'CURATED_SEED',
    verified: true,
  };
}

/** Reference optimized approach, when one was curated for this problem. */
export function buildReferenceApproach(p: SeedProblem): SeedReferenceApproach | null {
  const override = COMPLEXITY_OVERRIDES[p.slug]?.referenceApproach;
  if (override) return override;

  const optimal = (p.knownApproaches || []).find(a => a.optimal);
  if (!optimal) return null;

  // Guidance without curated code: the UI shows the approach but states that
  // reference code is unavailable rather than inventing a solution.
  return {
    title: optimal.name,
    approachId: optimal.approachId,
    explanation: optimal.outline,
    timeComplexity: optimal.timeComplexity,
    spaceComplexity: optimal.spaceComplexity,
    code: {},
  };
}
