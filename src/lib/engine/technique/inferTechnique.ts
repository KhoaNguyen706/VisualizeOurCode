import type { VisualizationTechnique } from "./types";

/**
 * Which algorithm the code is shaped like, read off the vocabulary and the
 * structure the author used.
 *
 * Two questions are answered here. `inferTechniqueFromCode` names the *lead*
 * approach — the one whose picture should sit on top. `inferTechniquesFromCode`
 * names every approach the code combines, lead first, so a BFS that keeps a
 * visited set over a grid is shown as the BFS it is *and* the set it keeps,
 * rather than one label hiding the other. Nothing here changes what is traced;
 * it only decides which pictures are drawn and in what order.
 */

/** Indentation width, a tab counting as four columns. */
function indentOf(line: string): number {
  const expanded = line.replace(/\t/g, "    ");
  return expanded.length - expanded.trimStart().length;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `name(` as a call — bare, or through `self.` / `this.` — never `other.name(`. */
function callsName(body: string, name: string): boolean {
  return new RegExp(`(?:^|[^\\w$.])(?:self\\.|this\\.)?${escapeRe(name)}\\s*\\(`).test(body);
}

/**
 * The text between the `{` that opens a JavaScript body on `startLine` and its
 * matching `}`, skipping string literals and `//` comments. `null` when there
 * is no block — an arrow function with an expression body, say.
 */
function braceBody(lines: string[], startLine: number): string | null {
  let depth = 0;
  let quote: string | null = null;
  let opened = false;
  const out: string[] = [];

  for (let i = startLine; i < lines.length; i += 1) {
    const line = lines[i];
    let kept = "";
    for (let k = 0; k < line.length; k += 1) {
      const ch = line[k];
      if (quote) {
        kept += ch;
        if (ch === "\\") {
          kept += line[k + 1] ?? "";
          k += 1;
        } else if (ch === quote) quote = null;
        continue;
      }
      if (ch === "/" && line[k + 1] === "/") break;
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        kept += ch;
        continue;
      }
      if (ch === "{") {
        depth += 1;
        if (!opened) {
          opened = true;
          continue;
        }
      } else if (ch === "}") {
        depth -= 1;
        if (opened && depth === 0) {
          out.push(kept);
          return out.join("\n");
        }
      }
      if (opened) kept += ch;
    }
    if (opened) out.push(kept);
    // A header whose block never opens on its own line is not a function body.
    if (!opened && i > startLine) return null;
  }
  return null;
}

const PY_DEF_RE = /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/;
const JS_DEF_RE =
  /^\s*(?:export\s+)?(?:(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>))/;

/**
 * Names of the functions that call themselves — the one signal for recursion
 * that does not depend on the author having typed "dfs" or "recurse".
 *
 * A Python `def` owns every following line indented past it; a JavaScript
 * function owns the brace-balanced block opened on its line. A call to the name
 * inside that body is what makes it recursive. A helper that is merely called
 * from elsewhere is not, so a loop that calls `helper(n)` stays a loop.
 */
export function selfCallingFunctions(code: string): string[] {
  const lines = code.split("\n");
  const out = new Set<string>();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const py = line.match(PY_DEF_RE);
    if (py) {
      const name = py[1];
      const head = indentOf(line);
      const body: string[] = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        if (!lines[j].trim()) continue;
        if (indentOf(lines[j]) <= head) break;
        body.push(lines[j]);
      }
      if (callsName(body.join("\n"), name)) out.add(name);
      continue;
    }

    const js = line.match(JS_DEF_RE);
    if (js) {
      const name = js[1] ?? js[2];
      const body = braceBody(lines, i);
      if (body !== null && callsName(body, name)) out.add(name);
    }
  }

  return [...out];
}

const HEAP_RE =
  /\bheapq\b|\bheappush\b|\bheappop\b|\bheapify\b|\bheappushpop\b|\bheapreplace\b|priorityqueue|\bnlargest\b|\bnsmallest\b/;

/** A trie: the author said so, or keeps per-node "end of word" flags. */
const TRIE_RE = /\btrie\b|trienode|\bis_?end\b|end_?of_?word|\bis_?word\b|\bendofword\b/;

/**
 * Weighted or structured graph work — the roadmap's "Advanced Graphs": shortest
 * paths, spanning trees, union-find, topological order.
 */
