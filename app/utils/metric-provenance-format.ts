import type { MetricProvenanceEntry } from '#shared/types/metric-provenance'
// 溯源 entry 的數值格式化，**一份**。2026-10-01 抽出來的原因是它原本有三份一模一樣的拷貝
// （StockMetricProvenanceSection、StockGuruBadgeDialog（已刪）、StockHistoricalStatisticsTable），
// 而三份都有同一個 1000 倍的錯誤——我先在其中一份修好，另外兩份還是錯的。一個共用函式裡的
// 修正比三個呼叫端各修一次小，而且下一個顯示溯源的地方不會再生出第四份。
//
// 錯在哪裡：報表欄位的數字是**新台幣千元**（shared/types/financial-statement.ts 自己的註解，
// /financial-statements 那一頁也是這樣標的），而原本整欄直接丟給 formatSignificantDigits——
// 台積電單季淨利 452,301,407 千元於是顯示成「4.523億」，少了 1000 倍。
//
// 怎麼確認不是猜的：同一包 provenance 裡 四季淨利合計 × 1000 ÷ 流通股數 = 86.2 元，剛好是台積電
// 的近四季每股盈餘；不乘 1000 的話是 0.0862。上游自己的 methodologyNote 也寫著
// 「淨值×1000(千元換元)/流通股數」。
//
// 三種列三種刻度：報表欄位是千元、每股盈餘那兩個欄位本來就是元（PER_SHARE_KEYS 已經有這份清單，
// 財報三表的表格在用同一個）、`type: 'other'`（股數、收盤價、市場快照）是絕對值。
//
// other 的金額一律是元：2026-11-27 起數據中台的 openapi 也這樣寫（「statementField 的金額照財報千元（每股欄位是元）；other 的金額
// 一律是元」）。在那之前有幾類 other 把千元原樣送出來（各種平均、月營收、特別股清償金額與股利、銀行損益明細），照這裡的規則顯示就少
// 1000 倍：技嘉的平均總資產寫 2.385 億、平均存貨寫 1.267 億，上面逐季列的卻是一兩千億。那次改的是資料，不是這裡；哪天 other 的金額
// 又跟上面的報表數字差一千倍，先查上游，不要在這裡猜哪幾筆是千元（股數與金額從數字分不出來）。
//
// **不要寫成「statementField 一律千元」**：上游 2026-10-01 明確說了那條規則不成立——
// financial-statement 的慣例是「金額千元、但每股欄位本身是元」，所以判斷必須看 fieldKey。
function provenanceScale(item: MetricProvenanceEntry): number {
  if (item.type !== 'statementField') return 1
  return item.fieldKey && PER_SHARE_KEYS.has(item.fieldKey) ? 1 : 1000
}

// 期別那一格：算出來的列（平均值）與市場資料沒有期別，寫「－」；只有年度的寫「2025 年」（全站年度的寫法）
export function formatProvenancePeriod(fiscalYear: number | null | undefined, fiscalQuarter: number | null | undefined): string {
  if (fiscalYear == null) return '－'
  return fiscalQuarter == null ? `${fiscalYear} 年` : `${fiscalYear} Q${fiscalQuarter}`
}

// 沒有數值寫「－」，不是 0（2026-10-21：6741 那幾季財報根本沒有存貨科目，計算過程原本寫存貨 0）
export function formatProvenanceValue(item: MetricProvenanceEntry): string {
  return item.value === null ? '－' : formatSignificantDigits(item.value * provenanceScale(item), 4)
}
