"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { TimelineFrame } from "@/lib/types";
import { statusColors } from "@/lib/theme";

interface TraceStepViewProps {
  frame: TimelineFrame;
  index: number;
  total: number;
  warning?: string;
  /** The source the run was traced from, so the executing line can be quoted. */
  code?: string;
}

/**
 * The narration for the current beat, with the line it came from quoted
 * underneath — the reader should not have to glance at the gutter to connect
 * "3 + 2 === 6 → false" to the `if` it describes.
 */
export function TraceStepView({ frame, index, total, warning, code }: TraceStepViewProps) {
  const colors = statusColors(frame.statusType);
  const line = frame.sourceLine;
  const source = line && code ? code.split("\n")[line - 1]?.trim() : undefined;

  return (
    <div className="flex flex-col gap-3 mb-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${index}-${frame.message}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className={`px-4 py-3 border rounded-[10px] ${colors.border}`}
          style={{
            background: "var(--mac-sidebar)",
            borderLeftWidth: 4,
            boxShadow: "var(--mac-shadow-sm)",
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--mac-text-2)]">
              <span
                className={
                  frame.conditionMet === true
                    ? "text-[var(--mac-good)]"
                    : frame.conditionMet === false
                      ? "text-[var(--mac-bad)]"
                      : colors.text
                }
              >
                {statusWord(frame)}
              </span>
              <span className="text-[var(--mac-text-3)]">
                step {index + 1} of {total}
                {line ? ` · line ${line}` : ""}
              </span>
            </div>
            {warning && (
              <span
                className="text-[10px] font-code px-2 py-0.5 rounded-sm shrink-0"
                style={{
                  background: "var(--mac-warn-soft)",
                  color: "var(--mac-warn)",
                  border: "1px solid color-mix(in srgb, var(--mac-warn) 40%, transparent)",
                }}
                title={warning}
              >
                {/error/i.test(warning) ? "Stopped on error" : /budget/i.test(warning) ? "Truncated" : "Approximate"}
              </span>
            )}
          </div>

          <div className={`font-code text-[14px] leading-relaxed ${colors.text}`}>{frame.message}</div>

          {source && (
            <div
              className="mt-2 pt-2 font-code text-[12px] text-[var(--mac-text-2)] flex items-baseline gap-2 min-w-0"
              style={{ borderTop: "1px solid var(--mac-separator)" }}
            >
              <span className="text-[var(--mac-text-3)] shrink-0 tabular-nums">L{line}</span>
              <span className="truncate">{source}</span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** What kind of beat this is, in one word: a return, a decision, a stop, a step. */
function statusWord(frame: TimelineFrame): string {
  if (frame.statusType === "FAIL") return "Stopped";
  if (frame.statusType === "SUCCESS") return "Return";
  if (/^Next loop pass\b/.test(frame.message)) return "Loop";
  if (frame.conditionMet === true) return "Check · yes";
  if (frame.conditionMet === false) return "Check · no";
  return "Step";
}
