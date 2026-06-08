import type { TimelineFrame, TreeNode } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";

export function traceSubsets(inputs: DSAInputs): DSATracerResult {
  const nums = inputs.nums ?? [1, 2, 3];
  const frames: TimelineFrame[] = [];
  const treeNodes: TreeNode[] = [];
  let nodeCounter = 0;
  let step = 0;
  const res: number[][] = [];

  const createNode = (value: number | string, parent: string | null): string => {
    const id = `t${nodeCounter++}`;
    treeNodes.push({ id, value, children: [], parent });
    if (parent) {
      const p = treeNodes.find((n) => n.id === parent);
      if (p) p.children.push(id);
    }
    return id;
  };

  const treeSnapshot = (): TreeNode[] => treeNodes.map((n) => ({ ...n, children: [...n.children] }));

  const push = (
    subset: number[],
    depth: number,
    activeId: string | null,
    status: TimelineFrame["statusType"],
    message: string
  ) => {
    frames.push({
      step: step++,
      mode: "TREE",
      overlayModes: ["TREE", "ARRAY"],
      structures: {
        arrayData: subset.length ? [...subset] : ["∅"],
        mapData: {},
        listData: [],
        treeData: treeSnapshot(),
      },
      activePointers: { root: "t0", current: activeId, depth },
      highlightedElements: activeId ? [activeId] : [],
      statusType: status,
      message,
      variables: { res: res.map((r) => [...r]), subset: [...subset], nums: [...nums] },
    });
  };

  const rootId = createNode("START", null);
  push([], 0, rootId, "EXPLORE", "Generate all subsets via backtracking");

  function backtrack(i: number, subset: number[], parentId: string, depth: number) {
    if (i === nums.length) {
      res.push([...subset]);
      const leafId = createNode(`✓ [${subset.join(",")}]`, parentId);
      push(subset, depth, leafId, "SUCCESS", `Record subset [${subset.join(", ")}]`);
      return;
    }

    const skipId = createNode(`skip ${nums[i]}`, parentId);
    push(subset, depth, skipId, "EXPLORE", `Skip nums[${i}]=${nums[i]}`);
    backtrack(i + 1, subset, skipId, depth + 1);

    const takeId = createNode(`take ${nums[i]}`, parentId);
    const withNum = [...subset, nums[i]];
    push(withNum, depth, takeId, "EXPLORE", `Take ${nums[i]}: subset=[${withNum.join(",")}]`);
    backtrack(i + 1, withNum, takeId, depth + 1);
  }

  backtrack(0, [], rootId, 0);

  return {
    timeline: frames,
    name: "Subsets",
    description: "Backtracking to generate power set",
    timeComplexity: "O(2^n)",
    spaceComplexity: "O(n)",
    primaryMode: "TREE",
  };
}
