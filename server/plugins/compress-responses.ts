import { promisify } from 'node:util'
import { brotliCompress, constants, gzip } from 'node:zlib'

// 動態回應（SSR 的 HTML、/_payload.json、/api/* 的 JSON）壓縮後再送。App Hosting 前面的 Google 前端不會替 Cloud Run 的回應壓縮：
// 2026-10-16 量到 DEV 首頁 HTML 71,858 bytes、/api/core 的股票目錄每頁約 135 KiB（一次載入抓三頁）都是原樣傳。靜態檔不走這裡，
// 由 nuxt.config 的 nitro.compressPublicAssets 在建置時壓好（那些回應已經帶 Content-Encoding，下面第一行就跳過）。
//
// 只壓字串與一般 JSON 物件：h3 對 Buffer／stream 會原樣送，那些不是我們產生的內容。brotli 品質 5：動態內容每次都要壓，
// 最高品質（11）一份 70 KB 的 HTML 要幾十毫秒，5 只要一兩毫秒、大小差不到一成。
const brotli = promisify(brotliCompress)
const gz = promisify(gzip)
const COMPRESSIBLE = /^(text\/|application\/(json|problem\+json|javascript|xml))/
const MIN_BYTES = 1024

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', async (event, response) => {
    if (event.method === 'HEAD' || getResponseHeader(event, 'content-encoding')) return
    // 錯誤頁不壓（2026-10-19 量到每一個 SSR 的 404 頁瀏覽器都卡住）：Nuxt 的錯誤處理（@nuxt/nitro-server handlers/error）在伺服器
    // 內部 localFetch('/__nuxt_error')、原樣帶著瀏覽器的 Accept-Encoding，再用 res.text() 把回應當文字讀、連標頭一起抄到最後的
    // 回應——這裡若把內部那一次壓成 br，壓縮過的位元組被當 UTF-8 讀壞，標頭卻還寫著 br，瀏覽器解不開
    if (event.path.startsWith('/__nuxt_error')) return
    const accept = getRequestHeader(event, 'accept-encoding') ?? ''
    const encoding = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null
    if (!encoding) return

    let text: string
    if (typeof response.body === 'string') {
      text = response.body
    } else if (Array.isArray(response.body) || (response.body !== null && typeof response.body === 'object' && Object.getPrototypeOf(response.body) === Object.prototype)) {
      // h3 本來會自己 JSON.stringify 並補 application/json；先序列化，所以 content-type 也要先補
      text = JSON.stringify(response.body)
      if (!getResponseHeader(event, 'content-type')) setResponseHeader(event, 'content-type', 'application/json')
    } else {
      return
    }
    // h3 對沒有 content-type 的字串預設是 HTML（Nuxt 的 renderer 會自己設）
    const type = String(getResponseHeader(event, 'content-type') ?? 'text/html')
    if (!COMPRESSIBLE.test(type) || Buffer.byteLength(text) < MIN_BYTES) return

    response.body = encoding === 'br'
      ? await brotli(text, { params: { [constants.BROTLI_PARAM_QUALITY]: 5, [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT } })
      : await gz(text, { level: 6 })
    setResponseHeader(event, 'content-encoding', encoding)
    appendResponseHeader(event, 'vary', 'Accept-Encoding')
    removeResponseHeader(event, 'content-length')
  })
})
