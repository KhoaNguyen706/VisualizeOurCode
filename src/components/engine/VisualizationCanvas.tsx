"use client";

import { motion } from "framer-motion";
import type { TimelineFrame } from "@/lib/types";
import { statusColors } from "@/lib/theme";
import { ArrayMode } from "@/components/modes/ArrayMode";
import { HashMapMode } from "@/components/modes/HashMapMode";
import { LinkedListMode } from "@/components/modes/LinkedListMode";
import { TreeMode } from "@/components/modes/TreeMode";
import { GridMode } from "@/components/modes/GridMode";
import { ContainerMode } from "@/components/modes/ContainerMode";
import { HeapMode } from "@/components/modes/HeapMode";

const CONTAINER_LABEL = { queue: "Queue", stack: "Stack", set: "Set", heap: "Heap" } as const;
import { ResultArrayMode } from "@/components/modes/ResultArrayMode";
import { TECHNIQUE_LABELS } from "@/lib/engine/technique/types";
import type { VisualizationTechnique } from "@/lib/engine/technique/types";

interface VisualizationCanvasProps {
  frame: TimelineFrame;
}

type Section = "container" | "grid" | "tree" | "list" | "array" | "maps" | "result";

/** With nothing recognised, the order is simply what the code holds. */
const BY_STRUCTURE: Section[] = ["array", "maps", "container", "grid", "list", "tree", "result"];

/**
 * Which picture leads.
 *
 * The lead technique is what the code *is*, so its structure sits on top and
 * everything else the code builds follows it — the queue above the grid for a
 * BFS, the table first for a DP, the array with its pointers first for a
 * two-pointer walk, the call tree first for a recursion. Supporting layers are
 * still drawn; they just come after.
 */
const LEAD_ORDER: Record<VisualizationTechnique, Section[]> = {
  bfs: ["container", "grid", "tree", "maps", "array", "list", "result"],
  dfs: ["tree", "container", "grid", "array", "maps", "list", "result"],
  recursion: ["tree", "container", "array", "maps", "grid", "list", "result"],
  backtrack: ["tree", "container", "array", "result", "maps", "grid", "list"],
  graph: ["tree", "container", "maps", "grid", "array", "list", "result"],
  dp_grid: ["grid", "maps", "array", "tree", "container", "list", "result"],
  two_pointer: ["array", "maps", "container", "grid", "list", "tree", "result"],
  sliding_window: ["array", "maps", "container", "grid", "list", "tree", "result"],
  binary_search: ["array", "maps", "container", "grid", "list", "tree", "result"],
  hash_map: ["array", "maps", "result", "container", "grid", "list", "tree"],
  hash_set: ["array", "maps", "result", "container", "grid", "list", "tree"],
  linked_list: ["list", "array", "maps", "container", "grid", "tree", "result"],
  linked_list_cycle: ["list", "array", "maps", "container", "grid", "tree", "result"],
  heap: ["container", "array", "maps", "result", "grid", "tree", "list"],
  array_scan: BY_STRUCTURE,
  generic: BY_STRUCTURE,
};

/** The engine's status, in the reader's words: what this beat is. */
const STATUS_WORD: Record<TimelineFrame["statusType"], string> = {
  EXPLORE: "running",
  SUCCESS: "return",
  FAIL: "stopped",
};

/** A set is drawn as a map whose every value is the membership marker. */
function isSetMap(m: { data: Record<string, number | string> } | undefined): boolean {
  if (!m) return false;
  const values = Object.values(m.data);
  return values.length > 0 && values.every((v) => v === "in set" || v === "✓");
}

function isTechnique(v: unknown): v is VisualizationTechnique {
  return typeof v === "string" && v in TECHNIQUE_LABELS;
}

/** What the tree section is, in the lead technique's own words. */
function treeHeading(lead: VisualizationTechnique): string {
  if (lead === "graph" || lead === "bfs") return "Graph";
  if (lead === "recursion" || lead === "backtrack" || lead === "dfs") return "Calls";
  return "Tree";
}

