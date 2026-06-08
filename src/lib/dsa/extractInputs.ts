import type { DSAInputs } from "./types";

const DEFAULTS: Record<string, DSAInputs> = {
  twoSum: { nums: [2, 7, 11, 15], target: 9 },
  bubbleSort: { arr: [64, 34, 25, 12, 22, 11, 90] },
  combinationSum: { candidates: [2, 3, 6, 7], target: 7 },
  subsets: { nums: [1, 2, 3] },
  binarysearch: { nums: [1, 3, 5, 7, 9, 11], target: 7 },
  binarySearch: { nums: [1, 3, 5, 7, 9, 11], target: 7 },
  reverseList: { listValues: [1, 2, 3, 4, 5] },
  productExceptSelf: { nums: [1, 2, 3, 4] },
  productexceptself: { nums: [1, 2, 3, 4] },
  isSameTree: { nums: [1, 2, 3], arr: [1, 2, 3] },
  issametree: { nums: [1, 2, 3], arr: [1, 2, 3] },
  isValid: {},
  isvalid: {},
  maxSumSubarray: { nums: [2, 1, 5, 1, 3, 2], k: 3 },
  maxsumsubarray: { nums: [2, 1, 5, 1, 3, 2], k: 3 },
  slidingWindow: { nums: [2, 1, 5, 1, 3, 2], target: 8 },
  slidingwindow: { nums: [2, 1, 5, 1, 3, 2], target: 8 },
  hasCycle: { listValues: [3, 2, 0, -4], cycleAt: 1 },
  hascycle: { listValues: [3, 2, 0, -4], cycleAt: 1 },
};

function parseNumberList(raw: string): number[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}

function extractArray(code: string, names: string[]): number[] | undefined {
  for (const name of names) {
    const re = new RegExp(`\\b${name}\\s*=\\s*\\[([^\\]]+)\\]`, "i");
    const m = code.match(re);
    if (m?.[1]) return parseNumberList(m[1]);
  }
  const anyArray = code.match(/\[([\d,\s]+)\]/);
  if (anyArray?.[1]) return parseNumberList(anyArray[1]);
  return undefined;
}

function extractTarget(code: string): number | undefined {
  const m = code.match(/\btarget\s*[=:]\s*(\d+)/i);
  if (m?.[1]) return Number(m[1]);
  return undefined;
}

function extractK(code: string): number | undefined {
  const m = code.match(/\bk\s*[=:]\s*(\d+)/i);
  if (m?.[1]) return Number(m[1]);
  return undefined;
}

function extractExampleCall(code: string): string | null {
  const patterns = [
    /#\s*(?:Example|Test|Call):\s*(.+)/i,
    /\/\/\s*(?:Example|Test|Call):\s*(.+)/i,
    /\/\*\s*(?:Example|Test|Call):\s*([^*]+)\*\//i,
  ];
  for (const re of patterns) {
    const m = code.match(re);
    if (m?.[1]) return m[1].trim().replace(/;?\s*$/, "");
  }
  return null;
}

function parseCallArgs(call: string): unknown[] {
  const argsMatch = call.match(/\(([^)]*)\)/);
  if (!argsMatch?.[1]) return [];
  const args: unknown[] = [];
  const inner = argsMatch[1].trim();
  if (!inner) return [];

  const arrayArg = inner.match(/\[([^\]]+)\]/);
  if (arrayArg) {
    args.push(parseNumberList(arrayArg[1]));
    const rest = inner.slice(arrayArg.index! + arrayArg[0].length).replace(/^,\s*/, "");
    const num = rest.match(/(\d+)/);
    if (num) args.push(Number(num[1]));
  } else {
    inner.split(",").forEach((part) => {
      const n = Number(part.trim());
      if (!Number.isNaN(n)) args.push(n);
    });
  }
  return args;
}

export function extractDSAInputs(code: string, fnName?: string | null): DSAInputs {
  const inputs: DSAInputs = {};
  const example = extractExampleCall(code);

  if (example) {
    const args = parseCallArgs(example);
    if (args[0] && Array.isArray(args[0])) {
      const arr = args[0] as number[];
      inputs.nums = arr;
      inputs.arr = arr;
      inputs.candidates = arr;
    }
    if (typeof args[1] === "number") {
      inputs.target = args[1];
      inputs.k = inputs.k ?? args[1];
    }
    if (typeof args[2] === "number") inputs.k = args[2];
  }

  inputs.nums = inputs.nums ?? extractArray(code, ["nums", "numbers", "array", "arr"]);
  inputs.arr = inputs.arr ?? inputs.nums ?? extractArray(code, ["arr"]);
  inputs.candidates = inputs.candidates ?? extractArray(code, ["candidates"]);
  inputs.target = inputs.target ?? extractTarget(code);
  inputs.k = inputs.k ?? extractK(code);

  const key = fnName?.toLowerCase() ?? "";
  const defaults = DEFAULTS[key] ?? DEFAULTS[fnName ?? ""];

  if (defaults) {
    return {
      nums: inputs.nums ?? defaults.nums,
      arr: inputs.arr ?? defaults.arr ?? inputs.nums,
      candidates: inputs.candidates ?? defaults.candidates,
      target: inputs.target ?? defaults.target,
      listValues: inputs.listValues ?? defaults.listValues,
      k: inputs.k ?? defaults.k,
      s: inputs.s ?? defaults.s,
      cycleAt: inputs.cycleAt ?? defaults.cycleAt,
    };
  }

  if (!inputs.nums && !inputs.arr) {
    inputs.nums = [2, 7, 11, 15];
    inputs.arr = inputs.nums;
  }
  if (!inputs.target && inputs.candidates) inputs.target = 7;
  if (!inputs.target && inputs.nums) inputs.target = 9;

  return inputs;
}
