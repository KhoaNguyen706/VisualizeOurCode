import type { ListNode, Scenario, TimelineFrame } from "@/lib/types";

function buildList(values: number[]): ListNode[] {
  const nodes: ListNode[] = values.map((v, i) => ({
    id: `n${i}`,
    value: v,
    next: i < values.length - 1 ? `n${i + 1}` : null,
  }));
  return nodes;
}

function listSnapshot(nodes: ListNode[]): ListNode[] {
  return nodes.map((n) => ({ ...n }));
}

function buildReverseTimeline(): TimelineFrame[] {
  const frames: TimelineFrame[] = [];
  const values = [1, 2, 3, 4, 5];
  let nodes = buildList(values);
  let prev: string | null = null;
  let current: string | null = "n0";
  let step = 0;

  const push = (
    status: TimelineFrame["statusType"],
    message: string,
    highlights: (string | number)[] = [],
    ptrs: { prev?: string | null; current?: string | null } = {}
  ) => {
    frames.push({
      step: step++,
      mode: "LINKED_LIST",
      structures: {
        arrayData: [],
        mapData: {},
        listData: listSnapshot(nodes),
        treeData: [],
      },
      activePointers: {
        prev: ptrs.prev ?? prev,
        current: ptrs.current ?? current,
      },
      highlightedElements: highlights,
      statusType: status,
      message,
    });
  };

  push("EXPLORE", "Initialize: prev=null, current=head", ["n0"], { prev: null, current: "n0" });

  while (current) {
    const node = nodes.find((n) => n.id === current)!;
    const nextId = node.next;

    push("EXPLORE", `Save next pointer: next = node ${node.value}'s successor`, [current, ...(nextId ? [nextId] : [])]);

    node.next = prev;
    push("EXPLORE", `Reverse link: node ${node.value}.next → prev`, [current, ...(prev ? [prev] : [])], {
      prev,
      current,
    });

    prev = current;
    current = nextId;

    push(
      "EXPLORE",
      current ? `Advance: prev=${nodes.find((n) => n.id === prev)?.value}, current→next` : `Advance: prev is new head`,
      [prev, ...(current ? [current] : [])],
      { prev, current }
    );
  }

  push("SUCCESS", "List reversed! prev points to new head", [prev!]);
  return frames;
}

export const reverseLinkedListScenario: Scenario = {
  id: "reverse-linked-list",
  name: "Reverse Linked List",
  description: "Iterative pointer reversal with prev/current traversal",
  primaryMode: "LINKED_LIST",
  timeline: buildReverseTimeline(),
};
