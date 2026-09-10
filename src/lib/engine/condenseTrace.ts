import type { ContainerView, TimelineFrame } from "@/lib/types";
import type { TraceStep } from "./runSandbox";
import { classifyLine, type LineEvent } from "./lineEvents";
import { formatValue } from "./narrateTrace";

/**
 * Collapse a line-by-line trace into *beats* — one entry per thing the viewer
 * can actually see change.
 *
 * A raw trace is a debugger: a 3x3 BFS emits ~180 steps, and the handful that
 * matter (visit a cell, queue its neighbours) are buried under bounds checks
 * and `nr, nc = r + dr, c + dc`. Watching that is reading, not seeing.
 *
 * A beat is anchored on the line that causes a visible change and absorbs the
 * bookkeeping around it. Nothing is invented and nothing is reordered — every
 * beat is still a contiguous run of the author's own execution, so a wrong
 * solution still animates wrongly. Only the granularity changes.
 */

/** Names that render as an arrow over the array, per `inferHighlights`. */
const RENDERED_POINTERS = ["i", "j", "k", "left", "right", "lo", "hi", "start", "end", "mid"];

/**
 * Everything the canvas draws, as a comparable string. Two frames with the same
 * signature look identical on screen, so there is nothing to animate between
 * them and no reason to spend a beat.
 */
function visibleSignature(f: TimelineFrame): string {
  const s = f.structures;
  return JSON.stringify([
    s.arrayData,
    s.gridData ?? null,
    s.mapData,
    s.listData.map((n) => [n.id, n.value, n.next]),
    s.treeData.map((n) => [n.id, n.note ?? null, n.done ?? false]),
    s.resultData ?? null,
    s.containerData ?? null,
    f.highlightedElements,
    RENDERED_POINTERS.map((p) => f.activePointers[p] ?? null),
  ]);
}

/**
 * Whether this frame draws anything at all.
 *
 * Plenty of real solutions work only over scalars and a string — counting
 * vowels, accumulating a sum. There is no structure to animate, so the
 * narration carries the whole story and folding it would leave the viewer with
 * two beats and no sense of the loop running.
 */
function hasDrawableState(f: TimelineFrame): boolean {
  const s = f.structures;
  return (
    s.arrayData.length > 0 ||
    (s.gridData?.length ?? 0) > 0 ||
    Object.keys(s.mapData).length > 0 ||
    s.listData.length > 0 ||
    s.treeData.length > 0 ||
    (s.resultData?.length ?? 0) > 0 ||
    s.containerData !== undefined
  );
}

/** The item a container-add put in, read from the container after the line ran. */
function addedItem(step: TraceStep, e: LineEvent): string | null {
  const c = step.vars[e.container ?? ""];
  if (!Array.isArray(c) || c.length === 0) return null;
  return formatValue(e.verb === "appendleft" ? c[0] : c[c.length - 1]);
}

/**
 * The trailing size note on a take message: the adds folded into the same beat
 * change that size again, so quoting it mid-sentence would contradict the
 * container drawn beside it.
 */
const SIZE_TAIL_RE = /\s+—\s+[\w$]+ now holds .*$/;

/**
 * Word the folded adds the way the author's container is actually used. Items
 * going back into the same collection they were taken from are the traversal
 * feeding itself, and a stack fed at the end it reads from is a push, not a
 * queue — saying "queue" there would describe the wrong traversal order.
 */
function addPhrase(
  verb: string | undefined,
  kind: ContainerView["kind"] | undefined
): string {
  if (kind === "queue") return "queue";
  if (kind === "stack") return "push";
  if (kind === "set") return "record";
  if (kind === "heap") return "push";
  switch (verb) {
    case "push":
      return "push";
    case "appendleft":
      return "add to the front";
    case "add":
      return "record";
    default:
      return "add";
  }
}

interface Beat {
  start: number;
  /** Exclusive. */
  end: number;
}

function isScalarValue(v: unknown): boolean {
  return typeof v === "number" || typeof v === "string" || typeof v === "boolean";
}

/** `"r,c"` keys whose value differs between two grids. */
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

function changedNames(
  curr: Record<string, unknown>,
  prev?: Record<string, unknown>
): string[] {
  if (!prev) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(curr)) {
    if (v === undefined) continue;
    if (!(k in prev)) {
      out.push(k);
      continue;
    }
    if (JSON.stringify(prev[k]) !== JSON.stringify(v)) out.push(k);
  }
  return out;
}

/**
 * Decide where each beat begins.
 *
 * A `take` (pop/dequeue), a `write` into a cell, and a `return` always open a
 * beat — they are the moments an algorithm advances. An `add` opens one only
 * when the beat has no `take` yet: in BFS the enqueues are the *consequence* of
 * the visit and belong with it, but in backtracking, where results are appended
 * with nothing ever popped, each append is its own moment. Anything else opens
 * a beat only if it moved something the canvas draws.
 */
