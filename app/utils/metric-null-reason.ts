// 指標為什麼是 null，用讀者的話說。nullReason 的完整列舉由 analysis-ts 確認（2026-09-13，metricNullReasonSchema 就這 4 個值）：只有
// not_applicable_industry 是「這個指標的模型在觀念上不適用於這家公司」（五個危機預警模型排除金融保險股），其餘三個都是
// 「真的有數字，只是這一期算不出來」。2026-09-19 從 StockHistoricalStatisticsTable 搬出來，SSR 的數列表格說同樣的話。
export const NULL_REASON_LABELS: Record<string, string> = {
  missing_input: '計算所需的原始申報欄位缺值',
  zero_or_negative_denominator: '分母為零或負值，比率無意義',
  not_applicable_industry: '依產業別，此指標的模型前提不適用於本公司',
  insufficient_history: '可比較的歷史資料深度不足',
  // Not a real analysis-ts value — a period with literally no computation record for this
  // metric (the whole chunk came back empty), distinct from a real null-with-reason.
  __no_record__: '此期別尚無此指標的計算紀錄'
}

// 財報亮點與風險那張表的 nullReason 欄用的短措辭（2026-10-08 從 StockFinancialHighlightsRisksCard 搬來）：四句都是對資料的描述不是判斷
export const NULL_REASON_SHORT_LABELS: Record<string, string> = {
  not_applicable_industry: '不適用於此產業',
  missing_input: '缺少計算所需資料',
  insufficient_history: '歷史資料期數不足',
  zero_or_negative_denominator: '分母為零或負值'
}

export interface NullablePoint {
  value: number | null
  nullReason: string | null
}

export function nullReasonTitle(point: NullablePoint): string | undefined {
  if (point.value !== null || !point.nullReason) return undefined
  return NULL_REASON_LABELS[point.nullReason] ?? `原因代碼：${point.nullReason}`
}

// 儲存格裡的短措辭（title 放上面的長說明）。三種結果、中間那種才是重點（2026-09-22）：不適用（模型不適用於這家公司）、無法計算
//（資料在，這個指標算不出來——本身就是關於公司的事實）、尚無資料（我們沒有這家公司這一期的紀錄）。原本全部塌成不適用或尚無資料，
// 10 檔樣本 108 個 null 徽章有 96 個被說成「我們沒有數字」，含 35 個 insufficient_history。bff-ts 之後把同一個區分寫進契約（3a59133）。
export function nullReasonShortText(nullReason: string | null | undefined): string {
  if (nullReason === 'not_applicable_industry') return '不適用'
  return nullReason ? '無法計算' : '尚無資料'
}

// Integers stay integers（7、8）, everything else gets `decimals` places — deterministic on both
// renders（toFixed only, never toLocaleString）.
export function formatSeriesNumber(value: number, decimals = 2): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(decimals)
}

export function formatNullablePoint(point: NullablePoint | null | undefined, decimals = 2): string {
  if (!point || point.value === null) return point?.nullReason === 'not_applicable_industry' ? '不適用' : '－'
  return formatSeriesNumber(point.value, decimals)
}
