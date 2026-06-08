"use client";

import { motion } from "framer-motion";
import type { Scenario, TimelineFrame } from "@/lib/types";

interface StateInspectorProps {
  frame: TimelineFrame;
  currentIndex: number;
  scenario: Scenario;
}

export function StateInspector({ frame, currentIndex, scenario }: StateInspectorProps) {
  const snapshot = {
    step: frame.step,
    frameIndex: currentIndex,
    mode: frame.mode,
    overlayModes: frame.overlayModes,
    activePointers: frame.activePointers,
    highlightedElements: frame.highlightedElements,
    statusType: frame.statusType,
    message: frame.message,
    structures: {
      arrayData: frame.structures.arrayData,
      mapData: frame.structures.mapData,
      listData: frame.structures.listData.map((n) => ({
        id: n.id,
        value: n.value,
        next: n.next,
      })),
      treeData: frame.structures.treeData.map((n) => ({
        id: n.id,
        value: n.value,
        children: n.children,
        parent: n.parent,
      })),
    },
  };

  const json = JSON.stringify(snapshot, null, 2);

  return (
    <aside
      className="flex flex-col h-full shrink-0 w-[min(320px,28vw)] min-w-[240px]"
      style={{ background: "#252526", borderLeft: "1px solid #3c3c3c" }}
    >
      <div
        className="h-[35px] shrink-0 flex items-center px-4 text-[11px] font-semibold uppercase tracking-wide text-[#bbbbbb]"
        style={{ borderBottom: "1px solid #3c3c3c" }}
      >
        Variables
      </div>

      {/* Complexity info */}
      {(scenario.timeComplexity || scenario.spaceComplexity) && (
        <div
          className="shrink-0 px-3 py-2 flex flex-wrap gap-3"
          style={{ borderBottom: "1px solid #3c3c3c", background: "#1e1e1e" }}
        >
          {scenario.timeComplexity && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase text-[#858585]">Time</span>
              <span className="font-code text-[12px] text-[#dcdcaa]">{scenario.timeComplexity}</span>
            </div>
          )}
          {scenario.spaceComplexity && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase text-[#858585]">Space</span>
              <span className="font-code text-[12px] text-[#dcdcaa]">{scenario.spaceComplexity}</span>
            </div>
          )}
          {scenario.name !== "AI Generated" && (
            <div className="w-full text-[11px] font-code text-[#4ec9b0] truncate">
              {scenario.name}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto p-3">
        <motion.pre
          key={currentIndex}
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          className="font-code text-[11px] leading-[18px] whitespace-pre-wrap break-words"
          style={{ color: "#9cdcfe" }}
        >
          {json}
        </motion.pre>
      </div>

      <div
        className="shrink-0 px-3 py-2 grid grid-cols-2 gap-1.5"
        style={{ borderTop: "1px solid #3c3c3c", background: "#1e1e1e" }}
      >
        <Stat label="Pointers" value={Object.keys(frame.activePointers).length} />
        <Stat label="Highlights" value={frame.highlightedElements.length} />
        <Stat label="Map Size" value={Object.keys(frame.structures.mapData).length} />
        <Stat label="Depth" value={frame.activePointers.depth ?? "—"} />
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-2 py-1 rounded-sm" style={{ background: "#2d2d2d" }}>
      <p className="text-[9px] uppercase tracking-wider text-[#858585]">{label}</p>
      <p className="text-[12px] font-code text-[#4ec9b0] tabular-nums">{value}</p>
    </div>
  );
}
