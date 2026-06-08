"use client";

import { motion } from "framer-motion";
import type { TimelineFrame, VisualizationMode } from "@/lib/types";
import { statusColors } from "@/lib/theme";
import { ArrayMode } from "@/components/modes/ArrayMode";
import { HashMapMode } from "@/components/modes/HashMapMode";
import { LinkedListMode } from "@/components/modes/LinkedListMode";
import { TreeMode } from "@/components/modes/TreeMode";
import { GridMode } from "@/components/modes/GridMode";
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1.5 flex-wrap">
          {modes.map((mode) => (
            <span
              key={mode}
              className="px-2 py-0.5 text-[10px] font-code uppercase tracking-wider text-[#858585]"
              style={{ background: "#2d2d2d", border: "1px solid #3c3c3c" }}
            >
              {MODE_LABELS[mode]}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {frame.technique && frame.technique in TECHNIQUE_LABELS && (
            <span
              className="px-2 py-0.5 text-[10px] font-code uppercase tracking-wider text-[#3794ff]"
              style={{ background: "#2d2d2d", border: "1px solid #3c3c3c" }}
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
        {modes.includes("ARRAY") && frame.structures.arrayData.length > 0 && (
          <section>
            {modes.length > 1 && (
              <h3 className="text-[10px] font-code uppercase tracking-wider text-[#858585] mb-2">Array</h3>
            )}
            <ArrayMode frame={frame} compact={modes.length > 1} />
          </section>
        )}

        {modes.includes("HASH_MAP") && (
          <section>
            <h3 className="text-[10px] font-code uppercase tracking-wider text-[#858585] mb-2">
              {frame.technique === "hash_set" ? "Set" : "Hash Map"}
            </h3>
            <HashMapMode frame={frame} compact={modes.length > 1} />
          </section>
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
              <h3 className="text-[10px] font-code uppercase tracking-wider text-[#858585] mb-2">
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
