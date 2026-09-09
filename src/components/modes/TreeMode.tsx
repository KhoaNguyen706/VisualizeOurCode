"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TimelineFrame, TreeNode } from "@/lib/types";

interface TreeModeProps {
  frame: TimelineFrame;
}

const CIRCLE_R = 28;
const PILL_H = 30;
const MAX_PILL_W = 240;
/** Past this many calls the shared function name moves to a caption. */
const COMPACT_FROM = 12;
/** The tree shrinks to fit the canvas down to this; below it, it scrolls. */
const MIN_FIT_SCALE = 0.65;
const MAX_ZOOM = 1.6;
/** Tallest the tree's own viewport gets before it scrolls inside the canvas. */
const MAX_VIEW_HEIGHT = 540;

interface Metrics {
  /** Rounded rectangles for call labels; circles for short values. */
  pill: boolean;
  width: number;
  height: number;
  siblingGap: number;
  levelHeight: number;
  maxChars: number;
}

interface Labelled {
  node: TreeNode;
  /** What the node shows — the value, or the arguments alone in a big call tree. */
  label: string;
}

/**
 * A call tree names the same function on nearly every node — the outer
 * function sits at the root, the recursive helper fills the rest. Past a dozen
 * calls that repetition is the widest thing on screen, so the dominant name is
 * said once as a caption and its nodes keep only what differs: the arguments.
 */
function labelNodes(nodes: TreeNode[]): { items: Labelled[]; caption?: string } {
  const labels = nodes.map((n) => String(n.value));
  const heads = labels.map((l) => l.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/));

  const counts = new Map<string, number>();
  for (const h of heads) if (h) counts.set(h[1], (counts.get(h[1]) ?? 0) + 1);
  let dominant: string | undefined;
  for (const [name, count] of counts) {
    if (dominant === undefined || count > (counts.get(dominant) ?? 0)) dominant = name;
  }
  const share = dominant === undefined ? 0 : (counts.get(dominant) ?? 0);

  if (dominant === undefined || nodes.length <= COMPACT_FROM || share < nodes.length * 0.6) {
    return { items: nodes.map((node, i) => ({ node, label: labels[i] })) };
  }
  return {
    caption: `${dominant}(…)`,
    items: nodes.map((node, i) => {
      const h = heads[i];
      return { node, label: h && h[1] === dominant ? `(${h[2]})` : labels[i] };
    }),
  };
}

/**
 * Size the nodes from what they have to say. A value tree — a backtracking
 * candidate, a list node — reads best as circles; a call tree's labels
 * (`backtrack(1, [2, 2], 4)`) need a pill wide enough to hold them.
 */
function nodeMetrics(items: Labelled[]): Metrics {
  const longest = items.reduce((m, { label }) => Math.max(m, label.length), 0);
  const pill = longest > 4;
  const width = pill ? Math.min(MAX_PILL_W, Math.max(64, Math.ceil(longest * 7.2) + 22)) : CIRCLE_R * 2;
  const height = pill ? PILL_H : CIRCLE_R * 2;
  return {
    pill,
    width,
    height,
    siblingGap: width + 16,
    // Room under a pill for the "→ value" note before the edge sets off.
    levelHeight: pill ? 84 : 90,
    maxChars: pill ? Math.floor((width - 22) / 7.2) : Number.POSITIVE_INFINITY,
  };
}

