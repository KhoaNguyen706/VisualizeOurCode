import { describe, expect, it } from "vitest";
import { inferTechniqueFromCode, inferTechniquesFromCode, selfCallingFunctions } from "./inferTechnique";

describe("inferTechniqueFromCode", () => {
  it("calls a grid BFS bfs, not dynamic programming", () => {
    const code = [
      "from collections import deque",
      "q = deque()",
      "while q:",
      "    r, c = q.popleft()",
      "    if grid[nr][nc] == INF:",
      "        grid[nr][nc] = grid[r][c] + 1",
      "        q.append((nr, nc))",
    ].join("\n");
    expect(inferTechniqueFromCode(code)).toBe("bfs");
  });

  it("still recognises tabulation over a grid as dp", () => {
    const code = [
      "dp = [[0] * n for _ in range(m)]",
      "for i in range(m):",
      "    for j in range(n):",
      "        dp[i][j] = dp[i-1][j] + dp[i][j-1]",
    ].join("\n");
    expect(inferTechniqueFromCode(code)).toBe("dp_grid");
  });

  it("recognises memoised recursion as 1-D dp", () => {
    const code = "memo = {}\ndef go(i):\n    if i in memo:\n        return memo[i]";
    expect(inferTechniqueFromCode(code)).toBe("dp_1d");
  });

  it("does not call plain grid indexing dp", () => {
    const code = "for r in range(rows):\n    for c in range(cols):\n        total += grid[r][c]";
    expect(inferTechniqueFromCode(code)).not.toBe("dp_grid");
  });
});

describe("inferTechniquesFromCode", () => {
  it("names every approach the code combines, leading with the traversal", () => {
    const code = [
      "from collections import deque",
      "def bfs(grid):",
      "    seen = set()",
      "    q = deque([(0, 0)])",
      "    while q:",
      "        r, c = q.popleft()",
      "        if (r, c) in seen:",
      "            continue",
      "        seen.add((r, c))",
      "        q.append((r + 1, c))",
    ].join("\n");
    expect(inferTechniquesFromCode(code)).toEqual(["bfs", "hash_set"]);
  });

  it("keeps memoised recursion as dp and still shows the recursion and the memo", () => {
    const code =
      "memo = {}\ndef go(i):\n    if i in memo:\n        return memo[i]\n    memo[i] = go(i - 1) + go(i - 2)\n    return memo[i]";
    expect(inferTechniquesFromCode(code)).toEqual(["dp_1d", "recursion", "hash_map"]);
  });

  it("promotes a set-based scan the single-label chain could only call a loop", () => {
    const code =
      "def hasDup(nums):\n    seen = set()\n    for n in nums:\n        if n in seen:\n            return True\n        seen.add(n)\n    return False";
    expect(inferTechniquesFromCode(code)).toEqual(["hash_set"]);
    expect(inferTechniqueFromCode(code)).toBe("hash_set");
  });

  it("recognises a function that calls itself with no keyword in sight", () => {
    const py = "def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)";
    expect(inferTechniquesFromCode(py)).toEqual(["recursion"]);
    const js = "function fib(n) {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}";
    expect(inferTechniquesFromCode(js)).toEqual(["recursion"]);
    const method =
      "class Solution:\n    def fib(self, n):\n        if n < 2:\n            return n\n        return self.fib(n - 1) + self.fib(n - 2)";
    expect(inferTechniquesFromCode(method)).toEqual(["recursion"]);
  });

  it("does not call a helper recursive just because it is called", () => {
    const code =
      "def helper(x):\n    return x * 2\n\ndef main(nums):\n    total = 0\n    for n in nums:\n        total += helper(n)\n    return total";
    expect(selfCallingFunctions(code)).toEqual([]);
    expect(inferTechniquesFromCode(code)).toEqual(["array_scan"]);
  });

  it("labels a JavaScript BFS over an adjacency map with everything it uses", () => {
    const code = [
      "function shortest(graph, start) {",
      "  const dist = {};",
      "  const visited = new Set([start]);",
      "  const queue = [start];",
      "  while (queue.length) {",
      "    const node = queue.shift();",
      "    for (const next of graph[node]) {",
      "      if (!visited.has(next)) { visited.add(next); queue.push(next); }",
      "    }",
      "  }",
      "  return dist;",
      "}",
    ].join("\n");
    expect(inferTechniquesFromCode(code)).toEqual(["bfs", "graph", "hash_map", "hash_set"]);
  });

  it("lists one member of a family only", () => {
    const code =
      "def search(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1";
    const techniques = inferTechniquesFromCode(code);
    expect(techniques[0]).toBe("binary_search");
    expect(techniques).not.toContain("two_pointer");
  });
});
