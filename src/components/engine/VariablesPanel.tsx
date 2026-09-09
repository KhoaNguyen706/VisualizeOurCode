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
  if (typeof v === "object") {
    // Without this a dict fell through to String(v) and read "[object Object]".
    const entries = Object.entries(v);
    if (entries.length === 0) return "{}";
    const inner = entries
      .map(([k, val]) => `${k}: ${typeof val === "string" ? `"${val}"` : String(val)}`)
      .join(", ");
    const text = `{${inner}}`;
    return text.length > 60 ? text.slice(0, 57) + "…}" : text;
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
      style={{ background: "var(--mac-sidebar)", border: "1px solid var(--mac-separator)" }}
    >
      <span className="text-[10px] font-code uppercase tracking-wider text-[var(--mac-text-2)] self-center mr-1">
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
                background: changed ? "var(--mac-accent-soft)" : "var(--mac-content)",
              }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-1.5 px-2 py-1 rounded font-code text-[12px]"
              style={{ border: "1px solid var(--mac-separator)" }}
            >
              <span style={{ color: changed ? "var(--mac-accent)" : "var(--mac-text-2)" }}>{name}</span>
              <span style={{ color: "var(--mac-text-2)" }}>=</span>
              <motion.span
                key={JSON.stringify(value)}
                initial={changed ? { y: -4, opacity: 0 } : false}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                style={{ color: changed ? "var(--mac-warn)" : "var(--mac-text)" }}
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
