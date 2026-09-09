import type {
  ActivePointers,
  TimelineFrame,
  VariableValue,
  VisualizationMode,
  VisualizationStructures,
} from "@/lib/types";
import type { VisualizationTechnique } from "./types";
import { inferTechniquesFromCode } from "./inferTechnique";

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

/** The picture a supporting technique adds beside the lead one. */
const LAYER_MODE: Partial<Record<VisualizationTechnique, VisualizationMode>> = {
  hash_map: "HASH_MAP",
  hash_set: "HASH_MAP",
  linked_list: "LINKED_LIST",
  linked_list_cycle: "LINKED_LIST",
  dfs: "TREE",
  bfs: "TREE",
  graph: "TREE",
  backtrack: "TREE",
  recursion: "TREE",
  two_pointer: "ARRAY",
  sliding_window: "ARRAY",
  binary_search: "ARRAY",
  array_scan: "ARRAY",
};

/** The modes that have something to draw in this frame. */
function modesWithData(s: VisualizationStructures): VisualizationMode[] {
  const out: VisualizationMode[] = [];
  if (s.arrayData.length > 0) out.push("ARRAY");
  // An empty dict still counts: watching it start empty and fill is the point.
  if ((s.mapsData?.length ?? 0) > 0 || Object.keys(s.mapData).length > 0) out.push("HASH_MAP");
  if (s.listData.length > 0) out.push("LINKED_LIST");
  if (s.treeData.length > 0) out.push("TREE");
  return out;
}

/**
 * Compose the layers a frame shows.
 *
 * The lead technique's own mode comes first, then the modes its supporting
 * techniques ask for, then whatever else the code built — so nothing the
 * author's variables hold is hidden because one label won. A mode is kept only
 * when there is data to draw, except ones a tracer requested outright (a
 * hash-map walkthrough wants its table on screen before the first insert).
 */
function composeModes(
  lead: VisualizationMode,
  requested: VisualizationMode[] | undefined,
  supporting: VisualizationTechnique[],
  structures: VisualizationStructures
): VisualizationMode[] | undefined {
  const withData = modesWithData(structures);
  const wanted: VisualizationMode[] = [
    lead,
    ...(requested ?? []),
    ...supporting.flatMap((t) => (LAYER_MODE[t] ? [LAYER_MODE[t]] : [])),
    ...withData,
  ];

  const out: VisualizationMode[] = [];
  for (const m of wanted) {
    if (out.includes(m)) continue;
    if (m === lead || requested?.includes(m) || withData.includes(m)) out.push(m);
  }
  return out.length > 1 ? out : undefined;
}

function applyTechniqueVisuals(
  frame: TimelineFrame,
  lead: VisualizationTechnique,
  supporting: VisualizationTechnique[]
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

  switch (lead) {
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
    case "recursion":
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
    technique: lead,
    techniques: [lead, ...supporting],
    mode,
    overlayModes: composeModes(mode, overlayModes, supporting, structures),
    structures,
    activePointers: ptrs,
    highlightedElements: highlights,
  };
}

const ALLOWED: VisualizationTechnique[] = [
  "two_pointer", "sliding_window", "binary_search", "dp_grid", "dfs", "bfs", "graph",
  "backtrack", "recursion", "hash_map", "hash_set", "linked_list", "linked_list_cycle",
  "array_scan", "generic",
];

function asTechnique(v: unknown): VisualizationTechnique | undefined {
  return typeof v === "string" && ALLOWED.includes(v as VisualizationTechnique)
    ? (v as VisualizationTechnique)
    : undefined;
}

/**
 * Attach the technique layers to every frame. `techniques` is the list the
 * source was read as, lead first; a frame that already names its own
 * technique (a pattern tracer's) keeps that as its lead.
 */
export function enrichTimeline(
  timeline: TimelineFrame[],
  code?: string,
  techniques?: VisualizationTechnique | VisualizationTechnique[]
): TimelineFrame[] {
  const list: VisualizationTechnique[] =
    techniques === undefined
      ? code
        ? inferTechniquesFromCode(code)
        : ["generic"]
      : Array.isArray(techniques)
        ? techniques
        : [techniques];
  const [fallbackLead = "generic", ...supporting] = list;

  return timeline.map((f) => {
    const lead = asTechnique(f.technique) ?? fallbackLead;
    return applyTechniqueVisuals(
      { ...f },
      lead,
      supporting.filter((t) => t !== lead)
    );
  });
}

export function enrichScenarioTimeline<T extends { timeline: TimelineFrame[] }>(
  scenario: T,
  code?: string,
  techniques?: VisualizationTechnique | VisualizationTechnique[]
): T {
  return { ...scenario, timeline: enrichTimeline(scenario.timeline, code, techniques) };
}
