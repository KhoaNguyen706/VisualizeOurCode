/**
 * Status styling for the visualization modes.
 *
 * Every value resolves through a macOS appearance token defined in globals.css,
 * so one class set serves both appearances and the two cannot drift apart. An
 * opacity modifier on an arbitrary value compiles to `color-mix`, which is why
 * `/14` is safe on a `var()` here.
 */
export const theme = {
  canvas: "bg-[var(--mac-content)]",
  surface: "bg-[var(--mac-sidebar)]",
  border: "border-[var(--mac-separator)]",
  text: "text-[var(--mac-text)]",
  muted: "text-[var(--mac-text-2)]",
  explore: {
    bg: "bg-[var(--mac-accent)]/12",
    border: "border-[var(--mac-accent)]",
    text: "text-[var(--mac-accent)]",
    glow: "shadow-[0_0_0_3px_var(--mac-accent-soft)]",
    accent: "var(--mac-accent)",
  },
  success: {
    bg: "bg-[var(--mac-good)]/14",
    border: "border-[var(--mac-good)]",
    text: "text-[var(--mac-good)]",
    glow: "shadow-[0_0_0_3px_var(--mac-good-soft)]",
    accent: "var(--mac-good)",
  },
  fail: {
    bg: "bg-[var(--mac-bad)]/14",
    border: "border-[var(--mac-bad)]",
    text: "text-[var(--mac-bad)]",
    glow: "shadow-[0_0_0_3px_var(--mac-bad-soft)]",
    accent: "var(--mac-bad)",
  },
} as const;

export function statusColors(status: "EXPLORE" | "SUCCESS" | "FAIL") {
  return status === "SUCCESS"
    ? theme.success
    : status === "FAIL"
      ? theme.fail
      : theme.explore;
}
