import type { TimelineFrame, TreeNode } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";

interface SimpleNode {
  val: number | string;
  left: SimpleNode | null;
  right: SimpleNode | null;
}

function buildTree(values: (number | string | null)[], prefix: string): { nodes: TreeNode[]; root: SimpleNode | null } {
  if (values.length === 0 || values[0] === null) return { nodes: [], root: null };

  const nodes: TreeNode[] = [];
  const simple: (SimpleNode | null)[] = values.map((v) =>
    v === null ? null : { val: v, left: null, right: null }
  );

  for (let i = 0; i < simple.length; i++) {
    if (!simple[i]) continue;
    const leftIdx = 2 * i + 1;
    const rightIdx = 2 * i + 2;
    if (leftIdx < simple.length) simple[i]!.left = simple[leftIdx];
    if (rightIdx < simple.length) simple[i]!.right = simple[rightIdx];
  }

  simple.forEach((n, i) => {
    if (!n) return;
    const id = `${prefix}${i}`;
    const children: string[] = [];
    if (n.left) children.push(`${prefix}${2 * i + 1}`);
    if (n.right) children.push(`${prefix}${2 * i + 2}`);
    const parent =
      i === 0 ? null : `${prefix}${Math.floor((i - 1) / 2)}`;
    nodes.push({ id, value: n.val, children, parent });
  });

  return { nodes, root: simple[0] };
}

export function traceIsSameTree(inputs: DSAInputs): DSATracerResult {
  const pVals = inputs.nums && inputs.nums.length > 0 ? inputs.nums : [1, 2, 3];
  const qVals = inputs.arr && inputs.arr !== inputs.nums ? inputs.arr : [1, 2, 3];

  const { nodes: pNodes, root: pRoot } = buildTree(pVals, "p");
  const { nodes: qNodes, root: qRoot } = buildTree(qVals, "q");

  const frames: TimelineFrame[] = [];
  let step = 0;

  const push = (
    activeP: string | null,
    activeQ: string | null,
    status: TimelineFrame["statusType"],
    message: string,
    depth: number,
    pVal: number | string | null,
    qVal: number | string | null
  ) => {
    frames.push({
      step: step++,
      mode: "TREE",
      structures: {
        arrayData: [],
        mapData: {},
        listData: [],
        treeData: [...pNodes, ...qNodes],
      },
      activePointers: {
        depth,
        ...(activeP ? { p: activeP } : {}),
        ...(activeQ ? { q: activeQ } : {}),
      },
      highlightedElements: [activeP, activeQ].filter(Boolean) as string[],
      statusType: status,
      message,
      variables: {
        depth,
        "p.val": pVal,
        "q.val": qVal,
      },
    });
  };

  let result = true;

  function walk(
    p: SimpleNode | null,
    q: SimpleNode | null,
    pId: string | null,
    qId: string | null,
    depth: number
  ): boolean {
    if (!p && !q) {
      push(pId, qId, "EXPLORE", `depth=${depth}: both null → return true`, depth, null, null);
      return true;
    }
    if (!p || !q) {
      push(pId, qId, "FAIL", `depth=${depth}: one is null → return false`, depth, p?.val ?? null, q?.val ?? null);
      result = false;
      return false;
    }
    if (p.val !== q.val) {
      push(pId, qId, "FAIL", `depth=${depth}: p.val=${p.val} != q.val=${q.val} → return false`, depth, p.val, q.val);
      result = false;
      return false;
    }

    push(pId, qId, "EXPLORE", `depth=${depth}: p.val=${p.val} == q.val=${q.val}, recurse children`, depth, p.val, q.val);

    const leftEqual = walk(
      p.left,
      q.left,
      pId ? `${pId.replace(/\d+$/, (m) => String(2 * Number(m) + 1))}` : null,
      qId ? `${qId.replace(/\d+$/, (m) => String(2 * Number(m) + 1))}` : null,
      depth + 1
    );
    if (!leftEqual) return false;
    const rightEqual = walk(
      p.right,
      q.right,
      pId ? `${pId.replace(/\d+$/, (m) => String(2 * Number(m) + 2))}` : null,
      qId ? `${qId.replace(/\d+$/, (m) => String(2 * Number(m) + 2))}` : null,
      depth + 1
    );
    return leftEqual && rightEqual;
  }

  push("p0", "q0", "EXPLORE", `Init: compare two trees`, 0, pRoot?.val ?? null, qRoot?.val ?? null);
  walk(pRoot, qRoot, "p0", "q0", 0);

  push(null, null, result ? "SUCCESS" : "FAIL", result ? `Trees are identical` : `Trees differ`, 0, null, null);

  return {
    timeline: frames,
    name: "Same Tree",
    description: "Recursive structural comparison of two binary trees",
    timeComplexity: "O(n)",
    spaceComplexity: "O(h)",
    primaryMode: "TREE",
  };
}
