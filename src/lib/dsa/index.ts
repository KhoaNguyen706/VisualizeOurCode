import type { Scenario } from "@/lib/types";
import { detectDSAPattern } from "./detectPattern";
import { runDSATracer } from "./tracers";

export interface DSAAnalyzeResult {
  scenario: Scenario;
  elapsedMs: number;
  traceSteps: number;
  pattern: string;
  language: string;
}

export interface DSAAnalyzeError {
  error: string;
}

export function analyzeDSA(code: string, language?: string): DSAAnalyzeResult | DSAAnalyzeError {
  const start = performance.now();
  const detection = detectDSAPattern(code, language);

  if (detection.pattern === "generic") {
    return {
      error:
        "Could not identify a DSA pattern. Supported: Two Sum, Bubble Sort, Binary Search, Reverse Linked List, Combination Sum, Subsets. Add a comment like # Example: twoSum([2,7,11,15], 9)",
    };
  }

  const tracer = runDSATracer(detection.pattern, detection.inputs);
  if (!tracer) {
    return { error: `Tracer not available for pattern: ${detection.pattern}` };
  }

  const elapsedMs = Math.round(performance.now() - start);

  const scenario: Scenario = {
    id: `dsa-${detection.pattern}-${Date.now()}`,
    name: tracer.name,
    description: `${tracer.description} (detected from ${detection.language} code)`,
    timeComplexity: tracer.timeComplexity,
    spaceComplexity: tracer.spaceComplexity,
    primaryMode: tracer.primaryMode,
    timeline: tracer.timeline,
  };

  return {
    scenario,
    elapsedMs,
    traceSteps: tracer.timeline.length,
    pattern: detection.pattern,
    language: detection.language,
  };
}

export { detectDSAPattern, getBestPattern, isPatternPlausible, rankPatterns } from "./detectPattern";
