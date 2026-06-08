"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { TimelineFrame } from "@/lib/types";
import { statusColors } from "@/lib/theme";

interface TraceStepViewProps {
  frame: TimelineFrame;
  warning?: string;
}

export function TraceStepView({ frame, warning }: TraceStepViewProps) {
  const colors = statusColors(frame.statusType);

  return (
    <div className="flex flex-col gap-3 mb-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={frame.message}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className={`px-4 py-3 border font-code text-[14px] leading-relaxed ${colors.bg} ${colors.border} ${colors.text}`}
          style={{ background: "#252526" }}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="text-[10px] uppercase tracking-wider text-[#858585]">Explanation</div>
            {warning && (
              <span
                className="text-[10px] font-code px-2 py-0.5 rounded-sm shrink-0"
                style={{ background: "#3a3a1e", color: "#dcdcaa", border: "1px solid #5a5a2e" }}
              >
                Approximate
              </span>
            )}
          </div>
          {frame.message}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
