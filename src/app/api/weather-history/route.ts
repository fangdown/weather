import { NextResponse } from "next/server";
import { getHistoricalYmdRange } from "@/lib/dates";
import { generateCommentsWithDeepSeek } from "@/lib/deepseek";
import {
  fetchHistoricalDaysLimited,
  lookupCity,
  parseQWeatherAuthMode,
} from "@/lib/qweather";
import type {
  DayPayload,
  WeatherHistoryResponseBody,
  WeatherHistoryRow,
} from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  city?: string;
  adm?: string;
  range?: string;
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export async function POST(req: Request) {
  const host = env("QWEATHER_API_HOST");
  const token = env("QWEATHER_TOKEN");
  const authMode = parseQWeatherAuthMode(env("QWEATHER_AUTH"));
  const deepseekKey = env("DEEPSEEK_API_KEY");
  const deepseekBase = env("DEEPSEEK_BASE_URL");

  if (!host || !token) {
    return NextResponse.json(
      {
        error:
          "缺少环境变量 QWEATHER_API_HOST 或 QWEATHER_TOKEN，请配置 .env.local",
      },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const city = typeof body.city === "string" ? body.city.trim() : "";
  if (!city || city.length < 1) {
    return NextResponse.json({ error: "请提供 city" }, { status: 400 });
  }

  let locations;
  try {
    locations = await lookupCity(
      host,
      token,
      authMode,
      city,
      body.adm?.trim() || undefined,
      body.range?.trim() || undefined
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "和风请求失败";
    if (msg.includes("401")) {
      return NextResponse.json(
        {
          error:
            "和风返回 401：凭据无效或未授权。默认使用 X-QW-Api-Key（QWEATHER_AUTH=apikey）；若凭据是 JWT，请设置 QWEATHER_AUTH=jwt。并核对 QWEATHER_TOKEN、QWEATHER_API_HOST 与控制台一致。详见 https://dev.qweather.com/docs/configuration/authentication/",
          detail: msg,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!locations.length) {
    return NextResponse.json(
      { error: "未找到匹配城市，可尝试 adm / range 缩小范围" },
      { status: 404 }
    );
  }

  const loc = locations[0]!;
  const datesYmd = getHistoricalYmdRange();

  const rawDays = await fetchHistoricalDaysLimited(
    host,
    token,
    authMode,
    loc.id,
    datesYmd,
    3
  );

  const payloads: DayPayload[] = [];
  const rows: WeatherHistoryRow[] = [];

  for (let i = 0; i < rawDays.length; i++) {
    const r = rawDays[i]!;
    if ("error" in r) {
      const ymd = datesYmd[i]!;
      const display = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
      rows.push({
        date: display,
        tempMax: null,
        tempMin: null,
        condition: "—",
        comment: "暂无数据",
        commentSource: "fallback",
        dayError: r.error,
      });
    } else {
      payloads.push(r);
      rows.push({
        date: r.dateDisplay,
        tempMax: r.tempMax,
        tempMin: r.tempMin,
        condition: r.condition,
        comment: r.condition,
        commentSource: "fallback",
      });
    }
  }

  const cityLabel = `${loc.name}（${loc.adm1}，${loc.country}）`;

  if (deepseekKey && payloads.length > 0) {
    const commentMap = await generateCommentsWithDeepSeek(
      cityLabel,
      payloads,
      deepseekKey,
      deepseekBase
    );

    for (const row of rows) {
      if (row.dayError) continue;
      const fromAi = commentMap.get(row.date);
      if (fromAi) {
        row.comment = fromAi;
        row.commentSource = "deepseek";
      }
    }
  }

  const out: WeatherHistoryResponseBody = {
    cityQuery: city,
    resolved: {
      name: loc.name,
      id: loc.id,
      adm1: loc.adm1,
      country: loc.country,
    },
    days: rows,
  };

  return NextResponse.json(out);
}
