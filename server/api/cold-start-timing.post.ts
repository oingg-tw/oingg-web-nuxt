// POST /api/cold-start-timing — 瀏覽器回報「叫醒業務中台冷啟動的那個請求」它等了多久（2026-10-26，見 shared/utils/cold-start-timing.ts）。
// 公開端點：只收定好的欄位（cleanColdStartReport），路徑換成樣板（同 5xx 紀錄的 routeTemplate），轉給業務中台併進那筆冷啟動紀錄，
// 資料存在業務中台、保存多久由它決定。這裡不記任何東西。有人刻意送也當成一般使用者（使用者 2026-10-26 的決定），不另外限流。
// 業務中台收不到也回 204：sendBeacon 不看回應，重試也沒有意義（同一個 id 再送會覆蓋，業務中台說重試安全，但瀏覽器不會重送）
export default defineEventHandler(async (event) => {
  const raw = await readRawBody(event, 'utf8').catch(() => undefined)
  let parsed: unknown = null
  try {
    parsed = raw && raw.length <= 4096 ? JSON.parse(raw) : null
  } catch {
    parsed = null
  }
  const report = cleanColdStartReport(parsed)
  if (!report) {
    setResponseStatus(event, 400)
    return null
  }
  const { id, ...timing } = report
  await businessFetch(`/cold-starts/${id}/client-timing`, { method: 'POST', body: { ...timing, route: routeTemplate(timing.route) } }).catch(() => undefined)
  setResponseStatus(event, 204)
  return null
})
