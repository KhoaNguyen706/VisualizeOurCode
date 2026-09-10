import { describe, expect, it } from "vitest";
import {
  IdRegistry,
  binaryTreeNodes,
  collectList,
  findDataTree,
  trieNodes,
  unionFindForest,
} from "./authorStructures";
import { narrateTrace } from "./narrateTrace";
import type { TraceStep } from "./runSandbox";

// Snapshots as the Python harness emits them: every object carries its id.
const node = (id: number, val: number, left: unknown = null, right: unknown = null) => ({
  __id: id,
  val,
  left,
  right,
});

describe("binaryTreeNodes", () => {
  it("keeps a right-only child on the right with a blank spacer", () => {
    const tree = node(1, 5, null, node(2, 8));
    const nodes = binaryTreeNodes(tree, new IdRegistry("t"));
    const root = nodes[0];
    expect(root.value).toBe(5);
    expect(root.children).toHaveLength(2);
    const [left, right] = root.children.map((id) => nodes.find((n) => n.id === id)!);
    expect(left.value).toBe("");
    expect(right.value).toBe(8);
  });

  it("gives the same object the same id across frames", () => {
    const ids = new IdRegistry("t");
    const a = binaryTreeNodes(node(1, 3, node(2, 9), node(3, 20)), ids);
    const b = binaryTreeNodes(node(1, 3, node(3, 20), node(2, 9)), ids);
    expect(a.find((n) => n.value === 9)!.id).toBe(b.find((n) => n.value === 9)!.id);
  });
});

describe("collectList", () => {
  const list = (ids: number[], vals: number[]) => {
    const nodes: Record<string, unknown>[] = ids.map((id, i) => ({ __id: id, val: vals[i], next: null }));
    for (let i = 0; i < nodes.length - 1; i += 1) nodes[i].next = nodes[i + 1];
    return nodes;
  };

  it("walks the whole list from the head and puts each pointer on its node", () => {
    const [head, , third] = list([10, 11, 12], [1, 2, 3]);
    const out = collectList({ head }, { head, cur: third, prev: null }, new IdRegistry("n"))!;
    expect(out.nodes.map((n) => n.value)).toEqual([1, 2, 3]);
    expect(out.nodes.map((n) => n.next)).toEqual(["n1", "n2", null]);
    expect(out.pointers.current).toBe("n2");
    expect(out.pointers.prev).toBeNull();
  });

  it("keeps a reversed list whole by walking from every local", () => {
    // After the first two flips: head(1) -> null, prev is 2 -> 1, cur is 3.
    const [n1, n2, n3] = list([10, 11, 12], [1, 2, 3]);
    n1.next = null;
    n2.next = n1;
    const ids = new IdRegistry("n");
    collectList({ head: n1 }, { head: n1 }, ids); // first sighting fixes the order
    const out = collectList({ head: n1 }, { head: n1, prev: n2, cur: n3 }, ids)!;
    expect(out.nodes.map((n) => n.value).sort()).toEqual([1, 2, 3]);
    expect(out.nodes.find((n) => n.value === 2)!.next).toBe("n0");
  });

  it("closes a cycle instead of unrolling it", () => {
    const [a, b, c] = list([1, 2, 3], [3, 2, 0]);
    c.next = b;
    const out = collectList({ head: a }, { head: a }, new IdRegistry("n"))!;
    expect(out.nodes).toHaveLength(3);
    expect(out.nodes[2].next).toBe("n1");
  });
});

describe("trieNodes", () => {
  it("draws a TrieNode class tree with end-of-word marks", () => {
    const root = {
      __id: 1,
      children: { a: { __id: 2, children: { p: { __id: 3, children: {}, end: true } }, end: false } },
      end: false,
    };
    const nodes = trieNodes(root, new IdRegistry("t"));
    expect(nodes.map((n) => n.value)).toEqual(["root", "a", "p"]);
    expect(nodes[2].note).toBe("end");
    expect(nodes[1].note).toBeUndefined();
  });

  it("draws a nested-dict trie with a terminal key", () => {
    const nodes = trieNodes({ a: { p: { $: true } } }, new IdRegistry("t"));
    expect(nodes.map((n) => n.value)).toEqual(["root", "a", "p"]);
    expect(nodes[2].note).toBe("end");
  });
});

describe("unionFindForest", () => {
  it("draws parent[] as trees with the roots at the top", () => {
    const nodes = unionFindForest([0, 0, 1, 3]);
    expect(nodes.filter((n) => n.parent === null).map((n) => n.value)).toEqual([0, 3]);
    expect(nodes[0].children).toEqual(["uf1"]);
    expect(nodes[1].children).toEqual(["uf2"]);
  });
});

describe("findDataTree", () => {
  it("marks the node a recursive walk is at", () => {
    const leaf = node(3, 20);
    const root = node(1, 3, node(2, 9), leaf);
    const ids = new IdRegistry("t");
    const out = findDataTree({ root }, { root: leaf }, "def f(root): return f(root.left)", ids)!;
    expect(out.nodes.map((n) => n.value)).toContain(20);
    expect(out.current).toBe(out.nodes.find((n) => n.value === 20)!.id);
  });

  it("does not mistake a plain parent list for a forest", () => {
    expect(findDataTree(undefined, { parent: [0, 0, 1] }, "for i in nums: pass", new IdRegistry("t"))).toBeUndefined();
  });
});

describe("narrateTrace with roots", () => {
  it("draws the whole tree while the frame holds only a subtree", () => {
    const leaf = node(3, 20);
    const root = node(1, 3, node(2, 9), leaf);
    const code = "def depth(root):\n    if not root:\n        return 0\n    return 1 + depth(root.right)";
    const steps: TraceStep[] = [
      { line: 2, vars: { root }, roots: { root }, kind: "condition", condResult: false, callId: 1, fnName: "depth", args: { root }, depth: 1 },
      { line: 2, vars: { root: leaf }, roots: { root }, kind: "condition", condResult: false, callId: 2, parentCallId: 1, fnName: "depth", args: { root: leaf }, depth: 2 },
    ];
    const frames = narrateTrace(steps, code);
    const inner = frames[1];
    expect(inner.structures.dataTreeData?.filter((n) => n.value !== "").map((n) => n.value)).toEqual([3, 9, 20]);
    expect(inner.activePointers.treeNode).toBe(inner.structures.dataTreeData!.find((n) => n.value === 20)!.id);
    // The call tree is still its own picture.
    expect(inner.structures.treeData).toHaveLength(2);
    expect(inner.structures.treeData[1].value).toBe("depth(node 20)");
  });
});
