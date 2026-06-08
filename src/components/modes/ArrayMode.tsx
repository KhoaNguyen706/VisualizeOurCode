"use client";

import { motion } from "framer-motion";
import type { TimelineFrame } from "@/lib/types";
import { statusColors } from "@/lib/theme";
import { computeArrayLayout } from "@/lib/visual/arrayLayout";

interface ArrayModeProps {
  frame: TimelineFrame;
  compact?: boolean;
}

const SW_COLOR = "#3794ff";
const TP_COLOR = "#f0a830";
const BS_COLOR = "#c586c0";

function isLeftPointerLabel(label: string): boolean {
  return ["left", "l", "lo", "low", "i"].includes(label);
}

function isRightPointerLabel(label: string): boolean {
  return ["right", "r", "hi", "high", "j"].includes(label);
}

export function ArrayMode({ frame, compact = false }: ArrayModeProps) {
  const {
    activePointers,
    highlightedElements,
    statusType,
    structures,
    technique,
    conditionMet,
    conditionLabel,
    variables,
  } = frame;
  const { arrayData } = structures;
  const colors = statusColors(statusType);
  const layout = computeArrayLayout(arrayData.length, compact);
  const { cellPx, gap, fontSize, indexFontSize, totalWidth } = layout;

  const leftIdx =
    typeof activePointers.left === "number"
      ? activePointers.left
      : typeof activePointers.l === "number"
        ? activePointers.l
        : typeof activePointers.lo === "number"
          ? activePointers.lo
          : typeof activePointers.low === "number"
            ? activePointers.low
            : typeof activePointers.i === "number"
              ? activePointers.i
              : undefined;

  const rightIdx =
    typeof activePointers.right === "number"
      ? activePointers.right
      : typeof activePointers.r === "number"
        ? activePointers.r
        : typeof activePointers.hi === "number"
          ? activePointers.hi
          : typeof activePointers.high === "number"
            ? activePointers.high
            : typeof activePointers.j === "number"
              ? activePointers.j
              : undefined;

  const midIdx = typeof activePointers.mid === "number" ? activePointers.mid : undefined;

  const isSlidingWindow = technique === "sliding_window";
  const isTwoPointer = technique === "two_pointer";
  const isBinarySearch = technique === "binary_search";

  const showSlidingBox =
    isSlidingWindow &&
    leftIdx !== undefined &&
    rightIdx !== undefined &&
    leftIdx >= 0 &&
    rightIdx >= 0 &&
    leftIdx <= rightIdx;

  const showTwoPointerPair =
    (isTwoPointer || isBinarySearch) &&
    leftIdx !== undefined &&
    rightIdx !== undefined &&
    leftIdx >= 0 &&
    rightIdx >= 0;

  const currentI = typeof activePointers.i === "number" ? activePointers.i : undefined;
  const currentNum = variables?.num;

  const ptrTop = new Map<number, string[]>();
  const ptrBottom = new Map<number, string[]>();

  const registerPtr = (index: number, label: string, slot: "top" | "bottom") => {
    const map = slot === "top" ? ptrTop : ptrBottom;
    const list = map.get(index) ?? [];
    if (!list.includes(label)) list.push(label);
    map.set(index, list);
  };

  if (isSlidingWindow) {
    if (leftIdx !== undefined && leftIdx >= 0) registerPtr(leftIdx, "left", "top");
    if (rightIdx !== undefined && rightIdx >= 0) registerPtr(rightIdx, "right", "bottom");
  } else if (isTwoPointer || isBinarySearch) {
    if (leftIdx !== undefined && leftIdx >= 0) {
      if (leftIdx === rightIdx) registerPtr(leftIdx, "L·R", "top");
      else registerPtr(leftIdx, "L", "top");
    }
    if (rightIdx !== undefined && rightIdx >= 0 && rightIdx !== leftIdx) {
      registerPtr(rightIdx, "R", "bottom");
    }
    if (midIdx !== undefined && midIdx >= 0) registerPtr(midIdx, "mid", "top");
  } else {
    for (const [label, val] of Object.entries(activePointers)) {
      if (typeof val !== "number" || val < 0) continue;
      if (isLeftPointerLabel(label)) registerPtr(val, label, "top");
      else if (isRightPointerLabel(label)) registerPtr(val, label, "bottom");
      else if (label === "mid") registerPtr(val, "mid", "top");
      else registerPtr(val, label, "top");
    }
  }

  const pointerColor = isSlidingWindow ? SW_COLOR : isTwoPointer || isBinarySearch ? TP_COLOR : SW_COLOR;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {conditionLabel !== undefined && conditionMet !== undefined && (
        <motion.div
          key={`${conditionLabel}-${conditionMet}`}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`px-4 py-2 rounded-lg border text-xs font-code uppercase tracking-wider ${
            conditionMet
              ? "border-[#4ec9b0] bg-[#4ec9b0]/15 text-[#4ec9b0]"
              : "border-[#f48771] bg-[#f48771]/15 text-[#f48771]"
          }`}
        >
          {conditionLabel} → {conditionMet ? "YES" : "NO"}
        </motion.div>
      )}

      {technique === "hash_set" && currentI !== undefined && currentNum !== undefined && currentNum !== null && (
        <div className="text-[11px] font-code text-[#9cdcfe]">
          i={currentI} · num = <span className="font-bold text-[#dcdcaa]">{String(currentNum)}</span>
        </div>
      )}

      {showTwoPointerPair && !isSlidingWindow && (
        <div
          className="px-3 py-1 rounded-full border text-[11px] font-code font-bold tracking-wide"
          style={{ borderColor: `${TP_COLOR}66`, color: TP_COLOR, background: `${TP_COLOR}14` }}
        >
          {leftIdx === rightIdx
            ? `L = R = ${leftIdx}`
            : isBinarySearch
              ? `L=${leftIdx}  mid=${midIdx ?? "?"}  R=${rightIdx}`
              : `L = ${leftIdx}  ·  R = ${rightIdx}`}
        </div>
      )}

      {showSlidingBox && (
        <div
          className="px-3 py-1 rounded-full border text-[11px] font-code font-bold"
          style={{ borderColor: `${SW_COLOR}66`, color: SW_COLOR, background: `${SW_COLOR}14` }}
        >
          window [{leftIdx}..{rightIdx}] · size {rightIdx! - leftIdx! + 1}
        </div>
      )}

      <div className="w-full overflow-x-auto flex justify-center py-1">
        <div className="relative shrink-0" style={{ width: totalWidth }}>
          {showSlidingBox && (
            <motion.div
              layout
              key={`sw-${leftIdx}-${rightIdx}`}
              className="absolute pointer-events-none rounded-xl border-2 border-[#3794ff]/70"
              style={{
                left: leftIdx! * (cellPx + gap),
                top: 28,
                height: cellPx + 4,
                width: (rightIdx! - leftIdx! + 1) * (cellPx + gap) - gap,
                background: "rgba(55, 148, 255, 0.14)",
              }}
            />
          )}

          <div className="flex items-end flex-nowrap" style={{ gap }}>
            {arrayData.map((value, index) => {
              const tops = ptrTop.get(index) ?? [];
              const bottoms = ptrBottom.get(index) ?? [];
              const isHighlighted = highlightedElements.includes(index);
              const inWindow = showSlidingBox && index >= leftIdx! && index <= rightIdx!;
              const isTwoPointerEnd =
                showTwoPointerPair && !isSlidingWindow && (index === leftIdx || index === rightIdx);
              const isMidCell = isBinarySearch && midIdx === index;
              const isConditionCell = currentI === index && conditionMet !== undefined;
              const hasTopPtr = tops.length > 0;
              const hasBottomPtr = bottoms.length > 0;

              return (
                <motion.div
                  key={`${index}-${value}`}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: isHighlighted || isTwoPointerEnd ? 1.06 : 1 }}
                  className="flex flex-col items-center shrink-0 relative z-10"
                  style={{ width: cellPx }}
                >
                  {/* Top pointer slot — fixed height so labels never overlap cells */}
                  <div className="flex flex-col items-center justify-end mb-1" style={{ height: 32, minHeight: 32 }}>
                    {hasTopPtr && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <span
                          className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                          style={{ color: pointerColor, background: `${pointerColor}22` }}
                        >
                          {tops.join(" ")}
                        </span>
                        <svg width="10" height="10" viewBox="0 0 10 10" style={{ color: pointerColor }}>
                          <path d="M5 0 L5 7 M2 5 L5 8 L8 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </motion.div>
                    )}
                  </div>

                  {/* Cell */}
                  <motion.div
                    className={`
                      rounded-lg border-2 flex items-center justify-center font-mono font-bold
                      ${isHighlighted ? `${colors.bg} ${colors.border} ${colors.glow}` : "border-[#3c3c3c]"}
                      ${isTwoPointerEnd ? "ring-2 ring-[#f0a830]/80" : ""}
                      ${isMidCell ? "ring-2 ring-[#c586c0]/80" : ""}
                      ${inWindow && !isHighlighted ? "border-[#3794ff]/70 bg-[#3794ff]/12" : ""}
                      ${isConditionCell ? (conditionMet ? "ring-2 ring-[#4ec9b0]/80" : "ring-2 ring-[#f48771]/80") : ""}
                    `}
                    style={{
                      width: cellPx,
                      height: cellPx,
                      fontSize,
                      background: isHighlighted
                        ? undefined
                        : isConditionCell
                          ? conditionMet
                            ? "rgba(78,201,176,0.12)"
                            : "rgba(244,135,113,0.12)"
                          : isTwoPointerEnd
                            ? "rgba(240,168,48,0.1)"
                            : isMidCell
                              ? "rgba(197,134,192,0.1)"
                              : inWindow
                                ? undefined
                                : "#2d2d2d",
                      boxShadow: "0 3px 0 #1e1e1e",
                    }}
                  >
                    <span
                      className={
                        isHighlighted
                          ? colors.text
                          : inWindow
                            ? "text-[#3794ff]"
                            : isTwoPointerEnd
                              ? "text-[#f0a830]"
                              : isMidCell
                                ? "text-[#c586c0]"
                                : "text-[#d4d4d4]"
                      }
                    >
                      {value}
                    </span>
                  </motion.div>

                  {/* Index */}
                  <span
                    className="font-code mt-1"
                    style={{
                      fontSize: indexFontSize,
                      color: isTwoPointerEnd ? TP_COLOR : inWindow ? SW_COLOR : "#858585",
                    }}
                  >
                    {index}
                  </span>

                  {/* Bottom pointer slot */}
                  <div className="flex flex-col items-center justify-start mt-1" style={{ height: 32, minHeight: 32 }}>
                    {hasBottomPtr && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" style={{ color: pointerColor }}>
                          <path d="M5 10 L5 3 M2 6 L5 3 L8 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <span
                          className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                          style={{ color: pointerColor, background: `${pointerColor}22` }}
                        >
                          {bottoms.join(" ")}
                        </span>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
