"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTimelinePlayer } from "@/hooks/useTimelinePlayer";
import type { Scenario } from "@/lib/types";
import { createEmptyScenario, scenarios } from "@/lib/scenarios";
import { CODE_SAMPLES } from "@/lib/samples";
import { analyzeLocally } from "@/lib/engine/analyzeLocally";
import type { AnalyzeResult } from "@/lib/engine/analyzeLocally";
import { decodeSession, shareUrl } from "@/lib/share";
import { Header } from "@/components/layout/Header";
import { CodeEditor } from "@/components/layout/CodeEditor";
import type { LoadStage } from "@/components/layout/CodeEditor";
import { VisualizationCanvas } from "@/components/engine/VisualizationCanvas";
import { TraceStepView } from "@/components/engine/TraceStepView";
import { PatternHintBanner } from "@/components/engine/PatternHintBanner";
import { StateInspector } from "@/components/engine/StateInspector";
import { BottomPanel } from "@/components/engine/BottomPanel";
import { RoadmapView } from "@/components/engine/RoadmapView";
import { topicOf } from "@/lib/roadmap";

/** Everything known about the run whose timeline is on screen. */
export interface RunInfo {
  code: string;
  language: string;
  elapsedMs: number;
  traceSteps: number;
  warning?: string;
  pattern?: string;
  patternHint?: AnalyzeResult["patternHint"];
  /** Where the timeline came from — "trace" means the user's own execution. */
  source?: AnalyzeResult["source"];
  techniques?: AnalyzeResult["techniques"];
  returnValue?: unknown;
  hasReturnValue?: boolean;
  stdout?: string;
  runtimeError?: string;
  /** One frame per recorded line — the unfolded view of the same run. */
  lineTimeline?: Scenario["timeline"];
}

/** How finely the run is cut: into beats the canvas can show, or every line. */
export type Detail = "beats" | "lines";

const LEFT_KEY = "voc-left-width";
const RIGHT_KEY = "voc-right-width";
const LEFT = { min: 280, max: 720, initial: 420 };
const RIGHT = { min: 220, max: 560, initial: 300 };

