// LINE 綁定整條鏈（2026-10-20，使用者：「你這邊能把這種註冊驗證自動化嗎」，選了「兩種都要」——這支是模擬 LINE 的那一種）。
// 只有「LINE 驗證」是假的（業務中台的本機模擬：code 寫成 stub.<sub>.<nonce>）；網站、業務中台、line_identity、custom token、
// Firebase、DEV 資料庫全是真的。使用者同意寫進 DEV：每次建臨時帳號（e2e-line-<時間>@example.com、line:Ue2e<時間>），跑完用
// DELETE /users/me 全部刪掉，刪不掉的會列出來。**不碰使用者自己的帳號，也不碰無障礙測試帳號。**
//
// 驗的事（照業務中台實測過的順序）：
//   1. 電子郵件帳號 A 建一份觀察清單 →「綁定 LINE」→ 個人資料寫已綁定、lineLinked true
//   2. 登出、用那個 LINE 登入 → 進到 A（uid 一樣、觀察清單還在）、沒有「新帳號」提示
//   3. 帳號 B 綁同一個 LINE → 409 line_already_linked 的說明
//   4. 新的 LINE 第一次登入 → line:{sub}、歡迎提示；個人資料有「加上 Google 登入」，LINE 內建瀏覽器裡改成「用外部瀏覽器開啟」
//   5. B 綁那個已經有觀察清單的 LINE → 409 line_account_has_data 的說明
//   6. 清理：刪掉 A 之後再用原本那個 LINE 登入 → 是全新的 line:{sub}（不會把 A 復活），再刪掉
//
// Run（三個都要開著）：
//   業務中台開模擬：cd ../oingg-business-ts && LINE_LOGIN_STUB=1 PORT=4210 npx tsx src/index.ts
//   網站指向它：NUXT_BUSINESS_BASE=http://localhost:4210 pnpm dev --port 3000
//   node --env-file=.env scripts/check-line-link-e2e.mjs（Firebase 的 web API key 從 .env 讀，不印出來）
// 跑完把模擬的業務中台關掉、網站照平常重開（開著模擬時業務中台的 security:check 會 FAIL，提醒你）。
import { chromium } from 'playwright'
const base = 'http://localhost:3000'
const apiKey = process.env.NUXT_PUBLIC_FIREBASE_API_KEY
if (!apiKey) throw new Error('要用 node --env-file=.env 執行（讀 Firebase 的 web API key）')
let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

const stamp = Date.now()
const SUB = `Ue2e${stamp}a`
const SUB2 = `Ue2e${stamp}b`
const account = suffix => ({ email: `e2e-line-${stamp}-${suffix}@example.com`, password: `E2e!${crypto.randomUUID()}` })
const A = account('a')
const B = account('b')

async function signUp({ email, password }) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true })
  })
  if (!response.ok) throw new Error(`建立臨時帳號失敗 ${response.status}`)
  return (await response.json()).localId
}

