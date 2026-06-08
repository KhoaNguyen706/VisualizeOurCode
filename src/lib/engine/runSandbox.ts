export interface TraceStep {
  line: number;
  vars: Record<string, unknown>;
  ts?: number;
}

export interface SandboxResult {
  traceHistory: TraceStep[];
  returnValue: unknown;
  error?: string;
}

export interface SandboxOptions {
  maxSteps?: number;
  timeoutMs?: number;
}

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

function cloneSnapshot(vars: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(vars));
  } catch {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(vars)) {
      out[k] = v;
    }
    return out;
  }
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

export function extractEntryCall(code: string, fnName?: string | null): string | null {
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

export function runSandbox(
  instrumentedCode: string,
  entryCall: string,
  options: SandboxOptions = {}
): SandboxResult {
  const maxSteps = options.maxSteps ?? 500;
  const traceHistory: TraceStep[] = [];
  let stepCount = 0;

  const traceFn = (line: number, vars: Record<string, unknown>) => {
    stepCount++;
    if (stepCount > maxSteps) {
      throw new Error(`StepLimitExceeded: exceeded ${maxSteps} trace steps`);
    }
    traceHistory.push({
      line,
      vars: cloneSnapshot(vars),
      ts: Date.now(),
    });
  };

  const preamble = `
    const __traceHistory__ = [];
    function __trace__(line, vars) {
      return __sandboxTrace__(line, vars);
    }
  `;

  try {
    const fn = new Function(
      "__sandboxTrace__",
      `${preamble}\n${instrumentedCode}\nreturn ${entryCall};`
    ) as (trace: typeof traceFn) => unknown;

    const returnValue = fn(traceFn);

    return { traceHistory, returnValue };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      traceHistory,
      returnValue: undefined,
      error: message,
    };
  }
}
