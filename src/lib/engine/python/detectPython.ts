import type { TraceStep } from "../runSandbox";

/**
 * Pure helpers for the Python tracing tier — no Pyodide, no browser globals —
 * so they can be unit-tested in Node and imported anywhere without pulling in
 * the ~10 MB WebAssembly runtime.
 */

/** True for the languages we execute with the in-browser CPython (Pyodide). */
export function isPythonLike(language?: string): boolean {
  if (!language) return false;
  return ["python", "py"].includes(language.toLowerCase());
}

/**
 * First `def`-defined function name, which is the entry point we call. Mirrors
 * `detectFunctionName` for JavaScript, but for Python's `def name(...)` form.
 */
export function detectPythonFunctionName(code: string): string | null {
  const m = code.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(/m);
  return m?.[1] ?? null;
}

/** The function to call, plus the class to instantiate first (if it is a method). */
export interface PythonEntryTarget {
  fnName: string;
  /** Non-null when `fnName` is a bound method and needs `Class().fn(...)`. */
  className: string | null;
}

/**
 * Locate the entry point, accounting for the `class Solution:` wrapper that
 * LeetCode and NeetCode hand people. A bare `islandsAndTreasure()` call against
 * that shape raises NameError — the method is an attribute of the class, never
 * a module-level name — so the class has to be carried along and instantiated.
 */
export function detectPythonEntryTarget(code: string): PythonEntryTarget | null {
  let currentClass: { name: string; indent: number } | null = null;

  for (const rawLine of code.split("\n")) {
    const line = rawLine.replace(/\t/g, "    ");
    const body = line.trim();
    if (!body || body.startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;

    const cls = body.match(/^class\s+([A-Za-z_]\w*)/);
    if (cls) {
      currentClass = { name: cls[1], indent };
      continue;
    }

    // Anything back at or left of the class header has closed the class body.
    if (currentClass && indent <= currentClass.indent) currentClass = null;

    const def = body.match(/^def\s+([A-Za-z_]\w*)\s*\(([^)]*)/);
    if (def) {
      const [, fnName, params] = def;
      if (fnName.startsWith("__")) continue; // __init__ and friends are not entry points
      // Only a bound method needs an instance; a @staticmethod does not.
      const takesSelf = /^self\b/.test(params.trim());
      return { fnName, className: currentClass && takesSelf ? currentClass.name : null };
    }
  }

  return null;
}

/**
 * True when brackets and quotes close cleanly, so the text can be dropped
 * straight into a call without producing a SyntaxError.
 */
function isBalancedArgs(text: string): boolean {
  const closers: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  let quote: string | null = null;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (closers[ch] && stack.pop() !== closers[ch]) return false;
  }

  return stack.length === 0 && quote === null;
}

/**
 * Build the call that drives the trace.
 *
 * The pasted test case is used as the argument text verbatim, because every
 * shape the field accepts is already valid Python argument syntax: `[[1,2],[3]]`
 * is one positional grid, `[1,2,3], 5` is two positionals, and `nums=[1], k=2`
 * is a pair of keywords. Reshaping it through the pattern-matching input parser
 * would flatten a 2-D grid into a list of numbers and trace the wrong thing.
 */