export function VisualizationCanvas({ frame }: VisualizationCanvasProps) {
  const colors = statusColors(frame.statusType);
  const modes = frame.overlayModes ?? [frame.mode];
  const maps = frame.structures.mapsData ?? [];
  const s = frame.structures;

  const lead: VisualizationTechnique = isTechnique(frame.technique) ? frame.technique : "generic";
  // "generic" means nothing was recognised — that is not a label worth a chip.
  const techniques = (frame.techniques ?? [frame.technique])
    .filter(isTechnique)
    .filter((t) => t !== "generic");

  const sections: Section[] = [];
  if (s.containerData) sections.push("container");
  if (modes.includes("ARRAY") && s.arrayData.length > 0) sections.push("array");
  if (modes.includes("HASH_MAP")) sections.push("maps");
  // A result is drawn only when the code has one — a tracer's output list,
  // or an author's `result` variable — never conjured because of the technique.
  if (s.resultData !== undefined) sections.push("result");
  if (modes.includes("LINKED_LIST") && s.listData.length > 0) sections.push("list");
  if (modes.includes("TREE") && s.treeData.length > 0) sections.push("tree");
  if (lead === "dp_grid" || (s.gridData?.length ?? 0) > 0) sections.push("grid");

  const order = LEAD_ORDER[lead];
  sections.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const several = sections.length > 1;

  // What is actually on the canvas, in the order it appears.
  const drawn = sections.map((section) => {
    switch (section) {
      case "container":
        return CONTAINER_LABEL[s.containerData?.kind ?? "set"];
      case "array":
        return "Array";
      case "maps":
        return isSetMap(maps[0]) ? "Set" : "Hash Map";
      case "result":
        return "Result";
      case "list":
        return "Linked List";
      case "tree":
        return treeHeading(lead);
      case "grid":
        return lead === "dp_grid" ? "DP Table" : "Grid";
    }
  });

  const heading = (text: string, accent = false) =>
    several ? (
      <h3
        className="text-[10px] font-code uppercase tracking-wider mb-2"
        style={{ color: accent ? "var(--mac-accent)" : "var(--mac-text-2)" }}
      >
        {text}
      </h3>
    ) : null;

  const render = (section: Section) => {
    switch (section) {
      case "container":
        return s.containerData?.kind === "heap" ? <HeapMode frame={frame} /> : <ContainerMode frame={frame} />;
      case "array":
        return (
          <>
            {heading("Array")}
            <ArrayMode frame={frame} compact={several} />
          </>
        );
      case "maps":
        return maps.length > 1 ? (
          // Two dicts being compared is the algorithm itself, so they sit side
          // by side under the author's own names rather than one being dropped.
          <div className="flex flex-wrap gap-6 justify-center items-start">
            {maps.map((m) => (
              <div key={m.name} className="flex-1 min-w-[240px]">
                <h3 className="text-[10px] font-code uppercase tracking-wider text-[var(--mac-accent)] mb-2 text-center">
                  {m.name}
                </h3>
                <HashMapMode frame={frame} map={m.data} name={m.name} compact />
              </div>
            ))}
          </div>
        ) : (
          <>
            {heading(maps[0]?.name ?? (isSetMap(maps[0]) ? "Set" : "Hash Map"))}
            <HashMapMode frame={frame} compact={several} name={maps[0]?.name} />
          </>
        );
      case "result":
        return <ResultArrayMode frame={frame} />;
      case "list":
        return <LinkedListMode frame={frame} />;
      case "tree":
        return (
          <>
            {heading(treeHeading(lead))}
            <TreeMode frame={frame} />
          </>
        );
      case "grid":
        return <GridMode frame={frame} />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {drawn.map((label, i) => (
            <span
              key={`${label}-${i}`}
              className="px-2 py-0.5 text-[10px] font-code uppercase tracking-wider text-[var(--mac-text-2)]"
              style={{ background: "var(--mac-inset)", border: "1px solid var(--mac-separator)" }}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {techniques.length > 0 && (
            <div
              className="flex items-center gap-1"
              title="Approaches recognised in your code — the leading one draws first"
            >
              {techniques.map((t, i) => (
                <span key={t} className="flex items-center gap-1">
                  {i > 0 && (
                    <span className="text-[10px] font-code" style={{ color: "var(--mac-text-3)" }}>
                      +
                    </span>
                  )}
                  <span
                    className="px-2 py-0.5 text-[10px] font-code uppercase tracking-wider"
                    style={{
                      color: i === 0 ? "var(--mac-accent)" : "var(--mac-text-2)",
                      background: "var(--mac-inset)",
                      border: `1px solid ${i === 0 ? "var(--mac-accent)" : "var(--mac-separator)"}`,
                    }}
                  >
                    {TECHNIQUE_LABELS[t]}
                  </span>
                </span>
              ))}
            </div>
          )}
          <motion.span
            key={frame.statusType}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`px-2 py-0.5 text-[10px] font-code uppercase tracking-wider border ${colors.bg} ${colors.border} ${colors.text}`}
          >
            {STATUS_WORD[frame.statusType]}
          </motion.span>
        </div>
      </div>

      {/* Top-aligned: content that re-centres as its height changes jumps
          under the reader's eye on every step. */}
      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <section
            key={section}
            className={several ? "rounded-[10px] px-4 pt-3 pb-4" : ""}
            style={
              several
                ? { background: "var(--mac-content)", border: "1px solid var(--mac-separator)" }
                : undefined
            }
          >
            {render(section)}
          </section>
        ))}
      </div>
    </div>
  );
}
