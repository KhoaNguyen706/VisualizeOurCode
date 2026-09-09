import type { NextConfig } from "next";

// Everything runs in the browser — the JS sandbox, Pyodide, the narration — so
// the site is a static export with no server. GitHub Pages serves a project
// site under `/<repo>/`; the deploy workflow sets the prefix, while local
// `next dev` / `next build` keep serving from `/`.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
