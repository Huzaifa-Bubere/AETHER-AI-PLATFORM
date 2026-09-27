# 06 — Coding Visualizer (Animated Algorithm Dry-Run)

**Feature:** Post-submission animated algorithm visualizer — vertical storytelling layout, real instrumented execution traces, AETHER professional light theme.

**Scope:** verify the animation experience for every required algorithm family (§46) using real traces only. Official scoring, hidden tests, Judge0 runs and AST analysis are unchanged by the visualizer — those are covered in `05-coding.md`.

**Entry point:** `/coding/problems/:slug` → Submit → **Visualize Execution** button (toolbar, and the Visualize tab) → choose Sample or Custom input → watch the animated story.

**Guardrails to keep verifying on every test:**
- Only Sample / Custom inputs are offered — hidden tests never appear.
- Frames come from the instrumented sandbox run; values are never AI-invented.
- Light theme (page `#F8FAFC`, white cards, `#E2E8F0` borders); no dark reference theme.
- Primary view shows animation + expression + counters + code — never raw JSON. Raw data lives only in the optional Variables drawer.

---

## 1. Two Sum — Brute Force (§13, §43)

**Program (Python):**

```python
def twoSum(nums, target):
    n = len(nums)
    for i in range(n):
        for j in range(i + 1, n):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
```

**Input (custom stdin):**

```
[55, 25, 23, 35, 92, 10, 89, 22]
111
```

**Expected animation sequence:**

1. Header shows the problem title and objective; badge shows `BRUTE FORCE`.
2. Array renders as 8 white cards with indices `0…7` underneath.
3. `i` pointer (top, indigo) at index 0, `j` pointer (bottom, amber) at index 1.
4. Cells 55 and 25 scale up with amber glow; expression animates `55 + 25` then result `80` with `≠ 111` verdict chip.
5. Counter reads `1 COMPARISON • BRUTE FORCE`; explanation "Check every pair."
6. Each next pair animates its own step (55+23=78, 55+35=90, …); `j` slides; compared cells become muted `visited`.
7. Code panel highlights the `if nums[i] + nums[j] == target:` line, moving smoothly.
8. Final pair: `89 + 22 = 111` — result green, both cells turn emerald `matched`, banner **MATCH FOUND** with `Indices: 6, 7`.
9. Playback pauses longer on the critical match step; afterwards the **EXECUTION COMPLETE** summary shows Approach `BRUTE FORCE`, operations count, result `[6, 7]`.

**Pass criteria:** every meaningful comparison gets its own animated step (no instant jump through all iterations); pointer slides; expression stages operand → operator → result; counter increments smoothly; match state animates.

---

## 2. Two Sum — Hash Map (§14, §44, §15)

**Program:**

```python
def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        need = target - num
        if need in seen:
            return [seen[need], i]
        seen[num] = i
    return []
```

**Input:** same as test 1.

**Expected animation sequence:**

1. Badge shows `HASH MAP`; mantra "Remember every number you pass."
2. Current number highlighted blue; expression `111 − 55 = 56` with `NOT IN SEEN` verdict.
3. **SEEN MEMORY** strip below: new value slides in per iteration (`55`, then `25`, then `23`…); counter `3 LOOKUPS • HASH MAP` grows.
4. On complement hit: expression `111 − 89 = 22` → verdict `FOUND IN SEEN`; the stored memory cell pulses emerald; both the current cell and the matching array cell turn matched; **MATCH FOUND** banner with indices.
5. Counter labelled `LOOKUPS` increments per complement check.

**Pass criteria:** SEEN strip fills progressively with slide/fade; matching stored cell pulses once; lookup count is real (from trace collection growth).

---

## 3. Two Sum — Two Pointers (§16, §45)

**Program:**

```python
def twoSumSorted(nums, target):
    nums = sorted(nums)
    left, right = 0, len(nums) - 1
    while left < right:
        s = nums[left] + nums[right]
        if s == target:
            return [left, right]
        if s < target:
            left += 1
        else:
            right -= 1
    return []
```

**Input:** same as test 1.

**Expected animation sequence:**

1. Array shown sorted: `10 22 23 25 35 55 89 92` — mirrors what the code actually sorts.
2. `L` pointer (top, blue) and `R` pointer (bottom, green) visibly labelled.
3. Expression `10 + 92 = 102` → `TOO SMALL` → explanation "The sum is too small — only moving the left pointer can help."
4. `L` slides to 22 → `22 + 92 = 114` → `TOO LARGE` → `R` slides to 89.
5. Final `22 + 89 = 111` → **MATCH FOUND**, both cells emerald.

