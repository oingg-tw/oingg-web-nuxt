import { createHash } from 'node:crypto'

// GET /api/cached/<path>?<query> — a cached, allow-listed passthrough for the handful of 業務中台 GET
// endpoints every /stock/:code render (and the dashboard) reads at page level: the daily summary,
// the company profile, the two-day price history, the ex-dividend notices and the metric catalog
// (2026-09-19, the SEO build; the catalog moved to /api/hub/filter-schema 2026-10-16). Those five were the last uncached upstream calls per render
// (measured: ~5 per warm page, 29 for six pages); through here a warm page costs 業務中台 nothing.
//
// The browser calls this same-origin route on client-side navigation too, which also sidesteps
// 業務中台's missing CORS headers. Only the paths below are proxied — this is not an open proxy —
// and only GET; every POST（screener runs, values）goes through the uncached /api/core proxy instead.
//
// A 業務中台 4xx/5xx is rethrown with its status（an unknown symbol's profile is a 404 here as it
// was directly）and nothing is cached for it, so a transient error never becomes a cached blank.
//
// `\d{4}` IS THE SCOPE, not a careless assumption about symbol shape — measured 2026-09-22 after
// analysis-ts pointed out that six-digit 存託憑證 exist（「路由參數不要用 \d{4} 綁死」）. At that
// time 6 of 業務中台's 2,349 symbols were not four digits（910322 911608 911622 911868 910861
// 912000, all TDRs）, and all six returned a profile but ZERO periods of metrics-history — foreign
// issuers' secondary listings file no Taiwanese XBRL. They reached /stock/{code}, failed here and
// rendered the soft-404, which was the right outcome: letting them through would have put six
// thin pages（a name, a price, every financial section empty）into the sitemap.
//
// **2026-10-02: analysis-ts removed all 10 存託憑證（sector code 91）from `GET /stocks`**, taking
// it from 2,349 to 2,339. Re-measured the same day by paging the whole directory: non-four-digit
// symbols are now **0**, so this pattern currently excludes nobody.
//
// It stays anyway, for the reason it was written and one more. The reason: if TDRs come back, the
// empty-financials shape comes back with them, so the exclusion should hold by default rather than
// be re-discovered. The extra reason: this is an allow-list on a passthrough, and `\d{4}` is also
// what keeps an arbitrary path segment from being proxied — loosening it widens the proxy surface,
// not just the page coverage.
//
// So if a future change needs to widen this list, widen it for a REASON OTHER than symbol shape.
//
// 每條規則收哪些查詢參數、什麼格式（2026-10-29）：查詢字串是使用者送來的，每一組不同的值都是一個永遠不過期的 KV 鍵（swr 時 Nitro
// 不給 KV 到期時間）加一次打業務中台——實測 /api/cached/securities?probe=… 回 200、寫進一個新鍵。不在表上的參數、格式不對的值一律丟掉。
// shortcut: 值只驗格式、不列舉，合法值的組合（limit、from、symbols）仍造得出新鍵；KV 鍵數明顯變多時再替 KV 寫入補到期時間
const COUNT = /^\d{1,5}$/
const ALLOW_LIST: { pattern: RegExp; ttl: 'minute' | 'quote' | 'hourly' | 'daily'; query?: Record<string, RegExp> }[] = [
  { pattern: /^stocks\/\d{4}$/, ttl: 'quote' },
  { pattern: /^stocks\/\d{4}\/daily-price-history$/, ttl: 'quote', query: { limit: COUNT, from: /^\d{4}-\d{2}-\d{2}$/ } },
  { pattern: /^stocks\/\d{4}\/profile$/, ttl: 'daily' },
  // 董監質押（2026-11-21，持有人結構頁的一行）：兩所的董監持股資料一個月一份，一天的快取就夠
  { pattern: /^stocks\/\d{4}\/pledge-ratio-history$/, ttl: 'daily' },
  // 會計師查核（核閱）意見（2026-11-22，摘要卡的示警與基本資料頁那一段，useStockSummary 跟摘要一起讀）：一季一份，一天的快取就夠
  { pattern: /^stocks\/\d{4}\/audit-opinions$/, ttl: 'daily' },
  // 股權分散表（2026-11-22，持有人結構頁）：MOPS 一年一期，一天的快取就夠。內部人申報轉讓（同日，/insider-transfers）：兩所每天出表，一小時
  { pattern: /^stocks\/\d{4}\/shareholder-distribution$/, ttl: 'daily' },
  { pattern: /^stocks\/\d{4}\/insider-transfers$/, ttl: 'hourly' },
  // 應收帳款帳齡（同日，/receivables-aging）：一季一份財報附註，一天的快取就夠
  { pattern: /^stocks\/\d{4}\/receivables-aging$/, ttl: 'daily' },
  // 減資（2026-11-24，股本變化年增率頁）：includeUpcoming 列已公告、還沒恢復買賣的，公告跟得上要一小時
  { pattern: /^stocks\/\d{4}\/capital-reductions$/, ttl: 'hourly', query: { includeUpcoming: /^true$/ } },
  // 背書保證、資金貸與、關係人交易（2026-11-23，/guarantees）與大陸投資、轉投資（同日，/investments）：最新一期的財報附註，一天的快取就夠
  { pattern: /^stocks\/\d{4}\/(endorsements-guarantees|loans-to-others|related-party-transactions|mainland-china-investments|investees)$/, ttl: 'daily' },
  { pattern: /^stocks\/ex-dividend-notices$/, ttl: 'hourly', query: { symbols: /^[0-9A-Z]{4,6}(,[0-9A-Z]{4,6}){0,99}$/ } },
  // metrics 2026-10-16 拿掉：指標目錄改由 /api/hub/filter-schema（精簡版）與 /api/hub/metrics（完整版）提供，同一份快取
  // 公開、不分使用者的型錄與清單（2026-10-16）：原本走不快取的 /api/core，每位訪客打開篩選頁、搜尋框都各打一次上游（業務中台依 IP
  // 限流每 60 秒 300 次，所有訪客共用我們伺服器的出口）。特別股清單同 screener-data 的 cachedPreferredStocks 一小時
  { pattern: /^etf-screener\/filters$/, ttl: 'hourly' },
  { pattern: /^screener\/templates$/, ttl: 'hourly' },
  { pattern: /^screener\/column-preset-templates$/, ttl: 'hourly' },
  { pattern: /^stocks\/preferred-stocks$/, ttl: 'hourly' },
  { pattern: /^securities$/, ttl: 'hourly', query: { limit: COUNT, offset: COUNT } },
  // 更新紀錄（2026-10-29，/changelog）：管理站寫、業務中台存。
  // 2026-11-16 起全站橫幅與站內信也讀它（AppNoticeBanner、/account/notices）：最多舊 1 分鐘加 4 分鐘，維護的橫幅才跟得上
  { pattern: /^release-notes$/, ttl: 'minute' },
  // 部落格（2026-11-20，文章從網站 repo 搬到業務中台）：同更新紀錄一分鐘，下架的文章 5 分鐘內從列表與文章頁消失。網址代號照業務中台的格式
  //（小寫英數、連字號分段、最多 100 字），其他的不轉、直接 404
  { pattern: /^blog-posts$/, ttl: 'minute' },
  { pattern: /^blog-posts\/(?=[a-z0-9-]{1,100}$)[a-z0-9]+(?:-[a-z0-9]+)*$/, ttl: 'minute' },
  // REITs 總覽（2026-10-29，/screener/reits）：收盤與淨值一天一次，業務中台也回 max-age=3600
  { pattern: /^reits$/, ttl: 'hourly' }
]

