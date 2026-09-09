import { describe, expect, it } from "vitest";
import { condenseTrace } from "./condenseTrace";
import { narrateTrace, detectContainers } from "./narrateTrace";
import type { TraceStep } from "./runSandbox";

/** Narrate then condense, the way `analyzeLocally` does. */
function run(source: string, steps: TraceStep[]) {
  return condenseTrace(narrateTrace(steps, source), steps, source);
}

const BFS_SOURCE = [
  "def bfs(grid):",
  "    q = deque([(0, 0)])",
  "    seen = set()",
  "    while q:",
  "        r, c = q.popleft()",
  "        nr, nc = r + 1, c",
  "        if nr < 3:",
  "            q.append((nr, nc))",
  "        nr2, nc2 = r, c + 1",
  "        if nc2 < 3:",
  "            q.append((nr2, nc2))",
  "    return seen",
].join("\n");

/** One BFS iteration: pop, compute, guard, enqueue, compute, guard, enqueue. */
function bfsIteration(base: number, popped: number[][], after: number[][]): TraceStep[] {
  return [
    { line: 5, kind: "mutation", vars: { q: after.slice(0, 0), r: base, c: 0 } },
    { line: 6, kind: "mutation", vars: { q: [], r: base, c: 0, nr: base + 1, nc: 0 } },
    { line: 7, kind: "condition", condResult: true, condLabel: "nr < 3", vars: { q: [], nr: base + 1 } },
    { line: 8, kind: "mutation", vars: { q: [[base + 1, 0]], nr: base + 1 } },
    { line: 9, kind: "mutation", vars: { q: [[base + 1, 0]], nr2: base } },
    { line: 10, kind: "condition", condResult: true, condLabel: "nc2 < 3", vars: { q: [[base + 1, 0]] } },
    { line: 11, kind: "mutation", vars: { q: after } },
  ].map((s) => ({ ...s, vars: { ...s.vars, popped } })) as TraceStep[];
}

