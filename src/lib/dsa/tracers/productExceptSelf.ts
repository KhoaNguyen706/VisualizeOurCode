import type { TimelineFrame } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";

export function traceProductExceptSelf(inputs: DSAInputs): DSATracerResult {
  let nums = inputs.nums ?? inputs.arr ?? [1, 2, 3, 4];
  if (nums.length < 2) nums = [1, 2, 3, 4];
  const n = nums.length;
  const result = new Array(n).fill(1);
  const frames: TimelineFrame[] = [];
  let step = 0;

  const push = (
    i: number | undefined,
    highlights: (string | number)[],
    status: TimelineFrame["statusType"],
    message: string,
    extraVars: Record<string, number | string | (number | string)[] | null> = {}
  ) => {
    frames.push({
      step: step++,
      mode: "ARRAY",
      overlayModes: ["ARRAY"],
      structures: {
        arrayData: [...result],
        mapData: {},
        listData: [],
        treeData: [],
      },
      activePointers: i !== undefined ? { i } : {},
      highlightedElements: highlights,
      statusType: status,
      message,
      variables: {
        nums: [...nums],
        result: [...result],
        ...extraVars,
      },
    });
  };

  push(undefined, [], "EXPLORE", `Init: nums=[${nums.join(",")}], result=[${result.join(",")}] (all 1s)`);

  for (let i = 1; i < n; i++) {
    result[i] = result[i - 1] * nums[i - 1];
    push(i, [i, i - 1], "EXPLORE", `Prefix pass i=${i}: result[${i}] = result[${i - 1}] * nums[${i - 1}] = ${result[i - 1] / (i > 1 ? nums[i - 2] : 1) * nums[i - 1]} ... → ${result[i]}`, { i });
  }

  let curr_suffix = 1;
  push(undefined, [], "EXPLORE", `Start suffix pass: curr_suffix=1`, { curr_suffix });

  for (let i = n - 1; i >= 0; i--) {
    result[i] *= curr_suffix;
    push(i, [i], "EXPLORE", `Suffix pass i=${i}: result[${i}] *= curr_suffix(${curr_suffix}) → ${result[i]}`, { i, curr_suffix });
    curr_suffix *= nums[i];
    push(i, [i], "EXPLORE", `Update curr_suffix *= nums[${i}](${nums[i]}) → ${curr_suffix}`, { i, curr_suffix });
  }

  push(undefined, [], "SUCCESS", `Done: result=[${result.join(",")}]`);

  return {
    timeline: frames,
    name: "Product Except Self",
    description: "Two-pass prefix/suffix product without division",
    timeComplexity: "O(n)",
    spaceComplexity: "O(1) extra",
    primaryMode: "ARRAY",
  };
}