const ADVANCED_GRAPH_RE =
  /dijkstra|\bprim\b|kruskal|union.?find|\bunion\s*\(|\bparent\s*=\s*(?:list\s*\(|\[)|\brank\s*=\s*\[|topolog|\bindegree\b|in_?degree|bellman|floyd|\bdist\b[\s\S]*\bheap|\bheap[\s\S]*\bdist\b|\bmst\b|min_?cost/;

/** A list of `[start, end]` pairs is the whole picture of an interval problem. */
const INTERVALS_RE = /\bintervals?\b|\bmeetings?\b|non.?overlap|\bnew_?interval\b|\bmerged\b/;

const BIT_RE =
  /\bxor\b|\bbits?\b|\bbitwise\b|\bbitmask\b|\bmask\b|\bbin\s*\(|>>\s*1\b|<<\s*1\b|\s\^\s|\s&\s*1\b|\bpopcount|hamming|reverse_?bits|single_?number|counting_?bits|missing_?number\b|\bbit_?count/;

const GREEDY_RE =
  /\bgreedy\b|kadane|max_?reach|farthest|\bcan_?jump\b|\bjumps?\b|\bgas\b[\s\S]*\bcost\b|\btank\b|partition_?labels?|max_?sub_?array|\bcur_?sum\b|\bcur_?max\b|\bhand\b[\s\S]*\bgroup|\bstraights?\b|valid_?parenthesis_?string|\bmerge_?triplets?\b/;

const MATH_RE =
  /\brotate\b|\bspiral\b|\bhappy\b|plus_?one|multiply_?strings|\bpow\s*\(|\bmy_?pow\b|\bgcd\b|set_?zeroe?s|\bzeroe?s\b|\bdigits?\b|\/\/\s*10\b|%\s*10\b|\bdetect_?squares\b|\bmatrix\b/;

const STACK_RE = /\bstack\b|\bstk\b|monotonic/;

const DP_RE = /\bmemo\b|\bdp\s*\[|\bdp\[|tabulation|bottom.?up|lru_cache|@cache\b/;
/** `dp[i][j]`, `memo[(i, j)]`, or a table built row by row — a 2-D state. */
const DP_2D_RE = /\b(?:dp|memo|cache|table)\s*\[[^\]\n]+\]\s*\[|\b(?:dp|memo|cache|table)\s*\[\s*\(|\[\s*\[[^\n]*\]\s*(?:\*|for\b)[^\n]*\bfor\b/;

const TREE_RE = /\btreenode\b|\broot\.left\b|\broot\.right\b|\bnode\.left\b|\bnode\.right\b|\.left\b[\s\S]*\.right\b/;

/**
 * The lead technique, by the most specific signal present. Order matters and
 * the comments say why where it is not obvious. The names follow the NeetCode
 * roadmap, so a solution to any problem on it lands on its own topic.
 */
function leadTechnique(code: string, recursive: boolean): VisualizationTechnique {
  const c = code.toLowerCase();

  if (/\b(slow|fast)\b/.test(c) && /\.next|->next/.test(c)) return "linked_list_cycle";
  if (/\.next\s*=\s*prev|next\s*=\s*prev/.test(c)) return "linked_list";
  // A trie is a tree of characters with its own vocabulary; nothing else says
  // "end of word".
  if (TRIE_RE.test(c)) return "trie";
  // Dijkstra drains a heap and a topological sort drains a queue, so the
  // graph vocabulary has to be read before the container verbs are.
  if (ADVANCED_GRAPH_RE.test(c)) return "advanced_graph";
  // Draining a queue front-first is the signature of BFS, and it is far more
  // specific than merely indexing a grid, so it is settled first. Ordering
  // these the other way round labelled every grid BFS "Dynamic Programming"
  // and drew its steps into a DP table the author never built.
  //
  // The dequeue call is what to look for, not the deque's construction: a
  // `deque` also backs a DFS stack, and the old `deque.*append` never fired at
  // all, since `.` stops at a newline and the queue is filled lines after it is
  // created.
  if (/\bbfs\b|breadth.?first|\bpopleft\b|\.pop\s*\(\s*0\s*\)/.test(c)) return "bfs";
  if (/\b(queue|frontier)\b[\s\S]*\.shift\s*\(/.test(c)) return "bfs";
  // `grid[` is not evidence of DP -- BFS, DFS and flood fill index a grid just
  // as often. Only the tabulation vocabulary is. A table indexed twice is the
  // 2-D kind; everything else is a row.
  if (DP_RE.test(c)) return DP_2D_RE.test(c) ? "dp_grid" : "dp_1d";
  if (/\badjacency\b|\bneighbors?\b|\bedges?\b|\bgraph\b/.test(c)) return "graph";
  // Backtracking is a DFS, but it is the more precise name when the author
  // used it, so it is settled before the broader word.
  if (/\bbacktrack/.test(c)) return "backtrack";
  if (/\bdfs\b|depth.?first|recurse/.test(c)) return "dfs";
  if (/\bpath\.append|\bpath\.pop/.test(c)) return "backtrack";
  // A binary tree is the picture whatever the walk over it is called.
  if (TREE_RE.test(c)) return "tree";
  // A heap is the whole mechanism of the problems that use one, so it leads
  // whenever the author reached for heapq or a priority queue.
  if (HEAP_RE.test(c)) return "heap";
  if (INTERVALS_RE.test(c) && /\[\s*0\s*\]|\bstart\b|\bend\b|\bsort/.test(c)) return "intervals";
  if (BIT_RE.test(c)) return "bit_manipulation";
  if (STACK_RE.test(c) && /\.append\s*\(|\.push\s*\(|\.pop\s*\(/.test(c)) return "stack";
  if (GREEDY_RE.test(c)) return "greedy";
  if (/palindrome|ispalindrome/.test(c)) return "two_pointer";
  // A `mid` between the two ends is a binary search, not a two-pointer walk,
  // so it is settled before the general "while left < right" shape.
  if (/\bbinary.?search\b/.test(c)) return "binary_search";
  if (/\bmid\b/.test(c) && /\bwhile\b/.test(c) && /\b(left|right|lo|hi|low|high|l|r)\b/.test(c))
    return "binary_search";
  if (
    /\bwhile\b[\s\S]*\b(left|right|l|r)\b\s*[<>=]/.test(c) &&
    !/window_sum|for\s*\(\s*right|for\s+right\s+in/.test(c)
  )
    return "two_pointer";
  if (
    /for\s*\(\s*right|for\s+right\s+in|right\s*\+\+|right\s*\+=/.test(c) ||
    (/window|substring|subarray|window_sum|max_len|min_len/.test(c) && /\b(left|right)\b/.test(c))
  )
    return "sliding_window";
  if (/\bbinary.?search\b/.test(c)) return "binary_search";
  if (/\b(mid|lo|hi|low|high)\b/.test(c) && /\bwhile\b/.test(c) && /\b(left|right|lo|hi)\b/.test(c))
    return "binary_search";
  if (
    /\b(left|right|l|r|lo|hi|low|high)\b/.test(c) &&
    /\bwhile\b/.test(c) &&
    !/window|substring|subarray|window_sum/.test(c)
  )
    return "two_pointer";
  if (/\b(i|j)\b/.test(c) && /\bfor\b/.test(c) && /two\s*pointer|opposite|palindrome|sorted/.test(c))
    return "two_pointer";
  if (/\bset\s*\(|\bset\s*=\s*set\s*\(/.test(c) && /\bin\s+\w+/.test(c) && /\.append/.test(c)) return "hash_set";
  if (/findduplicate|duplicate/.test(c) && /\bset\b/.test(c)) return "hash_set";
  if (/\b(seen|hash|map|dict|set)\b/.test(c) && /complement|target/.test(c)) return "hash_map";
  if (/\.next|listnode|->next/.test(c)) return "linked_list";
  if (/\.left\b|\.right\b/.test(c)) return "tree";
  // Matrix arithmetic with none of the vocabulary above is the roadmap's
  // "Math & Geometry" — rotating, spiralling, zeroing a matrix, digit sums.
  if (MATH_RE.test(c)) return "math_geometry";
  // A function calling itself is recursion whatever it was named. Checked after
  // every keyword above so a memoised or graph-walking recursion keeps the
  // more specific label and gets this one as a supporting layer.
  if (recursive) return "recursion";
  if (/\bfor\b|\bwhile\b/.test(c)) return "array_scan";

  return "generic";
}

/**
 * Techniques that describe the same construct, so only one of each family is
 * ever listed: two pointers, a window and a binary search are all a pair of
 * indices on one array, backtracking is a DFS is a recursion, and a 1-D and a
 * 2-D table are both "dynamic programming".
 */
type Family = "pointer" | "recursion" | "list" | "dp" | "graph";
const FAMILY: Partial<Record<VisualizationTechnique, Family>> = {
  two_pointer: "pointer",
  sliding_window: "pointer",
  binary_search: "pointer",
  dfs: "recursion",
  backtrack: "recursion",
  recursion: "recursion",
  linked_list: "list",
  linked_list_cycle: "list",
  dp_1d: "dp",
  dp_grid: "dp",
  graph: "graph",
  advanced_graph: "graph",
};

/**
 * Strong, specific signals for a technique used *alongside* the lead one. These
 * are deliberately narrower than the lead chain: a supporting label is a chip
 * beside the picture, and a chip that fires on a loose match is noise.
 */
const SUPPORTING: Array<[VisualizationTechnique, (c: string, recursive: boolean) => boolean]> = [
  ["backtrack", (c) => /\bbacktrack/.test(c)],
  ["trie", (c) => TRIE_RE.test(c)],
  ["advanced_graph", (c) => ADVANCED_GRAPH_RE.test(c)],
  ["heap", (c) => HEAP_RE.test(c)],
  ["dfs", (c) => /\bdfs\b|depth.?first/.test(c)],
  ["recursion", (_c, recursive) => recursive],
  ["bfs", (c) => /\bbfs\b|breadth.?first|\bpopleft\b|\.shift\s*\(/.test(c)],
  ["dp_grid", (c) => DP_RE.test(c) && DP_2D_RE.test(c)],
  ["dp_1d", (c) => DP_RE.test(c)],
  ["graph", (c) => /\badjacency\b|\bneighbou?rs?\b|\bedges?\b|\bgraph\b|\badj\b/.test(c)],
  ["tree", (c) => /\btreenode\b|\broot\.left\b|\bnode\.left\b/.test(c)],
  ["stack", (c) => STACK_RE.test(c)],
  ["intervals", (c) => /\bintervals\b/.test(c)],
  ["bit_manipulation", (c) => /\bxor\b|\bbitmask\b|\s\^\s|>>\s*1\b|\bbit_?count|\bbin\s*\(/.test(c)],
  ["greedy", (c) => /\bgreedy\b|kadane/.test(c)],
  ["hash_map", (c) => /defaultdict|\bcounter\(|new map\(|(?<![.\w])dict\(|=\s*\{\s*\}/.test(c)],
  ["hash_set", (c) => /(?<![.\w])set\(|new set\(|\.add\s*\(/.test(c)],
  ["linked_list", (c) => /\.next\b|->next|listnode/.test(c)],
  ["binary_search", (c) => /\bbinary.?search\b|\bbisect|\bmid\b[\s\S]*\b(lo|hi|left|right)\b[\s\S]*\bwhile\b/.test(c)],
  ["sliding_window", (c) => /\bwindow\b|window_sum|window_size/.test(c)],
  ["math_geometry", (c) => /\brotate\b|\bspiral\b|\bgcd\b/.test(c)],
];

/**
 * Every technique the code combines, lead first.
 *
 * The lead comes from the specific-first chain above. Supporting techniques
 * come from the strong signals only, skipping any family the list already
 * holds. When the chain could only say "a loop" but a strong signal fires,
 * that signal takes the lead — a scan that keeps a set *is* a hash-set scan.
 */
export function inferTechniquesFromCode(code: string): VisualizationTechnique[] {
  const c = code.toLowerCase();
  const recursive = selfCallingFunctions(code).length > 0;
  const lead = leadTechnique(code, recursive);

  const out: VisualizationTechnique[] = lead === "generic" || lead === "array_scan" ? [] : [lead];
  const families = new Set<Family>();
  for (const t of out) {
    const fam = FAMILY[t];
    if (fam) families.add(fam);
  }

  for (const [technique, test] of SUPPORTING) {
    if (out.includes(technique)) continue;
    const fam = FAMILY[technique];
    if (fam && families.has(fam)) continue;
    if (!test(c, recursive)) continue;
    out.push(technique);
    if (fam) families.add(fam);
  }

  if (out.length === 0) out.push(lead);
  return out;
}

/** The lead technique alone — the picture that should sit on top. */
export function inferTechniqueFromCode(code: string): VisualizationTechnique {
  return inferTechniquesFromCode(code)[0];
}
