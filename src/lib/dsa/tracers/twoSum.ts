import type { TimelineFrame } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";

export function traceTwoSum(inputs: DSAInputs): DSATracerResult {
  const nums = inputs.nums ?? [2, 7, 11, 15];
  const target = inputs.target ?? 9;
  const frames: TimelineFrame[] = [];
  const map: Record<string, number> = {};
  let step = 0;

  const push = (
    i: number,
    j: number | undefined,
    highlights: (string | number)[],
    status: TimelineFrame["statusType"],
    message: string,
    mapOverride?: Record<string, number>,
    variables?: TimelineFrame["variables"]
  ) => {
    frames.push({
      step: step++,
      mode: "ARRAY",
      overlayModes: ["ARRAY", "HASH_MAP"],
      structures: {
        arrayData: [...nums],
        mapData: { ...(mapOverride ?? map) },
        listData: [],
        treeData: [],
      },
      activePointers: { i: i >= 0 ? i : undefined },
      highlightedElements: highlights,
      statusType: status,
      message,
      variables: {
        nums: [...nums],
        target,
        ...(i >= 0 ? { i, complement: target - nums[i] } : {}),
        ...variables,
      },
    });
  };

  push(-1, undefined, [], "EXPLORE", `Initialize: find two indices where nums[i] + nums[j] = ${target}`);

  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    push(i, undefined, [i], "EXPLORE", `i=${i}: nums[${i}]=${nums[i]}, need complement=${complement}`);

    const key = String(complement);
    if (key in map) {
      push(i, map[key], [i, map[key]], "SUCCESS", `Found! ${nums[i]} + ${nums[map[key]]} = ${target} → [${map[key]}, ${i}]`);
      break;
    }

    map[String(nums[i])] = i;
    push(i, undefined, [i, String(nums[i])], "EXPLORE", `Store map[${nums[i]}]=${i}`, { ...map });
  }

  return {
    timeline: frames,
    name: "Two Sum",
    description: "Array scan with hash map complement lookup",
    timeComplexity: "O(n)",
    spaceComplexity: "O(n)",
    primaryMode: "ARRAY",
  };
}