const TTL_SECONDS = { minute: 60, quote: 15 * 60, hourly: HOUR, daily: 24 * HOUR }

type QueryRecord = Record<string, string>

async function upstream(path: string, query: QueryRecord): Promise<unknown> {
  return businessFetch<unknown>(`/${path}`, { query })
}

// Cache keys must stay valid Windows file names for the dev cache（unstorage's fs driver maps `:`
// to a directory level and writes the rest verbatim）: `?` and `|` are illegal there and the
// write fails silently（seen live 2026-09-19: "Cache write error. ENOENT"）, so the query rides
// behind a `:` separator instead of a `?`.
function keyOf(path: string, query: QueryRecord): string {
  const pairs = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
  const base = path.replace(/\//g, ':')
  const key = pairs.length ? `${base}:${pairs.join('&')}` : base
  // Cloudflare KV 的鍵最長 512 bytes（2026-10-27）：查詢字串是使用者送來的，太長的換成雜湊（Nitro 會再加 nitro:functions:<名稱>: 與 .json）
  return Buffer.byteLength(key) <= 300 ? key : createHash('sha1').update(key).digest('hex')
}

// One cached function per TTL class — defineCachedFunction's maxAge is fixed per function.
// -v2（2026-11-16，詞彙檢核第二批換讀）：報價的 price.dayClose、valuation 分開的本益比與淨值比、tradingHalt 的日期，特別股清單的 close／tradeDate，
// 公司資料的 numberOfOrdinaryShares。存著的是上游原樣，換名之前存的那份沒有新名，最多會留 25 小時（hourly）與 48 小時（daily）
const cachedMinute = defineCachedFunction(upstream, { name: 'cached-get-minute', getKey: keyOf, ...swrCache(TTL_SECONDS.minute, 4 * 60) })
const cachedQuote = defineCachedFunction(upstream, { name: 'cached-get-quote-v2', getKey: keyOf, ...swrCache(TTL_SECONDS.quote, HOUR) })
const cachedHourly = defineCachedFunction(upstream, { name: 'cached-get-hourly-v2', getKey: keyOf, ...swrCache(TTL_SECONDS.hourly, 24 * HOUR) })
const cachedDaily = defineCachedFunction(upstream, { name: 'cached-get-daily-v2', getKey: keyOf, ...swrCache(TTL_SECONDS.daily, 24 * HOUR) })

const BY_TTL = { minute: cachedMinute, quote: cachedQuote, hourly: cachedHourly, daily: cachedDaily }

export default defineEventHandler(async event => {
  const path = (getRouterParam(event, 'path') ?? '').replace(/^\/+|\/+$/g, '')
  const rule = ALLOW_LIST.find(candidate => candidate.pattern.test(path))
  if (!rule) throw createError({ statusCode: 404, statusMessage: 'not a proxied 業務中台 endpoint' })
  const query: QueryRecord = {}
  for (const [key, value] of Object.entries(getQuery(event))) {
    const text = Array.isArray(value) ? value.map(String).join(',') : typeof value === 'string' ? value : null
    if (text !== null && rule.query?.[key]?.test(text)) query[key] = text
  }
  try {
    return await BY_TTL[rule.ttl](path, query)
  } catch (error) {
    // 原因給 server/plugins/http-errors.ts 記（狀態碼照舊：沒有上游狀態的一律 502）
    event.context.httpErrorReason = upstreamFailureReason(error)
    const status = typeof error === 'object' && error && 'statusCode' in error ? Number((error as { statusCode?: number }).statusCode) : 502
    throw createError({ statusCode: Number.isInteger(status) && status >= 400 ? status : 502, statusMessage: '業務中台 request failed' })
  }
})
