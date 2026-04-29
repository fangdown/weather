# 天气历史 + 评语 — 实施计划

**更新说明**：本文档保存产品与技术实施计划（Next.js + 和风天气 + DeepSeek），供后续开发对照。

---

## 1. 目标与范围

| 项 | 说明 |
|----|------|
| **前端** | Next.js（App Router） |
| **天气数据** | [和风天气开发服务 API](https://dev.qweather.com/docs/api/) |
| **评语** | DeepSeek 基于当日气象数据生成**中文短评**（若仅需接口 `text`、不调模型，可删除 LLM 路径以降本） |
| **展示** | 指定城市 **近 10 天**：日期、温度、天气状况、一句评语 |

**与和风「时光机」对齐**：历史接口为最近 10 天再分析数据，**不包含今天**；例如今天为 T，则可查 T-10 … T-1 共 10 个自然日。参考：[天气时光机](https://dev.qweather.com/docs/api/time-machine/time-machine-weather/)。

---

## 2. 方案对比（≥2 路径）

| 路径 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **A（推荐）** | Next **Route Handler** 聚合：Geo → 10 次时光机（受控并发）→ 一次 DeepSeek 批量评语 | 密钥仅在服务端；前端简单；易加缓存 | 冷启动略慢；需处理单日失败 |
| **B** | **Server Action** 承载相同逻辑 | 与表单 / RSC 贴合 | 超时与错误边界与 A 类似 |
| **C** | 浏览器直连和风 API | 实现快 | **暴露 JWT**，违反安全与常见实践 → **不推荐** |

**决策**：采用 **A 或 B**；和风 Token 与 DeepSeek Key **仅服务端**使用。

---

## 3. 分阶段执行计划

### 3.1 配置与契约

- 环境变量（示例命名）：
  - `QWEATHER_API_HOST` — 控制台分配的 API Host
  - `QWEATHER_TOKEN` — `Authorization: Bearer <JWT>`
  - `DEEPSEEK_API_KEY`
  - 可选：`DEEPSEEK_BASE_URL`（默认官方 OpenAI 兼容地址）
- 提供 `.env.example`；确保 `.env.local` 已加入 `.gitignore`。
- 不在仓库中硬编码密钥；认证与 Host 见和风文档：[开发配置](https://dev.qweather.com/docs/api/) 目录下相关页。

### 3.2 和风数据流

1. **城市搜索**：[城市搜索 GeoAPI](https://dev.qweather.com/docs/api/geoapi/city-lookup/)  
   `GET {host}/geo/v2/city/lookup?location=...`  
   取首个或用户选定结果的 **`location[].id`**（LocationID）。
2. **重名与范围**：使用 `adm`、`range` 等参数缩小结果；参考 GeoAPI 文档说明。
3. **历史天气**：[天气时光机](https://dev.qweather.com/docs/api/time-machine/time-machine-weather/)  
   `GET {host}/v7/historical/weather?location={LocationID}&date=yyyyMMdd`  
   对「昨天」起连续 **10 个** `yyyyMMdd` 各请求一次（或受控并发）。
4. **单日展示字段建议**：
   - `weatherDaily.date`、`tempMax`、`tempMin`
   - 代表「白天状况」：从 `weatherHourly` 取午间附近（如 12:00）的 `text`，或按 `icon` 众数汇总，与 DeepSeek 输入保持一致。

### 3.3 DeepSeek 评语

- **输入**：结构化 JSON（城市名、每日日期、最高/最低温、状况文案、降水等）。
- **输出**：要求模型返回 **严格 JSON**，例如  
  `{ "comments": [ { "date": "YYYY-MM-DD", "comment": "..." }, ... ] }`，便于解析与渲染。
- **策略**：**单次请求**生成 10 条评语，降低延迟与费用；合理设置 `temperature`、`max_tokens`。
- **降级**：模型失败或 JSON 解析失败时，展示和风 `text` 或固定占位文案。

### 3.4 Next.js 前端

- App Router 页面：城市输入、查询、加载态、错误提示；表格展示 10 行。
- 为 Geo、时光机响应与聚合 DTO 定义 TypeScript 类型。
- 表格使用语义化结构；加载中考虑 `aria-busy` 等可访问性。

### 3.5 质量与运维

- 轻量测试：「生成过去 10 个日期（不含今天）」、JSON 解析失败降级路径。
- 服务端日志记录和风 `code` 非 200、DeepSeek 错误；**禁止**在日志中输出密钥。
- **注明来源**：页脚或关于页按和风「使用限制 / 注明来源」要求标注数据来源（QWeather）。见 [开发文档](https://dev.qweather.com/docs/api/) 实用资料与条款相关章节。

---

## 4. 最佳实践清单

### 和风

- 启用 **Gzip**、对「同一 LocationID + 同一 date」结果做 **短 TTL 缓存**，减轻配额压力（文档：[处理 Gzip](https://dev.qweather.com/docs/api/)、[缓存你的数据](https://dev.qweather.com/docs/api/)）。
- **不要假设**：先 Geo 再查天气；处理空结果与非 200 `code`。
- **安全**：JWT 仅服务端；参考 [安全指南](https://dev.qweather.com/docs/api/)。

### Next.js

- Route Handler 或 Server Action 作为 BFF；**永不**将 `QWEATHER_TOKEN`、`DEEPSEEK_API_KEY` 下发到浏览器。
- 对外部请求设置 **超时** 与 **并发上限**（避免 10 路请求同时打满连接）。

### DeepSeek

- 提示词中约束：**语气、每句长度、勿与给定气象事实矛盾**。
- 解析失败必须有 **fallback**。

---

## 5. 下一步（实现门禁）

落地代码前确认：

- 评语是否必须 LLM；是否固定使用 Route Handler（或改为 Server Action）。
- 和风控制台 **API Host** 与 **JWT** 已在本地 `.env.local` 配置。

实施时可从「单 API：`POST /api/weather-history` body: `{ city, adm? }`」开始，返回 10 日聚合数据 + 评语数组。

---

## 6. 参考链接

- [和风天气 — 开发文档总览](https://dev.qweather.com/docs/api/)
- [城市搜索](https://dev.qweather.com/docs/api/geoapi/city-lookup/)
- [天气时光机](https://dev.qweather.com/docs/api/time-machine/time-machine-weather/)
- DeepSeek：OpenAI 兼容 Chat Completions API（以官方最新文档为准）
