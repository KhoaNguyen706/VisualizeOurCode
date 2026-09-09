import type { Scenario } from "@/lib/types";
import { detectDSAPattern, isPatternPlausible } from "@/lib/dsa";
import type { DSADetection, DSAPattern } from "@/lib/dsa/types";
import { runDSATracer } from "@/lib/dsa/tracers";
import { instrumentCode } from "./instrumentCode";
import { detectFunctionName, extractEntryCall, runSandbox } from "./runSandbox";
import { narrateTrace } from "./narrateTrace";
import { condenseTrace } from "./condenseTrace";
import {
  isPythonLike,
  detectPythonEntryTarget,
  buildPythonEntryCall,
} from "./python/detectPython";
import { buildPatternHint } from "./patternHint";
import type { PatternHint } from "./patternHint";
import { parseTestCase } from "@/lib/dsa/parseTestCase";
import { resolveLocalTracer } from "./resolveLocalTracer";
import { shouldSkipGenericTracer } from "./shouldSkipGenericTracer";
import { enrichScenarioTimeline } from "./technique/enrichTimeline";
import { inferTechniquesFromCode } from "./technique/inferTechnique";
import type { VisualizationTechnique } from "./technique/types";

export interface AnalyzeResult {
  scenario: Scenario;
  elapsedMs: number;
  traceSteps: number;
  /** `"trace"` is the author's own execution; `"dsa"` is a labelled walkthrough. */
  source: "dsa" | "trace";
  pattern?: string;
  warning?: string;
  /** Textbook approach for the detected problem shape, shown beside the trace. */
  patternHint?: PatternHint;
  /** Every technique the code combines, primary first. */
  techniques?: VisualizationTechnique[];
}

export interface AnalyzeError {
  error: string;
}

const APPROXIMATE_WARNING =
  "Approximate visualization — code may not match displayed steps. Add an Example comment for better accuracy.";

/**
 * Shown whenever the timeline comes from a pattern tracer rather than the
 * author's own execution, so a canonical walkthrough is never mistaken for
 * a trace of the code on screen.
 */
const CANONICAL_WARNING =
  "Showing the textbook walkthrough for this problem, not a trace of your code. " +
  "Paste JavaScript or Python with an Example comment to trace your own implementation.";

/**
 * Surface the actual reason the author's code did not run, next to a plain
 * statement that what follows is not their execution. Silence here is what lets
 * a canned walkthrough pass for a trace.
 */
function formatTraceFailureWarning(reason?: string): string | undefined {
  if (!reason) return undefined;
  const trimmed = reason.replace(/\s*$/, "").replace(/\.$/, "");
  return `${trimmed} — the steps below are a generic walkthrough, not a trace of your code.`;
}

function isJavaScriptLike(language?: string): boolean {
  if (!language) return true;
  return ["javascript", "typescript", "js", "ts"].includes(language.toLowerCase());
}

function finalizeResult(
  result: AnalyzeResult,
  rawCode: string,
  start: number
): AnalyzeResult {
  const techniques = inferTechniquesFromCode(rawCode);
  result.scenario = enrichScenarioTimeline(result.scenario, rawCode, techniques);
  result.techniques = techniques;
  result.traceSteps = result.scenario.timeline.length;
  result.elapsedMs = Math.round(performance.now() - start);
  return result;
}

function buildScenarioFromTracer(
  tracer: ReturnType<typeof runDSATracer>,
  pattern: string,
  language?: string,
  warning?: string
): AnalyzeResult | null {
  if (!tracer) return null;
  return {
    scenario: {
      id: `dsa-${pattern}-${Date.now()}`,
      name: tracer.name,
      description: tracer.description + (language ? ` (${language})` : ""),
      timeComplexity: tracer.timeComplexity,
      spaceComplexity: tracer.spaceComplexity,
      primaryMode: tracer.primaryMode,
      timeline: tracer.timeline,
    },
    elapsedMs: 0,
    traceSteps: tracer.timeline.length,
    source: "dsa",
    pattern,
    warning,
  };
}

function runPatternTracer(
  rawCode: string,
  pattern: DSAPattern,
  language: string | undefined,
  detection: DSADetection,
  warning?: string
): AnalyzeResult | null {
  if (!pattern) return null;
  const tracer = runDSATracer(pattern, detection.inputs, rawCode, language);
  return buildScenarioFromTracer(tracer, pattern, detection.language, warning);
}

/**
 * Execute the author's code and narrate what it actually did.
 *
 * This is the primary path for JavaScript/TypeScript. Everything here comes
 * from the run itself — a first-draft solution is described as the program it
 * is, not as the algorithm it resembles.
 */
