"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { TimelineFrame } from "@/lib/types";

interface ContainerModeProps {
  frame: TimelineFrame;
}

const KIND_LABEL = {
  queue: "QUEUE",
  stack: "STACK",
  set: "SET",
} as const;

/** Where the next item leaves from — the end the algorithm actually reads. */
const KIND_HINT = {
  queue: "takes from the front",
  stack: "takes from the top",
  set: "membership only",
} as const;

/**
 * Draw the frontier a traversal works through, with each item keyed by its own
 * value so framer-motion tweens it rather than repainting the row.
 *
 * The motion is the point: an item that is queued slides in at the tail and an
 * item that is visited leaves from the head, so the shape of a BFS is visible
 * as movement instead of having to be read off a list of numbers.
 */
export function ContainerMode({ frame }: ContainerModeProps) {
  const container = frame.structures.containerData;
  if (!container) return null;

  const { name, kind, items } = container;
  // A stack grows and is read at the same end; showing it head-first would put
  // the item that comes out next at the far side from where it went in.
  const shown = kind === "stack" ? [...items].reverse() : items;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-code uppercase tracking-wider text-[var(--mac-text-2)]">
          {KIND_LABEL[kind]}
        </span>
        <span className="text-[11px] font-code text-[var(--mac-accent)]">{name}</span>
        <span className="text-[10px] font-code text-[var(--mac-text-2)]">
          {items.length === 0 ? "empty" : `${items.length} waiting · ${KIND_HINT[kind]}`}
        </span>
      </div>

      <div
        className="relative w-full max-w-[640px] min-h-[56px] rounded-xl flex items-center px-3 py-2 overflow-x-auto"
        style={{
          background: "var(--mac-inset)",
          border: "1px dashed var(--mac-separator)",
        }}
      >
        {/* The end items leave from, so the direction of travel is unambiguous. */}
        {shown.length > 0 && kind !== "set" && (
          <div
            className="shrink-0 text-[9px] font-code uppercase tracking-wider pr-2 self-center"
            style={{ color: "var(--mac-accent)" }}
          >
            {kind === "queue" ? "out ←" : "top"}
          </div>
        )}

        <motion.div layout className="flex items-center gap-2 flex-nowrap">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((item, i) => (
              <motion.div
                key={`${item}-${i}`}
                layout
                initial={{ opacity: 0, scale: 0.6, y: -18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6, x: kind === "stack" ? 0 : -28 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="shrink-0 px-2.5 py-1.5 rounded-lg font-code text-[11px] whitespace-nowrap"
                style={{
                  // The next item out is the one the algorithm is about to act
                  // on, so it reads as active while the rest wait.
                  background: i === 0 ? "var(--mac-accent)" : "var(--mac-content)",
                  color: i === 0 ? "var(--mac-accent-ink)" : "var(--mac-text)",
                  border: "1px solid var(--mac-separator)",
                  boxShadow: i === 0 ? "0 0 0 2px var(--mac-accent)33" : undefined,
                }}
              >
                {item}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {shown.length === 0 && (
          <span className="text-[11px] font-code text-[var(--mac-text-2)] mx-auto">
            {name} is empty
          </span>
        )}
      </div>
    </div>
  );
}
