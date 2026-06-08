"use client";

import { useState } from "react";
import { createEmptyScenario } from "@/lib/gemini/validateTimeline";
import { useTimelinePlayer } from "@/hooks/useTimelinePlayer";
import type { Scenario } from "@/lib/types";
import { Header } from "@/components/layout/Header";
import { CodeEditor } from "@/components/layout/CodeEditor";
import { VisualizationCanvas } from "@/components/engine/VisualizationCanvas";
import { TraceStepView } from "@/components/engine/TraceStepView";
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
      style={{ background: "#1e1e1e" }}
      suppressHydrationWarning
    >
      <Header />

      <div className="flex flex-1 min-h-0">
        <CodeEditor onScenarioGenerated={handleVisualizeResult} />

        {/* Center — editor group / visualization */}
        <main className="flex-1 min-w-0 flex flex-col" style={{ background: "#1e1e1e" }}>
          <div
            className="h-[35px] shrink-0 flex items-end"
            style={{ background: "#2d2d2d", borderBottom: "1px solid #252526" }}
          >
            <div
              className="h-full flex items-center gap-2 px-4 text-[13px] text-[#ffffff]"
              style={{ background: "#1e1e1e", borderRight: "1px solid #252526", borderTop: "1px solid #007acc" }}
            >
              <GraphIcon />
              Visualization
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-4">
            {hasVisualization ? (
              <>
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
    <div className="h-full flex flex-col items-center justify-center text-center gap-4 select-none">
      <div className="opacity-30">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <rect x="8" y="20" width="18" height="18" rx="2" stroke="#3794ff" strokeWidth="2" />
          <rect x="32" y="20" width="18" height="18" rx="2" stroke="#3794ff" strokeWidth="2" />
          <rect x="56" y="20" width="18" height="18" rx="2" stroke="#3794ff" strokeWidth="2" />
          <path d="M17 50 L40 62 L63 50" stroke="#4ec9b0" strokeWidth="2" fill="none" />
          <circle cx="40" cy="38" r="6" stroke="#858585" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
      <div>
        <p className="text-[#cccccc] text-[14px]">No visualization yet</p>
        <p className="text-[#858585] text-[12px] mt-1 font-code">
          Paste DSA code (Python, JS, Java, C++) and press <span className="text-[#3794ff]">Visualize</span>
        </p>
      </div>
    </div>
  );
}

function GraphIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#3794ff" strokeWidth="1.2">
      <circle cx="4" cy="12" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 11 L10 5 M10 6 L10 10" />
    </svg>
  );
}
