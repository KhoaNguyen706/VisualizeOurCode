import type {
  ListNode,
  TreeNode,
  VariableValue,
  VisualizationMode,
} from "@/lib/types";
import type { VisualizationTechnique } from "@/lib/engine/technique/types";

export type AIPlanStrategy = "js_sandbox" | "synthesize";

export interface AIPlanStep {
  index: number;
  line?: number;
  message: string;
  statusType: "EXPLORE" | "SUCCESS" | "FAIL";
  vars: Record<string, VariableValue>;
  arrayData?: (number | string)[];
  treeData?: TreeNode[];
  listData?: ListNode[];
  mapData?: Record<string, number | string>;
  pointers?: Record<string, number | string | null>;
  highlights?: (number | string)[];
}

export interface AIPlan {
  name: string;
  description: string;
  technique?: VisualizationTechnique;
  timeComplexity?: string;
  spaceComplexity?: string;
  primaryMode: VisualizationMode;
  overlayModes?: VisualizationMode[];
  watchVariables: string[];
  sampleInput: string;
  executionStrategy: AIPlanStrategy;
  steps: AIPlanStep[];
}

const MODES: VisualizationMode[] = ["ARRAY", "HASH_MAP", "LINKED_LIST", "TREE"];
const MIN_PLAN_STEPS = 4;

const TECHNIQUES: VisualizationTechnique[] = [
  "two_pointer", "sliding_window", "binary_search", "dp_grid", "dfs", "bfs", "graph",
  "backtrack", "hash_map", "hash_set", "linked_list", "linked_list_cycle", "array_scan", "generic",
];

function asTechnique(v: unknown): VisualizationTechnique | undefined {
  return typeof v === "string" && TECHNIQUES.includes(v as VisualizationTechnique)
    ? (v as VisualizationTechnique)
    : undefined;
}

function asMode(v: unknown): VisualizationMode | null {
  return typeof v === "string" && MODES.includes(v as VisualizationMode)
    ? (v as VisualizationMode)
    : null;
}

function asStatus(v: unknown): AIPlanStep["statusType"] {
  return v === "SUCCESS" || v === "FAIL" ? v : "EXPLORE";
}

function asVarValue(v: unknown): VariableValue | undefined {
  if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || typeof x === "string" || typeof x === "number" || typeof x === "boolean"))
      return v as VariableValue;
    if (v.every((x) => Array.isArray(x))) return v as VariableValue;
  }
  return undefined;
}

function normalizeVars(raw: unknown): Record<string, VariableValue> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, VariableValue> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const val = asVarValue(v);
    if (val !== undefined) out[k] = val;
  }
  return out;
}

function normalizeStep(raw: unknown, idx: number): AIPlanStep | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.message !== "string") return null;

  return {
    index: typeof r.index === "number" ? r.index : idx,
    line: typeof r.line === "number" ? r.line : undefined,
    message: r.message,
    statusType: asStatus(r.statusType),
    vars: normalizeVars(r.vars),
    arrayData: Array.isArray(r.arrayData)
      ? (r.arrayData.filter((x) => typeof x === "number" || typeof x === "string") as (number | string)[])
      : undefined,
    treeData: Array.isArray(r.treeData) ? (r.treeData as TreeNode[]) : undefined,
    listData: Array.isArray(r.listData) ? (r.listData as ListNode[]) : undefined,
    mapData:
      r.mapData && typeof r.mapData === "object" && !Array.isArray(r.mapData)
        ? (Object.fromEntries(
            Object.entries(r.mapData as Record<string, unknown>)
              .filter(([, v]) => typeof v === "number" || typeof v === "string")
          ) as Record<string, number | string>)
        : undefined,
    pointers:
      r.pointers && typeof r.pointers === "object" && !Array.isArray(r.pointers)
        ? (r.pointers as Record<string, number | string | null>)
        : undefined,
    highlights: Array.isArray(r.highlights)
      ? (r.highlights.filter((x) => typeof x === "number" || typeof x === "string") as (number | string)[])
      : undefined,
  };
}

