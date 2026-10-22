// 同名的幾支只留一支能挑（2026-10-21，使用者：「類似的欄位 比如股價淨值比 就有三個 本益比也是 哪個比較適合做為篩選指標 請保留一個就好」）：
// 左邊是被藏起來的指標，右邊是留下來的那一支（欄位 id）。型錄裡左邊還在（個股頁的季資料圖、河流圖要用），只是挑選器不列
// （ScreenerIndicatorPickerBody）。2026-10-20 收盤資料量的理由：
//   - 本益比、股價淨值比留「交易所」：季資料版停在上次財報那天（3008 本益比 21.75，當天其實 31.78）；即時版虧損公司是負數
//     （1101 −22.76），「≤ 15」會把虧損公司篩進來，交易所對虧損公司不公布
//   - 市值、葛拉漢倍數、本益成長比留「即時」：季資料版同樣停在財報那天；季資料版葛拉漢倍數虧損公司是負數（1101 −15.21）會通過「< 22.5」
//   - 每股股利留「近12個月」：近四季版今年除息比去年晚就掉成 0（2364 是 0，近12個月 1.82）
//   - 盈餘收益率兩支都留：一般版是 EPS ÷ 股價，Greenblatt 版是 EBIT ÷ 企業價值，公式不同
// 存過的篩選條件與欄位組合裡還有左邊的，打開篩選時換成右邊並存回帳號（2026-10-22，使用者：「換成留下來的那一支」。起因是條件選了
// 「即時 本益成長比 < 1」、欄位卻是舊的「本益成長比」：朋億 0.85 通過，欄位寫 1.04）。每一對的單位相同（倍／元），條件的數字照搬。
// 零 import：scripts/check-replaced-metrics.mjs 直接讀
export const REPLACED_METRICS: Record<string, string> = {
  peRatio: 'exchangePeRatio.EOD',
  livePeRatio: 'exchangePeRatio.EOD',
  pbRatio: 'exchangePbRatio.EOD',
  livePbRatio: 'exchangePbRatio.EOD',
  marketCap: 'liveMarketCap.EOD',
  grahamNumber: 'liveGrahamNumber.EOD',
  pegRatio: 'livePegRatio.EOD',
  dividendPerShare: 'liveDividendPerShare.EOD'
}

export const replacedField = (fieldId: string): string => REPLACED_METRICS[fieldId.split('.')[0] ?? ''] ?? fieldId

// 欄位清單換完去掉重複：舊的跟留下來的那支都在時，只留前面那一個位置
export const replacedFields = (fields: string[]): string[] => [...new Set(fields.map(replacedField))]
