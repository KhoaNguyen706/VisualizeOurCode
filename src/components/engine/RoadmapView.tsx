"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { EDGES, TOPICS, samplesFor, topicById, type Topic, type TopicId } from "@/lib/roadmap";
import type { CodeSample } from "@/lib/samples";

interface RoadmapViewProps {
  /** The topic the run on screen landed on, lit as "you are here". */
  currentTopic?: TopicId;
  /** Load a sample into the editor and run it. */
  onRunSample: (id: string) => void;
  /** Load a sample into the editor without running it. */
  onLoadSample: (id: string) => void;
  /** Shown in a dialog: a close affordance is offered. */
  onClose?: () => void;
  /** Tighter spacing for the overlay. */
  compact?: boolean;
}

const VIEW_W = 1000;
const VIEW_H = 880;
const NODE_H = 48;
const CHAR_W = 8;
const PAD_X = 20;
const FONT = 15;

function nodeWidth(label: string): number {
  return Math.max(88, Math.ceil(label.length * CHAR_W) + PAD_X * 2);
}

interface Placed extends Topic {
  cx: number;
  cy: number;
  w: number;
}

function placeTopics(): Placed[] {
  return TOPICS.map((t) => {
    const w = nodeWidth(t.label);
    // Keep every node whole inside the map, whatever its label's width.
    const cx = Math.min(Math.max(t.x * VIEW_W, w / 2 + 8), VIEW_W - w / 2 - 8);
    return { ...t, cx, cy: t.y * VIEW_H, w };
  });
}

/** A parent-to-child link, bowed the way NeetCode draws them. */
function edgePath(from: Placed, to: Placed): string {
  const x1 = from.cx;
  const y1 = from.cy + NODE_H / 2;
  const x2 = to.cx;
  const y2 = to.cy - NODE_H / 2;
  const dy = Math.max(30, (y2 - y1) * 0.55);
  return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
}

/**
 * The NeetCode map, drawn as this tool's own table of contents.
 *
 * Every node is a topic the engine recognises; selecting one says what the
 * canvas will draw for it and offers its worked problems to run. The topic the
 * current run landed on is lit, so the map also answers "what did it read my
 * code as?".
 */
export function RoadmapView({ currentTopic, onRunSample, onLoadSample, onClose, compact }: RoadmapViewProps) {
  const placed = useMemo(placeTopics, []);
  const byId = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed]);
  const [selected, setSelected] = useState<TopicId | undefined>(currentTopic);
  const [hovered, setHovered] = useState<TopicId | undefined>();

  const focus = selected ?? hovered;
  const topic = focus ? topicById(focus) : undefined;
  const samples = focus ? samplesFor(focus) : [];
  const totalSamples = TOPICS.reduce((n, t) => n + samplesFor(t.id).length, 0);

  // Edges touching the focused topic are drawn on top, in the accent.
  const related = new Set<string>();
  if (focus) for (const [a, b] of EDGES) if (a === focus || b === focus) related.add(`${a}-${b}`);

  return (
    <div className={`flex flex-col ${compact ? "gap-2" : "gap-4"} w-full`}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[15px] font-medium" style={{ color: "var(--mac-text)" }}>
            The roadmap
          </p>
          <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--mac-text-2)" }}>
            Every topic is one the tracer can draw. Pick a node to see what the picture is and run a worked problem,
            or paste any solution of your own.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-code" style={{ color: "var(--mac-text-3)" }}>
            {TOPICS.length} topics · {totalSamples} problems
          </span>
          {onClose && (
            <button type="button" className="mac-btn" style={{ height: 22, padding: "0 9px", fontSize: 11 }} onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div
          className="w-full rounded-[10px] overflow-hidden"
          style={{
            background:
              "radial-gradient(var(--mac-separator) 1px, transparent 1px) 0 0 / 22px 22px, var(--mac-inset)",
            border: "1px solid var(--mac-separator)",
          }}
        >
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block w-full h-auto select-none">
            {EDGES.map(([a, b]) => {
              const from = byId.get(a)!;
              const to = byId.get(b)!;
              const hot = related.has(`${a}-${b}`);
              return (
                <path
                  key={`${a}-${b}`}
                  d={edgePath(from, to)}
                  fill="none"
                  stroke={hot ? "var(--mac-accent)" : "var(--mac-border)"}
                  strokeWidth={hot ? 2.5 : 1.8}
                  opacity={hot ? 1 : 0.9}
                />
              );
            })}
            {placed.map((p) => {
              const isCurrent = p.id === currentTopic;
              const isFocus = p.id === focus;
              const count = samplesFor(p.id).length;
              return (
                <motion.g
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  aria-label={p.label}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHovered(p.id)}
                  onMouseLeave={() => setHovered(undefined)}
                  onClick={() => setSelected((s) => (s === p.id ? undefined : p.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(p.id);
                    }
                  }}
                  animate={{ scale: isFocus ? 1.04 : 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                >
                  <rect
                    x={p.cx - p.w / 2}
                    y={p.cy - NODE_H / 2}
                    width={p.w}
                    height={NODE_H}
                    rx={9}
                    fill={isCurrent ? "var(--mac-accent)" : isFocus ? "var(--mac-accent-soft)" : "var(--mac-raised)"}
                    stroke={isCurrent || isFocus ? "var(--mac-accent)" : "var(--mac-border)"}
                    strokeWidth={isCurrent ? 2 : 1.2}
                    style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.08))" }}
                  />
                  <text
                    x={p.cx}
                    y={p.cy - 4}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={FONT}
                    fontWeight={600}
                    fill={isCurrent ? "var(--mac-accent-ink)" : "var(--mac-text)"}
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {p.label}
                  </text>
                  {/* The bar under the label: how many worked problems the topic has. */}
                  <rect
                    x={p.cx - p.w / 2 + 14}
                    y={p.cy + NODE_H / 2 - 9}
                    width={p.w - 28}
                    height={3}
                    rx={1.5}
                    fill={isCurrent ? "rgba(255,255,255,0.35)" : "var(--mac-separator)"}
                  />
                  <rect
                    x={p.cx - p.w / 2 + 14}
                    y={p.cy + NODE_H / 2 - 9}
                    width={(p.w - 28) * Math.min(1, count / 3)}
                    height={3}
                    rx={1.5}
                    fill={isCurrent ? "var(--mac-accent-ink)" : "var(--mac-good)"}
                  />
                  {isCurrent && (
                    <text
                      x={p.cx + p.w / 2 + 8}
                      y={p.cy}
                      dominantBaseline="central"
                      fontSize={11}
                      fill="var(--mac-accent)"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      ◀ your code
                    </text>
                  )}
                </motion.g>
              );
            })}
          </svg>
        </div>

        <TopicCard topic={topic} samples={samples} isCurrent={!!topic && topic.id === currentTopic} onRun={onRunSample} onLoad={onLoadSample} />
      </div>
    </div>
  );
}

