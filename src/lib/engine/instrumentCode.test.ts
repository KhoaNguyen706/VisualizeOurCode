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

  it("injects a trace before a return", () => {
    const { code } = instrumentCode("function f() {\n  return 42;\n}");
    expect(code).toMatch(/__trace__\(2,[^\n]*\);\n\s*return 42;/);
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
    const { tracePoints } = instrumentCode("function f(a, b) {\n  if (a === b) {}\n}");
    expect(tracePoints).not.toContain(2);
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
