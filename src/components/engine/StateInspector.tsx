"use client";

import { motion } from "framer-motion";
import type { Scenario, TimelineFrame } from "@/lib/types";
import { formatValue } from "@/lib/visual/formatValue";

interface StateInspectorProps {
  frame: TimelineFrame;
  prevFrame?: TimelineFrame;
  currentIndex: number;
  total: number;
  scenario: Scenario;
  active: boolean;
  width: number;
}

/**
 * The author's variables, as they stand at this beat.
 *
 * A changed variable shows what it was as well as what it is — `3 → 4` is the
 * whole story of a loop counter, and reading it off two consecutive frames is
 * work the panel can do for the reader.
 */
export function StateInspector({
  frame,
  prevFrame,
  currentIndex,
  total,
  scenario,
  active,
  width,
}: StateInspectorProps) {
  const changed = new Set(frame.changedVariables ?? []);
  const prevVars = prevFrame?.variables ?? {};
  // Changed names float to the top so a long variable list does not hide the
  // one the current line just wrote.
  const entries = Object.entries(frame.variables ?? {}).sort(
    ([a], [b]) => Number(changed.has(b)) - Number(changed.has(a)) || a.localeCompare(b)
  );

  const currentCall = callName(frame);
  const depth = typeof frame.activePointers.depth === "number" ? frame.activePointers.depth : undefined;

  return (
    <aside
      className="flex flex-col h-full shrink-0 min-w-0"
      style={{ width, background: "var(--mac-sidebar)", borderLeft: "1px solid var(--mac-separator)" }}
    >
      <div
        className="h-[35px] shrink-0 flex items-center justify-between px-4 text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-text-2)]"
        style={{ borderBottom: "1px solid var(--mac-separator)" }}
      >
        <span>Variables</span>
        {active && (
          <span className="font-code font-normal normal-case tracking-normal text-[var(--mac-text-3)] tabular-nums">
            step {currentIndex + 1}/{total}
          </span>
        )}
      </div>

      {/* Where we are: the running call and the scenario the run belongs to. */}
      {active && (currentCall || scenario.name || scenario.timeComplexity) && (
        <div
          className="shrink-0 px-4 py-2 flex flex-col gap-1"
          style={{ borderBottom: "1px solid var(--mac-separator)", background: "var(--mac-content)" }}
        >
          {currentCall && (
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-[9px] uppercase tracking-wider text-[var(--mac-text-3)] shrink-0">in</span>
              <span className="font-code text-[12px] text-[var(--mac-accent)] truncate">{currentCall}</span>
              {depth !== undefined && (
                <span className="ml-auto text-[10px] font-code text-[var(--mac-text-3)] shrink-0">
                  depth {depth}
                </span>
              )}
            </div>
          )}
          {!currentCall && scenario.name && (
            <div className="text-[11px] font-code text-[var(--mac-text-2)] truncate">{scenario.name}</div>
          )}
          {(scenario.timeComplexity || scenario.spaceComplexity) && (
            <div className="flex gap-3 text-[10px] font-code text-[var(--mac-text-3)]">
              {scenario.timeComplexity && (
                <span>
                  time <span className="text-[var(--mac-warn)]">{scenario.timeComplexity}</span>
                </span>
              )}
              {scenario.spaceComplexity && (
                <span>
                  space <span className="text-[var(--mac-warn)]">{scenario.spaceComplexity}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto px-2 py-2 flex flex-col gap-3">
        {!active && (
          <p className="px-2 py-4 text-[12px] text-[var(--mac-text-3)]">
            Your variables appear here as the run steps through them.
          </p>
        )}

        {entries.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {entries.map(([name, value]) => {
              const isChanged = changed.has(name);
              const before = isChanged && name in prevVars ? formatValue(prevVars[name], 40) : undefined;
              const after = formatValue(value, 120);
              return (
                <motion.div
                  key={`${name}:${currentIndex}`}
                  initial={isChanged ? { backgroundColor: "var(--mac-accent-soft)" } : false}
                  animate={{ backgroundColor: isChanged ? "var(--mac-good-soft)" : "rgba(0,0,0,0)" }}
                  transition={{ duration: 0.5 }}
                  className="px-2 py-1 rounded-[6px]"
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className="font-code text-[11.5px] shrink-0"
                      style={{ color: isChanged ? "var(--mac-good)" : "var(--mac-accent)" }}
                    >
                      {name}
                    </span>
                    <span
                      className="font-code text-[11.5px] break-all"
                      style={{ color: isChanged ? "var(--mac-text)" : "var(--mac-text-2)" }}
                    >
                      {after}
                    </span>
                  </div>
                  {before !== undefined && before !== after && (
                    <div className="font-code text-[10.5px] text-[var(--mac-text-3)] pl-1 truncate">
                      was <span className="line-through">{before}</span>
                    </div>
                  )}
                  {isChanged && before === undefined && (
                    <div className="font-code text-[10.5px] text-[var(--mac-text-3)] pl-1">new</div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {active && entries.length === 0 && (
          <p className="px-2 text-[12px] text-[var(--mac-text-3)]">No variables in scope yet.</p>
        )}

        {active && (
          <details className="shrink-0 px-2">
            <summary className="text-[9px] uppercase tracking-wider text-[var(--mac-text-3)] cursor-pointer select-none">
              Frame state
            </summary>
            <pre
              className="font-code text-[10.5px] leading-[16px] whitespace-pre-wrap break-words mt-2"
              style={{ color: "var(--mac-text-2)" }}
            >
              {JSON.stringify(debugSnapshot(frame, currentIndex), null, 2)}
            </pre>
          </details>
        )}
      </div>
    </aside>
  );
}

/** The call the current beat runs in, as its node in the call tree names it. */
function callName(frame: TimelineFrame): string | undefined {
  const id = frame.activePointers.current;
  if (typeof id !== "string" || !id.startsWith("call-")) return undefined;
  const node = frame.structures.treeData.find((n) => n.id === id);
  return node ? String(node.value) : undefined;
}

function debugSnapshot(frame: TimelineFrame, index: number) {
  return {
    frameIndex: index,
    step: frame.step,
    sourceLine: frame.sourceLine,
    coveredLines: frame.coveredLines,
    mode: frame.mode,
    overlayModes: frame.overlayModes,
    technique: frame.technique,
    techniques: frame.techniques,
    statusType: frame.statusType,
    conditionLabel: frame.conditionLabel,
    conditionMet: frame.conditionMet,
    activePointers: frame.activePointers,
    highlightedElements: frame.highlightedElements,
    changedIndices: frame.changedIndices,
    changedCells: frame.changedCells,
    structures: {
      arrayData: frame.structures.arrayData,
      mapsData: frame.structures.mapsData,
      containerData: frame.structures.containerData,
      resultData: frame.structures.resultData,
      gridData: frame.structures.gridData,
      listData: frame.structures.listData.map((n) => ({ id: n.id, value: n.value, next: n.next })),
      treeData: frame.structures.treeData.map((n) => ({
        id: n.id,
        value: n.value,
        children: n.children,
        parent: n.parent,
        note: n.note,
        done: n.done,
      })),
    },
  };
}