**Pass criteria:** pointer labels travel smoothly (spring) between cells, never disappear/reappear; verdict chips color-code small (green TRUE direction) vs large (red).

---

## 4. Binary Search (§19)

**Program:**

```python
def binarySearch(nums, target):
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
```

**Input:**

```
[1, 3, 5, 7, 9, 11]
9
```

**Expected animation sequence:**

1. Badge `BINARY SEARCH`; mantra "Discard the half that cannot contain the target."
2. `low`, `mid`, `high` pointers; counter `1 ITERATION • BINARY SEARCH`.
3. Expression `nums[2] = 5` then `5 < 9 → GO RIGHT` verdict; explanation "Discard the left half."
4. Cells outside the active `[low…high]` interval fade to muted state; interval animates as the range shrinks.
5. `9` found at mid → matched cell + **MATCH FOUND**.

**Pass criteria:** active interval visualization; discarded halves visually muted; `low/mid/high` pointers animate each iteration.

---

## 5. Bubble Sort (§18)

**Program:**

```python
def bubbleSort(nums):
    n = len(nums)
    for i in range(n):
        for j in range(0, n - i - 1):
            if nums[j] > nums[j + 1]:
                nums[j], nums[j + 1] = nums[j + 1], nums[j]
    return nums
```

**Input:** `[5, 3, 8, 2]`

**Expected animation sequence:**

1. Cells 5 and 3 highlighted as comparing; expression `5 > 3 → TRUE`.
2. On swap: the primary array snapshot changes (`[3, 5, 8, 2]`), swapped cells get the `updated` indigo treatment, counter `1 SWAP • SORTING` (comparisons + swaps both tracked).
3. Largest values progressively settle; explanation swaps between "These neighbours were out of order — they swapped." and "Compare neighbouring elements."

**Pass criteria:** cell VALUES change in place after a swap (live array update); positions reorder — not just colors; counter reflects real swaps.

---

## 6. Stock Buy/Sell (one pass — §46)

**Program:**

```python
def maxProfit(prices):
    best = 0
    low = prices[0]
    for p in prices:
        if p - low > best:
            best = p - low
        if p < low:
            low = p
    return best
```

**Input:** `[7, 1, 5, 3, 6, 4]`

**Expected animation:** `low` pointer travels the array; expression shows `p − low` comparisons (e.g. `1 − 7`, `5 − 1`); best value updates animate `0 → 4 → 5`; explanation narrates scanning while tracking the minimum.

**Pass criteria:** expression derives from real trace variables; `best` update steps get `important` dwell (longer pause).

---

## 7. Sliding Window (§20)

**Program:**

```python
def maxSumWindow(nums, k):
    best = 0
    window_sum = 0
    start = 0
    for end in range(len(nums)):
        window_sum += nums[end]
        if end >= k:
            window_sum -= nums[start]
            start += 1
        if window_sum > best:
            best = window_sum
    return best
```

**Input:**

```
[2, 1, 5, 1, 3, 2]
3
```

**Expected animation:** dashed indigo window overlay spans `start…end`; expands as `end` grows, slides as `start` advances; expression shows `window_sum`; counter counts window steps; explanation alternates grow/shrink copy.

**Pass criteria:** window border animates smoothly (spring, width+position), not re-rendered abruptly.

---

## 8. Stack (§21)

**Program:**

```python
def processStack(ops):
    stack = []
    for op in ops:
        if op > 0:
            stack.append(op)
        else:
            stack.pop()
    return stack
```

**Input:** `[9, 5, 2, -1, 7]`

**Expected animation:** vertical stack with `TOP ▼` marker; push: element enters from the top with spring; pop: top element fades upward; operation chip shows `PUSH` / `POP`; counter `OPERATION • STACK`.

**Pass criteria:** true vertical graphic; enter/exit animations directional; current top highlighted.

---

## 9. BFS (§22, §25)

**Program:**

```python
from collections import deque

def bfs(graph, start):
    visited = {start}
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nb in graph[node]:
            if nb not in visited:
                visited.add(nb)
                queue.append(nb)
    return order
```

**Input:**

