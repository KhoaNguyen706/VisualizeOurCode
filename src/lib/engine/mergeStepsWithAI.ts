import type {
  TimelineFrame,
  VisualizationMode,
  StatusType,
  VariableValue,
  ListNode,
  TreeNode,
} from "@/lib/types";
import { EMPTY_STRUCTURES } from "@/lib/types";
import type { TraceStep } from "./runSandbox";

export interface AITemplateStep {
  line?: number;
  index?: number;
  template: string;
  statusType?: StatusType;
  mode?: VisualizationMode;
  overlayModes?: VisualizationMode[];
}

export interface AITemplatePack {
  name: string;
  description: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  primaryMode: VisualizationMode;
  steps: AITemplateStep[];
  defaultTemplate?: string;
}

function resolvePath(vars: Record<string, unknown>, path: string): unknown {
  const bracketMatch = path.match(/^(\w+)\[(\d+)\]$/);
  if (bracketMatch) {
    const arr = vars[bracketMatch[1]];
    if (Array.isArray(arr)) return arr[Number(bracketMatch[2])];
    return undefined;
  }
  return vars[path];
}

export function fillTemplate(template: string, vars: Record<string, unknown>): string {
  const enriched = { ...vars };
  for (const [k, v] of Object.entries(vars)) {
    if (Array.isArray(v)) {
      v.forEach((item, idx) => {
        enriched[`${k}[${idx}]`] = item;
      });
    }
  }
  if (typeof vars.i === "number" && Array.isArray(vars.nums)) {
    enriched["nums[i]"] = (vars.nums as unknown[])[vars.i as number];
  }
  if (typeof vars.j === "number" && Array.isArray(vars.arr)) {
    enriched["arr[j]"] = (vars.arr as unknown[])[vars.j as number];
  }

  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const val = resolvePath(enriched, key.trim());
    if (val === undefined || val === null) return String(val ?? "?");
    if (Array.isArray(val)) {
      if (val.length > 0 && Array.isArray(val[0])) {
        return val.map((row) => `[${(row as unknown[]).join(",")}]`).join(", ");
      }
      return `[${val.join(",")}]`;
    }
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  });
}

function toVariableValue(v: unknown): VariableValue | undefined {
  if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || typeof x === "string" || typeof x === "number" || typeof x === "boolean")) {
      return v as VariableValue;
    }
    if (v.every((x) => Array.isArray(x))) {
      return v as VariableValue;
    }
  }
  return undefined;
}

function varsToVariables(vars: Record<string, unknown>): Record<string, VariableValue> {
  const out: Record<string, VariableValue> = {};
  for (const [k, v] of Object.entries(vars)) {
    const converted = toVariableValue(v);
    if (converted !== undefined) out[k] = converted;
  }
  return out;
}

function inferStructures(vars: Record<string, unknown>) {
  const structures = { ...EMPTY_STRUCTURES };

  for (const key of ["nums", "arr", "candidates", "path", "subset"]) {
    const val = vars[key];
    if (Array.isArray(val) && val.every((x) => typeof x === "number" || typeof x === "string")) {
      structures.arrayData = val as (number | string)[];
      break;
    }
  }

  for (const key of ["seen", "map"]) {
    const val = vars[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      structures.mapData = Object.fromEntries(
        Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, v as number | string])
      );
      break;
    }
  }

  if (vars.head && typeof vars.head === "object") {
    structures.listData = linkedListToLinear(vars.head);
  }

  if (Array.isArray(vars.treeData)) {
    structures.treeData = vars.treeData as TreeNode[];
  }

  return structures;
}

function linkedListToLinear(head: unknown): ListNode[] {
  const nodes: ListNode[] = [];
  let current = head as { value?: number | string; next?: unknown } | null;
  let id = 0;
  while (current && typeof current === "object") {
    const nodeId = `n${id++}`;
    const nextId = current.next ? `n${id}` : null;
    nodes.push({ id: nodeId, value: current.value ?? "?", next: nextId });
    current = current.next as typeof current;
    if (id > 50) break;
  }
  return nodes;
}

function inferPointers(vars: Record<string, unknown>) {
  const pointers: TimelineFrame["activePointers"] = {};
  for (const key of ["i", "j", "k", "left", "right", "depth", "start", "end"]) {
    const val = vars[key];
    if (typeof val === "number") pointers[key] = val;
  }
  for (const key of ["current", "prev", "head"]) {
    const val = vars[key];
    if (typeof val === "string") pointers[key] = val;
  }
  return pointers;
}

function inferHighlights(vars: Record<string, unknown>, pointers: TimelineFrame["activePointers"]): (string | number)[] {
  const highlights: (string | number)[] = [];
  if (typeof pointers.i === "number") highlights.push(pointers.i);
  if (typeof pointers.j === "number") highlights.push(pointers.j);
  if (typeof pointers.left === "number") highlights.push(pointers.left);
  if (typeof pointers.right === "number") highlights.push(pointers.right);
  if (Array.isArray(vars.path)) highlights.push(...(vars.path as (string | number)[]));
  return highlights;
}

function findTemplate(
  step: TraceStep,
  index: number,
  pack: AITemplatePack
): AITemplateStep | undefined {
  const byLine = pack.steps.find((s) => s.line === step.line);
  if (byLine) return byLine;
  const byIndex = pack.steps.find((s) => s.index === index);
  if (byIndex) return byIndex;
  return pack.steps[index % pack.steps.length];
}

function inferStatus(template: AITemplateStep | undefined, vars: Record<string, unknown>, returnHit: boolean): StatusType {
  if (returnHit) return "SUCCESS";
  if (template?.statusType) return template.statusType;
  if (vars.remain !== undefined && typeof vars.remain === "number" && vars.remain < 0) return "FAIL";
  if (vars.total !== undefined && vars.target !== undefined && vars.total === vars.target) return "SUCCESS";
  return "EXPLORE";
}

export function mergeStepsWithAI(
  traceHistory: TraceStep[],
  templates: AITemplatePack
): TimelineFrame[] {
  if (traceHistory.length === 0) {
    return [{
      step: 0,
      mode: templates.primaryMode,
      structures: { ...EMPTY_STRUCTURES },
      activePointers: {},
      highlightedElements: [],
      statusType: "EXPLORE",
      message: "No trace steps captured. Check that your code has loops or return statements.",
      variables: {},
    }];
  }

  return traceHistory.map((step, index) => {
    const template = findTemplate(step, index, templates);
    const vars = { ...step.vars, line: step.line };
    const tmplText = template?.template ?? templates.defaultTemplate ?? "Line {line}: executing step {line}";
    const message = fillTemplate(tmplText, vars);
    const pointers = inferPointers(vars);
    const structures = inferStructures(vars);
    const isReturn = template?.statusType === "SUCCESS" || message.toLowerCase().includes("found") || message.toLowerCase().includes("return");

    return {
      step: index,
      mode: template?.mode ?? templates.primaryMode,
      overlayModes: template?.overlayModes,
      structures,
      activePointers: pointers,
      highlightedElements: inferHighlights(vars, pointers),
      statusType: inferStatus(template, vars, isReturn),
      message,
      variables: varsToVariables(vars),
    };
  });
}
