// Verification for the hub pages of the 2026-09-19 SEO build（/stock 個股總表, /industry/…, and
// later /rank/…, /screener/{slug}, /metrics/…）plus the landing page's new link sections — the
// sibling of check-stock-pages.mjs. Run with `node scripts/check-hub-pages.mjs` against a running
// `pnpm run dev`（HUB_PAGES_URL / HUB_PAGES_WIDTH to override）. Cookie-less contexts on purpose:
// that is what every crawler and first-time visitor gets.
//
// Per route, the server-rendered HTML must have: exactly one <h1>; an h1→h2→h3 outline with no
// skipped level; a <title> ending with the brand and ≤ 32 CJK-equivalent characters; a meta
// description of 60–90 CJK-equivalent characters; a self canonical without a query; BreadcrumbList
// JSON-LD; no internal href carrying a `?`（view state never becomes a URL variant — the
// screener deep links are the one deliberate exception and are allow-listed）; none of the
// compliance register's banned words outside <script>（backend-owned phrases are reported, not
// failed）; and the per-route link/table expectations below. After hydration: no page error, no
// console message mentioning Hydration, the SSR text of every [data-ssr-table] identical to the
// live text, and axe（wcag2a/wcag2aa/best-practice）clean. Status expectations（404 for unknown
// codes/slugs, 301 for a stale sector slug）are checked without a browser.
import { BANNED_WORDS_PATTERN } from '../shared/utils/compliance-words.ts'
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const baseUrl = process.env.HUB_PAGES_URL ?? 'http://localhost:3000'
const width = Number(process.env.HUB_PAGES_WIDTH ?? 1440)

// Emptied 2026-09-20: all three entries (股利穩健, 股價偏低, 不代表便宜或該買) were allowances for
// analysis-ts's own copy, and analysis-ts has since rewritten every one of them — they built the
// same banned-word regex into a pre-push scan on their side (20d5ba4b), so backend copy is now
// linted at its source rather than excused at ours. Verified here first, not taken on report: all
// three are gone from GET /metrics and GET /stocks/:symbol/badges, and both check scripts run
// clean with this list empty. Kept as an empty hook rather than deleted, since the next piece of
// compliance-reviewed backend phrasing that trips the regex will need it again.
const BACKEND_OWNED = []
const QUERY_LINK_ALLOW = [/^\/screener\?(sector|template)=/]

