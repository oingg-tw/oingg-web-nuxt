// 三組篩選的條件或欄位用到上游拿掉的指標（2026-11-05，GONE_FIELD_LABEL）。登入測試帳號，但存檔全是這支腳本假的：帳號裡什麼都不會變，其他寫入
// 一律擋下；業務中台對這種存檔的回應照它的 resolve_catalog_field_refs 模擬。訪客開舊連結是真的查。驗：
//   - 條件：膠囊寫「已下架的條件」不是欄位 id、沒有值可以改、不送查詢、不寫回帳號，結果區不說「沒有符合」；按移除之後才查、才存
//   - 分享連結的條件也一樣（不能默默少一個條件），訪客連結裡的「已經持有」照舊不帶
//   - 按條件名稱可以換成別的指標
//   - 普通股查詢被擋下時提示是中文，不是上游寫給工程師的理由
//   - 普通股的欄位組合：業務中台讀取時略過的欄位不存回帳號（型錄暫時沒有可能只是部署時間差）；真的沒存成功的改動下一次查詢才補送；
//     未儲存的那一組自己帶欄位，也不帶上游拿掉的
// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-screener-gone-field.mjs（要 A11Y_TEST_EMAIL／PASSWORD）
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const browser = await chromium.launch()
let failures = 0
const check = (cond, label, detail = '') => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `（${detail}）` : ''}`); if (!cond) failures++ }

const GONE = 'oldMetricGone'
const preset = (id, filters, extra = {}) => ({ id, name: '含下架條件', sectorCodes: [], excludeSectorCodes: [], heldPortfolioIds: [], excludeHeldPortfolioIds: [], sortField: null, order: null, lastColumnPresetId: null, ...extra, filters })
const range = (field, min) => ({ field, min, max: null, exclude: false })
const commonColumns = [{ id: 'cc-a', name: '報酬', isDefault: true, universe: 'common', columns: [{ field: 'roe.TTM' }] }]
const SAVED = [
  { name: '普通股', path: '/screener/common', presets: [preset('c-a', [range(`${GONE}.TTM`, 1), range('roe.TTM', 15)])], columnPresets: commonColumns },
  { name: 'ETF', path: '/screener/etf', presets: [preset('e-a', [range(GONE, 1), range('aum', 100)])], columnPresets: [] },
  { name: '特別股', path: '/screener/preferred', presets: [preset('p-a', [range(GONE, 1), range('currentYieldPct', 1)])], columnPresets: [] }
]
const column = (field, metricName) => ({ field, metricName, fieldName: '近四季', unit: '%' })
const roe = column('roe.TTM', 'ROE')
const runResult = target => ({ screener: { count: 1, page: 1, pageSize: 20, totalPages: 1, columns: target.runColumns ?? [roe], results: [{ symbol: '2330', name: '台積電', values: { 'roe.TTM': { value: 30, knowledgeDate: '2026-09-30', nullReason: null } } }] }, columnPresetId: 'cc-a', preset: target.presets[0] })

// failRun：普通股查詢回 400（欄位組合帶著拿掉的欄位，業務中台修好之前就是這樣）
const mock = async (ctx, target, log, failRun = false) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method()
    if (target) {
      if (p === '/api/core/screener/presets' && m === 'GET') return route.fulfill({ json: { presets: target.presets } })
      if (p === '/api/core/screener/column-presets' && m === 'GET') return route.fulfill({ json: { columnPresets: target.columnPresets } })
      if (/^\/api\/core\/screener\/presets\/[^/]+\/run$/.test(p)) {
        log.push(`run ${url.search}`)
        return failRun ? route.fulfill({ status: 400, contentType: 'application/problem+json', json: { title: 'Bad Request', status: 400, detail: `Unknown filter field "${GONE}.TTM"` } }) : route.fulfill({ json: runResult(target) })
      }
      if (/^\/api\/core\/screener\/column-presets\/[^/]+$/.test(p) && m === 'PATCH') {
        log.push(`column-patch ${req.postData()}`)
        if (target.failColumnPatch > 0) {
          target.failColumnPatch--
          return route.fulfill({ status: 500, contentType: 'application/problem+json', json: { title: 'Internal Server Error', status: 500 } })
        }
        return route.fulfill({ json: { columnPreset: target.columnPresets[0] } })
      }
      if (/^\/api\/core\/screener\/presets\/[^/]+$/.test(p) && m === 'PATCH') {
        log.push(`patch ${req.postData()}`)
        return route.fulfill({ json: { preset: target.presets[0] } })
      }
    }
    if (m === 'GET' || /identitytoolkit|securetoken/.test(url.host + p)) return route.continue()
    if ((p === '/api/core/etf-screener' || p === '/api/core/screener') && m === 'POST') { log.push(`query ${req.postData()}`); return route.continue() }
    log.push(`BLOCKED ${m} ${p}`)
    return route.abort()
  })
}

const pills = page => page.locator('.condition-pill').allTextContents().then(items => items.map(text => text.replace(/\s+/g, ' ').trim()))
const bodyText = page => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
const toasts = page => page.locator('.el-message').allTextContents()

async function seesGone(name, page) {
  const list = await pills(page)
  check(list.includes('已下架的條件'), `${name}：膠囊寫「已下架的條件」，沒有值可以改`, list.join('、'))
  check(!list.join().includes(GONE), `${name}：畫面上沒有欄位 id`)
  const text = await bodyText(page)
  check(text.includes('這組篩選有指標已經下架') && !text.includes('沒有符合上述條件'), `${name}：結果區說清楚，不說「沒有符合」`)
  check(text.includes('有已下架的條件') && !/符合上述條件 \d/.test(text), `${name}：不寫檔數`)
  check(!(await toasts(page)).length, `${name}：沒有錯誤提示`, (await toasts(page)).join('、'))
}

// ---- 登入（同 check-screener-manage） ----
const loginCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await mock(loginCtx, null, [])
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

async function openSaved(target, log, failRun) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState })
  await mock(ctx, target, log, failRun)
  const page = await ctx.newPage()
  await page.goto(`${base}${target.path}`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForTimeout(1200)
  if (target.path !== '/screener/common') {
    await page.locator('.screener-preset-select__select').first().click()
    await page.locator('.el-select-dropdown__item:visible', { hasText: '含下架條件' }).first().click()
  }
  await page.locator('.condition-pill').first().waitFor({ timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)
  return { ctx, page }
}

for (const target of SAVED) {
  console.log(`\n== 已存的條件：${target.name}`)
  const log = []
  const { ctx, page } = await openSaved(target, log)
  await seesGone(target.name, page)
  const beforeRemove = log.filter(line => line.includes(GONE) || line.startsWith('run') || line.startsWith('patch'))
  check(!beforeRemove.length, `${target.name}：沒有送查詢、沒有寫回帳號`, beforeRemove.join(' | ').slice(0, 160))
  await page.getByRole('button', { name: '移除已下架的條件' }).click()
  await page.waitForTimeout(3000)
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim())
  check(focused === '篩選結果', `${target.name}：按鈕消失後焦點在結果標題，不是掉回頁首`, focused?.slice(0, 40))
  const after = log.join(' | ')
  check(!(await pills(page)).includes('已下架的條件') && !(await bodyText(page)).includes('這組篩選有指標已經下架'), `${target.name}：移除之後說明不見`)
  if (target.path === '/screener/common') check(after.includes('patch') && after.includes('run') && !after.includes(GONE), '普通股：移除之後才存回、才查', after.slice(0, 200))
  else if (target.path === '/screener/etf') check(after.includes('query') && !after.split('query').pop().includes(GONE), 'ETF：移除之後才查', after.slice(0, 120))
  else check((await page.locator('.screener-result-table .el-table__body tbody tr').count()) > 0, '特別股：移除之後有結果')
  await ctx.close()
}

console.log('\n== 換成別的指標（ETF）')
{
  const log = []
  const { ctx, page } = await openSaved(SAVED[1], log)
  await page.locator('.condition-pill__field', { hasText: '已下架的條件' }).click()
  await page.locator('.condition-panel input[type="text"]:visible').first().fill('受益人數')
  await page.locator('.indicator-dialog__item:visible', { hasText: '受益人數' }).first().click()
  await page.locator('.range-editor').getByRole('spinbutton').first().fill('1')
  await page.getByRole('button', { name: '完成' }).click()
  await page.waitForTimeout(2500)
  const list = await pills(page)
  check(list.some(text => text.startsWith('受益人數')) && !list.includes('已下架的條件'), '按條件名稱換一個指標，就能查', list.join('、'))
  await ctx.close()
}

console.log('\n== 查詢被擋下（普通股）')
{
  const log = []
  const target = { ...SAVED[0], presets: [preset('c-a', [range('roe.TTM', 15)])] }
  const { ctx, page } = await openSaved(target, log, true)
  const shown = await toasts(page)
  check(shown.join().includes('查不出結果') && !/Unknown|GET \//.test(shown.join()), '提示是中文，不是上游的理由', shown.join('、'))
  await ctx.close()
}

console.log('\n== 業務中台略過欄位（普通股）')
{
  const log = []
  const skipped = [{ id: 'cc-a', name: '含下架欄位', isDefault: true, universe: 'common', columns: [{ field: 'roe.TTM' }, { field: `${GONE}.TTM` }] }]
  const target = { ...SAVED[0], presets: [preset('c-a', [range('roe.TTM', 15), range('debtRatio.Q', 1)])], columnPresets: skipped }
  const { ctx, page } = await openSaved(target, log)
  await page.locator('.condition-pill__remove').last().click()
  await page.waitForTimeout(2500)
  check(log.filter(line => line.startsWith('run')).length >= 2 && !log.some(line => line.startsWith('column-patch')), '改條件重查，畫面少的那一欄不存回帳號', log.map(line => line.split(' ')[0]).join('、'))
  await ctx.close()
}

console.log('\n== 欄位沒存成功（普通股）')
{
  const log = []
  const both = [{ id: 'cc-a', name: '報酬', isDefault: true, universe: 'common', columns: [{ field: 'roe.TTM' }, { field: 'debtRatio.Q' }] }]
  const target = { ...SAVED[0], presets: [preset('c-a', [range('roe.TTM', 15), range('debtRatio.Q', 1), range('netIncomeGrowthRate.TTM', 1)])], columnPresets: both, runColumns: [roe, column('debtRatio.Q', '負債比率')], failColumnPatch: 1 }
  const { ctx, page } = await openSaved(target, log)
  const patches = () => log.filter(line => line.startsWith('column-patch')).length
  await page.locator('.smt-table-view .screener-result-table__head').last().click()
  await page.locator('.column-menu [role="menu"]').getByRole('menuitem', { name: /移除這一欄/ }).click()
  await page.waitForTimeout(1200)
  check(patches() === 1, '移除一欄當下就存（這次假裝失敗）', `${patches()} 次`)
  await page.locator('.condition-pill__remove').last().click()
  await page.waitForTimeout(2500)
  check(patches() === 2, '下一次查詢補送', `${patches()} 次`)
  await page.locator('.condition-pill__remove').last().click()
  await page.waitForTimeout(2500)
  check(patches() === 2, '存成功之後不再送', `${patches()} 次`)
  await ctx.close()
}

console.log('\n== 未儲存的那一組選欄位組合（普通股）')
{
  const log = []
  const gone = [{ id: 'cc-gone', name: '含下架欄位', isDefault: false, universe: 'common', columns: [{ field: 'roe.TTM' }, { field: `${GONE}.TTM` }] }]
  const target = { ...SAVED[0], presets: [preset('c-a', [range('debtRatio.Q', 1)])], columnPresets: gone }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState })
  await mock(ctx, target, log)
  const page = await ctx.newPage()
  await page.goto(`${base}/screener/common?f=roe.TTM:15~`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.locator('.screener-preset-select__select').nth(1).waitFor({ timeout: 60000 })
  await page.waitForTimeout(1500)
  await page.locator('.screener-preset-select__select').nth(1).click()
  await page.locator('.el-select-dropdown__item:visible', { hasText: '含下架欄位' }).first().click()
  await page.waitForTimeout(3000)
  const queries = log.filter(line => line.startsWith('query'))
  check(queries.length > 0 && !queries.some(line => line.includes(GONE)), '送出的欄位不帶上游拿掉的', `${queries.length} 次查詢`)
  check(!(await toasts(page)).length && (await page.locator('.screener-result-table .el-table__body tbody tr').count()) > 0, '有結果、沒有錯誤提示', (await toasts(page)).join('、'))
  await ctx.close()
}

for (const [name, path] of [['普通股', `/screener/common?f=${GONE}.TTM:1~&f=roe.TTM:15~`], ['ETF', `/screener/etf?f=${GONE}:1~&f=aum:100~`], ['特別股', `/screener/preferred?f=${GONE}:1~`]]) {
  console.log(`\n== 訪客開舊連結：${name}`)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const log = []
  await mock(ctx, null, log)
  const page = await ctx.newPage()
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.locator('.condition-pill', { hasText: '已下架的條件' }).first().waitFor({ timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await seesGone(name, page)
  check(!log.some(line => line.includes(GONE)), `${name}：沒有送查詢`, log.join(' | ').slice(0, 160))
  await ctx.close()
}

console.log('\n== 訪客連結裡的已經持有')
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const log = []
  await mock(ctx, null, log)
  const page = await ctx.newPage()
  await page.goto(`${base}/screener/etf?f=holding.portfolioNames:someone-else`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForTimeout(2000)
  const list = await pills(page)
  check(!list.length && !log.join().includes('someone-else'), '不帶，別人的帳戶 id 不會送出去', list.join('、') || '沒有條件')
  await ctx.close()
}

await browser.close()
console.log(failures ? `FAIL: screener gone field（${failures}）` : 'PASS: screener gone field')
process.exit(failures ? 1 : 0)
