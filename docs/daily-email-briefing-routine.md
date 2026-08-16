# 每日財經簡報寄信到 Email（Claude Routine 設定）

這份文件說明如何讓 Claude **每天自動**把當日全球財經簡報寄到你的信箱，
**完全不需要任何 API 金鑰或 GitHub secret** —— 由 Claude 自己上網蒐集新聞、
消化成簡報，再透過 Gmail 連結器寄出。

## 為什麼不用網站的新聞 pipeline？

網站的每日新聞（`briefings.json`）需要外部 LLM 才能把 RSS 原文整理成分級新聞，
在雲端排程環境已停止更新。這個 Routine 改由 **Claude 本身**擔任那個 LLM 角色，
所以不需要 `GEMINI_API_KEY`、不需要付費 API，也不受該 pipeline 卡關影響。

## 一次性設定（約 1 分鐘）

Routine 無法從「Claude Code on the web」的工作階段內建立，
必須在網頁 UI 或終端機 CLI 建立：

1. 打開 <https://claude.ai/code/routines> → 點 **New routine**。
2. **Name**：`每日財經簡報寄信`
3. **Prompt / Instructions**：貼上下方「Routine 提示詞」整段。
4. **Repositories**：選 `news-dashboard`（隨意選一個即可，本任務其實用不到 repo）。
5. **Environment**：用 **Default**（Trusted 即可 —— Gmail 連結器的流量走 Anthropic
   伺服器，不受網路白名單限制）。
6. **Connectors**：保留 **Gmail**，其餘可移除以縮小權限。
7. **Trigger**：選 **Schedule → Daily**，時間設為你想收信的時間（例如早上 07:00，
   台北時區會自動換算）。
8. **Model**：選一個較強的模型以確保研判品質。
9. 點 **Create**。可先按 **Run now** 測試，馬上會收到一封信。

之後每天到點就會自動寄出，瀏覽器關著也照跑。若要暫停／修改時間／改內容，
回到同一頁編輯即可。

> CLI 替代做法：在終端機（非 web 工作階段）執行
> `/schedule 每天早上 7 點把當日財經簡報寄到我的信箱`，Claude 會逐步問完並建立。

## Routine 提示詞（原封不動貼上）

```
執行每日財經簡報並寄到我的信箱。步驟：

1. 用 WebSearch 蒐集「今天」最新的全球財經新聞與行情，涵蓋：美股（S&P 500、
   Nasdaq、道瓊）當日走勢與驅動因素；美國 10 年期公債殖利率與 Fed 升/降息預期
   （CME FedWatch）；台股（加權指數、台積電 2330、外資買賣超）；加密貨幣
   （BTC、ETH 價格與重大消息）；以及 1–2 則重大總體經濟或科技/AI 頭條。
   盡量取得最新一個交易日的數字。

2. 把資料消化成資訊，用繁體中文整理：今日核心研判（一段話，串起訊號、點出背離
   或共振、給判斷而非只列數字）；市場快照（條列關鍵數字）；重點新聞 3–5 則，
   每則含分級（🔴/🟠/🟡）、類別、標題、意義、觀察點。語氣白話有觀點，結尾註明
   「僅供參考，非投資建議」。

3. 用 Gmail 的 send_message 工具寄到 liuaaron1128@gmail.com，主旨
   「📊 每日財經簡報 — YYYY/MM/DD」（今天日期），用乾淨的 HTML 卡片排版
   （深色標題列、核心研判方框、市場快照表格、分級新聞區塊），同時附純文字 body
   作為 fallback。若 Gmail 工具不可用，請直接回報，不要靜默結束。
```

## 備註

- 收件人固定為 `liuaaron1128@gmail.com`，要改寄件對象或時間，直接改 Routine 設定。
- Routine 的用量計入你的 claude.ai 訂閱額度（每日有 routine 執行次數上限）。
- 這封信是獨立的 email 管道，與網站（Vercel）畫面上的新聞是否更新無關。
