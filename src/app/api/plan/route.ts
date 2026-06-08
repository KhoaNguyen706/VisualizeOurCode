import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildAIPlanPrompt } from "@/lib/gemini/aiPlanPrompt";
import {
  buildTechniqueGuidedPlanPrompt,
  isTechniqueGuidable,
} from "@/lib/gemini/techniqueGuidedPlanPrompt";
import type { VisualizationTechnique } from "@/lib/engine/technique/types";
import { validateAIPlan } from "@/lib/gemini/aiPlan";
import { parseAIPlanJson } from "@/lib/gemini/parseAIPlanJson";

export const maxDuration = 30;

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const MAX_CODE_BYTES = 8000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

const ipBuckets = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = ipBuckets.get(ip) ?? [];
  const recent = arr.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    ipBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  ipBuckets.set(ip, recent);
  return true;
}

function getIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "anon";
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured. AI plan unavailable; static tracers still work." },
      { status: 503 }
    );
  }

  const ip = getIp(request);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in 1 minute." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const language = typeof body.language === "string" ? body.language : undefined;
    const testCase = typeof body.testCase === "string" ? body.testCase.trim() : undefined;
    const technique =
      typeof body.technique === "string" && isTechniqueGuidable(body.technique as VisualizationTechnique)
        ? (body.technique as VisualizationTechnique)
        : undefined;

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }
    if (code.length > MAX_CODE_BYTES) {
      return NextResponse.json(
        { error: `Code exceeds ${MAX_CODE_BYTES} character limit for AI plan` },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: technique ? 4096 : 8192,
        responseMimeType: "application/json",
      },
    });

    const prompt = technique
      ? buildTechniqueGuidedPlanPrompt(technique, code, language, testCase)
      : buildAIPlanPrompt(code, language, testCase);

    const result = await model.generateContent(prompt);
    const text = result.response.text() ?? "";
    const parsed = parseAIPlanJson(text);
    const plan = validateAIPlan(parsed);

    if (!plan) {
      return NextResponse.json(
        { error: "AI plan JSON was invalid. Local tracer will be used instead." },
        { status: 502 }
      );
    }

    return NextResponse.json({ plan });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unknown error";
    const message =
      /json|parse|unexpected token/i.test(raw)
        ? "AI plan JSON was invalid. Local tracer will be used instead."
        : "AI planner failed. Local tracer will be used instead.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
