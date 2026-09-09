import { describe, expect, it } from "vitest";
import { analyzeLocally } from "./analyzeLocally";
import type { AnalyzeError, AnalyzeResult } from "./analyzeLocally";

/** Node has no Pyodide, so Python here exercises the labelled fallback. */
const OFFLINE = {} as const;

function expectSuccess(result: AnalyzeResult | AnalyzeError): AnalyzeResult {
  if ("error" in result) {
    throw new Error(`expected a scenario, got error: ${result.error}`);
  }
  return result;
}

const SAMPLES = [
  {
    lang: "python",
    name: "two sum",
    code: `def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
# Example: twoSum([2, 7, 11, 15], 9)`,
  },
  {
    lang: "java",
    name: "bubble sort",
    code: `void bubbleSort(int[] arr) {
    for (int i = 0; i < arr.length - 1; i++)
        for (int j = 0; j < arr.length - i - 1; j++)
            if (arr[j] > arr[j + 1]) { int t = arr[j]; arr[j] = arr[j+1]; arr[j+1] = t; }
}
// Example: bubbleSort([64, 34, 25, 12, 22, 11, 90])`,
  },
  {
    lang: "cpp",
    name: "binary search",
    code: `int binarySearch(vector<int>& nums, int target) {
    int left = 0, right = nums.size() - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] == target) return mid;
        if (nums[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}
// Example: binarySearch([1, 3, 5, 7, 9, 11], 7)`,
  },
];

describe("analyzeLocally", () => {
  it.each(SAMPLES)("produces a timeline for $lang $name", async ({ lang, code }) => {
    const result = expectSuccess(await analyzeLocally(code, lang, OFFLINE));
    expect(result.scenario.timeline.length).toBeGreaterThan(0);
    expect(result.traceSteps).toBe(result.scenario.timeline.length);
    expect(result.scenario.primaryMode).toBeTruthy();
  });

  it("rejects empty input", async () => {
    const result = await analyzeLocally("   ", "javascript", OFFLINE);
    expect(result).toHaveProperty("error");
  });

  it("traces JavaScript through live instrumentation", async () => {
    const code = `function reverseList(head) {
  let prev = null;
  let current = head;
  while (current !== null) {
    const next = current.next;
    current.next = prev;
    prev = current;
    current = next;
  }
  return prev;
}
// Example: reverseList({ value: 1, next: { value: 2, next: { value: 3, next: null } } })`;
    const result = expectSuccess(await analyzeLocally(code, "javascript", OFFLINE));
    expect(result.scenario.timeline.length).toBeGreaterThan(0);
  });

  it("always returns a visualization rather than failing on unknown code", async () => {
    const code = `function mystery(a, b) {
  let acc = 0;
  for (let i = 0; i < a; i++) {
    acc = acc + b;
  }
  return acc;
}
// Example: mystery(3, 4)`;
    const result = expectSuccess(await analyzeLocally(code, "javascript", OFFLINE));
    expect(result.scenario.timeline.length).toBeGreaterThan(0);
  });

  // Ported from the former scripts/test-fallback.ts, which printed results
  // rather than asserting on them.
  it.each([
    { label: "unknown algorithm", code: "def mystery(x):\n    y = x + 1\n    return y" },
    { label: "no recognisable pattern", code: "def notTwoSum(a, b):\n    for i in range(len(a)):\n        print(a[i])\n    return 0" },
    { label: "bare loop", code: "for i in range(5): pass" },
  ])("falls back to a generic visualization for $label", async ({ code }) => {
    const result = expectSuccess(await analyzeLocally(code, "python", OFFLINE));
    expect(result.scenario.timeline.length).toBeGreaterThan(0);
  });

  describe("narrates the code that was actually written", () => {
    const BRUTE_FORCE = `function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) {
        return [i, j];
      }
    }
  }
  return [];
}
// Example: twoSum([3, 2, 4], 6)`;

    const OPTIMAL = `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement), i];
    }
    seen.set(nums[i], i);
  }
  return [];
}
// Example: twoSum([2, 7, 11, 15], 9)`;

    const messagesOf = (r: AnalyzeResult) =>
      r.scenario.timeline.map((f) => f.message).join("\n");

    it("does not describe a brute-force solution with hash-map prose", async () => {
      // Regression: the pattern tracer ran first, so nested loops with no map
      // anywhere were narrated as "Store map[2]=0" / "need complement=7".
      const result = expectSuccess(await analyzeLocally(BRUTE_FORCE, "javascript", OFFLINE));
      const text = messagesOf(result);

      expect(result.source).toBe("trace");
      expect(text).not.toMatch(/complement/i);
      expect(text).not.toMatch(/\bmap\b/i);
      expect(text).not.toMatch(/\bhash\b/i);
    });

    it("tells a different story for a brute-force and an optimal solution", async () => {
      const brute = expectSuccess(await analyzeLocally(BRUTE_FORCE, "javascript", OFFLINE));
      const optimal = expectSuccess(await analyzeLocally(OPTIMAL, "javascript", OFFLINE));
      expect(messagesOf(brute)).not.toEqual(messagesOf(optimal));
      // The optimal one genuinely uses a map, so saying so is accurate.
      expect(messagesOf(optimal)).toMatch(/seen/);
    });

    it("quotes the author's own variable names and real values", async () => {
      const code = `function countVowels(word) {
  let tally = 0;
  for (const ch of word) {
    if ("aeiou".includes(ch)) {
      tally++;
    }
  }
  return tally;
}
// Example: countVowels("hello")`;
      const result = expectSuccess(await analyzeLocally(code, "javascript", OFFLINE));
      const text = messagesOf(result);

      expect(text).toMatch(/tally/);
      expect(text).toMatch(/ch = "e"/);
      expect(text).toMatch(/Return tally {2}→ {2}2/);
    });

    it("reports the value a return statement actually produced", async () => {
      const result = expectSuccess(await analyzeLocally(BRUTE_FORCE, "javascript", OFFLINE));
      expect(messagesOf(result)).toMatch(/Return \[i, j\] {2}→ {2}\[1, 2\]/);
    });

    it("anchors every frame to a line of the source", async () => {
      const result = expectSuccess(await analyzeLocally(BRUTE_FORCE, "javascript", OFFLINE));
      const lineCount = BRUTE_FORCE.split("\n").length;
      for (const frame of result.scenario.timeline) {
        expect(frame.sourceLine).toBeGreaterThan(0);
        expect(frame.sourceLine).toBeLessThanOrEqual(lineCount);
      }
    });

    it("offers the textbook approach as a hint rather than as the trace", async () => {
      const result = expectSuccess(await analyzeLocally(BRUTE_FORCE, "javascript", OFFLINE));
      expect(result.patternHint?.title).toBe("Two Sum");
      expect(result.patternHint?.commonApproach).toMatch(/hash map/i);
      expect(result.patternHint?.yours).toBe("your solution nests 2 loops");
      // The hint must not have leaked into the narration.
      expect(messagesOf(result)).not.toMatch(/hash map/i);
    });

    it("labels a canonical walkthrough when the code cannot be executed", async () => {
      const python = SAMPLES[0];
      const result = expectSuccess(await analyzeLocally(python.code, python.lang, OFFLINE));
      expect(result.source).not.toBe("trace");
      expect(result.warning).toMatch(/not a trace of your code/i);
    });
  });

  it("does not hang on code containing an infinite loop", async () => {
    const code = `function spin(n) {
  let count = n;
  while (true) {
  }
  return count;
}
// Example: spin(1)`;
    const started = Date.now();
    const result = await analyzeLocally(code, "javascript", OFFLINE);
    expect(Date.now() - started).toBeLessThan(10000);
    expect(result).toBeDefined();
  });
});

