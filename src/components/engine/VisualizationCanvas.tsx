"use client";

import { motion } from "framer-motion";
import type { TimelineFrame, VisualizationMode } from "@/lib/types";
import { statusColors } from "@/lib/theme";
import { ArrayMode } from "@/components/modes/ArrayMode";
import { HashMapMode } from "@/components/modes/HashMapMode";
import { LinkedListMode } from "@/components/modes/LinkedListMode";
import { TreeMode } from "@/components/modes/TreeMode";
import { GridMode } from "@/components/modes/GridMode";
import { ContainerMode } from "@/components/modes/ContainerMode";
import { ResultArrayMode } from "@/components/modes/ResultArrayMode";
import { TECHNIQUE_LABELS } from "@/lib/engine/technique/types";
import type { VisualizationTechnique } from "@/lib/engine/technique/types";
interface VisualizationCanvasProps {
  frame: TimelineFrame;
}

const MODE_LABELS: Record<VisualizationMode, string> = {
  ARRAY: "Array",
  HASH_MAP: "Hash Map",
  LINKED_LIST: "Linked List",
  TREE: "Tree / Graph",
};

export function VisualizationCanvas({ frame }: VisualizationCanvasProps) {
  const colors = statusColors(frame.statusType);
  const modes = frame.overlayModes ?? [frame.mode];
  const maps = frame.structures.mapsData ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1.5 flex-wrap">
          {modes.map((mode) => (
            <span
              key={mode}
              className="px-2 py-0.5 text-[10px] font-code uppercase tracking-wider text-[var(--mac-text-2)]"
              style={{ background: "var(--mac-inset)", border: "1px solid var(--mac-separator)" }}
            >
              {MODE_LABELS[mode]}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {frame.technique && frame.technique in TECHNIQUE_LABELS && (
            <span
              className="px-2 py-0.5 text-[10px] font-code uppercase tracking-wider text-[var(--mac-accent)]"
              style={{ background: "var(--mac-inset)", border: "1px solid var(--mac-separator)" }}
            >
              {TECHNIQUE_LABELS[frame.technique as VisualizationTechnique]}
            </span>
          )}
          <motion.span
            key={frame.statusType}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`px-2 py-0.5 text-[10px] font-code uppercase tracking-wider border ${colors.bg} ${colors.border} ${colors.text}`}
          >
            {frame.statusType}
          </motion.span>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6 justify-center">
        {frame.structures.containerData && (
          <section>
            <ContainerMode frame={frame} />
          </section>
        )}

        {modes.includes("ARRAY") && frame.structures.arrayData.length > 0 && (
          <section>
            {modes.length > 1 && (
              <h3 className="text-[10px] font-code uppercase tracking-wider text-[var(--mac-text-2)] mb-2">Array</h3>
            )}
            <ArrayMode frame={frame} compact={modes.length > 1} />
          </section>
        )}

        {modes.includes("HASH_MAP") && maps.length > 1 ? (
          // Two dicts being compared is the algorithm itself, so they sit side
          // by side under the author's own names rather than one being dropped.
          <section className="flex flex-wrap gap-6 justify-center items-start">
            {maps.map((m) => (
              <div key={m.name} className="flex-1 min-w-[240px]">
                <h3 className="text-[10px] font-code uppercase tracking-wider text-[var(--mac-accent)] mb-2 text-center">
                  {m.name}
                </h3>
                <HashMapMode frame={frame} map={m.data} compact />
              </div>
            ))}
          </section>
        ) : (
          modes.includes("HASH_MAP") && (
            <section>
              <h3 className="text-[10px] font-code uppercase tracking-wider text-[var(--mac-text-2)] mb-2">
                {frame.technique === "hash_set" ? "Set" : maps[0]?.name ?? "Hash Map"}
              </h3>
              <HashMapMode frame={frame} compact={modes.length > 1} />
            </section>
          )
        )}

        {frame.technique === "hash_set" && (
          <section>
            <ResultArrayMode frame={frame} />
          </section>
        )}

        {modes.includes("LINKED_LIST") && frame.structures.listData.length > 0 && (
          <section>
            <LinkedListMode frame={frame} />
          </section>
        )}

        {modes.includes("TREE") && frame.structures.treeData.length > 0 && (
          <section>
            {modes.length > 1 && (
              <h3 className="text-[10px] font-code uppercase tracking-wider text-[var(--mac-text-2)] mb-2">
                {frame.technique === "graph" || frame.technique === "bfs" ? "Graph" : "Tree"}
              </h3>
            )}
            <TreeMode frame={frame} />
          </section>
        )}

        {(frame.technique === "dp_grid" || (frame.structures.gridData && frame.structures.gridData.length > 0)) && (
          <section>
            <GridMode frame={frame} />
          </section>
        )}
      </div>
    </div>
  );
}
