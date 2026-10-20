// 真的 LINE 綁定（2026-10-20，使用者：「你這邊能把這種註冊驗證自動化嗎」選了「兩種都要」——這支是真的 LINE 那一種）。
// 半自動：開一個看得到的 Chrome 視窗（臨時設定檔，跑完刪掉，登入狀態不留在電腦上），**登入由使用者自己做**（Google、LINE；
// 腳本不碰任何密碼）。其餘自動：
//   1. 使用者用 Google 登入 → 記下帳號 id 與持股帳戶、觀察清單的「數量」（不讀內容、不印出來）
//   2. 個人資料按「綁定 LINE」（已綁定就跳過）→ 使用者登入 LINE、按同意 → 確認已綁定、lineLinked true
//   3. 登出、用 LINE 登入 → 確認進到同一個帳號、數量一樣、沒有「新帳號」提示
// 除了綁定本身不寫任何東西：/api/core 的其他寫入一律擋下並列出；絕不刪帳號。綁定目前不能解除（要業務中台手動清）。
// 對著 DEV 網站跑：LINE 只導回 LINE 後台登記過的網址（localhost 沒驗證過）。
//
// Run: node scripts/check-line-link-real.mjs（LINE_REAL_BASE 可換網址；等使用者操作最多 10 分鐘）
import { chromium } from 'playwright'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = process.env.LINE_REAL_BASE ?? 'https://web-nuxt-dev--oingg-web-dev.asia-east1.hosted.app'
const WAIT_FOR_PERSON = 10 * 60 * 1000
let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const say = text => console.log(`\n>>> ${text}`)

// 真的 Chrome＋拿掉「受自動化控制」的旗標：Google 常常拒絕在自動化瀏覽器裡登入
const profileDir = mkdtempSync(join(tmpdir(), 'oingg-line-real-'))
const ctx = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',
  headless: false,
  viewport: { width: 1280, height: 860 },
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled']
})
const blocked = []
// 除了綁定與 LINE 登入，不讓網站對業務中台寫任何東西（外觀同步之類的也擋，保護使用者自己的資料）
await ctx.route('**/api/core/**', (route) => {
  const req = route.request()
  const path = new URL(req.url()).pathname
  if (req.method() === 'GET' || path === '/api/core/auth/line' || path === '/api/core/auth/line/link' || path === '/api/core/screener/values') return route.continue()
  blocked.push(`${req.method()} ${path}`)
  return route.abort()
})

const page = ctx.pages()[0] ?? await ctx.newPage()
const uidOf = () => page.evaluate(() => window.useNuxtApp?.().$firebaseAuth.currentUser?.uid ?? null)
const signedIn = () => page.locator('.user-menu-button__trigger').first().waitFor({ state: 'attached', timeout: WAIT_FOR_PERSON })
const api = path => page.evaluate(async (path) => {
  const token = await window.useNuxtApp().$firebaseAuth.currentUser.getIdToken()
  const response = await fetch(`/api/core${path}`, { headers: { authorization: `Bearer ${token}` } })
  return response.ok ? response.json() : null
}, path)
const counts = async () => {
  const [portfolios, watchlists] = await Promise.all([api('/portfolios'), api('/watchlists')])
  return `${portfolios?.portfolios?.length ?? '?'} 個持股帳戶、${watchlists?.watchlists?.length ?? '?'} 組觀察清單`
}
const ready = async (path) => {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 }); await page.waitForTimeout(800)
}

try {
  console.log(`網站：${base}`)
  await ready('/calendar')
  await page.locator('button[title="登入"]:visible').first().click()
  say('請在視窗裡按「使用 Google 帳號登入」，登入你的帳號（chuiantw1212@gmail.com）。')
  await signedIn()
  await page.waitForTimeout(2000)
  const uid = await uidOf()
  const email = await page.evaluate(() => window.useNuxtApp().$firebaseAuth.currentUser?.email ?? '')
  const before = await counts()
  console.log(`  已登入 ${email.replace(/^(.)[^@]*/, '$1***')}；${before}`)

  await ready('/profile')
  const section = page.locator('section', { has: page.getByRole('heading', { name: '登入方式' }) })
  check(await section.count() === 1, '個人資料有「登入方式」（DEV 已經是新版）')
  if (!(await section.innerText()).includes('已綁定')) {
    await section.getByRole('button', { name: '綁定 LINE' }).click()
    await page.waitForURL(/access\.line\.me/, { timeout: 60000 })
    say('請在視窗裡登入 LINE（掃 QR 或輸入帳密，手機確認），然後按「許可」／「同意」。')
    // 先等回到我們的網站，再等「回到個人資料」或回呼頁的失敗面板。不能看 role=alert：成功提示（ElMessage）也是 alert，
    // 第一次實跑（2026-10-20）就把「已綁定 LINE」當成失敗
    await page.waitForURL(url => url.origin === new URL(base).origin, { timeout: WAIT_FOR_PERSON })
    await page.waitForFunction(() => location.pathname === '/profile' || !!document.querySelector('.line-login-page__panel'), null, { timeout: 60000 })
    await page.waitForTimeout(800)
    const failure = await page.locator('.line-login-page__panel').innerText().catch(() => '')
    if (failure) console.log(`  綁定沒有成功：${failure.replace(/\s+/g, ' ')}`)
    check(page.url().endsWith('/profile') && !failure && await page.locator('.el-message', { hasText: '已綁定 LINE' }).count() > 0, '綁定完成、回到個人資料並提示已綁定')
  } else {
    console.log('  已經綁定過，跳過綁定、直接驗證 LINE 登入')
  }
  const me = await api('/users/me')
  check(me?.user?.lineLinked === true, `GET /users/me 的 lineLinked 是 true（${me?.user?.lineLinked}）`)

  await page.evaluate(() => window.useNuxtApp().$firebaseAuth.signOut()); await page.waitForTimeout(1000)
  await ready('/calendar')
  await page.locator('button[title="登入"]:visible').first().click()
  await page.locator('#firebaseui-auth-container [data-provider-id="oidc.line"]').click({ timeout: 30000 })
  say('用 LINE 登入中——LINE 若再要求登入或同意，請在視窗裡完成。')
  await signedIn()
  await page.waitForURL(url => !url.pathname.startsWith('/auth/'), { timeout: WAIT_FOR_PERSON })
  await page.waitForTimeout(2000)
  check(await uidOf() === uid, '用 LINE 登入進到的就是 Gmail 那個帳號（帳號 id 一樣）')
  const after = await counts()
  check(after === before, `資料數量一樣（${after}）`)
  check(await page.locator('.el-message', { hasText: '已用 LINE 建立帳號' }).count() === 0, '沒有「新帳號」提示')
} catch (error) {
  failures++
  console.log(`\n  中斷：${error.message.split('\n')[0]}`)
} finally {
  await ctx.close()
  rmSync(profileDir, { recursive: true, force: true })
  console.log(`\n擋下的寫入（網站自己想送的，保護你的資料）：${blocked.length ? blocked.join('、') : '無'}`)
}

if (failures) { console.log(`\n${failures} 項失敗或中斷`); process.exit(1) }
console.log('\n全部通過')
