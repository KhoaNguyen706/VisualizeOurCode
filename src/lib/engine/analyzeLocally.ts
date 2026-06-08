import type { Scenario } from "@/lib/types";
import { detectDSAPattern, isPatternPlausible } from "@/lib/dsa";
import type { DSADetection, DSAPattern } from "@/lib/dsa/types";
import { runDSATracer } from "@/lib/dsa/tracers";
import { instrumentCode } from "./instrumentCode";
import { detectFunctionName, extractEntryCall, runSandbox } from "./runSandbox";
import type { TraceStep } from "./runSandbox";
import { mergeStepsWithAI } from "./mergeStepsWithAI";
import type { AITemplatePack } from "./mergeStepsWithAI";
import { getTemplateByPattern, getTemplateForFunction } from "./templates";
import { fetchAIPlan } from "@/lib/gemini/aiPlan";
import type { AIPlan } from "@/lib/gemini/aiPlan";
import { isTechniqueGuidable } from "@/lib/gemini/techniqueGuidedPlanPrompt";
import { executeAIPlan } from "./aiPlanExecutor";
import { parseTestCase } from "@/lib/dsa/parseTestCase";
import { resolveLocalTracer } from "./resolveLocalTracer";
import { shouldSkipGenericTracer } from "./shouldSkipGenericTracer";
import { enrichScenarioTimeline } from "./technique/enrichTimeline";
import { inferTechniqueFromCode } from "./technique/inferTechnique";
import type { VisualizationTechnique } from "./technique/types";

export interface AnalyzeResult {
  scenario: Scenario;
  elapsedMs: number;
  traceSteps: number;
  source: "dsa" | "trace" | "ai_plan";
  pattern?: string;
  warning?: string;
}

export interface AnalyzeError {
  error: string;
}

const GENERIC_TEMPLATE: AITemplatePack = {
  name: "Algorithm Trace",
  description: "Client-side execution trace",
  primaryMode: "ARRAY",
  defaultTemplate: "Line {line}: i={i}, j={j}, sum={sum}, target={target}, res={res}",
  steps: [],
};

const APPROXIMATE_WARNING =
  "Approximate visualization — code may not match displayed steps. Add an Example comment for better accuracy.";