export function buildPythonEntryCall(
  code: string,
  target: PythonEntryTarget,
  testCase?: string
): string {
  // An explicit "# Example:" line is the author stating the call outright.
  const example = code.match(/#\s*(?:Example|Test|Call):\s*(.+)/i);
  if (example?.[1]?.trim()) return example[1].trim().replace(/;?\s*$/, "");

  const pasted = testCase?.trim() ?? "";
  const args = pasted && isBalancedArgs(pasted) ? pasted : "";
  const receiver = target.className ? `${target.className}().` : "";
  return `${receiver}${target.fnName}(${args})`;
}

/** One recorded Python line event, as produced by the settrace harness. */
export interface PythonStep {
  line: number;
  vars: Record<string, unknown>;
  /** Identifies the call this line belongs to; steps pair only within one. */
  frame?: number;
  /** Present only on the frame's `return` event. */
  returnValue?: unknown;
}

/** What the harness serialises back to JS as a JSON string. */
export interface PythonTracePayload {
  steps: PythonStep[];
  halted: boolean;
  error: string | null;
}

/**
 * Map raw Python line events onto the same `TraceStep[]` the JS sandbox emits,
 * so a single `narrateTrace` describes both languages. `kind` is derived from
 * the quoted source line: a line that starts with `return` carries the value
 * the frame actually returned; everything else is a plain mutation.
 */
const PY_BRANCH_RE = /^(?:el)?if\s+(.+?)\s*:\s*(?:#.*)?$/;
const PY_WHILE_RE = /^while\s+(.+?)\s*:\s*(?:#.*)?$/;
const PY_FOR_RE = /^for\s+.+?\s+in\s+.+?\s*:\s*(?:#.*)?$/;

function indentOf(line: string): number {
  const expanded = line.replace(/\t/g, "    ");
  return expanded.length - expanded.trimStart().length;
}

/**
 * The 1-based line span of the block a compound statement introduces — every
 * following line indented past the header, blank lines included, since a blank
 * line does not close a suite.
 */
function blockRange(lines: string[], headerLine: number): { start: number; end: number } {
  const headerIndent = indentOf(lines[headerLine - 1] ?? "");
  let end = headerLine;
  for (let i = headerLine; i < lines.length; i += 1) {
    const text = lines[i];
    if (!text.trim()) continue; // blank line: keep looking
    if (indentOf(text) > headerIndent) end = i + 1;
    else break;
  }
  return { start: headerLine + 1, end };
}

/**
 * Map raw Python line events onto the same `TraceStep[]` the JS sandbox emits,
 * so a single `narrateTrace` describes both languages.
 *
 * `sys.settrace` reports which lines ran, never why, so an `if` arrives looking
 * like any other statement. The verdict is recovered from where control went
 * next: Python delimits a suite by indentation, so a step landing inside the
 * header's block means the branch was taken, and one landing outside means it
 * was not. That keeps the narration honest — the outcome is read back from the
 * execution rather than guessed from the condition's text.
 */
export function pythonStepsToTraceHistory(
  steps: PythonStep[],
  sourceCode: string
): TraceStep[] {
  const lines = sourceCode.split("\n");

  return steps.map((s, index) => {
    const src = (lines[s.line - 1] ?? "").trim();

    // A line event fires *before* its line runs, so `s.vars` is the state
    // entering the line — reporting it would credit each line with the previous
    // one's work: `grid[r][c] = grid[..] + 1` would print the cell's old value
    // and an append would show the queue as it was before the push. The state
    // after the line is what the next record in the same call holds.
    const follower = steps[index + 1];
    const sameCall = follower !== undefined && follower.frame === s.frame;
    const step: TraceStep = {
      line: s.line,
      vars: sameCall ? follower.vars : s.vars,
      kind: "mutation",
    };

    if (/^return\b/.test(src)) {
      step.kind = "return";
      // The return expression is evaluated on this line, so its operands are
      // the values entering it, not the successor's.
      step.vars = s.vars;
      if ("returnValue" in s) step.returnValue = s.returnValue;
      return step;
    }

    const branch = src.match(PY_BRANCH_RE);
    const whileLoop = src.match(PY_WHILE_RE);
    const isFor = PY_FOR_RE.test(src);
    if (!branch && !whileLoop && !isFor) return step;

    step.kind = branch ? "condition" : "loop";
    const label = branch?.[1] ?? whileLoop?.[1];
    if (label) {
      step.condLabel = label;
      // A test assigns nothing, so its operands are the values entering the
      // line. A `for` header is the exception: it binds the loop variable, and
      // the successor's state is where that new binding shows up.
      step.vars = s.vars;
    }

    // Without a successor in the same call there is nothing to read the outcome
    // from — a truncated run, or a call made inside the test itself. Leave the
    // verdict unset rather than infer one the execution never showed.
    if (sameCall) {
      const { start, end } = blockRange(lines, s.line);
      step.condResult = follower.line >= start && follower.line <= end;
    }

    return step;
  });
}
