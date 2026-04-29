import type { DayPayload } from "./types";

const DEFAULT_BASE = "https://api.deepseek.com/v1";
const MODEL = "deepseek-chat";
const TIMEOUT_MS = 45_000;

export type CommentEntry = { date: string; comment: string };

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1]!.trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return body.slice(start, end + 1);
}

export async function generateCommentsWithDeepSeek(
  cityLabel: string,
  days: DayPayload[],
  apiKey: string,
  baseUrl?: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const base = (baseUrl || DEFAULT_BASE).replace(/\/+$/, "");
  const payload = days.map((d) => ({
    date: d.dateDisplay,
    tempMax: d.tempMax,
    tempMin: d.tempMin,
    condition: d.condition,
    precip: d.precip,
  }));

  const userPrompt = `你是天气播报编辑。根据下列已观测气象事实，为每一天写一句中文短评（20字以内），语气自然友好，不要编造与数据矛盾的内容。

城市：${cityLabel}

每日数据（JSON）：
${JSON.stringify(payload, null, 2)}

请只输出一个 JSON 对象，格式严格如下，不要其它文字：
{"comments":[{"date":"YYYY-MM-DD","comment":"..."}, ...]}
comments 必须恰好 ${days.length} 条，且 date 与输入中的 date 一一对应。`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 1200,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      console.error("[deepseek] HTTP", res.status);
      return map;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return map;

    const jsonStr = extractJsonObject(content);
    if (!jsonStr) return map;

    let parsed: { comments?: CommentEntry[] };
    try {
      parsed = JSON.parse(jsonStr) as { comments?: CommentEntry[] };
    } catch {
      return map;
    }
    const list = parsed.comments;
    if (!Array.isArray(list)) return map;

    for (const c of list) {
      if (c?.date && typeof c.comment === "string") {
        map.set(c.date.trim(), c.comment.trim());
      }
    }
  } catch (e) {
    console.error("[deepseek]", e instanceof Error ? e.message : e);
  } finally {
    clearTimeout(timer);
  }

  return map;
}
