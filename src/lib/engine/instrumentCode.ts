/**
 * Why a step was recorded. Narration reads this to describe the line in the
 * author's own terms instead of falling back to canned pattern prose.
 */
export type TraceKind = "mutation" | "return" | "loop" | "condition";

export interface InstrumentResult {
  code: string;
  tracePoints: number[];
  variableNames: string[];
  /** Kinds recorded at each traced line, in injection order. */
  traceKinds: Array<{ line: number; kind: TraceKind }>;
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

/**
 * `arr[i] = v`, `grid[r][c] += 1`, `seen[nums[i]] = i` — the *container* is
 * what changed. Matched by hand rather than regex so a nested subscript in the
 * index (`seen[nums[i]]`, the shape of every hash-map solution) still counts.
 */
function matchIndexAssign(trimmed: string): string | null {
  const head = trimmed.match(/^\s*([\w$]+)\s*\[/);
  if (!head) return null;
  let i = head[0].length - 1;
  // Walk every consecutive `[...]` group, tolerating nesting inside each.
  while (trimmed[i] === "[") {
    let depth = 0;
    let j = i;
    for (; j < trimmed.length; j += 1) {
      if (trimmed[j] === "[") depth += 1;
      else if (trimmed[j] === "]") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) return null;
    i = j + 1;
    while (trimmed[i] === " " || trimmed[i] === "\t") i += 1;
  }
  const rest = trimmed.slice(i);
  return /^(?:\*\*|<<|>>>|>>|[+\-*/%&|^])?=(?!=)/.test(rest) ? head[1] : null;
}

/** `i++`, `--count` */
const INCDEC_RE = /^\s*(?:\+\+|--)?([\w$]+)(?:\+\+|--)\s*;?\s*$/;

/** `res.push(x)`, `seen.set(k, v)` — mutating method calls change state too. */
const METHOD_MUTATE_RE =
  /^\s*([\w$]+)\s*\.\s*(?:push|pop|shift|unshift|splice|set|add|delete|clear|sort|reverse|fill|copyWithin)\s*\(/;

/** `for (const x of xs)` / `for (const k in obj)` — bounded, no condition clause. */
const FOR_ITER_RE = /^\s*for\s*\(\s*(?:const|let|var)\s+[^;)]+\s+(?:of|in)\s+/;

/** `return <expr>;` split into keyword, expression, and trailing punctuation. */
const RETURN_EXPR_RE = /^(\s*return\s+)(.+?)(;\s*)$/;

/** Brackets balance outside of string literals — safe to wrap as one expression. */
function isBalanced(src: string): boolean {
  const stack: string[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let quote: string | null = null;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if ("([{".includes(ch)) stack.push(ch);
    else if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0 && quote === null;
}

/**
 * `return expr;` -> `return __ret__(expr);` so the trace records what the code
 * actually produced. The preceding `__trace__` fires before the expression is
 * evaluated, so without this the final frame can only echo the source text.
 *
 * Left alone unless the expression is complete on this line: a `return {` that
 * opens a multi-line object would otherwise be wrapped into a syntax error.
 */
export function wrapReturnValue(line: string): string {
  const m = line.match(RETURN_EXPR_RE);
  if (!m || !isBalanced(m[2])) return line;
  return `${m[1]}__ret__(${m[2]})${m[3]}`;
}

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
 * A condition whose value is fixed in the source (`while (true)`) tells no
 * story: "check true -> true" on every iteration is noise, and recording it
 * would let the step budget pre-empt the loop budget that exists to stop
 * exactly these loops.
 */
const TRIVIAL_COND_RE = /^(?:true|false|-?\d+(?:\.\d+)?)$/;

/** Where to record a condition evaluation, and what to snapshot when it fires. */
export interface CondTraceContext {
  lineNum: number;
  snapshotExpr: string;
}

/**
 * `__cond__(line, vars, value, label, kind)` records the evaluation and returns
 * `value`, so wrapping a condition never changes control flow.
 */
function traceCond(cond: string, kind: TraceKind, ctx: CondTraceContext): string {
  return (
    `__cond__(${ctx.lineNum}, ${ctx.snapshotExpr}, (${cond}), ` +
    `${JSON.stringify(cond)}, ${JSON.stringify(kind)})`
  );
}

/** The guarded — and, when it carries information, traced — loop condition. */
function guardExpr(cond: string, ctx?: CondTraceContext): string {
  if (!cond) return "__guard__() ";
  if (!ctx || TRIVIAL_COND_RE.test(cond)) return `__guard__() && (${cond})`;
  return `__guard__() && ${traceCond(cond, "loop", ctx)}`;
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
 *
 * With `ctx`, the condition is additionally wrapped in `__cond__` so every
 * iteration is recorded — that per-iteration step is what makes a loop-driven
 * algorithm legible without a canned template.
 */
export function injectLoopGuards(line: string, ctx?: CondTraceContext): string {
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
      rewritten = guardExpr(inner.trim(), ctx);
    } else {
      const parts = splitTopLevel(inner);
      if (parts.length !== 3) {
        // for...of / for...in — nothing to guard.
        out += rest.slice(0, closeIdx + 1);
        rest = rest.slice(closeIdx + 1);
        continue;
      }
      parts[1] = ` ${guardExpr(parts[1].trim(), ctx)}`;
      rewritten = parts.join(";");
    }

    out += head + rewritten + ")";
    rest = rest.slice(closeIdx + 1);
  }
}

/** `if (cond)` / `} else if (cond)` at the head of a line. */
const IF_HEAD_RE = /^(\s*(?:\}\s*)?(?:else\s+)?if\s*)\(/;

/**
 * Wrap an `if` / `else if` condition in `__cond__` so the branch decision
 * itself becomes a step: the author sees *why* execution went the way it did,
 * which is the part a mutation-only trace can never show.
 */
export function injectConditionTrace(line: string, ctx: CondTraceContext): string {
  const head = line.match(IF_HEAD_RE);
  if (!head) return line;

  const openIdx = head[0].length - 1;
  const closeIdx = findMatchingParen(line, openIdx);
  if (closeIdx === -1) return line;

  const cond = line.slice(openIdx + 1, closeIdx).trim();
  if (!cond || TRIVIAL_COND_RE.test(cond)) return line;

  return (
    line.slice(0, openIdx + 1) +
    traceCond(cond, "condition", ctx) +
    line.slice(closeIdx)
  );
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
  const indexed = matchIndexAssign(trimmed);
  if (indexed && isIdentifier(indexed)) return indexed;
  for (const re of [DECL_RE, INCDEC_RE, METHOD_MUTATE_RE, ASSIGN_RE]) {
    const m = trimmed.match(re);
    if (m?.[1] && isIdentifier(m[1])) return m[1];
  }
  return null;
}

/**
 * `if (cond) return expr;` on one line, split at the condition's closing
 * paren. A first draft is full of these — the early exit is the answer — and
 * leaving the return untraced meant the run ended without ever saying what it
 * returned.
 */
function splitInlineReturn(line: string): { head: string; expr: string } | null {
  const ifHead = line.match(IF_HEAD_RE);
  if (!ifHead) return null;
  const openIdx = ifHead[0].length - 1;
  const closeIdx = findMatchingParen(line, openIdx);
  if (closeIdx === -1) return null;
  const tail = line.slice(closeIdx + 1);
  const ret = tail.match(/^\s*return\b\s*(.*?)\s*;?\s*$/);
  if (!ret || !isBalanced(ret[1])) return null;
  return { head: line.slice(0, closeIdx + 1), expr: ret[1] };
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
 * `function name(a, b) {` / `const name = (a, b) => {` / `var name = function (a) {`
 * — a named function whose body opens at the end of its own line.
 */
const FN_HEADER_RE =
  /^\s*(?:export\s+)?(?:(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(([^)]*)\)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\s*\*?\s*\(([^)]*)\)|\(([^)]*)\)\s*=>|([A-Za-z_$][\w$]*)\s*=>))\s*\{\s*(?:\/\/.*)?$/;

export interface FunctionSpan {
  name: string;
  /** Parameter names, in order; destructured parameters are left out. */
  params: string[];
  /** Line index of the header. */
  open: number;
  /** Line index of the `}` that closes the body. */
  close: number;
}

function paramNames(raw: string): string[] {
  return raw
    .split(",")
    .map((p) => p.trim().split(/[=:]/)[0].replace(/^\.\.\./, "").trim())
    .filter((p) => /^[A-Za-z_$][\w$]*$/.test(p));
}

/**
 * Line index of the `}` closing the block opened on `start`, or -1. Skips
 * string literals and `//` comments so a brace in a string is not counted.
 */
function findBlockEnd(lines: string[], start: number): number {
  let depth = 0;
  let quote: string | null = null;
  let opened = false;

  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    for (let k = 0; k < line.length; k += 1) {
      const ch = line[k];
      if (quote) {
        if (ch === "\\") k += 1;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === "/" && line[k + 1] === "/") break;
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        continue;
      }
      if (ch === "{") {
        depth += 1;
        opened = true;
      } else if (ch === "}") {
        depth -= 1;
        if (opened && depth === 0) return i;
      }
    }
  }
  return -1;
}

