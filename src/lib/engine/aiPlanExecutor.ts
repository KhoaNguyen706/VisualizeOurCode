import type {
  ListNode,
  TimelineFrame,
  TreeNode,
  VariableValue,
  VisualizationStructures,
} from "@/lib/types";
import type { AIPlan, AIPlanStep } from "@/lib/gemini/aiPlan";
import type { TraceStep } from "./runSandbox";
import type { VisualizationTechnique } from "./technique/types";
import { inferTechniqueFromCode } from "./technique/inferTechnique";

function emptyStructures(): VisualizationStructures {
  return { arrayData: [], mapData: {}, listData: [], treeData: [], gridData: [] };
}

function extractGrid(vars: Record<string, VariableValue>): (number | string)[][] | undefined {
  for (const key of ["dp", "memo", "grid", "table"]) {
    const v = vars[key];
    if (Array.isArray(v) && v.length > 0 && Array.isArray(v[0])) {
      return v as (number | string)[][];
    }
  }
  return undefined;
}

function buildStructures(
  step: AIPlanStep,
  prev?: VisualizationStructures,
  vars?: Record<string, VariableValue>
): VisualizationStructures {
  const base = prev ? { ...prev } : emptyStructures();
  const gridFromVars = vars ? extractGrid(vars) : undefined;
  return {
    arrayData: step.arrayData ?? base.arrayData ?? [],
    mapData: step.mapData ?? base.mapData ?? {},
    listData: (step.listData as ListNode[]) ?? base.listData ?? [],
    treeData: (step.treeData as TreeNode[]) ?? base.treeData ?? [],
    gridData: gridFromVars ?? base.gridData,
  };
}

function toPointers(p?: AIPlanStep["pointers"]): TimelineFrame["activePointers"] {
  if (!p) return {};
  const out: TimelineFrame["activePointers"] = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === null || typeof v === "number" || typeof v === "string") {
      out[k] = v;
    }
  }
  return out;
}

function isVariableValue(v: unknown): v is VariableValue {
  if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return true;
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || typeof x === "string" || typeof x === "number" || typeof x === "boolean"))
      return true;
    if (v.every((x) => Array.isArray(x))) return true;
  }
  return false;
}

/**
 * Convert an AI plan into TimelineFrames.
 * If sandboxTrace is provided AND plan.executionStrategy === "js_sandbox",
 * we override each step's vars with real captured runtime values matched by line.
 */
export function executeAIPlan(plan: AIPlan, sandboxTrace?: TraceStep[], code?: string): TimelineFrame[] {
  const frames: TimelineFrame[] = [];
  let prevStructures: VisualizationStructures | undefined;
  const technique: VisualizationTechnique | undefined =
    plan.technique ?? (code ? inferTechniqueFromCode(code) : undefined);

  const useSandbox =
    plan.executionStrategy === "js_sandbox" && sandboxTrace && sandboxTrace.length > 0;

  // Map sandbox steps by line for quick lookup
  const sandboxByLine = new Map<number, TraceStep[]>();
  if (useSandbox && sandboxTrace) {
    for (const t of sandboxTrace) {
      const arr = sandboxByLine.get(t.line) ?? [];
      arr.push(t);
      sandboxByLine.set(t.line, arr);
    }
  }
  const sandboxCursors = new Map<number, number>();

  plan.steps.forEach((step, idx) => {
    const structures = buildStructures(step, prevStructures, step.vars);
    prevStructures = structures;

    let variables: Record<string, VariableValue> = { ...step.vars };

    if (useSandbox && step.line !== undefined) {
      const bucket = sandboxByLine.get(step.line);
      if (bucket && bucket.length > 0) {
        const cur = sandboxCursors.get(step.line) ?? 0;
        const trace = bucket[Math.min(cur, bucket.length - 1)];
        sandboxCursors.set(step.line, cur + 1);
        // Merge sandbox-captured values over the AI-synthesized ones
        const merged: Record<string, VariableValue> = { ...variables };
        for (const [k, v] of Object.entries(trace.vars)) {
          if (isVariableValue(v)) merged[k] = v;
        }
        variables = merged;
      }
    }

    frames.push({
      step: idx,
      mode: plan.primaryMode,
      overlayModes: plan.overlayModes,
      structures,
      activePointers: toPointers(step.pointers),
      highlightedElements: step.highlights ?? [],
      statusType: step.statusType,
      message: step.message,
      variables,
      technique,
    });
  });

  return frames;
}
