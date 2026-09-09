"use client";

import { motion } from "framer-motion";

interface TimelinePlayerProps {
  currentIndex: number;
  maxIndex: number;
  progress: number;
  isPlaying: boolean;
  speed: number;
  totalSteps: number;
  disabled?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSeek: (index: number) => void;
  onSpeedChange: (speed: number) => void;
  onReset: () => void;
}

export function TimelinePlayer({
  currentIndex,
  maxIndex,
  progress,
  isPlaying,
  speed,
  totalSteps,
  disabled = false,
  onPlay,
  onPause,
  onStepBack,
  onStepForward,
  onSeek,
  onSpeedChange,
  onReset,
}: TimelinePlayerProps) {
  return (
    <div
      className="shrink-0"
      style={{ background: "var(--mac-window)", borderTop: "1px solid var(--mac-separator)" }}
    >
      {/* Panel tab bar */}
      <div
        className="h-[30px] flex items-center px-3 gap-4 text-[11px] uppercase tracking-wide"
        style={{ borderBottom: "1px solid var(--mac-separator)" }}
      >
        <span className="text-[var(--mac-text)] font-semibold" style={{ borderBottom: "1px solid var(--mac-accent)", paddingBottom: 6 }}>
          Timeline
        </span>
        <span className="text-[var(--mac-text-2)]">Output</span>
        <span className="text-[var(--mac-text-2)]">Debug</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="flex-1 h-[3px] relative cursor-pointer"
            style={{ background: "var(--mac-separator)" }}
          >
            <motion.div
              className="absolute inset-y-0 left-0"
              style={{ width: `${progress * 100}%`, background: "var(--mac-accent)" }}
              layout
            />
            <input
              type="range"
              min={0}
              max={maxIndex}
              value={currentIndex}
              onChange={(e) => onSeek(Number(e.target.value))}
              disabled={disabled}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Timeline progress"
            />
          </div>
          <span className="text-[11px] font-code text-[var(--mac-text-2)] tabular-nums min-w-[72px] text-right">
            {disabled ? "— / —" : `${currentIndex + 1} / ${totalSteps}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <ControlButton onClick={onReset} label="Reset" disabled={disabled}>
              <ResetIcon />
            </ControlButton>
            <ControlButton onClick={onStepBack} label="Step back" disabled={disabled || currentIndex === 0}>
              <SkipBackIcon />
            </ControlButton>
            <ControlButton
              onClick={isPlaying ? onPause : onPlay}
              label={isPlaying ? "Pause" : "Play"}
              primary
              disabled={disabled}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </ControlButton>
            <ControlButton onClick={onStepForward} label="Step forward" disabled={disabled || currentIndex >= maxIndex}>
              <SkipForwardIcon />
            </ControlButton>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--mac-text-2)]">Speed</span>
            <input
              type="range"
              min={0.25}
              max={3}
              step={0.25}
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              disabled={disabled}
              className="w-20 disabled:opacity-40"
              aria-label="Animation speed"
            />
            <span className="text-[11px] font-code text-[var(--mac-accent)] tabular-nums w-8">{speed}x</span>
          </div>
        </div>
      </div>
    </div>
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
      whileTap={disabled ? undefined : { scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="w-7 h-7 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
      style={{
        color: primary ? "var(--mac-accent-ink)" : "var(--mac-text)",
        background: primary ? "var(--mac-accent)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = primary ? "var(--mac-accent)" : "var(--mac-inset)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = primary ? "var(--mac-accent)" : "transparent";
      }}
    >
      {children}
    </motion.button>
  );
}

function PlayIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z" /></svg>;
}
function PauseIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12" rx="1" /><rect x="9" y="2" width="4" height="12" rx="1" /></svg>;
}
function SkipBackIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3v10l8-5-8-5zm9 0v10h2V3h-2z" /></svg>;
}
function SkipForwardIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 3v10L6 8l8-5zM4 3v10H2V3h2z" /></svg>;
}
function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 8a6 6 0 1 1 1.5 4" strokeLinecap="round" />
      <path d="M2 12V8h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
