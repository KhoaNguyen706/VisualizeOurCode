import type { DSAPattern } from "@/lib/dsa/types";

/**
 * A note about the *shape* of a problem, shown alongside a trace of the user's
 * own code — never in place of it.
 *
 * The visualiser used to replace a first-draft solution's narrative with the
 * canonical one, which told people their brute-force loop was doing hash-map
 * lookups. Keeping the two separate means the trace stays truthful and the
 * textbook approach is still there to learn from.
 */
export interface PatternHint {
  pattern: DSAPattern;
  /** Human name of the problem shape, e.g. "Two Sum". */
  title: string;
  /** The approach it is usually solved with. */
  commonApproach: string;
  /** Complexity of that common approach. */
  commonComplexity: string;
  /** Factual, checkable observation about the code as written. */
  yours?: string;
}

const CATALOG: Partial<Record<DSAPattern, Omit<PatternHint, "pattern" | "yours">>> = {
  two_sum: {
    title: "Two Sum",
    commonApproach: "store each value's index in a hash map and look up target - x in one pass",
    commonComplexity: "O(n) time, O(n) space",
  },
  two_pointer: {
    title: "Two Pointers",
    commonApproach: "walk one index from each end and move the side that cannot improve",
    commonComplexity: "O(n) time, O(1) space",
  },
  hash_set_scan: {
    title: "Hash Set Scan",
    commonApproach: "keep a set of what you have seen and test membership in one pass",
    commonComplexity: "O(n) time, O(n) space",
  },
  bubble_sort: {
    title: "Bubble Sort",
    commonApproach: "repeatedly swap adjacent out-of-order pairs; merge/quick sort do better",
    commonComplexity: "O(n log n) for a comparison sort",
  },
  binary_search: {
    title: "Binary Search",
    commonApproach: "halve the range each step while the array stays sorted",
    commonComplexity: "O(log n) time, O(1) space",
  },
  sliding_window: {
    title: "Sliding Window",
    commonApproach: "advance the right edge and pull the left edge in, reusing the running total",
    commonComplexity: "O(n) time, O(1) extra space",
  },
  reverse_linked_list: {
    title: "Reverse Linked List",
    commonApproach: "re-point each node's next to the previous node as you walk once",
    commonComplexity: "O(n) time, O(1) space",
  },
  has_cycle: {
    title: "Cycle Detection",
    commonApproach: "advance a slow and a fast pointer until they meet or the fast one ends",
    commonComplexity: "O(n) time, O(1) space",
  },
  combination_sum: {
    title: "Combination Sum",
    commonApproach: "backtrack, adding each candidate and undoing it after the recursive call",
    commonComplexity: "exponential in the worst case",
  },
  subsets: {
    title: "Subsets",
    commonApproach: "for each element, branch on including it and excluding it",
    commonComplexity: "O(n · 2ⁿ)",
  },
  product_except_self: {
    title: "Product Except Self",
    commonApproach: "one prefix pass and one suffix pass, no division",
    commonComplexity: "O(n) time, O(1) extra space",
  },
  is_same_tree: {
    title: "Same Tree",
    commonApproach: "compare both roots, then recurse into left and right together",
    commonComplexity: "O(n) time",
  },
  valid_parentheses: {
    title: "Valid Parentheses",
    commonApproach: "push openers on a stack and match each closer against the top",
    commonComplexity: "O(n) time, O(n) space",
  },
};

/** Deepest nesting of loop headers in brace-delimited source (JS/TS). */
function braceLoopNesting(code: string): number {
  const LOOP_HEAD = /^\s*(?:\}\s*)?(?:for|while)\s*\(/;
  let depth = 0;
  let best = 0;
  const openLoopDepths: number[] = [];

  for (const rawLine of code.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//") || line.startsWith("*")) continue;

    if (LOOP_HEAD.test(line)) {
      openLoopDepths.push(depth);
      best = Math.max(best, openLoopDepths.length);
    }

    for (const ch of line) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        while (openLoopDepths.length && openLoopDepths[openLoopDepths.length - 1] >= depth) {
          openLoopDepths.pop();
        }
      }
    }
  }
  return best;
}

/** Column a line's code starts at, counting a tab as four spaces. */
function indentWidth(line: string): number {
  let width = 0;
  for (const ch of line) {
    if (ch === " ") width++;
    else if (ch === "\t") width += 4;
    else break;
  }
  return width;
}

/**
 * Deepest nesting of loop headers in indentation-delimited source (Python),
 * where a header owns every following line indented further than itself.
 */
function indentLoopNesting(code: string): number {
  const LOOP_HEAD = /^\s*(?:for|while)\b.*:\s*(?:#.*)?$/;
  let best = 0;
  const openIndents: number[] = [];

  for (const rawLine of code.split("\n")) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) continue;
    const indent = indentWidth(rawLine);

    while (openIndents.length && openIndents[openIndents.length - 1] >= indent) {
      openIndents.pop();
    }
    if (LOOP_HEAD.test(rawLine)) {
      openIndents.push(indent);
      best = Math.max(best, openIndents.length);
    }
  }
  return best;
}

/**
 * Deepest nesting of loop headers. Approximate by design: it only ever backs a
 * hedged sentence ("looks like"), never a hard claim.
 *
 * Both delimiter styles are measured and the larger wins, so the hint fires for
 * Python too — the brace pass alone scores every indented `for` at zero, which
 * silently withheld the observation from exactly the language most people paste.
 */
export function maxLoopNesting(code: string): number {
  return Math.max(braceLoopNesting(code), indentLoopNesting(code));
}

export function buildPatternHint(pattern: DSAPattern, code: string): PatternHint | undefined {
  const entry = CATALOG[pattern];
  if (!entry) return undefined;

  const nesting = maxLoopNesting(code);
  const yours =
    nesting >= 2
      ? `your solution nests ${nesting} loops`
      : undefined;

  return { pattern, ...entry, yours };
}
