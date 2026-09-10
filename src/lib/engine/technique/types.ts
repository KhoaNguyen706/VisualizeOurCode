export type VisualizationTechnique =
  | "two_pointer"
  | "sliding_window"
  | "binary_search"
  | "stack"
  | "dp_1d"
  | "dp_grid"
  | "dfs"
  | "bfs"
  | "graph"
  | "advanced_graph"
  | "backtrack"
  | "recursion"
  | "hash_map"
  | "hash_set"
  | "linked_list"
  | "linked_list_cycle"
  | "tree"
  | "trie"
  | "heap"
  | "intervals"
  | "greedy"
  | "bit_manipulation"
  | "math_geometry"
  | "array_scan"
  | "generic";

export const TECHNIQUE_LABELS: Record<VisualizationTechnique, string> = {
  two_pointer: "Two Pointers",
  sliding_window: "Sliding Window",
  binary_search: "Binary Search",
  stack: "Stack",
  dp_1d: "1-D Dynamic Programming",
  dp_grid: "2-D Dynamic Programming",
  dfs: "DFS",
  bfs: "BFS",
  graph: "Graph",
  advanced_graph: "Advanced Graphs",
  backtrack: "Backtracking",
  recursion: "Recursion",
  hash_map: "Hash Map",
  hash_set: "Hash Set",
  linked_list: "Linked List",
  linked_list_cycle: "Cycle Detection",
  tree: "Binary Tree",
  trie: "Trie",
  heap: "Heap / Priority Queue",
  intervals: "Intervals",
  greedy: "Greedy",
  bit_manipulation: "Bit Manipulation",
  math_geometry: "Math & Geometry",
  array_scan: "Array Scan",
  generic: "Algorithm",
};

/** Every technique, for validating a string that claims to be one. */
export const ALL_TECHNIQUES = Object.keys(TECHNIQUE_LABELS) as VisualizationTechnique[];
