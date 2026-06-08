export interface ArrayLayout {
  cellPx: number;
  gap: number;
  cellStep: number;
  fontSize: number;
  indexFontSize: number;
  totalWidth: number;
}

/** Scale array cells so long inputs stay visible in one row. */
export function computeArrayLayout(count: number, compact = false): ArrayLayout {
  const n = Math.max(count, 1);
  const budget = compact ? 480 : 920;
  const minCell = compact ? 26 : 30;
  const maxCell = compact ? 44 : 72;

  const gap = n > 28 ? 3 : n > 18 ? 5 : n > 10 ? 7 : n > 6 ? 9 : 12;
  const cellPx = Math.max(minCell, Math.min(maxCell, Math.floor((budget - gap * (n - 1)) / n)));
  const cellStep = cellPx + gap;

  return {
    cellPx,
    gap,
    cellStep,
    fontSize: cellPx < 34 ? 11 : cellPx < 44 ? 13 : cellPx < 58 ? 16 : 20,
    indexFontSize: cellPx < 36 ? 8 : 10,
    totalWidth: n * cellPx + Math.max(0, n - 1) * gap,
  };
}