describe("condenseTrace", () => {
  it("folds a BFS iteration into a single beat", () => {
    const steps = [
      ...bfsIteration(0, [[0, 0]], [[1, 0], [0, 1]]),
      ...bfsIteration(1, [[1, 0]], [[2, 0], [1, 1]]),
    ];
    const beats = run(BFS_SOURCE, steps);

    // Two pops -> two beats, not fourteen lines.
    expect(beats).toHaveLength(2);
    expect(steps.length).toBe(14);
  });

  it("names the items the folded enqueues put in", () => {
    const beats = run(BFS_SOURCE, bfsIteration(0, [[0, 0]], [[1, 0], [0, 1]]));
    // The enqueued pairs are quoted, so the beat says what it queued.
    expect(beats[0].message).toContain("[0, 1]");
    expect(beats[0].message).toMatch(/then queue/);
  });

  it("says push, not queue, when the container is a stack", () => {
    const source = [
      "def dfs(grid):",
      "    stack = [(0, 0)]",
      "    while stack:",
      "        r, c = stack.pop()",
      "        stack.append((r + 1, c))",
      "    return stack",
    ].join("\n");
    const steps: TraceStep[] = [
      { line: 4, kind: "mutation", vars: { stack: [], r: 0, c: 0 } },
      { line: 5, kind: "mutation", vars: { stack: [[1, 0]], r: 0, c: 0 } },
    ];
    // Calling a LIFO pop-and-push a "queue" would describe the wrong order.
    const [beat] = run(source, steps);
    expect(beat.message).toMatch(/then push/);
    expect(beat.message).not.toMatch(/then queue/);
  });

  it("anchors the beat on the line that caused it, not the last line folded", () => {
    const beats = run(BFS_SOURCE, bfsIteration(0, [[0, 0]], [[1, 0], [0, 1]]));
    expect(beats[0].sourceLine).toBe(5); // the popleft
    expect(beats[0].coveredLines).toEqual([5, 6, 7, 8, 9, 10, 11]);
  });

  it("shows the state as it stands at the end of the beat", () => {
    const beats = run(BFS_SOURCE, bfsIteration(0, [[0, 0]], [[1, 0], [0, 1]]));
    // Both enqueues are already in the queue when the beat is drawn.
    expect(beats[0].structures.containerData?.items).toHaveLength(2);
  });

  it("gives each append its own beat when nothing is ever popped", () => {
    const source = [
      "def subsets(nums):",
      "    res = []",
      "    res.append([1])",
      "    res.append([2])",
      "    return res",
    ].join("\n");
    const steps: TraceStep[] = [
      { line: 2, kind: "mutation", vars: { res: [] } },
      { line: 3, kind: "mutation", vars: { res: [[1]] } },
      { line: 4, kind: "mutation", vars: { res: [[1], [2]] } },
    ];
    // Two appends with no take between them are two separate moments.
    expect(run(source, steps)).toHaveLength(3);
  });

  it("opens a beat for every cell a DP table fills", () => {
    const source = ["def dp(n):", "    t = [[0, 0]]", "    t[0][0] = 5", "    t[0][1] = 9"].join("\n");
    const steps: TraceStep[] = [
      { line: 2, kind: "mutation", vars: { t: [[0, 0]] } },
      { line: 3, kind: "mutation", vars: { t: [[5, 0]] } },
      { line: 4, kind: "mutation", vars: { t: [[5, 9]] } },
    ];
    const beats = run(source, steps);
    expect(beats).toHaveLength(3);
    expect(beats[2].changedCells).toEqual(["0,1"]);
  });

  it("does not spend a beat on lines that change nothing visible", () => {
    const source = ["def f(nums):", "    a = 1", "    b = 2", "    c = 3"].join("\n");
    const steps: TraceStep[] = [
      { line: 2, kind: "mutation", vars: { nums: [1, 2], a: 1 } },
      { line: 3, kind: "mutation", vars: { nums: [1, 2], a: 1, b: 2 } },
      { line: 4, kind: "mutation", vars: { nums: [1, 2], a: 1, b: 2, c: 3 } },
    ];
    // The array on screen never changes and no pointer moves, so it is one beat.
    expect(run(source, steps)).toHaveLength(1);
  });

  it("spends a beat when a rendered pointer moves", () => {
    const source = ["def f(nums):", "    i = 0", "    i = 1", "    i = 2"].join("\n");
    const steps: TraceStep[] = [
      { line: 2, kind: "mutation", vars: { nums: [1, 2, 3], i: 0 } },
      { line: 3, kind: "mutation", vars: { nums: [1, 2, 3], i: 1 } },
      { line: 4, kind: "mutation", vars: { nums: [1, 2, 3], i: 2 } },
    ];
    expect(run(source, steps)).toHaveLength(3);
  });

  it("passes a trailing halt note through as its own beat", () => {
    const source = ["def f(n):", "    a = 1"].join("\n");
    const steps: TraceStep[] = [{ line: 2, kind: "mutation", vars: { a: 1 } }];
    const frames = narrateTrace(steps, source, { haltedNote: "budget reached" });
    const beats = condenseTrace(frames, steps, source);
    expect(beats[beats.length - 1].message).toBe("budget reached");
    expect(beats[beats.length - 1].statusType).toBe("FAIL");
  });

  it("renumbers beats contiguously from zero", () => {
    const steps = [
      ...bfsIteration(0, [[0, 0]], [[1, 0], [0, 1]]),
      ...bfsIteration(1, [[1, 0]], [[2, 0], [1, 1]]),
    ];
    const beats = run(BFS_SOURCE, steps);
    expect(beats.map((b) => b.step)).toEqual([0, 1]);
  });

  it("returns the frames untouched when there are no steps", () => {
    expect(condenseTrace([], [], "")).toEqual([]);
  });
});

describe("detectContainers", () => {
  it("reads popleft as a queue", () => {
    expect(detectContainers("q.append(x)\nr = q.popleft()").get("q")).toBe("queue");
  });

  it("reads append plus pop as a stack", () => {
    expect(detectContainers("st.append(x)\nv = st.pop()").get("st")).toBe("stack");
  });

  it("ignores a list that is only appended to", () => {
    // An accumulating result is not a frontier being worked through.
    expect(detectContainers("res.append(x)").has("res")).toBe(false);
  });

  it("ignores a container that is only read from", () => {
    expect(detectContainers("v = st.pop()").has("st")).toBe(false);
  });
});
