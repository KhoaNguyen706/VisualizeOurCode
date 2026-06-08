"use client";

import { motion } from "framer-motion";
import type { TimelineFrame } from "@/lib/types";
import { statusColors } from "@/lib/theme";

interface GridModeProps {
  frame: TimelineFrame;
}

export function GridMode({ frame }: GridModeProps) {
  const { activePointers, highlightedElements, statusType, structures, variables } = frame;
  const grid = structures.gridData ?? [];
  const colors = statusColors(statusType);

  const row = typeof activePointers.row === "number" ? activePointers.row : undefined;
  const col = typeof activePointers.col === "number" ? activePointers.col : undefined;

  if (!grid.length || !grid[0]?.length) {
    return (
      <div className="text-center py-8 text-[#858585] font-code text-sm">DP table initializing…</div>
    );
  }

  const cols = grid[0].length;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="text-[10px] font-code uppercase tracking-wider text-[#858585]">
        DP Table {row !== undefined && col !== undefined ? `— cell [${row},${col}]` : ""}
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="w-8" />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="text-[9px] font-code text-[#858585] px-2 pb-1">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((rowVals, r) => (
              <tr key={r}>
                <td className="text-[9px] font-code text-[#858585] pr-2 text-right">{r}</td>
                {rowVals.map((val, c) => {
                  const key = `${r},${c}`;
                  const isActive = (row === r && col === c) || highlightedElements.includes(key);
                  return (
                    <td key={c} className="p-1">
                      <motion.div
                        layout
                        animate={{ scale: isActive ? 1.08 : 1 }}
                        className={`
                          w-12 h-12 rounded-md border-2 flex items-center justify-center
                          font-mono font-bold text-sm
                          ${isActive ? `${colors.bg} ${colors.border} ${colors.glow}` : "bg-[#2d2d2d] border-[#3c3c3c]"}
                        `}
                        style={{
                          boxShadow: isActive ? undefined : "0 3px 0 #1e1e1e",
                        }}
                      >
                        <span className={isActive ? colors.text : "text-[#d4d4d4]"}>{val}</span>
                      </motion.div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {variables?.nums && Array.isArray(variables.nums) && (
        <div className="text-[10px] font-code text-[#858585]">
          input: [{variables.nums.join(", ")}]
        </div>
      )}
    </div>
  );
}
