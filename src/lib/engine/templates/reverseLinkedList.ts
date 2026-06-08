import type { AITemplatePack } from "../mergeStepsWithAI";

export const reverseLinkedListTemplate: AITemplatePack = {
  name: "Reverse Linked List",
  description: "Iteratively reverse next pointers",
  timeComplexity: "O(n)",
  spaceComplexity: "O(1)",
  primaryMode: "LINKED_LIST",
  defaultTemplate: "Reverse step: prev={prev}, current node value updated",
  steps: [
    {
      template: "Init: prev=null, current=head",
      statusType: "EXPLORE",
      mode: "LINKED_LIST",
    },
    {
      template: "Save next, flip current.next to prev, advance pointers",
      statusType: "EXPLORE",
      mode: "LINKED_LIST",
    },
    {
      template: "List reversed — return new head",
      statusType: "SUCCESS",
      mode: "LINKED_LIST",
    },
  ],
};