export function planBeats(
  frames: TimelineFrame[],
  steps: TraceStep[],
  sourceCode: string
): Beat[] {
  const lines = sourceCode.split("\n");
  const n = Math.min(frames.length, steps.length);
  if (n === 0) return [];

  const events = Array.from({ length: n }, (_, i) =>
    classifyLine(lines[steps[i].line - 1] ?? "", steps[i].kind)
  );

  const starts: number[] = [0];
  const isMove = (kind: LineEvent["kind"]) => kind === "take" || kind === "write" || kind === "add";
  let beatHasTake = events[0].kind === "take";
  // A beat with no take, write or add in it yet is "quiet": bookkeeping only.
  let beatQuiet = !isMove(events[0].kind);

  for (let i = 1; i < n; i += 1) {
    const e = events[i];
    let salient: boolean;

    if (e.kind === "take" || e.kind === "write" || e.kind === "return") {
      salient = true;
    } else if (e.kind === "add") {
      salient = !beatHasTake;
    } else if (steps[i].kind === "condition" && steps[i].condResult === true && beatQuiet) {
      // Taking a branch is a decision the reader has to see made — folding
      // "2 in seen → true" into the loop check hid the moment Two Sum found
      // its answer. Inside a visit (a beat that already took or wrote
      // something) the bounds checks are that visit's own bookkeeping and
      // stay folded, and a skipped branch stays folded: nothing happened.
      salient = true;
    } else {
      salient = visibleSignature(frames[i]) !== visibleSignature(frames[i - 1]);
      // Nothing on the canvas to carry this one, so let any real change through.
      if (!salient && !hasDrawableState(frames[i])) {
        salient = (frames[i].changedVariables?.length ?? 0) > 0;
      }
      // A number the reader is watching changed while nothing was being
      // visited or written — `s += n`, `complement = target - num`. That is
      // the whole event of a scalar loop, and folding it left a sum over three
      // numbers with two beats. Inside a visit it stays bookkeeping.
      if (!salient && beatQuiet) {
        const changed = frames[i].changedVariables ?? [];
        salient = changed.some((name) => isScalarValue(steps[i].vars[name]));
      }
    }

    if (salient) {
      starts.push(i);
      beatHasTake = e.kind === "take";
      beatQuiet = !isMove(e.kind);
    } else if (isMove(e.kind)) {
      beatQuiet = false;
    }
  }

  return starts.map((start, idx) => ({
    start,
    end: idx + 1 < starts.length ? starts[idx + 1] : n,
  }));
}

/**
 * Narrate one beat: keep the anchor line's own wording, then name what the
 * folded container-adds put in. The result reads as a single move ("visit this
 * cell, queue those two") instead of six mechanical lines.
 */
function beatMessage(
  beat: Beat,
  frames: TimelineFrame[],
  steps: TraceStep[],
  events: LineEvent[]
): string {
  const anchor = events[beat.start];
  const head = frames[beat.start].message;
  if (anchor.kind !== "take") return head;

  const items: string[] = [];
  let verb: string | undefined;
  let sameContainer = false;

  for (let i = beat.start + 1; i < beat.end; i += 1) {
    if (events[i].kind !== "add") continue;
    const item = addedItem(steps[i], events[i]);
    if (!item) continue;
    items.push(item);
    verb = events[i].verb;
    if (events[i].container === anchor.container) sameContainer = true;
  }

  if (items.length === 0) return head;

  const drawn = frames[beat.end - 1].structures.containerData;
  const kind = sameContainer && drawn && drawn.name === anchor.container ? drawn.kind : undefined;
  const shown = items.length > 4 ? `${items.slice(0, 4).join(", ")} +${items.length - 4} more` : items.join(", ");
  return `${head.replace(SIZE_TAIL_RE, "")} — then ${addPhrase(verb, kind)} ${shown}`;
}

/**
 * Turn narrated line-frames into beat-frames.
 *
 * `frames` and `steps` are the parallel outputs of one run; a trailing halt or
 * error frame appended by the narrator has no matching step and is passed
 * through untouched, since it is already a single meaningful beat.
 */
export function condenseTrace(
  frames: TimelineFrame[],
  steps: TraceStep[],
  sourceCode: string,
  options: { everyLine?: boolean } = {}
): TimelineFrame[] {
  const n = Math.min(frames.length, steps.length);
  if (n === 0) return frames;

  const lines = sourceCode.split("\n");
  const events = Array.from({ length: n }, (_, i) =>
    classifyLine(lines[steps[i].line - 1] ?? "", steps[i].kind)
  );
  // "Every line" keeps one frame per recorded line — the debugger view — but
  // still runs through here so each frame carries the same change markers.
  const beats = options.everyLine
    ? Array.from({ length: n }, (_, i) => ({ start: i, end: i + 1 }))
    : planBeats(frames, steps, sourceCode);

  const out: TimelineFrame[] = [];
  let prev: TimelineFrame | null = null;
  let prevVars: Record<string, unknown> | undefined;

  for (const beat of beats) {
    // Render the state as it stands at the *end* of the beat, so the enqueues
    // folded into a visit are already on screen, but attribute it to the line
    // that made the beat worth showing.
    const last = frames[beat.end - 1];
    const anchor = frames[beat.start];

    const covered: number[] = [];
    for (let i = beat.start; i < beat.end; i += 1) {
      const ln = steps[i].line;
      if (!covered.includes(ln)) covered.push(ln);
    }

    const frame: TimelineFrame = {
      ...last,
      step: out.length,
      sourceLine: anchor.sourceLine,
      coveredLines: covered,
      statusType: anchor.statusType,
      message: beatMessage(beat, frames, steps, events),
      conditionMet: anchor.conditionMet,
      conditionLabel: anchor.conditionLabel,
      // Diff against the previous *beat*, not the previous line — otherwise a
      // cell filled early in the beat has already stopped being "new" by the
      // time the beat is drawn, and never pulses.
      changedCells: diffGrid(prev?.structures.gridData, last.structures.gridData),
      changedIndices: diffArray(prev?.structures.arrayData, last.structures.arrayData),
      changedVariables: changedNames(steps[beat.end - 1].vars, prevVars),
    };

    out.push(frame);
    prev = last;
    prevVars = steps[beat.end - 1].vars;
  }

  // Anything the narrator appended past the raw steps (the halt / error note).
  for (let i = n; i < frames.length; i += 1) {
    out.push({ ...frames[i], step: out.length });
  }

  return out;
}
