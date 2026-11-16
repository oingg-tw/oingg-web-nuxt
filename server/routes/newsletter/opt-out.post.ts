// POST /newsletter/opt-out?t=<token> — 信件標頭 List-Unsubscribe 的一鍵退訂（RFC 8058，2026-11-16）。Gmail、Yahoo 直接 POST 這個網址
//（body 是 List-Unsubscribe=One-Click），沒有 JavaScript、不帶 cookie，所以 token 只能在網址裡；這裡移進 body 轉給業務中台的 POST /newsletter/opt-out。
// 那把 token 只能退訂。同一個網址用 GET 打開是 app/pages/newsletter/opt-out.vue。不記 token，失敗也只回狀態
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  const token = getQuery(event).t
  if (!isNewsletterToken(token)) {
    setResponseStatus(event, 400)
    return '連結不完整'
  }
  try {
    await businessFetch('/newsletter/opt-out', { method: 'POST', body: { token } })
    return '已停止寄送每週持股週報'
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status && status < 500) {
      setResponseStatus(event, status)
      return '連結已經失效'
    }
    // 上游失敗照 5xx 紀錄的原因代碼（server/plugins/http-errors.ts 記）
    const reason = upstreamFailureReason(error)
    event.context.httpErrorReason = reason
    setResponseStatus(event, reason === 'upstream_timeout' ? 504 : 502)
    return '暫時沒辦法處理，請稍後再試'
  }
})
