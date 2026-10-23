import { chromium } from 'playwright'

// 指標速覽每一種圖都畫得出來（2026-10-16「指標速覽沒有顯示所有的指標圖，為什麼？這邊不是統一模板了嗎」→ slug 對應哪張圖只在
// metric-pages.ts 的 quickViewChartOf，能不能釘也讀它）。每種 kind 各釘一支，用指標速覽自己的「加入指標」彈窗釘（未登入，釘選只在記憶體）：
//   - 2330：每一張卡都要畫出圖（SVG 裡有形狀，或現金循環時間軸的色段），不能落到只有標題的空卡
//   - 2891（金控）：每一支都要有卡——三率、流動資產這些拆不開的是空狀態卡，不是整格消失
//   - 彈窗裡沒有純表格頁（填權填息、三大報表）
// 用法：先開伺服器（正式建置：PORT=3100 node --env-file=.env .output/server/index.mjs），
//   QUICK_VIEW_CHECK_URL=http://localhost:3100 node scripts/check-quick-view.mjs
const baseUrl = process.env.QUICK_VIEW_CHECK_URL ?? 'http://localhost:3000'

// 每種 kind 一支，列名同指標目錄（STOCK_METRIC_INDEX）。一次最多釘 12 支，所以分兩批
const BATCHES = [
  ['本益比', '每股盈餘', 'ROE', '股東回饋組成', '營業費用組成', '殖利率', '月營收', '杜邦分析', '淨值從哪來', '三率的關係', '安全韌性的組成', '現金循環的組成'],
  ['淨值組成', '流動資產組成', '非流動資產組成', '負債組成', '現金流量的組成']
]
const TABLE_ONLY = ['填權填息', '三大財務報表', '資產負債表', '損益表', '現金流量表']

const failures = []
function expect(scope, name, ok, detail = '') {
  const line = `${scope} ${name}${detail ? ` (${detail})` : ''}`
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${line}`)
  if (!ok) failures.push(line)
}

const exact = label => new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

// 彈窗裡把釘選改成剛好是 labels
async function pinOnly(page, labels) {
  await page.getByRole('button', { name: '加入指標' }).click()
  const dialog = page.getByRole('dialog', { name: '加入指標' })
  await dialog.waitFor()
  const pinned = dialog.locator('button[aria-pressed="true"]')
  while (await pinned.count()) await pinned.first().click()
  for (const label of labels) await dialog.getByRole('button', { name: exact(label) }).click()
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
}

const cardOf = (page, label) => page.locator('.stock-quick-view-page__grid > *').filter({ has: page.locator('h3 a', { hasText: exact(label) }) })

// 圖進到畫面附近才畫（SharedChart，2026-10-23）：先捲到卡片，跟讀者看到的方式一樣
async function hasChart(card) {
  await card.scrollIntoViewIfNeeded().catch(() => {})
  return (await card.locator('[role="img"] svg path').count()) >= 3 || (await card.locator('.cctl__seg').count()) > 0
}

async function waitFor(check, timeout = 45000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await check()) return true
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return false
}

const browser = await chromium.launch()

for (const { code, needChart } of [{ code: '2330', needChart: true }, { code: '2891', needChart: false }]) {
  console.log(`\n== /stock/${code}`)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(String(error).slice(0, 160)))
  let inflight = 0
  page.on('request', () => inflight++)
  page.on('requestfinished', () => inflight--)
  page.on('requestfailed', () => inflight--)
  await page.goto(`${baseUrl}/stock/${code}`, { waitUntil: 'networkidle', timeout: 120000 })

  if (needChart) {
    await page.getByRole('button', { name: '加入指標' }).click()
    const dialog = page.getByRole('dialog', { name: '加入指標' })
    await dialog.waitFor()
    for (const label of TABLE_ONLY) expect(code, `彈窗沒有純表格頁「${label}」`, (await dialog.getByRole('button', { name: exact(label) }).count()) === 0)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
  }

  for (const labels of BATCHES) {
    await pinOnly(page, labels)
    // 資料到之前每一支都是只有標題的空卡：等請求都回來（連續 1 秒沒有進行中的）再看，否則「資料到了反而整格消失」會被提早放行。
    // 不用 waitForLoadState('networkidle')：頁面載入時已經到過那個狀態，之後再呼叫會立刻回傳
    await waitFor(async () => {
      if (inflight > 0) return false
      await new Promise(resolve => setTimeout(resolve, 1000))
      return inflight === 0
    }, 120000)
    for (const label of labels) {
      const card = cardOf(page, label)
      const ok = await waitFor(async () => (await card.count()) === 1 && (!needChart || await hasChart(card)))
      expect(code, `${label} ${needChart ? '有圖' : '有卡片'}`, ok)
    }
  }
  expect(code, '沒有頁面錯誤', pageErrors.length === 0, pageErrors.join(' | '))
  await context.close()
}

await browser.close()
if (failures.length) {
  console.log(`\n${failures.length} failed`)
  process.exit(1)
}
console.log('\nall ok')
