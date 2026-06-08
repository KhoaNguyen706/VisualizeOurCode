import type { DSADetection, DSAInputs, DSAPattern, SupportedLanguage } from "./types";
import { extractDSAInputs } from "./extractInputs";

const FN_PATTERNS: RegExp[] = [
  /def\s+(\w+)\s*\(/,
  /function\s+(\w+)\s*\(/,
  /(?:public|private|protected|static|\s)+[\w<>\[\],\s]+\s+(\w+)\s*\(/,
  /(?:void|int|bool|auto|vector[\w<>]*|List[\w<>]*)\s+(\w+)\s*\(/,
  /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?function/,
  /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
];

export function normalizeLanguage(lang?: string): SupportedLanguage {
  if (!lang) return "unknown";
  const l = lang.toLowerCase();
  if (l === "js" || l === "javascript") return "javascript";
  if (l === "ts" || l === "typescript") return "typescript";
  if (l === "py" || l === "python") return "python";
  if (l === "java") return "java";
  if (l === "cpp" || l === "c++") return "cpp";
  return "unknown";
}

export function detectFunctionName(code: string): string | null {
  for (const re of FN_PATTERNS) {
    const m = code.match(re);
    if (m?.[1] && !["if", "for", "while", "return", "class", "struct"].includes(m[1])) {
      return m[1];
    }
  }
  return null;
}

interface PatternRule {
  pattern: DSAPattern;
  score: (code: string, fnName: string | null) => number;
}

function structuralBonus(code: string, pattern: DSAPattern): number {
  const c = code.toLowerCase();
  switch (pattern) {
    case "two_sum":
      if (/\bfor\b/.test(c) && /\b(nums|arr|array)\b/.test(c)) return 1;
      return 0;
    case "bubble_sort":
      if (/for[\s\S]*for/i.test(c)) return 1;
      return 0;
    case "binary_search":
      if (/\bwhile\b/.test(c) && /\b(left|right|mid|lo|hi)\b/.test(c)) return 1;
      return 0;
    case "combination_sum":
    case "subsets":
      if (/\b(backtrack|recurse|dfs)\b/.test(c) && /\b(append|pop|push)\b/.test(c)) return 1;
      return 0;
    case "reverse_linked_list":
      if (/\.next|->next/.test(c)) return 1;
      return 0;
    case "sliding_window":
      if (/window_sum|for\s*\(\s*right|for\s+right\s+in/i.test(c)) return 1;
      return 0;
    case "two_pointer":
      if (/\bwhile\b/.test(c) && /\b(left|right)\b/.test(c)) return 1;
      return 0;
    default:
      return 0;
  }
}

const RULES: PatternRule[] = [
  {
    pattern: "two_sum",
    score: (c, fn) => {
      let s = 0;
      if (/two\s*_?\s*sum|twosum/i.test(c)) s += 4;
      if (fn && /twosum/i.test(fn)) s += 3;
      if (/complement|target\s*[-−]\s*\w+/i.test(c)) s += 2;
      if (/\b(seen|hash|map|dict)\b/i.test(c)) s += 2;
      if (/\bnums\b/i.test(c) && /\btarget\b/i.test(c)) s += 1;
      return s + structuralBonus(c, "two_sum");
    },
  },
  {
    pattern: "bubble_sort",
    score: (c, fn) => {
      let s = 0;
      if (/bubble\s*_?\s*sort|bubblesort/i.test(c)) s += 5;
      if (fn && /bubblesort/i.test(fn)) s += 3;
      if (/arr\[j\].*arr\[j\s*\+\s*1\]|arr\[i\].*arr\[i\s*\+\s*1\]/i.test(c)) s += 2;
      if (/\bswap\b/i.test(c) && /for[\s\S]*for/i.test(c)) s += 1;
      return s + structuralBonus(c, "bubble_sort");
    },
  },
  {
    pattern: "has_cycle",
    score: (c, fn) => {
      let s = 0;
      if (/has\s*_?\s*cycle|hascycle|detect\s*cycle|linked\s*list\s*cycle/i.test(c)) s += 5;
      if (fn && /hascycle|detectcycle|cycle/i.test(fn)) s += 4;
      if (/\b(slow|tortoise)\b/i.test(c) && /\b(fast|hare)\b/i.test(c)) s += 3;
      if (/slow\s*==\s*fast|slow\s*===\s*fast|slow\s*is\s*fast/i.test(c)) s += 2;
      if (/\.next\.next|next\.next/i.test(c)) s += 2;
      return s;
    },
  },
  {
    pattern: "reverse_linked_list",
    score: (c, fn) => {
      let s = 0;
      if (/reverse\s*_?\s*(linked\s*)?list|reverselist/i.test(c)) s += 5;
      if (fn && /reverselist/i.test(fn)) s += 3;
      if (/\.next\s*=\s*prev|next\s*=\s*prev|->next\s*=\s*prev/i.test(c) && /\b(prev|current)\b/i.test(c)) s += 3;
      if (/\b(slow|fast)\b/i.test(c)) s -= 3;
      if (/hascycle|has\s*cycle/i.test(c)) s -= 5;
      return s + structuralBonus(c, "reverse_linked_list");
    },
  },
  {
    pattern: "combination_sum",
    score: (c, fn) => {
      let s = 0;
      if (/combination\s*_?\s*sum|combinationsum/i.test(c)) s += 5;
      if (fn && /combinationsum/i.test(fn)) s += 3;
      if (/\bcandidates\b/i.test(c) && /\btarget\b/i.test(c) && /\b(backtrack|dfs|recurse)/i.test(c)) s += 3;
      if (/\bres\b/i.test(c) && /\bpath\b/i.test(c)) s += 1;
      return s + structuralBonus(c, "combination_sum");
    },
  },
  {
    pattern: "subsets",
    score: (c, fn) => {
      let s = 0;
      if (/\bsubsets?\b/i.test(c) && !/combination/i.test(c)) s += 4;
      if (fn && /subsets?/i.test(fn)) s += 3;
      if (/\bbacktrack/i.test(c) && /\bsubset\b/i.test(c)) s += 2;
      return s + structuralBonus(c, "subsets");
    },
  },
  {
    pattern: "binary_search",
    score: (c, fn) => {
      let s = 0;
      if (/binary\s*_?\s*search|binarysearch/i.test(c)) s += 5;
      if (fn && /binarysearch/i.test(fn)) s += 3;
      if (/\b(left|right|mid|lo|hi)\b/i.test(c) && /while[\s\S]*</i.test(c)) s += 2;
      return s + structuralBonus(c, "binary_search");
    },
  },
  {
    pattern: "hash_set_scan",
    score: (c, fn) => {
      let s = 0;
      if (/findduplicate|findallduplicate|duplicate/i.test(c)) s += 5;
      if (fn && /duplicate/i.test(fn)) s += 4;
      if (/\bset\s*\(|\bset\s*=\s*set\s*\(/.test(c) && /\bin\s+\w+/.test(c)) s += 4;
      if (/\.append/.test(c) && /\bfor\b/.test(c) && /\bset\b/.test(c)) s += 3;
      if (/result\s*=\s*\[\]/.test(c) && /\bset\b/.test(c)) s += 2;
      return s;
    },
  },
  {
    pattern: "two_pointer",
    score: (c, fn) => {
      let s = 0;
      if (/palindrome|ispalindrome/i.test(c)) s += 5;
      if (fn && /palindrome/i.test(fn)) s += 4;
      if (/\bwhile\b[\s\S]*\bleft\b\s*<\s*\bright\b/i.test(c)) s += 4;
      if (/\bleft\s*,\s*right\s*=/.test(c) && /len\s*\(/.test(c)) s += 2;
      if (/opposite|twopointer|two_pointer/i.test(c)) s += 2;
      if (/window_sum|for\s*\(\s*right|for\s+right\s+in/i.test(c)) s -= 4;
      return s + structuralBonus(c, "two_pointer");
    },
  },
  {
    pattern: "sliding_window",
    score: (c, fn) => {
      let s = 0;
      if (/sliding\s*window|maxsubstring|minwindow|lengthoflongest|maxsum/i.test(c)) s += 4;
      if (fn && /(sliding|window|maxsum|minsubarray|substring)/i.test(fn)) s += 3;
      if (/for\s*\(\s*right|for\s+right\s+in\s+range|right\s*\+\+|right\s*\+=/i.test(c)) s += 3;
      if (/window_sum|curr_sum|running_sum/i.test(c)) s += 2;
      if (/right\s*-\s*left|left\s*\+=\s*1|left\s*=\s*left\s*\+\s*1/i.test(c)) s += 1;
      if (/\bwhile\b[\s\S]*\bleft\b\s*<\s*\bright\b/i.test(c) && !/window_sum|for\s*\(\s*right/i.test(c)) s -= 4;
      if (/palindrome/i.test(c)) s -= 5;
      return s + structuralBonus(c, "sliding_window");
    },
  },
  {
    pattern: "product_except_self",
    score: (c, fn) => {
      let s = 0;
      if (/productexceptself|product\s*except\s*self/i.test(c)) s += 5;
      if (fn && /productexceptself/i.test(fn)) s += 3;
      if (/curr_suffix|prefix.*suffix|suffix.*prefix/i.test(c)) s += 3;
      if (/result\[i\]\s*\*=|result\[i\]\s*=\s*result\[i\s*-\s*1\]/.test(c)) s += 2;
      return s;
    },
  },
  {
    pattern: "is_same_tree",
    score: (c, fn) => {
      let s = 0;
      if (/issametree|is\s*same\s*tree/i.test(c)) s += 5;
      if (fn && /issametree|samestree/i.test(fn)) s += 3;
      if (/\.left[\s\S]*\.right|\.right[\s\S]*\.left/.test(c) && /\bTreeNode\b/.test(c)) s += 2;
      if (/not\s+p\s+and\s+not\s+q|p\s+is\s+None\s+and\s+q\s+is\s+None/i.test(c)) s += 2;
      if (/p\.val\s*[!=]=\s*q\.val/.test(c)) s += 2;
      return s;
    },
  },
  {
    pattern: "valid_parentheses",
    score: (c, fn) => {
      let s = 0;
      if (/validparentheses|valid\s*parentheses|isvalid/i.test(c)) s += 4;
      if (fn && /(isvalid|validparen)/i.test(fn)) s += 3;
      if (/\bstack\b\s*=\s*\[\s*\]/.test(c) && /['"][()[\]{}]['"]/.test(c)) s += 2;
      if (/\.push\(.*\).*\.pop\(\)|stack\.append.*stack\.pop/i.test(c)) s += 1;
      return s;
    },
  },
];

export function rankPatterns(
  code: string,
  fnName: string | null
): { pattern: DSAPattern; score: number }[] {
  return RULES.map((rule) => ({
    pattern: rule.pattern,
    score: rule.score(code, fnName),
  })).sort((a, b) => b.score - a.score);
}

function scoreAll(code: string, fnName: string | null): { pattern: DSAPattern; score: number }[] {
  return rankPatterns(code, fnName);
}

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

/** True when detected pattern aligns with function name and score is strong enough. */
export function isPatternPlausible(detection: DSADetection): boolean {
  const score = detection.score ?? 0;
  if (score < 4) return false;

  const fn = detection.fnName;
  if (!fn) return score >= 5;

  const hint = FN_PATTERN_HINTS[detection.pattern];
  if (hint && !hint.test(fn)) return false;

  if (/cycle/i.test(fn) && detection.pattern === "reverse_linked_list") return false;
  if (/reverse/i.test(fn) && detection.pattern !== "reverse_linked_list") return false;

  return true;
}

export function getBestPattern(code: string, minScore: number): DSAPattern | null {
  const fnName = detectFunctionName(code);
  const ranked = scoreAll(code, fnName);
  const top = ranked[0];
  if (top && top.score >= minScore) return top.pattern;
  return null;
}

export function detectDSAPattern(
  code: string,
  language?: string,
  inputOverrides?: Partial<DSAInputs>
): DSADetection {
  const lang = normalizeLanguage(language);
  const fnName = detectFunctionName(code);
  const inputs = { ...extractDSAInputs(code, fnName), ...inputOverrides };
  const ranked = scoreAll(code, fnName);

  const top = ranked[0];
  const bestScore = top?.score ?? 0;
  const best = top?.pattern ?? "generic";

  const confidence = bestScore >= 3 ? Math.min(1, bestScore / 6) : bestScore > 0 ? 0.4 : 0;

  return {
    pattern: bestScore >= 2 ? best : "generic",
    language: lang,
    fnName,
    inputs,
    confidence,
    score: bestScore,
  };
}
