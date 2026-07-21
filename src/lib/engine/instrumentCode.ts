export interface InstrumentResult {
  code: string;
  tracePoints: number[];
  variableNames: string[];
}

/**
 * Snapshotting every binding on every step gets expensive fast, and a panel
 * with 40 rows is unreadable anyway. Keep the first N in source order.
 */
const MAX_TRACKED_VARS = 24;

const RETURN_RE = /^\s*return\b/;

/** `const x =`, `let y =` — the declaration itself is a mutation point. */
const DECL_RE = /^\s*(?:const|let|var)\s+([\w$]+)\s*=(?!=)/;

/** `x =`, `x +=`, `x **=`, `x ??=` — but never `x ==` / `x ===`. */
const ASSIGN_RE = /^\s*([\w$]+)\s*(?:\*\*|<<|>>>|>>|[+\-*/%&|^]|\|\||&&|\?\?)?=(?!=)/;

/** `arr[i] = v`, `grid[r][c] += 1` — the *container* is what changed. */
const INDEX_ASSIGN_RE = /^\s*([\w$]+)\s*\[[^\]]*\](?:\s*\[[^\]]*\])*\s*(?:\*\*|<<|>>>|>>|[+\-*/%&|^])?=(?!=)/;

/** `i++`, `--count` */
const INCDEC_RE = /^\s*(?:\+\+|--)?([\w$]+)(?:\+\+|--)\s*;?\s*$/;

/** `res.push(x)`, `seen.set(k, v)` — mutating method calls change state too. */
const METHOD_MUTATE_RE =
  /^\s*([\w$]+)\s*\.\s*(?:push|pop|shift|unshift|splice|set|add|delete|clear|sort|reverse|fill|copyWithin)\s*\(/;

/** A control-flow header with no `{` owns exactly the next statement. */
const BRACELESS_HEADER_RE = /^\s*(?:if|else\s+if|for|while)\s*\(.*\)\s*$/;
const BRACELESS_ELSE_RE = /^\s*else\s*$/;

const RESERVED = new Set([
  "if", "else", "for", "while", "do", "switch", "case", "default", "break",
  "continue", "return", "function", "const", "let", "var", "new", "delete",
  "typeof", "instanceof", "in", "of", "this", "null", "undefined", "true",
  "false", "class", "extends", "super", "import", "export", "from", "as",
  "try", "catch", "finally", "throw", "async", "await", "yield", "void",
  "Math", "JSON", "console", "Object", "Array", "String", "Number", "Boolean",
  "Map", "Set", "Infinity", "NaN", "length",
]);

function getIndent(line: string): string {
  const m = line.match(/^(\s*)/);
  return m ? m[1] : "";
}

function isIdentifier(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name) && !RESERVED.has(name);
}

/**
 * Index of the `)` closing the `(` at `openIdx`, skipping over nested parens
 * and string literals. Returns -1 when unbalanced.
 */
function findMatchingParen(src: string, openIdx: number): number {
  let depth = 0;
  let quote: string | null = null;

  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];

    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split on `;` that sit at nesting depth zero. */
function splitTopLevel(src: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (quote) {
      current += ch;
      if (ch === "\\" && i + 1 < src.length) {
        current += src[++i];
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
    } else if (ch === ";" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

/**
 * Locate the next `while`/`for` keyword that is real code — not text inside a
 * string literal and not part of a trailing `//` comment — and that is
 * actually followed by its condition parenthesis.
 */
function findLoopKeyword(src: string): { index: number; openIdx: number; keyword: string } | null {
  let quote: string | null = null;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "/" && src[i + 1] === "/") return null;

    for (const keyword of ["while", "for"]) {
      if (!src.startsWith(keyword, i)) continue;
      if (i > 0 && /[\w$]/.test(src[i - 1])) continue;

      let j = i + keyword.length;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] !== "(") continue;

      return { index: i, openIdx: j, keyword };
    }
  }
  return null;
}

/**
 * Rewrite loop conditions to call `__guard__()` first:
 *
 *   while (cond)          -> while (__guard__() && (cond))
 *   for (init; cond; upd) -> for (init; __guard__() && (cond); upd)
 *   for (;;)              -> for (; __guard__() ;)
 *
 * Putting the guard in the *condition* rather than the body means it also
 * covers brace-less loops, and `do {...} while (cond)` is picked up by the
 * same `while` rewrite. `for...of` / `for...in` are skipped: they are bounded
 * by their iterable and have no condition clause to hook.
 */
export function injectLoopGuards(line: string): string {
  let out = "";
  let rest = line;

  for (;;) {
    const found = findLoopKeyword(rest);
    if (!found) {
      out += rest;
      return out;
    }

    const { openIdx } = found;
    const closeIdx = findMatchingParen(rest, openIdx);
    if (closeIdx === -1) {
      out += rest;
      return out;
    }

    const head = rest.slice(0, openIdx + 1);
    const inner = rest.slice(openIdx + 1, closeIdx);

    let rewritten: string;
    if (found.keyword === "while") {
      rewritten = `__guard__() && (${inner})`;
    } else {
      const parts = splitTopLevel(inner);
      if (parts.length !== 3) {
        // for...of / for...in — nothing to guard.
        out += rest.slice(0, closeIdx + 1);
        rest = rest.slice(closeIdx + 1);
        continue;
      }
      const cond = parts[1].trim();
      parts[1] = cond ? ` __guard__() && (${cond})` : " __guard__() ";
      rewritten = parts.join(";");
    }

    out += head + rewritten + ")";
    rest = rest.slice(closeIdx + 1);
  }
}

