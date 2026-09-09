"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { TimelineFrame } from "@/lib/types";
import type { Detail, RunInfo } from "@/components/VisualizerApp";
import { formatValue, formatValueBlock } from "@/lib/visual/formatValue";

interface BottomPanelProps {
  timeline: TimelineFrame[];
  currentIndex: number;
  isPlaying: boolean;
  speed: number;
  disabled?: boolean;
  run?: RunInfo;
  detail: Detail;
  /** False for a demo or a textbook walkthrough, which have no line view. */
  canChangeDetail: boolean;
  onDetailChange: (detail: Detail) => void;
  onPlay: () => void;
  onPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSeek: (index: number) => void;
  onSeekToEnd: () => void;
  onSpeedChange: (speed: number) => void;
  onReset: () => void;
}

type Tab = "steps" | "output" | "keys";

const TAB_KEY = "voc-bottom-tab";

const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3];

export function BottomPanel({
  timeline,
  currentIndex,
  isPlaying,
  speed,
  disabled = false,
  run,
  detail,
  canChangeDetail,
  onDetailChange,
  onPlay,
  onPause,
  onStepBack,
  onStepForward,
  onSeek,
  onSeekToEnd,
  onSpeedChange,
  onReset,
}: BottomPanelProps) {
  const [tab, setTab] = useState<Tab | null>(null);
  const total = timeline.length;
  const maxIndex = Math.max(0, total - 1);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TAB_KEY);
      if (saved === "steps" || saved === "output" || saved === "keys") setTab(saved);
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const pick = (next: Tab) => {
    const value = tab === next ? null : next;
    setTab(value);
    try {
      if (value) window.localStorage.setItem(TAB_KEY, value);
      else window.localStorage.removeItem(TAB_KEY);
    } catch {
      /* ignore */
    }
  };

  const returned =
    run?.hasReturnValue ? formatValue(run.returnValue, 40) : undefined;

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{ background: "var(--mac-window)", borderTop: "1px solid var(--mac-separator)" }}
    >
      {/* Transport — always visible, so a click in the Steps list is seen to land. */}
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="flex items-center gap-0.5">
          <ControlButton onClick={onReset} label="Back to start (Home)" disabled={disabled || currentIndex === 0}>
            <ToStartIcon />
          </ControlButton>
          <ControlButton onClick={onStepBack} label="Step back (←)" disabled={disabled || currentIndex === 0}>
            <StepBackIcon />
          </ControlButton>
          <ControlButton
            onClick={isPlaying ? onPause : onPlay}
            label={isPlaying ? "Pause (Space)" : "Play (Space)"}
            primary
            disabled={disabled}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </ControlButton>
          <ControlButton
            onClick={onStepForward}
            label="Step forward (→)"
            disabled={disabled || currentIndex >= maxIndex}
          >
            <StepForwardIcon />
          </ControlButton>
          <ControlButton onClick={onSeekToEnd} label="Jump to end (End)" disabled={disabled || currentIndex >= maxIndex}>
            <ToEndIcon />
          </ControlButton>
        </div>

        <Scrubber
          timeline={timeline}
          currentIndex={currentIndex}
          disabled={disabled}
          onSeek={onSeek}
        />

        <span className="text-[11px] font-code text-[var(--mac-text-2)] tabular-nums min-w-[64px] text-right">
          {disabled ? "— / —" : `${currentIndex + 1} / ${total}`}
        </span>

        <SpeedControl speed={speed} disabled={disabled} onChange={onSpeedChange} />
      </div>

      {/* Drawer tabs */}
      <div
        className="flex items-center gap-1 px-3 h-[28px] text-[11px]"
        style={{ borderTop: "1px solid var(--mac-separator)" }}
      >
        <TabButton active={tab === "steps"} onClick={() => pick("steps")} disabled={disabled}>
          Steps{!disabled && <span className="text-[var(--mac-text-3)] ml-1">{total}</span>}
        </TabButton>
        <TabButton active={tab === "output"} onClick={() => pick("output")} disabled={disabled}>
          Output
          {returned !== undefined && (
            <span className="font-code text-[var(--mac-good)] ml-1.5 max-w-[220px] truncate inline-block align-bottom">
              {returned}
            </span>
          )}
          {run?.runtimeError && (
            <span className="font-code text-[var(--mac-bad)] ml-1.5">error</span>
          )}
        </TabButton>
        <TabButton active={tab === "keys"} onClick={() => pick("keys")}>
          Shortcuts
        </TabButton>

        {/* Granularity: beats the canvas can show, or the debugger's every line. */}
        {!disabled && canChangeDetail && (
          <div
            className="ml-3 flex items-center rounded-[6px] p-[2px] gap-[2px]"
            style={{ background: "var(--mac-inset)", border: "1px solid var(--mac-separator)" }}
            role="radiogroup"
            aria-label="Detail"
            title="Beats fold the bookkeeping around each visible change; Every line shows each recorded line"
          >
            {(["beats", "lines"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={detail === d}
                onClick={() => detail !== d && onDetailChange(d)}
                className="h-[18px] px-2 rounded-[4px] text-[10.5px] font-medium"
                style={{
                  background: detail === d ? "var(--mac-raised)" : "transparent",
                  color: detail === d ? "var(--mac-text)" : "var(--mac-text-3)",
                  boxShadow: detail === d ? "var(--mac-shadow-sm)" : undefined,
                }}
              >
                {d === "beats" ? "Beats" : "Every line"}
              </button>
            ))}
          </div>
        )}
        {tab && (
          <button
            type="button"
            onClick={() => pick(tab)}
            className="ml-auto text-[var(--mac-text-3)] hover:text-[var(--mac-text)] px-1"
            aria-label="Collapse panel"
            title="Collapse"
          >
            <ChevronDownIcon />
          </button>
        )}
      </div>

      {tab === "steps" && !disabled && (
        <StepsList timeline={timeline} currentIndex={currentIndex} onSeek={onSeek} />
      )}
      {tab === "output" && !disabled && <OutputView run={run} timeline={timeline} />}
      {tab === "keys" && <Shortcuts />}
    </div>
  );
}