export function TreeMode({ frame }: TreeModeProps) {
  const { activePointers, highlightedElements, structures } = frame;
  const { treeData } = structures;
  const currentId = activePointers.current as string | null | undefined;
  const scroller = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  /** null means "fit to the canvas"; a number is the reader's own zoom. */
  const [zoom, setZoom] = useState<number | null>(null);

  const { items, caption } = useMemo(() => labelNodes(treeData), [treeData]);
  const metrics = useMemo(() => nodeMetrics(items), [items]);
  const { positioned, edges, width, height } = useMemo(
    () => layoutTree(items, metrics),
    [items, metrics]
  );

  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setBoxWidth(e.contentRect.width);
    });
    ro.observe(box);
    setBoxWidth(box.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Fit the whole tree in the canvas while the labels stay legible; a tree
  // too wide for that scrolls instead of shrinking to dust.
  const fitScale = boxWidth > 0 ? Math.min(1, (boxWidth - 24) / width) : 1;
  const scale = zoom ?? Math.max(MIN_FIT_SCALE, fitScale);
  const viewW = Math.ceil(width * scale);
  const viewH = Math.ceil(height * scale);

  // Keep the call being made in view as the recursion moves. The tree has its
  // own bounded viewport now, so following it vertically no longer drags the
  // narration off screen.
  useEffect(() => {
    const box = scroller.current;
    if (!box || !currentId) return;
    const target = positioned.find((p) => p.node.id === currentId);
    if (!target) return;
    const overflowsX = box.scrollWidth > box.clientWidth + 1;
    const overflowsY = box.scrollHeight > box.clientHeight + 1;
    if (!overflowsX && !overflowsY) return;
    box.scrollTo({
      left: overflowsX ? Math.max(0, target.x * scale - box.clientWidth / 2) : box.scrollLeft,
      top: overflowsY ? Math.max(0, target.y * scale - box.clientHeight / 2) : box.scrollTop,
      behavior: "smooth",
    });
  }, [currentId, positioned, scale]);

  // Drag to pan, the way every map does it.
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  if (!treeData.length) {
    return (
      <div className="text-center py-12 text-[var(--mac-text-2)] font-code text-sm">Empty tree</div>
    );
  }

  const canScroll = viewW > boxWidth || viewH > MAX_VIEW_HEIGHT;

  return (
    <div className="w-full relative">
      <div className="flex items-center justify-between gap-2 mb-1 min-h-[18px]">
        <div className="text-[11px] font-code text-[var(--mac-text-2)]">
          {caption ? (
            <>
              each node is a call to <span className="text-[var(--mac-accent)]">{caption}</span>
            </>
          ) : (
            <span className="text-[var(--mac-text-3)]">{treeData.length} nodes</span>
          )}
        </div>
        <ZoomControls
          scale={scale}
          fitted={zoom === null}
          onZoom={(next) => setZoom(next)}
          onFit={() => setZoom(null)}
        />
      </div>

      <div
        ref={scroller}
        className={`w-full overflow-auto rounded-[10px] ${canScroll ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{
          maxHeight: MAX_VIEW_HEIGHT,
          background: "var(--mac-inset)",
          border: "1px solid var(--mac-separator)",
        }}
        onPointerDown={(e) => {
          if (!canScroll || e.button !== 0) return;
          const box = e.currentTarget;
          drag.current = { x: e.clientX, y: e.clientY, left: box.scrollLeft, top: box.scrollTop };
          box.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const box = e.currentTarget;
          box.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
          box.scrollTop = drag.current.top - (e.clientY - drag.current.y);
        }}
        onPointerUp={(e) => {
          drag.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div style={{ width: Math.max(viewW, boxWidth - 2), height: viewH + 16, position: "relative" }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width={viewW}
            height={viewH}
            className="block select-none"
            style={{ position: "absolute", left: Math.max(0, (boxWidth - 2 - viewW) / 2), top: 8 }}
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
                    stroke={active ? "var(--mac-accent)" : "var(--mac-border)"}
                    strokeWidth={active ? 2.5 : 1.5}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.4 }}
                  />
                );
              })}
            </AnimatePresence>

            <AnimatePresence mode="popLayout">
              {positioned.map(({ node, label, x, y }) => {
                const isHighlighted = highlightedElements.includes(node.id);
                const isCurrent = currentId === node.id;
                const isSuccess = label.startsWith("✓");
                const isFail = label.startsWith("✗");
                // A finished call steps back so the live path stands out; the
                // one being returned from is still the current node.
                const done = Boolean(node.done) && !isCurrent;

                const fill = isSuccess
                  ? "var(--mac-good-soft)"
                  : isFail
                    ? "var(--mac-bad-soft)"
                    : isCurrent
                      ? "var(--mac-accent)"
                      : isHighlighted
                        ? "var(--mac-accent-soft)"
                        : "var(--mac-content)";

                const stroke = isSuccess
                  ? "var(--mac-good)"
                  : isFail
                    ? "var(--mac-bad)"
                    : isCurrent || isHighlighted
                      ? "var(--mac-accent)"
                      : "var(--mac-border)";

                const ink = isCurrent ? "var(--mac-accent-ink)" : "var(--mac-text)";
                const shown =
                  label.length > metrics.maxChars
                    ? `${label.slice(0, Math.max(1, metrics.maxChars - 1))}…`
                    : label;

                return (
                  <motion.g
                    key={node.id}
                    data-node={node.id}
                    layout
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: done ? 0.55 : 1,
                      scale: isCurrent ? 1.1 : isHighlighted ? 1.05 : 1,
                    }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ type: "spring", stiffness: 280, damping: 22 }}
                  >
                    {metrics.pill ? (
                      <rect
                        x={x - metrics.width / 2}
                        y={y - metrics.height / 2}
                        width={metrics.width}
                        height={metrics.height}
                        rx={metrics.height / 2}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={isCurrent ? 2.5 : 1.5}
                      />
                    ) : (
                      <motion.circle
                        cx={x}
                        cy={y}
                        r={CIRCLE_R}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={isCurrent ? 3 : 2}
                        filter={isHighlighted ? "url(#glow)" : undefined}
                        animate={isCurrent ? { r: [CIRCLE_R, CIRCLE_R + 3, CIRCLE_R] } : {}}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      />
                    )}
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={ink}
                      className="font-code font-bold"
                      fontSize={metrics.pill ? 11 : label.length > 3 ? 11 : 14}
                    >
                      {shown}
                    </text>
                    {node.note && (
                      <text
                        x={x}
                        y={y + metrics.height / 2 + 13}
                        textAnchor="middle"
                        fontSize={10}
                        fill={isCurrent ? "var(--mac-accent)" : "var(--mac-text-2)"}
                        className="font-code"
                      >
                        {node.note}
                      </text>
                    )}
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
        </div>
      </div>

      {activePointers.depth !== undefined && (
        <p className="text-center text-xs font-code text-[var(--mac-text-2)] mt-1.5">
          recursion depth: <span className="text-[var(--mac-accent)]">{activePointers.depth}</span>
        </p>
      )}
    </div>
  );
}

function ZoomControls({
  scale,
  fitted,
  onZoom,
  onFit,
}: {
  scale: number;
  fitted: boolean;
  onZoom: (scale: number) => void;
  onFit: () => void;
}) {
  const step = (dir: 1 | -1) => {
    const next = Math.round((scale + dir * 0.15) * 100) / 100;
    onZoom(Math.max(0.3, Math.min(MAX_ZOOM, next)));
  };
  const btn =
    "w-6 h-6 flex items-center justify-center rounded-[5px] text-[13px] leading-none hover:bg-[var(--mac-inset)] disabled:opacity-40";
  return (
    <div
      className="flex items-center gap-0.5 rounded-[7px] px-0.5"
      style={{ border: "1px solid var(--mac-separator)", color: "var(--mac-text-2)" }}
    >
      <button type="button" className={btn} onClick={() => step(-1)} aria-label="Zoom out" title="Zoom out">
        −
      </button>
      <button
        type="button"
        className={`${btn} font-code text-[10px] w-auto px-1.5 tabular-nums`}
        onClick={onFit}
        title="Fit to view"
        style={{ color: fitted ? "var(--mac-accent)" : undefined }}
      >
        {fitted ? "fit" : `${Math.round(scale * 100)}%`}
      </button>
      <button type="button" className={btn} onClick={() => step(1)} aria-label="Zoom in" title="Zoom in">
        +
      </button>
    </div>
  );
}

interface PositionedNode extends Labelled {
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

function layoutTree(items: Labelled[], metrics: Metrics) {
  if (!items.length) return { positioned: [], edges: [], width: 400, height: 200 };

  const { siblingGap, levelHeight, width: nodeW, height: nodeH, pill } = metrics;
  const byId = new Map(items.map((it) => [it.node.id, it]));
  const roots = items.filter(({ node }) => !node.parent || !byId.has(node.parent));

  const positioned: PositionedNode[] = [];
  const placedById = new Map<string, PositionedNode>();
  const edges: Edge[] = [];
  let leafIndex = 0;
  const root = roots[0] ?? items[0];
  // Leave room under a pill for its note before the edge sets off.
  const edgeGap = pill ? 16 : 0;

  if (root) {
    const xMap: Record<string, number> = {};

    function calcX(id: string): number {
      const n = byId.get(id)!.node;
      const kids = n.children.filter((cid) => byId.has(cid));
      if (!kids.length) {
        const x = leafIndex * siblingGap + nodeW / 2 + 12;
        leafIndex++;
        xMap[id] = x;
        return x;
      }
      const xs = kids.map(calcX);
      const x = (Math.min(...xs) + Math.max(...xs)) / 2;
      xMap[id] = x;
      return x;
    }

    calcX(root.node.id);

    function place(id: string, depth: number) {
      const item = byId.get(id)!;
      const x = xMap[id];
      const y = depth * levelHeight + nodeH / 2 + 12;
      const placed: PositionedNode = { ...item, x, y };
      positioned.push(placed);
      placedById.set(id, placed);
      for (const cid of item.node.children) {
        if (!byId.has(cid)) continue;
        place(cid, depth + 1);
        const child = placedById.get(cid)!;
        edges.push({
          from: id,
          to: cid,
          x1: x,
          y1: y + nodeH / 2 + edgeGap,
          x2: child.x,
          y2: child.y - nodeH / 2,
        });
      }
    }

    place(root.node.id, 0);
  }

  const maxX = Math.max(...positioned.map((n) => n.x), 200) + nodeW / 2 + 12;
  const maxY = Math.max(...positioned.map((n) => n.y), 100) + nodeH / 2 + 28;

  return { positioned, edges, width: maxX, height: maxY };
}
