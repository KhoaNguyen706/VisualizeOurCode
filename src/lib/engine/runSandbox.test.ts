import { describe, expect, it } from "vitest";
import { instrumentCode } from "./instrumentCode";
import {
  LOOP_LIMIT_MARKER,
  STEP_LIMIT_MARKER,
  TIMEOUT_MARKER,
  detectFunctionName,
  extractEntryCall,
  runSandbox,
} from "./runSandbox";

function trace(source: string, entryCall: string, options = {}) {
  return runSandbox(instrumentCode(source).code, entryCall, options);
}

const TWO_SUM = `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement), i];
    }
    seen.set(nums[i], i);
  }
  return [];
}`;

describe("runSandbox", () => {
  it("records a trace and returns the function's value", () => {
    const result = trace(TWO_SUM, "twoSum([2, 7, 11, 15], 9)");
    expect(result.error).toBeUndefined();
    expect(result.returnValue).toEqual([0, 1]);
    expect(result.traceHistory.length).toBeGreaterThan(0);
  });

  it("reports execution errors instead of throwing", () => {
    const result = runSandbox("function f() { return missingVariable; }", "f()");
    expect(result.error).toBeDefined();
    expect(result.halted).toBeUndefined();
    expect(result.returnValue).toBeUndefined();
  });
});

describe("execution budgets", () => {
  it("halts a loop that records too many steps", () => {
    const source = `function count() {
  let total = 0;
  for (let i = 0; i < 100000; i++) {
    total = total + i;
  }
  return total;
}`;
    const result = trace(source, "count()", { maxSteps: 25 });
    expect(result.error).toContain(STEP_LIMIT_MARKER);
    expect(result.halted).toBe(true);
    expect(result.traceHistory).toHaveLength(25);
  });

  it("halts an infinite loop whose body records no steps", () => {
    // The step budget cannot catch this: __trace__ is never called inside the
    // loop, so only the injected __guard__ can stop it.
    const source = `function spin() {
  while (true) {
  }
  return 1;
}`;
    const result = trace(source, "spin()", { maxLoopIterations: 5000 });
    expect(result.error).toContain(LOOP_LIMIT_MARKER);
    expect(result.halted).toBe(true);
  });

  it("halts on the wall-clock budget", () => {
    const source = `function spin() {
  while (true) {
  }
  return 1;
}`;
    const started = Date.now();
    const result = trace(source, "spin()", {
      timeoutMs: 50,
      maxLoopIterations: Number.MAX_SAFE_INTEGER,
    });
    const elapsed = Date.now() - started;

    expect(result.error).toContain(TIMEOUT_MARKER);
    expect(result.halted).toBe(true);
    expect(elapsed).toBeLessThan(5000);
  });

  it("lets a normal run finish well inside the budgets", () => {
    const result = trace(TWO_SUM, "twoSum([2, 7, 11, 15], 9)");
    expect(result.halted).toBeUndefined();
  });
});

describe("value snapshots", () => {
  it("captures Map contents rather than an empty object", () => {
    const result = trace(TWO_SUM, "twoSum([2, 7, 11, 15], 9)");
    const populated = result.traceHistory.filter(
      (step) => Object.keys((step.vars.seen ?? {}) as object).length > 0
    );
    expect(populated.length).toBeGreaterThan(0);
    expect(populated[0].vars.seen).toEqual({ "2": 0 });
  });

  it("captures Set contents as an array", () => {
    const source = `function collect(items) {
  const seen = new Set();
  seen.add(items[0]);
  return seen;
}`;
    const result = trace(source, "collect([7])");
    const last = result.traceHistory.at(-1);
    expect(last?.vars.seen).toEqual([7]);
  });

  it("snapshots each step independently of later mutations", () => {
    const source = `function build() {
  const out = [];
  out.push(1);
  out.push(2);
  return out;
}`;
    const result = trace(source, "build()");
    const arrays = result.traceHistory.map((step) => step.vars.out);
    expect(arrays).toContainEqual([1]);
    expect(arrays).toContainEqual([1, 2]);
  });

  it("survives circular references without hanging", () => {
    const source = `function walk(node) {
  let cur = node.next;
  return cur;
}`;
    const result = trace(
      source,
      "walk((() => { const a = { v: 1 }; a.next = a; return a; })())"
    );
    expect(result.error).toBeUndefined();
    expect(JSON.stringify(result.traceHistory)).toContain("[Circular]");
  });
});

describe("entry point detection", () => {
  it("detects function declarations and arrow assignments", () => {
    expect(detectFunctionName("function twoSum(a) {}")).toBe("twoSum");
    expect(detectFunctionName("const solve = (a) => a;")).toBe("solve");
  });

  it("returns null when there is no function", () => {
    expect(detectFunctionName("const x = 1;")).toBeNull();
  });

  it("prefers an explicit Example comment", () => {
    expect(extractEntryCall("// Example: twoSum([1,2], 3)", "twoSum")).toBe("twoSum([1,2], 3)");
    expect(extractEntryCall("# Example: twoSum([1,2], 3)", "twoSum")).toBe("twoSum([1,2], 3)");
  });

  it("falls back to a known default call", () => {
    expect(extractEntryCall("function twoSum(nums, target) {}", "twoSum")).toBe(
      "twoSum([2, 7, 11, 15], 9)"
    );
  });
});
