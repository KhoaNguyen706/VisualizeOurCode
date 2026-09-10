import { describe, expect, it } from "vitest";
import { EDGES, TOPICS, samplesFor, topicOf } from "./roadmap";
import { CODE_SAMPLES } from "./samples";
import { inferTechniquesFromCode } from "./engine/technique/inferTechnique";
import { TECHNIQUE_LABELS } from "./engine/technique/types";

describe("the roadmap", () => {
  it("has the eighteen NeetCode topics, each with at least one worked problem", () => {
    expect(TOPICS).toHaveLength(18);
    for (const t of TOPICS) {
      expect(samplesFor(t.id).length, `${t.label} has no sample`).toBeGreaterThan(0);
    }
  });

  it("links only topics that exist", () => {
    const ids = new Set(TOPICS.map((t) => t.id));
    for (const [a, b] of EDGES) {
      expect(ids.has(a)).toBe(true);
      expect(ids.has(b)).toBe(true);
    }
  });

  it("files every recognisable technique under a topic", () => {
    const filed = new Set(TOPICS.flatMap((t) => t.techniques));
    for (const technique of Object.keys(TECHNIQUE_LABELS)) {
      if (technique === "generic") continue;
      expect(filed.has(technique as never), `${technique} is on no topic`).toBe(true);
    }
  });

  // The whole point of the map: a solution to any problem on it is read as
  // that problem's topic. Every worked sample is a pasted LeetCode solution.
  it.each(CODE_SAMPLES.map((s) => [s.id, s.topic, s.code] as const))(
    "reads %s as %s",
    (_id, topic, code) => {
      expect(topicOf(inferTechniquesFromCode(code))).toBe(topic);
    }
  );
});
