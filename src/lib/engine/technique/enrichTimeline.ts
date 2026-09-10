import type {
  ActivePointers,
  TimelineFrame,
  VariableValue,
  VisualizationMode,
  VisualizationStructures,
} from "@/lib/types";
import { ALL_TECHNIQUES, type VisualizationTechnique } from "./types";
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
  dp_1d: "ARRAY",
  greedy: "ARRAY",
  tree: "TREE",
  trie: "TREE",
  advanced_graph: "TREE",
};

type Pair = [number, number];

function isPairList(v: unknown): v is Pair[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((p) => Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number")
  );
}

/** Names an accumulating answer usually goes by. */
const OUTPUT_NAME_RE = /^(res|result|results|merged|output|out|ans|answer)$/;

/**
 * The interval lists in scope: the input under its own name, and the answer
 * being built beneath it when there is one. Nothing is sorted here — a list
 * the author forgot to sort draws unsorted, which is the bug made visible.
 */
export function extractIntervals(
  vars?: Record<string, VariableValue>
): VisualizationStructures["intervalData"] | undefined {
  if (!vars) return undefined;
  const lists = Object.entries(vars).filter(([, v]) => isPairList(v)) as [string, Pair[]][];
  if (lists.length === 0) return undefined;
  const primary =
    lists.find(([n]) => /interval/i.test(n) && !OUTPUT_NAME_RE.test(n)) ??
    lists.find(([n]) => !OUTPUT_NAME_RE.test(n)) ??
    lists[0];
  const secondary = lists.find(([n]) => n !== primary[0] && OUTPUT_NAME_RE.test(n));
  return {
    name: primary[0],
    items: primary[1],
    secondary: secondary ? { name: secondary[0], items: secondary[1] } : undefined,
  };
}

/** Loop indices are positions, not numbers whose bits mean anything. */
const NOT_A_BIT_VALUE = new Set(["i", "j", "k", "idx", "index", "n_bits", "length", "size"]);

/** The integers worth drawing bit by bit, in the order the author holds them. */
export function extractBits(vars?: Record<string, VariableValue>): VisualizationStructures["bitData"] {
  if (!vars) return undefined;
  const out: { name: string; value: number }[] = [];
  for (const [name, v] of Object.entries(vars)) {
    if (typeof v !== "number" || !Number.isInteger(v) || NOT_A_BIT_VALUE.has(name)) continue;
    if (Math.abs(v) >= 2 ** 31) continue;
    out.push({ name, value: v });
    if (out.length === 6) break;
  }
  return out.length > 0 ? out : undefined;
}

/** The modes that have something to draw in this frame. */
function modesWithData(s: VisualizationStructures): VisualizationMode[] {
  const out: VisualizationMode[] = [];
  if (s.arrayData.length > 0) out.push("ARRAY");
  // An empty dict still counts: watching it start empty and fill is the point.
  if ((s.mapsData?.length ?? 0) > 0 || Object.keys(s.mapData).length > 0) out.push("HASH_MAP");
  if (s.listData.length > 0) out.push("LINKED_LIST");
  if (s.treeData.length > 0 || (s.dataTreeData?.length ?? 0) > 0) out.push("TREE");
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

/**
 * The key a membership check looks up, as the map/set draws it: `x in seen`,
 * `x not in seen`, `seen.has(x)`, `x in seen.keys()`. Only a scalar `x` is a
 * key; anything else is not something a row can be.
 */
export function membershipProbe(
  label: string | undefined,
  variables: TimelineFrame["variables"]
): string | undefined {
  if (!label || !variables) return undefined;
  const m =
    label.match(/^\s*(?:not\s+)?([A-Za-z_$][\w$]*)\s+(?:not\s+)?in\s+[A-Za-z_$][\w$.]*(?:\(\))?\s*$/) ??
    label.match(/^\s*!?\s*[A-Za-z_$][\w$.]*\.has\(\s*([A-Za-z_$][\w$]*)\s*\)\s*$/) ??
    label.match(/^\s*!?\s*\(?\s*([A-Za-z_$][\w$]*)\s+in\s+[A-Za-z_$][\w$]*\s*\)?\s*$/);
  if (!m) return undefined;
  const value = variables[m[1]];
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
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
      // The narrator already drew the author's own sets under their names; a
      // variable literally called `set` is only a fallback when it found none.
      const setVar = frame.variables?.set;
      if (Array.isArray(setVar) && (structures.mapsData?.length ?? 0) === 0) {
        structures.mapData = Object.fromEntries(setVar.map((v) => [String(v), "in set"]));
      }
      const resVar = frame.variables?.result;
      if (Array.isArray(resVar)) {
        structures.resultData = resVar as (string | number)[];
      }
      break;
    }

    case "dp_1d":
    case "greedy":
      mode = "ARRAY";
      if (i !== undefined) highlights = [...new Set([...highlights, i])];
      break;

    case "dfs":
    case "bfs":
    case "backtrack":
    case "recursion":
    case "graph":
    case "tree":
    case "trie":
    case "advanced_graph":
      if (structures.treeData.length > 0 || (structures.dataTreeData?.length ?? 0) > 0) mode = "TREE";
      break;

    case "linked_list":
    case "linked_list_cycle":
      if (structures.listData.length > 0) mode = "LINKED_LIST";
      break;

    case "intervals": {
      const intervals = extractIntervals(frame.variables);
      if (intervals) {
        structures.intervalData = intervals;
        // The same pairs would otherwise also draw as a two-column matrix.
        if (structures.gridData?.every((row) => row.length === 2)) structures.gridData = [];
      }
      break;
    }

    case "bit_manipulation": {
      const bits = extractBits(frame.variables);
      if (bits) structures.bitData = bits;
      break;
    }

    default:
      break;
  }

  // `if num in dup` / `seen.has(x)`: the value being looked up lights up in
  // the set or map it is looked up in, whatever the lead technique.
  const probed = membershipProbe(frame.conditionLabel, frame.variables);
  if (probed !== undefined && !highlights.includes(probed)) highlights = [...highlights, probed];

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

function asTechnique(v: unknown): VisualizationTechnique | undefined {
  return typeof v === "string" && ALL_TECHNIQUES.includes(v as VisualizationTechnique)
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
