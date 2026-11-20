// 部落格的檢查（2026-11-19 主題篩選，使用者選「少數大主題」、一篇一類；2026-11-20 文章搬到業務中台後加網站地圖與 404）。對著跑著的網站：
//   node scripts/check-blog.mjs            （BLOG_URL 可覆寫，例如 DEV 的網址）
// 照 /changelog 的做法：篩選是連結（?category=），伺服器就篩好，canonical 不帶查詢字串；只列有文章的主題。
const base = (process.env.BLOG_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

async function page(path) {
  const response = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(60_000) })
  return { status: response.status, html: await response.text() }
}

// 列表的每一篇：網址代號與標出的主題名稱
const itemsOf = html => html.split('class="blog-index__item"').slice(1).map(chunk => ({
  slug: chunk.match(/href="\/blog\/([a-z0-9-]+)"/)?.[1],
  label: chunk.match(/class="blog-index__category"[^>]*>([^<]*)</)?.[1]
}))

// 主題 chip（只看篩選那一排）：連到哪一類、名稱、是不是目前那一個
function chipsOf(html) {
  const nav = html.split('class="blog-index__filters"')[1]?.split('</nav>')[0] ?? ''
  return [...nav.matchAll(/<a([^>]*)>([^<]*)<\/a>/g)].map(([, attrs, label]) => ({
    category: attrs.match(/href="\/blog\?category=([a-z_]+)"/)?.[1] ?? null,
    label: label.trim(),
    current: /aria-current="page"/.test(attrs)
  }))
}

const canonicalOf = html => html.match(/<link[^>]*rel="canonical"[^>]*>/)?.[0].match(/href="([^"]*)"/)?.[1]

const all = await page('/blog')
const items = itemsOf(all.html)
const chips = chipsOf(all.html)
expect(all.status === 200, `/blog 回 ${all.status}`)
expect(items.length > 0, '/blog 沒有文章')
expect(items.every(item => item.slug && item.label), `有文章沒標主題：${items.filter(item => !item.label).map(item => item.slug).join('、')}`)
const labels = new Set(items.map(item => item.label))
// 有文章的主題不到兩類就不放這一排
if (labels.size < 2) expect(!chips.length, '只有一類有文章卻放了主題 chip')
else {
  expect(chips[0]?.label === '全部' && chips[0].current && !chips[0].category, '「全部」不是第一個，或不是目前那一個')
  expect(chips.length - 1 === labels.size && chips.slice(1).every(chip => labels.has(chip.label)), `chip 和有文章的主題對不上：${chips.map(chip => chip.label).join('、')}`)
}

for (const chip of chips.slice(1)) {
  const filtered = await page(`/blog?category=${chip.category}`)
  const shown = itemsOf(filtered.html)
  const current = chipsOf(filtered.html).filter(candidate => candidate.current)
  expect(shown.length === items.filter(item => item.label === chip.label).length && shown.every(item => item.label === chip.label),
    `?category=${chip.category} 列出的是：${shown.map(item => item.label).join('、')}`)
  expect(current.length === 1 && current[0].category === chip.category, `?category=${chip.category} 的目前那一個是 ${current.map(candidate => candidate.label).join('、') || '沒有'}`)
  expect(canonicalOf(filtered.html) === `${new URL(canonicalOf(all.html) ?? base).origin}/blog`, `?category=${chip.category} 的 canonical 是 ${canonicalOf(filtered.html)}`)
}

const unknown = itemsOf((await page('/blog?category=nope')).html)
expect(unknown.length === items.length, `不認得的主題沒有列出全部（${unknown.length}／${items.length}）`)

// 文章頁：主題連回列表的那一類，JSON-LD 的 articleSection 同名
for (const item of items) {
  const post = await page(`/blog/${item.slug}`)
  const anchor = post.html.match(/<a[^>]*blog-post__category[^>]*>[^<]*<\/a>/)?.[0] ?? ''
  const label = anchor.match(/>([^<]*)<\/a>$/)?.[1]
  const category = anchor.match(/href="\/blog\?category=([a-z_]+)"/)?.[1]
  expect(post.status === 200 && label === item.label && chips.some(chip => chip.category === category && chip.label === label),
    `/blog/${item.slug} 的主題連結是 ${label ?? '沒有'}（${category ?? '沒有網址'}）`)
  expect(post.html.includes(`"articleSection":"${item.label}"`), `/blog/${item.slug} 的 articleSection 不是 ${item.label}`)
  // 頁面自己有標題的 h1，內文不能再寫一次（2026-11-19 特別股兩篇的內文第一行就是 `# 標題`）
  const h1s = post.html.match(/<h1[\s>]/g)?.length ?? 0
  expect(h1s === 1, `/blog/${item.slug} 有 ${h1s} 個 h1`)
}

expect((await page('/blog/no-such-post')).status === 404, '不存在的文章沒有回 404')
// 網址代號格式不對的（大寫、底線）連業務中台都不問，直接 404
expect((await page('/blog/No_Such')).status === 404, '格式不對的網址代號沒有回 404')
// 網站地圖列出每一篇已發布的文章（2026-11-20 起由 server/api/__sitemap__/blog.get.ts 從業務中台讀）
const sitemap = await (await fetch(`${base}/api/__sitemap__/blog`, { signal: AbortSignal.timeout(60_000) })).json()
const listed = new Set(sitemap.map(entry => entry.loc))
expect(items.every(item => listed.has(`/blog/${item.slug}`)) && sitemap.length === items.length, `網站地圖的文章跟列表對不上：${sitemap.map(entry => entry.loc).join('、')}`)

console.log(failures.length ? failures.map(failure => `FAIL ${failure}`).join('\n') : `ok   ${items.length} 篇、${labels.size} 個主題`)
process.exit(failures.length ? 1 : 0)
