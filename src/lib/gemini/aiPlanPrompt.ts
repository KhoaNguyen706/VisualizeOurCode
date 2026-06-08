export function buildAIPlanPrompt(code: string, language?: string, testCase?: string): string {
  const lang = language?.trim() || "auto-detect";
  const testBlock = testCase?.trim()
    ? `\nUSER TEST CASE (use these exact inputs):\n${testCase.trim()}\n`
    : "";

  return `You are a DSA visualization planner. Identify the technique, mentally trace the code, return JSON that drives a visual UI with CORRECT pointers/structures per step.

LANG: ${lang}
CODE:
${code}
${testBlock}
Return ONE minified JSON object:

{
  "name": "Max Sum Subarray",
  "description": "Sliding window of size k",
  "technique": "sliding_window",
  "timeComplexity": "O(n)",
  "spaceComplexity": "O(1)",
  "primaryMode": "ARRAY",
  "watchVariables": ["left","right","windowSum"],
  "sampleInput": "[2,1,5,1,3,2], k=3",
  "executionStrategy": "synthesize",
  "steps": [{
    "index": 0,
    "message": "left=0, right=2, window=[2,1,5]",
    "statusType": "EXPLORE",
    "vars": {"left":0,"right":2,"windowSum":8,"nums":[2,1,5,1,3,2]},
    "arrayData": [2,1,5,1,3,2],
    "pointers": {"left":0,"right":2},
    "highlights": [0,1,2]
  }]
}

technique (REQUIRED — pick one):
- two_pointer → pointers {"left":L,"right":R} or {"l":L,"r":R}, highlight both indices
- sliding_window → pointers {"left":L,"right":R}, highlights every index in [L..R]
- binary_search → pointers {"left":L,"right":R,"mid":M}
- dp_grid → vars.dp as 2D array, pointers {"row":r,"col":c}, primaryMode ARRAY
- dfs / bfs / graph / backtrack → treeData nodes, pointers {"current":"n0","depth":d}
- hash_map → overlayModes ["ARRAY","HASH_MAP"], mapData updates, pointer i
- hash_set → overlayModes ["ARRAY","HASH_MAP"], mapData set members {"4":"in set"}, resultData array, pointer i, conditionMet true/false per step
- linked_list / linked_list_cycle → listData with next links, pointers slow/fast or current/prev

RULES:
1. 6-10 steps max. REAL values in vars (never placeholders).
2. message strings: ASCII only, no quotes inside messages, no arrows — use "->" instead of special chars.
3. EVERY step MUST include correct "pointers" for the technique.
4. sliding_window: always set both left AND right as integers on every step.
5. two_pointer: always set left AND right (or l AND r).
6. dp_grid: include vars.dp as filled 2D number array growing each step.
7. dfs/graph: include treeData with id/parent/children, highlight current node.
8. linked_list_cycle: tail next points back to earlier node in listData.
9. executionStrategy = "synthesize" for non-JS.

Return ONLY valid JSON. No markdown. No trailing commas.`;
}