function readWidth(key: string, fallback: number, lo: number, hi: number): number {
  try {
    const n = Number(window.localStorage.getItem(key));
    if (Number.isFinite(n) && n >= lo && n <= hi) return n;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function VisualizerApp() {
  // The editor is controlled from here so a shared link can fill it, the
  // header can read it for sharing, and ⌘↩ can run it from anywhere.
  const [code, setCode] = useState<string>(() => {
    const shared = decodeSession(window.location.hash);
    return shared?.code ?? CODE_SAMPLES[0].code;
  });
  const [language, setLanguage] = useState<string>(() => {
    const shared = decodeSession(window.location.hash);
    return shared?.language ?? CODE_SAMPLES[0].language;
  });
  const [testCase, setTestCase] = useState<string>(
    () => decodeSession(window.location.hash)?.testCase ?? ""
  );

  const [scenario, setScenario] = useState<Scenario>(createEmptyScenario());
  const [hasVisualization, setHasVisualization] = useState(false);
  const [run, setRun] = useState<RunInfo | undefined>();
  const [stage, setStage] = useState<LoadStage>("idle");
  const [error, setError] = useState<string | null>(null);
  // The roadmap sits in place of the canvas while it is open; a run closes it.
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  const [leftWidth, setLeftWidth] = useState(() => readWidth(LEFT_KEY, LEFT.initial, LEFT.min, LEFT.max));
  const [rightWidth, setRightWidth] = useState(() => readWidth(RIGHT_KEY, RIGHT.initial, RIGHT.min, RIGHT.max));

  const [detail, setDetail] = useState<Detail>("beats");
  const timeline =
    detail === "lines" && run?.lineTimeline?.length ? run.lineTimeline : scenario.timeline;
  const player = useTimelinePlayer({ timeline });

  // Switching granularity keeps the reader at about the same point in the run.
  const seekTo = player.seekTo;
  const changeDetail = useCallback(
    (next: Detail) => {
      const from = timeline.length;
      const to =
        next === "lines" && run?.lineTimeline?.length ? run.lineTimeline.length : scenario.timeline.length;
      const at = from > 1 ? Math.round((player.currentIndex / (from - 1)) * (to - 1)) : 0;
      setDetail(next);
      // The player resets to 0 when its timeline changes; land after that.
      requestAnimationFrame(() => seekTo(at));
    },
    [timeline.length, run, scenario.timeline.length, player.currentIndex, seekTo]
  );

  const showResult = useCallback(
    (generated: Scenario, info?: RunInfo) => {
      player.pause();
      setScenario(generated);
      setRun(info);
      setHasVisualization(true);
      setRoadmapOpen(false);
    },
    [player]
  );

  const busy = useRef(false);
  const visualize = useCallback(async (override?: { code: string; language: string; testCase: string }) => {
    if (busy.current) return;
    const src = override ?? { code, language, testCase };
    if (!src.code.trim()) {
      setError("Please paste some code to visualize");
      return;
    }
    busy.current = true;
    setStage("tracing");
    setError(null);
    try {
      const result = await analyzeLocally(src.code, src.language, {
        enablePythonTrace: true,
        onPythonLoadStart: () => setStage("loading_python"),
        testCase: src.testCase.trim() || undefined,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      showResult(result.scenario, {
        code: src.code,
        language: src.language,
        elapsedMs: result.elapsedMs,
        traceSteps: result.traceSteps,
        warning: result.warning,
        pattern: result.pattern,
        patternHint: result.patternHint,
        source: result.source,
        techniques: result.techniques,
        returnValue: result.returnValue,
        hasReturnValue: result.hasReturnValue,
        stdout: result.stdout,
        runtimeError: result.runtimeError,
        lineTimeline: result.lineTimeline,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      busy.current = false;
      setStage("idle");
    }
  }, [code, language, testCase, showResult]);

  const loadSample = (sampleId: string) => {
    const sample = CODE_SAMPLES.find((s) => s.id === sampleId);
    if (!sample) return;
    setCode(sample.code);
    setLanguage(sample.language);
    setTestCase("");
    setError(null);
    return sample;
  };

  // A starter card is a promise of a picture, so it runs as soon as it loads.
  const startSample = (sampleId: string) => {
    const sample = loadSample(sampleId);
    if (sample) void visualize({ code: sample.code, language: sample.language, testCase: "" });
  };

  const loadDemo = (scenarioId: string) => {
    const demo = scenarios.find((s) => s.id === scenarioId);
    if (!demo) return;
    setError(null);
    showResult(demo, { code, language, elapsedMs: 0, traceSteps: demo.timeline.length, source: "dsa" });
  };

  // A shared link opened cold runs itself, so the recipient sees the picture
  // before they have to touch anything.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (decodeSession(window.location.hash)) void visualize();
  }, [visualize]);

  // Keyboard transport. Typing in the editor keeps its keys; ⌘↩ works anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void visualize();
        return;
      }
      if (typing || !hasVisualization) return;

      // A decision is a check the code made, or a return — the beats worth
      // jumping between when the loop body in between is bookkeeping.
      const decision = (f: Scenario["timeline"][number]) =>
        f.conditionMet !== undefined || f.statusType !== "EXPLORE";

      switch (e.key) {
        case " ":
          e.preventDefault();
          player.toggle();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) player.seekWhere(decision, 1);
          else player.stepForward();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) player.seekWhere(decision, -1);
          else player.stepBack();
          break;
        case "Home":
          e.preventDefault();
          player.reset();
          break;
        case "End":
          e.preventDefault();
          player.seekToEnd();
          break;
        case "Escape":
          player.pause();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, hasVisualization, visualize]);

  const persist = (key: string, value: number) => {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "var(--mac-window)" }}
      suppressHydrationWarning
    >
      <Header
        getShareUrl={() => shareUrl({ code, language, testCase: testCase.trim() || undefined })}
        onToggleRoadmap={() => setRoadmapOpen((o) => !o)}
        roadmapOpen={roadmapOpen || !hasVisualization}
      />

      <div className="flex flex-1 min-h-0">
        <CodeEditor
          code={code}
          language={language}
          testCase={testCase}
          stage={stage}
          error={error}
          warning={hasVisualization ? run?.warning : undefined}
          lastElapsed={run?.elapsedMs}
          width={leftWidth}
          onCodeChange={setCode}
          onLanguageChange={setLanguage}
          onTestCaseChange={setTestCase}
          onVisualize={() => void visualize()}
          onLoadSample={loadSample}
          onLoadDemo={loadDemo}
          onDismissError={() => setError(null)}
          activeLine={hasVisualization ? player.currentFrame?.sourceLine : undefined}
          coveredLines={hasVisualization ? player.currentFrame?.coveredLines : undefined}
        />

        <Divider
          onDrag={(dx) =>
            setLeftWidth((w) => {
              const next = Math.max(LEFT.min, Math.min(LEFT.max, w + dx));
              persist(LEFT_KEY, next);
              return next;
            })
          }
        />

        {/* Center — the visualization itself */}
        <main
          className="flex-1 min-w-0 flex flex-col"
          style={{ background: "var(--mac-content)" }}
        >
          <div className="flex-1 min-h-0 overflow-auto p-5">
            {hasVisualization && roadmapOpen ? (
              <RoadmapView
                currentTopic={topicOf(run?.techniques)}
                onRunSample={startSample}
                onLoadSample={(id) => {
                  loadSample(id);
                  setRoadmapOpen(false);
                }}
                onClose={() => setRoadmapOpen(false)}
                compact
              />
            ) : hasVisualization ? (
              <>
                <PatternHintBanner hint={run?.patternHint} isLiveTrace={run?.source === "trace"} />
                <TraceStepView
                  frame={player.currentFrame}
                  index={player.currentIndex}
                  total={player.totalSteps}
                  warning={run?.warning}
                  code={run?.code}
                />
                <VisualizationCanvas frame={player.currentFrame} />
              </>
            ) : (
              <EmptyVisualization stage={stage} onRunSample={startSample} onLoadSample={loadSample} />
            )}
          </div>
        </main>

        <Divider
          onDrag={(dx) =>
            setRightWidth((w) => {
              const next = Math.max(RIGHT.min, Math.min(RIGHT.max, w - dx));
              persist(RIGHT_KEY, next);
              return next;
            })
          }
        />

        <StateInspector
          frame={player.currentFrame}
          prevFrame={player.prevFrame}
          currentIndex={player.currentIndex}
          total={player.totalSteps}
          scenario={scenario}
          active={hasVisualization}
          width={rightWidth}
        />
      </div>

      <BottomPanel
        timeline={timeline}
        currentIndex={player.currentIndex}
        isPlaying={player.isPlaying}
        speed={player.speed}
        run={run}
        detail={detail}
        canChangeDetail={!!run?.lineTimeline?.length}
        onDetailChange={changeDetail}
        onPlay={player.play}
        onPause={player.pause}
        onStepBack={player.stepBack}
        onStepForward={player.stepForward}
        onSeek={player.seekTo}
        onSeekToEnd={player.seekToEnd}
        onSpeedChange={player.setSpeed}
        onReset={player.reset}
        disabled={!hasVisualization}
      />
    </div>
  );
}

