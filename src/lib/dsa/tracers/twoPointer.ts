import type { TimelineFrame } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";

function filterAlphanumeric(s: string): string[] {
  return [...s.toLowerCase().replace(/[^a-z0-9]/g, "")];
}

function comparableValues(inputs: DSAInputs): (string | number)[] {
  if (inputs.s) return filterAlphanumeric(inputs.s);
  const raw = inputs.arr ?? inputs.nums;
  if (raw?.length) return raw;
  return ["a", "m", "a", "n", "a", "p", "l", "a", "n", "a"];
}

export function traceTwoPointer(inputs: DSAInputs, fnName?: string | null): DSATracerResult {
  const values = comparableValues(inputs);
  const frames: TimelineFrame[] = [];
  let step = 0;
  let left = 0;
  let right = values.length - 1;
  let mismatchFound = false;

  const push = (
    l: number,
    r: number,
    status: TimelineFrame["statusType"],
    message: string,
    opts: {
      conditionMet?: boolean;
      conditionLabel?: string;
      vars?: Record<string, string | number | (string | number)[]>;
    } = {}
  ) => {
    const { conditionMet, conditionLabel, vars = {} } = opts;
    frames.push({
      step: step++,
      mode: "ARRAY",
      technique: "two_pointer",
      structures: {
        arrayData: [...values],
        mapData: {},
        listData: [],
        treeData: [],
      },
      activePointers: { left: l, right: r, l, r },
      highlightedElements: [l, r],
      statusType: status,
      message,
      conditionMet,
      conditionLabel,
      variables: {
        left: l,
        right: r,
        filtered: [...values],
        ...(inputs.s ? { s: inputs.s } : {}),
        ...vars,
      },
    });
  };

  push(left, right, "EXPLORE", `${fnName ?? "two_pointer"}: L=0, R=${right} — compare opposite ends`);

  const maxSteps = values.length * 3 + 4;
  while (left < right && step < maxSteps) {
    const lv = values[left];
    const rv = values[right];
    const match = lv === rv;

    push(
      left,
      right,
      "EXPLORE",
      match
        ? `result[L]=${lv} == result[R]=${rv} → equal, move L++ and R--`
        : `result[L]=${lv} ≠ result[R]=${rv} → mismatch, return false`,
      {
        conditionMet: match,
        conditionLabel: `result[${left}] == result[${right}]?`,
        vars: { leftVal: String(lv), rightVal: String(rv) },
      }
    );

    if (!match) {
      mismatchFound = true;
      break;
    }
    left++;
    right--;
    if (left < right) {
      push(left, right, "EXPLORE", `Pointers moved: L=${left}, R=${right}`);
    }
  }

  push(
    left,
    right,
    mismatchFound ? "FAIL" : "SUCCESS",
    mismatchFound
      ? `Mismatch at L=${left}, R=${right} — not a palindrome`
      : left >= right
        ? "All pairs matched — palindrome ✓"
        : "Palindrome check complete"
  );

  return {
    timeline: frames,
    name: fnName ? `${fnName}` : "Two Pointers",
    description: "Compare elements from opposite ends with L and R",
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    primaryMode: "ARRAY",
  };
}
