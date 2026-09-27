/* AETHER Coding — post-submission complexity comparison tests (spec §66, §67). */
process.env.NODE_ENV = 'test';

const {
  canonicalizeComplexity,
  sameComplexity,
  compareComplexity,
  resolveComplexityMetadata,
  confidenceBand,
} = require('../dist/coding/complexity/complexity');
const { analyzeSource } = require('../dist/coding/ast/AstAnalyzer');

// The curated metadata that the seed provides for
// `best-time-to-buy-and-sell-stock` (spec §6 example).
const STOCK_METADATA = {
  expectedTimeComplexity: 'O(n)',
  expectedSpaceComplexity: 'O(1)',
  complexityGuidance: {
    expectedTime: 'O(n)',
    expectedSpace: 'O(1)',
    acceptedTimeClasses: ['O(n)'],
    explanation: 'A single pass tracking the minimum price so far is sufficient.',
    optimizationHint: 'Track the minimum price seen so far and update the best profit during one pass.',
    source: 'CURATED',
    verified: true,
  },
  knownApproaches: [
    { name: 'Single Pass Min Tracking', approachId: 'GREEDY', timeComplexity: 'O(n)', spaceComplexity: 'O(1)', outline: 'Track the minimum price so far.', optimal: true },
    { name: 'Brute Force', approachId: 'BRUTE_FORCE', timeComplexity: 'O(n^2)', spaceComplexity: 'O(1)', outline: 'Try every buy/sell pair.', optimal: false },
  ],
};

describe('complexity canonicalization — aliases normalize before comparison', () => {
  const expectations = [
    ['O(1)', 'O(1)'],
    ['o(1)', 'O(1)'],
    ['CONSTANT', 'O(1)'],
    ['O(log n)', 'O(log n)'],
    ['O(logn)', 'O(log n)'],
    ['O(N)', 'O(n)'],
    ['O(n)', 'O(n)'],
    ['O(N+M)', 'O(n)'],
    ['O(V + E)', 'O(n)'],
    ['O(n log n)', 'O(n log n)'],
    ['O(nlogn)', 'O(n log n)'],
    ['O(n*n)', 'O(n^2)'],
    ['O(N^2)', 'O(n^2)'],
    ['O(n²)', 'O(n^2)'],
    ['O(n^2)', 'O(n^2)'],
    ['O(n^3)', 'O(n^3)'],
    ['O(2^n)', 'O(2^n)'],
    ['O(n!)', 'O(n!)'],
  ];

  test.each(expectations)('%s → %s', (raw, expected) => {
    expect(canonicalizeComplexity(raw).canonical).toBe(expected);
  });

  test('unclassifiable strings return null instead of guessing', () => {
    expect(canonicalizeComplexity('Unknown')).toBeNull();
    expect(canonicalizeComplexity('')).toBeNull();
    expect(canonicalizeComplexity(null)).toBeNull();
    expect(canonicalizeComplexity('n log n times whatever')).toBeNull();
  });

  test('sameComplexity is alias-safe', () => {
    expect(sameComplexity('O(N^2)', 'O(n*n)')).toBe(true);
    expect(sameComplexity('O(n)', 'O(n^2)')).toBe(false);
    expect(sameComplexity('O(n)', 'Unknown')).toBe(false);
  });

  test('ranks follow the documented ordering O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2^n)', () => {
    const order = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n^2)', 'O(n^3)', 'O(2^n)', 'O(n!)'];
    const ranks = order.map(c => canonicalizeComplexity(c).rank);
    for (let i = 1; i < ranks.length; i++) expect(ranks[i]).toBeGreaterThan(ranks[i - 1]);
  });

  test('confidenceBand maps analyzer confidence thresholds', () => {
    expect(confidenceBand(0.9)).toBe('HIGH');
    expect(confidenceBand(0.6)).toBe('MEDIUM');
    expect(confidenceBand(0.2)).toBe('LOW');
  });
});

