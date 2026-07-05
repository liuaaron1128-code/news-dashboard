# AI 簡報自動生成器 — 設計文件

> 目標：提供一份**模板**與**原始資料**，系統依你的既有風格與設計，自動編排生成一份可互動的網頁簡報，並可匯出 PDF 與 PPTX。
>
> 定位：**通用簡報生成器**（不限主題）＋ **AI 自動編排**（我貼資料，AI 分頁、選版面、寫標題重點）。
>
> 本文件為設計藍圖，尚未寫入正式程式碼。實作時務必先閱讀 `node_modules/next/dist/docs/`（本專案的 Next.js 有破壞性變更，見 `AGENTS.md`）。

---

## 1. 設計原則

1. **單一事實來源（Deck Spec）**：AI 只負責產出一份結構化 JSON（`Deck`），三種輸出（網頁／PDF／PPTX）都從這份 JSON 渲染。AI 與排版徹底解耦。
2. **沿用既有設計系統**：主題 token 直接對應現有 `globals.css` 與元件用色（slate/blue/indigo/emerald/orange/amber、`rounded-xl`、`shadow-sm`、卡片式版面、繁體中文、emoji 標題）。生成的簡報「一看就是你的風格」。
3. **版面即合約**：模板定義一組允許的「版面（layout）」。AI 只能從這組版面中挑選並填內容，確保產出永遠符合設計規範、不會排版走鐘。
4. **優雅降級**：AI 呼叫失敗時保留可用草稿，沿用現有 `generate-commentary.mjs` 的容錯精神（失敗不中斷、保留前一版）。
5. **與現有資料流一致**：資料以 JSON 檔存放、由 React 元件渲染，與 `src/data/*.json` + `src/components/*` 的既有模式相同。

---

## 2. 系統架構

```
┌─────────────┐   ┌──────────────────┐   ┌─────────────┐   ┌──────────────┐
│ 輸入層       │──▶│ AI 編排層         │──▶│ Deck Spec    │──▶│ 渲染 / 匯出層 │
│ Input        │   │ Orchestration     │   │ (JSON, SoT)  │   │ Render/Export │
└─────────────┘   └──────────────────┘   └─────────────┘   └──────────────┘
  貼文字/上傳        大綱→分頁→填內容         單一結構化中介       網頁投影片
  選模板             結構化輸出+驗證修復        (見 §4 schema)      PDF / PPTX
  (可選)接資料庫
```

- **輸入層**：貼上文字、上傳檔案（`.md`/`.txt`/`.csv`/`.json`，第二階段加 `.pdf`/`.xlsx`）、或一鍵匯入現有 dashboard 資料（`briefings.json` 等）。
- **AI 編排層**：三步管線（大綱 → 逐頁填內容 → 驗證修復），輸出符合 `Deck` schema 的 JSON。詳見 §5。
- **Deck Spec**：唯一中介表示，解耦 AI 與渲染。詳見 §4。
- **渲染／匯出層**：同一份 `Deck` 驅動三種輸出。詳見 §6。

---

## 3. 技術選型（與現有專案一致）

| 面向 | 選擇 | 理由 |
|---|---|---|
| 框架 | Next.js 16 + React 19（現有） | 沿用現有 app router 架構 |
| 樣式 | Tailwind CSS v4（現有） | 直接沿用設計 token |
| 圖示 | `lucide-react`（現有） | 一致的圖示語彙 |
| 網頁投影片引擎 | **自製輕量元件**（非引入 reveal.js） | 完全掌控版面＝完全還原你的設計；避免重樣式覆蓋 |
| 圖表 | 內嵌 SVG（沿用現有 `Sparkline.tsx` 思路），第二階段可加 Recharts | 與現有極簡風一致、無外部相依 |
| AI | **Claude `claude-opus-4-8`**（結構化輸出）為主；沿用現有 **GitHub Models** 為省成本備援 | 見 §5.4；`ANTHROPIC_API_KEY` 已存在於 CI |
| PDF 匯出 | 列印樣式（`@media print`）→ 瀏覽器列印；伺服器端可選 Playwright（環境已內建 Chromium） | 零額外相依；需要無頭產檔時用 Playwright |
| PPTX 匯出 | `pptxgenjs`（伺服器端 route handler） | 業界標準、純 JS、可對應每個版面 |

> 註：環境已預裝 Chromium 且 Playwright 已設定（見系統說明），伺服器端 PDF 匯出可直接使用，不要執行 `playwright install`。

---

## 4. Deck Spec（單一事實來源）

一份簡報是一個 `Deck`；每一頁是一個以 `layout` 為判別式的聯集型別（discriminated union）。AI 產出、三種渲染器消費，都以此為準。

