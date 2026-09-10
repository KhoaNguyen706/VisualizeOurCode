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

/** `heapq.heappush(heap, x)` / `heappush(heap, x)` / `heapify(heap)` — the heap is the first argument. */
export const HEAP_ADD_RE =
  /^(?:heapq\.)?(heappush|heapify|heappushpop|heapreplace)\(\s*([A-Za-z_$][\w$]*)\s*(?:,\s*(.*))?\)\s*$/;

/** `x = heapq.heappop(heap)` / `a, b = heappop(h)` — a take, however it is unpacked. */
export const HEAP_TAKE_RE =
  /^(.+?)\s*=(?!=)\s*(?:heapq\.)?(heappop|heappushpop|heapreplace)\(\s*([A-Za-z_$][\w$]*)\s*(?:,.*)?\)/;

/** A bare `heapq.heappop(heap)` whose result is discarded. */
export const BARE_HEAP_TAKE_RE =
  /^(?:heapq\.)?(heappop)\(\s*([A-Za-z_$][\w$]*)\s*\)\s*$/;

/** What a line adds to a container, in either the method or the heapq style. */
export function matchAdd(src: string): { name: string; verb: string; argText: string } | null {
  const m = src.match(CONTAINER_ADD_RE);
  if (m) return { name: m[1], verb: m[2], argText: m[3] };
  const h = src.match(HEAP_ADD_RE);
  if (h) return { name: h[2], verb: h[1], argText: h[3] ?? "" };
  return null;
}

/** What a line takes from a container, in either style; `targets` is the assignment target text. */
export function matchTake(src: string): { targets: string; name: string; verb: string } | null {
  const m = src.match(CONTAINER_TAKE_RE);
  if (m) return { targets: m[1], name: m[2], verb: m[3] };
  const h = src.match(HEAP_TAKE_RE);
  if (h) return { targets: h[1], name: h[3], verb: h[2] };
  return null;
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

  const taken = matchTake(src);
  if (taken) return { kind: "take", container: taken.name, verb: taken.verb };

  const bare = src.match(BARE_TAKE_RE) ?? src.match(BARE_HEAP_TAKE_RE);
  if (bare) {
    // The method form names the container first; the heapq form names the verb first.
    const isHeap = /heappop/.test(bare[1]);
    return { kind: "take", container: isHeap ? bare[2] : bare[1], verb: isHeap ? bare[1] : bare[2] };
  }

  const added = matchAdd(src);
  if (added) {
    return { kind: "add", container: added.name, verb: added.verb, argText: added.argText };
  }

  const write = src.match(INDEXED_WRITE_RE);
  if (write) return { kind: "write", target: write[1], path: write[2] };

  return OTHER;
}
