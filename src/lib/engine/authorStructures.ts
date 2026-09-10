import type { ActivePointers, ListNode, TreeNode } from "@/lib/types";

/**
 * The author's own node structures — a binary tree, a linked list, a trie, a
 * union-find forest — read out of a trace snapshot and turned into the nodes
 * the canvas draws.
 *
 * Everything here is derived from the snapshot alone. A tree the code inverted
 * draws inverted; a list the code broke draws broken; a `parent` array the
 * code never compressed draws as the tall tree it really is.
 */

/** The key the Python harness stamps an object's identity under. */
export const NODE_ID = "__id";

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function objId(v: unknown): number | undefined {
  return isObj(v) && typeof v[NODE_ID] === "number" ? (v[NODE_ID] as number) : undefined;
}

export function isBinaryNode(v: unknown): v is Obj {
  return isObj(v) && ("left" in v || "right" in v) && !("next" in v);
}

export function isListNode(v: unknown): v is Obj {
  return isObj(v) && "next" in v && !("children" in v);
}

function nodeValue(v: Obj): number | string {
  const raw = v.val ?? v.value ?? v.key ?? "?";
  return typeof raw === "number" || typeof raw === "string" ? raw : String(raw);
}

/**
 * Stable ids for objects across a whole trace. The harness's `__id` is the
 * object's address, which is stable for the run; the registry turns it into a
 * short id assigned in order of first sighting, so a list drawn from these ids
 * keeps its nodes in the order they were first met even after a reversal.
 */
export class IdRegistry {
  private ids = new Map<number, string>();
  constructor(private prefix: string) {}

  idFor(raw: number | undefined, fallback: string): string {
    if (raw === undefined) return `${this.prefix}${fallback}`;
    let id = this.ids.get(raw);
    if (!id) {
      id = `${this.prefix}${this.ids.size}`;
      this.ids.set(raw, id);
    }
    return id;
  }

  known(raw: number | undefined): string | undefined {
    return raw === undefined ? undefined : this.ids.get(raw);
  }
}

const MAX_NODES = 120;

/**
 * A binary tree as the canvas's node list. A missing child gets a blank
 * spacer so the present one stays on its own side: a right-only child drawn
 * straight under its parent would misstate the shape of a BST.
 */
export function binaryTreeNodes(root: unknown, ids: IdRegistry): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (node: unknown, path: string, parent: string | null): string | null => {
    if (!isBinaryNode(node) || out.length >= MAX_NODES) return null;
    const id = ids.idFor(objId(node), path);
    const record: TreeNode = { id, value: nodeValue(node), children: [], parent };
    out.push(record);
    const left = walk(node.left, `${path}L`, id);
    const right = walk(node.right, `${path}R`, id);
    if (left || right) {
      const gapL: TreeNode = { id: `${id}-gapL`, value: "", children: [], parent: id };
      const gapR: TreeNode = { id: `${id}-gapR`, value: "", children: [], parent: id };
      if (!left) out.push(gapL);
      if (!right) out.push(gapR);
      record.children = [left ?? gapL.id, right ?? gapR.id];
    }
    return id;
  };
  walk(root, "root", null);
  return out;
}

const TERMINAL_KEYS = new Set(["$", "*", "#", "end", "is_end", "isEnd", "is_word", "isWord", "word", "endOfWord", "end_of_word", "terminal", "leaf"]);

/** A trie node in either style: a `children` map, or a dict keyed by character. */
function trieChildren(node: unknown): [string, unknown][] {
  if (!isObj(node)) return [];
  const kids = isObj(node.children) ? node.children : node;
  return Object.entries(kids).filter(([k, v]) => k !== NODE_ID && !TERMINAL_KEYS.has(k) && isObj(v));
}

function trieTerminal(node: unknown): boolean {
  if (!isObj(node)) return false;
  for (const k of TERMINAL_KEYS) {
    const v = node[k];
    if (v === true || (typeof v === "string" && v.length > 0) || (isObj(v) && k === "$")) return true;
    if (v !== undefined && v !== false && v !== null && !isObj(v) && typeof v !== "number") return true;
  }
  return false;
}

