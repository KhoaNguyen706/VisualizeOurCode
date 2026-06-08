import type { TimelineFrame, TreeNode } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";

export function traceCombinationSum(inputs: DSAInputs): DSATracerResult {
  const candidates = inputs.candidates ?? [2, 3, 6, 7];
  const target = inputs.target ?? 7;
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
    path: number[],
    remain: number,
    depth: number,
    activeId: string | null,
    highlights: (string | number)[],
    status: TimelineFrame["statusType"],
    message: string
  ) => {
    frames.push({
      step: step++,
      mode: "TREE",
      overlayModes: ["TREE", "ARRAY"],
      structures: {
        arrayData: path.length ? [...path] : ["∅"],
        mapData: {},
        listData: [],
        treeData: treeSnapshot(),
      },
      activePointers: { root: "t0", current: activeId, depth },
      highlightedElements: highlights,
      statusType: status,
      message,
      variables: { res: res.map((r) => [...r]), path: [...path], remain, target, candidates: [...candidates] },
    });
  };

  const rootId = createNode("START", null);
  push([], target, 0, rootId, [rootId], "EXPLORE", `Backtrack: combinations summing to ${target}`);

  function backtrack(path: number[], remain: number, startIdx: number, parentId: string, depth: number) {
    if (remain === 0) {
      res.push([...path]);
      const leafId = createNode(`✓ [${path.join(",")}]`, parentId);
      push(path, 0, depth, leafId, [leafId], "SUCCESS", `Valid: [${path.join(", ")}] = ${target}`);
      return;
    }
    if (remain < 0) {
      const deadId = createNode("✗ prune", parentId);
      push(path, remain, depth, deadId, [deadId], "FAIL", `Pruned: remain=${remain}`);
      return;
    }

    for (let i = startIdx; i < candidates.length; i++) {
      const c = candidates[i];
      const nodeId = createNode(c, parentId);
      const newPath = [...path, c];
      const newRemain = remain - c;
      push(newPath, newRemain, depth + 1, nodeId, [nodeId, ...newPath], "EXPLORE", `Choose ${c}: path=[${newPath.join(",")}], remain=${newRemain}`);
      backtrack(newPath, newRemain, i, nodeId, depth + 1);
    }
  }

  backtrack([], target, 0, rootId, 0);

  return {
    timeline: frames,
    name: "Combination Sum",
    description: "Backtracking tree with array path stack",
    timeComplexity: "O(2^n)",
    spaceComplexity: "O(target)",
    primaryMode: "TREE",
  };
}
