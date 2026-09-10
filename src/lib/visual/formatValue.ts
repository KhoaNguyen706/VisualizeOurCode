/**
 * One way of writing a value down, shared by every panel that shows one.
 *
 * Python's `None` and JavaScript's `undefined`/`null` all arrive as `null` or
 * `undefined`; strings are quoted so `"3"` and `3` cannot be confused, and long
 * containers are cut with a count so the panel stays a panel.
 */
export function formatValue(value: unknown, maxLength = 80): string {
  const text = render(value);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, Math.max(1, maxLength - 3));
  if (Array.isArray(value)) return `${cut}… (${value.length} items)`;
  return `${cut}…`;
}

function render(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(render).join(", ")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // The judge's own notation for the node structures: a list as its values
    // in order, a tree as its level order. Dumping the fields would print the
    // whole structure nested inside its own first node.
    if (isListNode(obj)) return listChain(obj);
    if (isTreeNode(obj)) return `[${levelOrder(obj).map(render).join(", ")}]`;
    const entries = Object.entries(obj).filter(([k]) => k !== "__id");
    if (entries.length === 0) return "{}";
    return `{${entries.map(([k, v]) => `${k}: ${render(v)}`).join(", ")}}`;
  }
  return String(value);
}

type Obj = Record<string, unknown>;

function isListNode(v: unknown): v is Obj {
  return !!v && typeof v === "object" && !Array.isArray(v) && "next" in v && ("val" in v || "value" in v);
}

function isTreeNode(v: unknown): v is Obj {
  return !!v && typeof v === "object" && !Array.isArray(v) && ("left" in v || "right" in v) && ("val" in v || "value" in v);
}

function listChain(head: Obj): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let node: unknown = head;
  while (isListNode(node) && parts.length < 30) {
    const key = node.__id ?? node;
    if (seen.has(key)) {
      parts.push("↺");
      break;
    }
    seen.add(key);
    parts.push(render(node.val ?? node.value));
    node = node.next;
  }
  return parts.join(" → ");
}

function levelOrder(root: Obj): unknown[] {
  const out: unknown[] = [];
  const queue: unknown[] = [root];
  while (queue.length && out.length < 60) {
    const node = queue.shift();
    if (!isTreeNode(node)) {
      out.push(null);
      continue;
    }
    out.push(node.val ?? node.value);
    queue.push(node.left ?? null, node.right ?? null);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

/**
 * Pretty, multi-line form for the Output panel. A matrix is written one row
 * per line, the way it is read; anything short stays on one line.
 */
export function formatValueBlock(value: unknown): string {
  const inline = render(value);
  if (inline.length <= 60) return inline;
  if (Array.isArray(value)) {
    // One item per line: the rows of a matrix line up under each other.
    return `[\n${value.map((v) => `  ${render(v)}`).join(",\n")}\n]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return `{\n${entries.map(([k, v]) => `  ${k}: ${render(v)}`).join(",\n")}\n}`;
  }
  return inline;
}
