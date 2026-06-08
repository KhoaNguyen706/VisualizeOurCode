import type { DSAPattern, DSAInputs, DSATracerResult } from "../types";
import { detectFunctionName } from "../detectPattern";
import { traceTwoSum } from "./twoSum";
import { traceBubbleSort } from "./bubbleSort";
import { traceReverseLinkedList } from "./reverseLinkedList";
import { traceHasCycle } from "./hasCycle";
import { traceCombinationSum } from "./combinationSum";
import { traceSubsets } from "./subsets";
import { traceBinarySearch } from "./binarySearch";
import { traceProductExceptSelf } from "./productExceptSelf";
import { traceIsSameTree } from "./isSameTree";
import { traceValidParentheses } from "./validParentheses";
import { traceSlidingWindow } from "./slidingWindow";
import { traceTwoPointer } from "./twoPointer";
import { traceHashSetScan } from "./hashSetScan";
import { traceGeneric } from "./generic";

export function runDSATracer(
  pattern: DSAPattern,
  inputs: DSAInputs,
  code?: string,
  language?: string
): DSATracerResult | null {
  switch (pattern) {
    case "two_sum":
      return traceTwoSum(inputs);
    case "bubble_sort":
      return traceBubbleSort(inputs);
    case "reverse_linked_list":
      return traceReverseLinkedList(inputs);
    case "has_cycle":
      return traceHasCycle(inputs);
    case "combination_sum":
      return traceCombinationSum(inputs);
    case "subsets":
      return traceSubsets(inputs);
    case "binary_search":
      return traceBinarySearch(inputs);
    case "product_except_self":
      return traceProductExceptSelf(inputs);
    case "is_same_tree":
      return traceIsSameTree(inputs);
    case "valid_parentheses":
      return traceValidParentheses(inputs);
    case "sliding_window":
      return traceSlidingWindow(inputs);
    case "two_pointer":
      return traceTwoPointer(inputs, code ? detectFunctionName(code) : null);
    case "hash_set_scan":
      return traceHashSetScan(inputs, code ? detectFunctionName(code) : null);
    case "generic":
      return code ? traceGeneric(code, inputs, language) : null;
    default:
      return null;
  }
}
