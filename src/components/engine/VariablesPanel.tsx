"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { TimelineFrame, VariableValue } from "@/lib/types";

interface VariablesPanelProps {
  frame: TimelineFrame;
  prevFrame?: TimelineFrame;
}

function formatValue(v: VariableValue): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.length > 24 ? `"${v.slice(0, 24)}…"` : `"${v}"`;
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const inner = v
      .map((item) => {
        if (Array.isArray(item)) return `[${item.join(",")}]`;
        if (item === null) return "null";
        if (typeof item === "string") return `"${item}"`;
        return String(item);
      })
      .join(", ");
    const text = `[${inner}]`;
    return text.length > 60 ? text.slice(0, 57) + "…]" : text;
  }
  return String(v);
}

function valueChanged(a: VariableValue | undefined, b: VariableValue | undefined): boolean {
  if (a === undefined || b === undefined) return a !== b;
  return JSON.stringify(a) !== JSON.stringify(b);
}

export function VariablesPanel({ frame, prevFrame }: VariablesPanelProps) {
  const vars = frame.variables ?? {};
  const entries = Object.entries(vars);

  if (entries.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-2 mb-4 px-3 py-2 rounded"
      style={{ background: "#252526", border: "1px solid #3c3c3c" }}
    >
      <span className="text-[10px] font-code uppercase tracking-wider text-[#858585] self-center mr-1">
        Watch
      </span>
      <AnimatePresence mode="popLayout">
        {entries.map(([name, value]) => {
          const changed = valueChanged(value, prevFrame?.variables?.[name]);
          return (
            <motion.div
              key={name}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: 1,
                scale: 1,
                background: changed ? "#264f78" : "#1e1e1e",
              }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-1.5 px-2 py-1 rounded font-code text-[12px]"
              style={{ border: "1px solid #3c3c3c" }}
            >
              <span style={{ color: changed ? "#9cdcfe" : "#858585" }}>{name}</span>
              <span style={{ color: "#858585" }}>=</span>
              <motion.span
                key={JSON.stringify(value)}
                initial={changed ? { y: -4, opacity: 0 } : false}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                style={{ color: changed ? "#dcdcaa" : "#d4d4d4" }}
              >
                {formatValue(value)}
              </motion.span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
