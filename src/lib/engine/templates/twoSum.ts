import type { AITemplatePack } from "../mergeStepsWithAI";

export const twoSumTemplate: AITemplatePack = {
  name: "Two Sum",
  description: "Find two indices that sum to target using a hash map",
  timeComplexity: "O(n)",
  spaceComplexity: "O(n)",
  primaryMode: "ARRAY",
  defaultTemplate: "At index i={i}, nums[{i}]={nums[i]}, complement needed is {complement}",
  steps: [
    {
      line: 1,
      template: "Initialize: scan nums with target={target}",
      statusType: "EXPLORE",
      mode: "ARRAY",
      overlayModes: ["ARRAY", "HASH_MAP"],
    },
    {
      template: "Loop i={i}: nums[{i}]={nums[i]}, need complement {complement}",
      statusType: "EXPLORE",
      mode: "ARRAY",
      overlayModes: ["ARRAY", "HASH_MAP"],
    },
    {
      template: "Complement {complement} found in map — return [{seen[complement]}, {i}]",
      statusType: "SUCCESS",
      mode: "ARRAY",
      overlayModes: ["ARRAY", "HASH_MAP"],
    },
    {
      template: "Store nums[{i}]={nums[i]} at map index {i}",
      statusType: "EXPLORE",
      mode: "ARRAY",
      overlayModes: ["ARRAY", "HASH_MAP"],
    },
  ],
};
