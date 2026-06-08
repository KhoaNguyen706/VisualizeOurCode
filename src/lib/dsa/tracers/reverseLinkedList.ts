import type { ListNode, TimelineFrame } from "@/lib/types";
import type { DSAInputs, DSATracerResult } from "../types";

function buildList(values: number[]): ListNode[] {
  return values.map((value, i) => ({
    id: `n${i}`,
    value,
    next: i < values.length - 1 ? `n${i + 1}` : null,
  }));
}

function snapshot(nodes: ListNode[]): ListNode[] {
  return nodes.map((n) => ({ ...n }));
}

export function traceReverseLinkedList(inputs: DSAInputs): DSATracerResult {
  const values = inputs.listValues ?? [1, 2, 3, 4, 5];
  const frames: TimelineFrame[] = [];
  let step = 0;
  const nodes = buildList(values);

  const push = (
    listData: ListNode[],
    current: string | null,
    prev: string | null,
    status: TimelineFrame["statusType"],
    message: string
  ) => {
    frames.push({
      step: step++,
      mode: "LINKED_LIST",
      structures: { arrayData: [], mapData: {}, listData, treeData: [] },
      activePointers: { current, prev },
      highlightedElements: [current, prev].filter(Boolean) as string[],
      statusType: status,
      message,
      variables: { head: values[0], current, prev },
    });
  };

  const listData = nodes.map((n) => ({ ...n }));
  push(snapshot(listData), "n0", null, "EXPLORE", "Init: prev=null, current=head");

  let prev: string | null = null;
  let current: string | null = "n0";

  while (current) {
    const node = listData.find((n) => n.id === current)!;
    const next = node.next;
    node.next = prev;
    push(snapshot(listData), current, prev, "EXPLORE", `Flip ${node.value}.next → prev, advance pointers`);
    prev = current;
    current = next;
  }

  push(snapshot(listData), null, prev, "SUCCESS", "List reversed — return new head");

  return {
    timeline: frames,
    name: "Reverse Linked List",
    description: "Iteratively reverse next pointers",
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    primaryMode: "LINKED_LIST",
  };
}
