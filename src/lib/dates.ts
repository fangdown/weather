/** 最近 10 个自然日（不含今天）：T-10 … T-1，按时间正序。用于和风时光机 `yyyyMMdd`。 */
export function getHistoricalYmdRange(now = new Date()): string[] {
  const out: string[] = [];
  for (let k = 10; k >= 1; k--) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - k);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}${m}${day}`);
  }
  return out;
}

export function ymdToDisplay(ymd: string): string {
  if (ymd.length !== 8) return ymd;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}
