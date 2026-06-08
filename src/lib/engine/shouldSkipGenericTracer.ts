import type { DSAPattern } from "@/lib/dsa/types";

/**
 * Hardcoded tracers that ignore problem-specific logic.
 * When true, skip the tracer and use technique-guided AI instead.
 */
export function shouldSkipGenericTracer(pattern: DSAPattern, code: string): boolean {
  const c = code.toLowerCase();

  if (pattern === "sliding_window") {
    if (/\bk\s*=\s*\d+/.test(c) && /window|subarray|size/i.test(c)) return false;
    if (/window_sum|target\s*sum|max_len|min_len|longest|substring|minwindow/i.test(c)) return false;
    return true;
  }

  if (pattern === "two_pointer") {
    if (/palindrome|left\s*<\s*right|while\s+left\s*<\s*right/i.test(c)) return false;
    return true;
  }

  if (pattern === "hash_set_scan") {
    if (/\bset\s*\(|\bin\s+\w+|\badd\s*\(|append/i.test(c)) return false;
    return true;
  }

  if (pattern === "two_sum") {
    if (/complement|target|dict|hash|map/i.test(c)) return false;
    return true;
  }

  return false;
}