const browser = await chromium.launch()
// LINE 授權頁：讀出 state 與 nonce，直接導回我們的回呼頁、帶模擬的 code（sub 由 line.sub 決定）
const line = { sub: SUB }
async function newPage({ userAgent } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(userAgent ? { userAgent } : {}) })
  await ctx.route('https://access.line.me/**', (route) => {
    const url = new URL(route.request().url())
    const location = `${base}/auth/line?code=stub.${line.sub}.${url.searchParams.get('nonce')}&state=${url.searchParams.get('state')}`
    return route.fulfill({ status: 302, headers: { location } })
  })
  const page = await ctx.newPage()
  await page.goto(`${base}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 }); await page.waitForTimeout(500)
  await page.addStyleTag({ content: '#nuxt-devtools-container{display:none!important}' })
  return page
}
const uidOf = page => page.evaluate(() => window.useNuxtApp().$firebaseAuth.currentUser?.uid ?? null)
const waitSignedIn = page => page.locator('.user-menu-button__trigger').first().waitFor({ state: 'attached', timeout: 60000 })
// 用目前登入者的 token 打業務中台（走網站的 /api/core 代理）
const api = (page, path, init = {}) => page.evaluate(async ({ path, init }) => {
  const token = await window.useNuxtApp().$firebaseAuth.currentUser.getIdToken()
  const response = await fetch(`/api/core${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` } })
  return { status: response.status, body: await response.json().catch(() => null) }
}, { path, init })

async function signInWithEmail(page, { email, password }) {
  await page.locator('button[title="登入"]:visible').first().click()
  const ui = page.locator('#firebaseui-auth-container')
  await ui.locator('.firebaseui-idp-password').click({ timeout: 30000 })
  await ui.locator('input[name="email"]').fill(email); await ui.locator('.firebaseui-id-submit').click()
  await ui.locator('input[name="password"]').fill(password); await ui.locator('.firebaseui-id-submit').click()
  await waitSignedIn(page)
  await page.waitForTimeout(1500)
}
async function signInWithLine(page, sub) {
  line.sub = sub
  await page.locator('button[title="登入"]:visible').first().click()
  await page.locator('#firebaseui-auth-container [data-provider-id="oidc.line"]').click({ timeout: 30000 })
  await page.waitForURL(/\/auth\/line/, { timeout: 30000 })
  await waitSignedIn(page)
  await page.waitForURL(url => !url.pathname.startsWith('/auth/'), { timeout: 30000 })
  await page.waitForTimeout(1500)
}
async function bindLine(page, sub) {
  line.sub = sub
  await page.goto(`${base}/profile`, { waitUntil: 'networkidle', timeout: 180000 }); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: '綁定 LINE' }).click()
  await page.waitForURL(/\/auth\/line/, { timeout: 30000 })
  await page.waitForFunction(() => location.pathname === '/profile' || !!document.querySelector('[role="alert"]'), null, { timeout: 30000 })
  await page.waitForTimeout(800)
}
const signOut = async page => { await page.evaluate(() => window.useNuxtApp().$firebaseAuth.signOut()); await page.waitForTimeout(800) }
const leftovers = []
async function deleteSignedIn(page, label) {
  const { status } = await api(page, '/users/me', { method: 'DELETE' })
  if (status >= 300) leftovers.push(`${label}（DELETE /users/me ${status}）`)
}

try {
  const uidA = await signUp(A)
  await signUp(B)

  console.log('1. 電子郵件帳號綁定 LINE')
  const pageA = await newPage()
  await signInWithEmail(pageA, A)
  const created = await api(pageA, '/watchlists', { method: 'POST', body: JSON.stringify({ name: 'E2E 綁定測試' }) })
  check(created.status === 201, `A 建一份觀察清單（${created.status}）`)
  await bindLine(pageA, SUB)
  check(pageA.url().endsWith('/profile') && await pageA.locator('.el-message', { hasText: '已綁定 LINE' }).count() > 0, '綁定成功：回到個人資料、提示已綁定')
  const me = await api(pageA, '/users/me')
  check(me.body?.user?.lineLinked === true, `GET /users/me 的 lineLinked 是 true（${me.body?.user?.lineLinked}）`)
  await pageA.goto(`${base}/profile`, { waitUntil: 'networkidle' }); await pageA.waitForTimeout(1500)
  const methods = await pageA.locator('section', { has: pageA.getByRole('heading', { name: '登入方式' }) }).innerText()
  check(methods.includes('LINE') && methods.includes('已綁定'), '個人資料「登入方式」LINE 寫已綁定')

  console.log('2. 登出、用 LINE 登入 → 進到 A')
  await signOut(pageA)
  await pageA.goto(`${base}/calendar`, { waitUntil: 'networkidle' }); await pageA.waitForTimeout(800)
  await signInWithLine(pageA, SUB)
  check(await uidOf(pageA) === uidA, `用 LINE 登入的就是 A（${await uidOf(pageA)}）`)
  const lists = await api(pageA, '/watchlists')
  check(lists.body?.watchlists?.some(list => list.name === 'E2E 綁定測試'), 'A 的觀察清單還在（資料跟著走）')
  check(await pageA.locator('.el-message', { hasText: '已用 LINE 建立帳號' }).count() === 0, '沒有「新帳號」提示')
  await pageA.context().close()

  console.log('3. 帳號 B 綁同一個 LINE')
  const pageB = await newPage()
  await signInWithEmail(pageB, B)
  await bindLine(pageB, SUB)
  check((await pageB.getByRole('alert').innerText().catch(() => '')).includes('已經綁在另一個帳號上'), 'B 被擋：這個 LINE 已經綁在另一個帳號上')
  await pageB.context().close()

  console.log('4. 新的 LINE 第一次登入（LINE 優先的人）')
  const pageL = await newPage()
  await signInWithLine(pageL, SUB2)
  check(await uidOf(pageL) === `line:${SUB2}`, `建立 line:${SUB2}`)
  check(await pageL.locator('.el-message', { hasText: '已用 LINE 建立帳號' }).count() > 0, '新帳號提示（歡迎＋可以加上 Google）')
  const lineList = await api(pageL, '/watchlists', { method: 'POST', body: JSON.stringify({ name: 'E2E LINE 資料' }) })
  check(lineList.status === 201, `LINE 帳號建一份觀察清單（${lineList.status}）`)
  await pageL.goto(`${base}/profile`, { waitUntil: 'networkidle' }); await pageL.waitForTimeout(1500)
  check(await pageL.getByRole('button', { name: '加上 Google 登入' }).isVisible(), '個人資料有「加上 Google 登入」')
  await pageL.context().close()
  const pageLine = await newPage({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.0.0' })
  await signInWithLine(pageLine, SUB2)
  await pageLine.goto(`${base}/profile`, { waitUntil: 'networkidle' }); await pageLine.waitForTimeout(1500)
  check(await pageLine.getByRole('link', { name: '用外部瀏覽器開啟' }).isVisible() && await pageLine.getByRole('button', { name: '加上 Google 登入' }).count() === 0, 'LINE 內建瀏覽器：改成「用外部瀏覽器開啟」')
  await pageLine.context().close()

  console.log('5. B 綁一個已經有資料的 LINE')
  const pageB2 = await newPage()
  await signInWithEmail(pageB2, B)
  await bindLine(pageB2, SUB2)
  check((await pageB2.getByRole('alert').innerText().catch(() => '')).includes('沒辦法合併'), 'B 被擋：這個 LINE 帳號已經有自己的資料')
  await pageB2.context().close()
} finally {
  console.log('6. 清理（刪掉臨時帳號）')
  for (const [label, signIn] of [['A', page => signInWithEmail(page, A)], ['B', page => signInWithEmail(page, B)], [`line:${SUB2}`, page => signInWithLine(page, SUB2)]]) {
    const page = await newPage()
    try {
      await signIn(page)
      await deleteSignedIn(page, label)
    } catch (error) {
      leftovers.push(`${label}（${error.message.split('\n')[0]}）`)
    }
    await page.context().close()
  }
  // A 刪了之後，原本綁給 A 的 LINE 再登入：要是全新的 line:{sub}，不是把 A 復活成空帳號
  const page = await newPage()
  try {
    await signInWithLine(page, SUB)
    check(await uidOf(page) === `line:${SUB}`, `A 刪了之後再用那個 LINE 登入是新的 line:${SUB}（不會把 A 復活）`)
    await deleteSignedIn(page, `line:${SUB}`)
  } catch (error) {
    leftovers.push(`line:${SUB}（${error.message.split('\n')[0]}）`)
  }
  await page.context().close()
  await browser.close()
  console.log(leftovers.length ? `\n沒清掉的臨時帳號（要手動刪）：${leftovers.join('、')}` : '\n臨時帳號都刪掉了')
}

if (failures) { console.log(`\n${failures} 項失敗`); process.exit(1) }
console.log('\n全部通過')
