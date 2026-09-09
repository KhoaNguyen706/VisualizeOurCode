"use client";

import { motion } from "framer-motion";
import type { TimelineFrame } from "@/lib/types";

interface GridModeProps {
  frame: TimelineFrame;
}

type CellValue = number | string;

/**
 * Sequential blue, light→dark; lightest means nearest zero. The steps live in
 * globals.css because each appearance needs its own — a dark ramp flipped onto
 * a white surface is not the same ramp. Both sets were validated as ordinal
 * ramps against their own surface: monotone lightness, adjacent gaps >= 0.06,
 * and a pale end that still clears 2:1.
 */
const RAMP = ["var(--ramp-1)", "var(--ramp-2)", "var(--ramp-3)", "var(--ramp-4)", "var(--ramp-5)"];
/** Ink follows the fill's lightness — text never wears the series colour itself. */
const RAMP_INK = [
  "var(--ramp-ink-1)",
  "var(--ramp-ink-2)",
  "var(--ramp-ink-3)",
  "var(--ramp-ink-4)",
  "var(--ramp-ink-5)",
];

const SURFACE = "var(--mac-inset)";
const OUT_OF_DOMAIN = "var(--cell-neg)"; // negatives: outside the magnitude scale
const UNREACHED = "var(--cell-void)"; // sentinels: present but never written

/** Anything this large is a "not yet reached" sentinel, not a real magnitude. */
const SENTINEL_MIN = 1e9;

function isSentinel(v: CellValue): boolean {
  if (typeof v === "string") return /^-?inf(inity)?$/i.test(v);
  return Number.isFinite(v) ? Math.abs(v) >= SENTINEL_MIN : true;
}

function isNumeric(v: CellValue): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Shorten a sentinel to a glyph; every other value is shown exactly as it is. */
function display(v: CellValue): string {
  if (isSentinel(v)) return typeof v === "number" && v < 0 ? "−∞" : "∞";
  return String(v);
}

