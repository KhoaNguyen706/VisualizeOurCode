export function buildAnalysisPrompt(code: string, language?: string): string {
  const lang = language?.trim() || "auto-detect";

  return `You are an algorithm execution tracer. Read the code, pick a realistic small sample input, and trace EVERY meaningful step into a JSON visualization timeline.

LANG: ${lang}
CODE:
${code}

OUTPUT (one valid JSON object, no markdown, no comments):
{
  "name": "Algorithm name (3-5 words)",
  "description": "What it does (under 60 chars)",
  "timeComplexity": "O(?)",
  "spaceComplexity": "O(?)",
  "primaryMode": "ARRAY" | "HASH_MAP" | "LINKED_LIST" | "TREE",
  "timeline": [ /* 10-18 frames */ ]
}

CRITICAL RULES:
1. Generate 10-18 frames. Each frame = ONE meaningful operation (init, compare, swap, push, pop, recurse, return, etc.).
2. Every frame MUST populate the structures actually used by the algorithm. Do NOT leave them empty when they should have data. Data persists between frames until removed.
3. Each frame includes ALL four structure keys (use [] / {} for unused ones).
4. Each frame MUST include a "variables" object with the IMPORTANT mutable state at that step (see VARIABLES below).

FRAME SHAPE:
{
  "step": 0,
  "mode": "ARRAY",
  "overlayModes": ["ARRAY","HASH_MAP"],
  "structures": {
    "arrayData": [2,7,11,15],
    "mapData": {"2":0},
    "listData": [{"id":"n0","value":1,"next":"n1"}],
    "treeData": [{"id":"t0","value":"root","children":["t1"],"parent":null}]
  },
  "activePointers": {"i":1,"j":3,"current":"n0","prev":null,"depth":2},
  "highlightedElements": [1, "n0", "t1"],
  "variables": {"res":[[2,2,3]],"path":[2,2],"sum":4,"target":7},
  "statusType": "EXPLORE",
  "message": "Compare nums[1]=7 with target 9"
}

VARIABLES — what to put inside "variables":
- ONLY the variables defined in the user's code that change meaningfully (e.g. res, ans, result, path, subset, sum, count, max, min, depth, found, head, target).
- Skip generic loop indices (i, j, current, prev) — those go in activePointers.
- Show actual current values: arrays as [v1,v2], numbers as numbers, strings quoted, booleans, null.
- Allowed value types: string, number, boolean, null, array of those, or array-of-arrays.
- Limit to 3-5 variables per frame. Only include what's RELEVANT to that step.
- Update values across frames as the algorithm mutates them — they will be highlighted on change in the UI.

MODE PICKING:
- ARRAY: list/array iteration (sorting, two-pointer, sliding window).
- HASH_MAP: dict/map lookups, frequency counts, complement pairs.
- LINKED_LIST: linked-list traversal, reversal, cycle detection.
- TREE: recursion, backtracking, DFS/BFS, binary trees, graphs.
- Use overlayModes for 2-structure algorithms (Two Sum = ["ARRAY","HASH_MAP"]; Backtracking = ["TREE","ARRAY"]).

WORKED EXAMPLE — Combination Sum candidates=[2,3,7] target=7 (note variables: res, path, remain):
{
  "name":"Combination Sum","description":"Backtracking to find target sums","timeComplexity":"O(2^n)","spaceComplexity":"O(target)","primaryMode":"TREE",
  "timeline":[
    {"step":0,"mode":"TREE","overlayModes":["TREE","ARRAY"],"structures":{"arrayData":[],"mapData":{},"listData":[],"treeData":[{"id":"t0","value":"root","children":[],"parent":null}]},"activePointers":{"depth":0},"highlightedElements":["t0"],"variables":{"res":[],"path":[],"remain":7,"target":7},"statusType":"EXPLORE","message":"Init: empty path, remain=7"},
    {"step":1,"mode":"TREE","overlayModes":["TREE","ARRAY"],"structures":{"arrayData":[2],"mapData":{},"listData":[],"treeData":[{"id":"t0","value":"root","children":["t1"],"parent":null},{"id":"t1","value":2,"children":[],"parent":"t0"}]},"activePointers":{"depth":1,"current":"t1"},"highlightedElements":["t1",0],"variables":{"res":[],"path":[2],"remain":5,"target":7},"statusType":"EXPLORE","message":"Pick 2: path=[2], remain=5"},
    {"step":2,"mode":"TREE","overlayModes":["TREE","ARRAY"],"structures":{"arrayData":[2,2],"mapData":{},"listData":[],"treeData":[{"id":"t0","value":"root","children":["t1"],"parent":null},{"id":"t1","value":2,"children":["t2"],"parent":"t0"},{"id":"t2","value":2,"children":[],"parent":"t1"}]},"activePointers":{"depth":2,"current":"t2"},"highlightedElements":["t2",0,1],"variables":{"res":[],"path":[2,2],"remain":3,"target":7},"statusType":"EXPLORE","message":"Pick 2: path=[2,2], remain=3"},
    {"step":3,"mode":"TREE","overlayModes":["TREE","ARRAY"],"structures":{"arrayData":[2,2,3],"mapData":{},"listData":[],"treeData":[{"id":"t0","value":"root","children":["t1"],"parent":null},{"id":"t1","value":2,"children":["t2"],"parent":"t0"},{"id":"t2","value":2,"children":["t3"],"parent":"t1"},{"id":"t3","value":3,"children":[],"parent":"t2"}]},"activePointers":{"depth":3,"current":"t3"},"highlightedElements":["t3"],"variables":{"res":[[2,2,3]],"path":[2,2,3],"remain":0,"target":7},"statusType":"SUCCESS","message":"remain=0 — record [2,2,3]"}
  ]
}

ALWAYS:
- Pointer values reference REAL ids/indices ("i":2 not "i":"i").
- highlightedElements: use the actual indices/ids being touched this frame.
- listData/treeData persist between frames; mutate fields that change.
- variables track the most important mutable state across the whole timeline.

Return ONLY the JSON object. No markdown fences. No prose. Complete, valid JSON.`;
}

export function buildContinuationPrompt(partialJson: string): string {
  const tail = partialJson.slice(-800);
  return `Your previous JSON response was cut off mid-output. Continue EXACTLY from where you stopped.
Output ONLY the remaining characters needed to complete the JSON object — do NOT repeat the beginning.
Do NOT wrap in markdown. End with a valid closing }.

Partial ending:
...${tail}`;
}
