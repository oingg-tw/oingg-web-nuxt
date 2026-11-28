// 讀取失敗提示的行為檢查（2026-10-11，使用者：「太容易跳出來了，而且也不會自關掉」）。對著跑著的 `pnpm run dev`：
//   node scripts/check-load-failure.mjs            （LOAD_FAILURE_URL／LOAD_FAILURE_WIDTH 可覆寫；LOAD_FAILURE_ONLY=橫幅 只跑名字裡有這兩個字的情境）
// Cookie 說明只有正式建置才出現（useAnalyticsConsent 的 asks）：提示有沒有讓開它，要把 LOAD_FAILURE_URL 指到正式建置才驗得到。
// 只能攔瀏覽器發出的請求，所以每個情境挑的都是瀏覽器端的讀取：個股子頁「客戶端換頁」時的 /api/stock/…、
// ETF 專區掛上後才送的 POST /etf-screener、每頁都在瀏覽器抓的公司索引 GET /securities；全站橫幅是讓公司索引失敗、再假造 /api/system-health
//（2026-11-27 起橫幅只在訪客自己的讀取失敗時才查，平常不問）。
// 時間點跟著 LOAD_FAILURE_GRACE_MS（8 秒）與第一次退避（5 秒，隨機多等最多一半：5～7.5 秒）走，改了那兩個要一起改這裡。
import { chromium } from 'playwright'

const baseUrl = process.env.LOAD_FAILURE_URL ?? 'http://localhost:3000'
const width = Number(process.env.LOAD_FAILURE_WIDTH ?? 1440)
const GRACE_MS = 8_000
const only = process.env.LOAD_FAILURE_ONLY

const browser = await chromium.launch()
const failures = []
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const fail502 = route => route.fulfill({ status: 502, contentType: 'application/problem+json', body: JSON.stringify({ title: 'Bad Gateway', status: 502 }) })

async function scenario(name, run) {
  if (only && !name.includes(only)) return
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const dialog = page.getByRole('dialog', { name: '資料暫時讀不到' })
  const notice = page.locator('.load-failure-notice')
  try {
    await run({ page, dialog, notice })
    console.log(`ok   ${name}`)
  } catch (error) {
    failures.push(name)
    console.log(`FAIL ${name}: ${error.message}`)
  } finally {
    await context.close()
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message)
}

// 客戶端換頁：伺服器端已渲染的頁面不會再打一次，換頁才會從瀏覽器送 /api/stock/…
async function clientNavigate(page, path) {
  await page.evaluate(target => document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push(target), path)
}

async function openStock(page) {
  await page.goto(`${baseUrl}/stock/2330`, { waitUntil: 'networkidle', timeout: 120_000 })
}

// 公司索引：桌機的搜尋框一開頁就抓；手機的搜尋收在按鈕後面（AppMobileHeader），打開才抓，打開後關回來才按得到頁面上的東西
async function loadCompanyIndex(page) {
  if (width >= 1280) return
  await page.locator('button[title="搜尋區塊"]:visible').click()
  await wait(1_000)
  await page.keyboard.press('Escape')
}

await scenario('一次 502 後恢復：寬限期內默默重試，什麼都不顯示', async ({ page, dialog, notice }) => {
  await openStock(page)
  let hits = 0
  await page.route('**/api/stock/2330/dupont', route => (++hits === 1 ? fail502(route) : route.continue()))
  await clientNavigate(page, '/stock/2330/dupont')
  await wait(GRACE_MS + 4_000)
  expect(hits >= 2, `沒有重試（請求 ${hits} 次）`)
  expect(!(await dialog.isVisible()) && !(await notice.isVisible()), '出現了提示')
})

await scenario('主要資料持續 502：寬限期後才開彈窗，恢復後自己關', async ({ page, dialog }) => {
  await openStock(page)
  await page.route('**/api/stock/2330/dupont', fail502)
  await clientNavigate(page, '/stock/2330/dupont')
  await wait(GRACE_MS - 3_000)
  expect(!(await dialog.isVisible()), '寬限期內就開了彈窗')
  await dialog.waitFor({ state: 'visible', timeout: 8_000 })
  // 網站有回應（502）＝我們的問題，要講明不是用戶的網路（2026-11-19）
  expect(/我們的系統/.test(await dialog.locator('.load-failure__message').innerText()), '502 沒有說是我們的系統')
  await page.unroute('**/api/stock/2330/dupont')
  await dialog.waitFor({ state: 'hidden', timeout: 20_000 })
})

