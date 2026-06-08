import type { VisualizationTechnique } from "./types";

export function inferTechniqueFromCode(code: string): VisualizationTechnique {
  const c = code.toLowerCase();

  if (/\b(slow|fast)\b/.test(c) && /\.next|->next/.test(c)) return "linked_list_cycle";
  if (/\.next\s*=\s*prev|next\s*=\s*prev/.test(c)) return "linked_list";
  if (/\bmemo\b|\bdp\s*\[|\bdp\[|grid\[|tabulation|bottom.?up/.test(c)) return "dp_grid";
  if (/\bbfs\b|breadth.?first|deque.*append|queue.*popleft/.test(c)) return "bfs";
  if (/\badjacency\b|\bneighbors?\b|\bedges?\b|\bgraph\b/.test(c)) return "graph";
  if (/\bdfs\b|depth.?first|backtrack|recurse/.test(c)) return "dfs";
  if (/\bbacktrack\b|\bpath\.append|\bpath\.pop/.test(c)) return "backtrack";
  if (/palindrome|ispalindrome/.test(c)) return "two_pointer";
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
  if (/\btreenode\b|\.left|\.right/.test(c)) return "dfs";
  if (/\bfor\b|\bwhile\b/.test(c)) return "array_scan";

  return "generic";
}
