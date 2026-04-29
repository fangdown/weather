import { cacheGet, cacheSet } from "./cache";
import { pickRepresentativeCondition } from "./hourly-text";
import type {
  DayPayload,
  QWeatherGeoResponse,
  QWeatherHistoricalResponse,
  QWeatherLocation,
} from "./types";
import { ymdToDisplay } from "./dates";

const FETCH_TIMEOUT_MS = 12_000;

/** JWT 使用 `Authorization: Bearer`；API KEY 使用 `X-QW-Api-Key`（勿混用）。 */
export type QWeatherAuthMode = "jwt" | "apikey";

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, "");
}

function buildAuthHeaders(
  credential: string,
  mode: QWeatherAuthMode
): Record<string, string> {
  if (mode === "apikey") {
    return { "X-QW-Api-Key": credential };
  }
  return { Authorization: `Bearer ${credential}` };
}

async function qFetch<T>(
  url: string,
  credential: string,
  authMode: QWeatherAuthMode
): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        ...buildAuthHeaders(credential, authMode),
        "Accept-Encoding": "gzip",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let detail = text ? ` ${text.slice(0, 240)}` : "";
      try {
        const errBody = JSON.parse(text) as { code?: string; error?: string };
        if (errBody?.code != null || errBody?.error) {
          detail = ` code=${errBody.code ?? "?"}${errBody.error ? ` ${errBody.error}` : ""}`;
        }
      } catch {
        /* keep text snippet */
      }
      throw new Error(`HTTP ${res.status}${detail}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export function parseQWeatherAuthMode(
  raw: string | undefined
): QWeatherAuthMode {
  const v = (raw || "apikey").toLowerCase().trim();
  if (v === "jwt" || v === "bearer") return "jwt";
  return "apikey";
}

export async function lookupCity(
  host: string,
  credential: string,
  authMode: QWeatherAuthMode,
  location: string,
  adm?: string,
  range?: string
): Promise<QWeatherLocation[]> {
  const base = normalizeHost(host);
  const params = new URLSearchParams({ location });
  if (adm) params.set("adm", adm);
  if (range) params.set("range", range);
  params.set("number", "10");
  const url = `${base}/geo/v2/city/lookup?${params.toString()}`;
  const data = await qFetch<QWeatherGeoResponse>(url, credential, authMode);
  if (data.code !== "200" || !data.location?.length) {
    return [];
  }
  return data.location;
}

export async function fetchHistoricalDay(
  host: string,
  credential: string,
  authMode: QWeatherAuthMode,
  locationId: string,
  dateYmd: string
): Promise<DayPayload | { error: string }> {
  const cacheKey = `hist:${authMode}:${locationId}:${dateYmd}`;
  const cached = cacheGet<DayPayload | { error: string }>(cacheKey);
  if (cached) return cached;

  const base = normalizeHost(host);
  const url = `${base}/v7/historical/weather?location=${encodeURIComponent(locationId)}&date=${dateYmd}`;
  try {
    const data = await qFetch<QWeatherHistoricalResponse>(
      url,
      credential,
      authMode
    );
    if (data.code !== "200") {
      const err = { error: `和风 code=${data.code}` };
      cacheSet(cacheKey, err, 60_000);
      return err;
    }
    const daily = data.weatherDaily;
    if (!daily) {
      const err = { error: "无 daily 数据" };
      cacheSet(cacheKey, err, 60_000);
      return err;
    }
    const condition = pickRepresentativeCondition(data.weatherHourly);
    const payload: DayPayload = {
      dateYmd,
      dateDisplay: daily.date || ymdToDisplay(dateYmd),
      tempMax: daily.tempMax ?? null,
      tempMin: daily.tempMin ?? null,
      precip: daily.precip ?? null,
      condition: condition || "—",
    };
    cacheSet(cacheKey, payload);
    return payload;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "请求失败";
    const err = { error: msg };
    cacheSet(cacheKey, err, 30_000);
    return err;
  }
}

/** 受控并发拉取多日 */
export async function fetchHistoricalDaysLimited(
  host: string,
  credential: string,
  authMode: QWeatherAuthMode,
  locationId: string,
  datesYmd: string[],
  concurrency: number
): Promise<(DayPayload | { error: string })[]> {
  const results: (DayPayload | { error: string })[] = new Array(datesYmd.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, datesYmd.length) },
    async () => {
      for (;;) {
        const i = next++;
        if (i >= datesYmd.length) return;
        results[i] = await fetchHistoricalDay(
          host,
          credential,
          authMode,
          locationId,
          datesYmd[i]!
        );
      }
    }
  );
  await Promise.all(workers);
  return results;
}