/**
 * Every named function whose body can be wrapped: the header opens its block
 * at the end of its own line and the block closes on a line of its own. A
 * one-line `function f(x) { return x; }` is left alone rather than risked.
 */
export function findFunctionSpans(lines: string[]): FunctionSpan[] {
  const out: FunctionSpan[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(FN_HEADER_RE);
    if (!m) continue;
    const name = m[1] ?? m[3];
    const raw = m[2] ?? m[4] ?? m[5] ?? m[6] ?? "";
    const close = findBlockEnd(lines, i);
    if (close <= i || !/^\s*\}/.test(lines[close])) continue;
    out.push({ name, params: paramNames(raw), open: i, close });
  }
  return out;
}

/** `__enter__("fib", { "n": n }); try {` — opens the call, and the block the exit closes. */
function enterStmt(span: FunctionSpan): string {
  const args = span.params.map((p) => `${JSON.stringify(p)}: ${p}`).join(", ");
  return `__enter__(${JSON.stringify(span.name)}, { ${args} }); try {`;
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
  const traceKinds: Array<{ line: number; kind: TraceKind }> = [];
  const output: string[] = [];

  const traceStmt = (lineNum: number, indent: string, kind: TraceKind) =>
    `${indent}__trace__(${lineNum}, ${snapshotExpr}, ${JSON.stringify(kind)});`;

  const record = (lineNum: number, kind: TraceKind) => {
    tracePoints.push(lineNum);
    traceKinds.push({ line: lineNum, kind });
  };

  // Call boundaries: every named function body is wrapped so the sandbox can
  // tell which call each step ran in — what lets a recursion be drawn as the
  // tree of calls it made. The `try` opens after the header and the
  // `finally` closes before the body's own `}`, so a return, a fall-off and
  // a throw all leave the call.
  const spans = findFunctionSpans(lines);
  const opensAfter = new Map<number, FunctionSpan[]>();
  const closesBefore = new Map<number, number>();
  for (const span of spans) {
    opensAfter.set(span.open, [...(opensAfter.get(span.open) ?? []), span]);
    closesBefore.set(span.close, (closesBefore.get(span.close) ?? 0) + 1);
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNum = i + 1;
    const trimmed = rawLine.trim();
    const indent = getIndent(rawLine);

    for (let n = closesBefore.get(i) ?? 0; n > 0; n -= 1) {
      output.push(`${indent}} finally { __exit__(); }`);
    }
    for (const span of opensAfter.get(i - 1) ?? []) {
      output.push(`${indent}${enterStmt(span)}`);
    }

    if (shouldSkipLine(trimmed)) {
      output.push(rawLine);
      continue;
    }

    const ctx: CondTraceContext = { lineNum, snapshotExpr };
    let line = injectLoopGuards(rawLine, ctx);
    if (line.includes(`__cond__(${lineNum},`)) record(lineNum, "loop");

    // `if (cond) return x;` — the decision and the exit share a line. Trace
    // both: the condition as itself, then the return inside a block of its own.
    const inline = splitInlineReturn(line);
    if (inline) {
      const head = injectConditionTrace(inline.head, ctx);
      if (head !== inline.head) record(lineNum, "condition");
      const ret = inline.expr ? `return __ret__(${inline.expr});` : "return;";
      output.push(`${head} { ${traceStmt(lineNum, "", "return")} ${ret} }`);
      record(lineNum, "return");
      continue;
    }

    const beforeIf = line;
    line = injectConditionTrace(line, ctx);
    if (line !== beforeIf) record(lineNum, "condition");

    // for...of / for...in have no condition clause to hook, so the iteration
    // step goes at the top of the body instead.
    if (FOR_ITER_RE.test(trimmed) && trimmed.endsWith("{")) {
      output.push(line, traceStmt(lineNum, `${indent}  `, "loop"));
      record(lineNum, "loop");
      continue;
    }

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

    const kind: TraceKind = isReturn ? "return" : "mutation";
    const body = isReturn
      ? [traceStmt(lineNum, indent, kind), wrapReturnValue(line)]
      : [line, traceStmt(lineNum, indent, kind)];

    if (needsBlock) {
      output.push(`${indent}{`, ...body, `${indent}}`);
    } else {
      output.push(...body);
    }
    record(lineNum, kind);
  }

  return {
    code: output.join("\n"),
    tracePoints,
    variableNames: varNames,
    traceKinds,
  };
}
