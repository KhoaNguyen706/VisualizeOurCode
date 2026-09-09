import type { TraceKind } from "./instrumentCode";

export interface TraceStep {
  line: number;
  vars: Record<string, unknown>;
  ts?: number;
  /** Why this step was recorded — drives narration. */
  kind?: TraceKind;
  /** For `loop`/`condition` steps: how the condition evaluated. */
  condResult?: boolean;
  /** For `loop`/`condition` steps: the condition's source text. */
  condLabel?: string;
  /** For `return` steps: the value the expression actually evaluated to. */
  returnValue?: unknown;
  /** The call this step ran in; steps sharing an id share one frame. */
  callId?: number;
  /** The call that made this one — its parent in the call tree. */
  parentCallId?: number;
  /** The function the step ran in. */
  fnName?: string;
  /** The arguments the call was entered with, by parameter name. */
  args?: Record<string, unknown>;
  /** Nesting depth of the call; the entry call is 1. */
  depth?: number;
}

export interface SandboxResult {
  traceHistory: TraceStep[];
  returnValue: unknown;
  error?: string;
  /** True when execution was cut short by the step, loop, or wall-clock budget. */
  halted?: boolean;
}

export interface SandboxOptions {
  /** Max number of __trace__ calls recorded before execution is halted. */
  maxSteps?: number;
  /** Wall-clock budget for the whole run. */
  timeoutMs?: number;
  /** Max number of guarded loop iterations across the whole run. */
  maxLoopIterations?: number;
}

export const HALT_PREFIX = "SandboxHalted";
export const STEP_LIMIT_MARKER = `${HALT_PREFIX}: step limit`;
export const LOOP_LIMIT_MARKER = `${HALT_PREFIX}: loop limit`;
export const TIMEOUT_MARKER = `${HALT_PREFIX}: timeout`;

const DEFAULT_MAX_STEPS = 500;
const DEFAULT_TIMEOUT_MS = 1000;
const DEFAULT_MAX_LOOP_ITERATIONS = 1_000_000;

/** Reading the clock on every loop iteration is itself expensive; sample instead. */
const CLOCK_CHECK_INTERVAL = 1024;

const MAX_SNAPSHOT_DEPTH = 6;
const MAX_SNAPSHOT_ITEMS = 100;

const DEFAULT_ENTRY_CALLS: Record<string, string> = {
  twoSum: "twoSum([2, 7, 11, 15], 9)",
  twosum: "twoSum([2, 7, 11, 15], 9)",
  reverseList: "reverseList({ value: 1, next: { value: 2, next: { value: 3, next: null } } })",
  reverselist: "reverseList({ value: 1, next: { value: 2, next: { value: 3, next: null } } })",
  combinationSum: "combinationSum([2, 3, 6, 7], 7)",
  combinationsum: "combinationSum([2, 3, 6, 7], 7)",
  bubbleSort: "bubbleSort([64, 34, 25, 12, 22, 11, 90])",
  bubblesort: "bubbleSort([64, 34, 25, 12, 22, 11, 90])",
};

/**
 * Deep-copy a traced value so later mutations don't retroactively change
 * earlier frames. Unlike a JSON round-trip this preserves Map/Set contents and
 * survives the cyclic structures that show up in linked-list problems.
 */
function snapshotValue(value: unknown, seen: Set<object>, depth: number): unknown {
  if (value === null || value === undefined) return value;

  const type = typeof value;
  if (type === "function") return undefined;
  if (type !== "object") {
    return type === "bigint" ? String(value) : value;
  }

  const obj = value as object;
  if (seen.has(obj)) return "[Circular]";
  if (depth >= MAX_SNAPSHOT_DEPTH) return "[Depth limit]";

  seen.add(obj);
  try {
    if (value instanceof Map) {
      const out: Record<string, unknown> = {};
      let n = 0;
      for (const [k, v] of value) {
        if (n++ >= MAX_SNAPSHOT_ITEMS) break;
        out[String(k)] = snapshotValue(v, seen, depth + 1);
      }
      return out;
    }

    if (value instanceof Set) {
      const out: unknown[] = [];
      let n = 0;
      for (const v of value) {
        if (n++ >= MAX_SNAPSHOT_ITEMS) break;
        out.push(snapshotValue(v, seen, depth + 1));
      }
      return out;
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, MAX_SNAPSHOT_ITEMS)
        .map((v) => snapshotValue(v, seen, depth + 1));
    }

    const out: Record<string, unknown> = {};
    let n = 0;
    for (const [k, v] of Object.entries(value)) {
      if (n++ >= MAX_SNAPSHOT_ITEMS) break;
      out[k] = snapshotValue(v, seen, depth + 1);
    }
    return out;
  } finally {
    seen.delete(obj);
  }
}

