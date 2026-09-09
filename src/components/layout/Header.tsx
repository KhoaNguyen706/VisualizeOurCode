"use client";

import { useEffect, useState } from "react";

type Appearance = "system" | "light" | "dark";

const STORAGE_KEY = "voc-appearance";

export function Header() {
  const [appearance, setAppearance] = useState<Appearance>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = window.localStorage.getItem(STORAGE_KEY) as Appearance | null;
    if (saved === "light" || saved === "dark") setAppearance(saved);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (appearance === "system") {
      root.removeAttribute("data-theme");
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      root.setAttribute("data-theme", appearance);
      window.localStorage.setItem(STORAGE_KEY, appearance);
    }
  }, [appearance, mounted]);

  const next = (): Appearance =>
    appearance === "system" ? "light" : appearance === "light" ? "dark" : "system";

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
        className="absolute left-1/2 -translate-x-1/2 flex items-baseline gap-2"
        style={{ color: "var(--mac-text)" }}
      >
        <span className="text-[13px] font-semibold">VisualizeOurCode</span>
        <span className="text-[11px]" style={{ color: "var(--mac-text-3)" }}>
          your code, step by step
        </span>
      </div>

      <div className="ml-auto flex items-center">
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