/* ---- scrubber ------------------------------------------------------------ */

/**
 * The colour a beat earns on the track and in the list: a decision that
 * passed or failed, a return, or the point the run stopped. Plain steps get
 * none, so the marks are the shape of the run rather than a solid bar.
 */
function markColor(f: TimelineFrame): string | undefined {
  if (f.statusType === "FAIL") return "var(--mac-bad)";
  if (f.conditionMet === true) return "var(--mac-good)";
  if (f.conditionMet === false) return "var(--mac-bad)";
  if (f.statusType === "SUCCESS") return "var(--mac-warn)";
  return undefined;
}

function Scrubber({
  timeline,
  currentIndex,
  disabled,
  onSeek,
}: {
  timeline: TimelineFrame[];
  currentIndex: number;
  disabled: boolean;
  onSeek: (i: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const total = timeline.length;
  const maxIndex = Math.max(0, total - 1);
  const pct = (i: number) => (maxIndex === 0 ? 0 : (i / maxIndex) * 100);

  const indexAt = (clientX: number): number => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width === 0) return 0;
    const t = Math.max(0, Math.min(1, (clientX - box.left) / box.width));
    return Math.round(t * maxIndex);
  };

  // Marks are the shape of the run: where it decided, where it failed, where
  // it returned. Only the notable ones are drawn, so the track stays readable.
  const marks = useMemo(() => {
    const out: { i: number; color: string }[] = [];
    timeline.forEach((f, i) => {
      const color = markColor(f);
      if (color) out.push({ i, color });
    });
    return out;
  }, [timeline]);

  const hovered = hover !== null ? timeline[hover] : undefined;

  return (
    <div className="flex-1 relative py-2 select-none" style={{ minWidth: 120 }}>
      <div
        ref={track}
        role="slider"
        aria-label="Timeline"
        aria-valuemin={0}
        aria-valuemax={maxIndex}
        aria-valuenow={currentIndex}
        className={`relative h-[14px] ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          onSeek(indexAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (disabled) return;
          const i = indexAt(e.clientX);
          setHover(i);
          if (e.buttons & 1) onSeek(i);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {/* rail */}
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[4px] rounded-full"
          style={{ background: "var(--mac-separator)" }}
        />
        {/* played */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-[4px] rounded-full"
          style={{ width: `${pct(currentIndex)}%`, background: "var(--mac-accent)" }}
        />
        {marks.map(({ i, color }) => (
          <span
            key={i}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
            style={{ left: `${pct(i)}%`, width: 5, height: 5, background: color }}
          />
        ))}
        {/* knob */}
        {!disabled && (
          <motion.span
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
            animate={{ left: `${pct(currentIndex)}%` }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            style={{
              width: 14,
              height: 14,
              background: "var(--mac-raised)",
              border: "1px solid var(--mac-border)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }}
          />
        )}
      </div>

      {hovered && hover !== null && (
        <div
          className="absolute bottom-full mb-1 px-2 py-1 rounded-md text-[11px] font-code pointer-events-none max-w-[360px] truncate z-20"
          style={{
            left: `clamp(0px, ${pct(hover)}%, calc(100% - 200px))`,
            background: "var(--mac-raised)",
            border: "1px solid var(--mac-border)",
            boxShadow: "var(--mac-shadow)",
            color: "var(--mac-text)",
          }}
        >
          <span className="text-[var(--mac-text-3)] mr-1.5">
            {hover + 1}
            {hovered.sourceLine ? ` · L${hovered.sourceLine}` : ""}
          </span>
          {hovered.message}
        </div>
      )}
    </div>
  );
}

/* ---- speed --------------------------------------------------------------- */

function SpeedControl({
  speed,
  disabled,
  onChange,
}: {
  speed: number;
  disabled: boolean;
  onChange: (s: number) => void;
}) {
  const idx = Math.max(0, SPEEDS.findIndex((s) => s >= speed));
  return (
    <div className="flex items-center gap-1.5" title="Playback speed">
      <input
        type="range"
        min={0}
        max={SPEEDS.length - 1}
        step={1}
        value={idx}
        onChange={(e) => onChange(SPEEDS[Number(e.target.value)])}
        disabled={disabled}
        className="w-16 disabled:opacity-40"
        aria-label="Animation speed"
      />
      <span className="text-[11px] font-code text-[var(--mac-accent)] tabular-nums w-8">
        {SPEEDS[idx]}x
      </span>
    </div>
  );
}

/* ---- steps list ---------------------------------------------------------- */

function StepsList({
  timeline,
  currentIndex,
  onSeek,
}: {
  timeline: TimelineFrame[];
  currentIndex: number;
  onSeek: (i: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = box.current?.querySelector<HTMLElement>(`[data-step="${currentIndex}"]`);
    row?.scrollIntoView({ block: "center" });
  }, [currentIndex]);

  return (
    <div
      ref={box}
      className="overflow-auto font-code text-[11.5px]"
      style={{ height: 176, background: "var(--mac-content)", borderTop: "1px solid var(--mac-separator)" }}
    >
      {timeline.map((f, i) => {
        const active = i === currentIndex;
        const color = markColor(f) ?? "var(--mac-separator)";
        return (
          <button
            key={i}
            type="button"
            data-step={i}
            onClick={() => onSeek(i)}
            className="w-full text-left flex items-center gap-2 px-3 h-[24px] leading-none"
            style={{
              background: active ? "var(--mac-accent-soft)" : undefined,
              color: active ? "var(--mac-text)" : "var(--mac-text-2)",
            }}
          >
            <span className="w-8 shrink-0 text-right tabular-nums text-[var(--mac-text-3)]">{i + 1}</span>
            <span className="w-8 shrink-0 tabular-nums text-[var(--mac-text-3)]">
              {f.sourceLine ? `L${f.sourceLine}` : ""}
            </span>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <span className="truncate">{f.message}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---- output -------------------------------------------------------------- */

function OutputView({ run, timeline }: { run?: RunInfo; timeline: TimelineFrame[] }) {
  const last = timeline[timeline.length - 1];
  const finalVars = Object.entries(last?.variables ?? {});

  return (
    <div
      className="overflow-auto px-4 py-3 grid gap-4 text-[12px]"
      style={{
        height: 176,
        background: "var(--mac-content)",
        borderTop: "1px solid var(--mac-separator)",
        gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr)",
      }}
    >
      <section className="min-w-0">
        <SectionLabel>Returned</SectionLabel>
        {run?.hasReturnValue ? (
          <pre className="font-code text-[12.5px] whitespace-pre-wrap break-words text-[var(--mac-good)]">
            {formatValueBlock(run.returnValue)}
          </pre>
        ) : (
          <p className="text-[var(--mac-text-3)]">
            {run?.runtimeError
              ? "Nothing — the run stopped on an error."
              : run?.source === "dsa"
                ? "Not executed — this is the textbook walkthrough."
                : "Nothing — the run stopped before returning."}
          </p>
        )}
        {run?.runtimeError && (
          <>
            <SectionLabel className="mt-3">Error</SectionLabel>
            <pre className="font-code text-[12px] whitespace-pre-wrap break-words text-[var(--mac-bad)]">
              {run.runtimeError}
            </pre>
          </>
        )}
      </section>

      <section className="min-w-0">
        <SectionLabel>Printed</SectionLabel>
        {run?.stdout ? (
          <pre className="font-code text-[12px] whitespace-pre-wrap break-words text-[var(--mac-text)]">
            {run.stdout}
          </pre>
        ) : (
          <p className="text-[var(--mac-text-3)]">Nothing printed.</p>
        )}
      </section>

      <section className="min-w-0">
        <SectionLabel>Final variables</SectionLabel>
        {finalVars.length === 0 ? (
          <p className="text-[var(--mac-text-3)]">—</p>
        ) : (
          <dl className="font-code text-[11.5px] grid gap-0.5" style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}>
            {finalVars.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[var(--mac-accent)] pr-2">{k}</dt>
                <dd className="text-[var(--mac-text-2)] truncate">{formatValue(v, 60)}</dd>
              </div>
            ))}
          </dl>
        )}
        {run && (
          <p className="mt-3 text-[11px] text-[var(--mac-text-3)]">
            {run.source === "trace" ? "Your code, executed" : "Textbook walkthrough"} ·{" "}
            {run.traceSteps} steps · {run.elapsedMs} ms
          </p>
        )}
      </section>
    </div>
  );
}

function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[10px] uppercase tracking-wider text-[var(--mac-text-2)] mb-1.5 ${className}`}>
      {children}
    </div>
  );
}

