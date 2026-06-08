import type { TimelineFrame } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";

export function traceBubbleSort(inputs: DSAInputs): DSATracerResult {
  const arr = [...(inputs.arr ?? inputs.nums ?? [64, 34, 25, 12, 22, 11, 90])];
  const frames: TimelineFrame[] = [];
  let step = 0;
  const n = arr.length;

  const push = (
    i: number,
    j: number,
    status: TimelineFrame["statusType"],
    message: string,
    currentArr: number[]
  ) => {
    frames.push({
      step: step++,
      mode: "ARRAY",
      structures: {
        arrayData: [...currentArr],
        mapData: {},
        listData: [],
        treeData: [],
      },
      activePointers: { i, j },
      highlightedElements: [j, j + 1],
      statusType: status,
      message,
      variables: { arr: [...currentArr], i, j },
    });
  };

  push(0, 0, "EXPLORE", `Bubble sort: ${n} elements`, arr);

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      push(i, j, "EXPLORE", `Pass ${i + 1}: compare arr[${j}]=${arr[j]} vs arr[${j + 1}]=${arr[j + 1]}`, arr);
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        push(i, j, "EXPLORE", `Swap → arr=[${arr.join(", ")}]`, arr);
      }
    }
  }

  push(n - 1, 0, "SUCCESS", `Sorted: [${arr.join(", ")}]`, arr);

  return {
    timeline: frames,
    name: "Bubble Sort",
    description: "Repeatedly swap adjacent out-of-order elements",
    timeComplexity: "O(n²)",
    spaceComplexity: "O(1)",
    primaryMode: "ARRAY",
  };
}
