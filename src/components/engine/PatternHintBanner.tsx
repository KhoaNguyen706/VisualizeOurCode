"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PatternHint } from "@/lib/engine/patternHint";

interface PatternHintBannerProps {
  hint?: PatternHint;
  /** True when the timeline below is the user's own execution. */
  isLiveTrace: boolean;
}

/**
 * Names the textbook approach for a recognised problem *beside* the trace.
 *
 * The visualiser used to swap in the canonical walkthrough whenever it
 * recognised a problem, which described an algorithm the author had not
 * written. Separating the two keeps the trace honest while the common
 * approach stays available to learn from.
 */
export function PatternHintBanner({ hint, isLiveTrace }: PatternHintBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!hint || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="mb-3 rounded-sm px-3 py-2 flex items-start gap-3"
        style={{ background: "var(--mac-sidebar)", border: "1px solid var(--mac-separator)", borderLeft: "3px solid var(--mac-warn)" }}
      >
        <span className="text-[13px] leading-[18px] select-none" aria-hidden>
          💡
        </span>

        <div className="min-w-0 flex-1 text-[11px] font-code leading-[17px]">
          <div className="text-[var(--mac-warn)]">
            Looks like <span className="font-semibold">{hint.title}</span>
            {hint.yours && <span className="text-[var(--mac-text-2)]"> — {hint.yours}</span>}
          </div>

          <div className="text-[var(--mac-text-2)] mt-1">
            <span className="text-[var(--mac-text)]">Common approach:</span> {hint.commonApproach}{" "}
            <span className="text-[var(--mac-good)]">({hint.commonComplexity})</span>
          </div>

          {isLiveTrace && (
            <div className="text-[#6a9955] mt-1">
              The steps below are your code running — not this approach.
            </div>
          )}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-[var(--mac-text-2)] hover:text-[var(--mac-text)] text-[14px] leading-none px-1"
          aria-label="Dismiss hint"
          title="Dismiss"
        >
          ×
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
