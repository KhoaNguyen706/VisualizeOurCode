import type { VisualizationTechnique } from "./engine/technique/types";
import { CODE_SAMPLES, type CodeSample } from "./samples";

/**
 * The NeetCode roadmap, as the map of what this tool can draw.
 *
 * Each topic names the techniques the engine recognises for it and what the
 * picture is when one of its problems runs. A solution pasted from LeetCode
 * lands on a topic through its recognised techniques, so the map doubles as
 * the answer to "can it show my problem?" — and, per topic, "what will it
 * look like?".
 */
export type TopicId =
  | "arrays_hashing"
  | "two_pointers"
  | "stack"
  | "binary_search"
  | "sliding_window"
  | "linked_list"
  | "trees"
  | "tries"
  | "heap"
  | "backtracking"
  | "graphs"
  | "dp_1d"
  | "intervals"
  | "greedy"
  | "advanced_graphs"
  | "dp_2d"
  | "bit_manipulation"
  | "math_geometry";

export interface Topic {
  id: TopicId;
  label: string;
  /** Position on the map, as a fraction of its width and height. */
  x: number;
  y: number;
  /** The techniques the engine files under this topic. */
  techniques: VisualizationTechnique[];
  /** What the canvas draws for a problem here. */
  draws: string;
}

/** Laid out to match the NeetCode map, node for node. */
export const TOPICS: Topic[] = [
  { id: "arrays_hashing", label: "Arrays & Hashing", x: 0.486, y: 0.055, techniques: ["hash_map", "hash_set", "array_scan"], draws: "the array with the index it is at, and every dict or set the code builds, filling in" },
  { id: "two_pointers", label: "Two Pointers", x: 0.392, y: 0.170, techniques: ["two_pointer"], draws: "both pointers on the array (or the string, spelled out), moving as the code moves them" },
  { id: "stack", label: "Stack", x: 0.545, y: 0.155, techniques: ["stack"], draws: "the stack as a row, top marked, with each push and pop animated" },
  { id: "binary_search", label: "Binary Search", x: 0.250, y: 0.288, techniques: ["binary_search"], draws: "lo, hi and mid on the array as the range halves" },
  { id: "sliding_window", label: "Sliding Window", x: 0.412, y: 0.288, techniques: ["sliding_window"], draws: "the window as a highlighted span that grows and slides" },
  { id: "linked_list", label: "Linked List", x: 0.584, y: 0.293, techniques: ["linked_list", "linked_list_cycle"], draws: "every node with its next arrow, plus prev, cur, slow and fast on their nodes" },
  { id: "trees", label: "Trees", x: 0.406, y: 0.403, techniques: ["tree"], draws: "the binary tree the call was handed, the node being visited lit, and the tree of recursive calls beside it" },
  { id: "tries", label: "Tries", x: 0.255, y: 0.515, techniques: ["trie"], draws: "the trie as a tree of characters, end-of-word nodes marked" },
  { id: "heap", label: "Heap / Priority Queue", x: 0.36, y: 0.611, techniques: ["heap"], draws: "the heap list as the binary tree heapq keeps, smallest on top" },
  { id: "backtracking", label: "Backtracking", x: 0.547, y: 0.511, techniques: ["backtrack", "recursion"], draws: "the tree of calls as it is explored, each path and what it returned" },
  { id: "graphs", label: "Graphs", x: 0.545, y: 0.637, techniques: ["graph", "bfs", "dfs"], draws: "the grid or adjacency list, the queue or stack driving the traversal, the visited set, and the tree of calls" },
  { id: "dp_1d", label: "1-D Dynamic Programming", x: 0.73, y: 0.636, techniques: ["dp_1d"], draws: "the dp row filling in, cell by cell" },
  { id: "intervals", label: "Intervals", x: 0.09, y: 0.727, techniques: ["intervals"], draws: "the intervals as bars on one number line, so an overlap is visible" },
  { id: "greedy", label: "Greedy", x: 0.245, y: 0.772, techniques: ["greedy"], draws: "the array with the running best beside it, step by step" },
  { id: "advanced_graphs", label: "Advanced Graphs", x: 0.4, y: 0.749, techniques: ["advanced_graph"], draws: "a union-find forest as the trees it really is, or the heap and distance table of a Dijkstra" },
  { id: "dp_2d", label: "2-D Dynamic Programming", x: 0.6, y: 0.782, techniques: ["dp_grid"], draws: "the dp table as a heat-mapped grid, the cell being written highlighted" },
  { id: "bit_manipulation", label: "Bit Manipulation", x: 0.82, y: 0.768, techniques: ["bit_manipulation"], draws: "every integer as its binary digits, set bits filled" },
  { id: "math_geometry", label: "Math & Geometry", x: 0.75, y: 0.893, techniques: ["math_geometry"], draws: "the matrix with the cells that changed, or the digits as they carry" },
];

/** Parent → child, as NeetCode orders the topics. */
export const EDGES: [TopicId, TopicId][] = [
  ["arrays_hashing", "two_pointers"],
  ["arrays_hashing", "stack"],
  ["two_pointers", "binary_search"],
  ["two_pointers", "sliding_window"],
  ["two_pointers", "linked_list"],
  ["binary_search", "trees"],
  ["sliding_window", "trees"],
  ["linked_list", "trees"],
  ["trees", "tries"],
  ["trees", "heap"],
  ["trees", "backtracking"],
  ["heap", "intervals"],
  ["heap", "greedy"],
  ["heap", "advanced_graphs"],
  ["backtracking", "graphs"],
  ["backtracking", "dp_1d"],
  ["graphs", "advanced_graphs"],
  ["graphs", "dp_2d"],
  ["dp_1d", "dp_2d"],
  ["dp_1d", "bit_manipulation"],
  ["dp_2d", "math_geometry"],
  ["bit_manipulation", "math_geometry"],
];

const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

export function topicById(id: TopicId): Topic {
  return TOPIC_BY_ID.get(id)!;
}

const TOPIC_OF_TECHNIQUE = new Map<VisualizationTechnique, TopicId>();
for (const t of TOPICS) for (const tech of t.techniques) TOPIC_OF_TECHNIQUE.set(tech, t.id);

/**
 * Where a run lands on the map, from the techniques it was read as. The lead
 * decides, except that a tree in the picture is the Trees topic whatever the
 * walk over it was called — a DFS over a binary tree is a tree problem.
 */
export function topicOf(techniques: readonly string[] | undefined): TopicId | undefined {
  if (!techniques?.length) return undefined;
  if (techniques.includes("tree")) return "trees";
  for (const t of techniques) {
    const topic = TOPIC_OF_TECHNIQUE.get(t as VisualizationTechnique);
    if (topic) return topic;
  }
  return undefined;
}

export function samplesFor(topic: TopicId): CodeSample[] {
  return CODE_SAMPLES.filter((s) => s.topic === topic);
}
