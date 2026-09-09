export type VisualizationMode = "ARRAY" | "HASH_MAP" | "LINKED_LIST" | "TREE";

export type StatusType = "EXPLORE" | "SUCCESS" | "FAIL";

export interface ListNode {
  id: string;
  value: number | string;
  next: string | null;
}

export interface TreeNode {
  id: string;
  value: number | string;
  children: string[];
  parent: string | null;
  x?: number;
  y?: number;
}

/**
 * A working collection the algorithm pushes and pops — a BFS queue, a DFS
 * stack, a seen-set. Drawn as its own row so items can be watched entering and
 * leaving, which is the whole shape of a traversal.
 */
export interface ContainerView {
  /** The author's own variable name, e.g. `q`. */
  name: string;
  /** Which end items leave from, inferred from the verbs the author used. */
  kind: "queue" | "stack" | "set";
  /** Each item rendered as text, in the order the container holds them. */
  items: string[];
}

/** One dict/map the code is building, under the name the author gave it. */
export interface NamedMap {
  name: string;
  data: Record<string, number | string>;
}

export interface VisualizationStructures {
  arrayData: (number | string)[];
  /** The first map, kept so single-map callers and tracers stay unchanged. */
  mapData: Record<string, number | string>;
  /**
   * Every map in scope. Counting problems routinely build two and compare them
   * — showing only one makes the comparison impossible to follow.
   */
  mapsData?: NamedMap[];
  listData: ListNode[];
  treeData: TreeNode[];
  /** 2D DP / grid table */
  gridData?: (number | string)[][];
  /** Accumulated output (e.g. result list while building) */
  resultData?: (number | string)[];
  /** Working queue / stack the traversal drives itself from. */
  containerData?: ContainerView;
}

export interface ActivePointers {
  i?: number;
  j?: number;
  root?: string | null;
  current?: string | null;
  prev?: string | null;
  depth?: number;
  [key: string]: number | string | null | undefined;
}

export type VariableValue =
  | string
  | number
  | boolean
  | null
  | (string | number | boolean | null)[]
  | (string | number | boolean | null)[][]
  /** A dict the author is building — dropping these hid them from the panel. */
  | Record<string, string | number | boolean | null>;

export interface TimelineFrame {
  step: number;
  mode: VisualizationMode;
  structures: VisualizationStructures;
  activePointers: ActivePointers;
  highlightedElements: (string | number)[];
  statusType: StatusType;
  message: string;
  /** Important variables to watch this step (e.g. res, subset, sum, count). */
  variables?: Record<string, VariableValue>;
  /** When set, render multiple modes simultaneously */
  overlayModes?: VisualizationMode[];
  /** Drives technique-specific rendering (window box, grid, graph, etc.) */
  technique?: string;
  /**
   * Every technique the code combines, primary first — `technique` is the
   * first of these. A BFS over a grid with a visited set is all three, and
   * naming each lets the picture be read as the combination it is.
   */
  techniques?: string[];
  /** Condition check this step: true = met (green), false = not met (red) */
  conditionMet?: boolean;
  /** Short label for the condition, e.g. "num in set?" */
  conditionLabel?: string;
  /** 1-based line in the user's own source that produced this step. */
  sourceLine?: number;
  /**
   * Every line this frame covers. A condensed beat folds the bookkeeping lines
   * around its anchor, and the gutter dims them so the fold stays visible.
   */
  coveredLines?: number[];
  /** Variable names whose value differs from the previous step. */
  changedVariables?: string[];
  /** `"row,col"` keys in `structures.gridData` that changed this step. */
  changedCells?: string[];
  /** Indices of `structures.arrayData` that changed this step. */
  changedIndices?: number[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  primaryMode: VisualizationMode;
  timeline: TimelineFrame[];
}

export const EMPTY_STRUCTURES: VisualizationStructures = {
  arrayData: [],
  mapData: {},
  listData: [],
  treeData: [],
  gridData: [],
};
