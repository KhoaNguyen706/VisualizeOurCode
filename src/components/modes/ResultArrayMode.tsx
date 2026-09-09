"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { TimelineFrame } from "@/lib/types";
import { computeArrayLayout } from "@/lib/visual/arrayLayout";

interface ResultArrayModeProps {
  frame: TimelineFrame;
}

export function ResultArrayMode({ frame }: ResultArrayModeProps) {
  const result =
    frame.structures.resultData ??
    (Array.isArray(frame.variables?.result) ? (frame.variables.result as (string | number)[]) : []);

  const layout = computeArrayLayout(Math.max(result.length, 1), true);
  const { cellPx, gap, fontSize } = layout;

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <div className="text-[10px] font-code uppercase tracking-wider text-[var(--mac-text-2)]">Result</div>
      <div className="flex items-center justify-center flex-nowrap overflow-x-auto max-w-full min-h-[52px]" style={{ gap }}>
        <AnimatePresence mode="popLayout">
          {result.length === 0 ? (
            <motion.span
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-code text-[var(--mac-text-2)] border border-dashed border-[var(--mac-separator)] px-4 py-2 rounded-lg"
            >
              [ ] empty
            </motion.span>
          ) : (
            result.map((val, idx) => (
              <motion.div
                key={`${idx}-${val}`}
                layout
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg border-2 border-[var(--mac-good)]/70 bg-[var(--mac-good)]/10 flex items-center justify-center font-mono font-bold text-[var(--mac-good)] shrink-0"
                style={{ width: cellPx, height: cellPx, fontSize, boxShadow: "0 3px 0 var(--mac-content)" }}
              >
                {val}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
