// The one runnable check for server/utils/http-error.ts: the 5xx reason codes and route templates the
// http_errors log-based metric groups by. Pure, no network.
//
// Run: node scripts/check-http-error.mjs
import { isUpstreamFetchFailure, routeTemplate, upstreamFailureReason } from '../server/utils/http-error.ts'

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

assert(routeTemplate('/share/fi6Sdh1VguMLrRQQpa14WA') === '/share/:id', '分享連結的 token 換成 :id')
assert(routeTemplate('/stock/2330/pe-ratio') === '/stock/:id/pe-ratio', '股票代號換成 :id，固定的段留著')
assert(routeTemplate('/api/core/stocks/ex-dividend-calendar?month=2026-10') === '/api/core/stocks/ex-dividend-calendar', '查詢字串拿掉')
assert(routeTemplate('/') === '/', '首頁')
assert(routeTemplate('/share/AbcdefghIjklmnopQrstuv') === '/share/:id', '沒有數字的 token（大小寫混合的長亂碼）也換')
assert(routeTemplate('/etf/00679b/expenses') === '/etf/:id/expenses', 'ETF 代號（帶字母）也換')

assert(upstreamFailureReason({ name: 'FetchError', message: '[GET] "/x": <no response> The operation was aborted due to timeout' }) === 'upstream_timeout', '我們等不到＝逾時')
assert(upstreamFailureReason({ name: 'FetchError', statusCode: 504 }) === 'upstream_timeout', '上游自己回 504 也是逾時')
assert(upstreamFailureReason({ name: 'FetchError', statusCode: 500 }) === 'upstream_error', '上游回其他 5xx')
assert(upstreamFailureReason({ name: 'FetchError', message: 'fetch failed' }) === 'upstream_unreachable', '沒有回應、不是逾時＝連不上')

assert(isUpstreamFetchFailure({ name: 'TypeError', message: 'fetch failed' }), 'h3 包裝後留下的 fetch failed 認得出來')
assert(isUpstreamFetchFailure({ name: 'TimeoutError', message: 'The operation was aborted due to timeout' }), '逾時的 TimeoutError 認得出來')
assert(upstreamFailureReason({ name: 'TimeoutError', message: 'The operation was aborted due to timeout' }) === 'upstream_timeout', 'TimeoutError 算逾時')
assert(!isUpstreamFetchFailure({ name: 'TypeError', message: "Cannot read properties of null (reading 'x')" }), '程式自己的 TypeError 不算上游')

console.log(failures ? `\n${failures} 項失敗` : '\n全部通過')
process.exitCode = failures ? 1 : 0
