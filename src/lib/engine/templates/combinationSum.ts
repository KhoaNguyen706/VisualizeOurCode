import type { AITemplatePack } from "../mergeStepsWithAI";

export const combinationSumTemplate: AITemplatePack = {
  name: "Combination Sum",
  description: "Backtracking to find combinations summing to target",
  timeComplexity: "O(2^n)",
  spaceComplexity: "O(target)",
  primaryMode: "TREE",
  defaultTemplate: "Backtrack: path={path}, remain={remain}, target={target}",
  steps: [
    {
      template: "Start backtracking with empty path, remain={remain}, target={target}",
      statusType: "EXPLORE",
      mode: "TREE",
      overlayModes: ["TREE", "ARRAY"],
    },
    {
      template: "Choose candidate: path={path}, remain={remain}",
      statusType: "EXPLORE",
      mode: "TREE",
      overlayModes: ["TREE", "ARRAY"],
    },
    {
      template: "Valid combination found! res={res}, path={path}",
      statusType: "SUCCESS",
      mode: "TREE",
      overlayModes: ["TREE", "ARRAY"],
    },
    {
      template: "Prune branch: total={total} exceeds target={target}",
      statusType: "FAIL",
      mode: "TREE",
      overlayModes: ["TREE", "ARRAY"],
    },
    {
      template: "Backtrack: pop from path={path}, remain={remain}",
      statusType: "EXPLORE",
      mode: "TREE",
      overlayModes: ["TREE", "ARRAY"],
    },
  ],
};
