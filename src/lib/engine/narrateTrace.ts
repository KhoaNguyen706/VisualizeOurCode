import type {
  ActivePointers,
  ContainerView,
  ListNode,
  NamedMap,
  TimelineFrame,
  TreeNode,
  VariableValue,
  VisualizationMode,
  VisualizationStructures,
} from "@/lib/types";
import { EMPTY_STRUCTURES } from "@/lib/types";
import type { TraceStep } from "./runSandbox";
import {
  CONTAINER_ADD_RE,
  CONTAINER_TAKE_RE,
  INDEXED_WRITE_RE,
} from "./lineEvents";

/**
 * Narrate a trace using only what the code actually did.
 *
 * The template path this replaces authored the sentence first and substituted
 * values into it, so a brute-force nested loop was described with hash-map
 * prose it never ran. Here every message is derived from the author's own
 * source line plus the values that genuinely changed, which means the
 * narration cannot describe an algorithm the author did not write.
 */

const MAX_INLINE_LEN = 60;

function isScalar(v: unknown): v is string | number | boolean | null {
  return v === null || ["string", "number", "boolean"].includes(typeof v);
}

/** Render a value compactly enough to sit inside a sentence. */
export function formatValue(v: unknown): string {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    const inner = v.map(formatValue).join(", ");
    return inner.length > MAX_INLINE_LEN ? `[…${v.length} items]` : `[${inner}]`;
  }
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    const inner = entries.map(([k, val]) => `${k}: ${formatValue(val)}`).join(", ");
    return inner.length > MAX_INLINE_LEN ? `{…${entries.length} keys}` : `{${inner}}`;
  }
  return String(v);
}

const INDEX_ACCESS_RE = /([A-Za-z_$][\w$]*)((?:\[[^\][]+\])+)/g;
const IDENTIFIER_RE = /\b([A-Za-z_$][\w$]*)\b/g;

/** Reserved words and globals that are never variables worth substituting. */
const NOT_A_VALUE = new Set([
  "true", "false", "null", "undefined", "return", "typeof", "instanceof",
  "new", "in", "of", "length", "Math", "JSON", "Object", "Array", "String",
  "Number", "Boolean", "Map", "Set", "Infinity", "NaN",
]);

/**
 * Rewrite an expression with the values it actually held, so
 * `nums[i] + nums[j] === target` reads as `2 + 7 === 9`.
 *
 * Only scalars are inlined — splicing a whole array into the middle of an
 * expression is less readable than leaving its name in place.
 */
export function substituteValues(expr: string, vars: Record<string, unknown>): string {
  // Chained subscripts resolve as a path, so a matrix read like `grid[nr][nc]`
  // becomes the cell's actual value. Handling only one level left the most
  // important operand in a grid problem showing as a name.
  const withIndexes = expr.replace(INDEX_ACCESS_RE, (whole, name: string, path: string) => {
    if (!(name in vars)) return whole;
    const { found, value } = valueAtPath(vars[name], path, vars);
    return found && isScalar(value) ? formatValue(value) : whole;
  });

  return withIndexes.replace(IDENTIFIER_RE, (whole, name: string) => {
    if (NOT_A_VALUE.has(name) || !(name in vars)) return whole;
    const v = vars[name];
    return isScalar(v) ? formatValue(v) : whole;
  });
}

/** Names whose value differs from the previous step. */
function changedNames(curr: Record<string, unknown>, prev?: Record<string, unknown>): string[] {
  if (!prev) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(curr)) {
    if (v === undefined) continue;
    const before = prev[k];
    if (before === undefined && !(k in prev)) {
      out.push(k);
      continue;
    }
    if (JSON.stringify(before) !== JSON.stringify(v)) out.push(k);
  }
  return out;
}

