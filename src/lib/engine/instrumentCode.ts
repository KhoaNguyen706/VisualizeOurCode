const TRACKED_NAMES = new Set([
  "i", "j", "k", "left", "right", "mid", "lo", "hi",
  "sum", "total", "remain", "target", "count", "max", "min",
  "res", "ans", "result", "path", "subset", "seen", "map",
  "nums", "arr", "candidates", "complement", "head", "prev", "current", "next",
  "depth", "start", "end", "n", "m",
]);

const RETURN_RE = /^\s*return\b/;
const ASSIGN_RE = /^\s*(?:const|let|var)?\s*(\w+)\s*=/;
export interface InstrumentResult {
  code: string;
  tracePoints: number[];
  variableNames: string[];
}

function getIndent(line: string): string {
  const m = line.match(/^(\s*)/);
  return m ? m[1] : "";
}

function extractVariableNames(source: string): string[] {
  const names = new Set<string>();

  const fnParams = source.match(
    /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?(?:function|\())\s*\(([^)]*)\)/
  );
  if (fnParams?.[1]) {
    fnParams[1].split(",").forEach((p) => {
      const name = p.trim().split(/[=:]/)[0].replace(/\.\.\./, "").trim();
      if (name && /^\w+$/.test(name)) names.add(name);
    });
  }

  const arrowParams = source.match(/\(([^)]*)\)\s*=>/);
  if (arrowParams?.[1]) {
    arrowParams[1].split(",").forEach((p) => {
      const name = p.trim().split(/[=:]/)[0].trim();
      if (name && /^\w+$/.test(name)) names.add(name);
    });
  }

  for (const line of source.split("\n")) {
    const assign = line.match(ASSIGN_RE);
    if (assign?.[1] && TRACKED_NAMES.has(assign[1])) names.add(assign[1]);
  }

  for (const name of TRACKED_NAMES) {
    if (new RegExp(`\\b${name}\\b`).test(source)) names.add(name);
  }

  return [...names];
}

function safeRead(varName: string, expr: string): string {
  return `${varName}: (() => { try { return ${expr}; } catch { return undefined; } })()`;
}

function buildSnapshotExpr(varNames: string[]): string {
  if (varNames.length === 0) return "{}";
  const entries = varNames.map((n) => {
    if (n === "seen" || n === "map") {
      return safeRead(n, `${n} != null ? { ...${n} } : {}`);
    }
    if (["nums", "arr", "candidates", "path", "subset", "res", "result"].includes(n)) {
      return safeRead(n, `Array.isArray(${n}) ? [...${n}] : ${n}`);
    }
    return safeRead(n, n);
  });
  return `{ ${entries.join(", ")} }`;
}

function shouldSkipLine(trimmed: string): boolean {
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return true;
  if (trimmed.startsWith("import ") || trimmed.startsWith("export ")) return true;
  if (trimmed.startsWith("__trace__")) return true;
  return false;
}

/**
 * Inject __trace__(lineNumber, variableSnapshot) after tracked assignments
 * and before return statements.
 */
export function instrumentCode(rawCode: string): InstrumentResult {
  const lines = rawCode.split("\n");
  const varNames = extractVariableNames(rawCode);
  const snapshotExpr = buildSnapshotExpr(varNames);
  const tracePoints: number[] = [];
  const output: string[] = [];

  const pushTrace = (lineNum: number, indent: string) => {
    output.push(`${indent}__trace__(${lineNum}, ${snapshotExpr});`);
    tracePoints.push(lineNum);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();
    const indent = getIndent(line);

    if (shouldSkipLine(trimmed)) {
      output.push(line);
      continue;
    }

    // Before return
    if (RETURN_RE.test(line)) {
      pushTrace(lineNum, indent);
      output.push(line);
      continue;
    }

    // After tracked variable assignment
    const assignMatch = trimmed.match(ASSIGN_RE);
    if (assignMatch?.[1] && TRACKED_NAMES.has(assignMatch[1])) {
      output.push(line);
      pushTrace(lineNum, indent);
      continue;
    }

    output.push(line);
  }

  return {
    code: output.join("\n"),
    tracePoints,
    variableNames: varNames,
  };
}
