import type { AITemplatePack } from "@/lib/engine/mergeStepsWithAI";

const CACHE_PREFIX = "voc-templates:";

function hashCode(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export function getCachedTemplate(code: string): AITemplatePack | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + hashCode(code));
    if (!raw) return null;
    return JSON.parse(raw) as AITemplatePack;
  } catch {
    return null;
  }
}

export function setCachedTemplate(code: string, pack: AITemplatePack): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_PREFIX + hashCode(code), JSON.stringify(pack));
  } catch {
    // quota exceeded — ignore
  }
}

export async function fetchAITemplates(code: string, language?: string): Promise<AITemplatePack | null> {
  const cached = getCachedTemplate(code);
  if (cached) return cached;

  try {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.template) {
      setCachedTemplate(code, data.template);
      return data.template as AITemplatePack;
    }
  } catch {
    return null;
  }
  return null;
}
