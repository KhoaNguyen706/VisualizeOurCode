import { describe, expect, it } from "vitest";
import { collectDeclaredNames, injectLoopGuards, instrumentCode } from "./instrumentCode";

describe("collectDeclaredNames", () => {
  it("discovers function parameters", () => {
    const names = collectDeclaredNames("function twoSum(nums, target) { return []; }");
    expect(names).toContain("nums");
    expect(names).toContain("target");
  });

  it("discovers arbitrarily named locals, not just common ones", () => {
    // Regression: these names are absent from the old hardcoded allowlist.
    const names = collectDeclaredNames(`
      function longestSubstring(text) {
        let windowStart = 0;
        let bestLength = 0;
        const charFrequency = {};
        return bestLength;
      }
    `);
    expect(names).toEqual(expect.arrayContaining(["windowStart", "bestLength", "charFrequency"]));
  });

  it("discovers for...of and destructured bindings", () => {
    const names = collectDeclaredNames(`
      function f(pairs) {
        const [head, tail] = pairs;
        for (const entry of pairs) {}
        return head;
      }
    `);
    expect(names).toEqual(expect.arrayContaining(["head", "tail", "entry"]));
  });

  it("excludes the declared function's own name", () => {
    expect(collectDeclaredNames("function twoSum(nums) { return nums; }")).not.toContain("twoSum");
    expect(collectDeclaredNames("const helper = (a) => a;")).not.toContain("helper");
  });

  it("excludes reserved words and known globals", () => {
    const names = collectDeclaredNames("function f(a) { const b = Math.max(a, 0); return b; }");
    expect(names).not.toContain("Math");
    expect(names).not.toContain("const");
  });

  it("caps the number of tracked variables", () => {
    const decls = Array.from({ length: 60 }, (_, i) => `let v${i} = ${i};`).join("\n");
    expect(collectDeclaredNames(decls).length).toBeLessThanOrEqual(24);
  });
});

describe("injectLoopGuards", () => {
  it("guards a while condition", () => {
    expect(injectLoopGuards("while (left < right) {")).toBe(
      "while (__guard__() && (left < right)) {"
    );
  });

  it("guards a C-style for condition", () => {
    expect(injectLoopGuards("for (let i = 0; i < n; i++) {")).toBe(
      "for (let i = 0; __guard__() && (i < n); i++) {"
    );
  });

  it("guards an empty for condition", () => {
    expect(injectLoopGuards("for (;;) {")).toBe("for (; __guard__() ;) {");
  });

  it("guards the tail of a do/while", () => {
    expect(injectLoopGuards("} while (n > 0);")).toBe("} while (__guard__() && (n > 0));");
  });

  it("leaves for...of and for...in alone", () => {
    expect(injectLoopGuards("for (const x of items) {")).toBe("for (const x of items) {");
    expect(injectLoopGuards("for (const k in obj) {")).toBe("for (const k in obj) {");
  });

  it("ignores loop keywords inside string literals", () => {
    const line = 'const label = "while (x)";';
    expect(injectLoopGuards(line)).toBe(line);
  });

  it("guards multiple loops on one line", () => {
    expect(injectLoopGuards("while (a) { while (b) {} }")).toBe(
      "while (__guard__() && (a)) { while (__guard__() && (b)) {} }"
    );
  });
});

describe("instrumentCode", () => {
  it("injects a trace after a declaration", () => {
    const { code, tracePoints } = instrumentCode("function f() {\n  let sum = 0;\n}");
    expect(code).toMatch(/let sum = 0;\n\s*__trace__\(2,/);
    expect(tracePoints).toContain(2);
  });

  it("injects a trace before a return and captures the returned value", () => {
    const { code } = instrumentCode("function f() {\n  return 42;\n}");
    expect(code).toMatch(/__trace__\(2,[^\n]*\);\n\s*return __ret__\(42\);/);
  });

  it("leaves an incomplete return expression unwrapped", () => {
    // `return {` opens a multi-line object; wrapping it here is a syntax error.
    const { code } = instrumentCode("function f() {\n  return {\n    a: 1\n  };\n}");
    expect(code).not.toContain("__ret__");
    expect(code).toContain("return {");
  });

  it("traces mutating method calls", () => {
    const { code } = instrumentCode("function f(res) {\n  res.push(1);\n}");
    expect(code).toMatch(/res\.push\(1\);\n\s*__trace__\(2,/);
  });

  it("traces indexed writes and increments", () => {
    const withIndex = instrumentCode("function f(arr) {\n  arr[0] = 5;\n}");
    expect(withIndex.tracePoints).toContain(2);

    const withIncrement = instrumentCode("function f() {\n  let count = 0;\n  count++;\n}");
    expect(withIncrement.tracePoints).toContain(3);
  });

  it("does not treat equality comparisons as assignments", () => {
    // `if (a === b)` is worth a step — but as the branch decision it is, not
    // as a write to `a`.
    const { traceKinds } = instrumentCode("function f(a, b) {\n  if (a === b) {}\n}");
    expect(traceKinds).toEqual([{ line: 2, kind: "condition" }]);
  });

  it("records each loop iteration so loop-driven code has a story", () => {
    // Regression: a brute-force nested loop used to trace only its `return`,
    // leaving nothing to visualise and forcing a canned pattern template.
    const { traceKinds } = instrumentCode(
      "function f(nums) {\n  for (let i = 0; i < nums.length; i++) {\n    if (nums[i] === 1) {\n      return i;\n    }\n  }\n  return -1;\n}"
    );
    expect(traceKinds).toEqual([
      { line: 2, kind: "loop" },
      { line: 3, kind: "condition" },
      { line: 4, kind: "return" },
      { line: 7, kind: "return" },
    ]);
  });

  it("traces for...of iterations at the top of the body", () => {
    const { code, traceKinds } = instrumentCode(
      "function f(items) {\n  for (const x of items) {\n    total += x;\n  }\n}"
    );
    expect(traceKinds).toContainEqual({ line: 2, kind: "loop" });
    expect(code).toMatch(/for \(const x of items\) \{\n\s*__trace__\(2,[^\n]*"loop"\);/);
  });

  it("leaves a constant loop condition untraced so the loop budget still governs", () => {
    // `while (true)` records nothing per iteration, so only __guard__ can stop
    // it — tracing "true => true" would let the step budget pre-empt that.
    const { code, traceKinds } = instrumentCode("function f() {\n  while (true) {\n  }\n}");
    expect(traceKinds).toHaveLength(0);
    expect(code).toContain("while (__guard__() && (true))");
  });

  it("wraps a brace-less loop body so the trace stays inside the loop", () => {
    const { code } = instrumentCode(
      "function f(nums) {\n  let total = 0;\n  for (let i = 0; i < nums.length; i++)\n    total += nums[i];\n  return total;\n}"
    );
    const lines = code.split("\n");
    const openIndex = lines.findIndex((l) => l.trim() === "{");
    expect(openIndex).toBeGreaterThan(-1);
    expect(lines[openIndex + 1].trim()).toBe("total += nums[i];");
    expect(lines[openIndex + 2].trim()).toMatch(/^__trace__\(4,/);
    expect(lines[openIndex + 3].trim()).toBe("}");
  });

  it("skips comments and import lines", () => {
    const { tracePoints } = instrumentCode(
      "// let x = 1;\nimport foo from 'bar';\nfunction f() {}"
    );
    expect(tracePoints).toHaveLength(0);
  });

  it("preserves the original line count for untouched lines", () => {
    const src = "function f() {\n  const a = 1;\n}";
    expect(instrumentCode(src).code).toContain("function f() {");
  });
});