/** A grab handle between two panels. Invisible until hovered, like a window edge. */
function Divider({ onDrag }: { onDrag: (dx: number) => void }) {
  const last = useRef<number | null>(null);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="w-[5px] shrink-0 cursor-col-resize relative group -mx-[2px] z-10"
      onPointerDown={(e) => {
        last.current = e.clientX;
        e.currentTarget.setPointerCapture(e.pointerId);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(e) => {
        if (last.current === null) return;
        const dx = e.clientX - last.current;
        if (dx !== 0) {
          last.current = e.clientX;
          onDrag(dx);
        }
      }}
      onPointerUp={(e) => {
        last.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }}
    >
      <div
        className="absolute inset-y-0 left-[2px] w-[1px] transition-colors group-hover:bg-[var(--mac-accent)] group-active:bg-[var(--mac-accent)]"
        style={{ background: "var(--mac-separator)" }}
      />
    </div>
  );
}

function EmptyVisualization({
  stage,
  onRunSample,
  onLoadSample,
}: {
  stage: LoadStage;
  onRunSample: (id: string) => void;
  onLoadSample: (id: string) => void;
}) {
  if (stage !== "idle") {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-3 select-none">
        <Pulse />
        <p className="text-[13px]" style={{ color: "var(--mac-text-2)" }}>
          {stage === "loading_python"
            ? "Downloading Python for your browser — first time only, then it is cached."
            : "Running your code…"}
        </p>
      </div>
    );
  }

  // The map is the empty state: paste a solution, or start from a topic.
  return (
    <div className="h-full flex flex-col gap-3">
      <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--mac-text-2)" }}>
        Paste your solution — Python or JavaScript runs for real, mistakes and all — then press{" "}
        <span style={{ color: "var(--mac-accent)" }}>Visualize</span> or{" "}
        <kbd className="font-code text-[11px]">⌘↩</kbd>. Or start from the map.
      </p>
      <RoadmapView onRunSample={onRunSample} onLoadSample={onLoadSample} />
    </div>
  );
}

function Pulse() {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full animate-bounce"
          style={{ background: "var(--mac-accent)", animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}
