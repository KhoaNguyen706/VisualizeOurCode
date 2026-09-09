"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CODE_SAMPLES } from "@/lib/samples";
import { analyzeLocally } from "@/lib/engine/analyzeLocally";
import type { AnalyzeResult } from "@/lib/engine/analyzeLocally";
import type { PatternHint } from "@/lib/engine/patternHint";
import { scenarios } from "@/lib/scenarios";
import type { Scenario } from "@/lib/types";

const LANG_EXT: Record<string, string> = {
  python: "py",
  javascript: "js",
  java: "java",
  cpp: "cpp",
  typescript: "ts",
};

export interface VisualizeMeta {
  elapsedMs: number;
  traceSteps: number;
  warning?: string;
  pattern?: string;
  patternHint?: PatternHint;
  /** Where the timeline came from — "trace" means the user's own execution. */
  source?: AnalyzeResult["source"];
}

interface CodeEditorProps {
  onScenarioGenerated: (scenario: Scenario, meta?: VisualizeMeta) => void;
  /** 1-based source line of the step being shown, highlighted in the gutter. */
  activeLine?: number;
  /**
   * The other lines this beat ran through. Marked faintly so the fold is
   * visible — the beat is one move, but it was more than one line.
   */
  coveredLines?: number[];
}

type LoadStage = "idle" | "tracing" | "loading_python";

