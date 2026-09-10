"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { TimelineFrame } from "@/lib/types";

interface HeapModeProps {
  frame: TimelineFrame;
}

const NODE_R = 20;
const LEVEL_H = 58;
const MIN_GAP = 48;

/**
 * A heap is a list the author reads as a tree: item `i` sits above `2i+1`
 * and `2i+2`, and the smallest is at the top. Both views are drawn from the
 * same snapshot — the tree so the shape is visible, the row so the reader can
 * match it to the list the code holds — and the top is marked as the item the
 * next pop will take.
 *
 * Nothing is sorted or reordered here: what is drawn is the exact list order
 * heapq left behind, so a heap built wrongly (say, by `append`) draws wrongly.
 */
export function HeapMode({ frame }: HeapModeProps) {
  const container = frame.structures.containerData;
  if (!container) return null;
  const { name, items } = container;
  const n = items.length;

  const depth = n === 0 ? 0 : Math.floor(Math.log2(n)) + 1;
  const leafSlots = Math.max(1, 2 ** Math.max(0, depth - 1));
  const width = Math.max(240, leafSlots * MIN_GAP + 40);
  const height = Math.max(70, depth * LEVEL_H + 24);

  // Position by level: slot k of level d sits at (k + 0.5) / 2^d across.
  const pos = (i: number) => {
    const d = Math.floor(Math.log2(i + 1));
    const k = i - (2 ** d - 1);
    const x = ((k + 0.5) / 2 ** d) * width;
    const y = d * LEVEL_H + NODE_R + 12;
    return { x, y };
  };

  const widest = items.reduce((m, s) => Math.max(m, s.length), 1);
  const fontSize = widest > 6 ? 9 : widest > 4 ? 10.5 : 12;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-code uppercase tracking-wider text-[var(--mac-text-2)]">Heap</span>
        <span className="text-[11px] font-code text-[var(--mac-accent)]">{name}</span>
        <span className="text-[10px] font-code text-[var(--mac-text-2)]">
          {n === 0 ? "empty" : `${n} item${n === 1 ? "" : "s"} · smallest on top · pops from the top`}
        </span>
      </div>

      {n === 0 ? (
        <div
          className="w-full max-w-[640px] min-h-[56px] rounded-xl flex items-center justify-center text-[11px] font-code text-[var(--mac-text-2)]"
          style={{ background: "var(--mac-inset)", border: "1px dashed var(--mac-separator)" }}
        >
          {name} is empty
        </div>
      ) : (
        <div className="w-full overflow-x-auto flex justify-center">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block select-none">
            {items.map((_, i) => {
              if (i === 0) return null;
              const parent = pos(Math.floor((i - 1) / 2));
              const me = pos(i);
              return (
                <line
                  key={`e${i}`}
                  x1={parent.x}
                  y1={parent.y + NODE_R}
                  x2={me.x}
                  y2={me.y - NODE_R}
                  stroke="var(--mac-border)"
                  strokeWidth={1.5}
                />
              );
            })}
            <AnimatePresence initial={false}>
              {items.map((item, i) => {
                const { x, y } = pos(i);
                const top = i === 0;
                return (
                  <motion.g
                    key={`${i}:${item}`}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={NODE_R}
                      fill={top ? "var(--mac-accent)" : "var(--mac-content)"}
                      stroke={top ? "var(--mac-accent)" : "var(--mac-border)"}
                      strokeWidth={top ? 2 : 1.5}
                    />
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={fontSize}
                      className="font-code font-bold"
                      fill={top ? "var(--mac-accent-ink)" : "var(--mac-text)"}
                    >
                      {item.length > 8 ? `${item.slice(0, 7)}…` : item}
                    </text>
                    <text
                      x={x}
                      y={y + NODE_R + 10}
                      textAnchor="middle"
                      fontSize={8}
                      className="font-code"
                      fill="var(--mac-text-3)"
                    >
                      {i}
                    </text>
                  </motion.g>
                );
              })}
            </AnimatePresence>
          </svg>
        </div>
      )}

      {n > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-[640px]">
          <span className="text-[9px] font-code uppercase tracking-wider text-[var(--mac-text-3)] mr-1">
            as the list
          </span>
          {items.map((item, i) => (
            <span
              key={`${i}:${item}`}
              className="px-2 py-0.5 rounded-md font-code text-[11px]"
              style={{
                background: i === 0 ? "var(--mac-accent-soft)" : "var(--mac-inset)",
                color: i === 0 ? "var(--mac-accent)" : "var(--mac-text)",
                border: "1px solid var(--mac-separator)",
              }}
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
