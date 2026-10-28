// 部署好的網站登入檢查（2026-10-28，使用者：「以後就跑一行指令就可以」）。搬到 Cloudflare Workers 時，登入要在新網域重設
// Firebase 授權網域、API 金鑰的網站限制、LINE 的 Callback URL，這支一次驗完：
//   Google：彈出視窗到得了 Google 帳號選擇（網域在 Firebase 授權清單；不在的話 FirebaseUI 報 unauthorized-domain）
//   LINE：網站的按鈕跳到 LINE 登入頁（Callback URL 有登記；沒登記是 400 Invalid redirect_uri）
//   Email：建一個臨時帳號、從畫面登入、開 /watchlist 讀會員資料（Firebase token 經 /api/core 到業務中台），跑完刪掉
// Google、LINE 只走到輸入帳密為止（不碰任何人的帳密）；登入後的流程三種都一樣，Email 那條走完了。
// 會寫進那個網站的 Firebase 與業務中台（臨時帳號 check-login-<時間>@example.com），跑完用 DELETE /users/me 刪，刪不掉的會列出來。
// 臨時帳號要標成已驗證信箱（否則 UserEmailVerificationGate 擋住整站），用 gcloud 目前登入的身分呼叫 Firebase 管理 API。
//
// Run: pnpm login:check [網址]（預設 Workers DEV）
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'

const base = (process.argv[2] ?? 'https://oingg-web-nuxt-dev.oingg-web-nuxt.workers.dev').replace(/\/$/, '')
let failures = 0
const check = (ok, label, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `（${detail}）` : ''}`); if (!ok) failures++ }

// 網站自己用的 Firebase 設定（跟著部署走，不另外設定）
const html = await (await fetch(base)).text()
const apiKey = html.match(/apiKey:"(AIza[^"]+)"/)?.[1]
const projectId = html.match(/projectId:"([^"]+)"/)?.[1]
if (!apiKey || !projectId) throw new Error(`${base} 的頁面裡找不到 Firebase 設定`)
// API 金鑰有網站限制：從 Node 呼叫要帶這個網站的 Referer
const firebase = async (path, body, init = {}) => {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}${init.admin ? '' : `?key=${apiKey}`}`, {
    method: 'POST', headers: { 'content-type': 'application/json', referer: `${base}/`, ...init.headers }, body: JSON.stringify(body)
  })
  return { ok: response.ok, body: await response.json().catch(() => null) }
}

const account = { email: `check-login-${Date.now()}@example.com`, password: `Chk!${crypto.randomUUID()}` }
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const signInButton = page => page.locator('button[title="登入"]:visible').first()
async function openLogin() {
  const page = await context.newPage()
  await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 })
  await signInButton(page).click()
  await page.locator('#firebaseui-auth-container .firebaseui-idp-password').waitFor({ timeout: 30000 })
  return page
}
let created = false

try {
  console.log(`登入檢查：${base}（Firebase ${projectId}）`)

  // Google：只看彈出視窗到哪裡
  {
    const page = await openLogin()
    const [popup] = await Promise.all([
      context.waitForEvent('page', { timeout: 20000 }).catch(() => null),
      page.locator('[data-provider-id="google.com"]').click()
    ])
    await popup?.waitForURL(/accounts\.google\.com/, { timeout: 20000 }).catch(() => {})
    // 彈出視窗還沒跳轉時網址是空字串，new URL 會丟錯、後面的檢查就跑不到
    const reached = popup && URL.canParse(popup.url()) ? new URL(popup.url()).host : ''
    const uiError = (await page.locator('.firebaseui-id-info-bar-message').allInnerTexts()).join(' ')
    check(reached === 'accounts.google.com', 'Google：彈出視窗到 Google 帳號選擇', reached || uiError || '沒有彈出視窗')
    await popup?.close()
    await page.close()
  }

  // LINE：網站的按鈕跳到 LINE，LINE 接受這個 callback 才會到登入頁
  {
    const page = await openLogin()
    await page.locator('[data-provider-id="oidc.line"]').click()
    await page.waitForURL(/access\.line\.me/, { timeout: 30000 }).catch(() => {})
    await page.waitForLoadState('networkidle')
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 80)
    check(page.url().startsWith('https://access.line.me/') && !/Bad Request/.test(text), 'LINE：到 LINE 登入頁', text)
    await page.close()
  }

  // Email：臨時帳號從畫面登入，再讀會員頁
  const signUp = await firebase('accounts:signUp', { ...account, returnSecureToken: true })
  if (!signUp.ok) throw new Error(`建立臨時帳號失敗：${signUp.body?.error?.message}`)
  created = true
  const adminToken = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
  const verified = await firebase(`projects/${projectId}/accounts:update`, { localId: signUp.body.localId, emailVerified: true }, {
    admin: true, headers: { authorization: `Bearer ${adminToken}`, 'x-goog-user-project': projectId }
  })
  if (!verified.ok) throw new Error(`把臨時帳號標成已驗證失敗：${verified.body?.error?.message}`)

  const page = await openLogin()
  // 帶使用者 token 的 /api/core 回應（會員資料）
  const authed = []
  page.on('response', (response) => {
    if (response.url().startsWith(`${base}/api/core/`) && response.request().headers().authorization) authed.push(`${response.status()} ${new URL(response.url()).pathname}`)
  })
  const ui = page.locator('#firebaseui-auth-container')
  await ui.locator('.firebaseui-idp-password').click()
  await ui.locator('input[name="email"]').fill(account.email)
  await ui.locator('.firebaseui-id-submit').click()
  await ui.locator('input[name="password"]').fill(account.password)
  await ui.locator('.firebaseui-id-submit').click()
  const signedIn = await page.locator('.user-menu-button__trigger').first().waitFor({ state: 'attached', timeout: 60000 }).then(() => true, () => false)
  check(signedIn, 'Email：從畫面登入後是登入狀態')
  await page.goto(`${base}/watchlist`, { waitUntil: 'networkidle', timeout: 120000 })
  const failed = authed.filter(line => !line.startsWith('2'))
  check(authed.length > 0 && failed.length === 0, 'Email：/watchlist 用登入的 token 讀到會員資料', failed.join('、') || `${authed.length} 次呼叫`)
  check(signedIn && await signInButton(page).count() === 0, 'Email：換頁後還是登入狀態')
  await page.close()
} finally {
  if (created) {
    // 刪掉臨時帳號：業務中台的資料與 Firebase 帳號（業務中台刪過 Firebase 的話，第二步回 USER_NOT_FOUND，不算錯）
    const signIn = await firebase('accounts:signInWithPassword', { ...account, returnSecureToken: true })
    const idToken = signIn.body?.idToken
    const removed = idToken && await fetch(`${base}/api/core/users/me`, { method: 'DELETE', headers: { authorization: `Bearer ${idToken}` } })
    if (idToken) await firebase('accounts:delete', { idToken })
    const gone = !(await firebase('accounts:signInWithPassword', { ...account, returnSecureToken: true })).ok
    check(removed?.ok && gone, '清理：臨時帳號已刪除', removed?.ok ? (gone ? '' : `Firebase 還有 ${account.email}`) : `DELETE /users/me ${removed?.status ?? '沒有 token'}；${account.email}`)
  }
  await browser.close()
}
console.log(failures ? `${failures} FAILED` : 'ALL PASS')
process.exit(failures ? 1 : 0)