```ts
// src/types/deck.ts（設計草案）

export interface Deck {
  meta: {
    title: string
    subtitle?: string
    author?: string        // 預設「董事長 AI 助理」
    date?: string          // ISO
    theme: ThemeName        // 見 §7
    templateId: string      // 使用的模板
  }
  slides: Slide[]
}

export type ThemeName = 'executive' | 'briefing' | 'minimal'

// 版面聯集 —— 模板決定 AI 可用哪些
export type Slide =
  | CoverSlide
  | AgendaSlide
  | SectionSlide
  | BulletsSlide
  | TwoColumnSlide
  | KpiGridSlide
  | ChartSlide
  | QuoteSlide
  | TimelineSlide
  | ClosingSlide

interface Base { id: string; notes?: string }   // notes = 講者備註

export interface CoverSlide extends Base {
  layout: 'cover'
  title: string; subtitle?: string; eyebrow?: string  // eyebrow 如「2026 Q2 營運簡報」
}
export interface AgendaSlide extends Base {
  layout: 'agenda'; title: string; items: string[]
}
export interface SectionSlide extends Base {
  layout: 'section'; index?: string; title: string; subtitle?: string
}
export interface BulletsSlide extends Base {
  layout: 'bullets'; title: string
  points: { text: string; emphasis?: boolean; sub?: string[] }[]
  takeaway?: string   // 底部一句結論（沿用「今日核心判斷」風格）
}
export interface TwoColumnSlide extends Base {
  layout: 'two-column'; title: string
  left:  { heading: string; points: string[] }
  right: { heading: string; points: string[] }
}
export interface KpiGridSlide extends Base {
  layout: 'kpi-grid'; title: string
  kpis: { label: string; value: string; delta?: string; positive?: boolean | null }[]
}
export interface ChartSlide extends Base {
  layout: 'chart'; title: string
  chart: {
    type: 'bar' | 'line' | 'pie'
    series: { name: string; data: number[] }[]
    categories: string[]
  }
  caption?: string
}
export interface QuoteSlide extends Base {
  layout: 'quote'; quote: string; attribution?: string
}
export interface TimelineSlide extends Base {
  layout: 'timeline'; title: string
  events: { date: string; title: string; detail?: string }[]
}
export interface ClosingSlide extends Base {
  layout: 'closing'; title: string; subtitle?: string; contact?: string
}
```

**為什麼用聯集型別**：AI 只要在每頁填一個 `layout` 值與對應欄位；渲染器與 PPTX 匯出各自對每種 `layout` 寫一個對應函式。新增版面＝加一個型別＋三個渲染分支，可持續擴充。

---

## 5. AI 編排層

### 5.1 管線（三步）

```
原始資料 ──▶ [1 大綱] ──▶ [2 逐頁填內容] ──▶ [3 驗證/修復] ──▶ Deck JSON
           產生有序的         對每頁以結構化          用 schema 驗證，
           章節+建議版面        輸出填滿欄位            失敗自動重試修復
```

1. **大綱（Outline）**：LLM 讀原始資料，輸出「章節清單＋每章建議 `layout`＋一句主旨」。控制敘事節奏（避免整份都是條列頁）。
2. **逐頁填內容（Fill）**：對每一章，LLM 以**結構化輸出**產出符合該 `layout` 欄位的內容，語氣為你的既有風格（沉穩、有觀點、白話、可行動；非投資建議的免責同 `generate-commentary.mjs`）。
3. **驗證／修復（Validate）**：以 schema 驗證。用 Claude 的 `strict: true` 工具或 `output_config.format` 強制結構，模型不合規時自動重試。

> 可先做「單次生成」版本（一次呼叫產整份 `Deck`）快速上線，再演進到三步管線以提升長簡報品質。

### 5.2 為什麼 AI 只輸出 Deck JSON

把 AI 侷限在「填結構化 JSON」而非「產 HTML/PPT」，換來：可驗證、可預測、風格永遠一致、三種輸出共用同一份內容。

### 5.3 模型與結構化輸出（實作要點）

- 預設模型：**`claude-opus-4-8`**。
- **強制結構**：用 `output_config.format` 帶 `json_schema`（`Deck` schema），或對「填內容」步驟用 `strict: true` 工具。避免用已淘汰的 assistant prefill（4.8 會 400）。
- **思考**：`thinking: { type: 'adaptive' }`；`output_config: { effort: 'high' }`。
- **大輸出**：整份長簡報用 streaming（`max_tokens` 給足，見 SDK 指南）。
- **省成本備援**：沿用現有 **GitHub Models**（`gpt-4o-mini`、免費、用 `GITHUB_TOKEN`）跑「大綱」等輕量步驟；「填內容」用 Claude 提升品質。以環境變數切換，與現有 `generate-commentary.mjs` 一致。
- **容錯**：任何步驟失敗 → 保留上一版草稿、回傳可用結果，永不讓流程崩潰。

### 5.4 提示詞骨架（示意）

```
系統：你是一位資深簡報顧問，為企業董事長製作簡報。依提供的「模板可用版面」與「原始資料」，
      用繁體中文編排一份結構清晰、有觀點、白話可行動的簡報。沿用沉穩專業語氣。
      只輸出符合 Deck JSON schema 的物件，不要多餘文字。
使用者：模板版面清單：<layouts>；主題：<theme>；原始資料：<raw>。請產出 Deck。
```

---

