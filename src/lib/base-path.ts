/**
 * 与 `next.config.ts` 中的 `basePath` 一致。
 * 构建时由 `env.NEXT_PUBLIC_BASE_PATH` 注入，供客户端拼接同源 API 路径。
 */
export const BASE_PATH =
  typeof process.env.NEXT_PUBLIC_BASE_PATH === "string"
    ? process.env.NEXT_PUBLIC_BASE_PATH.replace(/\/$/, "")
    : "";

/** @example withBasePath("/api/weather-history") => "/weather/api/weather-history" */
export function withBasePath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!BASE_PATH) return p;
  return `${BASE_PATH}${p}`;
}
