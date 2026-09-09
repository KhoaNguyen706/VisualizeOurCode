import { describe, expect, it } from "vitest";
import {
  buildPythonEntryCall,
  detectPythonEntryTarget,
  detectPythonFunctionName,
  isPythonLike,
  pythonStepsToTraceHistory,
} from "./detectPython";

describe("isPythonLike", () => {
  it("matches python aliases and nothing else", () => {
    expect(isPythonLike("python")).toBe(true);
    expect(isPythonLike("PY")).toBe(true);
    expect(isPythonLike("javascript")).toBe(false);
    expect(isPythonLike(undefined)).toBe(false);
  });
});

describe("detectPythonFunctionName", () => {
  it("returns the first def name", () => {
    const code = "def twoSum(nums, target):\n    return []";
    expect(detectPythonFunctionName(code)).toBe("twoSum");
  });

  it("ignores a def that appears inside a comment above the real one", () => {
    const code = "# def wrong():\ndef right(x):\n    return x";
    expect(detectPythonFunctionName(code)).toBe("right");
  });

  it("returns null when there is no function", () => {
    expect(detectPythonFunctionName("x = 1\nprint(x)")).toBeNull();
  });
});

describe("detectPythonEntryTarget", () => {
  const SOLUTION = [
    "from collections import deque",
    "",
    "class Solution:",
    "    def islandsAndTreasure(self, grid: List[List[int]]) -> None:",
    "        if not grid:",
    "            return",
  ].join("\n");

  it("carries the class for a bound method, so it can be instantiated", () => {
    expect(detectPythonEntryTarget(SOLUTION)).toEqual({
      fnName: "islandsAndTreasure",
      className: "Solution",
    });
  });

  it("leaves a module-level function unqualified", () => {
    const code = "def twoSum(nums, target):\n    return []";
    expect(detectPythonEntryTarget(code)).toEqual({
      fnName: "twoSum",
      className: null,
    });
  });

  it("skips __init__ and returns the real entry point", () => {
    const code = [
      "class Solution:",
      "    def __init__(self):",
      "        self.seen = set()",
      "    def solve(self, nums):",
      "        return nums",
    ].join("\n");
    expect(detectPythonEntryTarget(code)?.fnName).toBe("solve");
  });

  it("does not instantiate for a method that takes no self", () => {
    const code = ["class Solution:", "    def solve(nums):", "        return nums"].join("\n");
    expect(detectPythonEntryTarget(code)?.className).toBeNull();
  });

  it("treats a def after the class body as module level", () => {
    const code = [
      "class Node:",
      "    def __init__(self, v):",
      "        self.v = v",
      "",
      "def solve(root):",
      "    return root",
    ].join("\n");
    expect(detectPythonEntryTarget(code)).toEqual({ fnName: "solve", className: null });
  });

  it("returns null when there is no function", () => {
    expect(detectPythonEntryTarget("x = 1")).toBeNull();
  });
});

describe("buildPythonEntryCall", () => {
  const method = { fnName: "islandsAndTreasure", className: "Solution" };
  const plain = { fnName: "twoSum", className: null };

  it("instantiates the class and passes the pasted grid through intact", () => {
    const grid = "[[2147483647,-1],[0,-1]]";
    expect(buildPythonEntryCall("", method, grid)).toBe(
      `Solution().islandsAndTreasure(${grid})`
    );
  });

  it("keeps several positional arguments as written", () => {
    expect(buildPythonEntryCall("", plain, "[2,7,11,15], 9")).toBe("twoSum([2,7,11,15], 9)");
  });

  it("passes keyword arguments through, which Python accepts", () => {
    expect(buildPythonEntryCall("", plain, "nums=[3,2], target=5")).toBe(
      "twoSum(nums=[3,2], target=5)"
    );
  });

  it("lets an explicit Example comment win over the pasted case", () => {
    const code = "# Example: twoSum([1,2], 3)";
    expect(buildPythonEntryCall(code, plain, "[9,9], 18")).toBe("twoSum([1,2], 3)");
  });

  it("drops an unbalanced test case rather than emitting a SyntaxError", () => {
    expect(buildPythonEntryCall("", plain, "[[1,2],[3]")).toBe("twoSum()");
  });

  it("ignores a bracket inside a string when checking balance", () => {
    expect(buildPythonEntryCall("", plain, `"a]b", 2`)).toBe(`twoSum("a]b", 2)`);
  });

  it("calls with no arguments when nothing was pasted", () => {
    expect(buildPythonEntryCall("", method, "")).toBe("Solution().islandsAndTreasure()");
  });
});

describe("pythonStepsToTraceHistory", () => {
  const SOURCE = [
    "def twoSum(nums, target):", // 1
    "    seen = {}", // 2
    "    for i, num in enumerate(nums):", // 3
    "        complement = target - num", // 4
    "        return [i]", // 5
  ].join("\n");

  it("marks a return line as a return step and keeps its value", () => {
    const steps = pythonStepsToTraceHistory(
      [
        { line: 2, vars: { seen: {} } },
        { line: 5, vars: { i: 1 }, returnValue: [1] },
      ],
      SOURCE
    );
    expect(steps[0].kind).toBe("mutation");
    expect(steps[1].kind).toBe("return");
    expect(steps[1].returnValue).toEqual([1]);
  });

  it("does not attach a return value to a non-return line", () => {
    const [step] = pythonStepsToTraceHistory(
      [{ line: 4, vars: { complement: 3 }, returnValue: 99 }],
      SOURCE
    );
    expect(step.kind).toBe("mutation");
    expect(step.returnValue).toBeUndefined();
  });
});
