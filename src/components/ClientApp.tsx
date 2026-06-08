"use client";

import dynamic from "next/dynamic";

function LoadingShell() {
  return (
    <div
      className="h-screen flex items-center justify-center text-[13px]"
      style={{ background: "#1e1e1e", color: "#858585" }}
      suppressHydrationWarning
    >
      Loading VisualizeOurCode…
    </div>
  );
}

const VisualizerApp = dynamic(
  () => import("@/components/VisualizerApp").then((m) => m.VisualizerApp),
  { ssr: false, loading: LoadingShell }
);

export function ClientApp() {
  return <VisualizerApp />;
}
