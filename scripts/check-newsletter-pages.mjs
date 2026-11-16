// 電子報的網頁這一端（2026-11-16，業務中台的合約）：
//   - /account/newsletter：開關（PUT optIn、開啟的提示寫下一封預計）、分塊（改了就存、一次送一個、至少留一塊）、失敗時提示並回到上游的樣子、
//     範例週報
//   - 沒有帳號 email：自己填收件 email（依序存 email、打開週報、寄驗證信）、格式不對、寄不出去、重寄等 60 秒、一天寄滿、換 email（開關不動）
//   - /newsletter/verify：按了「確認 email」才送出；週報開著、關著兩種說法；404 連結失效、409 別的帳號在用、沒有 token
//   - /newsletter/opt-out：內文 #t= 查詢後才退訂、繼續收；不認得的 token、沒有 token 是連結失效；標頭 ?t= 不查、退訂後沒有「繼續收」；
//     token 不出現在任何請求網址
//   - POST /newsletter/opt-out（RFC 8058）：形狀不對的 token 回 400，不送上游
// 業務中台全部模擬，其他寫入一律擋下（測試帳號不會被寫入）。
//
// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-newsletter-pages.mjs（要 A11Y_TEST_EMAIL／A11Y_TEST_PASSWORD）
import { chromium } from 'playwright'
const base = 'http://localhost:3000'
let failures = 0
const check = (ok, label) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failures++ }
const problem = (status, code) => ({ status, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'x', status, detail: 'english detail', ...(code ? { code } : {}) }) })
const ALL = ['holdings', 'ex_dividends', 'material_announcements', 'attention_and_disposed_stocks']
const edition = (optIn, sections = ALL) => ({ edition: 'weekly', optIn, sections, optedInAt: null, optedOutAt: null })
const routeWith = (ctx, handlers) => ctx.route('**/*', (route) => {
  const req = route.request(); const url = new URL(req.url()); const key = `${req.method()} ${url.pathname}`
  if (handlers[key]) return handlers[key](route)
  if (req.method() === 'GET' || /identitytoolkit|securetoken/.test(url.host + url.pathname)) return route.continue()
  return route.abort()
})
const browser = await chromium.launch()
const ready = async (page, path) => {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 })
}

