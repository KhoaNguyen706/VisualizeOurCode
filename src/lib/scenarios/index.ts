import { combinationSumScenario } from "./combinationSum";
import { reverseLinkedListScenario } from "./reverseLinkedList";
import { twoSumScenario } from "./twoSum";
import type { Scenario } from "@/lib/types";

export const scenarios: Scenario[] = [
  twoSumScenario,
  reverseLinkedListScenario,
  combinationSumScenario,
];

export function getScenarioById(id: string): Scenario {
  return scenarios.find((s) => s.id === id) ?? scenarios[0];
}
