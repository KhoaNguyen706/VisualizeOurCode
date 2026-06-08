"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ListNode, TimelineFrame } from "@/lib/types";
import { statusColors } from "@/lib/theme";

interface LinkedListModeProps {
  frame: TimelineFrame;
}

interface NodeLayout {
  id: string;
  x: number;
  centerX: number;
}

const NODE_W = 72;
const GAP = 56;
const NODE_H = 72;
const ARROW_Y = 36;

export function LinkedListMode({ frame }: LinkedListModeProps) {
  const { activePointers, highlightedElements, statusType, structures } = frame;
  const { listData } = structures;
  const colors = statusColors(statusType);

  const ordered = stableNodeOrder(listData);
  const layouts: NodeLayout[] = ordered.map((n, i) => {
    const x = i * (NODE_W + GAP);
    return { id: n.id, x, centerX: x + NODE_W / 2 };
  });
  const layoutMap = Object.fromEntries(layouts.map((l) => [l.id, l]));
  const nodeMap = Object.fromEntries(listData.map((n) => [n.id, n]));

  const prevId = activePointers.prev as string | null | undefined;
  const currentId = activePointers.current as string | null | undefined;
  const slowId = activePointers.slow as string | null | undefined;
  const fastId = activePointers.fast as string | null | undefined;

  const canvasWidth = Math.max(ordered.length * (NODE_W + GAP) + 80, 200);

  return (
    <div className="w-full overflow-x-auto py-8">
      <div className="relative min-w-max px-8" style={{ height: 200 }}>
        <svg
          className="absolute inset-0 pointer-events-none"
          width={canvasWidth}
          height={200}
          style={{ minWidth: canvasWidth }}
        >
          <defs>
            <marker
              id="ll-arrow-active"
              markerWidth="10"
              markerHeight="8"
              refX="9"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L10,4 L0,8 Z" fill="#3794ff" />
            </marker>
            <marker
              id="ll-arrow"
              markerWidth="10"
              markerHeight="8"
              refX="9"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L10,4 L0,8 Z" fill="#6e6e6e" />
            </marker>
            <marker
              id="ll-arrow-cycle"
              markerWidth="10"
              markerHeight="8"
              refX="9"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L10,4 L0,8 Z" fill="#f48771" />
            </marker>
            <marker
              id="ll-arrow-null"
              markerWidth="8"
              markerHeight="8"
              refX="4"
              refY="4"
              orient="auto"
            >
              <circle cx="4" cy="4" r="3" fill="none" stroke="#858585" strokeWidth="1.5" />
            </marker>
          </defs>

          <AnimatePresence>
            {ordered.map((node) => {
              const layout = layoutMap[node.id];
              if (!layout) return null;

              const isActive =
                highlightedElements.includes(node.id) ||
                (node.next != null && highlightedElements.includes(node.next));

              const stroke = isActive ? "#3794ff" : "#6e6e6e";
              const marker = isActive ? "url(#ll-arrow-active)" : "url(#ll-arrow)";

              if (!node.next) {
                const x1 = layout.x + NODE_W;
                const x2 = x1 + 28;
                return (
                  <motion.g key={`null-${node.id}`}>
                    <motion.line
                      x1={x1}
                      y1={ARROW_Y}
                      x2={x2}
                      y2={ARROW_Y}
                      stroke="#858585"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      markerEnd="url(#ll-arrow-null)"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.7 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                    />
                    <motion.text
                      x={x2 + 6}
                      y={ARROW_Y + 4}
                      fill="#858585"
                      fontSize={11}
                      fontFamily="monospace"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.7 }}
                    >
                      null
                    </motion.text>
                  </motion.g>
                );
              }

              const target = layoutMap[node.next];
              if (!target) return null;

              const goingBack = target.x < layout.x;
              const isCycleEdge = goingBack && nodeIndex(node.next!) < nodeIndex(node.id);
              const path = buildLinkPath(layout, target, goingBack);
              const edgeStroke = isCycleEdge ? "#f48771" : stroke;
              const edgeMarker = isCycleEdge ? "url(#ll-arrow-cycle)" : marker;

              return (
                <motion.path
                  key={`${node.id}-${node.next}`}
                  d={path}
                  fill="none"
                  stroke={edgeStroke}
                  strokeWidth={isCycleEdge ? 2.5 : isActive ? 2.5 : 2}
                  strokeDasharray={isCycleEdge ? "6 4" : undefined}
                  markerEnd={edgeMarker}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  exit={{ pathLength: 0, opacity: 0 }}
                  transition={{ duration: 0.45, ease: "easeInOut" }}
                />
              );
            })}
          </AnimatePresence>

          {prevId && currentId && layoutMap[prevId] && layoutMap[currentId] && (
            <motion.path
              d={buildPointerPath(layoutMap[currentId], layoutMap[prevId])}
              fill="none"
              stroke="#4ec9b0"
              strokeWidth={2}
              strokeDasharray="5 4"
              markerEnd="url(#ll-arrow-active)"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.35, 0.9, 0.35] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            />
          )}
        </svg>

        <div className="relative flex items-start" style={{ gap: GAP, paddingTop: 0 }}>
          <AnimatePresence mode="popLayout">
            {ordered.map((node) => {
              const isHighlighted = highlightedElements.includes(node.id);
              const isPrev = prevId === node.id;
              const isCurrent = currentId === node.id;
              const isSlow = slowId === node.id;
              const isFast = fastId === node.id;
              const nextNode = node.next ? nodeMap[node.next] : null;
              const pointerLabel = isSlow ? "slow" : isFast ? "fast" : isCurrent ? "current" : isPrev ? "prev" : null;

              return (
                <motion.div
                  key={node.id}
                  layout
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ type: "spring", stiffness: 280, damping: 24 }}
                  className="flex flex-col items-center gap-1.5"
                  style={{ width: NODE_W }}
                >
                  {pointerLabel ? (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isFast ? "text-[#ce9178]" : isSlow ? "text-[#4ec9b0]" : isCurrent ? "text-[#3794ff]" : "text-[#4ec9b0]"
                      }`}
                    >
                      {pointerLabel}
                    </motion.span>
                  ) : (
                    <span className="h-[14px]" />
                  )}

                  <motion.div
                    layout
                    className={`
                      w-[72px] h-[72px] rounded-lg border-2 flex items-center justify-center
                      font-mono font-bold text-xl
                      ${isHighlighted ? `${colors.bg} ${colors.border} ${colors.glow}` : "bg-[#2d2d2d] border-[#3c3c3c]"}
                      ${isCurrent || isFast ? "ring-2 ring-[#3794ff]" : ""}
                      ${isPrev || isSlow ? "ring-2 ring-[#4ec9b0]/60" : ""}
                      ${isFast ? "ring-[#ce9178]" : ""}
                    `}
                    style={{
                      boxShadow: "0 4px 0 #1e1e1e, 0 6px 12px rgba(0,0,0,0.3)",
                    }}
                    animate={isHighlighted ? { y: [0, -4, 0] } : {}}
                    transition={{ repeat: isHighlighted ? 2 : 0, duration: 0.35 }}
                  >
                    {node.value}
                  </motion.div>

                  <span className="text-[9px] font-code text-[#858585]">{node.id}</span>
                  {nextNode && (
                    <span className="text-[8px] font-code text-[#6e6e6e]">
                      .next → {nextNode.id}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/** Keep nodes in fixed memory order (n0, n1, n2…) so arrows show pointer direction during reversal. */
function stableNodeOrder(nodes: ListNode[]): ListNode[] {
  return [...nodes].sort((a, b) => nodeIndex(a.id) - nodeIndex(b.id));
}

function nodeIndex(id: string): number {
  const m = id.match(/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function buildLinkPath(from: NodeLayout, to: NodeLayout, goingBack: boolean): string {
  const y = ARROW_Y;

  if (!goingBack) {
    const x1 = from.x + NODE_W;
    const x2 = to.x + 8;
    return `M ${x1} ${y} L ${x2} ${y}`;
  }

  const x1 = from.x + NODE_W / 2;
  const x2 = to.x + NODE_W / 2;
  const arcHeight = 48 + Math.abs(from.x - to.x) * 0.08;
  const midX = (x1 + x2) / 2;
  const cpY = y - arcHeight;
  return `M ${x1} ${y} Q ${midX} ${cpY} ${x2} ${y}`;
}

function buildPointerPath(current: NodeLayout, prev: NodeLayout): string {
  const y = NODE_H + 18;
  const x1 = current.centerX;
  const x2 = prev.centerX;
  const goingBack = x2 < x1;

  if (!goingBack) {
    return `M ${x1} ${y} L ${x2} ${y}`;
  }

  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y} Q ${midX} ${y + 28} ${x2} ${y}`;
}