```
{"1": ["2", "3"], "2": ["4"], "3": ["4"], "4": []}
1
```

**Expected animation:** graph adjacency cards show `current` (blue), `visited` (green), unvisited (neutral); queue view underneath synchronizes — front element dequeues (slides out), neighbors enqueue (slide in at rear); counter `VISITED NODE • TRAVERSAL`.

**Pass criteria:** graph + queue + visited all animate in the same step and stay consistent.

---

## 10. Fibonacci Recursion (§26, §27)

**Program:**

```python
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
```

**Input:** `[5]`

**Expected animation:** call tree grows downward (`fib(5)` → `fib(4)` → …) with depth indentation; on returns, values animate back upward (`fib(1) = 1`, `fib(2) = 2`…); call stack panel shows frames entering/exiting with `ACTIVE` badge; counter counts calls.

**Pass criteria:** return values visible per frame; critical dwell on returns; tree mirrors real call trace.

---

## 11. DP Matrix (§24)

**Program:**

```python
def uniquePaths(m, n):
    dp = [[1] * n for _ in range(m)]
    for i in range(1, m):
        for j in range(1, n):
            dp[i][j] = dp[i - 1][j] + dp[i][j - 1]
    return dp[m - 1][n - 1]
```

**Input:**

```
3
3
```

**Expected animation:** real grid with row/column indices; active cell glows; on write, cell animates old → new value (e.g. `3 → 7` with crossfade); counter `CELL FILL • DYNAMIC PROGRAMMING`.

**Pass criteria:** grid is a true matrix (not a flat list); write animation shows the previous value being replaced.

---

## 12. Linked List Traversal (§23, §46)

**Program:**

```python
def listLength(head):
    count = 0
    while head:
        count += 1
        head = head.next
    return count
```

**Build the list in the harness input form the platform provides** (or use a node-chain constructing wrapper); expected: nodes render as `2 → 5 → 9 → null` cards; `head`/`curr` pointer labels advance node to node; counter counts node steps.

**Pass criteria:** chain renders with arrows and `null` terminator; pointers animate between nodes.

---

## 13. Error state (§41) & safety (§42)

**Program:**

```python
def boom(nums):
    total = 0
    for i in range(10):
        total += nums[i]
    return total
```

**Input:** `[1, 2, 3]`

**Expected:** steps render up to the failure, then a rose **VISUALIZATION STOPPED — Runtime Error** block with the real error (IndexError) and failing line highlighted in the code panel; Previous/scrubbing still works through earlier steps; browser never freezes.

**Infinite loop check:** submit `while True: pass` with any input → trace stops at the 2,000-step safety cap; amber "Stopped at safety limit" chip appears; UI remains responsive.

---

## 14. Playback & controls (§28, §29, §30)

For any trace above verify:
- Play/Pause, Previous, Next, Restart, End buttons; timeline scrubber with filled progress; speed selector `0.5× 1× 1.5× 2×`.
- Scrubbing backwards reconstructs state correctly (full snapshots) — jump to step 3 then 30 then 12 and confirm consistency.
- Pacing: normal transitions ~0.35–0.5s, dwell between steps ~0.7–1.2s at 1×, longer (~1.7s) on MATCH FOUND / EXECUTION COMPLETE; 2× visibly faster; no continuous flashing or bouncy decorative motion.
- Keyboard: ← / → step, Space toggles play.
- `prefers-reduced-motion`: transitions become near-instant fades; state accuracy unchanged.
- Variables drawer: opens from the header toggle; shows scalar history like `i: 0 → 1 → 2 → 3` up to the current step.

## 15. Complexity summary & approach comparison (§31, §32)

- Final frame shows **EXECUTION COMPLETE** with Approach, measured operations, result, and **Estimated Complexity** (time/space) sourced from AST analysis with evidence lines — labelled "Estimated", never claimed as measured from runtime input.
- Where the problem defines `knownApproaches`, the Complexity tab still shows the approach table (Brute Force O(n²)/O(1), Hash Map O(n)/O(n)…) — educational only; the candidate's own submission is always what gets visualized.

## 16. Regression checklist

- Monaco editing, Run, Submit, hidden-test evaluation, AST analysis, scoring, submission history — all unchanged after submission flows.
- No dark theme anywhere in the visualizer; branding consistent with AETHER.
- Mobile: sections stack; desktop keeps animation + code side-by-side.
