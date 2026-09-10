"use client";

import { motion } from "framer-motion";
import type { TimelineFrame } from "@/lib/types";

interface BitModeProps {
  frame: TimelineFrame;
}

const CELL = 18;
const GAP = 2;
const NAME_W = 68;

/** Enough bits to show every value on screen, in whole bytes, at least one. */
function bitWidth(values: number[]): number {
  let needed = 1;
  for (const v of values) {
    const mag = v < 0 ? 32 : Math.max(1, Math.floor(Math.log2(v || 1)) + 1);
    needed = Math.max(needed, mag);
  }
  return Math.min(32, Math.ceil(needed / 8) * 8);
}

/** The `width` low bits of `v`, two's complement for a negative, most significant first. */
function bitsOf(v: number, width: number): number[] {
  const u = v < 0 ? (v >>> 0) : v;
  const out: number[] = [];
  for (let b = width - 1; b >= 0; b -= 1) out.push((u >>> b) & 1);
  return out;
}

/**
 * Each integer the code holds, as its binary digits. Bit problems are about
 * the digits — which ones are set, what shifts and masks do to them — and a
 * decimal number hides all of that. Set bits are filled so a mask reads as a
 * shape; the digits that changed since the last step are outlined.
 */
export function BitMode({ frame }: BitModeProps) {
  const views = frame.structures.bitData ?? [];
  if (views.length === 0) return null;

  const width = bitWidth(views.map((v) => v.value));
  const changed = new Set(frame.changedVariables ?? []);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-code uppercase tracking-wider text-[var(--mac-text-2)]">Bits</span>
        <span className="text-[10px] font-code text-[var(--mac-text-2)]">
          {width}-bit · most significant on the left
        </span>
      </div>
      <div className="w-full overflow-x-auto">
        <div className="flex flex-col gap-1.5 items-start mx-auto w-max">
          {views.map(({ name, value }) => {
            const bits = bitsOf(value, width);
            const hot = changed.has(name);
            return (
              <div key={name} className="flex items-center gap-2">
                <span
                  className="font-code text-[11px] text-right shrink-0"
                  style={{ width: NAME_W, color: hot ? "var(--mac-accent)" : "var(--mac-text)" }}
                >
                  {name}
                </span>
                <div className="flex" style={{ gap: GAP }}>
                  {bits.map((b, i) => {
                    const byteStart = i > 0 && (width - i) % 8 === 0;
                    return (
                      <motion.span
                        key={i}
                        layout
                        animate={{
                          background: b ? "var(--ramp-3)" : "var(--mac-inset)",
                          color: b ? "var(--ramp-ink-3)" : "var(--mac-text-3)",
                        }}
                        transition={{ duration: 0.18 }}
                        className="font-code text-[10px] flex items-center justify-center rounded-[3px] select-none"
                        style={{
                          width: CELL,
                          height: CELL,
                          marginLeft: byteStart ? 6 : 0,
                          border: `1px solid ${hot ? "var(--mac-accent)" : "var(--mac-separator)"}`,
                        }}
                      >
                        {b}
                      </motion.span>
                    );
                  })}
                </div>
                <span
                  className="font-code text-[11px] tabular-nums shrink-0"
                  style={{ color: "var(--mac-text-2)", minWidth: 56 }}
                >
                  = {value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
