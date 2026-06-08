"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { TimelineFrame } from "@/lib/types";
import { statusColors } from "@/lib/theme";

interface HashMapModeProps {
  frame: TimelineFrame;
  compact?: boolean;
}

export function HashMapMode({ frame, compact = false }: HashMapModeProps) {
  const { highlightedElements, statusType, structures, technique } = frame;
  const { mapData } = structures;
  const colors = statusColors(statusType);
  const entries = Object.entries(mapData);
  const isSet =
    technique === "hash_set" ||
    (entries.length > 0 && entries.every(([, v]) => v === "in set" || v === "✓"));

  if (isSet) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="text-[10px] font-code uppercase tracking-wider text-[#858585] mb-3 text-center">
          Set (seen values)
        </div>
        <div className={`flex flex-wrap gap-2 justify-center ${compact ? "max-h-48 overflow-y-auto" : ""}`}>
          <AnimatePresence mode="popLayout">
            {entries.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-6 px-8 text-[#858585] font-code text-sm border border-dashed border-[#3c3c3c] rounded-lg"
              >
                ∅ empty set
              </motion.div>
            ) : (
              entries.map(([key]) => {
                const isHighlighted = highlightedElements.includes(key);
                return (
                  <motion.div
                    key={key}
                    layout
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: isHighlighted ? 1.08 : 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    className={`
                      px-4 py-2 rounded-full border-2 font-mono font-bold text-sm
                      ${isHighlighted ? `${colors.bg} ${colors.border} ${colors.glow} ${colors.text}` : "bg-[#2d2d2d] border-[#3794ff]/50 text-[#9cdcfe]"}
                    `}
                  >
                    {key}
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mb-3 px-2">
        <span className="text-xs font-code uppercase tracking-widest text-[#3794ff] text-center">Key</span>
        <span />
        <span className="text-xs font-code uppercase tracking-widest text-[#4ec9b0] text-center">Value</span>
      </div>

      <div className={`space-y-2 ${compact ? "max-h-48 overflow-y-auto" : ""}`}>
        <AnimatePresence mode="popLayout">
          {entries.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8 text-[#858585] font-code text-sm border border-dashed border-[#3c3c3c]"
            >
              {`{ } empty map`}
            </motion.div>
          ) : (
            entries.map(([key, value]) => {
              const isHighlighted = highlightedElements.includes(key) || highlightedElements.includes(String(value));
              return (
                <motion.div
                  key={key}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: isHighlighted ? [1, 1.03, 1] : 1,
                  }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{
                    layout: { type: "spring", stiffness: 300, damping: 30 },
                    scale: isHighlighted ? { repeat: 2, duration: 0.4 } : undefined,
                  }}
                  className={`
                    grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 rounded-lg border
                    ${isHighlighted ? `${colors.bg} ${colors.border} ${colors.glow}` : "bg-[#2d2d2d] border-[#3c3c3c]"}
                  `}
                >
                  <FlipCell value={key} highlight={isHighlighted} align="right" />
                  <span className="text-[#858585] font-code">→</span>
                  <FlipCell value={String(value)} highlight={isHighlighted} align="left" />
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FlipCell({
  value,
  highlight,
  align,
}: {
  value: string;
  highlight: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={`perspective-[400px] ${align === "right" ? "text-right" : "text-left"}`}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={`inline-block font-code font-bold text-lg ${highlight ? "text-[#9cdcfe]" : "text-[#d4d4d4]"}`}
          style={{ transformStyle: "preserve-3d" }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
