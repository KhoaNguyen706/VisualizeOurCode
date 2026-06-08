import type { ListNode, TimelineFrame } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";

function buildCyclicList(values: number[], cycleAt: number): ListNode[] {
  return values.map((value, i) => ({
    id: `n${i}`,
    value,
    next:
      i < values.length - 1
        ? `n${i + 1}`
        : cycleAt >= 0
          ? `n${cycleAt}`
          : null,
  }));
}

export function traceHasCycle(inputs: DSAInputs): DSATracerResult {
  const values = inputs.listValues ?? [3, 2, 0, -4];
  const cycleAt = inputs.cycleAt ?? 1;
  const nodes = buildCyclicList(values, cycleAt);
  const frames: TimelineFrame[] = [];
  let step = 0;

  const push = (
    listData: ListNode[],
    slow: string | null,
    fast: string | null,
    status: TimelineFrame["statusType"],
    message: string
  ) => {
    frames.push({
      step: step++,
      mode: "LINKED_LIST",
      structures: { arrayData: [], mapData: {}, listData, treeData: [] },
      activePointers: { slow, fast, head: "n0" },
      highlightedElements: [slow, fast].filter(Boolean) as string[],
      statusType: status,
      message,
      variables: {
        head: values[0],
        slow,
        fast,
        cycleAt: cycleAt >= 0 ? `n${cycleAt}` : null,
      },
    });
  };

  let slow: string | null = "n0";
  let fast: string | null = "n0";
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  push(nodes, slow, fast, "EXPLORE", "Init: slow=head, fast=head (Floyd's cycle detection)");

  const advance = (id: string | null, steps: number): string | null => {
    let cur = id;
    for (let i = 0; i < steps; i++) {
      if (!cur) return null;
      const n = nodeMap[cur];
      cur = n?.next ?? null;
    }
    return cur;
  };

  let iteration = 0;
  const maxIter = values.length * 2 + 2;

  while (fast && nodeMap[fast]?.next && iteration < maxIter) {
    slow = advance(slow, 1);
    fast = advance(fast, 2);
    iteration++;

    push(nodes, slow, fast, "EXPLORE", `Step ${iteration}: slow→${slow ?? "null"}, fast→${fast ?? "null"}`);

    if (slow && fast && slow === fast) {
      push(nodes, slow, fast, "SUCCESS", `Cycle detected! slow == fast at ${slow}`);
      break;
    }
  }

  if (slow !== fast) {
    push(nodes, slow, fast, "FAIL", "No cycle: fast reached end");
  }

  return {
    timeline: frames,
    name: "Linked List Cycle",
    description: "Floyd's tortoise & hare (slow/fast pointers)",
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    primaryMode: "LINKED_LIST",
  };
}
