// 三組篩選重新整理前後，顯示欄位不能跑掉（2026-11-05，使用者：「screener 顯示欄位重新整理以後會跑掉」）：改欄位 → 記下兩個下拉、表頭順序 →
// 重新整理 → 要一模一樣。原本 21 條流程有多條不一樣：換欄位組合時表格的順序跟存的不同（SharedMetricTable）、普通股訪客的總覽有被藏起來的舊指標、
// 未儲存的那組變成「請選擇」、沒有條件的已存篩選跳回「全部」、套用官方欄位組合時舊指標要到下次開頁才換。
// 登入的流程用測試帳號，但篩選與欄位組合全是這支腳本假的（記得住狀態，存了下次讀得到）：帳號裡什麼都不會變，其他寫入一律擋下。訪客的流程是真的查。
// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-screener-reload.mjs [流程名稱的一部分]（要 A11Y_TEST_EMAIL／PASSWORD；BASE_URL 可換 DEV）
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const only = process.argv[2]
const browser = await chromium.launch()

const preset = (id, name, filters) => ({ id, name, sectorCodes: [], excludeSectorCodes: [], heldPortfolioIds: [], excludeHeldPortfolioIds: [], sortField: null, order: null, lastColumnPresetId: null, filters })
const range = (field, min) => ({ field, min, max: null, exclude: false })
const set = (id, isDefault, fields) => ({ id, name: `組合${id}`, isDefault, columns: fields.map(field => ({ field })) })
const UNIVERSES = {
  common: { path: '/screener/common', guestPath: '/screener/common?template=value', first: '高 ROE', second: '低負債', guestColumn: '負債比率', column: '毛利率', presets: () => [preset('p1', '高 ROE', [range('roe.TTM', 15)]), preset('p2', '低負債', [range('debtRatio.Q', 1)])], sets: () => [set('A', true, ['roe.TTM', 'debtRatio.Q']), set('B', false, ['netIncomeGrowthRate.TTM', 'roe.TTM', 'debtRatio.Q'])] },
  etf: { path: '/screener/etf', guestPath: '/screener/etf', first: '大型', second: '人多', guestColumn: '受益人數', column: '受益人數', presets: () => [preset('p1', '大型', [range('aum', 100)]), preset('p2', '人多', [range('holders', 1)])], sets: () => [set('A', false, ['aum', 'holders']), set('B', false, ['return1y', 'aum', 'return3y'])] },
  preferred: { path: '/screener/preferred', guestPath: '/screener/preferred', first: '高殖利率', second: '低溢價', guestColumn: '發行價', column: '最差殖利率', presets: () => [preset('p1', '高殖利率', [range('currentYieldPct', 1)]), preset('p2', '低溢價', [range('premiumRatePct', -100)])], sets: () => [set('A', false, ['issuePrice', 'ytwPct']), set('B', false, ['currentYieldPct', 'issuePrice', 'premiumRatePct'])] }
}

// 官方範本固定帶一支被藏起來的舊指標：業務中台的範本改好之後這條照樣驗得到，隱藏清單歸網站管，範本隨時可能又過期
const TEMPLATE = { key: 'dividendIncome', name: '存股與股利', description: '殖利率與 ROE', fields: ['dividendYield.EOD', 'roe.TTM'] }

// 假的業務中台：存的東西下次讀得到，/run 回那組欄位組合的順序並記住上次用的（同 run_preset.rs）。查詢是真的
const mock = async (ctx, saved) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method()
    if (saved) {
      if (p === '/api/core/screener/presets' && m === 'GET') return route.fulfill({ json: { presets: saved.presets } })
      if (p === '/api/core/screener/column-presets' && m === 'GET') return route.fulfill({ json: { columnPresets: saved.sets } })
      if (p === '/api/cached/screener/column-preset-templates') return route.fulfill({ json: { templates: [TEMPLATE] } })
      if (p === `/api/core/screener/column-preset-templates/${TEMPLATE.key}/apply`) {
        const created = { ...set('T', false, TEMPLATE.fields), name: TEMPLATE.name }
        saved.sets.push(created)
        return route.fulfill({ json: { preset: created } })
      }
      const run = p.match(/^\/api\/core\/screener\/presets\/([^/]+)\/run$/)
      if (run) {
        const target = saved.presets.find(item => item.id === run[1])
        const asked = url.searchParams.get('columnPresetId')
        if (asked) target.lastColumnPresetId = asked
        const columnSet = saved.sets.find(item => item.id === (asked || target.lastColumnPresetId)) ?? saved.sets.find(item => item.isDefault)
        return route.fulfill({ json: { screener: { count: 1, page: 1, pageSize: 20, totalPages: 1, columns: columnSet.columns.map(({ field }) => ({ field, metricName: field, fieldName: '', unit: '' })), results: [{ symbol: '2330', name: '台積電', values: {} }] }, columnPresetId: columnSet.id, preset: target } })
      }
      const one = p.match(/^\/api\/core\/screener\/presets\/([^/]+)$/)
      if (one && m === 'PATCH') {
        const target = saved.presets.find(item => item.id === one[1])
        Object.assign(target, req.postDataJSON())
        return route.fulfill({ json: { preset: target } })
      }
      const column = p.match(/^\/api\/core\/screener\/column-presets\/([^/]+)$/)
      if (column && m === 'PATCH') {
        const target = saved.sets.find(item => item.id === column[1])
        Object.assign(target, req.postDataJSON())
        return route.fulfill({ json: { columnPreset: target } })
      }
    }
    if (m === 'GET' || /identitytoolkit|securetoken/.test(url.host + p)) return route.continue()
    if (['/api/core/etf-screener', '/api/core/screener', '/api/core/screener/values'].includes(p) && m === 'POST') return route.continue()
    return route.abort()
  })
}

