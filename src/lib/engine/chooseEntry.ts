/**
 * Which of several functions is the one to call.
 *
 * People write the helper first as often as last — `dfs` above `numIslands` —
 * so "the first def" called the helper with no arguments and the run failed
 * before it started. The entry is the function nothing else calls: an explicit
 * Example comment names it outright, otherwise it is the first function that
 * appears nowhere in the code as a call.
 */
export function chooseEntry(names: string[], code: string, example?: string): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];

  if (example) {
    const named = names.find((n) => new RegExp(`\\b${escape(n)}\\s*\\(`).test(example));
    if (named) return named;
  }

  // Strip each definition line so a def does not count as a call of itself,
  // and comments so a mention in prose does not count as a call either.
  const withoutDefs = code
    .replace(/^\s*(?:async\s+)?(?:def|function)\s+[A-Za-z_]\w*\s*\(.*$/gm, "")
    .replace(/^\s*(?:const|let|var)\s+[A-Za-z_]\w*\s*=.*$/gm, "")
    .replace(/^\s*(?:#|\/\/).*$/gm, "");
  const roots = names.filter((n) => !new RegExp(`\\b${escape(n)}\\s*\\(`).test(withoutDefs));
  return roots[0] ?? names[0];
}

function escape(name: string): string {
  return name.replace(/[$]/g, "\\$");
}
