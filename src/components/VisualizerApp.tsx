"use client";

import { useState } from "react";
import { createEmptyScenario } from "@/lib/gemini/validateTimeline";
import { useTimelinePlayer } from "@/hooks/useTimelinePlayer";
import type { Scenario } from "@/lib/types";
import { Header } from "@/components/layout/Header";
import { CodeEditor } from "@/components/layout/CodeEditor";
import { VisualizationCanvas } from "@/components/engine/VisualizationCanvas";
import { TraceStepView } from "@/components/engine/TraceStepView";
import { PatternHintBanner } from "@/components/engine/PatternHintBanner";
import { StateInspector } from "@/components/engine/StateInspector";
import { TimelinePlayer } from "@/components/engine/TimelinePlayer";
import type { VisualizeMeta } from "@/components/layout/CodeEditor";

export function VisualizerApp() {
  const [scenario, setScenario] = useState<Scenario>(createEmptyScenario());
  const [hasVisualization, setHasVisualization] = useState(false);
  const [visualizeMeta, setVisualizeMeta] = useState<VisualizeMeta | undefined>();

  const player = useTimelinePlayer({ timeline: scenario.timeline });
  const handleVisualizeResult = (generated: Scenario, meta?: VisualizeMeta) => {
    player.pause();
    setScenario(generated);
    setVisualizeMeta(meta);
    setHasVisualization(true);
  };

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "var(--mac-window)" }}
      suppressHydrationWarning
    >
      <Header />

      <div className="flex flex-1 min-h-0">
        <CodeEditor
          onScenarioGenerated={handleVisualizeResult}
          activeLine={hasVisualization ? player.currentFrame?.sourceLine : undefined}
          coveredLines={hasVisualization ? player.currentFrame?.coveredLines : undefined}
        />

        {/* Center — the visualization itself */}
        <main
          className="flex-1 min-w-0 flex flex-col"
          style={{ background: "var(--mac-content)" }}
        >
          <div
            className="h-[36px] shrink-0 flex items-center px-4 gap-2"
            style={{ borderBottom: "1px solid var(--mac-separator)" }}
          >
            <GraphIcon />
            <span className="text-[12.5px] font-medium" style={{ color: "var(--mac-text)" }}>
              Visualization
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-5">
            {hasVisualization ? (
              <>
                <PatternHintBanner
                  hint={visualizeMeta?.patternHint}
                  isLiveTrace={visualizeMeta?.source === "trace"}
                />
                <TraceStepView frame={player.currentFrame} warning={visualizeMeta?.warning} />
                <VisualizationCanvas frame={player.currentFrame} />
              </>
            ) : (
              <EmptyVisualization />
            )}
          </div>
        </main>

        <StateInspector frame={player.currentFrame} currentIndex={player.currentIndex} scenario={scenario} />
      </div>

      <TimelinePlayer
        currentIndex={player.currentIndex}
        maxIndex={player.maxIndex}
        progress={player.progress}
        isPlaying={player.isPlaying}
        speed={player.speed}
        totalSteps={player.totalSteps}
        onPlay={player.play}
        onPause={player.pause}
        onStepBack={player.stepBack}
        onStepForward={player.stepForward}
        onSeek={player.seekTo}
        onSpeedChange={player.setSpeed}
        onReset={player.reset}
        disabled={!hasVisualization}
      />
    </div>
  );
}

function EmptyVisualization() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-5 select-none">
      <svg width="132" height="76" viewBox="0 0 132 76" fill="none" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={6 + i * 31}
            y={10}
            width="25"
            height="25"
            rx="6"
            fill="var(--ramp-1)"
            opacity={1 - i * 0.22}
          />
        ))}
        <path
          d="M18 52 H114"
          stroke="var(--mac-separator)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="18" cy="52" r="4.5" fill="var(--mac-accent)" />
        <circle cx="66" cy="52" r="4.5" fill="var(--mac-accent)" opacity="0.45" />
        <circle cx="114" cy="52" r="4.5" fill="var(--mac-accent)" opacity="0.2" />
      </svg>
      <div className="max-w-[380px]">
        <p className="text-[15px] font-medium" style={{ color: "var(--mac-text)" }}>
          Nothing traced yet
        </p>
        <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: "var(--mac-text-2)" }}>
          Paste your solution — Python or JavaScript runs for real, mistakes and all — then
          press <span style={{ color: "var(--mac-accent)" }}>Visualize</span>.
        </p>
      </div>
    </div>
  );
}

function GraphIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="var(--mac-accent)"
      strokeWidth="1.3"
      aria-hidden
    >
      <circle cx="4" cy="12" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 11 L10 5 M10 6 L10 10" />
    </svg>
  );
}
