import { combinationSumScenario } from "./combinationSum";
import { reverseLinkedListScenario } from "./reverseLinkedList";
import { twoSumScenario } from "./twoSum";
import type { Scenario } from "@/lib/types";
import { EMPTY_STRUCTURES } from "@/lib/types";

export const scenarios: Scenario[] = [
  twoSumScenario,
  reverseLinkedListScenario,
  combinationSumScenario,
];

export function getScenarioById(id: string): Scenario {
  return scenarios.find((s) => s.id === id) ?? scenarios[0];
}

/** The placeholder shown before anything has been traced. */
export function createEmptyScenario(): Scenario {
  return {
    id: "empty",
    name: "",
    description: "",
    primaryMode: "ARRAY",
    timeline: [
      {
        step: 0,
        mode: "ARRAY",
        structures: { ...EMPTY_STRUCTURES },
        activePointers: {},
        highlightedElements: [],
        statusType: "EXPLORE",
        message: "Paste your code and press Visualize",
      },
    ],
  };
}