describe('resolveComplexityMetadata — validated guidance wins, derived degrades', () => {
  test('verified curated guidance is used verbatim', () => {
    const meta = resolveComplexityMetadata(STOCK_METADATA);
    expect(meta.expectedTime).toBe('O(n)');
    expect(meta.acceptedTimeClasses).toContain('O(n)');
    expect(meta.verified).toBe(true);
    expect(meta.optimizationHint).toContain('minimum price');
  });

  test('missing guidance falls back to unverified derived metadata (cannot produce RED)', () => {
    const meta = resolveComplexityMetadata({
      expectedTimeComplexity: 'O(n)',
      expectedSpaceComplexity: 'O(1)',
      knownApproaches: STOCK_METADATA.knownApproaches,
    });
    expect(meta.verified).toBe(false);
    expect(meta.source).toBe('DERIVED');
    expect(meta.acceptedTimeClasses).toContain('O(n)');
  });
});

describe('compareComplexity — spec §66: Best Time to Buy and Sell Stock', () => {
  const NESTED_LOOPS = `def maxProfit(prices):
    best = 0
    for i in range(len(prices)):
        for j in range(i + 1, len(prices)):
            profit = prices[j] - prices[i]
            if profit > best:
                best = profit
    return best`;

  const SINGLE_PASS = `def maxProfit(prices):
    min_price = float('inf')
    best = 0
    for price in prices:
        if price < min_price:
            min_price = price
        else:
            best = max(best, price - min_price)
    return best`;

  function compareFor(code) {
    const ast = analyzeSource(code, 'python');
    const meta = resolveComplexityMetadata(STOCK_METADATA);
    return {
      ast,
      result: compareComplexity({
        candidateTime: ast.complexity.estimatedTime,
        candidateSpace: ast.complexity.estimatedSpace,
        expectedTime: meta.expectedTime,
        expectedSpace: meta.expectedSpace,
        acceptedTimeClasses: meta.acceptedTimeClasses,
        analyzerConfidence: ast.complexity.confidence,
        metadataVerified: meta.verified,
        analysisAvailable: ast.parseSuccess,
        correctnessAccepted: true, // both solutions pass all tests
        evidence: ast.complexity.evidence,
        optimizationHint: meta.optimizationHint,
        optimizationExplanation: meta.explanation,
      }),
    };
  }

  test('solution 1 (nested loops) → RED warning, still Accepted', () => {
    const { ast, result } = compareFor(NESTED_LOOPS);
    expect(ast.complexity.estimatedTime).toBe('O(n^2)');
    expect(result.level).toBe('CLEAR_OPTIMIZATION_OPPORTUNITY');
    expect(result.warn).toBe(true);
    expect(result.optimizationAvailable).toBe(true);
    expect(result.candidateTime).toBe('O(n^2)');
    expect(result.expectedTime).toBe('O(n)');
    expect(result.message).toMatch(/passes the tests/);
    expect(result.message).not.toMatch(/incorrect/i);
    expect(result.optimizationHint).toContain('minimum price');
    // Confidence must be high enough to justify RED.
    expect(result.analyzerConfidence).toBeGreaterThanOrEqual(result.threshold);
  });

  test('solution 2 (single pass min tracking) → GREEN efficient message', () => {
    const { ast, result } = compareFor(SINGLE_PASS);
    expect(ast.complexity.estimatedTime).toBe('O(n)');
    expect(result.level).toBe('OPTIMAL');
    expect(result.warn).toBe(false);
    expect(result.optimizationAvailable).toBe(false);
    expect(result.message).toMatch(/matches the expected efficient complexity/);
  });

  test('slightly worse complexity → AMBER, not RED (O(n log n) vs O(n))', () => {
    const result = compareComplexity({
      candidateTime: 'O(n log n)',
      candidateSpace: 'O(1)',
      expectedTime: 'O(n)',
      expectedSpace: 'O(1)',
      acceptedTimeClasses: ['O(n)'],
      analyzerConfidence: 0.9,
      metadataVerified: true,
      analysisAvailable: true,
      correctnessAccepted: true,
    });
    expect(result.level).toBe('POSSIBLY_IMPROVABLE');
    expect(result.message).toMatch(/may be optimizable/);
  });

  test('correct code is never reported as incorrect (correctness ≠ efficiency)', () => {
    for (const code of [NESTED_LOOPS, SINGLE_PASS]) {
      const { result } = compareFor(code);
      expect(result.message).not.toMatch(/incorrect/i);
      expect(result.message).not.toMatch(/wrong answer/i);
    }
  });

  test('non-passing submission uses correct wording', () => {
    const { result } = compareFor(NESTED_LOOPS);
    const failed = compareComplexity({
      candidateTime: result.candidateTime,
      expectedTime: result.expectedTime,
      acceptedTimeClasses: ['O(n)'],
      analyzerConfidence: 0.9,
      metadataVerified: true,
      analysisAvailable: true,
      correctnessAccepted: false,
    });
    expect(failed.message).toMatch(/not fully correct/i);
  });
});