console.log('退訂頁（不用登入）')
for (const scenario of ['body', 'unknown', 'header', 'none', 'already-off']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addCookies([{ name: 'analytics-consent', value: 'denied', url: base }])
  const calls = []
  const urls = []
  ctx.on('request', request => urls.push(request.url()))
  await routeWith(ctx, {
    'POST /api/core/newsletter/token/lookup': (route) => {
      calls.push(['lookup', route.request().postDataJSON()])
      if (scenario === 'unknown') return route.fulfill(problem(404))
      return route.fulfill({ json: { edition: 'weekly', optIn: scenario !== 'already-off', maskedDeliveryAddress: 'n***@example.com' } })
    },
    'POST /api/core/newsletter/opt-out': (route) => {
      calls.push(['opt-out', route.request().postDataJSON()])
      return route.fulfill({ json: { edition: 'weekly', optIn: false, maskedDeliveryAddress: scenario === 'header' ? null : 'n***@example.com' } })
    },
    'POST /api/core/newsletter/opt-in': (route) => {
      calls.push(['opt-in', route.request().postDataJSON()])
      return route.fulfill({ json: { edition: 'weekly', optIn: true, maskedDeliveryAddress: 'n***@example.com' } })
    }
  })
  const page = await ctx.newPage()
  const token = scenario === 'header' ? 'HeaderToken_0123456789' : 'BodyToken-0123456789ab'
  const path = { body: `#t=${token}`, unknown: `#t=${token}`, header: `?t=${token}`, none: '', 'already-off': `#t=${token}` }[scenario]
  await ready(page, `/newsletter/opt-out${path}`)
  const title = () => page.locator('h1').innerText()
  await page.waitForFunction(() => !document.querySelector('.newsletter-result .app-skeleton'), null, { timeout: 15000 })
  if (scenario === 'body') {
    check(await title() === '不再收每週持股週報？' && (await page.locator('.newsletter-result__lead').innerText()).includes('到 n***@example.com'), 'body：先查，確認頁寫遮罩過的 email')
    check(calls.length === 1 && calls[0][1].optOutToken === token, 'body：查詢的 token 在 body')
    await page.getByRole('button', { name: '不再收週報' }).click()
    await page.getByRole('heading', { name: '已停止寄週報' }).waitFor({ timeout: 10000 })
    check(calls[1]?.[0] === 'opt-out' && calls[1][1].optOutToken === token, 'body：按了才退訂')
    await page.getByRole('button', { name: '繼續收週報' }).click()
    await page.getByRole('heading', { name: '週報會照常寄給你' }).waitFor({ timeout: 10000 })
    check(calls[2]?.[0] === 'opt-in' && /下一封預計 \d+\/\d+（日）晚上 8 點寄到 n\*\*\*@example\.com/.test(await page.locator('.newsletter-result__lead').innerText()), 'body：繼續收，寫下一封預計與 email')
  } else if (scenario === 'unknown' || scenario === 'none') {
    check(await title() === '這個連結已經不能用', `${scenario}：連結失效`)
    check(calls.filter(call => call[0] !== 'lookup').length === 0, `${scenario}：沒有退訂`)
  } else if (scenario === 'header') {
    check(calls.length === 0 && await title() === '不再收每週持股週報？' && (await page.locator('.newsletter-result__lead').innerText()).includes('給你'), 'header：不查，直接給按鈕，不寫 email')
    await page.getByRole('button', { name: '不再收週報' }).click()
    await page.getByRole('heading', { name: '已停止寄週報' }).waitFor({ timeout: 10000 })
    check(calls[0]?.[0] === 'opt-out' && calls[0][1].optOutToken === token, 'header：同一把 token 退訂')
    check(await page.getByRole('button', { name: '繼續收週報' }).count() === 0, 'header：退訂後沒有「繼續收」（那把 token 不能繼續收）')
  } else {
    check(await title() === '已停止寄週報' && await page.getByRole('button', { name: '繼續收週報' }).count() === 1, 'already-off：已經停了就直接給「繼續收」')
  }
  check(!urls.some(url => url.includes('/api/core') && url.includes(token)), `${scenario}：token 不在任何請求網址`)
  await ctx.close()
}

console.log('一鍵退訂（RFC 8058）')
{
  const response = await fetch(`${base}/newsletter/opt-out?t=a.b`, { method: 'POST', body: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } })
  check(response.status === 400 && response.headers.get('cache-control') === 'private, no-store', '形狀不對的 token 回 400、不快取')
  const page = await fetch(`${base}/newsletter/opt-out?t=abc`)
  check(page.status === 200 && page.headers.get('x-robots-tag') === 'noindex, nofollow' && page.headers.get('referrer-policy') === 'strict-origin', 'GET 是頁面：不收錄、Referer 只送網域')
}

// 登入一次
const login = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await routeWith(login, {})
const lp = await login.newPage()
await ready(lp, '/calendar')
await lp.waitForTimeout(500)
await lp.locator('button[title="登入"]:visible').first().click()
const ui = lp.locator('#firebaseui-auth-container')
await ui.locator('.firebaseui-idp-password').click({ timeout: 30000 })
await ui.locator('input[name="email"]').fill(process.env.A11Y_TEST_EMAIL); await ui.locator('.firebaseui-id-submit').click()
await ui.locator('input[name="password"]').fill(process.env.A11Y_TEST_PASSWORD); await ui.locator('.firebaseui-id-submit').click()
await lp.locator('.user-menu-button__trigger').first().waitFor({ state: 'attached', timeout: 60000 })
await login.addCookies([{ name: 'analytics-consent', value: 'denied', url: base }])
const storageState = await login.storageState({ indexedDB: true }); await login.close()

