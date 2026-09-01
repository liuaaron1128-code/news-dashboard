# 每日簡報：更新網站 ＋ 寄信（Claude Routine 設定）

讓 Claude 每天自動產出「全球財經 + 商業世界」深度簡報，**同時**：

1. 寫進 `src/data/briefings.json` → commit → push → Vercel 自動部署
   → 網站每日更新，日期選擇器可翻閱歷史
2. 寄一份到信箱（推播）

**完全不需要任何 API 金鑰或 GitHub secret** —— 由 Claude 自己上網蒐集、消化成洞察。

## 為什麼不用原本的 pipeline？

原本 `scripts/fetch-briefing.mjs` 需要外部 LLM 把 RSS 原文整理成分級新聞，
金鑰未設定，自 2026-07-30 起停止更新。這個 Routine 改由 **Claude 本身**
擔任那個 LLM 角色，所以不受該 pipeline 卡關影響。

該腳本與 `fetch-business.mjs`、`fetch-leads.mjs`、`generate-commentary.mjs`
已於 2026-09-01 刪除（無 workflow 呼叫、且都需要不會設定的金鑰）。
需要時可從 git 歷史取回：`git log --diff-filter=D -- scripts/`。

## 兩條自動化路徑，擇一或並用

| | **A. Claude Routine** | **B. GitHub Actions**（已建好） |
|---|---|---|
| 更新網站 | ✅ | ✅ |
| 寄信到信箱 | ✅ | ❌ runner 上沒有 Gmail 連結器 |
| 需要的憑證 | 無 | `CLAUDE_CODE_OAUTH_TOKEN` 一個 secret |
| 那是付費 API 金鑰嗎 | — | **不是**，用你現有的 Claude 訂閱認證 |
| 誰能建 | **只有你**（web session 內無法建立） | 已寫好並提交，你只要加 secret |
| 檔案 | 本文件的提示詞 | `.github/workflows/daily-briefing.yml` |

**路徑 B 的一次性設定**：

1. 在本機終端機執行 `claude setup-token`，複製產生的 token
   （這是用你的 Claude 訂閱換的長效 token，不是 Console 的付費 API key）
2. 到 GitHub repo → Settings → Secrets and variables → Actions → New secret
3. 名稱填 `CLAUDE_CODE_OAUTH_TOKEN`，值貼上剛才的 token
4. 到 Actions 分頁 → Daily briefing → **Run workflow** 測試一次

之後每天 05:20（台北）自動跑，寫進 `briefings.json` 並推上 main，Vercel 自動部署。

> 排程只會從預設分支執行，所以這個 workflow 必須在 `main` 上才會生效。
> 若想同時要 email，再依下面步驟建 Routine —— 兩者可並用，但要避免同一天
> 各寫一次（Routine 的提示詞已要求「同日期覆蓋，不新增重複」，所以安全）。

## 三個管道各自的角色

| 用途 | 位置 | 說明 |
|---|---|---|
| 每日查看 ＋ 翻閱歷史 | **網站** | `page.tsx` 已有日期選擇器與前後箭頭；git 歷史即永久紀錄 |
| 每日推播 | **Email** | 主動送到手邊 |
| 單篇特別深的報告 | Artifact | 同一連結會覆蓋，**不適合當歷史紀錄** |

## 一次性設定（約 1 分鐘）

Routine 無法從「Claude Code on the web」的工作階段內建立，須在網頁 UI 或 CLI 建立：

1. 開 <https://claude.ai/code/routines> → **New routine**
2. **Name**：`每日財經簡報`
3. **Prompt**：貼上下方整段提示詞
4. **Repositories**：選 `news-dashboard`（**必要** —— 要寫回 briefings.json）
5. **Environment**：**Default**（Trusted 即可；Gmail 連結器流量走 Anthropic 伺服器）
6. **Connectors**：保留 **Gmail**
7. **Trigger**：**Schedule → Daily**，設定收信時間（台北時區自動換算）
8. **Model**：選最強的 —— 這份簡報的價值全在研判品質
9. **Create**，可先 **Run now** 測試

> CLI 替代做法：在終端機（非 web 工作階段）執行 `/schedule`。

### ⚠ 關於推送分支

Vercel 從 **main** 部署，但 Routine 推 main 可能被擋
（Claude Code 會檢查：分支受保護、或分支上有他人的 commit 就拒絕；
本 repo main 上有 `github-actions[bot]` 的 commit）。

