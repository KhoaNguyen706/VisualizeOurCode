import { describe, expect, it } from "vitest";
import { chooseEntry } from "./chooseEntry";
import { detectPythonEntryTarget } from "./python/detectPython";
import { detectFunctionName } from "./runSandbox";

describe("chooseEntry", () => {
  it("picks the function nothing else calls, whatever the order", () => {
    const code = `
def dfs(grid, visited, r, c):
    dfs(grid, visited, r + 1, c)

def numIslands(grid):
    dfs(grid, set(), 0, 0)
`;
    expect(chooseEntry(["dfs", "numIslands"], code)).toBe("numIslands");
  });

  it("lets an Example comment name the entry outright", () => {
    const code = `def a():\n    b()\ndef b():\n    pass\n# Example: b()`;
    expect(chooseEntry(["a", "b"], code, "b()")).toBe("b");
  });

  it("falls back to the first name when every function is called somewhere", () => {
    const code = `def a():\n    b()\ndef b():\n    a()`;
    expect(chooseEntry(["a", "b"], code)).toBe("a");
  });

  it("does not count a mention in a comment as a call", () => {
    const code = `def main():\n    helper()\n# main() is the entry\ndef helper():\n    pass`;
    expect(chooseEntry(["main", "helper"], code)).toBe("main");
  });
});

describe("detectPythonEntryTarget with a helper written first", () => {
  it("chooses the public method over the dfs helper it calls", () => {
    const code = `class Solution:
    def dfs(self, grid, visited, r, c):
        if (r, c) in visited:
            return
        visited.add((r, c))
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            self.dfs(grid, visited, r + dr, c + dc)

    def numIslands(self, grid):
        visited = set()
        count = 0
        for r in range(len(grid)):
            for c in range(len(grid[0])):
                if grid[r][c] == "1" and (r, c) not in visited:
                    self.dfs(grid, visited, r, c)
                    count += 1
        return count`;
    expect(detectPythonEntryTarget(code)).toEqual({ fnName: "numIslands", className: "Solution" });
  });

  it("ignores a nested def in favour of the function that holds it", () => {
    const code = `def solve(nums):
    def go(i):
        return go(i + 1)
    return go(0)`;
    expect(detectPythonEntryTarget(code)).toEqual({ fnName: "solve", className: null });
  });
});

describe("detectFunctionName with a helper written first", () => {
  it("chooses the function nothing else calls", () => {
    const code = `function dfs(grid, r, c) {
  dfs(grid, r + 1, c);
}
function numIslands(grid) {
  dfs(grid, 0, 0);
  return 1;
}`;
    expect(detectFunctionName(code)).toBe("numIslands");
  });

  it("still finds a lone arrow function", () => {
    expect(detectFunctionName("const twoSum = (nums, target) => {\n  return [];\n};")).toBe("twoSum");
  });
});