function cloneSnapshot(vars: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const seen = new Set<object>();
  for (const [k, v] of Object.entries(vars)) {
    try {
      out[k] = snapshotValue(v, seen, 0);
    } catch {
      out[k] = undefined;
    }
  }
  return out;
}

export function detectFunctionName(code: string): string | null {
  const patterns = [
    /function\s+(\w+)\s*\(/,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?function/,
    /(?:const|let|var)\s+(\w+)\s*=\s*\(/,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
  ];
  for (const re of patterns) {
    const m = code.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function extractEntryCall(
  code: string,
  fnName?: string | null,
  testCase?: string
): string | null {
  const commentPatterns = [
    /#\s*(?:Example|Test|Call):\s*(.+)/i,
    /\/\/\s*(?:Example|Test|Call):\s*(.+)/i,
    /\/\*\s*(?:Example|Test|Call):\s*([^*]+)\*\//i,
  ];

  for (const re of commentPatterns) {
    const m = code.match(re);
    if (m?.[1]) {
      const call = m[1].trim().replace(/;?\s*$/, "");
      if (call.length > 0) return call;
    }
  }

  // A pasted test case is the reader stating the arguments directly, so it
  // outranks anything guessed from the source: "[[1,2],[3]]" is one grid,
  // "[1,2,3], 5" two positionals. Named forms like "nums=[1]" are left to the
  // patterns below, since JavaScript has no keyword arguments.
  const pasted = testCase?.trim();
  if (fnName && pasted && !/^\s*\w+\s*=[^=]/.test(pasted)) {
    return `${fnName}(${pasted})`;
  }

  const inlineExample = code.match(/(?:nums|arr)\s*=\s*\[[^\]]+\].*target\s*=\s*\d+/i);
  if (fnName && inlineExample) {
    const numsMatch = code.match(/\[([^\]]+)\]/);
    const targetMatch = code.match(/target\s*=\s*(\d+)/i);
    if (numsMatch && targetMatch) {
      return `${fnName}([${numsMatch[1]}], ${targetMatch[1]})`;
    }
  }

  if (fnName) {
    const key = fnName.toLowerCase();
    if (DEFAULT_ENTRY_CALLS[key]) return DEFAULT_ENTRY_CALLS[key];
    if (DEFAULT_ENTRY_CALLS[fnName]) return DEFAULT_ENTRY_CALLS[fnName];
  }

  return fnName ? `${fnName}()` : null;
}

export function isHaltSignal(message: string | undefined): boolean {
  return typeof message === "string" && message.startsWith(HALT_PREFIX);
}

/**
 * Execute instrumented code and collect its trace.
 *
 * Three independent budgets bound the run: recorded steps, guarded loop
 * iterations, and wall-clock time. The loop budget matters most — a loop with
 * no traced assignment in its body never calls __trace__, so the step budget
 * alone cannot stop `while (true) {}`. `instrumentCode` injects `__guard__()`
 * into loop conditions so those iterations are counted here.
 *
 * Known limit: unbounded *recursion* is not covered by these budgets. It
 * terminates on its own via the engine's native stack overflow, which surfaces
 * as an ordinary execution error.
 */
export function runSandbox(
  instrumentedCode: string,
  entryCall: string,
  options: SandboxOptions = {}
): SandboxResult {
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxLoopIterations = options.maxLoopIterations ?? DEFAULT_MAX_LOOP_ITERATIONS;

  const traceHistory: TraceStep[] = [];
  const startedAt = Date.now();
  let stepCount = 0;
  let loopCount = 0;

  const expired = () => Date.now() - startedAt > timeoutMs;

  const record = (step: TraceStep) => {
    if (++stepCount > maxSteps) {
      throw new Error(`${STEP_LIMIT_MARKER}: exceeded ${maxSteps} trace steps`);
    }
    if (expired()) {
      throw new Error(`${TIMEOUT_MARKER}: exceeded ${timeoutMs}ms`);
    }
    traceHistory.push(step);
  };

  /**
   * The calls currently open, innermost last. `instrumentCode` wraps every
   * named function body in `__enter__` / `__exit__`, so each recorded step
   * can say which call it ran in — which is what lets a recursion be drawn as
   * the tree of calls it actually made.
   */
  interface ActiveCall {
    id: number;
    parent?: number;
    fn: string;
    args: Record<string, unknown>;
    depth: number;
  }
  const callStack: ActiveCall[] = [];
  let callSeq = 0;

  const callFields = (): Pick<TraceStep, "callId" | "parentCallId" | "fnName" | "args" | "depth"> => {
    const top = callStack[callStack.length - 1];
    if (!top) return {};
    return { callId: top.id, parentCallId: top.parent, fnName: top.fn, args: top.args, depth: top.depth };
  };

  const enterFn = (name: string, args: Record<string, unknown>) => {
    const parent = callStack[callStack.length - 1];
    callStack.push({
      id: ++callSeq,
      parent: parent?.id,
      fn: name,
      args: cloneSnapshot(args),
      depth: callStack.length + 1,
    });
  };

  const exitFn = () => {
    callStack.pop();
  };

  const traceFn = (line: number, vars: Record<string, unknown>, kind?: TraceKind) => {
    record({ line, vars: cloneSnapshot(vars), ts: Date.now(), kind, ...callFields() });
  };

  /**
   * Records a condition evaluation and hands back the value untouched, so
   * wrapping a condition never alters control flow.
   */
  const condFn = <T>(
    line: number,
    vars: Record<string, unknown>,
    value: T,
    label: string,
    kind: TraceKind
  ): T => {
    record({
      line,
      vars: cloneSnapshot(vars),
      ts: Date.now(),
      kind,
      condResult: Boolean(value),
      condLabel: label,
      ...callFields(),
    });
    return value;
  };

  /**
   * Attach a returned value to the `return` step recorded just before it.
   * Deliberately does not consume step budget — it annotates an existing step
   * rather than adding one.
   */
  const retFn = <T>(value: T): T => {
    // The value belongs on this call's own return step. The most recent step
    // overall may be a callee's — `return fib(n - 1) + fib(n - 2)` records
    // the parent's return line, then every child step, then reaches here —
    // and stamping it there credited the child with its parent's result.
    const top = callStack[callStack.length - 1];
    for (let i = traceHistory.length - 1; i >= 0; i -= 1) {
      const step = traceHistory[i];
      if (step.kind !== "return") continue;
      if (top && step.callId !== top.id) continue;
      try {
        step.returnValue = snapshotValue(value, new Set(), 0);
      } catch {
        /* leave the step unannotated rather than failing the run */
      }
      break;
    }
    return value;
  };

  const guardFn = () => {
    if (++loopCount > maxLoopIterations) {
      throw new Error(`${LOOP_LIMIT_MARKER}: exceeded ${maxLoopIterations} iterations`);
    }
    if (loopCount % CLOCK_CHECK_INTERVAL === 0 && expired()) {
      throw new Error(`${TIMEOUT_MARKER}: exceeded ${timeoutMs}ms`);
    }
    return true;
  };

  const preamble = `
    function __trace__(line, vars, kind) { return __sandboxTrace__(line, vars, kind); }
    function __guard__() { return __sandboxGuard__(); }
    function __cond__(line, vars, value, label, kind) {
      return __sandboxCond__(line, vars, value, label, kind);
    }
    function __ret__(value) { return __sandboxRet__(value); }
    function __enter__(name, args) { return __sandboxEnter__(name, args); }
    function __exit__() { return __sandboxExit__(); }
  `;

  try {
    const fn = new Function(
      "__sandboxTrace__",
      "__sandboxGuard__",
      "__sandboxCond__",
      "__sandboxRet__",
      "__sandboxEnter__",
      "__sandboxExit__",
      `"use strict";\n${preamble}\n${instrumentedCode}\nreturn ${entryCall};`
    ) as (
      trace: typeof traceFn,
      guard: typeof guardFn,
      cond: typeof condFn,
      ret: typeof retFn,
      enter: typeof enterFn,
      exit: typeof exitFn
    ) => unknown;

    const returnValue = fn(traceFn, guardFn, condFn, retFn, enterFn, exitFn);

    return { traceHistory, returnValue };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      traceHistory,
      returnValue: undefined,
      error: message,
      halted: isHaltSignal(message) || undefined,
    };
  }
}
