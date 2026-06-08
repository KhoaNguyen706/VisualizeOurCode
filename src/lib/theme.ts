/** VS Code Dark+ inspired palette */
export const vscode = {
  titleBar: "#323233",
  activityBar: "#333333",
  sidebar: "#252526",
  editor: "#1e1e1e",
  panel: "#181818",
  border: "#3c3c3c",
  borderLight: "#474747",
  foreground: "#cccccc",
  muted: "#858585",
  disabled: "#5a5a5a",
  accent: "#007acc",
  accentHover: "#1a8ad4",
  tabActive: "#1e1e1e",
  tabInactive: "#2d2d2d",
  tabBorder: "#252526",
  lineNumber: "#858585",
  selection: "#264f78",
  button: "#0e639c",
  buttonHover: "#1177bb",
} as const;

export const theme = {
  canvas: "bg-[#1e1e1e]",
  surface: "bg-[#252526]",
  border: "border-[#3c3c3c]",
  text: "text-[#cccccc]",
  muted: "text-[#858585]",
  explore: {
    bg: "bg-[#264f78]/40",
    border: "border-[#3794ff]",
    text: "text-[#3794ff]",
    glow: "shadow-[0_0_12px_rgba(55,148,255,0.25)]",
    accent: "#3794ff",
  },
  success: {
    bg: "bg-[#4ec9b0]/15",
    border: "border-[#4ec9b0]",
    text: "text-[#4ec9b0]",
    glow: "shadow-[0_0_12px_rgba(78,201,176,0.25)]",
    accent: "#4ec9b0",
  },
  fail: {
    bg: "bg-[#f48771]/15",
    border: "border-[#f48771]",
    text: "text-[#f48771]",
    glow: "shadow-[0_0_12px_rgba(244,135,113,0.25)]",
    accent: "#f48771",
  },
} as const;

export function statusColors(status: "EXPLORE" | "SUCCESS" | "FAIL") {
  return status === "SUCCESS"
    ? theme.success
    : status === "FAIL"
      ? theme.fail
      : theme.explore;
}
