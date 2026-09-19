// Crawl-path check for the 2026-09-19 SEO build: a JavaScript-free breadth-first walk over the
// server-rendered HTML from `/`, following only same-site <a href> values, to depth 3. Asserts
// that every /stock/{code} URL the stocks sitemap source lists is reached, and prints the depth
// histogram plus how many「其他證券」directory entries resolve to a noindex（soft-404）stock page —
// the number that decides whether the directory and the sitemap should be narrowed to symbols
// with a quote. Run with `node scripts/check-click-depth.mjs` against `pnpm run dev`
// (CLICK_DEPTH_URL to override). Only hub/listing pages are expanded（stock pages are leaves）so
// the walk stays at a few hundred requests.
const baseUrl = process.env.CLICK_DEPTH_URL ?? 'http://localhost:3000'
const MAX_DEPTH = 3
const STOCK_PAGE = /^\/stock\/\d{4}$/
// Pages whose links are followed. Stock pages, blog posts and app pages are leaves.
const EXPANDABLE = [/^\/$/, /^\/stock$/, /^\/industry\/[^/]+$/, /^\/rank(\/[^/]+)?$/, /^\/screener(\/[^/]+)?$/, /^\/metrics(\/[^/]+)?$/, /^\/industries$/, /^\/sitemap$/]
const SOFT_404_SAMPLE = 25

function links(html) {
  const cleaned = html.replace(/<!--[\s\S]*?-->/g, '')
  const hrefs = new Set()
  for (const match of cleaned.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = match[1]
    if (href.startsWith('/_nuxt') || href.startsWith('/api/') || /\.(css|js|ico|png|jpg|svg|xml|txt)$/.test(href)) continue
    hrefs.add(href.replace(/\/$/, '') || '/')
  }
  return hrefs
}

async function fetchHtml(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: 'text/html' } })
  return { status: response.status, html: await response.text() }
}

const depthOf = new Map([['/', 0]])
const queue = ['/']
let requests = 0
while (queue.length) {
  const path = queue.shift()
  const depth = depthOf.get(path)
  if (depth >= MAX_DEPTH || !EXPANDABLE.some(pattern => pattern.test(path))) continue
  const { status, html } = await fetchHtml(path)
  requests += 1
  if (status !== 200) {
    console.log(`  ${path}: ${status}`)
    continue
  }
  for (const href of links(html)) {
    if (!depthOf.has(href)) {
      depthOf.set(href, depth + 1)
      queue.push(href)
    }
  }
}

const sitemapStocks = new Set((await (await fetch(`${baseUrl}/api/__sitemap__/stocks`)).json()).map(entry => entry.loc).filter(loc => STOCK_PAGE.test(loc)))
const reachedStocks = [...depthOf.keys()].filter(path => STOCK_PAGE.test(path))
const missing = [...sitemapStocks].filter(loc => !depthOf.has(loc))

const histogram = {}
for (const [path, depth] of depthOf) {
  if (!STOCK_PAGE.test(path)) continue
  histogram[depth] = (histogram[depth] ?? 0) + 1
}
console.log(`pages fetched: ${requests}; urls discovered: ${depthOf.size}`)
console.log(`stock pages reached: ${reachedStocks.length} / sitemap ${sitemapStocks.size}; depth histogram ${JSON.stringify(histogram)}`)
console.log(`home links: ${['/screener', '/stock', '/metrics', '/rank'].map(path => `${path}=${depthOf.get(path) === 1}`).join(' ')}`)

// Soft-404 sample among the「其他證券」directory entries（no sector）: how many of those stock
// pages answer with `noindex`.
const directory = await (await fetch(`${baseUrl}/api/hub/directory`)).json()
const others = directory.others.slice(0, SOFT_404_SAMPLE)
let noindex = 0
for (const company of others) {
  const { html } = await fetchHtml(`/stock/${company.symbol}`)
  if (/name="robots" content="noindex(?!, nofollow)/.test(html) || html.includes('找不到這檔股票')) noindex += 1
}
console.log(`其他證券 sample: ${noindex} / ${others.length} stock pages are soft-404 (noindex)`)

if (missing.length) {
  console.log(`FAIL: ${missing.length} sitemap stock URLs not reachable within depth ${MAX_DEPTH}: ${missing.slice(0, 5).join(' ')}`)
  process.exit(1)
}
console.log('PASS: every sitemap stock URL is within 3 clicks of /')