function analyzeWithTracing(
  rawCode: string,
  testCase?: string
): AnalyzeResult | AnalyzeError {
  const start = performance.now();

  const fnName = detectFunctionName(rawCode);
  if (!fnName) {
    return { error: "No traceable function found for live execution." };
  }

  const entryCall = extractEntryCall(rawCode, fnName, testCase);
  if (!entryCall) {
    return { error: `Add an example call: // Example: ${fnName}([1,2,3], 5)` };
  }

  const { code: instrumented } = instrumentCode(rawCode);
  const sandbox = runSandbox(instrumented, entryCall);

  // A run stopped by a budget still executed everything up to that point, and
  // those steps are the author's code doing real work — keep them.
  if (sandbox.error && !sandbox.halted) {
    return { error: `Execution failed: ${sandbox.error}` };
  }
  if (sandbox.traceHistory.length === 0) {
    return {
      error: sandbox.halted
        ? "Execution hit a budget before recording any steps."
        : "No trace steps captured from live execution.",
    };
  }

  const haltedNote = sandbox.halted
    ? "Execution budget reached — trace truncated here."
    : undefined;
  // Narrate every line, then collapse to beats: the condenser needs each line's
  // own wording and structures to decide which of them a viewer would notice.
  const lineFrames = narrateTrace(sandbox.traceHistory, rawCode, { haltedNote });
  const timeline = condenseTrace(lineFrames, sandbox.traceHistory, rawCode);

  return {
    scenario: {
      id: `trace-${Date.now()}`,
      name: `${fnName}()`,
      description: `Live trace of your ${fnName} implementation`,
      primaryMode: timeline[0]?.mode ?? "ARRAY",
      timeline,
    },
    elapsedMs: Math.round(performance.now() - start),
    // The beats actually shown, not the raw lines they were folded from.
    traceSteps: timeline.length,
    source: "trace",
    warning: sandbox.halted
      ? "Execution stopped at the step budget — showing the trace up to that point."
      : undefined,
  };
}

/**
 * Execute the author's own Python and narrate what it actually did — the same
 * contract as {@link analyzeWithTracing}, but backed by in-browser CPython
 * (Pyodide). The Pyodide module is imported dynamically so it is only fetched
 * in the browser, on demand, and never during SSR or Node test runs.
 */
async function analyzeWithPythonTracing(
  rawCode: string,
  testCase?: string,
  onLoadStart?: () => void
): Promise<AnalyzeResult | AnalyzeError> {
  const target = detectPythonEntryTarget(rawCode);
  if (!target) {
    return { error: "No Python function found for live execution." };
  }

  const fnName = target.fnName;
  const entryCall = buildPythonEntryCall(rawCode, target, testCase);

  const start = performance.now();
  onLoadStart?.();

  const { runPythonTrace } = await import("./python/pythonSandbox");
  const sandbox = await runPythonTrace(rawCode, entryCall);

  // A wrong solution that raises still executed real steps up to the crash, and
  // those steps are the whole point — keep them and note the error, rather than
  // discarding the trace for the textbook walkthrough.
  if (sandbox.traceHistory.length === 0) {
    return {
      error: sandbox.error
        ? `Python execution failed: ${sandbox.error}`
        : "No trace steps captured from Python execution.",
    };
  }

  const runtimeError = sandbox.error && !sandbox.halted ? sandbox.error : undefined;
  const haltedNote = sandbox.halted
    ? "Execution budget reached — trace truncated here."
    : runtimeError
      ? `Runtime error: ${runtimeError}`
      : undefined;
  const lineFrames = narrateTrace(sandbox.traceHistory, rawCode, { haltedNote });
  const timeline = condenseTrace(lineFrames, sandbox.traceHistory, rawCode);

  return {
    scenario: {
      id: `pytrace-${Date.now()}`,
      name: `${fnName}()`,
      description: `Live trace of your ${fnName} implementation (Python)`,
      primaryMode: timeline[0]?.mode ?? "ARRAY",
      timeline,
    },
    elapsedMs: Math.round(performance.now() - start),
    traceSteps: timeline.length,
    source: "trace",
    warning: sandbox.halted
      ? "Execution stopped at the step budget — showing the trace up to that point."
      : runtimeError
        ? "Your Python raised an error — showing the trace up to that point."
        : undefined,
  };
}

function genericFallback(
  rawCode: string,
  language: string | undefined,
  detection: DSADetection,
  start: number
): AnalyzeResult {
  const tracer = runDSATracer("generic", detection.inputs, rawCode, language)!;
  const elapsedMs = Math.round(performance.now() - start);

  return {
    scenario: {
      id: `generic-${Date.now()}`,
      name: tracer.name,
      description: tracer.description,
      primaryMode: tracer.primaryMode,
      timeline: tracer.timeline,
    },
    elapsedMs,
    traceSteps: tracer.timeline.length,
    source: "dsa",
    pattern: "generic",
    warning: APPROXIMATE_WARNING,
  };
}

