import type { TimelineFrame, TreeNode } from "@/lib/types";
import type { VisualizationTechnique } from "@/lib/engine/technique/types";

function pushFrame(
  frames: TimelineFrame[],
  step: number,
  partial: Partial<TimelineFrame> & Pick<TimelineFrame, "message" | "statusType">
): number {
  frames.push({
    step,
    mode: partial.mode ?? "ARRAY",
    structures: partial.structures ?? { arrayData: [], mapData: {}, listData: [], treeData: [], gridData: [] },
    activePointers: partial.activePointers ?? {},
    highlightedElements: partial.highlightedElements ?? [],
    statusType: partial.statusType,
    message: partial.message,
    variables: partial.variables,
    overlayModes: partial.overlayModes,
    technique: partial.technique,
  });
  return step + 1;
}

export function traceTwoPointer(arr: number[], fnName: string | null): TimelineFrame[] {
  const frames: TimelineFrame[] = [];
  let step = 0;
  let l = 0;
  let r = arr.length - 1;

  step = pushFrame(frames, step, {
    mode: "ARRAY",
    technique: "two_pointer",
    structures: { arrayData: [...arr], mapData: {}, listData: [], treeData: [] },
    activePointers: { left: l, right: r, l, r },
    highlightedElements: [l, r],
    statusType: "EXPLORE",
    message: `${fnName ?? "two_pointer"}: L=0, R=${r} — opposite ends`,
    variables: { nums: [...arr], left: l, right: r },
  });

  while (l < r && frames.length < 10) {
    step = pushFrame(frames, step, {
      mode: "ARRAY",
      technique: "two_pointer",
      structures: { arrayData: [...arr], mapData: {}, listData: [], treeData: [] },
      activePointers: { left: l, right: r, l, r },
      highlightedElements: [l, r],
      statusType: "EXPLORE",
      message: `Compare arr[L]=${arr[l]} and arr[R]=${arr[r]}`,
      variables: { left: l, right: r, sum: arr[l] + arr[r] },
    });
    if (l < r - 1) l++;
    else r--;
  }

  pushFrame(frames, step, {
    mode: "ARRAY",
    technique: "two_pointer",
    structures: { arrayData: [...arr], mapData: {}, listData: [], treeData: [] },
    activePointers: { left: l, right: r },
    highlightedElements: [l, r],
    statusType: "SUCCESS",
    message: `Pointers met: L=${l}, R=${r}`,
    variables: { left: l, right: r },
  });

  return frames;
}

export function traceSlidingWindowGeneric(arr: number[], k: number): TimelineFrame[] {
  const frames: TimelineFrame[] = [];
  let step = 0;
  let left = 0;
  let windowSum = 0;

  for (let right = 0; right < arr.length && frames.length < 12; right++) {
    windowSum += arr[right];
    step = pushFrame(frames, step, {
      mode: "ARRAY",
      technique: "sliding_window",
      structures: { arrayData: [...arr], mapData: {}, listData: [], treeData: [] },
      activePointers: { left, right },
      highlightedElements: Array.from({ length: right - left + 1 }, (_, i) => left + i),
      statusType: "EXPLORE",
      message: `Expand right=${right}, window [${left}..${right}], sum=${windowSum}`,
      variables: { left, right, windowSum, k },
    });

    if (right - left + 1 > k) {
      windowSum -= arr[left];
      left++;
      step = pushFrame(frames, step, {
        mode: "ARRAY",
        technique: "sliding_window",
        structures: { arrayData: [...arr], mapData: {}, listData: [], treeData: [] },
        activePointers: { left, right },
        highlightedElements: Array.from({ length: right - left + 1 }, (_, i) => left + i),
        statusType: "EXPLORE",
        message: `Shrink left→${left}, window [${left}..${right}]`,
        variables: { left, right, windowSum },
      });
    }
  }

  return frames;
}

export function traceDpGrid(nums: number[]): TimelineFrame[] {
  const frames: TimelineFrame[] = [];
  let step = 0;
  const n = nums.length;
  const dp: number[][] = Array.from({ length: 2 }, () => Array(n).fill(0));

  step = pushFrame(frames, step, {
    mode: "ARRAY",
    technique: "dp_grid",
    structures: { arrayData: [...nums], mapData: {}, listData: [], treeData: [], gridData: dp.map((r) => [...r]) },
    activePointers: { row: 0, col: 0 },
    highlightedElements: ["0,0"],
    statusType: "EXPLORE",
    message: "Init DP table",
    variables: { nums: [...nums], dp: dp.map((r) => [...r]) },
  });

  for (let i = 0; i < n; i++) {
    dp[1][i] = (dp[1][i - 1] ?? 0) + nums[i];
    const grid = dp.map((r) => [...r]);
    step = pushFrame(frames, step, {
      mode: "ARRAY",
      technique: "dp_grid",
      structures: { arrayData: [...nums], mapData: {}, listData: [], treeData: [], gridData: grid },
      activePointers: { row: 1, col: i },
      highlightedElements: [`1,${i}`, `0,${i}`],
      statusType: "EXPLORE",
      message: `dp[1][${i}] = dp[1][${i - 1}] + nums[${i}] = ${dp[1][i]}`,
      variables: { row: 1, col: i, dp: grid },
    });
  }

  pushFrame(frames, step, {
    mode: "ARRAY",
    technique: "dp_grid",
    structures: { arrayData: [...nums], mapData: {}, listData: [], treeData: [], gridData: dp.map((r) => [...r]) },
    statusType: "SUCCESS",
    message: `DP complete: result=${dp[1][n - 1]}`,
    variables: { dp: dp.map((r) => [...r]) },
    highlightedElements: [],
    activePointers: {},
  });

  return frames;
}

