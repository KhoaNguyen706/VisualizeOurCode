/** Best-effort JSON extraction for Gemini AI plan responses. Never throws. */

function normalizeRaw(text: string): string {
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/im, "");
  s = s.replace(/[\u201c\u201d\u2018\u2019]/g, '"');
  const start = s.indexOf("{");
  return start >= 0 ? s.slice(start) : s;
}

function closeBrackets(s: string): string {
  let out = s.replace(/,(\s*[}\]])/g, "$1");
  const openBrackets = (out.match(/\[/g) ?? []).length - (out.match(/\]/g) ?? []).length;
  const openBraces = (out.match(/\{/g) ?? []).length - (out.match(/\}/g) ?? []).length;
  const quotes = (out.match(/(?<!\\)"/g) ?? []).length;
  if (quotes % 2 !== 0) out += '"';
  out += "]".repeat(Math.max(0, openBrackets));
  out += "}".repeat(Math.max(0, openBraces));
  return out;
}

function tryParse(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Truncate after the last fully-closed step object inside "steps": [...] */
function salvageStepsArray(s: string): string | null {
  const key = '"steps"';
  const idx = s.indexOf(key);
  if (idx < 0) return null;

  const arrStart = s.indexOf("[", idx);
  if (arrStart < 0) return null;

  let depth = 0;
  let lastStepEnd = -1;
  let inString = false;
  let escape = false;

  for (let i = arrStart; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) lastStepEnd = i;
    }
  }

  if (lastStepEnd < 0) return null;

  const header = s.slice(0, arrStart + 1);
  const stepsBody = s.slice(arrStart + 1, lastStepEnd + 1);
  return closeBrackets(`${header}${stepsBody}]}`);
}

export function parseAIPlanJson(text: string): unknown | null {
  if (!text.trim()) return null;

  const normalized = normalizeRaw(text);

  const salvaged = salvageStepsArray(normalized);
  const attempts = [
    normalized,
    closeBrackets(normalized),
    normalized.lastIndexOf("}") > 0 ? normalized.slice(0, normalized.lastIndexOf("}") + 1) : null,
    salvaged,
    salvaged ? closeBrackets(salvaged) : null,
  ].filter((x): x is string => typeof x === "string" && x.length > 0);

  const seen = new Set<string>();
  for (const candidate of attempts) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const parsed = tryParse(candidate);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const steps = (parsed as Record<string, unknown>).steps;
      if (Array.isArray(steps) && steps.length > 0) return parsed;
    }
  }

  return null;
}
