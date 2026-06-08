import type { TimelineFrame } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";

export function traceSlidingWindow(inputs: DSAInputs): DSATracerResult {
  const nums = inputs.nums ?? inputs.arr ?? [2, 1, 5, 1, 3, 2];
  const k = inputs.k;
  const target = inputs.target ?? 8;

  if (k && k > 0) {
    return traceFixedWindow(nums, k);
  }
  return traceVariableWindow(nums, target);
}

function traceFixedWindow(nums: number[], k: number): DSATracerResult {
  const frames: TimelineFrame[] = [];
  let step = 0;
  let left = 0;
  let windowSum = 0;
  let maxSum = 0;

  const push = (
    lo: number,
    hi: number,
    status: TimelineFrame["statusType"],
    message: string,
    extra: Record<string, number | number[]> = {}
  ) => {
    const window = nums.slice(lo, hi + 1);
    frames.push({
      step: step++,
      mode: "ARRAY",
      structures: { arrayData: [...nums], mapData: {}, listData: [], treeData: [] },
      activePointers: { left: lo, right: hi },
      highlightedElements: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
      statusType: status,
      message,
      variables: {
        nums: [...nums],
        k,
        left: lo,
        right: hi,
        window,
        windowSum,
        maxSum,
        ...extra,
      },
    });
  };

  push(0, -1, "EXPLORE", `Init: fixed window size k=${k}, expand right pointer`);

  for (let right = 0; right < nums.length; right++) {
    windowSum += nums[right];
    push(left, right, "EXPLORE", `Expand: right=${right}, add nums[${right}]=${nums[right]}, windowSum=${windowSum}`);

    if (right - left + 1 > k) {
      windowSum -= nums[left];
      push(left, right, "EXPLORE", `Window too wide → shrink left: remove nums[${left}]=${nums[left]}`);
      left++;
      push(left, right, "EXPLORE", `After shrink: left=${left}, windowSum=${windowSum}`);
    }

    if (right - left + 1 === k) {
      maxSum = Math.max(maxSum, windowSum);
      push(left, right, "EXPLORE", `Window size k=${k}: sum=${windowSum}, maxSum=${maxSum}`);
    }
  }

  push(left, nums.length - 1, "SUCCESS", `Done: max sum of ${k}-size subarray = ${maxSum}`, { maxSum });

  return {
    timeline: frames,
    name: "Sliding Window (Fixed)",
    description: `Max sum subarray of size k=${k}`,
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    primaryMode: "ARRAY",
  };
}

function traceVariableWindow(nums: number[], target: number): DSATracerResult {
  const frames: TimelineFrame[] = [];
  let step = 0;
  let left = 0;
  let windowSum = 0;
  let maxLen = 0;

  const push = (
    lo: number,
    hi: number,
    status: TimelineFrame["statusType"],
    message: string
  ) => {
    const window = hi >= lo ? nums.slice(lo, hi + 1) : [];
    frames.push({
      step: step++,
      mode: "ARRAY",
      structures: { arrayData: [...nums], mapData: {}, listData: [], treeData: [] },
      activePointers: { left: lo, right: hi },
      highlightedElements: hi >= lo ? Array.from({ length: hi - lo + 1 }, (_, i) => lo + i) : [],
      statusType: status,
      message,
      variables: {
        nums: [...nums],
        target,
        left: lo,
        right: hi,
        window,
        windowSum,
        maxLen,
      },
    });
  };

  push(0, -1, "EXPLORE", `Init: variable window, target sum ≤ ${target}`);

  for (let right = 0; right < nums.length; right++) {
    windowSum += nums[right];
    push(left, right, "EXPLORE", `Expand right=${right}: add ${nums[right]}, windowSum=${windowSum}`);

    while (windowSum > target && left <= right) {
      windowSum -= nums[left];
      push(left, right, "EXPLORE", `windowSum > target → shrink left: remove nums[${left}]=${nums[left]}`);
      left++;
      if (left <= right) {
        push(left, right, "EXPLORE", `After shrink: left=${left}, windowSum=${windowSum}`);
      }
    }

    if (left <= right) {
      const len = right - left + 1;
      maxLen = Math.max(maxLen, len);
      push(left, right, "EXPLORE", `Valid window [${left}..${right}] len=${len}, maxLen=${maxLen}`);
    }
  }

  push(left, nums.length - 1, "SUCCESS", `Done: longest valid window length = ${maxLen}`);

  return {
    timeline: frames,
    name: "Sliding Window",
    description: "Variable-size window with left/right pointers",
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    primaryMode: "ARRAY",
  };
}
