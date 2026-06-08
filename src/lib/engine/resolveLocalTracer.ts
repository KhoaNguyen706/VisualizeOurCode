import { rankPatterns } from "@/lib/dsa/detectPattern";
import type { DSADetection, DSAPattern } from "@/lib/dsa/types";

const FN_PATTERN_HINTS: Partial<Record<DSAPattern, RegExp>> = {
  two_sum: /twosum|two_sum/i,
  bubble_sort: /bubblesort|bubble_sort/i,
  reverse_linked_list: /reverselist|reverse.*list/i,
  has_cycle: /hascycle|detectcycle|cycle/i,
  combination_sum: /combinationsum|combination_sum/i,
  subsets: /subsets?/i,
  binary_search: /binarysearch|binary_search/i,
  two_pointer: /palindrome|twopointer|two_pointer/i,
  hash_set_scan: /duplicate|findduplicate/i,
  sliding_window: /sliding|window|maxsum|substring/i,
  product_except_self: /productexceptself|product_except/i,
  is_same_tree: /issametree|same.*tree/i,
  valid_parentheses: /isvalid|validparen/i,
};

function isBlockedPair(pattern: DSAPattern, code: string, fnName: string | null): boolean {
  if (pattern === "reverse_linked_list") {
    if (/\b(slow|fast)\b/i.test(code)) return true;
    if (fnName && /cycle/i.test(fnName)) return true;
  }
  if (pattern === "sliding_window" && /\.next|ListNode|treenode/i.test(code)) return true;
  if (pattern === "sliding_window" && /palindrome|while[\s\S]*left\s*<\s*right/i.test(code) && !/window_sum|for\s*\(\s*right/i.test(code))
    return true;
  if (pattern === "two_pointer" && /window_sum|for\s*\(\s*right/i.test(code)) return true;
  return false;
}

function structuralFallback(code: string): DSAPattern | null {
  const c = code.toLowerCase();
  if (/\b(slow|fast)\b/.test(c) && /\.next|->next/.test(c)) return "has_cycle";
  if (/\.next\s*=\s*prev|->next\s*=\s*prev|next\s*=\s*prev/.test(c)) return "reverse_linked_list";
  if (/\btreenode\b/.test(c) && /\.left/.test(c)) return "is_same_tree";
  if (/\bstack\b/.test(c) && /['"][()[\]{}]['"]/.test(c)) return "valid_parentheses";
  if (/\bset\b/.test(c) && /\bin\s+\w+/.test(c) && /\.append/.test(c)) return "hash_set_scan";
  if (/palindrome|while[\s\S]*left\s*<\s*right/.test(c) && !/window_sum|for\s*\(\s*right/.test(c)) return "two_pointer";
  if (/for\s*\(\s*right|for\s+right\s+in|window_sum/.test(c) && /\b(left|right)\b/.test(c)) return "sliding_window";
  if (/complement|twosum|two_sum/.test(c)) return "two_sum";
  if (/curr_suffix|productexcept/.test(c)) return "product_except_self";
  if (/\.next|listnode|->next/.test(c)) return "has_cycle";
  return null;
}

/**
 * Pick the best local tracer for unknown code — no Gemini API required.
 * Uses ranked pattern scores + structural signals from the source code.
 */
export function resolveLocalTracer(code: string, detection: DSADetection): DSAPattern | null {
  const fnName = detection.fnName;
  const ranked = rankPatterns(code, fnName);

  for (const { pattern, score } of ranked) {
    if (pattern === "generic" || score < 3) continue;
    if (isBlockedPair(pattern, code, fnName)) continue;

    if (score >= 6) return pattern;

    const hint = FN_PATTERN_HINTS[pattern];
    if (hint && fnName && hint.test(fnName)) return pattern;

    if (pattern === "has_cycle" && /\b(slow|fast)\b/i.test(code)) return pattern;
    if (pattern === "two_pointer" && /\bwhile\b/i.test(code) && /\b(left|right)\b/i.test(code) && score >= 4)
      return pattern;
    if (pattern === "sliding_window" && /for\s*\(\s*right|window_sum/i.test(code) && score >= 4) return pattern;
    if (pattern === "is_same_tree" && /\bTreeNode\b/.test(code) && score >= 4) return pattern;
  }

  return structuralFallback(code);
}
