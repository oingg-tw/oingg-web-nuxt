import type { H3Event, H3EventContext } from 'h3'

// 每個回給使用者的 5xx 寫一行結構化紀錄（2026-10-21）：GCP 的 log-based metric http_errors（oingg-web-dev）數這一行，管理站「排程與服務」
// 頁依 status／route／reason 分組。原因代碼與路徑樣板在 server/utils/http-error.ts。
// Cloudflare Workers 上同一行進 Workers Logs（欄位自動拆開、最多留 7 天），管理站用 Cloudflare 的 API 讀（2026-10-27 使用者選「改抓 Cloudflare log」，
// 不另外寫進 GCP）
//
// 一個使用者看到的錯誤只記一筆：
//   - 伺服器渲染頁面時呼叫自己的 /api 是內部請求，不記，原因交給外層請求（coldStartParent，server/plugins/cold-start-timing.ts 記的）——
//     分享頁的 503 才知道是業務中台逾時。原本看請求物件有沒有 node-mock-http 的 __unenv__ 欄位，但 Cloudflare Workers 上每個請求
//     都是模擬物件（2026-10-27 改）
//   - 錯誤頁（/__nuxt_error）是 Nuxt 錯誤處理在伺服器內部再打一次，不記
//   - 丟出來的錯誤走 error hook（Nuxt 的錯誤頁送出後不一定再跑 afterResponse）；直接回 5xx 的（/api/core 轉回上游的 5xx）走
//     afterResponse。兩邊都可能看到同一個請求，記過就不再記
// 不記任何標頭、查詢字串與 body（/api/core 會經手個資）。
type Context = H3EventContext & { httpErrorReason?: HttpErrorReason; httpErrorLogged?: boolean }

function report(event: H3Event, status: number, reason: HttpErrorReason) {
  const context = event.context as Context
  if (context.httpErrorLogged || event.path.startsWith('/__nuxt_error')) return
  context.httpErrorLogged = true
  const parent = context.coldStartParent
  if (parent) {
    (parent.context as Context).httpErrorReason ??= reason
    return
  }
  const route = routeTemplate(event.path)
  // httpRequest.status 是 Cloud Logging 的標準欄位：指標的 status 標籤跟平台自己的請求紀錄讀同一個欄位
  console.log(JSON.stringify({ severity: 'ERROR', message: `http_error ${status} ${route} ${reason}`, event: 'http_error', route, reason, httpRequest: { requestMethod: event.method, status } }))
}

// 沒有更細的原因時：500 是程式沒接住，其他 5xx 是我們自己因為讀不到上游而丟的
const fallbackReason = (status: number): HttpErrorReason => (status === 500 ? 'app_error' : 'upstream_failed')

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500
    if (!event || status < 500) return
    let reason = (event.context as Context).httpErrorReason
    // 錯誤鏈裡有打上游失敗的那一環就照它分；其餘 h3 標成 unhandled 的是程式例外
    for (let cause: unknown = error; !reason && cause; cause = (cause as { cause?: unknown }).cause) {
      if (isUpstreamFetchFailure(cause)) reason = upstreamFailureReason(cause)
    }
    if (!reason && (error as { unhandled?: boolean }).unhandled) reason = 'app_error'
    report(event, status, reason ?? fallbackReason(status))
  })
  nitroApp.hooks.hook('afterResponse', (event) => {
    const status = getResponseStatus(event)
    if (status >= 500) report(event, status, (event.context as Context).httpErrorReason ?? fallbackReason(status))
  })
})
