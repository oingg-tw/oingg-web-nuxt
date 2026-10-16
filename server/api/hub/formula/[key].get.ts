// GET /api/hub/formula/:metricKey — 指標公式在伺服器排好的 HTML（getFormulaHtml，2026-10-16）。新手專區在伺服器渲染時就抓好、跟著
// payload 到；兩種徽章對話框打開時才抓，滑過或聚焦觸發的按鈕時先抓（app/utils/metric-formula.ts）。瀏覽器快取一小時，預先抓的那次
// 打開時直接用。沒有公式的指標回 { html: null }
export default defineEventHandler(async (event) => {
  const metricKey = getRouterParam(event, 'key') ?? ''
  // 指標代碼只有英數與底線：其他字串不往下送，也不會變成快取鍵
  if (!/^\w+$/.test(metricKey)) throw createError({ statusCode: 404, statusMessage: 'unknown metric' })
  let html: string | null
  try {
    html = await getFormulaHtml(metricKey)
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'metric catalog unavailable' })
  }
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')
  return { html }
})
