import type { MetricsHistoryEntry, MetricsHistoryTimeframe } from '#shared/types/metrics-history'
// 期別列的標籤。伺服器與瀏覽器跑出來一模一樣（不用 Date、不做 locale 格式化），所以伺服器輸出的表格文字就是 hydration 的結果。

// 全站唯一一組期別用詞。2026-10-02 之前有三組：這一組、metric-history-points.ts 的
//「近四季合計／單季／會計年度」、以及 StockMetricHistoryChartInteractive.vue 自己的一份
//（跟這一組一字不差）。
//
// **合併方向是由正確性決定的，不是多數決。** 那一組的「近四季合計」對比率型指標是錯的：
// ROE 的近四季是「近四季淨利 ÷ 平均股東權益」，不是四季 ROE 相加，而指標頁絕大多數是比率。
// 它渲染出來就是「以下為 台積電 由新到舊的 股東權益報酬率（近四季合計）」。
//「近四季」對流量型與比率型都成立，所以留這一組。
//
//「年度」而不是「會計年度」：台股上市櫃公司幾乎全是曆年制，而本站的讀者是退休族，平白的詞優先。
// **使用者 2026-10-02 確認「用 年度 就好」**，所以這不是待決定事項。
//
// 同日的一個量測更正，寫在這裡是因為它決定了上面那段的強度：我原本說「合併前兩種詞彙同時渲染在
// 同一頁上」——那是錯的。我用 `curl | grep` 數原始 HTML，而那裡面包含 SSR 序列化的指標型錄
// payload（analysis-ts 自己的 definition／limitations 文案裡有「會計年度」，屬於別的指標）。
// 用瀏覽器量 `document.body.innerText` 之後：`會計年度` 在任何指標頁上都是 **0 次**。
//
// 所以 FY 那個分支在渲染輸出裡確實到不了畫面（我 2026-10-01 的筆記本來就是對的，是我隔天拿壞的
// 量測去「更正」它）。**但這一組合併仍然該做**，理由不變且與 FY 無關：「近四季合計」是真的渲染出來
// 的（每個比率頁 2 次，caption 與開頭那一句），而它對比率是錯的。
//
// 教訓：`curl | grep` 數的是 payload，不是畫面。要主張「讀者看得到」就得量 innerText。
// 期別標籤：shared/utils/timeframe-labels.ts 的 TIMEFRAME_LABELS（2026-10-11 起全站一份）。

export function periodLabel(entry: Pick<MetricsHistoryEntry, 'fiscalYear' | 'fiscalQuarter'>, timeframe: MetricsHistoryTimeframe): string {
  return timeframe === 'FY' ? `${entry.fiscalYear} 年` : (entry.fiscalQuarter === null ? `${entry.fiscalYear} 年` : `${entry.fiscalYear} Q${entry.fiscalQuarter}`)
}
