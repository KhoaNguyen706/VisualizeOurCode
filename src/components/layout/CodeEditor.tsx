"use client";

import { useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CODE_SAMPLES } from "@/lib/samples";
import { TOPICS } from "@/lib/roadmap";
import { scenarios } from "@/lib/scenarios";
import { tokenizeLines } from "@/lib/visual/highlight";
import type { Token, TokenType } from "@/lib/visual/highlight";

const LANG_EXT: Record<string, string> = {
  python: "py",
  javascript: "js",
  java: "java",
  cpp: "cpp",
  typescript: "ts",
};

export type LoadStage = "idle" | "tracing" | "loading_python";

interface CodeEditorProps {
  code: string;
  language: string;
  testCase: string;
  stage: LoadStage;
  error: string | null;
  warning?: string;
  lastElapsed?: number;
  width: number;
  onCodeChange: (code: string) => void;
  onLanguageChange: (language: string) => void;
  onTestCaseChange: (testCase: string) => void;
  onVisualize: () => void;
  onLoadSample: (id: string) => void;
  onLoadDemo: (id: string) => void;
  onDismissError: () => void;
  /** 1-based source line of the step being shown, highlighted in the gutter. */
  activeLine?: number;
  /**
   * The other lines this beat ran through. Marked faintly so the fold is
   * visible — the beat is one move, but it was more than one line.
   */
  coveredLines?: number[];
}

const LINE_HEIGHT = 20;
const PAD_Y = 12;

/** Token colours, by role. Tokens read through the appearance so both themes hold. */
const TOKEN_COLOR: Record<TokenType, string> = {
  plain: "var(--mac-text)",
  keyword: "var(--syn-keyword)",
  builtin: "var(--syn-builtin)",
  string: "var(--syn-string)",
  number: "var(--syn-number)",
  comment: "var(--syn-comment)",
  example: "var(--syn-example)",
  func: "var(--syn-func)",
  punct: "var(--syn-punct)",
  decorator: "var(--syn-builtin)",
};