function addParams(raw: string, names: Set<string>): void {
  for (const part of raw.split(",")) {
    const name = part.trim().split(/[=:]/)[0].replace(/\.\.\./, "").trim();
    if (isIdentifier(name)) names.add(name);
  }
}

/**
 * Collect the bindings actually declared by the source: function parameters,
 * `const`/`let`/`var` declarations, destructured names, and `for...of` heads.
 *
 * Earlier revisions matched against a fixed allowlist of ~35 common names
 * (`i`, `left`, `sum`, ...), which silently ignored anything the author named
 * differently. Discovery keeps that working while covering arbitrary code.
 */
export function collectDeclaredNames(source: string): string[] {
  const names = new Set<string>();
  const patterns: Array<[RegExp, "params" | "name"]> = [
    [/function\s*\w*\s*\(([^)]*)\)/g, "params"],
    [/(?:const|let|var)\s+[\w$]+\s*=\s*(?:async\s*)?function\s*\(([^)]*)\)/g, "params"],
    [/\(([^)]*)\)\s*=>/g, "params"],
    [/(?:const|let|var)\s+([\w$]+)/g, "name"],
    [/for\s*\(\s*(?:const|let|var)\s+([\w$]+)\s+(?:of|in)\b/g, "name"],
    [/(?:const|let|var)\s*\[([^\]]+)\]\s*=/g, "params"],
    [/(?:const|let|var)\s*\{([^}]+)\}\s*=/g, "params"],
  ];

  for (const [re, kind] of patterns) {
    for (const m of source.matchAll(re)) {
      if (!m[1]) continue;
      if (kind === "params") addParams(m[1], names);
      else if (isIdentifier(m[1])) names.add(m[1]);
    }
  }

  // Declared function names are callable, not state worth watching.
  for (const m of source.matchAll(/function\s+([\w$]+)/g)) {
    if (m[1]) names.delete(m[1]);
  }
  for (const m of source.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>)/g)) {
    if (m[1]) names.delete(m[1]);
  }

  // Order by first appearance so the variable panel reads like the source.
  return [...names]
    .map((name) => ({ name, at: source.search(new RegExp(`\\b${name}\\b`)) }))
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_TRACKED_VARS)
    .map((entry) => entry.name);
}

function buildSnapshotExpr(varNames: string[]): string {
  if (varNames.length === 0) return "{}";
  // The IIFE swallows temporal-dead-zone errors for names not yet initialised
  // at this point in the run. Deep-copying happens in runSandbox.
  const entries = varNames.map(
    (n) => `${JSON.stringify(n)}: (() => { try { return ${n}; } catch { return undefined; } })()`
  );
  return `{ ${entries.join(", ")} }`;
}

function shouldSkipLine(trimmed: string): boolean {
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return true;
  if (trimmed.startsWith("import ") || trimmed.startsWith("export ")) return true;
  if (trimmed.startsWith("__trace__")) return true;
  return false;
}

/** The variable a line mutates, or null when the line changes no tracked state. */
function mutatedVariable(trimmed: string): string | null {
  for (const re of [DECL_RE, INDEX_ASSIGN_RE, INCDEC_RE, METHOD_MUTATE_RE, ASSIGN_RE]) {
    const m = trimmed.match(re);
    if (m?.[1] && isIdentifier(m[1])) return m[1];
  }
  return null;
}

/** Last preceding line that is neither blank nor a comment. */
function previousCodeLine(lines: string[], index: number): string | null {
  for (let i = index - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }
    return trimmed;
  }
  return null;
}

/**
 * Inject `__trace__(line, snapshot)` around state changes and `__guard__()`
 * into loop conditions.
 *
 * Known limits (regex-based, not an AST walk): a statement spread over
 * multiple lines is only seen at its first line, and a brace-less header with
 * its body on the *same* line (`if (x) return -1;`) is not traced.
 */
export function instrumentCode(rawCode: string): InstrumentResult {
  const lines = rawCode.split("\n");
  const varNames = collectDeclaredNames(rawCode);
  const snapshotExpr = buildSnapshotExpr(varNames);
  const tracePoints: number[] = [];
  const output: string[] = [];

  const traceStmt = (lineNum: number, indent: string) =>
    `${indent}__trace__(${lineNum}, ${snapshotExpr});`;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNum = i + 1;
    const trimmed = rawLine.trim();
    const indent = getIndent(rawLine);

    if (shouldSkipLine(trimmed)) {
      output.push(rawLine);
      continue;
    }

    const line = injectLoopGuards(rawLine);
    const isReturn = RETURN_RE.test(rawLine);
    const mutated = isReturn ? null : mutatedVariable(trimmed);

    if (!isReturn && !mutated) {
      output.push(line);
      continue;
    }

    // A brace-less header owns only the next statement, so appending a trace
    // after it would land outside the branch. Wrap both in a block instead.
    const prev = previousCodeLine(lines, i);
    const needsBlock =
      !!prev &&
      !prev.endsWith("{") &&
      (BRACELESS_HEADER_RE.test(prev) || BRACELESS_ELSE_RE.test(prev));

    const body = isReturn
      ? [traceStmt(lineNum, indent), line]
      : [line, traceStmt(lineNum, indent)];

    if (needsBlock) {
      output.push(`${indent}{`, ...body, `${indent}}`);
    } else {
      output.push(...body);
    }
    tracePoints.push(lineNum);
  }

  return {
    code: output.join("\n"),
    tracePoints,
    variableNames: varNames,
  };
}
