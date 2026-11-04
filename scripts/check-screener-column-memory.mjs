// 每一組「我的篩選」記著上次選的欄位組合（2026-11-04，使用者：「我的篩選至少要保留 用戶 最後選擇了哪一組 欄位組合」），ETF 篩選
// （特別股是同一套 useUniverseScreener；普通股原本就由業務中台的 run 記）。登入測試帳號，但篩選組合與欄位組合全是這支腳本假的：
// 帳號裡什麼都不會變，其他寫入一律擋下。驗：
//   - 切到記著欄位組合的那一組，欄位換成它
//   - 在一組上選欄位組合 → 只 PATCH 那一組的 lastColumnPresetId；選內建的「基本欄位」→ null
//   - 切到沒記過的那一組，欄位照目前的、不換，也不會順手改到其他組
// Run: 本機 dev（:3000）開著，node --env-file=.env scripts/check-screener-column-memory.mjs（要 A11Y_TEST_EMAIL／PASSWORD）
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const browser = await chromium.launch()
let failures = 0
const check = (cond, label, detail = '') => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `（${detail}）` : ''}`); if (!cond) failures++ }

const presets = [
  { id: 'e-a', name: '高股息 ETF', filters: [{ field: 'aum', min: 100, max: null, exclude: false }], lastColumnPresetId: 'ec-b' },
  { id: 'e-b', name: '大型 ETF', filters: [{ field: 'aum', min: 1000, max: null, exclude: false }], lastColumnPresetId: null }
]
const columnPresets = [
  { id: 'ec-a', name: '規模', isDefault: false, columns: [{ field: 'aum' }, { field: 'holders' }] },
  { id: 'ec-b', name: '報酬', isDefault: false, columns: [{ field: 'return1y' }, { field: 'return3y' }] }
]
const patches = []
const mock = async (ctx) => {
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method()
    if (p === '/api/core/screener/presets' && m === 'GET') return route.fulfill({ json: { presets } })
    if (p === '/api/core/screener/column-presets' && m === 'GET') return route.fulfill({ json: { columnPresets } })
    const one = p.match(/^\/api\/core\/screener\/presets\/([^/]+)$/)
    if (one && m === 'PATCH') {
      const body = req.postDataJSON()
      patches.push(`${one[1]} ${JSON.stringify(body)}`)
      const preset = presets.find(item => item.id === one[1])
      Object.assign(preset, body)
      return route.fulfill({ json: { preset } })
    }
    if (m === 'GET' || /identitytoolkit|securetoken/.test(url.host + p)) return route.continue()
    if (p === '/api/core/etf-screener' && m === 'POST') return route.continue()
    patches.push(`BLOCKED ${m} ${p}`)
    return route.abort()
  })
}

// ---- 登入（同 check-screener-manage） ----
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
await page.goto(`${base}/screener/etf`, { waitUntil: 'networkidle', timeout: 180000 })

const select = index => page.locator('.screener-preset-select__select').nth(index)
const selected = async index => (await select(index).innerText()).trim()
async function choose(index, name) {
  await select(index).click()
  await page.locator('.el-select-dropdown__item:visible', { hasText: name }).first().click()
  await page.waitForTimeout(600)
}
const settled = async (index, name) => { for (const start = Date.now(); Date.now() - start < 10000 && (await selected(index)) !== name; await page.waitForTimeout(200)); return selected(index) }

await select(0).waitFor({ timeout: 60000 })
await choose(0, '高股息 ETF')
check((await settled(1, '報酬')) === '報酬', '切到記著「報酬」的那一組，欄位換成「報酬」', await selected(1))
patches.length = 0
await choose(1, '規模')
await page.waitForTimeout(800)
check(patches.join(' | ') === 'e-a {"lastColumnPresetId":"ec-a"}', '選「規模」只記在目前這一組', patches.join(' | '))
patches.length = 0
await choose(0, '大型 ETF')
check((await selected(1)) === '規模' && patches.length === 0, '切到沒記過的那一組：欄位照目前的、不改任何一組', `${await selected(1)}；${patches.join(' | ') || '沒有 PATCH'}`)
await choose(0, '高股息 ETF')
check((await settled(1, '規模')) === '規模', '切回來還是剛才選的「規模」', await selected(1))
patches.length = 0
await choose(1, '基本欄位')
await page.waitForTimeout(800)
check(patches.join(' | ') === 'e-a {"lastColumnPresetId":null}', '選內建的「基本欄位」→ 這一組的記憶清掉（null）', patches.join(' | '))
check(!pageErrors.length, '沒有 page error', pageErrors.join(' | '))

await browser.close()
console.log(failures ? `FAIL: screener column memory（${failures}）` : 'PASS: screener column memory')
process.exit(failures ? 1 : 0)
