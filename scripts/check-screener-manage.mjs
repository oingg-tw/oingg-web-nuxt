// 「我的篩選」的管理彈窗（ScreenerPresetManageDialog，2026-10-22 使用者選 B 彈窗、「如果用彈窗 改名 就 不用倒數了」）。
// 登入測試帳號，但篩選組合的讀寫全是這支腳本假的：帳號裡什麼都不會變；其他寫入一律擋下。驗：
//   - 彈窗列出全部；名稱直接在列上改；上移之後焦點跟著那一列
//   - 刪除留在原位寫「儲存後刪除」、可以復原、沒有倒數（11 秒後還在、沒送 DELETE）
//   - Tab 不會跑出彈窗；axe 0
//   - 取消什麼都不送；再打開是原本的清單
//   - 儲存照「改名 → 刪除 → 排序」一項做完才送下一項（假的排序跟 業務中台 一樣要全部已存的 id，刪除還沒做完就排會 400）
//   - 名稱框按 Enter 就是儲存（2026-10-24，使用者：「管理我的篩選 連續按下enter 要視同儲存」）
//   - 訪客那一組（未儲存）在彈窗裡只寫一句、不能改
// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-screener-manage.mjs（要 A11Y_TEST_EMAIL／PASSWORD；DIR＝截圖目錄，可省略）
import AxeBuilder from '@axe-core/playwright'
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const browser = await chromium.launch()
let failures = 0
const check = (cond, label, detail = '') => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `（${detail}）` : ''}`); if (!cond) failures++ }

const START = [
  { id: 'p-a', name: '高股息', filters: [{ field: 'dividendYield.EOD', min: 5, max: null, exclude: false }] },
  { id: 'p-b', name: '低本益比', filters: [{ field: 'exchangePeRatio.EOD', min: null, max: 12, exclude: false }] },
  { id: 'p-c', name: '成長', filters: [{ field: 'revenueYoy.M', min: 20, max: null, exclude: false }] }
]
let presets = structuredClone(START)
const calls = []
const mock = async (ctx) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method()
    if (p === '/api/core/screener/presets' && m === 'GET') return route.fulfill({ json: { presets } })
    const run = p.match(/^\/api\/core\/screener\/presets\/([^/]+)\/run$/)
    if (run && m === 'GET') {
      const preset = presets.find(item => item.id === run[1])
      return route.fulfill({ json: { preset, screener: { count: 0, columns: [], results: [], page: 1, pageSize: 20, totalPages: 0 }, columnPresetId: null } })
    }
    const one = p.match(/^\/api\/core\/screener\/presets\/([^/]+)$/)
    if (one && m === 'PATCH') {
      const body = JSON.parse(req.postData()); calls.push(`PATCH ${one[1]} ${body.name}`)
      presets = presets.map(item => (item.id === one[1] ? { ...item, ...body } : item))
      return route.fulfill({ json: { preset: presets.find(item => item.id === one[1]) } })
    }
    if (one && m === 'DELETE') {
      calls.push(`DELETE ${one[1]}`)
      await new Promise(resolve => setTimeout(resolve, 600))
      presets = presets.filter(item => item.id !== one[1])
      return route.fulfill({ status: 204, body: '' })
    }
    if (p === '/api/core/screener/presets/reorder' && m === 'POST') {
      const { ids } = JSON.parse(req.postData()); calls.push(`REORDER ${ids.join(',')}`)
      const all = ids.length === presets.length && presets.every(item => ids.includes(item.id))
      if (!all) return route.fulfill({ status: 400, contentType: 'application/problem+json', body: JSON.stringify({ status: 400, title: 'ids must be every preset' }) })
      presets = ids.map(id => presets.find(item => item.id === id))
      return route.fulfill({ status: 204, body: '' })
    }
    if (m === 'GET' || /identitytoolkit|securetoken/.test(url.host + p)) return route.continue()
    if (p === '/api/core/screener' && m === 'POST') return route.continue()
    calls.push(`BLOCKED ${m} ${p}`)
    return route.abort()
  })
}

// ---- 登入（同 check-share-links） ----
const loginCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await mock(loginCtx)
const lp = await loginCtx.newPage()
await lp.goto(`${base}/calendar`, { waitUntil: 'networkidle', timeout: 180000 })
await lp.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 }); await lp.waitForTimeout(500)
await lp.locator('button[title="登入"]:visible').first().click()
const ui = lp.locator('#firebaseui-auth-container')
await ui.locator('.firebaseui-idp-password').click({ timeout: 30000 })
await ui.locator('input[name="email"]').fill(process.env.A11Y_TEST_EMAIL); await ui.locator('.firebaseui-id-submit').click()
await ui.locator('input[name="password"]').fill(process.env.A11Y_TEST_PASSWORD); await ui.locator('.firebaseui-id-submit').click()
await lp.locator('.user-menu-button__trigger').first().waitFor({ state: 'attached', timeout: 60000 })
const storageState = await loginCtx.storageState({ indexedDB: true })
await loginCtx.close()

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState })
await mock(ctx)
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', error => pageErrors.push(error.message))
await page.goto(`${base}/screener/common`, { waitUntil: 'networkidle', timeout: 180000 })
await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 })
const manage = page.getByRole('button', { name: '管理我的篩選' })
await manage.waitFor({ timeout: 60000 })
const dialog = page.getByRole('dialog', { name: '管理我的篩選' })
const names = () => dialog.locator('li').evaluateAll(rows => rows.map(row => row.querySelector('input')?.value ?? row.textContent.trim()))
const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName)
const options = async () => {
  await page.locator('.screener-preset-select__select').first().click()
  await page.locator('.el-select-dropdown__item:visible').first().waitFor()
  const texts = await page.locator('.el-select-dropdown__item:visible').allTextContents()
  await page.keyboard.press('Escape')
  return texts.map(text => text.trim())
}

console.log('登入（假的篩選組合）')
await manage.click()
await dialog.waitFor()
check((await names()).join('、') === '高股息、低本益比、成長', '彈窗列出全部', (await names()).join('、'))
await dialog.getByLabel('「低本益比」的名稱').fill('低 PE')
await dialog.getByRole('button', { name: '把「成長」上移' }).click()
check((await names()).join('、') === '高股息、成長、低 PE', '上移之後順序變了', (await names()).join('、'))
check(await focused() === '把「成長」上移', '上移之後焦點還在那一列', await focused())
await dialog.getByRole('button', { name: '刪除「高股息」' }).click()
check((await dialog.locator('li').first().textContent()).includes('「高股息」儲存後刪除'), '刪除的那一列留在原位')
check(await focused() === '復原「高股息」', '焦點移到「復原」', await focused())
await page.waitForTimeout(11000)
check((await dialog.locator('li').first().textContent()).includes('儲存後刪除') && !calls.some(call => call.startsWith('DELETE')), '沒有倒數：11 秒後還在、沒送刪除')
check(!/\d/.test(await dialog.locator('li').first().textContent()), '「復原」旁邊沒有秒數')
if (process.env.DIR) await page.screenshot({ path: `${process.env.DIR}/screener-manage.png` })
await dialog.getByRole('button', { name: '復原「高股息」' }).click()
check((await names())[0] === '高股息' && await focused() === '刪除「高股息」', '復原之後那一列回來、焦點在它的「刪除」', await focused())
const where = []
for (let i = 0; i < 20; i++) {
  await page.keyboard.press('Tab')
  where.push(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))
}
check(where.every(Boolean), 'Tab 20 次都在彈窗裡', `${where.filter(Boolean).length}/20`)
const violations = (await new AxeBuilder({ page }).include('.el-dialog').analyze()).violations.map(v => `${v.id}(${v.nodes.length})`)
check(!violations.length, '彈窗 axe 0', violations.join(',') || '0')

await dialog.getByRole('button', { name: '取消' }).click()
await dialog.waitFor({ state: 'hidden' })
check(!calls.length, '取消什麼都不送', calls.join(' | '))
check(await focused() === '管理我的篩選', '關掉後焦點回到「管理」', await focused())
await manage.click()
await dialog.waitFor()
check((await names()).join('、') === '高股息、低本益比、成長', '再打開是原本的清單', (await names()).join('、'))

await dialog.getByLabel('「低本益比」的名稱').fill('低 PE')
await dialog.getByRole('button', { name: '把「成長」上移' }).click()
await dialog.getByRole('button', { name: '刪除「高股息」' }).click()
await dialog.getByLabel('「成長」的名稱').fill('')
await dialog.getByRole('button', { name: '儲存' }).click()
check(await dialog.isVisible() && await focused() === 'INPUT' && (await dialog.textContent()).includes('名稱要 1 到 20 個字'), '空名稱擋下、焦點在那一格')
// 這次用名稱框的 Enter 存（上面那次點「儲存」）
await dialog.getByLabel('「成長」的名稱').fill('成長')
await dialog.getByLabel('「成長」的名稱').press('Enter')
await dialog.waitFor({ state: 'hidden' })
for (const start = Date.now(); Date.now() - start < 15000 && !calls.some(call => call.startsWith('REORDER')); await page.waitForTimeout(200));
await page.waitForTimeout(800)
check(calls.join(' | ') === 'PATCH p-b 低 PE | DELETE p-a | REORDER p-c,p-b', '儲存照改名 → 刪除 → 排序送出', calls.join(' | '))
check(!(await page.locator('.el-message').allTextContents()).some(text => /失敗/.test(text)), '沒有失敗提示')
const after = await options()
check(after.join('、') === '成長、低 PE', '選單是新的名稱與順序', after.join('、'))
check(!pageErrors.length, '沒有 page error', pageErrors.join(' | '))

console.log('訪客')
const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
await guest.goto(`${base}/screener/common?template=value`, { waitUntil: 'networkidle', timeout: 180000 })
await guest.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 })
await guest.getByRole('button', { name: '管理我的篩選' }).click()
const guestDialog = guest.getByRole('dialog', { name: '管理我的篩選' })
await guestDialog.waitFor()
check((await guestDialog.textContent()).includes('未儲存，存起來之後才能管理') && !(await guestDialog.locator('input').count()), '未儲存的那一組只寫一句、不能改')
check(await guestDialog.getByRole('button', { name: '關閉', exact: true }).count() === 1 && !(await guestDialog.getByRole('button', { name: '儲存' }).count()), '沒有能改的就只有「關閉」')
// 等打開的淡入跑完再拍（不然彈窗看起來像在頁面後面）
if (process.env.DIR) await guest.waitForTimeout(600).then(() => guest.screenshot({ path: `${process.env.DIR}/screener-manage-guest.png` }))
const overflow = await guest.evaluate(() => document.documentElement.scrollWidth - innerWidth)
check(overflow <= 0, '手機寬度沒有橫向捲動', `${overflow}px`)

await browser.close()
console.log(failures ? `\nFAIL: screener manage（${failures}）` : '\nPASS: screener manage')
process.exit(failures ? 1 : 0)
