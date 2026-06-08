import type { Scenario, TimelineFrame } from "@/lib/types";

const nums = [2, 7, 11, 15];
const target = 9;

function buildTwoSumTimeline(): TimelineFrame[] {
  const frames: TimelineFrame[] = [];
  const map: Record<string, number> = {};
  let step = 0;

  const push = (
    i: number,
    j: number | undefined,
    highlights: (string | number)[],
    status: TimelineFrame["statusType"],
    message: string,
    mapOverride?: Record<string, number>
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
      activePointers: { i, ...(j !== undefined ? { j } : {}) },
      highlightedElements: highlights,
      statusType: status,
      message,
    });
  };

  push(-1, undefined, [], "EXPLORE", `Initialize: find two indices where nums[i] + nums[j] = ${target}`);

  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    push(i, undefined, [i], "EXPLORE", `i=${i}: nums[${i}]=${nums[i]}, need complement=${complement}`);

    const key = String(complement);
    if (key in map) {
      push(i, map[key], [i, map[key]], "SUCCESS", `Found! ${nums[i]} + ${nums[map[key]]} = ${target} → indices [${map[key]}, ${i}]`);
      return frames;
    }

    push(i, undefined, [i], "EXPLORE", `Complement ${complement} not in map — store nums[${i}]=${nums[i]}`);
    map[String(nums[i])] = i;
    push(i, undefined, [i, String(nums[i])], "EXPLORE", `map["${nums[i]}"] = ${i}`, { ...map });
  }

  push(-1, undefined, [], "FAIL", "No solution found");
  return frames;
}

export const twoSumScenario: Scenario = {
  id: "two-sum",
  name: "Two Sum",
  description: "Array scan with Hash Map complement lookup",
  primaryMode: "ARRAY",
  timeline: buildTwoSumTimeline(),
};
