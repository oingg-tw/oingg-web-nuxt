// 全站數字格式化（2026-10-12 從 app/utils/format-significant-digits.ts 與 stock-answers.ts 搬來合併）。放 shared/utils：伺服器與頁面都自動
// 匯入，而且零 import，scripts/check-number-format.mjs 可以直接 import 來驗。
//
// 2026-10-12 使用者在 7711 看到「不動產廠房及設備 0 億元（0.2%）」：各頁自己把千元換成整數億元，小公司全變 0。規則統一成：
//   - 金額：自動萬／億／兆＋4 位有效數字（formatMoney）——沿用 2026-09-11「市值請保留有效數字 4 位元」
//   - 指標數值：4 位有效數字（原本 3 位，EPS 86.27 印成 86.3）
//   - 千分位一律走 groupThousands，不用 toLocaleString

// Thousands separators without toLocaleString（deterministic across runtimes）.
// 全站唯一一份千分位分組。2026-10-02 之前有四份（這一份、format-significant-digits 的區域版、formatStatementAmount 內嵌的四行、
// SharedMetricTable 的 addThousandSeparators）。都用同一個 `\B(?=(\d{3})+(?!\d))` lookahead；`-` 與第一個數字之間本來就是
// word boundary，所以負數不必另外剝負號。掃 30 個輸入比對過，唯一差異是 `"1234."` 這種尾點輸入，呼叫端都到不了。
//
// 刻意不用 `toLocaleString('zh-TW')`：它的輸出取決於 Node 的 ICU 建置，SSR 與瀏覽器可能不同
// （見 financial-statement-rows.ts 的 formatStatementAmount 註解，那是一個修過的真 bug）。
export function groupThousands(value: number | string): string {
  const [integer, fraction] = String(value).split('.')
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

// 對數軸的刻度標籤（河流圖的股價軸、/macro/[slug]；2026-10-24 從 app/utils/log-axis-tick.ts 搬來，check-number-format 測得到）。ECharts 的
// log 軸把刻度放在 LOG 空間的整齊位置上，標籤會長成 398.1…、5011.87… 這種像雜訊的數字；取兩位有效數字（400、5,000），位移遠小於 1%。
// 用 toPrecision，不用「÷ 單位、四捨五入、× 單位」：十元以下單位是 0.1，73 × 0.1 是 7.300000000000001（使用者：「stock/2543 股價淨值比
// 圖表 出現了 7.30000000000001 這種數字」）。不用 formatSignificantDigits：1e4 以上會換成萬／億，加權指數 20,000 會變「2萬」；千分位要
export function formatLogAxisTick(value: number): string {
  return value > 0 ? groupThousands(Number(value.toPrecision(2))) : ''
}

// 有效位數四捨五入＋萬／億／兆縮寫（2026-09-11 抽出，徽章 chip 與篩選器市值欄共用）。toPrecision 不是 toFixed——葛拉漢數 693.89
// 取 3 位是 "694"，不是再多兩位小數。超過門檻用台灣財報真的在用的縮寫，遞迴對縮小後的數再做同樣的有效位數四捨五入。
// 「萬」這一級 2026-10-12 補上：原本 1e4～1e8 之間印原始整數，篩選器同一欄會出現「56,780,000」跟「5.678億」並排。
export function formatSignificantDigits(value: number, digits: number): string {
  const rounded = Number(value.toPrecision(digits))
  const magnitude = Math.abs(rounded)
  if (magnitude >= 1e12) return `${formatSignificantDigits(rounded / 1e12, digits)}兆`
  if (magnitude >= 1e8) return `${formatSignificantDigits(rounded / 1e8, digits)}億`
  if (magnitude >= 1e4) return `${formatSignificantDigits(rounded / 1e4, digits)}萬`
  // `|| 0`：把 -0 印成 0（小的負數四捨五入到 0 時，toString 會給 "0"，但上游運算可能留下 -0）
  return groupThousands((rounded || 0).toString())
}

// 金額（元）：自動萬／億／兆＋4 位有效數字。320.5萬元、5.763億元、4.566兆元、2,446元
export function formatMoney(yuan: number): string {
  return `${formatSignificantDigits(yuan, 4)}元`
}

// 固定兩位小數的百分比，不用上面的有效位數（三率、償債能力、杜邦、殖利率）：這幾頁的拆解表要逐項加減對得起來，3 位有效數字會把
// 64.23 印成「64.2」、56.10 印成「56.1」，讀者自己算 64.2 − 2.24 − 6.07 得 55.89，跟頁面的 56.1 對不上（2330 量過）。申報值本來就是兩位
export const fixedRateText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)}%`)

// 帶正負號：拆解表「加減」那一列只寫「5.72%」，有一半的時候會讀反（業外損益與所得稅兩個方向都有：2330 −5.72、2454 +1.15）。
// 這一列的值定義成「要加到上一列的量」，整欄可以直接往下加
export const fixedSignedRateText = (value: number | null): string => (value === null ? '尚無資料' : `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}%`)
