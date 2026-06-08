import type { VisualizationTechnique } from "@/lib/engine/technique/types";
import { TECHNIQUE_LABELS } from "@/lib/engine/technique/types";

const POINTER_RULES: Partial<Record<VisualizationTechnique, string>> = {
  sliding_window:
    'pointers {"left":L,"right":R} every step, highlights all indices in [L..R], overlayModes ["ARRAY"]',
  two_pointer:
    'pointers {"left":L,"right":R}, highlight L and R only, messages about comparing both ends',
  binary_search: 'pointers {"left":L,"right":R,"mid":M}',
  hash_set:
    'overlayModes ["ARRAY","HASH_MAP"], mapData members {"v":"in set"}, resultData array, pointer i, conditionMet true/false when checking set',
  hash_map: 'overlayModes ["ARRAY","HASH_MAP"], mapData updates, pointer i',
  dp_grid: 'vars.dp 2D array, pointers {"row":r,"col":c}, gridData in structures',
};

export function isTechniqueGuidable(technique: VisualizationTechnique): boolean {
  return technique !== "generic" && technique !== "array_scan" && technique in POINTER_RULES;
}

export function buildTechniqueGuidedPlanPrompt(
  technique: VisualizationTechnique,
  code: string,
  language?: string,
  testCase?: string
): string {
  const lang = language?.trim() || "auto-detect";
  const label = TECHNIQUE_LABELS[technique];
  const ptrRule = POINTER_RULES[technique] ?? "follow code pointers";
  const testBlock = testCase?.trim() ? `\nTEST INPUT (use exactly):\n${testCase.trim()}\n` : "";

  return `Technique ALREADY DETECTED: ${technique} (${label}).
Trace THIS specific problem code — do NOT use a generic template. Follow the actual variables and logic in the code.

LANG: ${lang}
CODE:
${code}
${testBlock}
Visual rules for ${technique}: ${ptrRule}

Return ONE minified JSON object:
{"name":"...","description":"...","technique":"${technique}","primaryMode":"ARRAY","executionStrategy":"synthesize","steps":[/* 6-10 step objects */]}

REQUIREMENTS:
1. steps MUST contain 6-10 entries tracing THIS problem (e.g. max profit, longest substring — whatever the code actually solves).
2. technique MUST be "${technique}".
3. messages: ASCII only, use "->" not arrows, no quotes inside strings.
4. Use real values from the test input in arrayData and vars.
5. Match variable names from the code (max_p, prices, profit, left, right, etc).

Return ONLY valid JSON.`;
}