export function CodeEditor({ onScenarioGenerated, activeLine, coveredLines }: CodeEditorProps) {
  const [code, setCode] = useState<string>(CODE_SAMPLES[0].code);
  const [language, setLanguage] = useState<string>(CODE_SAMPLES[0].language);
  const [stage, setStage] = useState<LoadStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [lastElapsed, setLastElapsed] = useState<number | null>(null);
  const [testCase, setTestCase] = useState("");
  const [mounted, setMounted] = useState(false);
  const gutterRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const lines = useMemo(() => code.split("\n"), [code]);
  const fileName = `algorithm.${LANG_EXT[language] ?? "txt"}`;
  const loading = stage !== "idle";

  const handleVisualize = async () => {
    if (!code.trim()) {
      setError("Please paste some code to visualize");
      return;
    }

    setStage("tracing");
    setError(null);
    setWarning(null);

    try {
      const result = await analyzeLocally(code, language, {
        enablePythonTrace: true,
        onPythonLoadStart: () => setStage("loading_python"),
        testCase: testCase.trim() || undefined,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setLastElapsed(result.elapsedMs);
      if (result.warning) setWarning(result.warning);
      onScenarioGenerated(result.scenario, {
        elapsedMs: result.elapsedMs,
        traceSteps: result.traceSteps,
        warning: result.warning,
        pattern: result.pattern,
        patternHint: result.patternHint,
        source: result.source,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setStage("idle");
    }
  };

  const loadDemo = (scenarioId: string) => {
    const demo = scenarios.find((s) => s.id === scenarioId);
    if (demo) {
      onScenarioGenerated(demo, { elapsedMs: 0, traceSteps: demo.timeline.length });
      setLastElapsed(0);
      setError(null);
      setWarning(null);
    }
  };

  const loadSample = (sampleId: string) => {
    const sample = CODE_SAMPLES.find((s) => s.id === sampleId);
    if (sample) {
      setCode(sample.code);
      setLanguage(sample.language);
      setError(null);
      setWarning(null);
    }
  };

  return (
    <aside
      className="flex flex-col h-full shrink-0 w-[min(420px,38vw)] min-w-[280px]"
      style={{ background: "var(--mac-sidebar)", borderRight: "1px solid var(--mac-separator)" }}
    >
      {/* Explorer header */}
      <div
        className="h-[35px] shrink-0 flex items-center px-4 text-[11px] font-semibold uppercase tracking-wide text-[var(--mac-text-2)]"
        style={{ borderBottom: "1px solid var(--mac-separator)" }}
      >
        Explorer
      </div>

      {/* File tree stub */}
      <div className="px-2 py-1 text-[13px]" style={{ borderBottom: "1px solid var(--mac-separator)" }}>
        <div className="flex items-center gap-1.5 px-2 py-1 text-[var(--mac-text)]">
          <ChevronDown />
          <span className="font-code text-[12px]">src</span>
        </div>
        <div
          className="flex items-center gap-1.5 pl-6 pr-2 py-1 ml-1 rounded-sm"
          style={{ background: "var(--mac-accent)" }}
        >
          <FileIcon ext={LANG_EXT[language]} />
          <span className="font-code text-[12px] text-[var(--mac-accent-ink)]">{fileName}</span>
        </div>
      </div>

      {/* Editor tab bar */}
      <div
        className="h-[35px] shrink-0 flex items-end overflow-hidden"
        style={{ background: "var(--mac-inset)", borderBottom: "1px solid var(--mac-sidebar)" }}
      >
        <div
          className="h-full flex items-center gap-2 px-3 text-[13px] text-[var(--mac-text)] font-code"
          style={{ background: "var(--mac-content)", borderRight: "1px solid var(--mac-sidebar)", borderTop: "1px solid var(--mac-accent)" }}
        >
          <FileIcon ext={LANG_EXT[language]} small />
          {fileName}
          <button type="button" className="text-[var(--mac-text-2)] hover:text-[var(--mac-text)] text-[10px] ml-1" aria-label="Close tab">
            ×
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 py-1.5 flex-wrap"
        style={{ background: "var(--mac-content)", borderBottom: "1px solid var(--mac-separator)" }}
      >
        <button
          type="button"
          onClick={handleVisualize}
          disabled={loading}
          className="mac-btn mac-btn-primary"
        >
          {loading ? <Spinner /> : <PlayRunIcon />}
          {stage === "loading_python"
            ? "Loading Python…"
            : stage === "tracing"
              ? "Tracing…"
              : "Visualize"}
        </button>

        <select
          value=""
          onChange={(e) => e.target.value && loadSample(e.target.value)}
          className="mac-field mac-select"
          aria-label="Load sample"
        >
          <option value="">Samples…</option>
          {CODE_SAMPLES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        <select
          value=""
          onChange={(e) => e.target.value && loadDemo(e.target.value)}
          className="mac-field mac-select"
          aria-label="Load demo"
        >
          <option value="">Demos…</option>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="mac-field mac-select"
          aria-label="Language"
        >
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
          <option value="typescript">TypeScript</option>
        </select>

        <span className="text-[10px] font-code text-[var(--mac-text-2)] ml-auto">
          {lastElapsed !== null && (
            <span className="text-[var(--mac-good)] mr-2">{lastElapsed}ms</span>
          )}
          {code.length.toLocaleString()} chars
        </span>
      </div>

      {/* Test case input */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 py-2"
        style={{ background: "var(--mac-sidebar)", borderBottom: "1px solid var(--mac-separator)" }}
      >
        <label htmlFor="test-case-input" className="text-[10px] font-code uppercase tracking-wider text-[var(--mac-text-2)] shrink-0">
          Test case
        </label>
        <input
          id="test-case-input"
          type="text"
          value={testCase}
          onChange={(e) => setTestCase(e.target.value)}
          placeholder="optional — [1,2,3,4], k=2  or  list=[3,2,0,-4], pos=1"
          className="mac-field flex-1 min-w-0 font-code"
          spellCheck={false}
        />
      </div>

      {/* Editor body */}
      <div className="flex-1 min-h-0 flex overflow-hidden" style={{ background: "var(--mac-content)" }}>
        <div
          ref={gutterRef}
          className="shrink-0 py-3 pr-2 text-right font-code text-[13px] leading-[20px] select-none overflow-hidden"
          style={{ color: "var(--mac-text-2)", width: 48, borderRight: "1px solid var(--mac-separator)" }}
          aria-hidden
        >
          {mounted &&
            lines.map((_, i) => {
              const isActive = activeLine === i + 1;
              const isCovered = !isActive && coveredLines?.includes(i + 1);
              return (
                <div
                  key={i}
                  style={
                    isActive
                      ? { color: "var(--mac-content)", background: "var(--mac-warn)", fontWeight: 600 }
                      : isCovered
                        ? {
                            color: "var(--mac-warn)",
                            // `var(--x)22` is not a colour — the alpha has to be
                            // mixed in, not concatenated onto the token.
                            background: "color-mix(in srgb, var(--mac-warn) 16%, transparent)",
                          }
                        : undefined
                  }
                >
                  {i + 1}
                </div>
              );
            })}
        </div>

        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onScroll={(e) => {
            // The gutter is a separate element, so it has to follow the
            // textarea or the highlighted number drifts off its line.
            if (gutterRef.current) {
              gutterRef.current.scrollTop = e.currentTarget.scrollTop;
            }
          }}
          spellCheck={false}
          wrap="off"
          className="flex-1 w-full h-full resize-none font-code text-[13px] leading-[20px] text-[var(--mac-text)] bg-transparent px-3 py-3 outline-none"
          placeholder="// Paste your algorithm here…"
          // `pre` keeps one source line on one visual row; without it a wrapped
          // line pushes the code out of step with the gutter numbering.
          style={{ tabSize: 2, whiteSpace: "pre", overflowX: "auto" }}
        />
      </div>

      <AnimatePresence>
        {warning && !error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 px-3 py-2 text-[11px] font-code"
            style={{ background: "#3a3a1e", borderTop: "1px solid var(--mac-separator)", color: "var(--mac-warn)" }}
          >
            {warning}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden flex flex-col"
            style={{ background: "#5a1d1d", borderTop: "1px solid var(--mac-separator)", maxHeight: "40%" }}
          >
            <div className="px-3 py-2 text-[12px] font-code text-[var(--mac-bad)] flex items-start justify-between gap-2">
              <span className="flex-1 break-words">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-[var(--mac-bad)] hover:text-[var(--mac-text)] text-[14px] leading-none shrink-0"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="var(--mac-text)">
      <path d="M2 3l3 3 3-3" stroke="currentColor" fill="none" strokeWidth="1.2" />
    </svg>
  );
}

function FileIcon({ ext, small }: { ext?: string; small?: boolean }) {
  const size = small ? 14 : 16;
  const color =
    ext === "py" ? "#ffd43b" :
    ext === "js" || ext === "ts" ? "#f7df1e" :
    ext === "java" ? "#f89820" : "#519aba";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 1h7l3 3v11H3V1z" stroke={color} strokeWidth="1" fill="none" />
      <path d="M10 1v3h3" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  );
}

function PlayRunIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2l10 6-10 6V2z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" strokeLinecap="round" />
    </svg>
  );
}
