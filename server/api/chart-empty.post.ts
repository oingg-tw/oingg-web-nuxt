// POST /api/chart-empty — 瀏覽器回報使用者碰到的空圖（2026-11-12，見 shared/utils/chart-empty.ts）。公開端點：只收定好的欄位（cleanChartEmptyReport），
// 路徑換成樣板（同 5xx 紀錄的 routeTemplate），寫一行進 Cloudflare Workers Logs，管理站用 Cloudflare 的 API 讀。不記標頭、IP、查詢字串。
// 有人刻意送也當成一般回報，不另外限流（同 cold-start-timing）
export default defineEventHandler(async (event) => {
  const raw = await readRawBody(event, 'utf8').catch(() => undefined)
  let parsed: unknown = null
  try {
    parsed = raw && raw.length <= 1024 ? JSON.parse(raw) : null
  } catch {
    parsed = null
  }
  const report = cleanChartEmptyReport(parsed)
  if (!report) {
    setResponseStatus(event, 400)
    return null
  }
  // 欄位名稱是管理站篩選、分組用的（event、symbol、chart、metric、timeframe、lookbackYears、reason、route），改之前先告訴 oingg-admin-vue
  console.log(JSON.stringify({ severity: 'INFO', message: `chart_empty ${report.chart} ${report.symbol} ${report.reason}`, event: 'chart_empty', ...report, route: routeTemplate(report.route) }))
  setResponseStatus(event, 204)
  return null
})
