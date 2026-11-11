// 使用者實際碰到的空圖（2026-11-12，使用者答應管理站：「把圖表沒資料回報給管理站」）：空圖那一格畫出來時瀏覽器送一次，web-nuxt 伺服器層驗過後
// 寫一行結構化紀錄進 Cloudflare Workers Logs（同 5xx 紀錄，留 7 天，server/api/chart-empty.post.ts），管理站用 Cloudflare 的 API 讀、跟數據中台的
// 空值名單對照。欄位名稱跟管理站共用（event、symbol、chart、metric、timeframe、lookbackYears、reason、route），改名算 breaking change。
// 不記身分、IP、瀏覽器、網址參數。零 import：scripts/check-chart-empty.mjs 直接載入。瀏覽器送的那一半在 app/utils/report-chart-empty.ts
//
// reason：數據中台的 nullReason（missing_input、zero_or_negative_denominator、insufficient_history、not_applicable_industry…），或網站自己判斷的：
//   shortfall   這檔的歷史連一年都不到（圖的位置寫「上市未滿…」那一句）
//   no_bands    河流圖沒有河道、數據中台也沒給原因
//   no_prices   河流圖連股價都沒有
//   no_points   指標的歷史圖在這個期間不到兩期
export const CHART_EMPTY_CHARTS = ['valuation-river', 'metric-history'] as const
export interface ChartEmptyReport {
  symbol: string
  chart: (typeof CHART_EMPTY_CHARTS)[number]
  metric: string
  timeframe: string
  lookbackYears: number | null
  reason: string
  route: string
}
const FIELDS = new Set(['symbol', 'chart', 'metric', 'timeframe', 'lookbackYears', 'reason', 'route'])

// 公開端點收到的 body：只收這幾個鍵、每個鍵的格式固定，其他一律不收（null → 400）
export function cleanChartEmptyReport(raw: unknown): ChartEmptyReport | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const input = raw as Record<string, unknown>
  if (Object.keys(input).some(key => !FIELDS.has(key))) return null
  const { symbol, chart, metric, timeframe, lookbackYears, reason, route } = input
  if (typeof symbol !== 'string' || !/^[0-9A-Z]{4,6}$/.test(symbol)) return null
  if (!CHART_EMPTY_CHARTS.includes(chart as ChartEmptyReport['chart'])) return null
  if (typeof metric !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(metric)) return null
  if (typeof timeframe !== 'string' || !/^[A-Z0-9]{1,6}$/.test(timeframe)) return null
  if (lookbackYears !== null && !(Number.isInteger(lookbackYears) && (lookbackYears as number) >= 1 && (lookbackYears as number) <= 20)) return null
  if (typeof reason !== 'string' || !/^[a-z_]{1,40}$/.test(reason)) return null
  if (typeof route !== 'string' || !route.startsWith('/') || route.includes('?') || route.length > 200) return null
  return { symbol, chart: chart as ChartEmptyReport['chart'], metric, timeframe, lookbackYears: lookbackYears as number | null, reason, route }
}
