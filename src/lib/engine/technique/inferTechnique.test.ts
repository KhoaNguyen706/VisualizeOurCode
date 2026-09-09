import { describe, expect, it } from "vitest";
import { inferTechniqueFromCode } from "./inferTechnique";

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

  it("recognises memoised recursion as dp", () => {
    const code = "memo = {}\ndef go(i):\n    if i in memo:\n        return memo[i]";
    expect(inferTechniqueFromCode(code)).toBe("dp_grid");
  });

  it("does not call plain grid indexing dp", () => {
    const code = "for r in range(rows):\n    for c in range(cols):\n        total += grid[r][c]";
    expect(inferTechniqueFromCode(code)).not.toBe("dp_grid");
  });
});