// 網站完全沒回應、瀏覽器卻以為有網路（連著上不了網的 Wi-Fi）：說可能是用戶的網路，不說成我們的系統（2026-11-19）
await scenario('網站沒回應、瀏覽器以為有網路：說可能是用戶的網路', async ({ page, dialog }) => {
  await openStock(page)
  await page.route('**/api/stock/2330/dupont', route => route.abort('internetdisconnected'))
  await clientNavigate(page, '/stock/2330/dupont')
  await dialog.waitFor({ state: 'visible', timeout: GRACE_MS + 8_000 })
  const message = await dialog.locator('.load-failure__message').innerText()
  expect(/確認一下網路連線/.test(message) && !/我們的系統/.test(message), `說法不對：${message}`)
  await page.unroute('**/api/stock/2330/dupont')
  await dialog.waitFor({ state: 'hidden', timeout: 20_000 })
})

await scenario('次要資料持續失敗：只有右下角提示，不開阻斷彈窗', async ({ page, dialog, notice }) => {
  // 公司索引 2026-10-16 起只有 GET /securities 一個來源（useCompanyIndex；原本是三個，這裡沒跟著改，之後這個情境一直是假失敗）
  await page.route(url => url.pathname === '/api/cached/securities', fail502)
  await openStock(page)
  await loadCompanyIndex(page)
  await notice.waitFor({ state: 'visible', timeout: GRACE_MS + 8_000 })
  expect(!(await dialog.isVisible()), '次要資料開了阻斷彈窗')
  expect((await notice.getAttribute('role')) === 'status', '提示沒有 role="status"')
  await notice.getByRole('button', { name: '關閉讀取失敗提示' }).click()
  await notice.waitFor({ state: 'hidden', timeout: 2_000 })
})