提示詞已寫成：**先試 main，被擋就改推 `claude/daily-briefing` 並在結尾明講**。
若經常被擋，兩個解法擇一：把 Vercel 的 Production Branch 改成該分支，
或在 GitHub 設定該分支對 main 的 auto-merge。

---

## Routine 提示詞（原封不動貼上）

```
每日深度財經簡報。兩個產出：更新網站資料 + 寄信到 liuaaron1128@gmail.com。

【1 確認日期】
先用 bash date 確認今天日期（台北時區）。絕對不要從搜尋結果推斷日期。

【2 蒐集資料】用 WebSearch。來源母體見 repo 的 src/data/sources.json
（198 個網站，已分好地區／來源類型／資訊類型／更新節奏）。

A. 地區 —— 七區都要掃過，不可只做美國與台灣
   台灣 40｜其他亞太 40（韓國、星、印、東南亞）｜美國 28｜全球 26
   ｜日本 23｜歐洲 21｜中國 20
   ※ 韓國（The Elec／BusinessKorea／KED Global）對半導體與記憶體的
     利潤流向特別關鍵，勿略過。

B. 六大資訊類型 —— 每類至少查一輪
   財經市場 51｜綜合新聞 48｜數據／研究／揭露 36｜政經政策 35
   ｜經濟學家觀點 17｜產業情報 11
   ※ 政經政策涵蓋 Fed／日銀／ECB／人行。
   ※ 經濟學家觀點要具名引用（El-Erian、Martin Wolf、Krugman、Roubini、
     Rogoff、Richard Koo、林毅夫、Raghuram Rajan 等）。
   ※ 產業情報用 DIGITIMES、科技新報、The Elec、日經 Cross Tech。

C. 商業世界（至少佔一半篇幅）
   併購與資本動向｜企業 AI 落地（導入數據、ROI、失敗率、案例）
   ｜創投與新創募資｜產業與供應鏈｜重要財報與經營動態

D. 主題檢查清單 —— 逐項確認，沒有進展就寫「今日無」
   □ 能源與地緣政治（油價、荷姆茲、戰事）── 常是通膨與央行動作的共同上游
   □ 各國央行　□ 匯率（台幣、日圓、美元指數）
   □ 關稅與供應鏈重配置（Section 301、越南／印度／墨西哥）
   □ 台灣在地限制（電力與併網、缺工、法規、房市與內需）
   □ 記憶體與關鍵料件價格　□ 併購與私募退場
   □ 企業 AI 落地與 ROI　□ 創投募資動向

【3 第二輪追查關聯】不可只做一輪。
針對每條重要線索再搜尋一次：查背景、當事人、上下游影響、與其他線索的關聯。
目標是找出「影響鏈」，不是彼此無關的新聞清單。
例：記憶體漲價 → 誰在賺（韓廠財報）→ 誰在付（台廠毛利率）
→ 何時完全反映（合約交貨時間差）。

【4 找共同上游】
把線索排在一起問：這些事有沒有共同的原因？
不要把同一件事的多個下游反應當成多件事報。
（實例：Fed／日銀／ECB 同時轉鷹看似三件事，但三家都點名能源 ——
  上游其實是中東戰爭造成的石油供給衝擊。）

【5 寫成決策簡報，不是研究報告】繁體中文，讀者是企業董事長。
分層，讓他 10 秒／1 分鐘／10 分鐘各能停在一個完整層次：
  第 1 層｜結論：3 句話，每句一個完整判斷。
  第 2 層｜關鍵數字：4 個，大字，附前值與意義。
  第 3 層｜決策：3 個，各有明確期限與「為什麼是現在」。放前段，不可埋在最後。
  第 4 層｜影響地圖：從上游根源畫到「你的損益表」。
  第 5 層｜深度分析：分主軸展開，每個主軸結尾要有「所以呢」。
  第 6 層｜追蹤：本週要盯的數字，標出最優先那一個。

要求：
- 核心研判要指出「市場共識是什麼、我認為哪裡想錯了」。
- 數字同口徑才並列；不同口徑改用衍生比率
  （例：獲利增速 ÷ 營收增速，>1 毛利擴張、<1 毛利被侵蝕）。
- 每個主軸都要回答「對你的意涵」，不能只描述事件。
- 推算的數字標註「本站計算」；取不到最新值就標註資料所屬期間。
- 找不到某塊資料時明說「今日無重大進展」，不要編造。

【6 寫回網站】把當日內容寫進 src/data/briefings.json（陣列第一筆，最新在前）。
schema 見 src/types/news.ts，務必完全符合，否則 next build 會失敗：

  date: "YYYY-MM-DD"　weekday: "週一".."週日"　sourceCount: number
  coreJudgment: string（一段完整研判）
  marketSnapshot: [{ label, value, change, positive: true|false|null }]
  news: [{ id: "YYYY-MM-DD-001", grade: "🔴"|"🟠"|"🟡",
      category: 宏觀政策|地緣政治|市場動態|AI科技|台灣政策|加密貨幣|房地產|客戶產業,
      title, background?, what, meaning, business, investment,
      triggers?: string[], watchpoints?: string[], sources: string[] }]
  weeklyEvents: [{ date, event, meaning }]

  ※ grade 與 category 只能用上列值，用別的會編譯失敗。
  ※ 同日期已存在就覆蓋該筆，不要新增重複日期。

同時更新另外兩個檔案，否則首頁最上方會顯示過期內容：

  src/data/commentary.json —— 首頁最上方的「AI 每日解讀」。
    { date, generatedAt, model, headline, topConcern,
      bullets: string[3-4], crossSignals: string[0-3],
      confidence: "high"|"medium"|"low" }
    ※ date 必須是今天。超過 2 天畫面會自動標示為過期。

  src/data/events.json —— 總經行事曆，只放<未來>事件。
    [{ date, title,
       region: 美國|台灣|全球|歐元區|中國|日本,
       importance: "high"|"medium"|"low", note? }]
    ※ 已過期的事件要移除；日期若為推估請在 note 標「預定日期」。

寫完後執行 `npx next build` 確認編譯通過（TypeScript 會驗證型別）。
通過才 commit。commit message 用繁體中文說明當日重點。

推送：先試 `git push origin HEAD:main`。
若被拒（分支保護或含他人 commit），改推 `claude/daily-briefing`
並在最後的回報中明確說明「已推到 X 分支，需要合併才會上線」。

【7 寄信】用 Gmail 的 send_message 寄到 liuaaron1128@gmail.com：
- 主旨：📊 每日財經簡報 — YYYY/MM/DD（週X）｜<當日最關鍵的一句話>
- HTML 卡片排版（深色標題列、結論區、關鍵數字、三個決策、主軸、追蹤），
  同時提供純文字 body 作為 fallback。
- 信末附上網站連結 https://news-dashboard-nu-six.vercel.app
若 Gmail 工具不可用，直接回報，不要靜默結束。

【8 回報】結尾說明：寫進了哪一天、推到哪個分支、信寄出了沒。
```

