"use client";

import { useEffect, useRef, useState } from "react";

type Appearance = "system" | "light" | "dark";

const STORAGE_KEY = "voc-appearance";

interface HeaderProps {
  /** The link that reproduces the editor's current contents. */
  getShareUrl: () => string;
  /** Open the roadmap; the button is lit while it is open. */
  onToggleRoadmap: () => void;
  roadmapOpen: boolean;
}

export function Header({ getShareUrl, onToggleRoadmap, roadmapOpen }: HeaderProps) {
  const [appearance, setAppearance] = useState<Appearance>("system");
  const [mounted, setMounted] = useState(false);
  const [shared, setShared] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as Appearance | null;
      if (saved === "light" || saved === "dark") setAppearance(saved);
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    try {
      if (appearance === "system") {
        root.removeAttribute("data-theme");
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        root.setAttribute("data-theme", appearance);
        window.localStorage.setItem(STORAGE_KEY, appearance);
      }
    } catch {
      /* ignore */
    }
  }, [appearance, mounted]);

  const next = (): Appearance =>
    appearance === "system" ? "light" : appearance === "light" ? "dark" : "system";

  const share = async () => {
    const url = getShareUrl();
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      ok = false;
    }
    // The address bar carries the link too, so a failed clipboard still has
    // a copyable URL on screen.
    try {
      window.history.replaceState(null, "", url);
    } catch {
      /* ignore */
    }
    setShared(ok ? "copied" : "failed");
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setShared("idle"), 2000);
  };

  return (
    <header
      className="relative h-[38px] shrink-0 flex items-center px-3.5 select-none"
      style={{
        background: "var(--mac-titlebar)",
        borderBottom: "1px solid var(--mac-separator)",
      }}
    >
      <TrafficLights />

      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-baseline gap-2 pointer-events-none"
        style={{ color: "var(--mac-text)" }}
      >
        <span className="text-[13px] font-semibold">VisualizeOurCode</span>
        <span className="text-[11px]" style={{ color: "var(--mac-text-3)" }}>
          your code, step by step
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleRoadmap}
          className="mac-btn"
          style={{
            height: 22,
            padding: "0 9px",
            fontSize: 11,
            color: roadmapOpen ? "var(--mac-accent)" : undefined,
            borderColor: roadmapOpen ? "var(--mac-accent)" : undefined,
          }}
          title="Every topic the tracer can draw, with worked problems"
          aria-pressed={roadmapOpen}
        >
          <MapIcon />
          Roadmap
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="mac-btn"
          style={{ height: 22, padding: "0 9px", fontSize: 11 }}
          title="Copy a link that opens this code"
        >
          <LinkIcon />
          {shared === "copied" ? "Link copied" : shared === "failed" ? "Link in address bar" : "Share"}
        </button>
        <button
          type="button"
          onClick={() => setAppearance(next())}
          className="mac-btn"
          style={{ height: 22, padding: "0 9px", fontSize: 11 }}
          title="Switch appearance"
        >
          {/* Rendered only after mount: the stored choice is unknown on the
              server, and guessing it flashes the wrong appearance. */}
          {mounted ? APPEARANCE_LABEL[appearance] : "Appearance"}
        </button>
      </div>
    </header>
  );
}

const APPEARANCE_LABEL: Record<Appearance, string> = {
  system: "Auto",
  light: "Light",
  dark: "Dark",
};

function MapIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="5.5" y="1.5" width="5" height="3.5" rx="1" />
      <rect x="1.5" y="11" width="5" height="3.5" rx="1" />
      <rect x="9.5" y="11" width="5" height="3.5" rx="1" />
      <path d="M8 5v2.5M4 11V9a1.5 1.5 0 011.5-1.5h5A1.5 1.5 0 0112 9v2" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M6.5 9.5l3-3M7 4.5l1.5-1.5a2.5 2.5 0 013.5 3.5L10.5 8M9 11.5l-1.5 1.5a2.5 2.5 0 01-3.5-3.5L5.5 8" strokeLinecap="round" />
    </svg>
  );
}

function TrafficLights() {
  return (
    <div className="flex items-center gap-2">
      <Light fill="#ff5f57" ring="#e0443e" />
      <Light fill="#febc2e" ring="#dea123" />
      <Light fill="#28c840" ring="#1aad2b" />
    </div>
  );
}

function Light({ fill, ring }: { fill: string; ring: string }) {
  return (
    <span
      className="block rounded-full"
      style={{
        width: 12,
        height: 12,
        background: fill,
        boxShadow: `inset 0 0 0 0.5px ${ring}`,
      }}
    />
  );
}