function formatFallbackWarning(aiReason?: string): string | undefined {
  if (!aiReason) return undefined;
  if (/GEMINI_API_KEY/i.test(aiReason)) {
    return "Using local code analysis. Add GEMINI_API_KEY to .env.local for AI-powered traces on novel algorithms.";
  }
  if (/json|parse|invalid plan/i.test(aiReason)) {
    return "AI plan could not be parsed — visualizing with local code analysis instead.";
  }
  if (/too short/i.test(aiReason)) {
    return "AI returned too few steps — using local code analysis instead.";
  }
  if (/rate limit/i.test(aiReason)) {
    return "AI rate limit reached — using local tracer.";
  }
  return "AI planner unavailable — using local code analysis.";
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
  const technique = inferTechniqueFromCode(rawCode);
  result.scenario = enrichScenarioTimeline(result.scenario, rawCode, technique);
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

function analyzeWithTracing(
  rawCode: string,
  templateOverride?: AITemplatePack
): AnalyzeResult | AnalyzeError {
  const start = performance.now();

  const fnName = detectFunctionName(rawCode);
  if (!fnName) {
    return { error: "No traceable function found for live execution." };
  }

  const template =
    templateOverride ??
    getTemplateForFunction(fnName) ??
    getTemplateByPattern(rawCode) ??
    GENERIC_TEMPLATE;

  const entryCall = extractEntryCall(rawCode, fnName);
  if (!entryCall) {
    return { error: `Add an example call: // Example: ${fnName}([1,2,3], 5)` };
  }

  const { code: instrumented } = instrumentCode(rawCode);
  const sandbox = runSandbox(instrumented, entryCall);

  if (sandbox.error) {
    return { error: `Execution failed: ${sandbox.error}` };
  }

  if (sandbox.traceHistory.length === 0) {
    return { error: "No trace steps captured from live execution." };
  }

  const timeline = mergeStepsWithAI(sandbox.traceHistory, template);
  const elapsedMs = Math.round(performance.now() - start);

  return {
    scenario: {
      id: `trace-${Date.now()}`,
      name: template.name,
      description: template.description,
      timeComplexity: template.timeComplexity,
      spaceComplexity: template.spaceComplexity,
      primaryMode: template.primaryMode,
      timeline,
    },
    elapsedMs,
    traceSteps: sandbox.traceHistory.length,
    source: "trace",
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

function buildResultFromAIPlan(
  plan: AIPlan,
  rawCode: string,
  language: string | undefined,
  start: number
): AnalyzeResult | null {
  const sandboxTrace =
    plan.executionStrategy === "js_sandbox" && isJavaScriptLike(language)
      ? safeRunSandbox(rawCode)
      : undefined;
  const timeline = executeAIPlan(plan, sandboxTrace, rawCode);
  if (timeline.length === 0) return null;

  const technique = (plan.technique as VisualizationTechnique) ?? inferTechniqueFromCode(rawCode);
  return finalizeResult(
    {
      scenario: enrichScenarioTimeline(
        {
          id: `ai-plan-${Date.now()}`,
          name: plan.name,
          description: plan.description,
          timeComplexity: plan.timeComplexity,
          spaceComplexity: plan.spaceComplexity,
          primaryMode: plan.primaryMode,
          timeline,
        },
        rawCode,
        technique
      ),
      elapsedMs: Math.round(performance.now() - start),
      traceSteps: timeline.length,
      source: "ai_plan",
      pattern: "ai_plan",
    },
    rawCode,
    start
  );
}

function safeRunSandbox(rawCode: string): TraceStep[] | undefined {
  try {
    const fnName = detectFunctionName(rawCode);
    if (!fnName) return undefined;
    const entryCall = extractEntryCall(rawCode, fnName);
    if (!entryCall) return undefined;
    const { code: instrumented } = instrumentCode(rawCode);
    const sandbox = runSandbox(instrumented, entryCall);
    if (sandbox.error || sandbox.traceHistory.length === 0) return undefined;
    return sandbox.traceHistory;
  } catch {
    return undefined;
  }
}

export interface AnalyzeOptions {
  templateOverride?: AITemplatePack;
  /** Called when we begin a remote AI plan fetch (cache miss) */
  onAIPlanStart?: () => void;
  /** Skip the AI plan tier entirely (offline / cost-sensitive paths) */
  skipAIPlan?: boolean;
  /** Pasted test case, e.g. "[2,1,5,1,3,2], k=3" */
  testCase?: string;
}

/**
 * Universal DSA analyzer — always returns a visualization:
 *   1. High-confidence pattern tracers (instant, problem-specific only)
 *   2. Local structural resolver (instant — skips generic-template tracers)
 *   3. Technique-guided AI Plan (technique known → Gemini traces THIS problem)
 *   4. Full AI Plan (discovery mode for unknown techniques)
 *   5. JS/TS live tracing
 *   6. Generic best-effort (never fails)
 */
export async function analyzeLocally(
  rawCode: string,
  language?: string,
  options: AnalyzeOptions | AITemplatePack = {}
): Promise<AnalyzeResult | AnalyzeError> {
  const start = performance.now();

  if (!rawCode.trim()) {
    return { error: "Please paste some code to visualize" };
  }

  // Backward-compat: if a raw AITemplatePack is passed, treat it as templateOverride.
  const opts: AnalyzeOptions =
    options && "steps" in (options as AITemplatePack)
      ? { templateOverride: options as AITemplatePack }
      : (options as AnalyzeOptions);

  const testOverrides = opts.testCase?.trim() ? parseTestCase(opts.testCase) : undefined;
  const detection = detectDSAPattern(rawCode, language, testOverrides);
  const detectedTechnique = inferTechniqueFromCode(rawCode);

  // 1. High-confidence DSA pattern — skip generic-template tracers (e.g. sliding_window sum template)
  if (
    detection.pattern !== "generic" &&
    isPatternPlausible(detection) &&
    !shouldSkipGenericTracer(detection.pattern, rawCode)
  ) {
    const result = runPatternTracer(rawCode, detection.pattern, language, detection);
    if (result) return finalizeResult(result, rawCode, start);
  }

  // 2. Local structural resolver — skip generic-template tracers
  const localPattern = resolveLocalTracer(rawCode, detection);
  if (localPattern && !shouldSkipGenericTracer(localPattern, rawCode)) {
    const result = runPatternTracer(rawCode, localPattern, language, detection);
    if (result) {
      result.pattern = localPattern;
      return finalizeResult(result, rawCode, start);
    }
  }

  let aiUnavailable: string | undefined;
  if (!opts.skipAIPlan) {
    const tryPlan = async (techniqueHint?: string, onStart?: () => void) => {
      const { plan, unavailableReason } = await fetchAIPlan(rawCode, language, {
        onStart,
        testCase: opts.testCase,
        techniqueHint,
      });
      if (unavailableReason) aiUnavailable = unavailableReason;
      if (!plan) return null;
      const result = buildResultFromAIPlan(plan, rawCode, language, start);
      if (!result) {
        aiUnavailable = "AI plan too short";
        return null;
      }
      return result;
    };

    try {
      if (isTechniqueGuidable(detectedTechnique)) {
        const guided = await tryPlan(detectedTechnique, opts.onAIPlanStart);
        if (guided) return guided;
        if (!/GEMINI_API_KEY/i.test(aiUnavailable ?? "")) {
          const full = await tryPlan(undefined);
          if (full) return full;
        }
      } else {
        const full = await tryPlan(undefined, opts.onAIPlanStart);
        if (full) return full;
      }
    } catch {
      aiUnavailable = "AI planner failed";
    }
  }

  // 5. JS/TS live trace
  if (isJavaScriptLike(language)) {
    const traceResult = analyzeWithTracing(rawCode, opts.templateOverride);
    if (!("error" in traceResult)) {
      return finalizeResult(traceResult, rawCode, start);
    }
  }

  // 6. Always visualize — technique-aware generic (never return an error)
  const fallback = genericFallback(rawCode, language, detection, start);
  const aiWarning = formatFallbackWarning(aiUnavailable);
  if (aiWarning) fallback.warning = aiWarning;
  return finalizeResult(fallback, rawCode, start);
}
