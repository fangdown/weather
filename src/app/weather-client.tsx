"use client";

import { useState } from "react";
import type { WeatherHistoryResponseBody } from "@/lib/types";

function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90 ${className}`}
      aria-hidden
    />
  );
}

function LoadingPanel() {
  return (
    <section
      className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
      aria-busy="true"
      aria-label="正在加载天气数据"
    >
      <div className="flex items-center gap-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <Spinner className="size-5" />
        <span>正在拉取近 10 日天气，并生成评语…</span>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-500">
        若已配置 DeepSeek，可能需要多等几秒。
      </p>
      <div className="overflow-hidden rounded-lg border border-zinc-200/80 bg-white dark:border-zinc-700 dark:bg-zinc-950">
        <div className="grid grid-cols-4 gap-0 border-b border-zinc-200 bg-zinc-100 px-3 py-2.5 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <span>日期</span>
          <span>温度</span>
          <span>状况</span>
          <span>评语</span>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="grid grid-cols-4 items-center gap-2 px-3 py-2.5"
            >
              <div className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 max-w-[12rem] animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WeatherClient() {
  const [city, setCity] = useState("北京");
  const [adm, setAdm] = useState("");
  const [range, setRange] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WeatherHistoryResponseBody | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/weather-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: city.trim(),
          adm: adm.trim() || undefined,
          range: range.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : res.statusText);
        return;
      }
      setData(json as WeatherHistoryResponseBody);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6"
      aria-busy={loading}
    >
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          近 10 日天气与评语
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          数据来自和风天气「时光机」（不含今日）；评语由 DeepSeek
          根据当日实况生成，失败时使用天气状况原文。
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="relative flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            城市
          </span>
          <input
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={loading}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-foreground outline-none ring-zinc-400 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="例如 北京"
            autoComplete="off"
            required
          />
        </label>
        <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            上级区划 adm（可选）
          </span>
          <input
            name="adm"
            value={adm}
            onChange={(e) => setAdm(e.target.value)}
            disabled={loading}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-foreground outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="排除重名，如 黑龙江"
          />
        </label>
        <label className="flex w-full min-w-[6rem] flex-col gap-1 text-sm sm:w-28">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            range（可选）
          </span>
          <input
            name="range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            disabled={loading}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-foreground outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="cn"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 min-w-[7.5rem] items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {loading ? (
            <>
              <Spinner />
              查询中…
            </>
          ) : (
            "查询"
          )}
        </button>
      </form>

      <output className="sr-only" aria-live="polite">
        {loading ? "正在查询，请稍候" : ""}
      </output>

      {loading ? <LoadingPanel /> : null}

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {data ? (
        <section className="space-y-3" aria-live="polite">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            已匹配：
            <strong className="text-foreground">
              {data.resolved.name}
            </strong>
            ，{data.resolved.adm1}，{data.resolved.country}（LocationID{" "}
            {data.resolved.id}）
          </p>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/80">
                  <th className="px-3 py-3 font-medium">日期</th>
                  <th className="px-3 py-3 font-medium">最高 / 最低</th>
                  <th className="px-3 py-3 font-medium">状况</th>
                  <th className="px-3 py-3 font-medium">评语</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((row) => (
                  <tr
                    key={row.date}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap">{row.date}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                      {row.tempMax != null && row.tempMin != null
                        ? `${row.tempMax}° / ${row.tempMin}°`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5">{row.condition}</td>
                    <td className="px-3 py-2.5 text-zinc-800 dark:text-zinc-200">
                      {row.comment}
                      {row.dayError ? (
                        <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                          （{row.dayError}）
                        </span>
                      ) : null}
                      <span className="ml-2 text-xs text-zinc-400">
                        {row.commentSource === "deepseek" ? "·AI" : "·原文"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <footer className="border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        气象数据 ©{" "}
        <a
          href="https://www.qweather.com/"
          className="underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          QWeather 和风天气
        </a>
        ，使用请遵守{" "}
        <a
          href="https://dev.qweather.com/docs/api/"
          className="underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          开发文档
        </a>{" "}
        中的注明来源与使用限制。
      </footer>
    </div>
  );
}