export function traceBfsGraph(values: number[]): TimelineFrame[] {
  const frames: TimelineFrame[] = [];
  const treeNodes: TreeNode[] = [];
  let id = 0;
  const mk = (val: number, parent: string | null): string => {
    const nodeId = `n${id++}`;
    treeNodes.push({ id: nodeId, value: val, children: [], parent });
    if (parent) {
      const p = treeNodes.find((n) => n.id === parent);
      if (p) p.children.push(nodeId);
    }
    return nodeId;
  };

  const root = mk(values[0] ?? 1, null);
  const n1 = mk(values[1] ?? 2, root);
  const n2 = mk(values[2] ?? 3, root);
  const n3 = mk(values[3] ?? 4, n1);
  const n4 = mk(values[4] ?? 5, n1);

  const levels: string[][] = [[root], [n1, n2], [n3, n4]];
  let step = 0;

  for (let depth = 0; depth < levels.length; depth++) {
    const layer = levels[depth];
    step = pushFrame(frames, step, {
      mode: "TREE",
      technique: "bfs",
      structures: {
        arrayData: [],
        mapData: {},
        listData: [],
        treeData: treeNodes.map((n) => ({ ...n, children: [...n.children] })),
      },
      activePointers: { depth },
      highlightedElements: layer,
      statusType: "EXPLORE",
      message: `BFS level ${depth}: visit [${layer.map((id) => treeNodes.find((n) => n.id === id)?.value).join(", ")}]`,
      variables: { depth, queue: layer, visited: levels.slice(0, depth + 1).flat() },
    });
  }

  pushFrame(frames, step, {
    mode: "TREE",
    technique: "bfs",
    structures: {
      arrayData: [],
      mapData: {},
      listData: [],
      treeData: treeNodes.map((n) => ({ ...n, children: [...n.children] })),
    },
    statusType: "SUCCESS",
    message: "BFS traversal complete",
    highlightedElements: [root],
    activePointers: {},
  });

  return frames;
}

export function traceDfsGraph(values: number[]): TimelineFrame[] {
  const frames: TimelineFrame[] = [];
  const treeNodes: TreeNode[] = [];
  let id = 0;
  const mk = (val: number, parent: string | null): string => {
    const nodeId = `n${id++}`;
    treeNodes.push({ id: nodeId, value: val, children: [], parent });
    if (parent) {
      const p = treeNodes.find((n) => n.id === parent);
      if (p) p.children.push(nodeId);
    }
    return nodeId;
  };

  const root = mk(values[0] ?? 1, null);
  const n1 = mk(values[1] ?? 2, root);
  const n2 = mk(values[2] ?? 3, root);
  mk(values[3] ?? 4, n1);

  let step = 0;
  const visit = (nodeId: string, depth: number) => {
    const node = treeNodes.find((n) => n.id === nodeId)!;
    step = pushFrame(frames, step, {
      mode: "TREE",
      technique: "dfs",
      structures: { arrayData: [], mapData: {}, listData: [], treeData: treeNodes.map((n) => ({ ...n, children: [...n.children] })) },
      activePointers: { current: nodeId, depth },
      highlightedElements: [nodeId],
      statusType: "EXPLORE",
      message: `DFS visit node ${node.value} (depth=${depth})`,
      variables: { current: nodeId, depth, value: node.value },
    });
    for (const childId of node.children) {
      if (frames.length >= 10) break;
      visit(childId, depth + 1);
    }
  };

  visit(root, 0);
  pushFrame(frames, step, {
    mode: "TREE",
    technique: "dfs",
    structures: { arrayData: [], mapData: {}, listData: [], treeData: treeNodes.map((n) => ({ ...n, children: [...n.children] })) },
    statusType: "SUCCESS",
    message: "DFS traversal complete",
    highlightedElements: [root],
    activePointers: {},
  });

  return frames;
}

export function traceByTechnique(
  technique: VisualizationTechnique,
  arr: number[],
  fnName: string | null,
  k?: number
): TimelineFrame[] | null {
  switch (technique) {
    case "two_pointer":
      return traceTwoPointer(arr, fnName);
    case "sliding_window":
      return traceSlidingWindowGeneric(arr, k ?? 3);
    case "dp_grid":
      return traceDpGrid(arr);
    case "bfs":
      return traceBfsGraph(arr);
    case "dfs":
    case "graph":
    case "backtrack":
      return traceDfsGraph(arr);
    default:
      return null;
  }
}