console.log('帳號：電子報')
for (const width of [1440, 375]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, storageState })
  let stored = { email: 'name@example.com', editions: [edition(false)] }
  const puts = []
  let failNext = false
  await routeWith(ctx, {
    'GET /api/core/newsletter': route => route.fulfill({ json: stored }),
    'PUT /api/core/newsletter/weekly': async (route) => {
      const body = route.request().postDataJSON()
      const entry = { body, startedAt: Date.now(), endedAt: 0 }
      puts.push(entry)
      await new Promise(resolve => setTimeout(resolve, 300))
      entry.endedAt = Date.now()
      if (failNext) { failNext = false; return route.fulfill(problem(500)) }
      const weekly = { ...stored.editions[0], ...body }
      stored = { ...stored, editions: [weekly] }
      return route.fulfill({ json: weekly })
    }
  })
  const page = await ctx.newPage()
  await ready(page, '/account/newsletter')
  const sw = page.locator('#newsletter-weekly')
  await page.locator('.newsletter-page__email', { hasText: 'name@example.com' }).waitFor({ timeout: 30000 })
  check(await sw.getAttribute('aria-checked') === 'false' && (await page.locator('.newsletter-page__status').innerText()).startsWith('未開啟'), `${width}：預設關閉`)
  check(await page.locator('.newsletter-page__check.is-disabled').count() === 4, `${width}：關閉時分塊不能改`)
  check(await page.locator('[aria-current="page"]', { hasText: '電子報' }).count() >= 1, `${width}：側欄的「電子報」是目前這頁`)
  await page.locator('.newsletter-page__switch-row .el-switch').click()
  await page.locator('.el-message', { hasText: '週報已開啟' }).waitFor({ timeout: 10000 })
  check(puts[0]?.body.optIn === true && Object.keys(puts[0].body).length === 1, `${width}：打開只送 optIn`)
  check(/週報已開啟，下一封預計 \d+\/\d+（日）晚上 8 點/.test(await page.locator('.el-message').first().innerText()), `${width}：提示寫下一封預計`)
  check(await sw.getAttribute('aria-checked') === 'true' && (await page.locator('.newsletter-page__status').innerText()).startsWith('已開啟・下一封預計'), `${width}：狀態變已開啟`)

  // 連按三個：一次送一個，最後只剩一塊、那一塊不能取消
  const box = label => page.locator('.newsletter-page__check', { hasText: label })
  await box('注意股、處置股提醒').click()
  await box('本週重大訊息').click()
  await box('下週除權息與股利入帳').click()
  await page.waitForTimeout(1500)
  const sectionPuts = puts.slice(1)
  check(sectionPuts.length === 3 && sectionPuts.every((put, index) => index === 0 || put.startedAt >= sectionPuts[index - 1].endedAt), `${width}：分塊一次送一個（${sectionPuts.length} 次）`)
  check(JSON.stringify(sectionPuts.at(-1)?.body) === JSON.stringify({ sections: ['holdings'] }), `${width}：最後存的是畫面上的樣子`)
  check(await box('持股週報').locator('input').isDisabled(), `${width}：只剩一塊時那一塊不能取消`)

  // 失敗：提示，回到上游存著的樣子
  failNext = true
  await box('本週重大訊息').click()
  await page.locator('.el-message', { hasText: '沒有存到，請再試一次' }).waitFor({ timeout: 10000 })
  await page.waitForTimeout(500)
  check(!(await box('本週重大訊息').locator('input').isChecked()), `${width}：失敗時回到上游的樣子`)

  await page.getByRole('button', { name: '看範例週報' }).click()
  const dialog = page.getByRole('dialog', { name: '範例週報' })
  await dialog.waitFor({ timeout: 5000 })
  check((await dialog.innerText()).includes('你的持股') && (await dialog.innerText()).includes('範例：公司和數字都是示意'), `${width}：範例週報`)
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}：沒有左右捲動`)
  await ctx.close()
}

console.log('帳號：沒有帳號 email，自己填收件 email')
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 900 }, storageState })
  let state = { email: null, newsletterEmail: null, editions: [edition(false)] }
  const calls = []
  let failPut = false
  let failSend = null
  await routeWith(ctx, {
    'GET /api/core/newsletter': route => route.fulfill({ json: state }),
    'PUT /api/core/newsletter/email': (route) => {
      const body = route.request().postDataJSON()
      calls.push(['email', body])
      if (failPut) { failPut = false; return route.fulfill(problem(400)) }
      state = { ...state, newsletterEmail: { address: body.address, status: 'entered', verifiedAt: null } }
      return route.fulfill({ json: state.newsletterEmail })
    },
    'PUT /api/core/newsletter/weekly': (route) => {
      const body = route.request().postDataJSON()
      calls.push(['weekly', body])
      state = { ...state, editions: [{ ...state.editions[0], ...body }] }
      return route.fulfill({ json: state.editions[0] })
    },
    'POST /api/core/newsletter/email/verification': (route) => {
      calls.push(['send'])
      const failure = failSend
      failSend = null
      if (failure === 'unconfigured') return route.fulfill(problem(503, 'mail_not_configured'))
      if (failure === 'daily') return route.fulfill(problem(429, 'newsletter_verification_daily_limit'))
      state = { ...state, newsletterEmail: { ...state.newsletterEmail, status: 'pending_verification' } }
      return route.fulfill({ json: state.newsletterEmail })
    }
  })
  const page = await ctx.newPage()
  await ready(page, '/account/newsletter')
  await page.waitForFunction(() => document.querySelector('#newsletter-email') && !document.querySelector('#newsletter-email').disabled, null, { timeout: 30000 })
  check(await page.locator('#newsletter-weekly').count() === 0 && (await page.locator('.newsletter-page__status').innerText()).includes('先填一個收信的 email'), '沒有任何 email：不給開關，先填一個')
  check(await page.locator('a[href="/account#sign-in-methods-title"]').count() === 1, '…也可以加上 Google 登入')

  failPut = true
  await page.locator('#newsletter-email').fill('bad@localhost')
  await page.getByRole('button', { name: '寄驗證信並開啟週報' }).click()
  await page.locator('.newsletter-page__message', { hasText: 'email 的格式不對' }).waitFor({ timeout: 10000 })
  check(calls.length === 1 && calls[0][0] === 'email', '格式不對：沒打開週報、沒寄信')

  calls.length = 0
  failSend = 'unconfigured'
  await page.locator('#newsletter-email').fill('line@example.com')
  await page.getByRole('button', { name: '寄驗證信並開啟週報' }).click()
  await page.locator('.newsletter-page__message', { hasText: '現在還沒辦法寄驗證信' }).waitFor({ timeout: 10000 })
  check(JSON.stringify(calls) === JSON.stringify([['email', { address: 'line@example.com' }], ['weekly', { optIn: true }], ['send']]), '依序：存 email、打開週報、寄驗證信')
  check(await page.getByRole('button', { name: '寄驗證信', exact: true }).count() === 1 && (await page.locator('.newsletter-page__tag').innerText()) === '待驗證', '沒寄出：地址留著，按鈕是「寄驗證信」')

  calls.length = 0
  await page.getByRole('button', { name: '寄驗證信', exact: true }).click()
  const cooling = page.getByRole('button', { name: /重寄驗證信（\d+ 秒後）/ })
  await cooling.waitFor({ timeout: 10000 })
  check(calls.length === 1 && await cooling.isDisabled(), '寄出後重寄要等 60 秒')
  check((await page.locator('.newsletter-page__status').innerText()).includes('email 驗證完才開始寄') && await page.locator('#newsletter-weekly').getAttribute('aria-checked') === 'true', '週報開著、等驗證')

  calls.length = 0
  await page.getByRole('button', { name: '改用別的 email' }).click()
  check(await page.locator('#newsletter-email').inputValue() === 'line@example.com', '改用別的 email：帶入目前的地址')
  await page.locator('#newsletter-email').fill('new@example.com')
  await page.getByRole('button', { name: '寄驗證信', exact: true }).click()
  await page.waitForTimeout(1500)
  check(JSON.stringify(calls) === JSON.stringify([['email', { address: 'new@example.com' }], ['send']]), '換 email：存新地址、寄驗證信，開關不動')

  // 重新整理後沒有倒數；一天寄滿 5 封
  await ready(page, '/account/newsletter')
  await page.getByRole('button', { name: '重寄驗證信', exact: true }).waitFor({ timeout: 30000 })
  failSend = 'daily'
  await page.getByRole('button', { name: '重寄驗證信', exact: true }).click()
  await page.locator('.newsletter-page__message', { hasText: '24 小時內最多寄 5 封' }).waitFor({ timeout: 10000 })
  check(true, '一天寄滿：說明明天再試')
  await ctx.close()
}

console.log('驗證 email（不用登入）')
for (const scenario of ['on', 'off', 'expired', 'taken', 'none']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addCookies([{ name: 'analytics-consent', value: 'denied', url: base }])
  const calls = []
  const urls = []
  ctx.on('request', request => urls.push(request.url()))
  await routeWith(ctx, {
    'POST /api/core/newsletter/email/verify': (route) => {
      calls.push(route.request().postDataJSON())
      if (scenario === 'expired') return route.fulfill(problem(404))
      if (scenario === 'taken') return route.fulfill(problem(409, 'newsletter_email_taken'))
      return route.fulfill({ json: { status: 'verified', maskedDeliveryAddress: 'l***@example.com', editions: [{ edition: 'weekly', optIn: scenario === 'on' }] } })
    }
  })
  const page = await ctx.newPage()
  const token = 'VerifyToken_0123456789'
  await ready(page, `/newsletter/verify${scenario === 'none' ? '' : `#t=${token}`}`)
  await page.waitForTimeout(500)
  const title = () => page.locator('h1').innerText()
  if (scenario === 'none') {
    check(await title() === '這個驗證連結已經不能用', 'none：連結失效')
  } else {
    check(await title() === '確認你的 email' && calls.length === 0, `${scenario}：先停在確認頁，按了才送出`)
    await page.getByRole('button', { name: '確認 email' }).click()
    await page.waitForFunction(() => document.querySelector('h1')?.textContent !== '確認你的 email', null, { timeout: 10000 })
    check(calls[0]?.verificationToken === token, `${scenario}：token 在 body`)
    const lead = await page.locator('.newsletter-result__lead').innerText()
    if (scenario === 'on') check(await title() === 'email 已驗證' && /寄到 l\*\*\*@example\.com，第一封預計 \d+\/\d+（日）晚上 8 點/.test(lead), 'on：寫寄到哪、第一封預計')
    if (scenario === 'off') check(await title() === 'email 已驗證' && lead.includes('週報現在是關著的'), 'off：週報關著，換一句')
    if (scenario === 'expired') check(await title() === '這個驗證連結已經不能用', 'expired：404 是連結失效')
    if (scenario === 'taken') check(await title() === '這個 email 已經用在別的帳號', 'taken：409 是別的帳號在用')
  }
  check(!urls.some(url => url.includes(token)), `${scenario}：token 不在任何請求網址`)
  await ctx.close()
}

await browser.close()
console.log(failures ? `FAIL: ${failures}` : 'PASS: newsletter pages')
process.exit(failures ? 1 : 0)
