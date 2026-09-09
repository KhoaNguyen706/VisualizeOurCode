import { describe, expect, it } from "vitest";
import { detectSets, narrateTrace } from "./narrateTrace";
import { enrichScenarioTimeline } from "./technique/enrichTimeline";
import { membershipProbe } from "./technique/enrichTimeline";
import { inferTechniquesFromCode } from "./technique/inferTechnique";
import type { TraceStep } from "./runSandbox";

const HAS_DUPLICATE = `class Solution:
    def hasDuplicate(self, nums: List[int]) -> bool:
        dup=set()
        for num in nums:
            if num in dup:
                return True
            dup.add(num)
        return False`;

describe("detectSets", () => {
  it("finds a set by its declaration, whatever it is called", () => {
    expect([...detectSets(HAS_DUPLICATE)]).toEqual(["dup"]);
    expect([...detectSets("const seen = new Set();\nseen.add(1);")]).toEqual(["seen"]);
    expect([...detectSets("visited: set = set()")]).toEqual(["visited"]);
  });

  it("treats a name that is only added to as a set, but not one that is popped", () => {
    expect([...detectSets("s.add(1)")]).toEqual(["s"]);
    expect([...detectSets("st.add(1)\nst.pop()")]).toEqual([]);
  });
});

describe("the author's set on the canvas", () => {
  const steps: TraceStep[] = [
    { line: 3, kind: "mutation", vars: { nums: [1, 2, 3, 3], dup: [] } },
    { line: 5, kind: "condition", condLabel: "num in dup", condResult: false, vars: { nums: [1, 2, 3, 3], dup: [], num: 1 } },
    { line: 7, kind: "mutation", vars: { nums: [1, 2, 3, 3], dup: [1], num: 1 } },
    { line: 5, kind: "condition", condLabel: "num in dup", condResult: false, vars: { nums: [1, 2, 3, 3], dup: [1], num: 2 } },
    { line: 7, kind: "mutation", vars: { nums: [1, 2, 3, 3], dup: [1, 2], num: 2 } },
    { line: 5, kind: "condition", condLabel: "num in dup", condResult: false, vars: { nums: [1, 2, 3, 3], dup: [1, 2], num: 3 } },
    { line: 7, kind: "mutation", vars: { nums: [1, 2, 3, 3], dup: [1, 2, 3], num: 3 } },
    { line: 5, kind: "condition", condLabel: "num in dup", condResult: true, vars: { nums: [1, 2, 3, 3], dup: [1, 2, 3], num: 3 } },
    { line: 6, kind: "return", returnValue: true, vars: { nums: [1, 2, 3, 3], dup: [1, 2, 3], num: 3 } },
  ];

  it("draws the set under its own name with its real contents", () => {
    const frames = narrateTrace(steps, HAS_DUPLICATE);
    const last = frames[frames.length - 1];
    expect(last.structures.mapsData).toEqual([{ name: "dup", data: { "1": "in set", "2": "in set", "3": "in set" } }]);
    expect(last.structures.mapData).toEqual({ "1": "in set", "2": "in set", "3": "in set" });
    // The set is not also drawn as the array.
    expect(last.structures.arrayData).toEqual([1, 2, 3, 3]);
  });

  it("keeps the set through technique enrichment and lights the value being looked up", () => {
    const frames = narrateTrace(steps, HAS_DUPLICATE);
    const techniques = inferTechniquesFromCode(HAS_DUPLICATE);
    const scenario = enrichScenarioTimeline(
      { id: "t", name: "t", description: "", primaryMode: "ARRAY", timeline: frames },
      HAS_DUPLICATE,
      techniques
    );
    const check = scenario.timeline[7];
    expect(check.structures.mapData).toEqual({ "1": "in set", "2": "in set", "3": "in set" });
    expect(check.highlightedElements).toContain("3");
    // Nothing in this code is a result, so no result is drawn.
    expect(check.structures.resultData).toBeUndefined();
  });
});

describe("membershipProbe", () => {
  const vars = { num: 3, key: "a", seen: [1] };
  it("reads the looked-up value from the common membership shapes", () => {
    expect(membershipProbe("num in dup", vars)).toBe("3");
    expect(membershipProbe("num not in dup", vars)).toBe("3");
    expect(membershipProbe("seen.has(key)", vars)).toBe("a");
    expect(membershipProbe("!seen.has(key)", vars)).toBe("a");
    expect(membershipProbe("(key in seen)", vars)).toBe("a");
  });

  it("ignores checks that are not a scalar lookup", () => {
    expect(membershipProbe("seen in dup", vars)).toBeUndefined();
    expect(membershipProbe("num < 3", vars)).toBeUndefined();
    expect(membershipProbe(undefined, vars)).toBeUndefined();
  });
});
