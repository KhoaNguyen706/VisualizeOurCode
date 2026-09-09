import { describe, expect, it } from "vitest";
import { analyzeLocally } from "./analyzeLocally";
import { instrumentCode } from "./instrumentCode";
import { runSandbox } from "./runSandbox";

/**
 * The shapes a first draft actually takes — an inline early return, a nested
 * subscript into a map, a helper written above the function that calls it —
 * traced end to end, because each of these once produced a trace with the
 * answer missing.
 */
const TWO_SUM = `function twoSum(nums, target) {
  const seen = {};
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (complement in seen) return [seen[complement], i];
    seen[nums[i]] = i;
  }
  return [];
}

// Example: twoSum([2, 7, 11, 15], 9)`;

describe("instrumentCode on first-draft shapes", () => {
  it("traces a write through a nested subscript", () => {
    const { tracePoints, traceKinds } = instrumentCode(TWO_SUM);
    expect(tracePoints).toContain(6);
    expect(traceKinds.find((k) => k.line === 6)?.kind).toBe("mutation");
  });

  it("traces an inline `if (cond) return x;` as a condition and a return", () => {
    const { code, traceKinds } = instrumentCode(TWO_SUM);
    const kinds = traceKinds.filter((k) => k.line === 5).map((k) => k.kind);
    expect(kinds).toEqual(["condition", "return"]);
    expect(code).toContain("return __ret__([seen[complement], i]);");
  });

  it("leaves an inline `if (cond) continue;` alone", () => {
    const src = `function f(xs) {\n  for (const x of xs) {\n    if (x < 0) continue;\n  }\n  return 1;\n}`;
    const { code, traceKinds } = instrumentCode(src);
    expect(code).toContain("continue;");
    expect(traceKinds.filter((k) => k.line === 3).map((k) => k.kind)).toEqual(["condition"]);
  });
});

describe("runSandbox output capture", () => {
  it("collects console.log output and the return value", () => {
    const src = `function f(n) {\n  console.log("n is", n);\n  return n * 2;\n}`;
    const { code } = instrumentCode(src);
    const result = runSandbox(code, "f(4)");
    expect(result.returnValue).toBe(8);
    expect(result.stdout).toBe("n is 4");
  });

  it("restores console.log after the run", () => {
    const original = console.log;
    const { code } = instrumentCode(`function f() {\n  return 1;\n}`);
    runSandbox(code, "f()");
    expect(console.log).toBe(original);
  });
});

describe("analyzeLocally on Two Sum", () => {
  it("ends on the return with its real value, and shows the map being built", async () => {
    const r = await analyzeLocally(TWO_SUM, "javascript");
    if ("error" in r) throw new Error(r.error);
    const messages = r.scenario.timeline.map((f) => f.message);
    expect(messages.at(-1)).toContain("[0, 1]");
    expect(messages.some((m) => m.includes("seen holds 1 entry"))).toBe(true);
    expect(messages.some((m) => m.includes("2 in seen") && m.includes("true"))).toBe(true);
    expect(r.hasReturnValue).toBe(true);
    expect(r.returnValue).toEqual([0, 1]);
  });

  it("offers a line-by-line timeline with at least as many frames as beats", async () => {
    const r = await analyzeLocally(TWO_SUM, "javascript");
    if ("error" in r) throw new Error(r.error);
    expect(r.lineTimeline).toBeDefined();
    expect(r.lineTimeline!.length).toBeGreaterThanOrEqual(r.scenario.timeline.length);
    // Same technique markers on both, so the canvas draws either the same way.
    expect(r.lineTimeline![0].technique).toBe(r.scenario.timeline[0].technique);
  });

  it("runs the function nothing else calls when the helper is written first", async () => {
    const src = `function dfs(grid, r, c) {
  if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length) return;
  if (grid[r][c] !== 1) return;
  grid[r][c] = 0;
  dfs(grid, r + 1, c);
  dfs(grid, r - 1, c);
  dfs(grid, r, c + 1);
  dfs(grid, r, c - 1);
}
function numIslands(grid) {
  let count = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c] === 1) {
        dfs(grid, r, c);
        count++;
      }
    }
  }
  return count;
}
// Example: numIslands([[1,1,0],[0,0,1]])`;
    const r = await analyzeLocally(src, "javascript");
    if ("error" in r) throw new Error(r.error);
    expect(r.source).toBe("trace");
    expect(r.returnValue).toBe(2);
  });
});