## 6. 渲染與匯出

### 6.1 網頁互動投影片（主要輸出）

- 自製 `<SlideRenderer deck={deck} />`：依 `slide.layout` 分派到對應版面元件，全部用現有 Tailwind class 與用色。
- 操作：← → 翻頁、`F` 全螢幕、`O` 縮圖總覽、`S` 講者備註、網址帶 `#3` 深連結到第 3 頁。
- 響應式：桌機 16:9 舞台置中，手機自動堆疊（與現有 mobile-first 一致）。
- 可分享連結（`/deck/[id]`）。

### 6.2 PDF 匯出

- 首選：`@media print` 列印樣式，每頁 `break-after: page`，使用者瀏覽器列印成 PDF（零相依）。
- 需伺服器產檔時：route handler 用 **Playwright（環境內建 Chromium）** 對列印視圖無頭截頁成 PDF。

### 6.3 PPTX 匯出

- route handler：`GET /api/deck/[id]/pptx`，用 **`pptxgenjs`** 把每個 `layout` 對應成一張投影片（標題、色塊、KPI 卡、圖表）。
- 主題色與字級從同一套 theme token 取得，確保與網頁一致。

---

## 7. 主題（Theme）— 對應你的既有設計

以 token 集中管理，直接取自現有 `globals.css` 與元件：

```ts
// 三種輸出共用
export const themes = {
  executive: {
    bg: '#F1F5F9',        // slate-100（現有 --background）
    surface: '#FFFFFF',
    ink: '#0F172A',        // slate-900（現有 --foreground）
    muted: '#64748B',      // slate-500
    accent: '#2563EB',     // blue-600（現有主色）
    accent2: '#4F46E5',    // indigo-600
    good: '#059669',       // emerald-600
    warn: '#EA580C',       // orange-600
    radius: 12,            // rounded-xl
    font: 'var(--font-geist-sans)',
  },
  // briefing / minimal 為變體
}
```

- 視覺語彙沿用：白卡片 + `border-slate-200` + `shadow-sm`、emoji 標題、KPI 用 emerald/orange 表漲跌（同 `MarketSnapshot`）、重點列用 `▍` 前綴（同 `MorningCard`）。

---

## 8. 使用流程（UX）

1. `/generate`：選模板 → 貼資料或上傳 → 選主題 →「生成」。
2. 進度：大綱 → 逐頁 →（串流即時預覽）。
3. `/deck/[id]`：互動預覽；每頁可**拖拉重排、就地編輯**（第二階段，對應「AI 起草＋手動微調」）。
4. 匯出：分享連結 / 下載 PDF / 下載 PPTX。

---

## 9. 檔案結構（規劃）

```
src/
  types/deck.ts                     # Deck / Slide 型別（§4）
  lib/
    theme.ts                        # theme token（§7）
    deckSchema.ts                   # JSON schema（給 AI 強制結構＋驗證）
    generateDeck.ts                 # AI 三步管線（§5）
  components/deck/
    SlideRenderer.tsx               # 依 layout 分派
    layouts/ (CoverSlide.tsx ...)   # 各版面元件（沿用現有 class）
    DeckNav.tsx                     # 翻頁/縮圖/備註
  app/
    generate/page.tsx               # 輸入 UI
    deck/[id]/page.tsx              # 互動預覽
    api/generate/route.ts           # 呼叫 AI 管線
    api/deck/[id]/pptx/route.ts     # PPTX 匯出
    api/deck/[id]/pdf/route.ts      # (可選) Playwright PDF
  data/decks/*.json                 # 產出的 Deck（沿用 JSON 存放慣例）
scripts/
  generate-deck.mjs                 # (可選) CI/CLI 批次生成，比照現有 scripts
```

---

## 10. 分階段落地（Roadmap）

**第一階段（MVP，可展示）**
- `Deck` 型別 + 3–4 個核心版面（cover / bullets / kpi-grid / section）。
- 網頁 `SlideRenderer` + 翻頁，完全套用既有設計。
- 「貼文字 → 單次 AI 呼叫 → 產 Deck → 網頁預覽」。
- PDF 走列印樣式。

**第二階段**
- 補齊全部版面 + SVG 圖表。
- AI 三步管線 + 串流預覽。
- PPTX 匯出（`pptxgenjs`）。
- 一鍵匯入現有 dashboard 資料。

**第三階段**
- 就地拖拉編輯（AI 起草＋手動微調）。
- 檔案上傳（PDF/XLSX 解析）。
- 模板編輯器（自訂版面組合與主題）。
- 伺服器端 Playwright PDF。

---

## 11. 待你確認的取捨（可後續調整）

- 模板是「固定幾套」還是「可自訂編輯」？MVP 建議先固定 2–3 套。
- 圖表資料是否要 AI 從原文抽數字，還是一律由你提供結構化數據？MVP 建議由你提供，避免 AI 讀錯數字。
- 是否要把生成器內建進 `news-dashboard`（多一個分頁/路由），或獨立成新專案？本設計預設**內建**以最大化重用現有設計系統。
