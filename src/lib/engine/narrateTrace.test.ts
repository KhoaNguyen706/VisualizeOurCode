import { describe, expect, it } from "vitest";
import { narrateTrace, substituteValues } from "./narrateTrace";
import type { TraceStep } from "./runSandbox";

const PY_SOURCE = [
  "def solve(grid):", // 1
  "    q = deque()", // 2
  "    for r in range(rows):", // 3
  "        if grid[r][0] == 0:", // 4
  "            q.append((r, 0))", // 5
  "    grid[1][2] = grid[0][0] + 1", // 6
  "    r, c = q.popleft()", // 7
  "    return c", // 8
].join("\n");

const step = (line: number, vars: Record<string, unknown>, extra: Partial<TraceStep> = {}) =>
  ({ line, vars, kind: "mutation", ...extra }) as TraceStep;

describe("narrateTrace messages", () => {
  it("names the cell a subscript write changed, not the whole container", () => {
    const [frame] = narrateTrace(
      [step(6, { grid: [[5], [0, 0, 7]] })],
      PY_SOURCE
    );
    expect(frame.message).toBe("Set grid[1][2] = 7");
  });

  it("reports what went into a container and its new size", () => {
    const [frame] = narrateTrace([step(5, { q: [[0, 0]], r: 0 })], PY_SOURCE);
    expect(frame.message).toBe("Append [0, 0] to q — q now holds 1 item");
  });

  it("leads a take with the action and the names it bound", () => {
    const [frame] = narrateTrace([step(7, { q: [], r: 3, c: 0 })], PY_SOURCE);
    expect(frame.message).toBe("Take from the front of q → r = 3, c = 0 — q now holds 0 items");
  });

  it("states a branch verdict using the values the test really saw", () => {
    const [frame] = narrateTrace(
      [step(4, { grid: [[0]], r: 0 }, { kind: "condition", condLabel: "grid[r][0] == 0", condResult: true })],
      PY_SOURCE
    );
    expect(frame.message).toBe("if grid[r][0] == 0  →  0 == 0 — true, take this branch");
  });

  it("says a loop finished rather than announcing another pass", () => {
    const [frame] = narrateTrace(
      [step(3, { r: 2 }, { kind: "loop", condResult: false })],
      PY_SOURCE
    );
    expect(frame.message).toBe("for r in range(rows): — no items left, loop finished");
  });

  it("makes no claim about a condition whose outcome was never recorded", () => {
    const [frame] = narrateTrace(
      [step(4, { grid: [[1]], r: 0 }, { kind: "condition", condLabel: "grid[r][0] == 0" })],
      PY_SOURCE
    );
    expect(frame.message).toBe("if grid[r][0] == 0  →  1 == 0");
  });
});

describe("narrateTrace change tracking", () => {
  it("marks the grid cell a step rewrote", () => {
    const frames = narrateTrace(
      [
        step(6, { grid: [[1, 2], [3, 4]] }),
        step(6, { grid: [[1, 2], [3, 9]] }),
      ],
      PY_SOURCE
    );
    expect(frames[1].changedCells).toEqual(["1,1"]);
  });

  it("does not flag every cell when a different grid starts rendering", () => {
    const frames = narrateTrace(
      [step(6, { grid: [[1, 2]] }), step(6, { grid: [[7, 8]] })],
      PY_SOURCE
    );
    expect(frames[1].changedCells).toEqual([]);
  });

  it("lists the variables that differ from the previous step", () => {
    const frames = narrateTrace(
      [step(7, { r: 0, c: 0 }), step(7, { r: 0, c: 5 })],
      PY_SOURCE
    );
    expect(frames[1].changedVariables).toEqual(["c"]);
  });
});

describe("substituteValues", () => {
  it("resolves a chained subscript to the cell's value", () => {
    expect(substituteValues("grid[r][c] == INF", { grid: [[1, 2], [3, 4]], r: 1, c: 0, INF: 3 })).toBe(
      "3 == 3"
    );
  });

  it("leaves a subscript alone when the cell does not exist", () => {
    expect(substituteValues("grid[r][c]", { grid: [[1]], r: 9, c: 9 })).toBe("grid[9][9]");
  });
});

