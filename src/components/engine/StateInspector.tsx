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
  const changed = new Set(frame.changedVariables ?? []);
  // Changed names float to the top so a long variable list does not hide the
  // one the current line just wrote.
  const entries = Object.entries(frame.variables ?? {}).sort(
    ([a], [b]) => Number(changed.has(b)) - Number(changed.has(a)) || a.localeCompare(b)
  );

  return (
    <aside
      className="flex flex-col h-full shrink-0 w-[min(320px,28vw)] min-w-[240px]"
      style={{ background: "var(--mac-sidebar)", borderLeft: "1px solid var(--mac-separator)" }}
    >
      <div
        className="h-[35px] shrink-0 flex items-center px-4 text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-text-2)]"
        style={{ borderBottom: "1px solid var(--mac-separator)" }}
      >
        Variables
      </div>

      {/* Complexity info */}
      {(scenario.timeComplexity || scenario.spaceComplexity) && (
        <div
          className="shrink-0 px-3 py-2 flex flex-wrap gap-3"
          style={{ borderBottom: "1px solid var(--mac-separator)", background: "var(--mac-content)" }}
        >
          {scenario.timeComplexity && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase text-[var(--mac-text-2)]">Time</span>
              <span className="font-code text-[12px] text-[var(--mac-warn)]">{scenario.timeComplexity}</span>
            </div>
          )}
          {scenario.spaceComplexity && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase text-[var(--mac-text-2)]">Space</span>
              <span className="font-code text-[12px] text-[var(--mac-warn)]">{scenario.spaceComplexity}</span>
            </div>
          )}
          {scenario.name && (
            <div className="w-full text-[11px] font-code text-[var(--mac-good)] truncate">
              {scenario.name}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto p-3 flex flex-col gap-3">
        {/* The author's own variables come first: they are what the reader is
            actually tracking, and the engine's frame state is debug detail. */}
        {entries.length > 0 && (
          <div className="flex flex-col gap-1">
            {entries.map(([name, value]) => {
              const isChanged = changed.has(name);
              return (
                <motion.div
                  key={`${name}:${currentIndex}`}
                  initial={isChanged ? { backgroundColor: "var(--mac-accent)" } : false}
                  animate={{ backgroundColor: "rgba(0,0,0,0)" }}
                  transition={{ duration: 0.6 }}
                  className="flex items-baseline gap-2 px-2 py-1 rounded-sm"
                >
                  <span
                    className="font-code text-[11px] shrink-0"
                    style={{ color: isChanged ? "var(--mac-good)" : "var(--mac-accent)" }}
                  >
                    {name}
                  </span>
                  <span
                    className="font-code text-[11px] break-all"
                    style={{ color: isChanged ? "var(--mac-good)" : "var(--mac-text-2)" }}
                  >
                    {formatVar(value)}
                  </span>
                  {isChanged && (
                    <span className="ml-auto text-[9px] uppercase tracking-wider text-[var(--mac-good)] shrink-0">
                      changed
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        <details className="shrink-0">
          <summary className="text-[9px] uppercase tracking-wider text-[var(--mac-text-2)] cursor-pointer select-none">
            Frame state
          </summary>
          <motion.pre
            key={currentIndex}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            className="font-code text-[11px] leading-[18px] whitespace-pre-wrap break-words mt-2"
            style={{ color: "var(--mac-accent)" }}
          >
            {json}
          </motion.pre>
        </details>
      </div>

      <div
        className="shrink-0 px-3 py-2 grid grid-cols-2 gap-1.5"
        style={{ borderTop: "1px solid var(--mac-separator)", background: "var(--mac-content)" }}
      >
        <Stat label="Pointers" value={Object.keys(frame.activePointers).length} />
        <Stat label="Highlights" value={frame.highlightedElements.length} />
        <Stat label="Map Size" value={Object.keys(frame.structures.mapData).length} />
        <Stat label="Depth" value={frame.activePointers.depth ?? "—"} />
      </div>
    </aside>
  );
}

/** Compact one-line rendering; long containers are summarised, not wrapped. */
function formatVar(value: unknown): string {
  // Objects went through String() and read "[object Object]", so a counting
  // solution's own dicts were listed by name with their contents hidden.
  const text =
    Array.isArray(value) || (value !== null && typeof value === "object")
      ? JSON.stringify(value)
      : String(value);
  if (text.length <= 80) return text;
  if (Array.isArray(value)) return `${text.slice(0, 77)}… (${value.length} items)`;
  return `${text.slice(0, 77)}…`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-2 py-1 rounded-sm" style={{ background: "var(--mac-inset)" }}>
      <p className="text-[9px] uppercase tracking-wider text-[var(--mac-text-2)]">{label}</p>
      <p className="text-[12px] font-code text-[var(--mac-good)] tabular-nums">{value}</p>
    </div>
  );
}
