import type { TimelineFrame, VisualizationMode } from "@/lib/types";

export type DSAPattern =
  | "two_sum"
  | "two_pointer"
  | "hash_set_scan"
  | "bubble_sort"
  | "reverse_linked_list"
  | "has_cycle"
  | "combination_sum"
  | "subsets"
  | "binary_search"
  | "sliding_window"
  | "product_except_self"
  | "is_same_tree"
  | "valid_parentheses"
  | "generic";

export type SupportedLanguage = "javascript" | "typescript" | "python" | "java" | "cpp" | "unknown";

export interface DSAInputs {
  nums?: number[];
  arr?: number[];
  candidates?: number[];
  target?: number;
  listValues?: number[];
  /** Index where tail connects back (cycle detection) */
  cycleAt?: number;
  /** Fixed sliding window size */
  k?: number;
  /** String input (e.g. longest substring problems) */
  s?: string;
}

export interface DSADetection {
  pattern: DSAPattern;
  language: SupportedLanguage;
  fnName: string | null;
  inputs: DSAInputs;
  confidence: number;
  score?: number;
}

export interface DSATracerResult {
  timeline: TimelineFrame[];
  name: string;
  description: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  primaryMode: VisualizationMode;
}