export function GridMode({ frame }: GridModeProps) {
  const { activePointers, highlightedElements, structures, variables } = frame;
  const grid = (structures.gridData ?? []) as CellValue[][];
  const changed = new Set(frame.changedCells ?? []);

  const [row, col] = findCursor(activePointers, grid.length, grid[0]?.length ?? 0);

  // Only a tabulation builds a DP table. A BFS, a DFS or a flood fill walks the
  // caller's own matrix, and calling that a DP table renames the algorithm.
  const title = frame.technique === "dp_grid" ? "DP Table" : "Grid";

  if (!grid.length || !grid[0]?.length) {
    return (
      <div className="text-center py-8 text-[var(--mac-text-2)] font-code text-sm">
        {title.toLowerCase()} initializing…
      </div>
    );
  }

  // The scale is read off the data rather than assumed: every finite,
  // non-negative, non-sentinel cell is a magnitude. Negatives and sentinels sit
  // outside it and get their own recessive treatment, so the ramp is never
  // stretched by a placeholder value.
  const magnitudes = grid
    .flat()
    .filter((v): v is number => isNumeric(v) && v >= 0 && !isSentinel(v));
  const min = magnitudes.length ? Math.min(...magnitudes) : 0;
  const max = magnitudes.length ? Math.max(...magnitudes) : 0;

  const rampIndex = (v: number): number => {
    if (max === min) return 0;
    const t = (v - min) / (max - min);
    return Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1)));
  };

  // Cells named by a pending list of coordinates — a BFS frontier, a DFS stack.
  // Drawn as a ring, never colour alone, and attributed to the variable it came
  // from so it stays a statement about the author's data.
  const frontier = findCoordinateList(variables, grid.length, grid[0].length);
  const pending = new Set(frontier?.cells ?? []);

  // Grow the cells to fill the canvas rather than leaving a small board adrift
  // in it, while staying small enough that a large matrix still fits.
  const widest = Math.max(...grid.flat().map((v) => display(v).length), 1);
  const span = Math.max(grid.length, grid[0].length);
  const size = Math.max(26, Math.min(78, Math.floor(460 / span) - 4, widest * 13 + 26));

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-code uppercase tracking-[0.12em] text-[var(--mac-text)]">
          {title}
        </span>
        <span className="text-[10px] font-code text-[var(--mac-text-3)]">
          {grid.length}×{grid[0].length}
          {row !== undefined && col !== undefined ? `  ·  at [${row},${col}]` : ""}
        </span>
      </div>

      <div className="overflow-x-auto max-w-full">
        <div className="inline-flex flex-col gap-[3px] p-1">
          <div className="flex gap-[3px] pl-[18px]">
            {grid[0].map((_, c) => (
              <div
                key={c}
                className="text-[9px] font-code text-[var(--mac-text-3)] text-center"
                style={{ width: size }}
              >
                {c}
              </div>
            ))}
          </div>

          {grid.map((rowVals, r) => (
            <div key={r} className="flex gap-[3px] items-center">
              <div className="w-[18px] text-[9px] font-code text-[var(--mac-text-3)] text-right pr-1.5">
                {r}
              </div>
              {rowVals.map((val, c) => {
                const key = `${r},${c}`;
                const isActive = (row === r && col === c) || highlightedElements.includes(key);
                const justChanged = changed.has(key);
                const inFrontier = pending.has(key);

                const sentinel = isSentinel(val);
                const negative = isNumeric(val) && val < 0;
                const step = !sentinel && !negative && isNumeric(val) ? rampIndex(val) : -1;

                const fill = sentinel ? UNREACHED : negative ? OUT_OF_DOMAIN : step >= 0 ? RAMP[step] : SURFACE;
                const ink = sentinel
                  ? "var(--cell-void-ink)"
                  : negative
                    ? "var(--cell-neg-ink)"
                    : step >= 0
                      ? RAMP_INK[step]
                      : "var(--mac-text)";

                return (
                  <motion.div
                    key={`${key}:${val}`}
                    layout
                    initial={false}
                    animate={
                      justChanged
                        ? { scale: [1.16, 1], opacity: [0.45, 1] }
                        : { scale: isActive ? 1.06 : 1, opacity: 1 }
                    }
                    transition={{ duration: justChanged ? 0.4 : 0.18 }}
                    className="rounded-[7px] flex items-center justify-center font-code font-semibold tabular-nums select-none"
                    style={{
                      width: size,
                      height: size,
                      background: fill,
                      color: ink,
                      fontSize: widest >= 6 ? 11 : 13,
                      // The ring is the state channel, kept off the fill so it
                      // never competes with the magnitude the fill encodes.
                      boxShadow: isActive
                        ? "0 0 0 2.5px var(--mac-text), 0 0 0 5px var(--mac-ring)"
                        : justChanged
                          ? "0 0 0 2.5px var(--mac-good)"
                          : inFrontier
                            ? "0 0 0 2.5px var(--mac-warn)"
                            : "inset 0 0 0 1px var(--mac-ring)",
                    }}
                  >
                    {display(val)}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <Legend
        min={min}
        max={max}
        hasNegative={grid.flat().some((v) => isNumeric(v) && v < 0)}
        hasSentinel={grid.flat().some(isSentinel)}
        frontierName={frontier?.name}
        frontierCount={frontier?.cells.length ?? 0}
      />
    </div>
  );
}

/**
 * The cell the code is standing on. Authors name their cursor whatever they
 * like — `r, c` as often as `row, col` — so the conventional pairs are tried in
 * turn and only accepted when both halves are inside the grid.
 */
function findCursor(
  pointers: TimelineFrame["activePointers"],
  rows: number,
  cols: number
): [number | undefined, number | undefined] {
  const pairs: [string, string][] = [
    ["row", "col"],
    ["r", "c"],
    ["i", "j"],
    ["y", "x"],
    ["cr", "cc"],
  ];
  for (const [rk, ck] of pairs) {
    const r = pointers[rk];
    const c = pointers[ck];
    if (
      typeof r === "number" &&
      typeof c === "number" &&
      r >= 0 &&
      r < rows &&
      c >= 0 &&
      c < cols
    ) {
      return [r, c];
    }
  }
  return [undefined, undefined];
}

/**
 * The first variable holding a list of in-bounds `[row, col]` pairs. This is the
 * queue or stack the author is driving the walk with, so the cells it names can
 * be ringed on the board.
 */
function findCoordinateList(
  variables: TimelineFrame["variables"],
  rows: number,
  cols: number
): { name: string; cells: string[] } | null {
  for (const [name, value] of Object.entries(variables ?? {})) {
    if (!Array.isArray(value) || value.length === 0) continue;
    const pairs = value as unknown[];
    const ok = pairs.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        typeof p[0] === "number" &&
        typeof p[1] === "number" &&
        Number.isInteger(p[0]) &&
        Number.isInteger(p[1]) &&
        p[0] >= 0 &&
        p[0] < rows &&
        p[1] >= 0 &&
        p[1] < cols
    );
    if (ok) {
      return {
        name,
        cells: (pairs as [number, number][]).map(([r, c]) => `${r},${c}`),
      };
    }
  }
  return null;
}

function Legend({
  min,
  max,
  hasNegative,
  hasSentinel,
  frontierName,
  frontierCount,
}: {
  min: number;
  max: number;
  hasNegative: boolean;
  hasSentinel: boolean;
  frontierName?: string;
  frontierCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] font-code text-[var(--mac-text-2)]">
      <div className="flex items-center gap-1.5">
        <span className="tabular-nums">{min}</span>
        <div className="flex">
          {RAMP.map((c, i) => (
            <span
              key={c}
              className="w-4 h-3"
              style={{
                background: c,
                borderTopLeftRadius: i === 0 ? 3 : 0,
                borderBottomLeftRadius: i === 0 ? 3 : 0,
                borderTopRightRadius: i === RAMP.length - 1 ? 3 : 0,
                borderBottomRightRadius: i === RAMP.length - 1 ? 3 : 0,
              }}
            />
          ))}
        </div>
        <span className="tabular-nums">{max}</span>
      </div>

      {hasNegative && <Chip swatch={OUT_OF_DOMAIN} label="negative" />}
      {hasSentinel && <Chip swatch={UNREACHED} label="∞ sentinel" />}
      {frontierName && (
        <div className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-[3px]"
            style={{ boxShadow: "inset 0 0 0 2px var(--mac-warn)" }}
          />
          <span>
            in {frontierName} ({frontierCount})
          </span>
        </div>
      )}
    </div>
  );
}

function Chip({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-[3px]" style={{ background: swatch }} />
      <span>{label}</span>
    </div>
  );
}