/** Whether a value has the shape of a trie, in either style, at least one level deep. */
export function isTrieShaped(v: unknown): boolean {
  if (!isObj(v)) return false;
  if (isObj(v.children)) return true;
  const keys = Object.keys(v).filter((k) => k !== NODE_ID);
  if (keys.length === 0) return false;
  return keys.every((k) => k.length === 1 || TERMINAL_KEYS.has(k)) && keys.some((k) => k.length === 1 && isObj(v[k]));
}

export function trieNodes(root: unknown, ids: IdRegistry): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (node: unknown, label: string, path: string, parent: string | null): string | null => {
    if (!isObj(node) || out.length >= MAX_NODES) return null;
    const id = ids.idFor(objId(node), path);
    const record: TreeNode = {
      id,
      value: label,
      children: [],
      parent,
      note: trieTerminal(node) ? "end" : undefined,
    };
    out.push(record);
    for (const [ch, child] of trieChildren(node)) {
      const cid = walk(child, ch, `${path}/${ch}`, id);
      if (cid) record.children.push(cid);
    }
    return id;
  };
  walk(root, "root", "trie", null);
  return out;
}

/** `parent[i]` for every `i`, drawn as the forest it encodes. */
export function unionFindForest(parent: number[]): TreeNode[] {
  const n = parent.length;
  const nodes: TreeNode[] = parent.map((_, i) => ({
    id: `uf${i}`,
    value: i,
    children: [],
    parent: parent[i] === i ? null : `uf${parent[i]}`,
  }));
  for (let i = 0; i < n; i += 1) {
    if (parent[i] !== i) nodes[parent[i]]?.children.push(`uf${i}`);
  }
  return nodes;
}

function isIndexArray(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length > 1 &&
    v.every((x) => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < v.length)
  );
}

export interface DataTree {
  nodes: TreeNode[];
  /** The node the code is at, by id. */
  current?: string;
  /** Other nodes the code holds a name for. */
  highlights: string[];
}

/** Locals that name the node being visited, most specific first. */
const CURRENT_NAMES = ["node", "cur", "curr", "current", "n", "root", "p", "q", "x"];

function findByJson(nodes: TreeNode[], raws: Map<string, unknown>, target: unknown): string | undefined {
  const want = JSON.stringify(target);
  for (const n of nodes) {
    if (JSON.stringify(raws.get(n.id)) === want) return n.id;
  }
  return undefined;
}

/**
 * The author's tree in this step, if there is one: the entry call's binary
 * tree first, then a trie under `self` or a local, then a union-find forest.
 */