describe("analyzeLocally names the approaches it recognises", () => {
  it("labels a BFS with a visited set as both and draws the queue", async () => {
    const code = `function reach(graph, start) {
  const visited = new Set([start]);
  const order = [];
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);
    for (const next of graph[node]) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return order;
}
// Example: reach({ a: ["b", "c"], b: ["d"], c: [], d: [] }, "a")`;
    const result = expectSuccess(await analyzeLocally(code, "javascript"));
    expect(result.source).toBe("trace");
    expect(result.techniques).toEqual(["bfs", "graph", "hash_set"]);
    const last = result.scenario.timeline[result.scenario.timeline.length - 1];
    expect(last.technique).toBe("bfs");
    expect(last.techniques).toEqual(["bfs", "graph", "hash_set"]);
    expect(last.structures.containerData?.name).toBe("queue");
  });

  it("spells a string out as cells so pointers over it have somewhere to stand", async () => {
    const code = `function isPal(s) {
  let left = 0;
  let right = s.length - 1;
  while (left < right) {
    if (s[left] !== s[right]) return false;
    left++;
    right--;
  }
  return true;
}
// Example: isPal("racecar")`;
    const result = expectSuccess(await analyzeLocally(code, "javascript"));
    expect(result.techniques?.[0]).toBe("two_pointer");
    const drawn = result.scenario.timeline.find((f) => f.structures.arrayData.length > 0);
    expect(drawn?.structures.arrayData).toEqual([..."racecar"]);
  });
});

describe("analyzeLocally draws a recursion as its call tree", () => {
  it("leads with the tree of calls for a self-calling function", async () => {
    const code = `function fib(n) {
  if (n < 2) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}
// Example: fib(4)`;
    const result = expectSuccess(await analyzeLocally(code, "javascript"));
    expect(result.techniques?.[0]).toBe("recursion");
    const last = result.scenario.timeline[result.scenario.timeline.length - 1];
    expect(last.mode).toBe("TREE");
    expect(last.structures.treeData.length).toBeGreaterThan(5);
    expect(last.structures.treeData[0].value).toBe("fib(4)");
    expect(last.structures.treeData[0].note).toBe("→ 3");
  });
});
