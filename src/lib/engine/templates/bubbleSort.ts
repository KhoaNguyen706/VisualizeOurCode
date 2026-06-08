import type { AITemplatePack } from "../mergeStepsWithAI";

export const bubbleSortTemplate: AITemplatePack = {
  name: "Bubble Sort",
  description: "Repeatedly swap adjacent out-of-order elements",
  timeComplexity: "O(n²)",
  spaceComplexity: "O(1)",
  primaryMode: "ARRAY",
  defaultTemplate: "Compare arr[{j}] and arr[{j+1}] during pass i={i}",
  steps: [
    {
      template: "Outer pass i={i}: bubble largest unsorted element right",
      statusType: "EXPLORE",
      mode: "ARRAY",
    },
    {
      template: "Compare arr[{j}]={arr[j]} vs arr[{j+1}] — swap if out of order",
      statusType: "EXPLORE",
      mode: "ARRAY",
    },
    {
      template: "Swapped! arr is now {arr}",
      statusType: "EXPLORE",
      mode: "ARRAY",
    },
    {
      template: "Sort complete: {arr}",
      statusType: "SUCCESS",
      mode: "ARRAY",
    },
  ],
};