export function findDataTree(
  roots: Record<string, unknown> | undefined,
  vars: Record<string, unknown>,
  sourceCode: string,
  ids: IdRegistry
): DataTree | undefined {
  // Binary tree: the whole structure lives in the roots, the walk in the locals.
  const rootEntry = Object.values(roots ?? {}).find(isBinaryNode) ?? ["root", "tree", "node"].map((k) => vars[k]).find(isBinaryNode);
  if (rootEntry) {
    const nodes = binaryTreeNodes(rootEntry, ids);
    const rootId = nodes[0]?.id;
    let current: string | undefined;
    const highlights: string[] = [];
    for (const name of CURRENT_NAMES) {
      const v = vars[name];
      if (!isBinaryNode(v)) continue;
      const id = ids.known(objId(v));
      if (!id) continue;
      if (!current) current = id;
      else if (id !== rootId && !highlights.includes(id)) highlights.push(id);
    }
    for (const [name, v] of Object.entries(vars)) {
      if (CURRENT_NAMES.includes(name) || !isBinaryNode(v)) continue;
      const id = ids.known(objId(v));
      if (id && id !== current && id !== rootId && !highlights.includes(id)) highlights.push(id);
    }
    return { nodes, current, highlights };
  }

  // Trie: a class keeps it on `self`; a function keeps it in a local.
  const self = isObj(vars.self) ? vars.self : undefined;
  const trieRoot = [self?.root, self?.trie, self?.head, vars.root, vars.trie, vars.tree].find(isTrieShaped);
  if (trieRoot) {
    const nodes = trieNodes(trieRoot, ids);
    const raws = new Map<string, unknown>();
    const collect = (node: unknown, path: string) => {
      if (!isObj(node)) return;
      raws.set(ids.idFor(objId(node), path), node);
      for (const [ch, child] of trieChildren(node)) collect(child, `${path}/${ch}`);
    };
    collect(trieRoot, "trie");
    let current: string | undefined;
    for (const name of ["node", "cur", "curr", "current"]) {
      const v = vars[name];
      if (!isObj(v)) continue;
      current = ids.known(objId(v)) ?? findByJson(nodes, raws, v);
      if (current) break;
    }
    return { nodes, current, highlights: [] };
  }

  // Union-find: only when the code actually finds and unions, so a plain
  // `parent` list in a tree problem is not mistaken for a forest.
  const parent = vars.parent ?? vars.parents ?? vars.par ?? vars.uf ?? vars.root;
  if (isIndexArray(parent) && /\bfind\s*\(|\bunion\s*\(/.test(sourceCode)) {
    const nodes = unionFindForest(parent);
    const highlights: string[] = [];
    for (const name of ["x", "y", "u", "v", "a", "b", "n1", "n2", "p1", "p2", "i", "j"]) {
      const v = vars[name];
      if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < parent.length) highlights.push(`uf${v}`);
    }
    return { nodes, current: highlights[0], highlights: highlights.slice(1) };
  }

  return undefined;
}

export interface AuthorList {
  nodes: ListNode[];
  pointers: ActivePointers;
}

/** Which drawn pointer a local of this name is. */
const LIST_POINTER: Record<string, "current" | "prev" | "slow" | "fast"> = {
  cur: "current",
  curr: "current",
  current: "current",
  node: "current",
  prev: "prev",
  slow: "slow",
  fast: "fast",
};

/**
 * Every list node reachable from the entry's heads and the locals, in the
 * order they were first met. Walking from the locals too is what keeps a
 * reversal whole: once `head.next` is cut, the rest of the list is only
 * reachable through `prev`.
 */
export function collectList(
  roots: Record<string, unknown> | undefined,
  vars: Record<string, unknown>,
  ids: IdRegistry
): AuthorList | undefined {
  const sources: unknown[] = [
    ...Object.values(roots ?? {}),
    ...["head", "l1", "l2", "list1", "list2", "dummy", "prev", "cur", "curr", "current", "node", "slow", "fast"].map((k) => vars[k]),
    ...Object.values(vars),
  ];
  if (!sources.some((v) => isListNode(v) && objId(v) !== undefined)) return undefined;

  const byId = new Map<string, ListNode>();
  const walk = (start: unknown) => {
    let node = start;
    let guard = 0;
    while (isListNode(node) && guard++ < MAX_NODES) {
      const raw = objId(node);
      if (raw === undefined) return;
      const id = ids.idFor(raw, `x${byId.size}`);
      if (byId.has(id)) return;
      const nextRaw = objId(node.next);
      byId.set(id, {
        id,
        value: nodeValue(node),
        // The next id is resolved after the walk: a cycle points at a node
        // already registered, a fresh node at one about to be.
        next: nextRaw === undefined ? null : ids.idFor(nextRaw, `x${byId.size}`),
      });
      node = node.next;
    }
  };
  for (const s of sources) {
    if (Array.isArray(s)) s.forEach(walk);
    else walk(s);
  }
  if (byId.size === 0) return undefined;

  const pointers: ActivePointers = {};
  for (const [name, role] of Object.entries(LIST_POINTER)) {
    const v = vars[name];
    if (!isListNode(v)) {
      if (v === null && name in vars) pointers[role] = null;
      continue;
    }
    const id = ids.known(objId(v));
    if (id && pointers[role] === undefined) pointers[role] = id;
  }
  return { nodes: [...byId.values()], pointers };
}
