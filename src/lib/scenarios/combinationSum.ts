import type { Scenario, TimelineFrame, TreeNode } from "@/lib/types";

const candidates = [2, 3, 6, 7];
const target = 7;

function buildCombinationSumTimeline(): TimelineFrame[] {
  const frames: TimelineFrame[] = [];
  const treeNodes: TreeNode[] = [];
  let nodeCounter = 0;
  let step = 0;

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
    startIdx: number,
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
      activePointers: { root: "t0", current: activeId, depth, startIdx },
      highlightedElements: highlights,
      statusType: status,
      message,
    });
  };

  const rootId = createNode("START", null);
  push([], target, 0, 0, rootId, [rootId], "EXPLORE", `Backtrack: find combinations summing to ${target}`);

  function backtrack(path: number[], remain: number, startIdx: number, parentId: string, depth: number) {
    if (remain === 0) {
      const leafId = createNode(`✓ [${path.join(",")}]`, parentId);
      push(path, 0, depth, startIdx, leafId, [leafId, ...path], "SUCCESS", `Valid combination: [${path.join(", ")}] = ${target}`);
      return;
    }
    if (remain < 0) {
      const deadId = createNode("✗ prune", parentId);
      push(path, remain, depth, startIdx, deadId, [deadId], "FAIL", `Pruned: sum exceeds target (remain=${remain})`);
      return;
    }

    for (let i = startIdx; i < candidates.length; i++) {
      const c = candidates[i];
      const nodeId = createNode(c, parentId);
      const newPath = [...path, c];
      const newRemain = remain - c;

      push(newPath, newRemain, depth + 1, i, nodeId, [nodeId, ...newPath], "EXPLORE", `Choose ${c}: path=[${newPath.join(",")}], remain=${newRemain}`);
      backtrack(newPath, newRemain, i, nodeId, depth + 1);
    }
  }

  backtrack([], target, 0, rootId, 0);
  return frames;
}

export const combinationSumScenario: Scenario = {
  id: "combination-sum",
  name: "Combination Sum",
  description: "Backtracking tree with array path stack",
  primaryMode: "TREE",
  timeline: buildCombinationSumTimeline(),
};