describe("map detection uses the author's own names", () => {
  const ANAGRAM = [
    "def isAnagram(s, t):", // 1
    "    dic_s = {}", // 2
    "    dic_t = {}", // 3
    "    for i in s:", // 4
    "        dic_s[i] = 1", // 5
  ].join("\n");

  const frameFor = (vars: Record<string, unknown>) =>
    narrateTrace([{ line: 5, kind: "mutation", vars }], ANAGRAM)[0];

  it("draws a dict that is not called seen/map/counts", () => {
    // The seven hard-coded names used to be the only ones that rendered, so a
    // solution naming its tables dic_s/dic_t drew an empty canvas.
    const f = frameFor({ dic_s: { r: 1, a: 2 }, s: "racecar" });
    expect(f.structures.mapData).toEqual({ r: 1, a: 2 });
  });

  it("keeps every dict so two can be compared", () => {
    const f = frameFor({ dic_s: { r: 1 }, dic_t: { c: 1 }, s: "racecar" });
    expect(f.structures.mapsData?.map((m) => m.name)).toEqual(["dic_s", "dic_t"]);
  });

  it("keeps an empty dict, so it can be watched filling up", () => {
    const f = frameFor({ dic_s: {}, s: "racecar" });
    expect(f.structures.mapsData?.[0]).toEqual({ name: "dic_s", data: {} });
  });

  it("puts dicts in the variables panel instead of dropping them", () => {
    const f = frameFor({ dic_s: { r: 1 }, s: "racecar" });
    expect(f.variables?.dic_s).toEqual({ r: 1 });
  });

  it("does not draw a linked-list node as a key/value table", () => {
    const f = frameFor({ head: { val: 1, next: null } });
    expect(f.structures.mapsData ?? []).toHaveLength(0);
  });

  it("still prefers a conventional name when one is present", () => {
    const f = frameFor({ zzz: { a: 1 }, seen: { b: 2 } });
    expect(f.structures.mapsData?.[0].name).toBe("seen");
  });
});

describe("the method receiver is not a data structure", () => {
  const SRC = ["def f(self, s):", "    dic_s = {}", "    dic_s['a'] = 1"].join("\n");
  const frameFor = (vars: Record<string, unknown>) =>
    narrateTrace([{ line: 3, kind: "mutation", vars }], SRC)[0];

  it("never treats self as a map", () => {
    // `self` snapshots as {} on a LeetCode class, and picking it as the primary
    // map blanked the canvas while the real dict sat undrawn.
    const f = frameFor({ self: {}, dic_s: { a: 1 } });
    expect(f.structures.mapsData?.map((m) => m.name)).toEqual(["dic_s"]);
    expect(f.structures.mapData).toEqual({ a: 1 });
    expect(f.mode).toBe("HASH_MAP");
  });

  it("prefers a map with contents over one still empty", () => {
    const f = frameFor({ dic_t: {}, dic_s: { a: 1 } });
    expect(f.structures.mapData).toEqual({ a: 1 });
  });

  it("still selects HASH_MAP while every map is empty", () => {
    const f = frameFor({ dic_s: {}, dic_t: {} });
    expect(f.mode).toBe("HASH_MAP");
  });
});

describe("call tree", () => {
  const call = (
    line: number,
    id: number,
    parent: number | undefined,
    n: number,
    extra: Partial<TraceStep> = {}
  ): TraceStep => ({
    line,
    vars: { n },
    callId: id,
    parentCallId: parent,
    fnName: "fib",
    args: { n },
    depth: parent === undefined ? 1 : 2,
    ...extra,
  });

  it("grows a tree of calls as a recursion descends and marks calls as they return", () => {
    const src = "function fib(n) {\n  if (n < 2) {\n    return n;\n  }\n  return fib(n - 1) + fib(n - 2);\n}";
    const steps: TraceStep[] = [
      call(2, 1, undefined, 2, { kind: "condition", condResult: false, condLabel: "n < 2" }),
      call(5, 1, undefined, 2, { kind: "return" }),
      call(2, 2, 1, 1, { kind: "condition", condResult: true, condLabel: "n < 2" }),
      call(3, 2, 1, 1, { kind: "return", returnValue: 1 }),
      call(2, 3, 1, 0, { kind: "condition", condResult: true, condLabel: "n < 2" }),
      call(3, 3, 1, 0, { kind: "return", returnValue: 0 }),
    ];
    const frames = narrateTrace(steps, src);

    expect(frames[0].structures.treeData.map((n) => n.value)).toEqual(["fib(2)"]);
    expect(frames[0].activePointers.current).toBe("call-1");
    expect(frames[0].activePointers.depth).toBe(1);

    expect(frames[3].structures.treeData.map((n) => [n.value, n.note, n.done])).toEqual([
      ["fib(2)", undefined, false],
      ["fib(1)", "→ 1", true],
    ]);
    expect(frames[3].highlightedElements).toEqual(["call-1", "call-2"]);

    const last = frames[5].structures.treeData;
    expect(last.map((n) => n.parent)).toEqual([null, "call-1", "call-1"]);
    expect(last[0].children).toEqual(["call-2", "call-3"]);
  });

  it("draws no tree for a helper that is merely called from a loop", () => {
    const steps: TraceStep[] = [
      { line: 1, vars: { total: 0 }, callId: 1, fnName: "main", args: {}, depth: 1 },
      { line: 2, vars: { x: 1 }, callId: 2, parentCallId: 1, fnName: "helper", args: { x: 1 }, depth: 2 },
      { line: 1, vars: { total: 2 }, callId: 1, fnName: "main", args: {}, depth: 1 },
    ];
    const frames = narrateTrace(steps, "total = 0\nx = 1");
    expect(frames.every((f) => f.structures.treeData.length === 0)).toBe(true);
    expect(frames[0].activePointers.current).toBeUndefined();
  });
});
