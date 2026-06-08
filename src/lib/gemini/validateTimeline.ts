import type {
  Scenario,
  TimelineFrame,
  VariableValue,
  VisualizationMode,
  StatusType,
  ListNode,
  TreeNode,
  VisualizationStructures,
} from "@/lib/types";
import { EMPTY_STRUCTURES } from "@/lib/types";

const MODES: VisualizationMode[] = ["ARRAY", "HASH_MAP", "LINKED_LIST", "TREE"];
const STATUSES: StatusType[] = ["EXPLORE", "SUCCESS", "FAIL"];
const MAX_FRAMES = 40;

function repairAndParse(text: string): unknown {
  let s = text.trim();

  // Strip markdown fences
  s = s.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "");

  // Find the JSON object
  const start = s.indexOf("{");
  if (start > 0) s = s.slice(start);

  // First try clean parse
  const end = s.lastIndexOf("}");
  if (end > 0) {
    try {
      return JSON.parse(s.slice(0, end + 1));
    } catch {
      // fall through to repair
    }
  }

  // Repair: close unterminated strings
  const quotes = (s.match(/(?<!\\)"/g) ?? []).length;
  if (quotes % 2 !== 0) s += '"';

  // Remove trailing incomplete key-value after last comma
  s = s.replace(/,\s*"[^"]*"?\s*:?\s*[^}\]]*$/, "");

  // Remove dangling commas before close
  s = s.replace(/,(\s*[}\]])/g, "$1");

  // Close unclosed brackets
  const openBrackets = (s.match(/\[/g) ?? []).length - (s.match(/\]/g) ?? []).length;
  const openBraces = (s.match(/\{/g) ?? []).length - (s.match(/\}/g) ?? []).length;
  s += "]".repeat(Math.max(0, openBrackets));
  s += "}".repeat(Math.max(0, openBraces));

  return JSON.parse(s);
}

export function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  try {
    return repairAndParse(trimmed);
  } catch {
    return null;
  }
}

function isMode(v: unknown): v is VisualizationMode {
  return typeof v === "string" && MODES.includes(v as VisualizationMode);
}

function isStatus(v: unknown): v is StatusType {
  return typeof v === "string" && STATUSES.includes(v as StatusType);
}

function normalizeListData(raw: unknown): ListNode[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n) => n && typeof n === "object")
    .map((n, i) => {
      const node = n as Record<string, unknown>;
      return {
        id: String(node.id ?? `n${i}`),
        value: (node.value ?? 0) as number | string,
        next: node.next == null ? null : String(node.next),
      };
    });
}

function normalizeTreeData(raw: unknown): TreeNode[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n) => n && typeof n === "object")
    .map((n, i) => {
      const node = n as Record<string, unknown>;
      return {
        id: String(node.id ?? `t${i}`),
        value: (node.value ?? 0) as number | string,
        children: Array.isArray(node.children) ? node.children.map(String) : [],
        parent: node.parent == null ? null : String(node.parent),
      };
    });
}

function normalizeStructures(raw: unknown): VisualizationStructures {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mapData: Record<string, number | string> = {};
  if (s.mapData && typeof s.mapData === "object" && !Array.isArray(s.mapData)) {
    for (const [k, v] of Object.entries(s.mapData as Record<string, unknown>)) {
      mapData[String(k)] = typeof v === "number" || typeof v === "string" ? v : String(v);
    }
  }

  return {
    arrayData: Array.isArray(s.arrayData) ? s.arrayData.map((v) => (typeof v === "number" ? v : String(v))) : [],
    mapData,
    listData: normalizeListData(s.listData),
    treeData: normalizeTreeData(s.treeData),
  };
}

function normalizeVariables(raw: unknown): Record<string, VariableValue> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, VariableValue> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (
      v === null ||
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean" ||
      Array.isArray(v)
    ) {
      out[k] = v as VariableValue;
      count++;
    }
  }
  return count > 0 ? out : undefined;
}

function normalizeFrame(raw: unknown, index: number): TimelineFrame {
  const f = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode = isMode(f.mode) ? f.mode : "ARRAY";
  const overlayModes = Array.isArray(f.overlayModes)
    ? (f.overlayModes.filter(isMode) as VisualizationMode[])
    : undefined;

  const pointers =
    f.activePointers && typeof f.activePointers === "object" && !Array.isArray(f.activePointers)
      ? (f.activePointers as TimelineFrame["activePointers"])
      : {};

  const highlights = Array.isArray(f.highlightedElements)
    ? f.highlightedElements.filter((h) => typeof h === "number" || typeof h === "string")
    : [];

  return {
    step: typeof f.step === "number" ? f.step : index,
    mode,
    overlayModes: overlayModes?.length ? overlayModes : undefined,
    structures: normalizeStructures(f.structures),
    activePointers: pointers,
    highlightedElements: highlights as (string | number)[],
    statusType: isStatus(f.statusType) ? f.statusType : "EXPLORE",
    message: typeof f.message === "string" ? f.message : `Step ${index}`,
    variables: normalizeVariables(f.variables),
  };
}

export function validateScenarioPayload(raw: unknown): Scenario {
  if (!raw || typeof raw !== "object") {
    throw new Error("Gemini response is not a valid JSON object");
  }

  const data = raw as Record<string, unknown>;

  if (!Array.isArray(data.timeline) || data.timeline.length === 0) {
    throw new Error("Timeline is empty — Gemini could not generate visualization steps");
  }

  const timeline = data.timeline.slice(0, MAX_FRAMES).map((frame, i) => normalizeFrame(frame, i));

  timeline.forEach((frame, i) => {
    frame.step = i;
  });

  const primaryMode = isMode(data.primaryMode) ? data.primaryMode : timeline[0].mode;

  return {
    id: "gemini-generated",
    name: typeof data.name === "string" ? data.name : "AI Generated",
    description: typeof data.description === "string" ? data.description : "Generated by Gemini",
    timeComplexity: typeof data.timeComplexity === "string" ? data.timeComplexity : undefined,
    spaceComplexity: typeof data.spaceComplexity === "string" ? data.spaceComplexity : undefined,
    primaryMode,
    timeline,
  };
}

export function createEmptyScenario(): Scenario {
  return {
    id: "gemini-generated",
    name: "AI Generated",
    description: "Paste code and analyze with Gemini",
    primaryMode: "ARRAY",
    timeline: [
      {
        step: 0,
        mode: "ARRAY",
        structures: { ...EMPTY_STRUCTURES },
        activePointers: {},
        highlightedElements: [],
        statusType: "EXPLORE",
        message: "Paste your algorithm code above and click Analyze to generate a visualization",
      },
    ],
  };
}