export interface AnalyzeOptions {
  /**
   * Execute Python in the browser with Pyodide. Off by default so Node test
   * runs and SSR stay hermetic; the browser entry point turns it on.
   */
  enablePythonTrace?: boolean;
  /** Called when the Pyodide runtime begins loading (first run downloads it). */
  onPythonLoadStart?: () => void;
  /** Pasted test case, e.g. "[2,1,5,1,3,2], k=3" */
  testCase?: string;
}

/**
 * Universal DSA analyzer — always returns a visualization, entirely on the
 * user's machine:
 *   1. Live trace of the author's own code (JS/TS, Python) — what actually ran
 *   2. Pattern tracer for the detected problem, labelled as the textbook version
 *   3. Local structural resolver, likewise labelled
 *   4. Generic best-effort (never fails)
 *
 * Order matters. Running the pattern tracers first — as this once did — meant a
 * first-draft solution was narrated with the canonical algorithm's steps, so a
 * brute-force loop was described as storing hash-map entries it never created.
 */
export async function analyzeLocally(
  rawCode: string,
  language?: string,
  opts: AnalyzeOptions = {}
): Promise<AnalyzeResult | AnalyzeError> {
  const start = performance.now();

  if (!rawCode.trim()) {
    return { error: "Please paste some code to visualize" };
  }

  const testOverrides = opts.testCase?.trim() ? parseTestCase(opts.testCase) : undefined;
  const detection = detectDSAPattern(rawCode, language, testOverrides);

  // The recognised pattern is a note about the *problem*, not a description of
  // this code. It rides along with whatever trace we produce.
  const hint =
    detection.pattern !== "generic" && isPatternPlausible(detection)
      ? buildPatternHint(detection.pattern, rawCode)
      : undefined;

  // Why the author's own code could not be run, kept so a fallback can say so
  // out loud instead of presenting a canned walkthrough as if it were the trace.
  let traceFailure: string | undefined;

  // 1. The author's own code, actually executed. Anything a template could say
  //    about a first draft would be a description of a different program, so
  //    this wins whenever the code is something we can genuinely run.
  if (isJavaScriptLike(language)) {
    const traced = analyzeWithTracing(rawCode, opts.testCase);
    if (!("error" in traced)) {
      traced.patternHint = hint;
      return finalizeResult(traced, rawCode, start);
    }
    traceFailure = traced.error;
  }

  // 1b. Python, executed for real with in-browser CPython (Pyodide). Same idea
  //     as the JS path — narrate the author's actual run, wrong answers
  //     included. Opt-in, so it never fires during SSR or Node tests.
  if (opts.enablePythonTrace && isPythonLike(language)) {
    const traced = await analyzeWithPythonTracing(
      rawCode,
      opts.testCase,
      opts.onPythonLoadStart
    );
    if (!("error" in traced)) {
      traced.patternHint = hint;
      return finalizeResult(traced, rawCode, start);
    }
    traceFailure = traced.error;
  }

  // 2. Not executable here (Java, C++), or a run failed — fall back to
  //    the canonical tracer for the detected pattern, clearly labelled as the
  //    textbook approach rather than this code.
  if (
    detection.pattern !== "generic" &&
    isPatternPlausible(detection) &&
    !shouldSkipGenericTracer(detection.pattern, rawCode)
  ) {
    const result = runPatternTracer(rawCode, detection.pattern, language, detection);
    if (result) {
      result.patternHint = hint;
      result.warning = result.warning ?? CANONICAL_WARNING;
      return finalizeResult(result, rawCode, start);
    }
  }

  // 3. Local structural resolver — skip generic-template tracers
  const localPattern = resolveLocalTracer(rawCode, detection);
  if (localPattern && !shouldSkipGenericTracer(localPattern, rawCode)) {
    const result = runPatternTracer(rawCode, localPattern, language, detection);
    if (result) {
      result.pattern = localPattern;
      result.patternHint = hint;
      result.warning = result.warning ?? CANONICAL_WARNING;
      return finalizeResult(result, rawCode, start);
    }
  }

  // 4. Always visualize — technique-aware generic (never return an error).
  //    Why the run failed is the most useful thing to say here: these steps
  //    are not the author's code, and they deserve to know why.
  const fallback = genericFallback(rawCode, language, detection, start);
  fallback.warning = formatTraceFailureWarning(traceFailure) ?? fallback.warning;
  fallback.patternHint = hint;
  return finalizeResult(fallback, rawCode, start);
}
