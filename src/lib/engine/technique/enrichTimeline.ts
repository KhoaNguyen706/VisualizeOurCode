import type {
  ActivePointers,
  TimelineFrame,
  VariableValue,
  VisualizationMode,
} from "@/lib/types";
import type { VisualizationTechnique } from "./types";
import { inferTechniqueFromCode } from "./inferTechnique";

const POINTER_ALIASES: [string, string][] = [
  ["l", "left"],
  ["r", "right"],
  ["lo", "left"],
  ["hi", "right"],
  ["low", "left"],
  ["high", "right"],
  ["h", "head"],
  ["mid", "mid"],
];

function numVal(v: unknown): number | undefined {
  return typeof v === "number" && v >= 0 ? v : undefined;
}

function normalizePointers(
  ptrs: ActivePointers,
  vars?: Record<string, VariableValue>
): ActivePointers {
  const out: ActivePointers = { ...ptrs };

  if (vars) {
    for (const key of ["left", "right", "l", "r", "lo", "hi", "i", "j", "mid", "slow", "fast", "row", "col"]) {
      if (out[key] === undefined) {
        const v = numVal(vars[key]);
        if (v !== undefined) out[key] = v;
      }
    }
    if (typeof vars.slow === "string") out.slow = vars.slow;
    if (typeof vars.fast === "string") out.fast = vars.fast;
    if (typeof vars.current === "string") out.current = vars.current;
    if (typeof vars.prev === "string") out.prev = vars.prev;
  }

  for (const [from, to] of POINTER_ALIASES) {
    if (out[from] !== undefined && out[to] === undefined) {
      out[to] = out[from];
    }
  }
  if (out.l !== undefined && out.left === undefined) out.left = out.l;
  if (out.r !== undefined && out.right === undefined) out.right = out.r;

  return out;
}

function rangeHighlights(left: number, right: number): number[] {
  const lo = Math.min(left, right);
  const hi = Math.max(left, right);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

function extractGrid(vars?: Record<string, VariableValue>): (number | string)[][] | undefined {
  if (!vars) return undefined;
  for (const key of ["dp", "memo", "grid", "table", "cache"]) {
    const v = vars[key];
    if (Array.isArray(v) && v.length > 0 && Array.isArray(v[0])) {
      return v as (number | string)[][];
    }
  }
  return undefined;
}

function applyTechniqueVisuals(
  frame: TimelineFrame,
  technique: VisualizationTechnique
): TimelineFrame {
  const ptrs = normalizePointers(frame.activePointers, frame.variables);
  let highlights = [...frame.highlightedElements];
  let mode = frame.mode;
  let overlayModes = frame.overlayModes;
  const structures = { ...frame.structures };

  const left = numVal(ptrs.left);
  const right = numVal(ptrs.right);
  const i = numVal(ptrs.i);
  const j = numVal(ptrs.j);

  switch (technique) {
    case "sliding_window":
      if (left !== undefined && right !== undefined && left <= right) {
        highlights = [...new Set([...highlights, ...rangeHighlights(left, right)])];
        mode = "ARRAY";
      }
      break;

    case "two_pointer":
      if (left !== undefined && right !== undefined) {
        highlights = [...new Set([...highlights, left, right])];
        mode = "ARRAY";
      } else if (i !== undefined && j !== undefined) {
        highlights = [...new Set([...highlights, i, j])];
        ptrs.left = i;
        ptrs.right = j;
        mode = "ARRAY";
      }
      break;

    case "binary_search":
      if (left !== undefined && right !== undefined) {
        highlights = [...new Set([...highlights, left, right, ...(numVal(ptrs.mid) !== undefined ? [ptrs.mid as number] : [])])];
        mode = "ARRAY";
      } else if (i !== undefined) {
        highlights = [...new Set([...highlights, i])];
      }
      break;

    case "dp_grid": {
      const grid = structures.gridData ?? extractGrid(frame.variables);
      if (grid) {
        structures.gridData = grid;
        mode = "ARRAY";
        const row = numVal(ptrs.row);
        const col = numVal(ptrs.col);
        if (row !== undefined && col !== undefined) {
          highlights = [...new Set([...highlights, `${row},${col}`])];
        }
      }
      break;
    }

    case "hash_map":
      mode = "ARRAY";
      overlayModes = overlayModes ?? ["ARRAY", "HASH_MAP"];
      if (i !== undefined) highlights = [...new Set([...highlights, i])];
      break;

    case "hash_set": {
      mode = "ARRAY";
      overlayModes = overlayModes ?? ["ARRAY", "HASH_MAP"];
      if (i !== undefined) highlights = [...new Set([...highlights, i])];
      const setVar = frame.variables?.set;
      if (Array.isArray(setVar)) {
        structures.mapData = Object.fromEntries(setVar.map((v) => [String(v), "in set"]));
      }
      const resVar = frame.variables?.result;
      if (Array.isArray(resVar)) {
        structures.resultData = resVar as (string | number)[];
      }
      break;
    }

    case "dfs":
    case "bfs":
    case "backtrack":
    case "graph":
      if (structures.treeData.length > 0) mode = "TREE";
      break;

    case "linked_list":
    case "linked_list_cycle":
      if (structures.listData.length > 0) mode = "LINKED_LIST";
      break;

    default:
      break;
  }

  return {
    ...frame,
    technique,
    mode,
    overlayModes,
    structures,
    activePointers: ptrs,
    highlightedElements: highlights,
  };
}

function asTechnique(v: unknown): VisualizationTechnique | undefined {
  if (typeof v !== "string") return undefined;
  const allowed: VisualizationTechnique[] = [
    "two_pointer", "sliding_window", "binary_search", "dp_grid", "dfs", "bfs", "graph",
    "backtrack", "hash_map", "hash_set", "linked_list", "linked_list_cycle", "array_scan", "generic",
  ];
  return allowed.includes(v as VisualizationTechnique) ? (v as VisualizationTechnique) : undefined;
}

export function enrichTimeline(
  timeline: TimelineFrame[],
  code?: string,
  technique?: VisualizationTechnique
): TimelineFrame[] {
  const fallback = technique ?? (code ? inferTechniqueFromCode(code) : "generic");
  return timeline.map((f) => {
    const frameTech = asTechnique(f.technique) ?? fallback;
    return applyTechniqueVisuals({ ...f, technique: frameTech }, frameTech);
  });
}

export function enrichScenarioTimeline<T extends { timeline: TimelineFrame[] }>(
  scenario: T,
  code?: string,
  technique?: VisualizationTechnique
): T {
  return { ...scenario, timeline: enrichTimeline(scenario.timeline, code, technique) };
}