// Routes: expectations on the SSR HTML beyond the shared checks.
const ROUTES = [
  { path: '/', stockLinksMin: 0, industryLinksMin: 30, tablesMin: 0 },
  // Rebuilt 2026-09-19 (interface-complexity review) into a 35-row sector table — no more
  // per-company links on this page (they moved entirely to /industry/…), hence stockLinksMin: 0.
  { path: '/stock', stockLinksMin: 0, industryLinksMin: 30, tablesMin: 1 },
  { path: '/industry/24-semiconductor', stockLinksMin: 100, industryLinksMin: 30, tablesMin: 1 },
  // /industry/13-electronics-legacy was listed here as the thin-sector case（noindex, ≥5 stock
  // links）until 2026-09-22, when it became a real 404. Not a regression: twse-ts found its
  // company_profile held both listed（source='COMPANY_PROFILE'）and unlisted-public
  //（'COMPANY_PROFILE_PUBLIC', ~305）companies, and every one of sector 13's 32 was the latter.
  // analysis-ts e3590506 made the directory listed-only（2,653 → 2,349）, so 13 has no members and
  // getSectors drops it. It now belongs in STATUS_CASES below as an expected 404.
  // 8 → 7 on 2026-09-22, when consecutive-dividend-years was pulled（RANK_PAGES has the reason）.
  // Goes back to 8 with that page, ~2027 Q1.
  { path: '/rank', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 0, rankLinksMin: 8 },
  { path: '/rank/dividend-yield', stockLinksMin: 50, industryLinksMin: 0, tablesMin: 1, disclaimer: true },
  // The two app pages: no visible breadcrumb（所以沒有 BreadcrumbList — the JSON-LD must match what
  // is on the page). /screener's own axeIgnore for the guest onboarding el-dialog's landmark nit
  // was removed 2026-09-19 — that dialog is gone (see useGuestScreener.ts's own comment), so
  // there's no longer anything on load that trips those rules.
  { path: '/screener', stockLinksMin: 0, industryLinksMin: 30, tablesMin: 0, templateLinksMin: 7, noDescriptionWindow: true, noBreadcrumb: true },
  { path: '/screener/value', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1, disclaimer: true, noStockLinks: true },
  { path: '/industries', stockLinksMin: 0, industryLinksMin: 30, tablesMin: 0, noDescriptionWindow: true, noBreadcrumb: true },
  // 殖利率分析（2026-10-01 從 /industries 拆出來）。跟它的兄弟頁同樣沒有麵包屑，tablesMin 0
  // 也是刻意的：它的工作是那張圖，逐類股的數字在 /industries，硬塞一張重複的表只是為了過檢查。
  { path: '/industries/dividend', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 0, noDescriptionWindow: true, noBreadcrumb: true },
  // /macro/policy-rate（2026-09-21, moved 09-22）— the first market-wide page that links to no
  // company and no sector,
  // so both link floors are 0 on purpose rather than by oversight. Its one table is the 56-row
  // rate-decision history, which is also the page's indexable content.
  { path: '/macro', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/macro/policy-rate', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  // /macro/us-policy-rate（2026-09-29）— 同一種形狀的第二頁，列進來而不是抽樣，因為它是這一區
  // 唯一一頁的序列不是台灣的（利率是美國的、線是台股的），文案要扛的東西跟其他頁不同。
  { path: '/macro/us-policy-rate', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/macro/ecb-policy-rate', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/macro/equity-risk-premium', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  // /macro/market-events（2026-09-22）— the zone's other own-route page, listed explicitly for the
  // same reason policy-rate is: it is not on the [slug] template, so sampling that template's
  // members would never reach it.
  { path: '/macro/market-events', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  // 總經特區's other six, all on the one /macro/[slug] template. Sampled rather than exhaustive
  // would have been tempting, but each carries a different upstream contract（two of them take
  // category, one follows the daily tradeDate shape instead of period）and the exchange-rate page
  // shipped broken for exactly that reason before this list caught it by hand.
  { path: '/macro/business-cycle', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/macro/money-supply', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/macro/bond-yield', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/macro/exchange-rate', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/macro/inflation', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/macro/gdp-growth', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 1 },
  { path: '/metrics', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 7, metricLinksMin: 1 },
  { path: '/metrics/piotroski-f-score', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 0, noStockLinks: true },
  // roe/gross-margin joined METRIC_PAGE_SLUGS 2026-09-20 (the badge-page family) — no longer
  // noindex, so the shared description-length window (60–90 CJK) now applies for real.
  { path: '/metrics/roe', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 0, noStockLinks: true },
  { path: '/metrics/gross-margin', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 0, noStockLinks: true },
  // liveGrahamNumber deliberately NOT in METRIC_PAGE_SLUGS yet — see that array's own comment
  // (hub-slugs.ts): its meta description truncates under the 60-CJK floor once
  // clampDescription(text, 90) runs on its ASCII-heavy raw text. `noindex: true` here both
  // documents that as a known, accepted gap and skips the description-length assertion (same as
  // every other noindex route in this list), rather than silently exempting just this one check.
  { path: '/metrics/live-graham-number', stockLinksMin: 0, industryLinksMin: 0, tablesMin: 0, noStockLinks: true, noindex: true }
]

const STATUS_CASES = [
  { path: '/industry/24-wrong', status: 301, location: '/industry/24-semiconductor' },
  { path: '/industry/99-x', status: 404 },
  // A registered sector code with zero LISTED members — see the ROUTES comment above.
  { path: '/industry/13-electronics-legacy', status: 404 },
  { path: '/industry/19-conglomerate', status: 404 },
  { path: '/industry/abc', status: 404 },
  { path: '/rank/nope', status: 404 },
  { path: '/screener/nope', status: 404 },
  { path: '/metrics/nope', status: 404 },
  // camelCase input must not become a second URL for the same page.
  { path: '/metrics/piotroskiFScore', status: 404 },
  // The badge-page catch-all (app/pages/stock/[code]/[slug].vue, 2026-09-20) must throw a real
  // 404 on an unrecognized slug, not render an empty page — this is what stops it from silently
  // swallowing a typo'd URL the same way the named sub-routes' own 404s work.
  { path: '/stock/2330/nope', status: 404 }
]

const DISCLAIMER = '本頁面提供之客觀排行與指標統計僅供研究參考，非屬投顧法之推薦買賣建議，使用者應獨立審慎評估風險。'

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '')
}

function cjkLength(text) {
  let length = 0
  for (const char of text) length += /[　-鿿＀-￯]/.test(char) ? 1 : 0.5
  return length
}

function outlineIsValid(order) {
  let previous = 0
  for (const level of order) {
    if (level > previous + 1) return false
    previous = level
  }
  return true
}

// The site footer's legal disclaimer says「不構成…目標價」— a negation of a banned word, on every
// page; the scan covers the page's own content, so the <footer> is dropped first.
function visibleText(html) {
  return stripComments(html)
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
}

// innerText (the live side of the 'tables stable' comparison) gives DECODED text, so the SSR side
// has to decode too or any table holding a character Vue's SSR escapes fails the comparison for a
// reason that has nothing to do with hydration. Found 2026-09-20: analysis-ts merged its O'Neil
// badges into one `oneilCanslimScore`, whose 顯示名稱 carries an apostrophe — SSR renders it
// `O&#39;Neil`, innerText reads `O'Neil`, and /metrics went red with a 7/7 count match. &amp; is
// decoded last so an escaped entity (`&amp;#39;`) doesn't get double-decoded into a real one.
function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function tableTexts(html) {
  return [...stripComments(html).matchAll(/<table[^>]*data-ssr-table[^>]*>([\s\S]*?)<\/table>/g)].map(match => decodeEntities(match[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
}

const failures = []
function expect(route, name, ok, detail = '') {
  if (!ok) failures.push(`${route} ${name}${detail ? ` (${detail})` : ''}`)
}

// 記下 bff-ts 對 POST /screener 回了什麼，放進下面兩個子測試的失敗訊息裡。
//
// 2026-10-02 查「連兩輪逾時 120 秒」時用真瀏覽器抓到的是 `POST localhost:4000/screener → 502`，
// 而腳本原本只印 `rows: 0`：那個訊息分不出「上游拒答」跟「我們的頁面壞了」，所以我整天在找時序
// 規律、方向從頭就錯了。screener 的查詢是瀏覽器直打 bff-ts（不經我們的 Nitro 快取），所以頁面能
// 做的事到不了那裡。
//
// 這不是再加一條規律——那個 502 重現不了（同一個 request body 直打 70 次全 200、8 並發也全 200，
// 3～9 秒）。這是讓下一次失敗自己說出原因。
function watchScreenerCalls(page) {
  const seen = []
  page.on('response', response => {
    if (response.request().method() === 'POST' && response.url().includes('/screener')) seen.push(response.status())
  })
  return seen
}

const screenerCallText = seen => `bff-ts 回 ${seen.length ? seen.join('/') : '（沒被呼叫）'}`

for (const { path, status, location } of STATUS_CASES) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' })
  expect(path, `status ${status}`, response.status === status, `got ${response.status}`)
  if (location) expect(path, 'redirect target', (response.headers.get('location') ?? '').endsWith(location), response.headers.get('location') ?? '')
}

const browser = await chromium.launch()
// ⚠️ **這兩個 screener 子測試會偶發失敗，而且 2026-10-01 一整天沒有找出可預測的規律。**
// 它們自己會重試一次（見下面那一段），但重試沒有讓偶發失敗歸零。
//
// 當天試過四種假設，每一個都先成立再被推翻——**包括兩個我已經寫進這個檔案又拿掉的**：
//
//     移到 ROUTES 迴圈之前    有幫助，但不是每次
//     重啟開發伺服器          沒幫助
//     暖機後等 45 秒          先 PASS，下一輪 FAIL
//     完全不暖機              連過 3 次，之後仍然失敗 1 次
//     加上重試之後再暖機       先 FAIL，緊接著同一台伺服器又 PASS
//
// 最後那一行是關鍵：**同樣的條件連續兩次得到相反結果**，所以它不是任何一個條件造成的。
// 它依賴的是「開發伺服器編譯完 screener 的 client bundle」加上「bff 當下不忙」，兩件都不是這支
// 腳本控制得了的。**所以不要再找規律，也不要照某個協定安排呼叫順序**——那是我那天花掉最多輪
// 而且產出兩條錯規則的地方。
//
// **FAIL 的時候這樣確認**：單獨開那一頁，用這支腳本自己的選擇器
// （`.el-table__body .el-table__row`）數列數。穩定是 20 列、第一列約 6.0 秒。確認完不要改頁面。
//
// **兩個 screener 子測試故意跑在 ROUTES 迴圈之前**（2026-10-01）。它們會在瀏覽器裡觸發一次真的
// screener 查詢（實測直打 bff 要 2.6~5.3 秒），而開發伺服器在跑完上面那 22 條 hub 路由之後會慢到
// 讓第一列 60 秒都出不來——2026-09-28 的註解就記過同一個現象，當時的結論是「單獨跑這一支再確認」。
//
// 今天第三次踩到之後改成從源頭避開：重啟開發伺服器沒用，因為拖慢它的 22 條路由就在這支腳本自己
// 裡面。把這兩個區塊移到最前面，它們拿到的是最乾淨的伺服器狀態。實測單獨跑時用這支腳本自己的
// 選擇器（.el-table__body .el-table__row）數得到 20 列，所以失敗從來不是頁面的問題。
//
// 這不是把斷言放寬——逾時仍然是 FAIL、仍然印出等了多久。改的只是執行順序。
// Deep link from a condition page: a guest landing on /screener?template=value gets that
// template's tab（no onboarding dialog）, real result rows, the guest banner, and a URL with the
// query dropped once applied.
{
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(String(error).slice(0, 160)))
  const screenerCalls = watchScreenerCalls(page)
  await page.goto(`${baseUrl}/screener?template=value`, { waitUntil: 'load', timeout: 180000 })
  await page.locator('.screener-page__guest-banner').waitFor({ state: 'visible', timeout: 60000 }).catch(() => {})
  // Was a flat 8s until 2026-09-22, when this check started failing intermittently on「result
  // rows (0)」while the page itself was fine — verified by loading it twice by hand and getting 20
  // rows both times. The screener runs a LIVE query against bff-ts on mount, and bff-ts spent that
  // day recomputing（DuPont four-decimal rerun, three market-wide backfills）, so 8s stopped being
  // enough. Waiting for the rows to exist rather than for a fixed duration removes the guess: it
  // returns as soon as they render and only spends the full budget when something is genuinely
  // wrong.
  // 逾時不要吞掉（2026-09-28）。原本是 `.catch(() => {})`，於是「第一列 60 秒沒出現」跟「頁面真的是空的」
  // 印出來一模一樣，都是 result rows (0)。實際踩到：這一支單獨跑 PASS、接在兩輪 check-stock-pages 後面跑
  // FAIL，而同一時間用瀏覽器手動開是穩定 20 列（第一列約 5.7 秒出現，之後 8 秒內不變）。差別是開發伺服器
  // 跑過 22 條 hub 路由之後變慢，不是頁面壞掉。記下等了多久，讓下一個人一眼看得出是哪一種。
  // 逾時重載一次再等（2026-10-01）。這不是把斷言放寬：真的壞掉的頁面兩次都會失敗，而**一次**
  // 逾時已經被證明不代表頁面壞掉——同一天用這支腳本自己的選擇器單獨量，穩定 20 列、第一列 6.0 秒。
  //
  // 為什麼是重試而不是放寬：這個子測試依賴「bff 當下回得出來」，而那不是這支腳本控制得了的。
  //
  // **條件 2026-10-02 查出來了，而且很具體：先跑過 check-stock-pages 就會失敗。**
  // 計次：單獨跑 2 次全 PASS；跑在 check-stock-pages（69 條路由）之後 4 次全 FAIL，而且四次都是
  // `bff-ts 回 502`。中間隔多久、是不是串在同一條指令裡都沒有影響——隔了好幾分鐘再單獨跑 hub
  // 仍然失敗，所以關鍵是 bff 被那 69 條路由打完之後的狀態，不是這支腳本自己的時序。
  //
  // 所以操作上**兩支檢查要分開跑、而且 hub 先跑**。先前那條「移到最前面沒用、不要找規律」的結論
  // 是我在失敗訊息只有 `rows: 0` 的時候下的——看不見上游狀態，就只能猜時序，方向從頭就錯了
  // （見上面 watchScreenerCalls 的註解）。
  //
  // 逾時的數字是確定的：bff-ts 的 `ANALYSIS_SERVICE_TIMEOUT_MS = 10_000`（他們 2026-10-02 回報）。
  // 而且因為我們的 columns 含 `stock.price`，一個請求會觸發**兩次循序的上游呼叫、各自 10 秒上限**
  // （screener 查詢，再加一次 getLatestClosePrices 把股價併進每一列），所以最壞接近 20 秒才失敗，
  // 而 502 不會告訴你是哪一次越界的。
  //
  // **我原本寫「這條查詢特別慢（6～9 秒）所以貼著上限」是錯的，那是負載造成的假象。**
  // 我分別量了慢查詢與對照組——量前者時系統載著、量後者時閒著——於是得到 12～18 倍的落差。
  // bff-ts 指出我的對照組同時換了篩選欄位與有無 stock.price，兩個變數沒隔離。改成四種組合在
  // 同一輪內交錯打、比較配對差值（14 輪、56 次呼叫、零 502）：
  //
  //   grahamNumber 相對 peRatio   配對中位 +262ms（含 price）／+241ms（無 price）
  //   stock.price 的代價           配對中位 +237ms（graham）／+244ms（peRatio）
  //   A/D 中位數比值               1.30，不是 12～18
  //
  // 基線是**每一種組合都約 1.9～2.4 秒**。所以沒有哪一條查詢特別貼著上限；真正的機制是這台機器上
  // 三個服務共用同一個本機上游，負載可以把約 2 秒乘上四、五倍越過 10 秒——bff-ts 在重載時量到
  // 連那條「0.5 秒」的對照組都要 8.18 秒。
  //
  // 於是這個子測試的失敗條件也有了正確的解釋：**拖垮它的負載是我們自己的 check-stock-pages**
  // （69 條路由打同一個本機上游），不是 bff 的隨機故障，也不在部署環境會發生。
  // 已排除：request body、headers、viewport、瀏覽器 vs curl、單純的持續併發。
  // 2026-10-08：結果區塊寬 < 720px 時 SharedMetricTable 是卡片、el-table 的列在 DOM 裡但 0×0（container query），所以等「可見的
  // 表格列或卡片（.smt-card，不是卡片區本身：空狀態的 <p> 也是它的可見子元素）」其中一種；重試時要回到帶 ?template= 的網址——頁面消費掉 query 之後 reload 會落在沒選策略的空狀態。
  const waitForFirstRow = () => page.locator('.el-table__body tbody tr:visible, .smt-card:visible').first()
    .waitFor({ state: 'visible', timeout: 60000 }).then(() => true).catch(() => false)
  const rowWaitStart = Date.now()
  let rowWaitTimedOut = false
  let rowWaitRetried = false
  if (!await waitForFirstRow()) {
    rowWaitRetried = true
    await page.goto(`${baseUrl}/screener?template=value`, { waitUntil: 'load', timeout: 180000 })
    rowWaitTimedOut = !await waitForFirstRow()
  }
  const rowWaitMs = Date.now() - rowWaitStart
  await page.waitForTimeout(2000)
  const state = await page.evaluate(() => ({
    banner: !!document.querySelector('.screener-page__guest-banner'),
    dialogOpen: !!document.querySelector('.el-dialog[aria-modal="true"]'),
    rows: document.querySelectorAll('.el-table__body .el-table__row').length,
    search: location.search
  }))
  expect('/screener?template=value', 'guest tab from template', state.banner && !state.dialogOpen, `${JSON.stringify(state)} ${screenerCallText(screenerCalls)}`)
  expect('/screener?template=value', 'result rows', state.rows > 0, rowWaitTimedOut ? `${state.rows}；重載一次後等第一列共 ${rowWaitMs}ms 仍逾時，${screenerCallText(screenerCalls)}` : `${state.rows}（第一列 ${rowWaitMs}ms${rowWaitRetried ? '，重載過一次' : ''}）`)
  expect('/screener?template=value', 'query dropped', state.search === '', state.search)
  expect('/screener?template=value', 'no page errors', pageErrors.length === 0, pageErrors.join(' | '))
  console.log(`/screener?template=value: ${failures.some(failure => failure.startsWith('/screener?template=value ')) ? 'FAIL' : 'ok'}`)
  await context.close()
}
// Guest strategy picker (2026-09-19, replacing the old onboarding dialog — interface-complexity
// review): no dialog opens on load, the picker's own tiles are in the page, and picking one +
// confirming produces the same guest banner + result rows the deep-link case above gets.
{
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(String(error).slice(0, 160)))
  const pickerCalls = watchScreenerCalls(page)
  await page.goto(`${baseUrl}/screener`, { waitUntil: 'load', timeout: 180000 })
  await page.locator('.guest-picker__tile').first().waitFor({ state: 'visible', timeout: 60000 })
  const noDialogOnLoad = await page.evaluate(() => document.querySelector('.el-dialog[aria-modal="true"]') === null)
  expect('/screener (guest picker)', 'no dialog on load', noDialogOnLoad)
  const tileCount = await page.locator('.guest-picker__tile').count()
  expect('/screener (guest picker)', 'tiles ≥ 7', tileCount >= 7, `${tileCount}`)
  await page.locator('.guest-picker__tile').first().click()
  await page.locator('.guest-picker__confirm').click()
  await page.locator('.screener-page__guest-banner').waitFor({ state: 'visible', timeout: 60000 })
  // 2026-10-01：原本是固定等 8 秒再數列數——而那正是上面那個子測試 2026-09-22 就放棄的做法，
  // 當時的結論是「等到列出現，而不是等一個猜的秒數」。這一個一直沒跟著改，所以它每次失敗印出的
  // 是光禿禿的 `result rows after confirm (0)`，看不出是沒等夠還是真的空。
  // 現在跟上面同一套：等到第一列出現，逾時就重載一次再等，而且把等了多久印出來。
  const pickerWait = () => page.locator('.el-table__body .el-table__row:visible, .smt-card:visible').first()
    .waitFor({ state: 'visible', timeout: 60000 }).then(() => true).catch(() => false)
  const pickerStart = Date.now()
  let pickerRetried = false
  let pickerTimedOut = false
  if (!await pickerWait()) {
    pickerRetried = true
    // 重載會回到還沒選策略的狀態，所以要重走一次「選第一塊 → 確認」。
    await page.reload({ waitUntil: 'load', timeout: 180000 })
    await page.locator('.guest-picker__tile').first().waitFor({ state: 'visible', timeout: 60000 }).catch(() => {})
    await page.locator('.guest-picker__tile').first().click().catch(() => {})
    await page.locator('.guest-picker__confirm').click().catch(() => {})
    pickerTimedOut = !await pickerWait()
  }
  const pickerMs = Date.now() - pickerStart
  const rows = await page.locator('.el-table__body .el-table__row').count()
  expect('/screener (guest picker)', 'result rows after confirm', rows > 0, pickerTimedOut ? `${rows}；重載一次後共等 ${pickerMs}ms 仍沒有列，${screenerCallText(pickerCalls)}` : `${rows}（第一列 ${pickerMs}ms${pickerRetried ? '，重載過一次' : ''}）`)
  expect('/screener (guest picker)', 'no page errors', pageErrors.length === 0, pageErrors.join(' | '))
  console.log(`/screener (guest picker): ${failures.some(failure => failure.startsWith('/screener (guest picker) ')) ? 'FAIL' : 'ok'}`)
  await context.close()
}

for (const route of ROUTES) {
  const url = `${baseUrl}${route.path}`
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const pageErrors = []
  const hydrationMessages = []
  page.on('pageerror', error => pageErrors.push(String(error).slice(0, 160)))
  page.on('console', message => {
    if (/hydration/i.test(message.text())) hydrationMessages.push(message.text().slice(0, 160))
  })

  const ssrHtml = await (await page.request.get(url)).text()
  const ssr = stripComments(ssrHtml)
  const title = ssr.match(/<title>([^<]+)<\/title>/)?.[1] ?? ''
  const description = ssr.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''
  const canonical = ssr.match(/rel="canonical" href="([^"]*)"/)?.[1] ?? ''
  const robots = ssr.match(/name="robots" content="([^"]*)"/)?.[1] ?? ''
  const internalHrefs = [...ssr.matchAll(/href="(\/[^"]*)"/g)].map(match => match[1]).filter(href => !href.startsWith('/_nuxt') && !href.startsWith('/api/'))
  const text = visibleText(ssrHtml)
  const banned = [...new Set([...text.matchAll(BANNED_WORDS_PATTERN)].map(match => match[0]))]
  const backendOwned = BACKEND_OWNED.filter(phrase => text.includes(phrase))

  expect(route.path, 'one h1', (ssr.match(/<h1[\s>]/g) ?? []).length === 1)
  expect(route.path, 'outline', outlineIsValid([...ssr.matchAll(/<h([1-3])[\s>]/g)].map(match => Number(match[1]))))
  expect(route.path, 'title brand', title.endsWith('｜安盈選股') || route.path === '/', title)
  expect(route.path, 'title length ≤ 32', route.path === '/' || cjkLength(title) <= 32, `${cjkLength(title)}`)
  // Length window only for indexable pages（a noindex page still gets a description, just not a
  // search-snippet-tuned one）; the landing page keeps its own hand-written copy.
  expect(route.path, 'description 60–90', route.path === '/' || route.noindex || route.noDescriptionWindow || (cjkLength(description) >= 60 && cjkLength(description) <= 90), `${cjkLength(description)}`)
  expect(route.path, 'self canonical', canonical === `${baseUrl}${route.path}` && !canonical.includes('?'), canonical)
  expect(route.path, 'BreadcrumbList', route.path === '/' || route.noBreadcrumb || ssr.includes('"BreadcrumbList"'))
  if (route.metricLinksMin) expect(route.path, `metric links ≥ ${route.metricLinksMin}`, new Set(internalHrefs.filter(href => /^\/metrics\/[a-z0-9-]+$/.test(href))).size >= route.metricLinksMin)
  expect(route.path, 'no query links', internalHrefs.every(href => !href.includes('?') || QUERY_LINK_ALLOW.some(pattern => pattern.test(href))), internalHrefs.filter(href => href.includes('?')).slice(0, 3).join(' '))
  expect(route.path, 'no banned words', banned.every(word => backendOwned.some(phrase => phrase.includes(word))), banned.join(','))
  if (backendOwned.length) console.log(`${route.path}: backend-owned phrases present (warning): ${backendOwned.join(', ')}`)
  expect(route.path, `stock links ≥ ${route.stockLinksMin}`, new Set(internalHrefs.filter(href => /^\/stock\/\d{4}$/.test(href))).size >= route.stockLinksMin)
  expect(route.path, `industry links ≥ ${route.industryLinksMin}`, new Set(internalHrefs.filter(href => href.startsWith('/industry/'))).size >= route.industryLinksMin)
  expect(route.path, `tables ≥ ${route.tablesMin}`, (ssr.match(/<table[^>]*data-ssr-table/g) ?? []).length >= route.tablesMin)
  expect(route.path, 'no Product/AggregateRating', !ssr.includes('"Product"') && !ssr.includes('"AggregateRating"'))
  if (route.rankLinksMin) expect(route.path, `rank links ≥ ${route.rankLinksMin}`, new Set(internalHrefs.filter(href => /^\/rank\/[a-z-]+$/.test(href))).size >= route.rankLinksMin)
  if (route.templateLinksMin) expect(route.path, `template links ≥ ${route.templateLinksMin}`, new Set(internalHrefs.filter(href => /^\/screener\/[a-z-]+$/.test(href))).size >= route.templateLinksMin)
  // The compliance line sits in the page body（above the ranking table / at the end of a
  // condition page）, not only in the footer.
  if (route.disclaimer) expect(route.path, 'disclaimer in body', text.includes(DISCLAIMER))
  // A condition page shows a count, never the matching companies.
  if (route.noStockLinks) expect(route.path, 'no stock list', internalHrefs.every(href => !/^\/stock\/\d{4}$/.test(href)))
  expect(route.path, 'scroll regions labelled', [...ssr.matchAll(/class="shared-table-scroll[^>]*>/g)].every(match => match[0].includes('tabindex="0"') && match[0].includes('aria-label=')))
  if (route.noindex) expect(route.path, 'noindex, follow', robots.includes('noindex') && robots.includes('follow'), robots)

  await page.goto(url, { waitUntil: 'load', timeout: 180000 })
  await page.waitForTimeout(6000)
  const liveTables = await page.locator('table[data-ssr-table]').evaluateAll(tables => tables.map(table => table.innerText.replace(/\s+/g, ' ').trim()))
  const ssrTables = tableTexts(ssrHtml)
  expect(route.path, 'tables stable', ssrTables.length === liveTables.length && ssrTables.every((table, index) => table === liveTables[index]), `${ssrTables.length}/${liveTables.length}`)
  expect(route.path, 'no page errors', pageErrors.length === 0, pageErrors.join(' | '))
  expect(route.path, 'no hydration messages', hydrationMessages.length === 0, hydrationMessages.join(' | '))

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'best-practice']).analyze()
  const violations = axe.violations
    .filter(violation => !(route.axeIgnore ?? []).includes(violation.id))
    .map(violation => ({ id: violation.id, nodes: violation.nodes.filter(node => !node.target.some(target => String(target).includes('nuxt-devtools'))) }))
    .filter(violation => violation.nodes.length)
    .map(violation => `${violation.id}×${violation.nodes.length}`)
  expect(route.path, 'axe', violations.length === 0, violations.join(' '))

  console.log(`${route.path}: ${failures.some(failure => failure.startsWith(`${route.path} `)) ? 'FAIL' : 'ok'}`)
  await context.close()
}
await browser.close()

// A RANKING MUST ACTUALLY RANK. Added 2026-09-22, when /rank/consecutive-dividend-years turned out
// to be 台積電 followed by the 49 lowest stock codes among 889 companies all tied at 5 — a page that
// passed every check above while publishing an arbitrary subset of the market as an order.
//
// Two ways a field earns a tie like that, and this catches both. Some are censored by data depth
//（consecutiveDividendYears/consecutiveProfitYears bottom out on mops's 109Q3 XBRL floor and will
// free up once FY115 closes）; others are small integers by definition and never will
//（threeMarginsRising is 0–3, piotroskiFScore 0–9, dividendDistributionCount 1–4 — analysis-ts's
// own market-wide scan, 2026-09-22）. The assertion doesn't care which: if the 50 rows on the page
// span fewer than three distinct values, the ranking isn't ordering anything.
//
// This is the executable form of the restore condition written into RANK_PAGES. Re-adding a pulled
// ranking on the date alone would sail past review; re-adding it while it still ties fails here.
const rankSlugs = [...(await (await fetch(`${baseUrl}/rank`)).text()).matchAll(/href="\/rank\/([a-z0-9-]+)"/g)].map(match => match[1])
expect('/rank', 'rank slugs discovered', rankSlugs.length > 0, `${rankSlugs.length}`)
for (const slug of new Set(rankSlugs)) {
  const rows = (await (await fetch(`${baseUrl}/api/hub/rank/${slug}`)).json()).rows ?? []
  const distinct = new Set(rows.map(row => row.value).filter(value => value !== null)).size
  expect(`/rank/${slug}`, 'top 50 spans ≥ 3 distinct values', distinct >= 3, `${distinct} distinct in ${rows.length} rows`)
}

// 類股家數的三方對帳（2026-10-01）。畫面上同一個類股的家數出現在三個地方，而它們來自三個不同的
// 母體，今天剛好一致——而「今天剛好一致」正是最該自動盯著的那種狀態：
//
//   膠囊（首頁／screener）  getSectors()，自己數 directory 且排除興櫃
//   產業頁標頭              數那一頁真的列出幾家（screener 列數 ＋ 沒有 screener 列的成員）
//   /industries 的表格      上游 sector-dividend-summary 自己的 companyCount
//
// 為什麼需要這一條：2026-10-01 之前膠囊借的是型錄的 companyCount，而型錄含興櫃、產業頁從
// 2026-09-26 起不顯示興櫃——34 個類股裡 26 個的膠囊數字跟頁面列數不符，最大差 93（生技醫療業
// 膠囊 252、頁面 159）。那種落差不產生 404，所以 check-click-depth 抓不到，撐了五天沒人發現。
//
// 第三份（上游的）刻意留在斷言裡而不是只比自己那兩份：bff-ts 2026-10-01 實測它等於「排除興櫃、
// 排除 DR」，正好是我們要的那個母體——但那是上游的選擇不是契約。對帳的價值就在它哪天不再相等。
// 容許 ±4：實測「其他業」的 screener 有 4 檔 directory 沒歸在那一類，那是母體交集的真實差異，
// 不是我們算錯（要消掉它得對 34 個類股各跑一次 screener，冷快取時首頁會等兩分鐘）。
const hubSectors = await (await fetch(`${baseUrl}/api/hub/sectors`)).json()
const dividendSummary = await (await fetch(`${baseUrl}/api/hub/sector-dividend-summary`)).json()
const summaryCounts = new Map((dividendSummary.sectors ?? []).map(sector => [sector.sectorCode, sector.companyCount]))
expect('/api/hub/sectors', 'sectors discovered', hubSectors.length > 0, `${hubSectors.length}`)
for (const sector of hubSectors) {
  const page = await (await fetch(`${baseUrl}/api/hub/industry/${sector.code}`)).json()
  const listed = new Set([
    ...(page.companies?.rows ?? []).map(row => row.symbol),
    ...(page.unranked ?? []).map(company => company.symbol)
  ]).size
  expect(`/industry/${sector.code}`, 'header count == companies listed', page.sector?.companyCount === listed, `header ${page.sector?.companyCount} vs listed ${listed}`)
  expect(`/industry/${sector.code}`, 'chip count within 4 of the page', Math.abs(sector.companyCount - listed) <= 4, `chip ${sector.companyCount} vs page ${listed}`)
  const summary = summaryCounts.get(sector.code)
  expect(`/industry/${sector.code}`, 'upstream dividend-summary count agrees', summary === undefined || summary === sector.companyCount, `summary ${summary} vs chip ${sector.companyCount}`)
}

if (failures.length) {
  console.log('FAILURES:')
  for (const failure of failures) console.log(`  ${failure}`)
  process.exit(1)
}
console.log('PASS: hub pages')
