import { describe, expect, it } from "vitest";
import { buildPatternHint, maxLoopNesting } from "./patternHint";

describe("maxLoopNesting", () => {
  it("counts nested loops in brace-delimited source", () => {
    const code = [
      "function twoSum(nums, target) {",
      "  for (let i = 0; i < nums.length; i++) {",
      "    for (let j = i + 1; j < nums.length; j++) {",
      "      if (nums[i] + nums[j] === target) return [i, j];",
      "    }",
      "  }",
      "  return [];",
      "}",
    ].join("\n");
    expect(maxLoopNesting(code)).toBe(2);
  });

  it("counts nested loops in indentation-delimited source", () => {
    const code = [
      "def twoSum(nums, target):",
      "    for i in range(len(nums)):",
      "        for j in range(i + 1, len(nums)):",
      "            if nums[i] + nums[j] == target:",
      "                return [i, j]",
      "    return []",
    ].join("\n");
    expect(maxLoopNesting(code)).toBe(2);
  });

  it("does not stack loops that merely follow one another", () => {
    const code = [
      "def scan(nums):",
      "    for n in nums:",
      "        print(n)",
      "    for n in nums:",
      "        print(n)",
      "    return nums",
    ].join("\n");
    expect(maxLoopNesting(code)).toBe(1);
  });

  it("reads a tab-indented body as one level deeper", () => {
    const code = ["def scan(rows):", "\tfor row in rows:", "\t\tfor cell in row:", "\t\t\tprint(cell)"].join("\n");
    expect(maxLoopNesting(code)).toBe(2);
  });

  it("ignores loop keywords inside comments", () => {
    const code = ["def scan(nums):", "    # for n in nums:", "    return nums"].join("\n");
    expect(maxLoopNesting(code)).toBe(0);
  });
});

describe("buildPatternHint", () => {
  it("observes nesting in a Python solution, not just a JavaScript one", () => {
    const python = [
      "def twoSum(nums, target):",
      "    for i in range(len(nums)):",
      "        for j in range(i + 1, len(nums)):",
      "            if nums[i] + nums[j] == target:",
      "                return [i, j]",
    ].join("\n");
    const hint = buildPatternHint("two_sum", python);
    expect(hint?.title).toBe("Two Sum");
    expect(hint?.yours).toBe("your solution nests 2 loops");
  });

  it("leaves the observation off when there is nothing to observe", () => {
    const hint = buildPatternHint("two_sum", "def twoSum(nums, target):\n    return []");
    expect(hint?.yours).toBeUndefined();
  });

  it("returns nothing for a pattern with no catalogued approach", () => {
    expect(buildPatternHint("generic", "for (;;) {}")).toBeUndefined();
  });
});
