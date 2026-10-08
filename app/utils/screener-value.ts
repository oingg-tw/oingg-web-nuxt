// /screener/values 與 /screener 回傳的儲存格（字串）怎麼顯示。篩選器結果表與觀察清單的自訂欄位共用
// （2026-10-06 從 SharedMetricTable 搬出來；原本的理由註解留在那邊的呼叫處）。
// unit 來自 GET /metrics 型錄（locateFieldInSchema），只有百分比會加 %。
// 型錄的百分比單位是 '%'，不是早期的 'percent'（2026-10-06 實測 roe／grossMargin／dividendYield 全是 '%'）。
// 這裡原本比的是 'percent'，於是篩選器結果表的百分比欄位不知從哪天起就沒有 % 了；
// screener/[preset].vue、metrics-history.vue、stock-answers.ts 早就是比 '%'。
// 個股殖利率 0 ＝ 最近一年度沒有配發現金股利（交易所的殖利率是最近一年度現金股利÷收盤價）。待辦清單
// 2026-10-01：「殖利率 0%」改寫成「不配息」。**只在個股層級**——類股中位數是 0 不等於整個類股不配息。
export const NO_DIVIDEND_TEXT = '不配息'

export function formatScreenerValue(raw: string | null | undefined, unit: string | undefined, field?: string): string {
  if (raw === null || raw === undefined) return '—'
  if (field === 'dividendYield.EOD' && Number(raw) === 0) return NO_DIVIDEND_TEXT
  if (unit === '%') return `${raw}%`
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  if (Math.abs(value) >= 1e6) return formatSignificantDigits(value, 4)
  return groupThousands(raw)
}

// 兩個欄位值的升冪比較：數字比數字；讀不出數字的（例如日期字串）照字串比。null 由呼叫端決定放哪裡。
// 觀察清單的表格（el-table 的 sort-method）與手機卡片的排序選單共用（2026-10-08）。
export function compareFieldValues(x: string, y: string): number {
  const nx = Number(x)
  const ny = Number(y)
  return Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : x.localeCompare(y)
}
