import type { TimelineFrame } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";

export function traceBinarySearch(inputs: DSAInputs): DSATracerResult {
  const nums = inputs.nums ?? [1, 3, 5, 7, 9, 11];
  const target = inputs.target ?? 7;
  const frames: TimelineFrame[] = [];
  let step = 0;
  let left = 0;
  let right = nums.length - 1;

  const push = (
    lo: number,
    hi: number,
    mid: number,
    status: TimelineFrame["statusType"],
    message: string
  ) => {
    frames.push({
      step: step++,
      mode: "ARRAY",
      structures: { arrayData: [...nums], mapData: {}, listData: [], treeData: [] },
      activePointers: { left: lo, right: hi, mid },
      highlightedElements: [lo, hi, mid],
      statusType: status,
      message,
      variables: { nums: [...nums], target, left: lo, right: hi, mid },
    });
  };

  push(left, right, Math.floor((left + right) / 2), "EXPLORE", `Binary search target=${target} in sorted array`);

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    push(left, right, mid, "EXPLORE", `mid=${mid}, nums[mid]=${nums[mid]}, compare with target`);

    if (nums[mid] === target) {
      push(left, right, mid, "SUCCESS", `Found target ${target} at index ${mid}`);
      break;
    }
    if (nums[mid] < target) {
      left = mid + 1;
      push(left, right, Math.floor((left + right) / 2), "EXPLORE", `nums[mid] < target → move left to ${left}`);
    } else {
      right = mid - 1;
      push(left, right, Math.floor((left + right) / 2), "EXPLORE", `nums[mid] > target → move right to ${right}`);
    }
  }

  if (left > right) {
    push(left, right, -1, "FAIL", `Target ${target} not found`);
  }

  return {
    timeline: frames,
    name: "Binary Search",
    description: "Divide search space in sorted array",
    timeComplexity: "O(log n)",
    spaceComplexity: "O(1)",
    primaryMode: "ARRAY",
  };
}
