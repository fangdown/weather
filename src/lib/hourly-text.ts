import type { QWeatherWeatherHourly } from "./types";

/** 取午间附近 `text` 作为当日代表状况；若无 hourly 则返回空串。 */
export function pickRepresentativeCondition(
  hourly: QWeatherWeatherHourly[] | undefined
): string {
  if (!hourly?.length) return "";

  const withHour = hourly.map((h) => {
    const m = h.time.match(/(\d{2}):(\d{2})/);
    const hour = m ? parseInt(m[1], 10) : 12;
    return { h, hour, dist: Math.abs(hour - 12) };
  });
  withHour.sort((a, b) => a.dist - b.dist);
  const best = withHour[0]?.h;
  return (best?.text ?? "").trim() || (hourly[0]?.text ?? "").trim();
}
