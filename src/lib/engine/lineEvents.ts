/**
 * Classify a single source line by what it *does to visible state*.
 *
 * The narrator uses this to word a step; the condenser uses it to decide where
 * one beat ends and the next begins. Keeping the patterns in one place means a
 * line can never be described as an enqueue by one and a bookkeeping line by
 * the other.
 */

/** `grid[nr][nc] = grid[r][c] + 1` -> target `grid`, path `[nr][nc]` */
export const INDEXED_WRITE_RE = /^([A-Za-z_$][\w$]*)((?:\[[^\][]+\])+)\s*=(?!=)\s*(.+)$/;

/** `q.append((nr, nc))` / `seen.add(x)` / `stack.push(v)` */
export const CONTAINER_ADD_RE =
  /^([A-Za-z_$][\w$]*)\.(append|appendleft|add|push|put)\s*\((.*)\)\s*$/;

/** `r, c = q.popleft()` — a take-from-container, however it is unpacked. */
export const CONTAINER_TAKE_RE =
  /^(.+?)\s*=(?!=)\s*([A-Za-z_$][\w$]*)\.(popleft|pop|popitem|shift|get|dequeue)\s*\(/;

/** A bare `q.pop()` / `stack.pop()` whose result is discarded. */
export const BARE_TAKE_RE =
  /^([A-Za-z_$][\w$]*)\.(popleft|pop|popitem|shift|dequeue)\s*\(\s*\)\s*$/;

/**
 * What a line does, ranked by how much it matters to someone watching the
 * animation rather than reading the code.
 *
 * - `take`  — removes from a container: the "visit this next" moment.
 * - `write` — stores into a cell: the moment a DP table or array fills in.
 * - `add`   — puts into a container: usually the consequence of a `take`.
 * - `return`— the answer.
 * - `other` — bookkeeping the viewer does not need a beat for.
 */
export type LineEventKind = "take" | "write" | "add" | "return" | "other";

export interface LineEvent {
  kind: LineEventKind;
  /** Container name for `take` / `add`. */
  container?: string;
  /** The author's own verb (`append`, `popleft`, …). */
  verb?: string;
  /** Assignment target for `write`. */
  target?: string;
  /** Subscript path for `write`, e.g. `[i][j]`. */
  path?: string;
  /** Raw argument text for `add`. */
  argText?: string;
}

const OTHER: LineEvent = { kind: "other" };

export function stripTrailing(line: string): string {
  return line.trim().replace(/[;{]\s*$/, "").trim();
}

/**
 * Classify a raw source line. `traceKind` is the sandbox's own label for the
 * step, which is authoritative for returns and conditions — a line reading
 * `return dp[i][j]` is a return, not a write.
 */
export function classifyLine(sourceLine: string, traceKind?: string): LineEvent {
  const src = stripTrailing(sourceLine);
  if (!src) return OTHER;

  if (traceKind === "return" || /^return\b/.test(src)) return { kind: "return" };

  // A condition is never a state change, however it is written. Checking this
  // before the write patterns stops `if seen[x] == 1:` reading as an assignment.
  if (traceKind === "condition" || traceKind === "loop") return OTHER;

  const taken = src.match(CONTAINER_TAKE_RE);
  if (taken) return { kind: "take", container: taken[2], verb: taken[3] };

  const bare = src.match(BARE_TAKE_RE);
  if (bare) return { kind: "take", container: bare[1], verb: bare[2] };

  const added = src.match(CONTAINER_ADD_RE);
  if (added) {
    return { kind: "add", container: added[1], verb: added[2], argText: added[3] };
  }

  const write = src.match(INDEXED_WRITE_RE);
  if (write) return { kind: "write", target: write[1], path: write[2] };

  return OTHER;
}