export function validateAIPlan(raw: unknown): AIPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const primaryMode = asMode(r.primaryMode);
  if (!primaryMode) return null;
  if (!Array.isArray(r.steps) || r.steps.length === 0) return null;

  const steps = (r.steps as unknown[])
    .map((s, i) => normalizeStep(s, i))
    .filter((s): s is AIPlanStep => s !== null);

  if (steps.length < MIN_PLAN_STEPS) return null;

  const overlay = Array.isArray(r.overlayModes)
    ? (r.overlayModes.map(asMode).filter(Boolean) as VisualizationMode[])
    : undefined;

  const watch = Array.isArray(r.watchVariables)
    ? (r.watchVariables.filter((x) => typeof x === "string") as string[])
    : [];

  const strategy: AIPlanStrategy =
    r.executionStrategy === "js_sandbox" ? "js_sandbox" : "synthesize";

  return {
    name: typeof r.name === "string" ? r.name : "AI Visualization",
    description: typeof r.description === "string" ? r.description : "AI-generated trace",
    technique: asTechnique(r.technique),
    timeComplexity: typeof r.timeComplexity === "string" ? r.timeComplexity : undefined,
    spaceComplexity: typeof r.spaceComplexity === "string" ? r.spaceComplexity : undefined,
    primaryMode,
    overlayModes: overlay && overlay.length > 0 ? overlay : undefined,
    watchVariables: watch,
    sampleInput: typeof r.sampleInput === "string" ? r.sampleInput : "",
    executionStrategy: strategy,
    steps,
  };
}

const CACHE_PREFIX = "voc-plan:";
const CACHE_INDEX = "voc-plan:_index";
const MAX_ENTRIES = 50;

function normalizeCode(code: string): string {
  return code.replace(/\s+/g, " ").trim();
}

function hashKey(code: string, lang?: string, testCase?: string, techniqueHint?: string): string {
  const s = `${techniqueHint ?? "full"}::${lang ?? ""}::${normalizeCode(code)}::${testCase ?? ""}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function readIndex(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CACHE_INDEX);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(keys: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_INDEX, JSON.stringify(keys));
  } catch {
    /* ignore */
  }
}

export function getCachedPlan(
  code: string,
  lang?: string,
  testCase?: string,
  techniqueHint?: string
): AIPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + hashKey(code, lang, testCase, techniqueHint));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validateAIPlan(parsed);
  } catch {
    return null;
  }
}

export function setCachedPlan(
  code: string,
  lang: string | undefined,
  plan: AIPlan,
  testCase?: string,
  techniqueHint?: string
): void {
  if (typeof window === "undefined") return;
  try {
    const key = CACHE_PREFIX + hashKey(code, lang, testCase, techniqueHint);
    localStorage.setItem(key, JSON.stringify(plan));
    let idx = readIndex();
    idx = [key, ...idx.filter((k) => k !== key)];
    while (idx.length > MAX_ENTRIES) {
      const evict = idx.pop();
      if (evict) localStorage.removeItem(evict);
    }
    writeIndex(idx);
  } catch {
    /* quota exceeded */
  }
}

export interface FetchPlanOptions {
  onStart?: () => void;
  testCase?: string;
  /** When set, uses a shorter technique-guided prompt (cheaper + problem-specific). */
  techniqueHint?: string;
}

export interface FetchPlanResult {
  plan: AIPlan | null;
  unavailableReason?: string;
}

export async function fetchAIPlan(
  code: string,
  language?: string,
  options: FetchPlanOptions = {}
): Promise<FetchPlanResult> {
  const testCase = options.testCase?.trim();
  const techniqueHint = options.techniqueHint?.trim() || undefined;
  const cached = getCachedPlan(code, language, testCase, techniqueHint);
  if (cached) return { plan: cached };

  options.onStart?.();

  try {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language, testCase, technique: techniqueHint }),
    });
    if (!res.ok) {
      let reason = "AI planner unavailable";
      try {
        const err = await res.json();
        if (typeof err?.error === "string") reason = err.error;
      } catch {
        /* ignore */
      }
      if (/GEMINI_API_KEY/i.test(reason)) {
        reason = "GEMINI_API_KEY not configured";
      } else if (/json|parse|invalid/i.test(reason)) {
        reason = "AI plan JSON invalid";
      }
      return { plan: null, unavailableReason: reason };
    }
    const data = await res.json();
    const plan = validateAIPlan(data?.plan);
    if (plan) setCachedPlan(code, language, plan, testCase, techniqueHint);
    return { plan };
  } catch {
    return { plan: null, unavailableReason: "Could not reach AI planner" };
  }
}
