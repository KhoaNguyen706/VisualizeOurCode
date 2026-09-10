"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { TimelineFrame } from "@/lib/types";

interface IntervalModeProps {
  frame: TimelineFrame;
}

const ROW_H = 22;
const BAR_H = 14;
const AXIS_H = 26;
const LEFT_PAD = 12;
const RIGHT_PAD = 12;

/**
 * Intervals as bars on one shared number line — the picture that makes an
 * overlap visible at a glance, where a list of pairs hides it. The bars are
 * drawn in the order the list holds them: if the author forgot to sort, the
 * bars come out in the wrong order, which is exactly the thing to notice.
 *
 * The bar whose index the code is at (`i`) is filled; the one just before it
 * is outlined, since a merge is always a comparison between the two.
 */
export function IntervalMode({ frame }: IntervalModeProps) {
  const view = frame.structures.intervalData;
  if (!view) return null;

  const all = [...view.items, ...(view.secondary?.items ?? [])];
  const lo = Math.min(...all.map(([a]) => a));
  const hi = Math.max(...all.map(([, b]) => b));
  const span = Math.max(1, hi - lo);
  const width = 560;
  const usable = width - LEFT_PAD - RIGHT_PAD;
  const x = (v: number) => LEFT_PAD + ((v - lo) / span) * usable;

  const idx = typeof frame.activePointers.i === "number" ? frame.activePointers.i : undefined;

  // Tick marks at round numbers so the axis reads as a ruler.
  const rawStep = span / 8;
  const mag = 10 ** Math.floor(Math.log10(rawStep || 1));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? mag;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);

  const rows = (items: [number, number][], keyPrefix: string, active: number | undefined) =>
    items.map(([a, b], i) => {
      const isActive = active === i;
      const isPrev = active !== undefined && i === active - 1;
      const x1 = x(a);
      const x2 = Math.max(x(b), x1 + 3);
      return (
        <motion.g
          key={`${keyPrefix}-${i}`}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <rect
            x={x1}
            y={i * ROW_H + (ROW_H - BAR_H) / 2}
            width={x2 - x1}
            height={BAR_H}
            rx={4}
            fill={isActive ? "var(--mac-accent)" : isPrev ? "var(--mac-accent-soft)" : "var(--ramp-2)"}
            stroke={isActive || isPrev ? "var(--mac-accent)" : "none"}
            strokeWidth={1.5}
            opacity={isActive || isPrev ? 1 : 0.85}
          />
          <text
            x={x1 + 5}
            y={i * ROW_H + ROW_H / 2}
            dominantBaseline="central"
            fontSize={10}
            className="font-code"
            fill={isActive ? "var(--mac-accent-ink)" : "var(--ramp-ink-2)"}
          >
            [{a}, {b}]
          </text>
        </motion.g>
      );
    });

  const primaryH = view.items.length * ROW_H;
  const secondaryH = view.secondary ? view.secondary.items.length * ROW_H + 18 : 0;
  const height = primaryH + secondaryH + AXIS_H + 4;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-code uppercase tracking-wider text-[var(--mac-text-2)]">Intervals</span>
        <span className="text-[11px] font-code text-[var(--mac-accent)]">{view.name}</span>
        <span className="text-[10px] font-code text-[var(--mac-text-2)]">
          {view.items.length} interval{view.items.length === 1 ? "" : "s"}
          {view.secondary ? ` · ${view.secondary.name} holds ${view.secondary.items.length}` : ""}
        </span>
      </div>
      <div className="w-full overflow-x-auto flex justify-center">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block select-none">
          {/* Faint vertical guides make it possible to compare ends across rows. */}
          {ticks.map((t) => (
            <line
              key={`g${t}`}
              x1={x(t)}
              x2={x(t)}
              y1={0}
              y2={height - AXIS_H}
              stroke="var(--mac-separator)"
              strokeDasharray="2 3"
            />
          ))}
          <AnimatePresence initial={false}>{rows(view.items, "p", idx)}</AnimatePresence>
          {view.secondary && (
            <g transform={`translate(0, ${primaryH + 18})`}>
              <text
                x={LEFT_PAD}
                y={-8}
                fontSize={9}
                className="font-code uppercase"
                fill="var(--mac-text-2)"
                letterSpacing={1}
              >
                {view.secondary.name}
              </text>
              <AnimatePresence initial={false}>{rows(view.secondary.items, "s", undefined)}</AnimatePresence>
            </g>
          )}
          <g transform={`translate(0, ${height - AXIS_H + 6})`}>
            <line x1={LEFT_PAD} x2={width - RIGHT_PAD} y1={0} y2={0} stroke="var(--mac-border)" />
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={0} y2={4} stroke="var(--mac-border)" />
                <text
                  x={x(t)}
                  y={14}
                  textAnchor="middle"
                  fontSize={9}
                  className="font-code"
                  fill="var(--mac-text-2)"
                >
                  {t}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
