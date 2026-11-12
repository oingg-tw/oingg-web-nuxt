// GET /api/hub/metric-texts — 精簡目錄拿掉的長文字（getMetricTexts，2026-11-13）：英文名、搜尋別名、說明、參考網址、期別的說明與別名。
// 不帶參數回整份（挑指標的面板）；?key=代號 只回那一支（伺服器要畫定義段、參考連結的頁），沒有這支回 {}。瀏覽器快取一小時
export default defineEventHandler(async (event) => {
  const key = getQuery(event).key
  // 指標代碼只有英數與底線：其他字串不往下查
  if (key !== undefined && (typeof key !== 'string' || !/^\w+$/.test(key))) throw createError({ statusCode: 400, statusMessage: 'key must be a metric code' })
  const texts = await getMetricTexts().catch(() => {
    throw createError({ statusCode: 503, statusMessage: 'metric catalog unavailable' })
  })
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')
  return key === undefined ? texts : (texts[key] ?? {})
})
