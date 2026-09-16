/* Quick AST engine smoke test (run with ts-node, no DB needed). */
import { analyzeSource } from '../ast/AstAnalyzer';

const bruteJs = `function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [i, j];
    }
  }
  return [];
}`;

const hashJs = `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (map.has(need)) return [map.get(need), i];
    map.set(nums[i], i);
  }
  return [];
}`;

const hashPy = `def twoSum(nums, target):
    seen = {}
    for i in range(len(nums)):
        need = target - nums[i]
        if need in seen:
            return [seen[need], i]
        seen[nums[i]] = i
    return []`;

const brutePy = `def twoSum(nums, target):
    n = len(nums)
    for i in range(n):
        for j in range(i + 1, n):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []`;

const binarySearchJs = `function search(nums, target) {
  let left = 0, right = nums.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}`;

const cases: Array<[string, string, any]> = [
  ['JS brute force', bruteJs, 'javascript'],
  ['JS hash map', hashJs, 'javascript'],
  ['Py brute force', brutePy, 'python'],
  ['Py hash map', hashPy, 'python'],
  ['JS binary search', binarySearchJs, 'javascript'],
];

for (const [name, code, lang] of cases) {
  const r = analyzeSource(code, lang, { expectedTimeComplexity: 'O(n)', knownApproaches: [] });
  console.log(`=== ${name} ===`);
  console.log(`parse: ${r.parseSuccess} | parser: ${r.parser}`);
  console.log(`loops: ${r.metrics.loops} nested: ${r.metrics.nestedLoopDepth} maxNest: ${r.metrics.maxNestingDepth} recursion: ${r.metrics.recursionDetected}`);
  console.log(`approach: ${r.approach.detectedApproach} (${r.approach.confidence.toFixed(2)})`);
  console.log(`time: ${r.complexity.estimatedTime} space: ${r.complexity.estimatedSpace} conf: ${r.complexity.confidence.toFixed(2)}`);
  console.log(`DS: ${r.dataStructures.join(', ')}`);
}