const snapshot = page => page.evaluate(() => ({
  menus: [...document.querySelectorAll('.screener-preset-select__select')].map(el => el.innerText.trim().replace(/\s+/g, ' ')),
  heads: [...document.querySelectorAll('.smt-table-view .el-table__header th .screener-result-table__column-label')].map(el => el.textContent.trim())
}))
const settled = async (page) => {
  await page.locator('.screener-result-table .el-table__body tbody tr').first().waitFor({ timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1800)
}
const choose = async (page, index, name) => {
  await page.locator('.screener-preset-select__select').nth(index).click()
  await page.locator('.el-select-dropdown__item:visible', { hasText: name }).first().click()
  await page.waitForTimeout(1800)
}
const removeLastColumn = async (page) => {
  await page.locator('.smt-table-view .screener-result-table__head').last().click()
  await page.locator('.column-menu [role="menu"]').getByRole('menuitem', { name: /移除這一欄/ }).click()
  await page.waitForTimeout(1500)
}
async function addColumn(page, name) {
  const dialog = page.getByRole('dialog', { name: /^(欄位設定|新增欄位)$/ })
  await page.getByRole('button', { name: '欄位設定' }).click()
  await dialog.getByRole('button', { name: '＋ 新增欄位' }).click()
  await dialog.getByRole('textbox', { name: '搜尋指標名稱' }).fill(name)
  await dialog.locator('.indicator-dialog__item').first().click()
  await dialog.getByRole('button', { name: '儲存' }).click()
  await page.waitForTimeout(2500)
}
const applyColumnTemplate = async (page) => {
  await page.getByRole('button', { name: '新增欄位組合' }).click()
  await page.getByRole('button', { name: /官方精選欄位組合/ }).click()
  await page.getByRole('button', { name: new RegExp(TEMPLATE.name) }).click()
  await page.waitForTimeout(2500)
}

// ---- 登入（同 check-screener-manage） ----
const loginCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await mock(loginCtx, null)
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

const flowsOf = (key) => {
  const u = UNIVERSES[key]
  // 普通股登入後第一組就是目前這組；ETF、特別股要先從內建的「全部」切過去
  const onFirst = page => (key === 'common' ? undefined : choose(page, 0, u.first))
  const flows = [
    { name: '訪客 加一欄', guest: true, path: u.guestPath, act: page => addColumn(page, u.guestColumn) },
    { name: '選組合B', act: async (page) => { await onFirst(page); await choose(page, 1, '組合B') } },
    { name: '組合B 移除一欄', act: async (page) => { await onFirst(page); await choose(page, 1, '組合B'); await removeLastColumn(page) } },
    { name: '組合B 加一欄', act: async (page) => { await onFirst(page); await choose(page, 1, '組合B'); await addColumn(page, u.column) } },
    { name: '切到第二組', act: page => choose(page, 0, u.second) }
  ]
  if (key === 'common') return [...flows, { name: '未儲存的那組 選組合B', path: '/screener/common?f=roe.TTM:20~', act: page => choose(page, 1, '組合B') }, { name: '套用官方欄位組合', act: applyColumnTemplate }]
  return [
    ...flows,
    { name: '內建那組 選組合B', act: page => choose(page, 1, '組合B') },
    { name: '已存的那組拿掉全部條件', act: async (page) => { await onFirst(page); await choose(page, 1, '組合B'); await page.locator('.condition-pill__remove').first().click(); await page.waitForTimeout(2500) } }
  ]
}

let failures = 0
for (const key of Object.keys(UNIVERSES)) {
  console.log(`\n== ${key}`)
  for (const flow of flowsOf(key).filter(item => !only || item.name.includes(only))) {
    const u = UNIVERSES[key]
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(flow.guest ? {} : { storageState }) })
    await mock(ctx, flow.guest ? null : { presets: u.presets(), sets: u.sets() })
    const page = await ctx.newPage()
    await page.goto(`${base}${flow.path ?? u.path}`, { waitUntil: 'networkidle', timeout: 180000 })
    await settled(page)
    await flow.act(page)
    await settled(page)
    const before = await snapshot(page)
    await page.reload({ waitUntil: 'networkidle', timeout: 180000 })
    await settled(page)
    const after = await snapshot(page)
    const same = JSON.stringify(before) === JSON.stringify(after) && before.heads.length > 0
    if (!same) failures++
    console.log(`  ${same ? 'PASS' : 'FAIL'}  ${flow.name}${same ? '' : `\n        前 ${JSON.stringify(before)}\n        後 ${JSON.stringify(after)}`}`)
    await ctx.close()
  }
}

await browser.close()
console.log(failures ? `FAIL: screener reload（${failures}）` : 'PASS: screener reload')
process.exit(failures ? 1 : 0)
