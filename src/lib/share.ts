/**
 * A shareable link carries the whole session in the URL fragment — the code,
 * the language and the test case — so a friend who opens it sees the same
 * program and can press Visualize. Nothing is sent anywhere: the fragment
 * never leaves the browser, which keeps the tool free of any server.
 */
export interface SharedSession {
  code: string;
  language: string;
  testCase?: string;
}

const PREFIX = "#s=";

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeSession(session: SharedSession): string {
  const payload: Record<string, string> = { c: session.code, l: session.language };
  if (session.testCase) payload.t = session.testCase;
  return PREFIX + toBase64Url(JSON.stringify(payload));
}

export function decodeSession(hash: string): SharedSession | null {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(hash.slice(PREFIX.length))) as {
      c?: unknown;
      l?: unknown;
      t?: unknown;
    };
    if (typeof parsed.c !== "string" || typeof parsed.l !== "string") return null;
    return {
      code: parsed.c,
      language: parsed.l,
      testCase: typeof parsed.t === "string" ? parsed.t : undefined,
    };
  } catch {
    return null;
  }
}

/** The full URL for the current page with the session in its fragment. */
export function shareUrl(session: SharedSession): string {
  const base = window.location.href.split("#")[0];
  return base + encodeSession(session);
}
