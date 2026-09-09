import { describe, expect, it } from "vitest";
import { enrichTimeline } from "./enrichTimeline";
import type { TimelineFrame } from "@/lib/types";

function frame(
  structures: Partial<TimelineFrame["structures"]>,
  extra: Partial<TimelineFrame> = {}
): TimelineFrame {
  return {
    step: 0,
    mode: "ARRAY",
    structures: { arrayData: [], mapData: {}, listData: [], treeData: [], ...structures },
    activePointers: {},
    highlightedElements: [],
    statusType: "EXPLORE",
    message: "",
    ...extra,
  };
}

describe("enrichTimeline", () => {
  it("draws every layer the combined approaches use, lead first", () => {
    const [f] = enrichTimeline(
      [frame({ arrayData: [1, 2], mapsData: [{ name: "seen", data: {} }] })],
      undefined,
      ["bfs", "hash_set"]
    );
    expect(f.technique).toBe("bfs");
    expect(f.techniques).toEqual(["bfs", "hash_set"]);
    expect(f.overlayModes).toEqual(["ARRAY", "HASH_MAP"]);
  });

  it("shows everything the code built when nothing is recognised", () => {
    const [f] = enrichTimeline(
      [frame({ arrayData: [1], listData: [{ id: "n0", value: 1, next: null }] }, { mode: "LINKED_LIST" })],
      undefined,
      ["array_scan"]
    );
    expect(f.overlayModes).toEqual(["LINKED_LIST", "ARRAY"]);
  });

  it("does not add a layer with nothing to draw", () => {
    const [f] = enrichTimeline([frame({ arrayData: [1, 2, 3] })], undefined, ["two_pointer", "hash_set"]);
    expect(f.mode).toBe("ARRAY");
    expect(f.overlayModes).toBeUndefined();
    expect(f.techniques).toEqual(["two_pointer", "hash_set"]);
  });

  it("still lets a hash-map walkthrough request its table before the first insert", () => {
    const [f] = enrichTimeline([frame({ arrayData: [2, 7] })], undefined, ["hash_map"]);
    expect(f.overlayModes).toEqual(["ARRAY", "HASH_MAP"]);
  });

  it("keeps a tracer frame's own technique as the lead", () => {
    const [f] = enrichTimeline(
      [frame({ listData: [{ id: "n0", value: 1, next: null }] }, { technique: "linked_list" })],
      undefined,
      ["array_scan", "hash_set"]
    );
    expect(f.technique).toBe("linked_list");
    expect(f.mode).toBe("LINKED_LIST");
  });
});