describe('compareComplexity — spec §67: uncertainty must never produce a false RED', () => {
  test('LOW analyzer confidence downgrades to AMBER', () => {
    const result = compareComplexity({
      candidateTime: 'O(n^2)',
      expectedTime: 'O(n)',
      acceptedTimeClasses: ['O(n)'],
      analyzerConfidence: 0.35,
      metadataVerified: true,
      analysisAvailable: true,
      correctnessAccepted: true,
    });
    expect(result.level).toBe('POSSIBLY_IMPROVABLE');
    expect(result.confidence).toBe('LOW');
    expect(result.reason).toMatch(/confidence/i);
  });

  test('unverified problem metadata downgrades to AMBER', () => {
    const result = compareComplexity({
      candidateTime: 'O(n^2)',
      expectedTime: 'O(n)',
      acceptedTimeClasses: ['O(n)'],
      analyzerConfidence: 0.9,
      metadataVerified: false,
      analysisAvailable: true,
    });
    expect(result.level).toBe('POSSIBLY_IMPROVABLE');
    expect(result.reason).toMatch(/validated/i);
  });

  test('unavailable AST analysis → UNKNOWN with no claim', () => {
    const result = compareComplexity({
      candidateTime: null,
      expectedTime: 'O(n)',
      acceptedTimeClasses: ['O(n)'],
      analyzerConfidence: 0,
      metadataVerified: true,
      analysisAvailable: false,
    });
    expect(result.level).toBe('UNKNOWN');
    expect(result.warn).toBe(false);
    expect(result.optimizationAvailable).toBe(false);
    expect(result.message).toMatch(/unavailable/i);
  });

  test('unclassifiable candidate complexity → UNKNOWN, not RED', () => {
    const result = compareComplexity({
      candidateTime: 'O(whatever the recursion does)',
      expectedTime: 'O(n)',
      acceptedTimeClasses: ['O(n)'],
      analyzerConfidence: 0.9,
      metadataVerified: true,
      analysisAvailable: true,
    });
    expect(result.level).toBe('UNKNOWN');
    expect(result.warn).toBe(false);
  });

  test('problem without a validated expectation → UNKNOWN', () => {
    const result = compareComplexity({
      candidateTime: 'O(n^2)',
      expectedTime: '',
      acceptedTimeClasses: [],
      analyzerConfidence: 0.9,
      metadataVerified: false,
      analysisAvailable: true,
    });
    expect(result.level).toBe('UNKNOWN');
  });
});

describe('confidenceThreshold env override', () => {
  const original = process.env.COMPLEXITY_CONFIDENCE_THRESHOLD;
  afterEach(() => {
    if (original === undefined) delete process.env.COMPLEXITY_CONFIDENCE_THRESHOLD;
    else process.env.COMPLEXITY_CONFIDENCE_THRESHOLD = original;
  });

  test('raising the threshold removes a RED warning at the same confidence', () => {
    process.env.COMPLEXITY_CONFIDENCE_THRESHOLD = '0.2';
    const low = compareComplexity({
      candidateTime: 'O(n^3)',
      expectedTime: 'O(n)',
      acceptedTimeClasses: ['O(n)'],
      analyzerConfidence: 0.6,
      metadataVerified: true,
      analysisAvailable: true,
    });
    expect(low.level).toBe('CLEAR_OPTIMIZATION_OPPORTUNITY');

    process.env.COMPLEXITY_CONFIDENCE_THRESHOLD = '0.9';
    const high = compareComplexity({
      candidateTime: 'O(n^3)',
      expectedTime: 'O(n)',
      acceptedTimeClasses: ['O(n)'],
      analyzerConfidence: 0.6,
      metadataVerified: true,
      analysisAvailable: true,
    });
    expect(high.level).toBe('POSSIBLY_IMPROVABLE');
  });
});