function TopicCard({
  topic,
  samples,
  isCurrent,
  onRun,
  onLoad,
}: {
  topic?: Topic;
  samples: CodeSample[];
  isCurrent: boolean;
  onRun: (id: string) => void;
  onLoad: (id: string) => void;
}) {
  return (
    <aside
      className="shrink-0 rounded-[10px] p-4 flex flex-col gap-3"
      style={{
        minHeight: 96,
        background: "var(--mac-content)",
        border: "1px solid var(--mac-separator)",
      }}
    >
      {!topic ? (
        <div className="text-[12px] leading-relaxed" style={{ color: "var(--mac-text-2)" }}>
          <p className="text-[13px] font-medium mb-1" style={{ color: "var(--mac-text)" }}>
            Pick a topic
          </p>
          <p>Hover or click a node to see what the canvas draws for it, and the problems ready to run.</p>
          <p className="mt-2">
            The green bar under each node counts its worked problems. Your own code lands on a node when you
            run it.
          </p>
        </div>
      ) : (
        <>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold" style={{ color: "var(--mac-text)" }}>
                {topic.label}
              </p>
              {isCurrent && (
                <span
                  className="px-1.5 py-0.5 text-[9px] font-code uppercase tracking-wider rounded"
                  style={{ background: "var(--mac-accent-soft)", color: "var(--mac-accent)" }}
                >
                  your code
                </span>
              )}
            </div>
            <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--mac-text-2)" }}>
              <span style={{ color: "var(--mac-text)" }}>Draws:</span> {topic.draws}.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-code uppercase tracking-wider" style={{ color: "var(--mac-text-3)" }}>
              Worked problems
            </p>
            {samples.length === 0 && (
              <p className="text-[12px]" style={{ color: "var(--mac-text-2)" }}>
                None yet — paste your own.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
            {samples.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-[7px] px-2.5 py-1.5"
                style={{ background: "var(--mac-inset)", border: "1px solid var(--mac-separator)", minWidth: 260, flex: "1 1 260px", maxWidth: 420 }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] truncate" style={{ color: "var(--mac-text)" }}>
                    {s.label}
                  </div>
                  <div className="text-[10px] font-code" style={{ color: "var(--mac-text-3)" }}>
                    {s.language}
                  </div>
                </div>
                <button
                  type="button"
                  className="mac-btn"
                  style={{ height: 22, padding: "0 8px", fontSize: 11 }}
                  onClick={() => onLoad(s.id)}
                  title="Put this in the editor"
                >
                  Open
                </button>
                <button
                  type="button"
                  className="mac-btn mac-btn-primary"
                  style={{ height: 22, padding: "0 8px", fontSize: 11 }}
                  onClick={() => onRun(s.id)}
                  title="Run and trace it"
                >
                  Run
                </button>
              </div>
            ))}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
