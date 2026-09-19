// GET /api/bff/<path>?<query> — a cached, allow-listed passthrough for the handful of bff-ts GET
// endpoints every /stock/:code render (and the dashboard) reads at page level: the daily summary,
// the company profile, the two-day price history, the ex-dividend notices and the metric catalog
// (2026-09-19, the SEO build). Those five were the last uncached upstream calls per render
// (measured: ~5 per warm page, 29 for six pages); through here a warm page costs bff-ts nothing.
//
// The browser calls this same-origin route on client-side navigation too, which also sidesteps
// bff-ts's missing CORS headers. Only the paths below are proxied — this is not an open proxy —
// and only GET; every POST（screener runs, values）still goes to bff-ts directly from the caller.
//
// A bff-ts 4xx/5xx is rethrown with its status（an unknown symbol's profile is a 404 here as it
// was directly）and nothing is cached for it, so a transient error never becomes a cached blank.
const ALLOW_LIST: { pattern: RegExp; ttl: 'quote' | 'hourly' | 'daily' }[] = [
  { pattern: /^stocks\/\d{4}$/, ttl: 'quote' },
  { pattern: /^stocks\/\d{4}\/daily-price-history$/, ttl: 'quote' },
  { pattern: /^stocks\/\d{4}\/profile$/, ttl: 'daily' },
  { pattern: /^stocks\/ex-dividend-notices$/, ttl: 'hourly' },
  { pattern: /^metrics$/, ttl: 'hourly' }
]

const TTL_SECONDS = { quote: 15 * 60, hourly: HOUR, daily: 24 * HOUR }

type QueryRecord = Record<string, string>

async function upstream(path: string, query: QueryRecord): Promise<unknown> {
  return bffFetch<unknown>(`/${path}`, { query })
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
  return pairs.length ? `${base}:${pairs.join('&')}` : base
}

// One cached function per TTL class — defineCachedFunction's maxAge is fixed per function.
const cachedQuote = defineCachedFunction(upstream, { name: 'bff-get-quote', getKey: keyOf, maxAge: TTL_SECONDS.quote, staleMaxAge: HOUR, swr: true })
const cachedHourly = defineCachedFunction(upstream, { name: 'bff-get-hourly', getKey: keyOf, maxAge: TTL_SECONDS.hourly, staleMaxAge: 24 * HOUR, swr: true })
const cachedDaily = defineCachedFunction(upstream, { name: 'bff-get-daily', getKey: keyOf, maxAge: TTL_SECONDS.daily, staleMaxAge: 24 * HOUR, swr: true })

const BY_TTL = { quote: cachedQuote, hourly: cachedHourly, daily: cachedDaily }

export default defineEventHandler(async event => {
  const path = (getRouterParam(event, 'path') ?? '').replace(/^\/+|\/+$/g, '')
  const rule = ALLOW_LIST.find(candidate => candidate.pattern.test(path))
  if (!rule) throw createError({ statusCode: 404, statusMessage: 'not a proxied bff-ts endpoint' })
  const query: QueryRecord = {}
  for (const [key, value] of Object.entries(getQuery(event))) {
    if (typeof value === 'string') query[key] = value
    else if (Array.isArray(value)) query[key] = value.map(String).join(',')
  }
  try {
    return await BY_TTL[rule.ttl](path, query)
  } catch (error) {
    const status = typeof error === 'object' && error && 'statusCode' in error ? Number((error as { statusCode?: number }).statusCode) : 502
    throw createError({ statusCode: Number.isInteger(status) && status >= 400 ? status : 502, statusMessage: 'bff-ts request failed' })
  }
})
