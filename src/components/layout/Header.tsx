"use client";

export function Header() {
  return (
    <header
      className="relative h-[30px] shrink-0 flex items-center justify-between px-3 select-none"
      style={{ background: "#323233", borderBottom: "1px solid #3c3c3c" }}
    >
      <div className="flex items-center gap-3 text-[12px] text-[#cccccc]">
        <span className="hover:text-white cursor-default">File</span>
        <span className="hover:text-white cursor-default">Edit</span>
        <span className="hover:text-white cursor-default">View</span>
        <span className="hover:text-white cursor-default">Run</span>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[12px] text-[#cccccc]">
        <VsCodeIcon />
        <span>VisualizeOurCode</span>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-[#858585]">
        <span className="hidden sm:inline">DSA Visualizer</span>
      </div>
    </header>
  );
}

function VsCodeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M2 3l7 9-7 9V3z" fill="#007acc" />
      <path d="M9 3l13 9-13 9V3z" fill="#1e9cef" opacity="0.85" />
    </svg>
  );
}
