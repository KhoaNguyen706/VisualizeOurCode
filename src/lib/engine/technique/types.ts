export type VisualizationTechnique =
  | "two_pointer"
  | "sliding_window"
  | "binary_search"
  | "dp_grid"
  | "dfs"
  | "bfs"
  | "graph"
  | "backtrack"
  | "hash_map"
  | "hash_set"
  | "linked_list"
  | "linked_list_cycle"
  | "array_scan"
  | "generic";

export const TECHNIQUE_LABELS: Record<VisualizationTechnique, string> = {
  two_pointer: "Two Pointers",
  sliding_window: "Sliding Window",
  binary_search: "Binary Search",
  dp_grid: "Dynamic Programming",
  dfs: "DFS",
  bfs: "BFS",
  graph: "Graph",
  backtrack: "Backtracking",
  hash_map: "Hash Map",
  hash_set: "Hash Set",
  linked_list: "Linked List",
  linked_list_cycle: "Cycle Detection",
  array_scan: "Array Scan",
  generic: "Algorithm",
};