/* ---- shortcuts ----------------------------------------------------------- */

const KEYS: [string, string][] = [
  ["Space", "Play / pause"],
  ["← →", "Step back / forward"],
  ["Shift + ← →", "Previous / next decision (a check that passed or failed)"],
  ["Home / End", "Start / end of the run"],
  ["⌘ / Ctrl + Enter", "Visualize the code in the editor"],
  ["Esc", "Pause"],
];

function Shortcuts() {
  return (
    <div
      className="overflow-auto px-4 py-3 text-[12px]"
      style={{ height: 176, background: "var(--mac-content)", borderTop: "1px solid var(--mac-separator)" }}
    >
      <dl className="grid gap-x-6 gap-y-1.5" style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}>
        {KEYS.map(([key, what]) => (
          <div key={key} className="contents">
            <dt>
              <kbd
                className="font-code text-[11px] px-1.5 py-0.5 rounded-[5px]"
                style={{
                  background: "var(--mac-inset)",
                  border: "1px solid var(--mac-border)",
                  boxShadow: "0 1px 0 var(--mac-border)",
                  color: "var(--mac-text)",
                }}
              >
                {key}
              </kbd>
            </dt>
            <dd className="text-[var(--mac-text-2)] self-center">{what}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-[var(--mac-text-3)]">
        Shortcuts are ignored while you are typing in the editor. Drag the borders between
        panels to resize them.
      </p>
    </div>
  );
}

/* ---- widgets ------------------------------------------------------------- */

function TabButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-[22px] px-2.5 rounded-[6px] text-[11px] font-medium transition-colors disabled:opacity-40 flex items-center"
      style={{
        color: active ? "var(--mac-text)" : "var(--mac-text-2)",
        background: active ? "var(--mac-inset)" : "transparent",
        border: `1px solid ${active ? "var(--mac-border)" : "transparent"}`,
      }}
    >
      {children}
    </button>
  );
}

function ControlButton({
  children,
  onClick,
  label,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.94 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded-[7px] ${primary ? "w-8 h-8 mx-0.5" : "w-7 h-7"}`}
      style={{
        color: primary ? "var(--mac-accent-ink)" : "var(--mac-text)",
        background: primary ? "var(--mac-accent)" : "transparent",
        boxShadow: primary ? "var(--mac-shadow-sm)" : undefined,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !primary) e.currentTarget.style.background = "var(--mac-inset)";
      }}
      onMouseLeave={(e) => {
        if (!primary) e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </motion.button>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2l10 6-10 6V2z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="4" height="12" rx="1" />
      <rect x="9" y="2" width="4" height="12" rx="1" />
    </svg>
  );
}
function StepBackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11 3v10L4 8l7-5z" />
    </svg>
  );
}
function StepForwardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5 3v10l7-5-7-5z" />
    </svg>
  );
}
function ToStartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13 3v10L6 8l7-5zM3 3h2v10H3z" />
    </svg>
  );
}
function ToEndIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 3v10l7-5-7-5zM11 3h2v10h-2z" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
