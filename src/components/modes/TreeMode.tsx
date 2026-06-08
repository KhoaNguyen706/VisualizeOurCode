"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TimelineFrame, TreeNode } from "@/lib/types";
import { statusColors } from "@/lib/theme";

interface TreeModeProps {
  frame: TimelineFrame;
}

const NODE_R = 28;
const LEVEL_H = 90;
const SIBLING_GAP = 80;

export function TreeMode({ frame }: TreeModeProps) {
  const { activePointers, highlightedElements, statusType, structures } = frame;
  const { treeData } = structures;
  const colors = statusColors(statusType);
  const currentId = activePointers.current as string | null | undefined;

  const { positioned, edges, width, height } = useMemo(
    () => layoutTree(treeData),
    [treeData]
  );

  if (!treeData.length) {
    return (
      <div className="text-center py-12 text-[#858585] font-code text-sm">
        Empty tree
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto py-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto min-w-[400px]"
        style={{ maxWidth: "100%", height: "auto" }}
      >
        <AnimatePresence>
          {edges.map((edge) => {
            const active =
              highlightedElements.includes(edge.from) ||
              highlightedElements.includes(edge.to) ||
              currentId === edge.from ||
              currentId === edge.to;
            return (
              <motion.line
                key={`${edge.from}-${edge.to}`}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke={active ? "#3794ff" : "#3c3c3c"}
                strokeWidth={active ? 2.5 : 1.5}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
              />
            );
          })}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {positioned.map((node) => {
            const isHighlighted = highlightedElements.includes(node.id);
            const isCurrent = currentId === node.id;
            const isSuccess = String(node.value).startsWith("✓");
            const isFail = String(node.value).startsWith("✗");

            const fill = isSuccess
              ? "rgba(78,201,176,0.2)"
              : isFail
                ? "rgba(244,135,113,0.2)"
                : isHighlighted
                  ? "rgba(55,148,255,0.15)"
                  : "#2d2d2d";

            const stroke = isSuccess
              ? "#4ec9b0"
              : isFail
                ? "#f48771"
                : isCurrent
                  ? "#3794ff"
                  : isHighlighted
                    ? "#3794ff"
                    : "#3c3c3c";

            return (
              <motion.g
                key={node.id}
                layout
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: isCurrent ? 1.12 : isHighlighted ? 1.06 : 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
              >
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={NODE_R}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isCurrent ? 3 : 2}
                  filter={isHighlighted ? "url(#glow)" : undefined}
                  animate={isCurrent ? { r: [NODE_R, NODE_R + 3, NODE_R] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-[#d4d4d4] font-code font-bold"
                  fontSize={String(node.value).length > 3 ? 11 : 14}
                >
                  {node.value}
                </text>
              </motion.g>
            );
          })}
        </AnimatePresence>

        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {activePointers.depth !== undefined && (
        <p className="text-center text-xs font-code text-[#858585] mt-2">
          recursion depth: <span className="text-[#3794ff]">{activePointers.depth}</span>
        </p>
      )}
    </div>
  );
}

interface PositionedNode extends TreeNode {
  x: number;
  y: number;
}

interface Edge {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function layoutTree(nodes: TreeNode[]) {
  if (!nodes.length) return { positioned: [], edges: [], width: 400, height: 200 };

  const map = Object.fromEntries(nodes.map((n) => [n.id, { ...n }]));
  const roots = nodes.filter((n) => !n.parent || !map[n.parent]);

  const positioned: PositionedNode[] = [];
  const edges: Edge[] = [];
  let leafIndex = 0;
  const root = roots[0] ?? nodes[0];

  if (root) {
    const xMap: Record<string, number> = {};

    function calcX(id: string): number {
      const n = map[id];
      if (!n.children.length) {
        const x = (leafIndex + 1) * SIBLING_GAP;
        leafIndex++;
        xMap[id] = x;
        return x;
      }
      const xs = n.children.map(calcX);
      const x = (Math.min(...xs) + Math.max(...xs)) / 2;
      xMap[id] = x;
      return x;
    }

    calcX(root.id);

    function place(id: string, depth: number) {
      const n = map[id];
      const x = xMap[id];
      const y = depth * LEVEL_H + 50;
      positioned.push({ ...n, x, y });
      n.children.forEach((cid) => {
        place(cid, depth + 1);
        const child = positioned.find((p) => p.id === cid)!;
        edges.push({
          from: id,
          to: cid,
          x1: x,
          y1: y + NODE_R,
          x2: child.x,
          y2: child.y - NODE_R,
        });
      });
    }

    place(root.id, 0);
  }

  const maxX = Math.max(...positioned.map((n) => n.x), 200) + SIBLING_GAP;
  const maxY = Math.max(...positioned.map((n) => n.y), 100) + LEVEL_H;

  return { positioned, edges, width: maxX, height: maxY };
}
