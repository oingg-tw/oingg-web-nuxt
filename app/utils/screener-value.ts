// /screener/values 與 /screener 回傳的儲存格（字串）怎麼顯示。篩選器結果表與觀察清單的自訂欄位共用
// （2026-10-06 從 OrganismResultTable.vue 搬出來；原本的理由註解留在那邊的呼叫處）。
// unit 來自 GET /metrics 型錄（locateFieldInSchema），只有百分比會加 %。
// 型錄的百分比單位是 '%'，不是早期的 'percent'（2026-10-06 實測 roe／grossMargin／dividendYield 全是 '%'）。
// 這裡原本比的是 'percent'，於是篩選器結果表的百分比欄位不知從哪天起就沒有 % 了；
// screener/[preset].vue、metrics-history.vue、stock-answers.ts 早就是比 '%'。
export function formatScreenerValue(raw: string | null | undefined, unit: string | undefined): string {
  if (raw === null || raw === undefined) return '—'
  if (unit === '%') return `${raw}%`
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  if (Math.abs(value) >= 1e6) return formatSignificantDigits(value, 4)
  return groupThousands(raw)
}