await scenario('首次載入就失敗：彈窗有倒數、會自動重試，恢復後自己關', async ({ page, dialog }) => {
  let hits = 0
  const etfScreener = url => url.pathname === '/api/core/etf-screener'
  await page.route(etfScreener, (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    hits += 1
    return fail502(route)
  })
  await page.goto(`${baseUrl}/screener/etf`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await dialog.waitFor({ state: 'visible', timeout: GRACE_MS + 15_000 })
  const before = await dialog.locator('.load-failure__status').innerText()
  expect(/秒後/.test(before), `沒有倒數：${before}`)
  await wait(2_000)
  const after = await dialog.locator('.load-failure__status').innerText()
  expect(before !== after, `倒數沒在走：${after}`)
  const hitsAtOpen = hits
  await wait(7_000)
  expect(hits > hitsAtOpen, '彈窗開著之後沒有自動重試')
  await page.unroute(etfScreener)
  await dialog.waitFor({ state: 'hidden', timeout: 30_000 })
})

await scenario('不存在的代號（4xx）：頁面自己說，不開彈窗', async ({ page, dialog, notice }) => {
  await page.goto(`${baseUrl}/stock/abcd`, { waitUntil: 'networkidle', timeout: 120_000 })
  await wait(GRACE_MS + 4_000)
  expect(!(await dialog.isVisible()) && !(await notice.isVisible()), '出現了讀取失敗提示')
})

await scenario('先關閉：同一批不再彈出，新的主要資料失敗才再開', async ({ page, dialog }) => {
  await openStock(page)
  await page.route('**/api/stock/2330/dupont', fail502)
  await clientNavigate(page, '/stock/2330/dupont')
  await dialog.waitFor({ state: 'visible', timeout: GRACE_MS + 8_000 })
  await dialog.getByRole('button', { name: '先關閉' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 2_000 })
  // 期間背景照樣重試（第一次退避 5 秒），同一批失敗不該再開
  await wait(8_000)
  expect(!(await dialog.isVisible()), '同一批失敗又彈出來')
  await page.route('**/api/stock/2330/margins', fail502)
  await clientNavigate(page, '/stock/2330/margins')
  await dialog.waitFor({ state: 'visible', timeout: GRACE_MS + 8_000 })
})

// 重連指南（2026-11-16）：背景分頁不排重試，回到前景立刻試一次。document.hidden 用覆寫的：無頭瀏覽器的分頁一直是前景
// 讀不到不等於沒有資料（全站慣例）。六面向的明細在數據中台改了定義、還沒重算完時回 503（經業務中台 502，2026-11-27）：
// 頁面與指標速覽的卡片原本都寫「目前沒有…的六面向資料」，那是 404（不在比較範圍）的說法
await scenario('個股輪廓（六面向）讀不到：卡片留空、頁面不說「目前沒有」，寬限期後開彈窗', async ({ page, dialog }) => {
  await page.route('**/api/cached/stocks/2330/radar-breakdown', fail502)
  await openStock(page)
  await wait(2_500)
  const card = await page.locator('.stock-quick-view-page__six').first().innerText()
  expect(card.trim() === '', `指標速覽的個股輪廓卡片寫了：${card.trim()}`)
  await clientNavigate(page, '/stock/2330/six-dimensions')
  await page.waitForURL('**/six-dimensions', { timeout: 30_000 })
  await wait(2_000)
  const main = await page.locator('main').innerText()
  expect(!main.includes('目前沒有'), '頁面在讀不到的時候說了「目前沒有」')
  await dialog.waitFor({ state: 'visible', timeout: GRACE_MS + 6_000 })
})

// 景氣循環度（2026-11-28）同六面向：讀不到（上游重算中的 502）不寫 404 那句「不在比較範圍裡」，也不寫沒有分數的原因。卡片不在預設裡，先釘
await scenario('景氣循環度讀不到：卡片留空、頁面不說「不在比較範圍」，寬限期後開彈窗', async ({ page, dialog }) => {
  await page.route('**/api/cached/stocks/2330/cyclicality-breakdown', fail502)
  await openStock(page)
  await page.getByRole('button', { name: '加入指標' }).click()
  const picker = page.getByRole('dialog', { name: '加入指標' })
  await picker.waitFor()
  await picker.getByRole('button', { name: /^景氣循環度$/ }).click()
  await page.keyboard.press('Escape')
  await picker.waitFor({ state: 'hidden' })
  await wait(2_500)
  const card = await page.locator('.stock-quick-view-page__cell[data-slug="cyclicality"] .el-card__body').innerText()
  expect(card.trim() === '', `指標速覽的景氣循環度卡片寫了：${card.trim()}`)
  await clientNavigate(page, '/stock/2330/cyclicality')
  await page.waitForURL('**/cyclicality', { timeout: 30_000 })
  await wait(2_000)
  // 只看第一段：頁尾的定義本來就寫「興櫃公司不在比較範圍裡」
  const first = await page.locator('#stock-cyclicality').innerText()
  expect(!first.includes('不在比較範圍') && !first.includes('算不出景氣循環度'), `頁面在讀不到的時候寫了沒有分數的句子：${first.replace(/\s+/g, ' ').slice(0, 80)}`)
  await dialog.waitFor({ state: 'visible', timeout: GRACE_MS + 6_000 })
})

const setHidden = (page, hidden) => page.evaluate((isHidden) => {
  if (isHidden) {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
  } else {
    delete document.hidden
    delete document.visibilityState
  }
  document.dispatchEvent(new Event('visibilitychange'))
}, hidden)

await scenario('背景分頁：不自動重試，回到前景立刻重試', async ({ page, dialog }) => {
  await openStock(page)
  let hits = 0
  await page.route('**/api/stock/2330/dupont', (route) => {
    hits += 1
    return fail502(route)
  })
  await clientNavigate(page, '/stock/2330/dupont')
  await dialog.waitFor({ state: 'visible', timeout: GRACE_MS + 8_000 })
  await setHidden(page, true)
  const hitsHidden = hits
  // 比第一次退避的上限（7.5 秒）長
  await wait(9_000)
  expect(hits === hitsHidden, `背景分頁照樣重試（${hits - hitsHidden} 次）`)
  await setHidden(page, false)
  await wait(1_500)
  expect(hits > hitsHidden, '回到前景沒有立刻重試')
  expect(/秒後|正在重新連線/.test(await dialog.locator('.load-failure__status').innerText()), '回到前景後沒有接著倒數')
})

// navigator.onLine 不可靠：瀏覽器說沒網路、其實連得上時，原本只等 online 事件，永遠不會自己好
await scenario('瀏覽器說沒網路但其實連得上：照樣自動重試，恢復後自己關', async ({ page, dialog }) => {
  await openStock(page)
  await page.evaluate(() => Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false }))
  await page.route('**/api/stock/2330/dupont', fail502)
  await clientNavigate(page, '/stock/2330/dupont')
  // 斷線不等寬限期
  await dialog.waitFor({ state: 'visible', timeout: 8_000 })
  expect(/偵測不到網路連線/.test(await dialog.locator('.load-failure__message').innerText()), '沒有說是網路的問題')
  // 等寬限期的兩次背景重試（最晚第 4 秒）都過了，才讓它恢復：要驗的是之後的排程重試
  await wait(4_200)
  await page.unroute('**/api/stock/2330/dupont')
  await dialog.waitFor({ state: 'hidden', timeout: 25_000 })
})

