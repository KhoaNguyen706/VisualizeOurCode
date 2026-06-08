import type { AITemplatePack } from "../mergeStepsWithAI";
import { twoSumTemplate } from "./twoSum";
import { reverseLinkedListTemplate } from "./reverseLinkedList";
import { combinationSumTemplate } from "./combinationSum";
import { bubbleSortTemplate } from "./bubbleSort";

export const TEMPLATE_REGISTRY: Record<string, AITemplatePack> = {
  twoSum: twoSumTemplate,
  twosum: twoSumTemplate,
  reverseList: reverseLinkedListTemplate,
  reverselist: reverseLinkedListTemplate,
  combinationSum: combinationSumTemplate,
  combinationsum: combinationSumTemplate,
  bubbleSort: bubbleSortTemplate,
  bubblesort: bubbleSortTemplate,
};

export function getTemplateForFunction(fnName: string): AITemplatePack | null {
  return TEMPLATE_REGISTRY[fnName] ?? TEMPLATE_REGISTRY[fnName.toLowerCase()] ?? null;
}

export function getTemplateByPattern(code: string): AITemplatePack | null {
  const lower = code.toLowerCase();
  if (/twosum|two\s*sum|complement/.test(lower)) return twoSumTemplate;
  if (/reverselist|reverse.*list/.test(lower)) return reverseLinkedListTemplate;
  if (/combinationsum|combination\s*sum|backtrack/.test(lower)) return combinationSumTemplate;
  if (/bubblesort|bubble\s*sort/.test(lower)) return bubbleSortTemplate;
  return null;
}

export { twoSumTemplate, reverseLinkedListTemplate, combinationSumTemplate, bubbleSortTemplate };
