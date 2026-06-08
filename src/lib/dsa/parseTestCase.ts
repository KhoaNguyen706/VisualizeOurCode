import type { DSAInputs } from "./types";

function parseNumberList(raw: string): number[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}

/**
 * Parse a pasted test case string into DSA inputs.
 * Supports formats like:
 *   [2,1,5,1,3,2], k=3
 *   nums=[1,2,3], target=7
 *   1, 2, 3, 4, 5
 *   s="abcabcbb"
 */
export function parseTestCase(text: string): Partial<DSAInputs> {
  const trimmed = text.trim();
  if (!trimmed) return {};

  const out: Partial<DSAInputs> = {};

  const arrayMatch = trimmed.match(/\[([^\]]+)\]/);
  if (arrayMatch?.[1]) {
    const arr = parseNumberList(arrayMatch[1]);
    if (arr.length > 0) {
      out.nums = arr;
      out.arr = arr;
      out.candidates = arr;
    }
  }

  const kMatch = trimmed.match(/\bk\s*[=:]\s*(\d+)/i);
  if (kMatch?.[1]) out.k = Number(kMatch[1]);

  const targetMatch = trimmed.match(/\btarget\s*[=:]\s*(\d+)/i);
  if (targetMatch?.[1]) out.target = Number(targetMatch[1]);

  const numsMatch = trimmed.match(/\bnums\s*[=:]\s*\[([^\]]+)\]/i);
  if (numsMatch?.[1]) {
    const arr = parseNumberList(numsMatch[1]);
    if (arr.length > 0) {
      out.nums = arr;
      out.arr = arr;
    }
  }

  const arrMatch = trimmed.match(/\barr\s*[=:]\s*\[([^\]]+)\]/i);
  if (arrMatch?.[1]) {
    const arr = parseNumberList(arrMatch[1]);
    if (arr.length > 0) {
      out.arr = arr;
      out.nums = out.nums ?? arr;
    }
  }

  const listMatch = trimmed.match(/\blist\s*[=:]\s*\[([^\]]+)\]/i);
  if (listMatch?.[1]) {
    out.listValues = parseNumberList(listMatch[1]);
  }

  const cycleMatch = trimmed.match(/\bcycle(?:At|_at|_index)?\s*[=:]\s*(-?\d+)/i);
  if (cycleMatch?.[1]) out.cycleAt = Number(cycleMatch[1]);

  const posMatch = trimmed.match(/\bpos\s*[=:]\s*(-?\d+)/i);
  if (posMatch?.[1] && out.cycleAt === undefined) out.cycleAt = Number(posMatch[1]);

  if (!out.nums && !out.arr) {
    const plainNums = parseNumberList(trimmed.replace(/["'][^"']*["']/g, ""));
    if (plainNums.length > 0) {
      out.nums = plainNums;
      out.arr = plainNums;
    }
  }

  const strMatch = trimmed.match(/\bs\s*[=:]\s*["']([^"']+)["']/i);
  if (strMatch?.[1]) {
    out.s = strMatch[1];
  }

  return out;
}

export function mergeDSAInputs(base: DSAInputs, override: Partial<DSAInputs>): DSAInputs {
  return {
    nums: override.nums ?? base.nums,
    arr: override.arr ?? base.arr,
    candidates: override.candidates ?? base.candidates,
    target: override.target ?? base.target,
    listValues: override.listValues ?? base.listValues,
    k: override.k ?? base.k,
    s: override.s ?? base.s,
    cycleAt: override.cycleAt ?? base.cycleAt,
  };
}