// 連不上伺服器的橫幅（AppSystemHealthBanner，2026-10-21）：第一次健康檢查在 onNuxtReady 之後，橫幅永遠比元件晚出現——原本在
// onMounted 量高度，從來沒量到，橫幅一直蓋住頁面最上面。對比也量：字 ≥ 4.5:1、底線對頁面底 ≥ 3:1（原本深色模式的字只有 3.06:1）
const luminance = color => color.match(/\d+/g).slice(0, 3).map(value => value / 255)
  .map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

// 全站橫幅只在訪客自己的讀取失敗、重查確認上游不健康時才出現（2026-11-27，使用者：「這個訊息跟網站正常使用同時發生了 why?」→ 選
// 「失敗才出現」；原本每 30 秒問一次，上游不健康就出現，頁面有快取、沒受影響的人也看到）。下面每個情境都讓公司索引失敗來觸發
const failCompanyIndex = (page, respond = fail502) => page.route(url => url.pathname === '/api/cached/securities', respond)

await scenario('上游不健康、這位訪客沒有請求失敗：不問健康狀態、不出現橫幅', async ({ page }) => {
  await page.addInitScript(() => {
    const tick = () => {
      if (document.querySelector('.app-system-health-banner')) window.__bannerSeen = true
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  let asked = 0
  await page.route('**/api/system-health**', (route) => {
    asked++
    return route.fulfill({ json: { ok: false } })
  })
  // 這個情境要的是「沒有請求失敗」：本機上游剛好在重啟時真的會有請求失敗（那時去問是對的），這一輪就驗不到
  let reallyFailed = 0
  page.on('response', (response) => { if (response.status() >= 500 && new URL(response.url()).pathname.startsWith('/api/')) reallyFailed++ })
  await page.goto(`${baseUrl}/calendar`, { waitUntil: 'networkidle', timeout: 120_000 })
  await loadCompanyIndex(page)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  // 等過一次 30 秒的計時器：健康的時候它什麼都不做
  await wait(32_000)
  expect(reallyFailed === 0, `這一輪有 ${reallyFailed} 個請求真的失敗（上游在重啟？），驗不到，請重跑`)
  expect(asked === 0, `沒有請求失敗卻問了 ${asked} 次健康狀態`)
  expect(!(await page.evaluate(() => window.__bannerSeen)), '出現了橫幅')
})

await scenario('讀取失敗、上游不健康的橫幅：把頁面往下推、淺深色都夠對比，關掉後收回', async ({ page }) => {
  await failCompanyIndex(page)
  await page.route('**/api/system-health**', route => route.fulfill({ json: { ok: false } }))
  await page.goto(`${baseUrl}/calendar`, { waitUntil: 'networkidle', timeout: 120_000 })
  await loadCompanyIndex(page)
  const banner = page.locator('.app-system-health-banner')
  await banner.waitFor({ state: 'visible', timeout: 10_000 })
  // 健康檢查有回應、上游不健康＝我們的問題
  expect(/我們的系統/.test(await banner.innerText()), `上游不健康時橫幅的說法不對：${await banner.innerText()}`)
  for (const [viewportWidth, dark] of [[width, false], [width, true], [375, false]]) {
    await page.setViewportSize({ width: viewportWidth, height: 900 })
    await page.evaluate(isDark => document.documentElement.classList.toggle('dark', isDark), dark)
    await wait(300)
    const seen = await page.evaluate(() => {
      const box = document.querySelector('.app-system-health-banner')
      const style = getComputedStyle(box)
      return { bannerBottom: box.getBoundingClientRect().bottom, h1Top: document.querySelector('main h1').getBoundingClientRect().top, text: style.color, fill: style.backgroundColor, line: style.borderBottomColor, pageFill: getComputedStyle(document.body).backgroundColor }
    })
    const where = `${viewportWidth}${dark ? ' 深色' : ''}`
    expect(seen.h1Top >= seen.bannerBottom, `${where}：橫幅蓋住標題（h1 ${seen.h1Top}、橫幅底 ${seen.bannerBottom}）`)
    expect(contrast(seen.text, seen.fill) >= 4.5, `${where}：字對橫幅底 ${contrast(seen.text, seen.fill).toFixed(2)}:1`)
    expect(contrast(seen.line, seen.pageFill) >= 3, `${where}：底線對頁面底 ${contrast(seen.line, seen.pageFill).toFixed(2)}:1`)
  }
  await banner.getByRole('button', { name: '關閉' }).click()
  await banner.waitFor({ state: 'hidden', timeout: 2_000 })
  const height = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--app-banner-height').trim())
  expect(height === '0px', `關掉後 --app-banner-height 是 ${height}`)
})

await scenario('讀取失敗、健康檢查連網站都沒回應：橫幅請用戶檢查網路', async ({ page }) => {
  await failCompanyIndex(page, route => route.abort('internetdisconnected'))
  await page.route('**/api/system-health**', route => route.abort('internetdisconnected'))
  await page.goto(`${baseUrl}/calendar`, { waitUntil: 'networkidle', timeout: 120_000 })
  await loadCompanyIndex(page)
  const banner = page.locator('.app-system-health-banner')
  await banner.waitFor({ state: 'visible', timeout: 15_000 })
  expect(/確認一下網路連線/.test(await banner.innerText()), `連不上網站時橫幅的說法不對：${await banner.innerText()}`)
})

await scenario('橫幅出現後上游恢復：切回分頁就收掉，之後不再問', async ({ page }) => {
  let ok = false
  let asked = 0
  // 上游恢復後公司索引也讀得到了（還在失敗的讀取會再查一次，那是對的，不是這裡要驗的）
  await failCompanyIndex(page, route => (ok ? route.continue() : fail502(route)))
  await page.route('**/api/system-health**', (route) => {
    asked++
    return route.fulfill({ json: { ok } })
  })
  await page.goto(`${baseUrl}/calendar`, { waitUntil: 'networkidle', timeout: 120_000 })
  await loadCompanyIndex(page)
  const banner = page.locator('.app-system-health-banner')
  await banner.waitFor({ state: 'visible', timeout: 10_000 })
  ok = true
  // 不等 30 秒：不健康的期間，分頁回到前景會立刻重查
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await banner.waitFor({ state: 'hidden', timeout: 10_000 })
  // 等背景的重讀跑完（公司索引恢復），再看切回分頁會不會又去問
  await wait(GRACE_MS)
  const askedAfterRecovery = asked
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await wait(1_500)
  expect(asked === askedAfterRecovery, `恢復之後還在問健康狀態（多了 ${asked - askedAfterRecovery} 次）`)
})

// 頁面回報的讀取失敗（不經 apiFetch 的本站路由）也會帶出橫幅；回報的那個頁面換掉之後，橫幅照樣要等得到恢復
//（2026-11-27：輪詢的計時器只能由橫幅自己註冊，跟著回報的頁面元件走的話，換頁之後就沒有人再查）
await scenario('頁面的讀取失敗帶出橫幅，換頁後上游恢復：橫幅照樣收掉', async ({ page }) => {
  let ok = false
  await page.route('**/api/system-health**', route => route.fulfill({ json: { ok } }))
  await openStock(page)
  await page.route('**/api/stock/2330/dupont', route => (ok ? route.continue() : fail502(route)))
  await clientNavigate(page, '/stock/2330/dupont')
  const banner = page.locator('.app-system-health-banner')
  await banner.waitFor({ state: 'visible', timeout: 15_000 })
  await clientNavigate(page, '/calendar')
  await page.waitForURL('**/calendar', { timeout: 30_000 })
  ok = true
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await banner.waitFor({ state: 'hidden', timeout: 10_000 })
})

// 一支請求失敗不等於連不上（2026-11-06，DEV 的 /holdings/statistics 手機位移 0.135）：原本先出橫幅再重查，上游好好的也出現 2 秒，
// 整頁被推下去又拉回來
await scenario('一支請求失敗、重查是好的：不出現橫幅', async ({ page }) => {
  await page.addInitScript(() => {
    const tick = () => {
      if (document.querySelector('.app-system-health-banner')) window.__bannerSeen = true
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  let failed = 0
  await failCompanyIndex(page, (route) => {
    failed++
    return fail502(route)
  })
  await page.route('**/api/system-health**', async (route) => {
    await wait(1_500)
    await route.fulfill({ json: { ok: true } })
  })
  await page.goto(`${baseUrl}/calendar`, { waitUntil: 'networkidle', timeout: 120_000 })
  await loadCompanyIndex(page)
  await wait(3_000)
  expect(failed > 0, '公司索引沒有送出，這個情境沒驗到東西')
  expect(!(await page.evaluate(() => window.__bannerSeen)), '出現了橫幅')
})

await browser.close()
console.log(failures.length ? `\n${failures.length} 個情境失敗` : '\n全部通過')
process.exit(failures.length ? 1 : 0)