/** `for (const ch of word)` -> `ch`, and Python's `for r in rows:` -> `r` */
const FOR_ITER_BINDING_RE = /^\s*for\s*\(\s*(?:const|let|var)\s+([\w$]+)\s+(?:of|in)\s/;
const PY_FOR_BINDING_RE = /^\s*for\s+([\w$]+(?:\s*,\s*[\w$]+)*)\s+in\s/;

/** `r, c = q.popleft()` / `rows, cols = len(grid), len(grid[0])` */
const TUPLE_TARGETS_RE = /^([\w$]+(?:\s*,\s*[\w$]+)+)\s*=(?!=)/;

/** Human phrasing for the container verbs above. */
const ADD_VERBS: Record<string, string> = {
  append: "Append",
  appendleft: "Add to the front of",
  add: "Add",
  push: "Push",
  put: "Put",
};
const TAKE_PHRASES: Record<string, string> = {
  popleft: "Take from the front of",
  pop: "Take from",
  popitem: "Take an item from",
  shift: "Take from the front of",
  get: "Take from",
  dequeue: "Take from",
};

/**
 * Replace names *inside* subscripts with the values they hold, so
 * `grid[nr][nc]` reads as `grid[2][2]` — the cell the line really wrote.
 * The container's name is deliberately kept; substituting it would splice a
 * whole matrix into the middle of the sentence.
 */
export function substituteIndices(expr: string, vars: Record<string, unknown>): string {
  return expr.replace(/\[([^\][]+)\]/g, (whole, inner: string) => {
    const key = inner.trim();
    if (/^-?\d+$/.test(key)) return whole;
    const v = vars[key];
    return isScalar(v) ? `[${formatValue(v)}]` : whole;
  });
}

/** Follow `[i][j]` from a root value, returning what actually sits there. */
function valueAtPath(
  root: unknown,
  path: string,
  vars: Record<string, unknown>
): { found: boolean; value: unknown } {
  let cur = root;
  for (const m of path.matchAll(/\[([^\][]+)\]/g)) {
    const key = m[1].trim();
    const idx = /^-?\d+$/.test(key) ? Number(key) : vars[key];
    if (cur == null || typeof cur !== "object") return { found: false, value: undefined };
    if (Array.isArray(cur)) {
      if (typeof idx !== "number") return { found: false, value: undefined };
      cur = cur[idx < 0 ? cur.length + idx : idx];
    } else {
      if (typeof idx !== "string" && typeof idx !== "number") return { found: false, value: undefined };
      cur = (cur as Record<string, unknown>)[String(idx)];
    }
  }
  return { found: true, value: cur };
}

function countLabel(v: unknown): string | null {
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`;
  if (v && typeof v === "object") {
    const n = Object.keys(v as object).length;
    return `${n} entr${n === 1 ? "y" : "ies"}`;
  }
  return null;
}

/** `const complement = target - nums[i];` -> `complement` */
const ASSIGNED_NAME_RE =
  /^\s*(?:const|let|var)\s+([\w$]+)|^\s*([\w$]+)\s*(?:[+\-*/%&|^]|\*\*|<<|>>>?|\|\||&&|\?\?)?=(?!=)|^\s*([\w$]+)\s*\[|^\s*(?:\+\+|--)?([\w$]+)(?:\+\+|--)|^\s*([\w$]+)\s*\./;

function assignedName(sourceLine: string): string | null {
  const m = sourceLine.match(ASSIGNED_NAME_RE);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? null;
}

function stripTrailing(line: string): string {
  return line.trim().replace(/[;{]\s*$/, "").trim();
}

function describeChanges(names: string[], vars: Record<string, unknown>, limit = 3): string {
  return names
    .slice(0, limit)
    .map((n) => `${n} = ${formatValue(vars[n])}`)
    .join(", ");
}

function buildMessage(
  step: TraceStep,
  sourceLine: string,
  changed: string[]
): string {
  const vars = step.vars;
  const src = stripTrailing(sourceLine);

  // A `for...of` / `for...in` iteration has no condition — it just advances.
  // Describe the binding it advanced to instead of inventing a verdict.
  if (step.kind === "loop" && step.condLabel === undefined) {
    // A `for` header with no successor inside its body is the pass that found
    // the sequence exhausted, not another iteration.
    if (step.condResult === false) return `${src} — no items left, loop finished`;

    const binding = src.match(FOR_ITER_BINDING_RE)?.[1] ?? src.match(PY_FOR_BINDING_RE)?.[1];
    if (binding) {
      const names = binding.split(",").map((n) => n.trim()).filter((n) => n in vars);
      if (names.length) return `Next loop pass — ${describeChanges(names, vars, names.length)}`;
    }
    return changed.length ? `Next loop pass — ${describeChanges(changed, vars)}` : src;
  }

  if (step.kind === "condition" || step.kind === "loop") {
    const label = step.condLabel ?? src;
    const concrete = substituteValues(substituteIndices(label, vars), vars);
    // Lead with the author's own keyword; a bare `q` reads as nothing at all.
    const keyword = src.match(/^(if|elif|while)\b/)?.[1];
    const written = keyword ? `${keyword} ${label}` : label;
    const shown = concrete === label ? written : `${written}  →  ${concrete}`;

    // condResult is absent on the final recorded step, where there is no
    // following line to read the outcome from. Say nothing rather than guess.
    if (step.condResult === undefined) return keyword ? shown : `Check ${shown}`;

    if (step.kind === "loop") {
      return step.condResult
        ? `${shown} — true, run the loop body`
        : `${shown} — false, leave the loop`;
    }
    return step.condResult
      ? `${shown} — true, take this branch`
      : `${shown} — false, skip this branch`;
  }

  if (step.kind === "return") {
    const expr = src.replace(/^return\s*/, "").trim();
    if (!expr) return "Return";
    // The instrumented `__ret__` captured what the expression evaluated to;
    // fall back to substituting names only when it could not be wrapped.
    if ("returnValue" in step) return `Return ${expr}  →  ${formatValue(step.returnValue)}`;
    const concrete = substituteValues(expr, vars);
    return concrete === expr ? `Return ${expr}` : `Return ${expr}  →  ${concrete}`;
  }

  // Writing through a subscript: report the cell that changed, not the whole
  // container. `grid[nr][nc] = grid[r][c] + 1` printing the entire matrix was
  // the least readable line in the timeline.
  const write = src.match(INDEXED_WRITE_RE);
  if (write) {
    const [, name, path] = write;
    const { found, value } = valueAtPath(vars[name], path, vars);
    if (found && isScalar(value)) {
      return `Set ${name}${substituteIndices(path, vars)} = ${formatValue(value)}`;
    }
  }

  // Growing a container: name the item that went in and how big it is now.
  const added = src.match(CONTAINER_ADD_RE);
  if (added) {
    const [, name, verb, argText] = added;
    const container = vars[name];
    const size = countLabel(container);
    const item =
      Array.isArray(container) && container.length > 0 && verb !== "appendleft"
        ? formatValue(container[container.length - 1])
        : verb === "appendleft" && Array.isArray(container) && container.length > 0
          ? formatValue(container[0])
          : substituteValues(argText, vars);
    return `${ADD_VERBS[verb]} ${item} to ${name}${size ? ` — ${name} now holds ${size}` : ""}`;
  }

  // Taking from a container: lead with the action, then what came out.
  const taken = src.match(CONTAINER_TAKE_RE);
  if (taken) {
    const [, targets, name, verb] = taken;
    const bound = targets
      .split(",")
      .map((t) => t.trim())
      .filter((t) => /^[\w$]+$/.test(t) && t in vars);
    const size = countLabel(vars[name]);
    const got = bound.length ? ` → ${describeChanges(bound, vars, bound.length)}` : "";
    return `${TAKE_PHRASES[verb]} ${name}${got}${size ? ` — ${name} now holds ${size}` : ""}`;
  }

  // A tuple assignment binds several names at once; list them all.
  const tuple = src.match(TUPLE_TARGETS_RE);
  if (tuple) {
    const names = tuple[1].split(",").map((t) => t.trim()).filter((t) => t in vars);
    if (names.length) return describeChanges(names, vars, names.length);
  }

  // Mutation: name what the line wrote, using the value it actually holds now.
  const target = assignedName(sourceLine);
  if (target && target in vars && isScalar(vars[target])) {
    return `${target} = ${formatValue(vars[target])}`;
  }
  if (target && target in vars) {
    const size = countLabel(vars[target]);
    return size ? `${src}  →  ${target} holds ${size}` : `${src}  →  ${target} = ${formatValue(vars[target])}`;
  }
  if (changed.length) {
    return `${src}  →  ${describeChanges(changed, vars)}`;
  }
  return src || `Line ${step.line}`;
}

/**
 * Pick the array to render. Preferring conventional names keeps the common
 * case stable, but any array of scalars works — the author may have named it
 * anything.
 */
function pickArray(
  vars: Record<string, unknown>,
  exclude?: Set<string>
): (number | string)[] | null {
  const scalarArray = (v: unknown): v is (number | string)[] =>
    Array.isArray(v) && v.every((x) => typeof x === "number" || typeof x === "string");

  for (const key of ["nums", "arr", "array", "items", "candidates", "list", "data"]) {
    if (exclude?.has(key)) continue;
    if (scalarArray(vars[key])) return vars[key] as (number | string)[];
  }
  for (const [k, v] of Object.entries(vars)) {
    if (exclude?.has(k)) continue;
    if (scalarArray(v)) return v;
  }
  // A string is the array in half of the string problems — two pointers over a
  // palindrome, a window over a substring — so it is spelled out as characters
  // to give the pointers cells to stand on. Only when there *are* indices,
  // though: a `for ch in word` never moves a pointer, and drawing the word as
  // a row that never changes would make the condenser fold the whole loop into
  // one beat. Parameters snapshot first, so the input string wins over a
  // one-character loop variable.
  const indexed = INDEX_NAMES.some((k) => Number.isInteger(vars[k]));
  if (!indexed) return null;
  for (const [k, v] of Object.entries(vars)) {
    if (exclude?.has(k)) continue;
    if (typeof v === "string" && v.length >= 2 && v.length <= 80) return [...v];
  }
  return null;
}

/** Names that read as a position in a sequence, per `inferHighlights`. */
const INDEX_NAMES = ["i", "j", "k", "left", "right", "lo", "hi", "low", "high", "start", "end", "mid"];

/** Conventional names, checked first so the common case keeps a stable order. */
const PREFERRED_MAP_NAMES = ["seen", "map", "counts", "freq", "lookup", "cache", "memo"];

/** Keys that mark an object as a list/tree node rather than a value map. */
const NODE_KEYS = ["next", "children", "left", "right"];

/**
 * The method receiver. On a LeetCode `class Solution`, `self` snapshots as an
 * empty object, and treating it as a map made it the primary one — so the
 * canvas rendered an empty table and the author's real dicts went undrawn.
 */
const NEVER_A_MAP = new Set(["self", "cls"]);

function isPlainMap(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  // A linked-list or tree node is an object too, but it is drawn as a node —
  // rendering it as a key/value table would show the same thing twice, wrongly.
  return !NODE_KEYS.some((k) => k in (v as object));
}

/** Keep only the entries a key/value row can actually show. */
function scalarEntries(v: Record<string, unknown>): Record<string, number | string> {
  return Object.fromEntries(
    Object.entries(v).filter(([, x]) => typeof x === "number" || typeof x === "string")
  ) as Record<string, number | string>;
}

/**
 * Find every dict the code is building.
 *
 * The previous version matched seven hard-coded names, so a counting solution
 * that called its dicts `dic_s` and `dic_t` rendered an empty canvas — the tool
 * quietly refused to draw the author's own work because they had not used the
 * expected words. Any plain object of scalars now qualifies, whatever it was
 * named, and all of them are returned so two can be compared side by side.
 */
function pickMaps(vars: Record<string, unknown>, exclude?: Set<string>): NamedMap[] {
  const out: NamedMap[] = [];
  const taken = new Set<string>();

  const consider = (name: string) => {
    if (taken.has(name) || exclude?.has(name) || NEVER_A_MAP.has(name)) return;
    const v = vars[name];
    if (!isPlainMap(v)) return;
    const data = scalarEntries(v);
    // An object with no scalar entries at all is some other structure; an empty
    // dict is kept, since watching it fill up is the point.
    if (Object.keys(v).length > 0 && Object.keys(data).length === 0) return;
    taken.add(name);
    out.push({ name, data });
  };

  for (const key of PREFERRED_MAP_NAMES) consider(key);
  for (const key of Object.keys(vars)) consider(key);

  return out.slice(0, 3);
}

function linkedListToLinear(head: unknown): ListNode[] {
  const nodes: ListNode[] = [];
  let current = head as { value?: number | string; val?: number | string; next?: unknown } | null;
  let id = 0;
  while (current && typeof current === "object") {
    const nodeId = `n${id++}`;
    nodes.push({
      id: nodeId,
      value: current.value ?? current.val ?? "?",
      next: current.next ? `n${id}` : null,
    });
    current = current.next as typeof current;
    if (id > 50) break;
  }
  return nodes;
}

const CONTAINER_USE_RE =
  /\b([A-Za-z_$][\w$]*)\.(append|appendleft|add|push|put|popleft|pop|shift|dequeue)\s*\(/g;

const TAKE_VERBS = new Set(["popleft", "pop", "shift", "dequeue"]);
const ADD_VERBS_SET = new Set(["append", "appendleft", "add", "push", "put"]);

/**
 * Find the collection a traversal drives itself from, by reading which verbs
 * the author used on it.
 *
 * Only names that are both added to *and* taken from qualify. A list that is
 * only appended to is an output accumulating, not a frontier being worked
 * through, and drawing it as a queue would imply a traversal that isn't there.
 */
export function detectContainers(sourceCode: string): Map<string, ContainerView["kind"]> {
  const verbs = new Map<string, Set<string>>();
  for (const line of sourceCode.split("\n")) {
    for (const m of line.matchAll(CONTAINER_USE_RE)) {
      const [, name, verb] = m;
      if (!verbs.has(name)) verbs.set(name, new Set());
      verbs.get(name)!.add(verb);
    }
  }

  const out = new Map<string, ContainerView["kind"]>();
  for (const [name, used] of verbs) {
    const takes = [...used].some((v) => TAKE_VERBS.has(v));
    const adds = [...used].some((v) => ADD_VERBS_SET.has(v));
    if (!takes || !adds) continue;

    // `popleft`/`shift` take from the head while adds go to the tail — that is
    // a queue however it was declared. A bare `pop()` takes from the tail, so
    // the same end is used for both: a stack.
    if (used.has("popleft") || used.has("shift") || used.has("dequeue")) out.set(name, "queue");
    else if (used.has("add")) out.set(name, "set");
    else out.set(name, "stack");
  }
  return out;
}

function inferContainer(
  vars: Record<string, unknown>,
  containers: Map<string, ContainerView["kind"]>
): ContainerView | undefined {
  for (const [name, kind] of containers) {
    const v = vars[name];
    if (!Array.isArray(v)) continue;
    return { name, kind, items: v.slice(0, 40).map(formatValue) };
  }
  return undefined;
}

function inferStructures(
  vars: Record<string, unknown>,
  containers: Map<string, ContainerView["kind"]> = new Map()
): VisualizationStructures {
  const structures: VisualizationStructures = { ...EMPTY_STRUCTURES };

  const container = inferContainer(vars, containers);
  if (container) structures.containerData = container;

  // The frontier is drawn as its own row; letting it also win `pickArray` would
  // put the same values on screen twice, in two different shapes.
  const arr = pickArray(vars, container ? new Set([container.name]) : undefined);
  if (arr) structures.arrayData = arr;

  const maps = pickMaps(vars, container ? new Set([container.name]) : undefined);
  if (maps.length > 0) {
    structures.mapsData = maps;
    // Prefer one with contents: a dict declared before the loop that fills it
    // is empty for the first few steps, and picking it would drop the mode back
    // to ARRAY and blank the canvas exactly when there is something to show.
    const primary = maps.find((m) => Object.keys(m.data).length > 0) ?? maps[0];
    structures.mapData = primary.data;
  }

  for (const key of ["head", "node", "current", "root"]) {
    const v = vars[key];
    if (v && typeof v === "object" && "next" in (v as object)) {
      structures.listData = linkedListToLinear(v);
      break;
    }
  }

  // A table has several rows of one length. A ragged list of lists — or a
  // single collected result — is the combinations a backtracker gathered, and
  // drawing that as a matrix with a magnitude ramp misreads it. A name that
  // says "table" is trusted even at one row.
  const gridEntry = Object.entries(vars).find(([name, v]) => isTable(name, v));
  if (gridEntry) structures.gridData = gridEntry[1] as (number | string)[][];

  return structures;
}

const TABLE_NAME_RE = /grid|dp|matrix|board|table|memo|cache|mat/i;

function isTable(name: string, v: unknown): boolean {
  if (!Array.isArray(v) || v.length === 0) return false;
  const width = Array.isArray(v[0]) ? (v[0] as unknown[]).length : -1;
  if (width < 0) return false;
  const rectangular = v.every(
    (row) =>
      Array.isArray(row) &&
      row.length === width &&
      row.every((c) => typeof c === "number" || typeof c === "string")
  );
  return rectangular && (v.length >= 2 || TABLE_NAME_RE.test(name));
}

function inferPointers(vars: Record<string, unknown>): ActivePointers {
  const pointers: ActivePointers = {};
  for (const [k, v] of Object.entries(vars)) {
    if (typeof v === "number" && Number.isInteger(v) && k.length <= 12) {
      pointers[k] = v;
    }
  }
  return pointers;
}

/** Only indices that actually address the rendered array should light up. */
function inferHighlights(vars: Record<string, unknown>, arrayLength: number): (string | number)[] {
  const out: number[] = [];
  for (const key of ["i", "j", "k", "left", "right", "lo", "hi", "start", "end", "mid"]) {
    const v = vars[key];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < arrayLength) out.push(v);
  }
  return [...new Set(out)];
}

function toVariables(vars: Record<string, unknown>): Record<string, VariableValue> {
  const out: Record<string, VariableValue> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) continue;
    if (isScalar(v)) {
      out[k] = v;
    } else if (Array.isArray(v) && v.every(isScalar)) {
      out[k] = v as VariableValue;
    } else if (Array.isArray(v) && v.every((row) => Array.isArray(row) && row.every(isScalar))) {
      out[k] = v as VariableValue;
    } else if (isPlainMap(v)) {
      // Dicts were dropped here, so a counting solution's own tables never
      // reached the panel — the author saw their loop variable and nothing else.
      const entries = Object.entries(v).filter(([, x]) => isScalar(x));
      if (entries.length > 0 || Object.keys(v).length === 0) {
        out[k] = Object.fromEntries(entries) as VariableValue;
      }
    }
  }
  return out;
}

function pickMode(structures: VisualizationStructures): VisualizationMode {
  if (structures.listData.length > 0) return "LINKED_LIST";
  // Keyed off the maps existing, not off one of them having entries yet —
  // otherwise a dict shows nothing until its first insert, and the author
  // cannot see it start empty and fill.
  if ((structures.mapsData?.length ?? 0) > 0) return "HASH_MAP";
  if (Object.keys(structures.mapData).length > 0) return "HASH_MAP";
  return "ARRAY";
}

/** `"r,c"` keys whose value differs between two rendered grids. */
function diffGrid(
  prev: (number | string)[][] | undefined,
  curr: (number | string)[][] | undefined
): string[] {
  if (!prev?.length || !curr?.length) return [];
  const out: string[] = [];
  for (let r = 0; r < curr.length; r += 1) {
    for (let c = 0; c < curr[r].length; c += 1) {
      if (prev[r]?.[c] !== curr[r][c]) out.push(`${r},${c}`);
    }
  }
  // A wholesale change means a different array is being rendered, not an edit.
  return out.length === curr.length * (curr[0]?.length ?? 0) ? [] : out;
}

function diffArray(
  prev: (number | string)[] | undefined,
  curr: (number | string)[]
): number[] {
  if (!prev?.length || !curr.length || prev.length !== curr.length) return [];
  const out: number[] = [];
  for (let i = 0; i < curr.length; i += 1) if (prev[i] !== curr[i]) out.push(i);
  return out;
}

/** One call in the tree the trace revealed. */
interface CallRecord {
  id: number;
  parent?: number;
  fn: string;
  args: Record<string, unknown>;
  children: number[];
  returned?: string;
  done: boolean;
}

/**
 * Whether some call has an ancestor by the same name — the shape a call tree
 * explains better than a list of steps. A helper called from a loop is not
 * that, and fifty leaf nodes under one root would add noise, not insight.
 */
export function hasRecursion(steps: TraceStep[]): boolean {
  const calls = new Map<number, { fn?: string; parent?: number }>();
  for (const s of steps) {
    if (s.callId !== undefined && !calls.has(s.callId)) {
      calls.set(s.callId, { fn: s.fnName, parent: s.parentCallId });
    }
  }
  for (const call of calls.values()) {
    let up = call.parent;
    while (up !== undefined) {
      const ancestor = calls.get(up);
      if (!ancestor) break;
      if (ancestor.fn === call.fn) return true;
      up = ancestor.parent;
    }
  }
  return false;
}

/** `fn(args)`, each argument kept to a few characters so the node stays a node. */
function callLabel(fn: string, args: Record<string, unknown>): string {
  const parts = Object.values(args).map((v) => {
    const text = formatValue(v);
    if (text.length <= 14) return text;
    return Array.isArray(v) ? `[…${v.length}]` : `${text.slice(0, 12)}…`;
  });
  return `${fn}(${parts.join(", ")})`;
}

/**
 * The tree of calls, grown one step at a time. A frame's tree is the tree as
 * it stood after that step, with the running call marked — so the descent and
 * the unwinding are both there to watch, and a call that never returns (the
 * budget cut it, it threw) simply stays open.
 */
class CallTree {
  private calls = new Map<number, CallRecord>();
  private order: number[] = [];
  private active: number | undefined;

  /** Register the step's call — a new id becomes a node — and note returns. */
  observe(step: TraceStep): void {
    if (step.callId === undefined) return;

    // Control came back up: every call between the last active one and this
    // one has finished, whether it returned, fell off the end or threw.
    if (this.active !== undefined && this.active !== step.callId) {
      const left: number[] = [];
      let up: number | undefined = this.active;
      while (up !== undefined && up !== step.callId) {
        left.push(up);
        up = this.calls.get(up)?.parent;
      }
      if (up === step.callId) {
        for (const id of left) {
          const call = this.calls.get(id);
          if (call) call.done = true;
        }
      }
    }

    let call = this.calls.get(step.callId);
    if (!call) {
      call = {
        id: step.callId,
        parent: step.parentCallId,
        fn: step.fnName ?? "call",
        args: step.args ?? {},
        children: [],
        done: false,
      };
      this.calls.set(call.id, call);
      this.order.push(call.id);
      if (call.parent !== undefined) this.calls.get(call.parent)?.children.push(call.id);
    }
    if ("returnValue" in step) {
      call.returned = formatValue(step.returnValue);
      if (step.kind === "return") call.done = true;
    }
    this.active = step.callId;
  }

  /** The tree as it stands now, oldest call first. */
  snapshot(): TreeNode[] {
    return this.order.map((id) => {
      const c = this.calls.get(id)!;
      return {
        id: `call-${c.id}`,
        value: callLabel(c.fn, c.args),
        children: c.children.map((ch) => `call-${ch}`),
        parent: c.parent !== undefined ? `call-${c.parent}` : null,
        note: c.returned !== undefined ? `→ ${c.returned}` : undefined,
        done: c.done,
      };
    });
  }

  /** Node ids from the root down to `callId` — the live recursion path. */
  pathTo(callId: number | undefined): string[] {
    const out: string[] = [];
    let up = callId;
    while (up !== undefined) {
      out.push(`call-${up}`);
      up = this.calls.get(up)?.parent;
    }
    return out.reverse();
  }
}

/** Point at the running call; the author's own `depth` variable, if any, wins. */
function withCallPointers(
  pointers: ActivePointers,
  step: TraceStep,
  tree: CallTree | null
): ActivePointers {
  if (!tree || step.callId === undefined) return pointers;
  const out = { ...pointers };
  if (out.current === undefined) out.current = `call-${step.callId}`;
  if (out.depth === undefined && step.depth !== undefined) out.depth = step.depth;
  return out;
}

export interface NarrateOptions {
  /** Appended as a final frame when the run was cut short by a budget. */
  haltedNote?: string;
}

/**
 * Turn a raw execution trace into timeline frames described in the author's
 * own terms. `sourceCode` is the original (uninstrumented) code, used to quote
 * the line each step came from.
 */
export function narrateTrace(
  traceHistory: TraceStep[],
  sourceCode: string,
  options: NarrateOptions = {}
): TimelineFrame[] {
  const sourceLines = sourceCode.split("\n");
  const containers = detectContainers(sourceCode);
  const tree = hasRecursion(traceHistory) ? new CallTree() : null;

  let prevStructures: VisualizationStructures | null = null;

  const frames: TimelineFrame[] = traceHistory.map((step, index) => {
    const sourceLine = sourceLines[step.line - 1] ?? "";
    const changed = changedNames(step.vars, traceHistory[index - 1]?.vars);
    const structures = inferStructures(step.vars, containers);
    if (tree) {
      tree.observe(step);
      structures.treeData = tree.snapshot();
    }
    const isCondition = step.kind === "condition" || step.kind === "loop";

    // Diff the rendered structures, not just the variables: a write through a
    // subscript mutates the container in place, so the name never "changes"
    // while the cell on screen very much does.
    const changedCells = diffGrid(prevStructures?.gridData, structures.gridData);
    const changedIndices = diffArray(prevStructures?.arrayData, structures.arrayData);
    prevStructures = structures;

    return {
      changedVariables: changed,
      changedCells,
      changedIndices,
      step: index,
      mode: pickMode(structures),
      structures,
      activePointers: withCallPointers(inferPointers(step.vars), step, tree),
      highlightedElements: [
        ...inferHighlights(step.vars, structures.arrayData.length),
        ...(tree?.pathTo(step.callId) ?? []),
      ],
      statusType: step.kind === "return" ? "SUCCESS" : "EXPLORE",
      message: buildMessage(step, sourceLine, changed),
      variables: toVariables(step.vars),
      conditionMet: isCondition ? step.condResult : undefined,
      conditionLabel: isCondition ? step.condLabel : undefined,
      sourceLine: step.line,
    } satisfies TimelineFrame;
  });

  if (options.haltedNote && frames.length > 0) {
    const last = frames[frames.length - 1];
    frames.push({
      ...last,
      step: frames.length,
      statusType: "FAIL",
      message: options.haltedNote,
      conditionMet: undefined,
      conditionLabel: undefined,
    });
  }

  return frames;
}
