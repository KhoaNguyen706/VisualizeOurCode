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

export interface VisualizationStructures {
  arrayData: (number | string)[];
  mapData: Record<string, number | string>;
  listData: ListNode[];
  treeData: TreeNode[];
  /** 2D DP / grid table */
  gridData?: (number | string)[][];
  /** Accumulated output (e.g. result list while building) */
  resultData?: (number | string)[];
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
  | (string | number | boolean | null)[][];

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
  /** Condition check this step: true = met (green), false = not met (red) */
  conditionMet?: boolean;
  /** Short label for the condition, e.g. "num in set?" */
  conditionLabel?: string;
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
