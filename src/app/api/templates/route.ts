import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildTemplatePrompt } from "@/lib/gemini/templatePrompt";
import { extractJsonFromText } from "@/lib/gemini/validateTimeline";
import type { AITemplatePack } from "@/lib/engine/mergeStepsWithAI";

export const maxDuration = 30;

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

function validateTemplatePack(raw: unknown): AITemplatePack | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string" || typeof o.primaryMode !== "string") return null;
  if (!Array.isArray(o.steps)) return null;
  return {
    name: o.name,
    description: typeof o.description === "string" ? o.description : "",
    timeComplexity: typeof o.timeComplexity === "string" ? o.timeComplexity : undefined,
    spaceComplexity: typeof o.spaceComplexity === "string" ? o.spaceComplexity : undefined,
    primaryMode: o.primaryMode as AITemplatePack["primaryMode"],
    defaultTemplate: typeof o.defaultTemplate === "string" ? o.defaultTemplate : undefined,
    steps: o.steps
      .filter((s) => s && typeof s === "object" && typeof (s as { template?: string }).template === "string")
      .map((s) => {
        const step = s as Record<string, unknown>;
        return {
          line: typeof step.line === "number" ? step.line : undefined,
          index: typeof step.index === "number" ? step.index : undefined,
          template: step.template as string,
          statusType: step.statusType as AITemplatePack["steps"][0]["statusType"],
          mode: step.mode as AITemplatePack["steps"][0]["mode"],
          overlayModes: step.overlayModes as AITemplatePack["steps"][0]["overlayModes"],
        };
      }),
  };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured. Static templates are used instead." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const language = typeof body.language === "string" ? body.language : undefined;

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(buildTemplatePrompt(code, language));
    const text = result.response.text() ?? "";
    const parsed = extractJsonFromText(text);
    const template = validateTemplatePack(parsed);

    if (!template) {
      return NextResponse.json({ error: "Invalid template response from Gemini" }, { status: 502 });
    }

    return NextResponse.json({ template });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
