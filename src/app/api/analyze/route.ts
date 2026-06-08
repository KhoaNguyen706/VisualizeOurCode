import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { buildAnalysisPrompt, buildContinuationPrompt } from "@/lib/gemini/prompt";
import { extractJsonFromText, validateScenarioPayload } from "@/lib/gemini/validateTimeline";

export const maxDuration = 120;

const MAX_OUTPUT_TOKENS = 65536;
const MAX_CONTINUATIONS = 3;

const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

const MODELS = [
  ...new Set([process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(Boolean)),
] as string[];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryDelayMs(message: string): number {
  const seconds = message.match(/retry in ([\d.]+)s/i);
  if (seconds) return Math.ceil(parseFloat(seconds[1]) * 1000);
  return 15000;
}

function isQuotaError(message: string) {
  return message.includes("429") || message.toLowerCase().includes("quota");
}

function isModelUnavailable(message: string) {
  return message.includes("404") || message.toLowerCase().includes("not found");
}

function isTruncated(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return true;
  try {
    JSON.parse(trimmed);
    return false;
  } catch {
    return true;
  }
}

function friendlyGeminiError(message: string): { status: number; error: string } {
  if (isQuotaError(message)) {
    return {
      status: 429,
      error:
        "Gemini API rate-limited. Wait 1–2 minutes and retry, or check usage at https://aistudio.google.com/",
    };
  }
  if (message.includes("API_KEY_INVALID") || message.includes("API key not valid")) {
    return { status: 401, error: "Invalid GEMINI_API_KEY. Check your key at https://aistudio.google.com/apikey" };
  }
  if (isModelUnavailable(message)) {
    return { status: 502, error: "No Gemini models available. Try GEMINI_MODEL=gemini-2.5-flash in .env.local." };
  }
  return { status: 500, error: message };
}

function createModel(apiKey: string, modelName: string): GenerativeModel {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
    },
  });
}

async function generateFull(apiKey: string, modelName: string, prompt: string): Promise<string> {
  const model = createModel(apiKey, modelName);
  let text = "";
  let promptText = prompt;

  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const result = await model.generateContent(promptText);
    const chunk = result.response.text() ?? "";
    const finishReason = result.response.candidates?.[0]?.finishReason;

    text += chunk;

    console.log(`[analyze] chunk ${i + 1}: ${chunk.length} chars, finishReason=${finishReason}, total=${text.length}`);

    if (!isTruncated(text)) return text;

    if (finishReason !== "MAX_TOKENS" && i === 0) {
      // Not a token limit issue on first try — let repair handle it
      return text;
    }

    if (i >= MAX_CONTINUATIONS) break;

    console.log(`[analyze] Response truncated, requesting continuation ${i + 1}...`);
    promptText = buildContinuationPrompt(text);
    await sleep(500);
  }

  return text;
}

async function generateWithFallback(apiKey: string, prompt: string): Promise<string> {
  let lastError: Error | null = null;

  for (const modelName of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await generateFull(apiKey, modelName, prompt);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message;

        if (isQuotaError(msg)) {
          if (attempt === 0) {
            await sleep(parseRetryDelayMs(msg));
            continue;
          }
          break;
        }

        if (isModelUnavailable(msg)) break;
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("All Gemini models failed");
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured. Add it to .env.local or .env, then restart the dev server." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const language = typeof body.language === "string" ? body.language : undefined;

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    if (code.length > 12000) {
      return NextResponse.json({ error: "Code exceeds 12,000 character limit" }, { status: 400 });
    }

    const prompt = buildAnalysisPrompt(code, language);
    const text = await generateWithFallback(apiKey, prompt);

    console.log("\n========== [analyze] Gemini raw response ==========");
    console.log(`length: ${text.length} chars`);
    console.log(text);
    console.log("========== end Gemini response ==========\n");

    let parsed: unknown;
    try {
      parsed = extractJsonFromText(text);
    } catch (parseErr) {
      const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error("[analyze] JSON parse failed:", parseMsg);
      return NextResponse.json(
        {
          error: `Failed to parse Gemini response as JSON: ${parseMsg}`,
          parseError: parseMsg,
          rawLength: text.length,
          raw: text,
        },
        { status: 502 }
      );
    }

    try {
      const scenario = validateScenarioPayload(parsed);
      scenario.id = `gemini-${Date.now()}`;
      return NextResponse.json({ scenario });
    } catch (validationErr) {
      const valMsg = validationErr instanceof Error ? validationErr.message : String(validationErr);
      console.error("[analyze] Validation failed:", valMsg);
      return NextResponse.json(
        {
          error: `Gemini response validation failed: ${valMsg}`,
          parsed,
        },
        { status: 502 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[analyze]", message);
    const { status, error } = friendlyGeminiError(message);
    return NextResponse.json({ error }, { status });
  }
}