export function CodeEditor({
  code,
  language,
  testCase,
  stage,
  error,
  warning,
  lastElapsed,
  width,
  onCodeChange,
  onLanguageChange,
  onTestCaseChange,
  onVisualize,
  onLoadSample,
  onLoadDemo,
  onDismissError,
  activeLine,
  coveredLines,
}: CodeEditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLPreElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const lines = useMemo(() => tokenizeLines(code, language), [code, language]);
  const fileName = `solution.${LANG_EXT[language] ?? "txt"}`;
  const loading = stage !== "idle";

  const syncScroll = (el: HTMLTextAreaElement) => {
    if (gutterRef.current) gutterRef.current.scrollTop = el.scrollTop;
    if (layerRef.current) {
      layerRef.current.scrollTop = el.scrollTop;
      layerRef.current.scrollLeft = el.scrollLeft;
    }
  };

  // Tab inserts two spaces instead of leaving the editor; every code editor
  // people have used does this, and Python needs the indentation.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart, selectionEnd } = el;
    const next = code.slice(0, selectionStart) + "  " + code.slice(selectionEnd);
    onCodeChange(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = selectionStart + 2;
    });
  };

  return (
    <aside
      className="flex flex-col h-full shrink-0 min-w-0"
      style={{ width, background: "var(--mac-sidebar)", borderRight: "1px solid var(--mac-separator)" }}
    >
      {/* Tab bar */}
      <div
        className="h-[35px] shrink-0 flex items-end overflow-hidden"
        style={{ background: "var(--mac-inset)", borderBottom: "1px solid var(--mac-separator)" }}
      >
        <div
          className="h-full flex items-center gap-2 px-3 text-[12.5px] text-[var(--mac-text)] font-code"
          style={{
            background: "var(--mac-content)",
            borderRight: "1px solid var(--mac-separator)",
            borderTop: "2px solid var(--mac-accent)",
          }}
        >
          <FileIcon ext={LANG_EXT[language]} small />
          {fileName}
        </div>
        <span className="ml-auto pr-3 pb-[9px] text-[10px] font-code text-[var(--mac-text-3)]">
          {lastElapsed !== undefined && lastElapsed > 0 && (
            <span className="text-[var(--mac-good)] mr-2">{lastElapsed}ms</span>
          )}
          {code.length.toLocaleString()} chars
        </span>
      </div>

      {/* Toolbar */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 py-1.5 flex-wrap"
        style={{ background: "var(--mac-content)", borderBottom: "1px solid var(--mac-separator)" }}
      >
        <button
          type="button"
          onClick={onVisualize}
          disabled={loading}
          className="mac-btn mac-btn-primary"
          title="Run and trace (⌘↩ / Ctrl+Enter)"
        >
          {loading ? <Spinner /> : <PlayRunIcon />}
          {stage === "loading_python" ? "Loading Python…" : stage === "tracing" ? "Tracing…" : "Visualize"}
        </button>

        <select
          value=""
          onChange={(e) => e.target.value && onLoadSample(e.target.value)}
          className="mac-field mac-select"
          aria-label="Load sample"
        >
          <option value="">Samples…</option>
          {TOPICS.map((t) => (
            <optgroup key={t.id} label={t.label}>
              {CODE_SAMPLES.filter((s) => s.topic === t.id).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <select
          value=""
          onChange={(e) => e.target.value && onLoadDemo(e.target.value)}
          className="mac-field mac-select"
          aria-label="Load demo"
        >
          <option value="">Demos…</option>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="mac-field mac-select"
          aria-label="Language"
        >
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>
      </div>

      {/* Test case input */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 py-2"
        style={{ background: "var(--mac-sidebar)", borderBottom: "1px solid var(--mac-separator)" }}
      >
        <label
          htmlFor="test-case-input"
          className="text-[10px] font-code uppercase tracking-wider text-[var(--mac-text-2)] shrink-0"
        >
          Test case
        </label>
        <input
          id="test-case-input"
          type="text"
          value={testCase}
          onChange={(e) => onTestCaseChange(e.target.value)}
          placeholder="optional — [1,2,3,4], k=2  or  [[1,0],[0,1]]"
          className="mac-field flex-1 min-w-0 font-code"
          spellCheck={false}
        />
      </div>

      {/* Editor body */}
      <div className="flex-1 min-h-0 flex overflow-hidden" style={{ background: "var(--mac-content)" }}>
        <div
          ref={gutterRef}
          className="shrink-0 pr-2 text-right font-code text-[12px] select-none overflow-hidden"
          style={{
            color: "var(--mac-text-3)",
            width: 44,
            paddingTop: PAD_Y,
            paddingBottom: PAD_Y,
            lineHeight: `${LINE_HEIGHT}px`,
            borderRight: "1px solid var(--mac-separator)",
          }}
          aria-hidden
        >
          {lines.map((_, i) => {
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

        <div className="relative flex-1 min-w-0">
          {/* Colour layer: same font, padding and line grid as the textarea,
              so the transparent text above lands exactly on the coloured text. */}
          <pre
            ref={layerRef}
            aria-hidden
            className="absolute inset-0 m-0 overflow-hidden font-code text-[13px] pointer-events-none"
            style={{
              padding: `${PAD_Y}px 12px`,
              lineHeight: `${LINE_HEIGHT}px`,
              tabSize: 2,
              whiteSpace: "pre",
            }}
          >
            {lines.map((tokens, i) => (
              <Line
                key={i}
                tokens={tokens}
                active={activeLine === i + 1}
                covered={!!coveredLines?.includes(i + 1)}
              />
            ))}
          </pre>

          <textarea
            ref={textRef}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            onScroll={(e) => syncScroll(e.currentTarget)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            wrap="off"
            autoCapitalize="off"
            autoCorrect="off"
            className="relative w-full h-full resize-none font-code text-[13px] bg-transparent outline-none"
            placeholder="// Paste your solution here…"
            style={{
              padding: `${PAD_Y}px 12px`,
              lineHeight: `${LINE_HEIGHT}px`,
              tabSize: 2,
              whiteSpace: "pre",
              overflow: "auto",
              color: "transparent",
              caretColor: "var(--mac-text)",
            }}
          />
        </div>
      </div>

      <AnimatePresence>
        {warning && !error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 px-3 py-2 text-[11px] font-code"
            style={{
              background: "var(--mac-warn-soft)",
              borderTop: "1px solid var(--mac-separator)",
              color: "var(--mac-warn)",
            }}
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
            style={{
              background: "var(--mac-bad-soft)",
              borderTop: "1px solid var(--mac-separator)",
              maxHeight: "40%",
            }}
          >
            <div className="px-3 py-2 text-[12px] font-code text-[var(--mac-bad)] flex items-start justify-between gap-2">
              <span className="flex-1 break-words">{error}</span>
              <button
                type="button"
                onClick={onDismissError}
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

function Line({ tokens, active, covered }: { tokens: Token[]; active: boolean; covered: boolean }) {
  return (
    <div
      style={{
        // A full-width band for the executing line; it has to extend past the
        // text so a short line is banded as clearly as a long one.
        background: active
          ? "color-mix(in srgb, var(--mac-warn) 18%, transparent)"
          : covered
            ? "color-mix(in srgb, var(--mac-warn) 7%, transparent)"
            : undefined,
        margin: "0 -12px",
        padding: "0 12px",
        minHeight: LINE_HEIGHT,
      }}
    >
      {tokens.map((t, i) => (
        <span key={i} style={{ color: TOKEN_COLOR[t.type] }}>
          {t.text}
        </span>
      ))}
    </div>
  );
}

function FileIcon({ ext, small }: { ext?: string; small?: boolean }) {
  const size = small ? 14 : 16;
  const color =
    ext === "py"
      ? "#3b82c4"
      : ext === "js"
        ? "#d3a728"
        : ext === "ts"
          ? "#3178c6"
          : ext === "java"
            ? "#f89820"
            : "#519aba";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 1h7l3 3v11H3V1z" stroke={color} strokeWidth="1.2" fill="none" />
      <path d="M10 1v3h3" stroke={color} strokeWidth="1.2" fill="none" />
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
    <svg
      className="animate-spin"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" strokeLinecap="round" />
    </svg>
  );
}
