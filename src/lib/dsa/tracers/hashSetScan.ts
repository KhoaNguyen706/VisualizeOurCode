import type { TimelineFrame } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";

function setToMapData(members: Set<number | string>): Record<string, string> {
  return Object.fromEntries([...members].map((v) => [String(v), "in set"]));
}

export function traceHashSetScan(inputs: DSAInputs, fnName?: string | null): DSATracerResult {
  const nums = inputs.nums ?? inputs.arr ?? [4, 3, 2, 7, 8, 2, 3, 1];
  const frames: TimelineFrame[] = [];
  const seen = new Set<number | string>();
  const result: (number | string)[] = [];
  let step = 0;

  const push = (partial: Partial<TimelineFrame> & Pick<TimelineFrame, "message" | "statusType">) => {
    frames.push({
      step: step++,
      mode: "ARRAY",
      technique: "hash_set",
      overlayModes: ["ARRAY", "HASH_MAP"],
      structures: {
        arrayData: [...nums],
        mapData: setToMapData(seen),
        listData: [],
        treeData: [],
        resultData: [...result],
      },
      activePointers: partial.activePointers ?? {},
      highlightedElements: partial.highlightedElements ?? [],
      statusType: partial.statusType,
      message: partial.message,
      variables: partial.variables,
      conditionMet: partial.conditionMet,
      conditionLabel: partial.conditionLabel,
    });
  };

  push({
    activePointers: {},
    highlightedElements: [],
    statusType: "EXPLORE",
    message: `${fnName ?? "hash_set_scan"}: init empty set and result list`,
    variables: { nums: [...nums], result: [], set: [] },
  });

  for (let i = 0; i < nums.length; i++) {
    const num = nums[i];

    push({
      activePointers: { i },
      highlightedElements: [i, String(num)],
      statusType: "EXPLORE",
      message: `Loop i=${i}: current num = ${num}. Check: is ${num} in set?`,
      variables: { i, num, result: [...result], set: [...seen] },
      conditionLabel: `${num} in set?`,
    });

    if (seen.has(num)) {
      result.push(num);
      push({
        activePointers: { i },
        highlightedElements: [i, String(num), ...result.map(String)],
        statusType: "SUCCESS",
        message: `YES — ${num} already in set → duplicate! Append ${num} to result → [${result.join(", ")}]`,
        variables: { i, num, result: [...result], set: [...seen] },
        conditionMet: true,
        conditionLabel: `${num} in set? ✓`,
      });
    } else {
      push({
        activePointers: { i },
        highlightedElements: [i, String(num)],
        statusType: "FAIL",
        message: `NO — ${num} not in set yet → add ${num} to set`,
        variables: { i, num, result: [...result], set: [...seen] },
        conditionMet: false,
        conditionLabel: `${num} in set? ✗`,
      });
      seen.add(num);
      push({
        activePointers: { i },
        highlightedElements: [i, String(num)],
        statusType: "EXPLORE",
        message: `Set now contains: {${[...seen].join(", ")}}`,
        variables: { i, num, result: [...result], set: [...seen] },
      });
    }
  }

  push({
    activePointers: {},
    highlightedElements: result.map(String),
    statusType: "SUCCESS",
    message: `Done — return duplicates: [${result.join(", ")}]`,
    variables: { result: [...result], set: [...seen], nums: [...nums] },
  });

  return {
    timeline: frames,
    name: fnName ? `${fnName}` : "Hash Set Scan",
    description: "Track seen values in a set; collect duplicates in result",
    timeComplexity: "O(n)",
    spaceComplexity: "O(n)",
    primaryMode: "ARRAY",
  };
}