---

## 品質準則（寫給執行這份任務的 Claude）

- **先查日期再查新聞。** 曾發生從搜尋結果推斷日期、寄出兩週前行情的錯誤。
- **一定要做第二輪追查。** 只做一輪的產出是新聞摘要，不是情報。
- **找共同上游。** 三個現象若共用一個原因，就該當一件事報。
- **覆蓋七大地區。** 只做美＋台會漏掉關鍵線索（記憶體利潤流向要看韓國財報）。
- **決策放前面。** 讀者要先看到「要做什麼」，再看「為什麼」。
- **數字要能比較。** 不同口徑不要並列，改用衍生比率或明確標註差異。
- **圖表尺度要合理。** 一根長條把其他壓成看不見時，改用獨立數字塊。
- **build 過了才 commit。** grade／category 用錯值會讓整個網站編譯失敗。
- **價值在研判不在轉述。** 每則都要回答「所以呢？對我有什麼影響？」
- **商業內容不可被行情擠掉。** 董事長要的是經營決策情報，不只是盤勢。

## 目前無人維護的兩個分頁

`market-signals.yml` 原本還有 `fetch-business.mjs` 與 `fetch-leads.mjs` 兩步，
同樣因 GitHub Models 退役而每天靜默失敗，已從 workflow 移除，腳本亦已刪除。

因此 **商業摘要（business.json）與 leads（leads.json）不再更新**，
停在 2026-07-30。兩者的元件都會在畫面上顯示自己的 `asOf` 日期，
所以不會誤導讀者，但內容確實是舊的。

若要一併恢復，把它們加進上面第 6 步的寫回清單即可
（schema 見 `src/types/`）。目前刻意不加，是為了讓每日 Routine 保持
單一焦點、不要因為範圍過大而降低研判品質。

## 備註

- 收件人固定為 `liuaaron1128@gmail.com`；要改對象或時間，直接改 Routine 設定。
- Routine 用量計入 claude.ai 訂閱額度（每日有 routine 執行次數上限）。
- 網站：<https://news-dashboard-nu-six.vercel.app>
