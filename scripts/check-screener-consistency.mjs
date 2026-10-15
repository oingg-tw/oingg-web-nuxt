// 三組篩選（普通股、特別股、ETF）的一致性檢查（2026-10-15 三組篩選重新設計）。使用者：「三組最後使用UIUX要接近，降低用戶負擔」。
// 一致性主要靠架構（三頁都只是 ScreenerPageShell 加一個資料來源），這一支是架構的安全網：同一組斷言跑三頁，任何一頁少一樣就失敗。
//
// 用 `node scripts/check-screener-consistency.mjs` 對著跑起來的 `pnpm run dev`（SCREENER_CHECK_URL 可覆寫）。
// 全程以訪客身分跑：普通股的訪客要先選範本（使用者決定的進入方式），所以從 ?template=value 進；特別股與 ETF 一進來就列出全部。
//
// 每一頁斷言：
//   1. 控制項：「我的篩選」「顯示欄位」兩組選單（各有下拉、＋新增、管理）、新增條件、篩選結果標題、念出檔數的 live region
//   2. 訪客按「＋新增」開登入，不偷建
//   3. 條件流程：新增條件 → 挑數字欄位 → 下限設成不可能的數 → 0 檔 → 「移除最後一個條件」→ 檔數回來（沒有「搜尋」按鈕，自動查）
//   4. 版面：1440 寬沒有橫向捲軸、結果表至少 70% 視窗高；375 寬沒有橫向捲軸、結果是卡片、卡片區不是巢狀捲動
// 另外 ETF、特別股的個別頁：SSR 就有標題與內容、一圖一表（同個股頁那一條，scripts/page-shape.mjs）、找不到的代號 noindex。
import { chromium } from 'playwright'
import { isOneChartOneTable, pageShape } from './page-shape.mjs'

const baseUrl = process.env.SCREENER_CHECK_URL ?? 'http://localhost:3000'

// SCREENER_CHECK_ONLY=特別股,ETF 只跑其中幾頁
const only = process.env.SCREENER_CHECK_ONLY?.split(',')
const PAGES = [
  { name: '普通股', path: '/screener/common?template=value', search: '股東權益報酬率' },
  { name: '特別股', path: '/screener/preferred', search: '殖利率' },
  { name: 'ETF', path: '/screener/etf', search: '規模' }
].filter(target => !only || only.includes(target.name))

const failures = []
function expect(scope, name, ok, detail = '') {
  const line = `${scope} ${name}${detail ? ` (${detail})` : ''}`
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${line}`)
  if (!ok) failures.push(line)
}

async function visible(locator, timeout = 30000) {
  const start = Date.now()
  const ok = await locator.first().waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)
  return { ok, ms: Date.now() - start }
}

// 等「符合…檔」這一句變成想要的樣子（自動查，不是等固定秒數）
async function waitForCount(page, predicate, timeout = 45000) {
  const start = Date.now()
  let text = ''
  while (Date.now() - start < timeout) {
    text = (await page.locator('.screener-shell__count').textContent().catch(() => '')) ?? ''
    if (predicate(text)) return { ok: true, text, ms: Date.now() - start }
    await page.waitForTimeout(300)
  }
  return { ok: false, text, ms: Date.now() - start }
}

const browser = await chromium.launch()

for (const target of PAGES) {
  console.log(`\n== ${target.name} ${target.path}`)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(String(error).slice(0, 160)))

  await page.goto(`${baseUrl}${target.path}`, { waitUntil: 'load', timeout: 180000 })
  const rows = await visible(page.locator('.screener-result-table .el-table__body tbody tr'), 90000)
  expect(target.name, '結果表有資料列', rows.ok, `${rows.ms}ms`)
  if (!rows.ok) {
    await context.close()
    continue
  }
  const initial = await waitForCount(page, text => /\d+ 檔/.test(text))
  expect(target.name, '念出檔數', initial.ok, initial.text)

  // ── 1. 控制項（可及名稱，三頁同一組）
  for (const label of ['我的篩選', '顯示欄位']) {
    const group = page.getByRole('group', { name: label })
    expect(target.name, `「${label}」一組`, await group.count() === 1)
    expect(target.name, `「${label}」有下拉選單`, await group.locator('.el-select').count() === 1)
    expect(target.name, `「${label}」有管理`, await group.getByRole('button', { name: `管理${label}` }).count() === 1)
  }
  expect(target.name, '「新增篩選」按鈕', await page.getByRole('button', { name: '新增篩選' }).count() === 1)
  expect(target.name, '「新增欄位組合」按鈕', await page.getByRole('button', { name: '新增欄位組合' }).count() === 1)
  expect(target.name, '「新增條件」按鈕', await page.locator('.screener-filters__add-slot:visible').count() === 1)
  expect(target.name, '「篩選結果」標題', await page.getByRole('heading', { name: '篩選結果' }).count() === 1)
  expect(target.name, '沒有「搜尋」按鈕（改條件自動查）', await page.getByRole('button', { name: /^搜尋$/ }).count() === 0)

  // ── 2. 訪客的登入閘門
  await page.getByRole('button', { name: '新增篩選' }).click()
  const login = await visible(page.locator('[aria-label="登入"]'), 10000)
  expect(target.name, '訪客按「＋新增」開登入', login.ok, `${login.ms}ms`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)

  // ── 3. 條件流程
  await page.locator('.screener-filters__add-slot:visible').click()
  const picker = await visible(page.locator('.condition-panel .indicator-dialog'), 15000)
  expect(target.name, '新增條件開挑選面板', picker.ok)
  if (picker.ok) {
    await page.getByRole('textbox', { name: '搜尋指標名稱' }).fill(target.search)
    const item = page.locator('.condition-panel .indicator-dialog__item').first()
    const found = await visible(item, 10000)
    expect(target.name, `搜尋「${target.search}」有結果`, found.ok)
    if (found.ok) await item.click()
    const spin = page.locator('.condition-panel input[role="spinbutton"]').first()
    const editor = found.ok ? await visible(spin, 15000) : { ok: false }
    expect(target.name, `挑「${target.search}」後出現數字輸入`, editor.ok)
    if (editor.ok) {
      expect(target.name, '輸入框旁有單位', await page.locator('.condition-panel .range-editor__unit').count() > 0)
      await spin.fill('999999999999999')
      await spin.press('Enter')
      await page.getByRole('button', { name: '完成' }).click()
      const zero = await waitForCount(page, text => /符合上述條件 0 檔/.test(text))
      expect(target.name, '不可能的下限 → 0 檔（自動查）', zero.ok, `${zero.text}，${zero.ms}ms`)
      const undo = page.getByRole('button', { name: '移除最後一個條件' })
      expect(target.name, '0 檔時有「移除最後一個條件」', await undo.count() === 1)
      if (await undo.count()) {
        await undo.click()
        const back = await waitForCount(page, text => text === initial.text)
        expect(target.name, '移除後檔數回來', back.ok, `${back.text}，${back.ms}ms`)
      }
    }
  }

  // ── 4a. 桌機版面
  await page.waitForTimeout(800)
  const desktop = await page.evaluate(() => {
    const table = document.querySelector('.smt-table-view .el-table')
    const rowsCount = document.querySelectorAll('.screener-result-table .el-table__body tbody tr').length
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      tableHeight: table ? Math.round(table.getBoundingClientRect().height) : 0,
      viewport: window.innerHeight,
      rowsCount
    }
  })
  expect(target.name, '1440 寬沒有橫向捲軸', desktop.overflow <= 0, `超出 ${desktop.overflow}px`)
  if (desktop.rowsCount >= 15) {
    expect(target.name, '結果表至少 70% 視窗高', desktop.tableHeight >= desktop.viewport * 0.7, `${desktop.tableHeight}/${desktop.viewport}px，${desktop.rowsCount} 列`)
  }

  // ── 4b. 手機版面
  await page.setViewportSize({ width: 375, height: 812 })
  await page.waitForTimeout(1200)
  const mobile = await page.evaluate(() => {
    const cards = document.querySelector('.smt-cards-view')
    const nested = []
    for (let element = cards; element && element !== document.body; element = element.parentElement) {
      const style = getComputedStyle(element)
      if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1) nested.push(element.className.split(' ')[0])
    }
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      cardsVisible: !!cards && cards.getBoundingClientRect().height > 0 && getComputedStyle(cards).display !== 'none',
      cardCount: document.querySelectorAll('.smt-card').length,
      nested
    }
  })
  expect(target.name, '375 寬沒有橫向捲軸', mobile.overflow <= 0, `超出 ${mobile.overflow}px`)
  expect(target.name, '手機結果是卡片', mobile.cardsVisible && mobile.cardCount > 0, `${mobile.cardCount} 張`)
  expect(target.name, '卡片不在巢狀捲動框裡', mobile.nested.length === 0, mobile.nested.join(',') || '無')

  expect(target.name, '沒有 page error', pageErrors.length === 0, pageErrors.join(' | '))
  await context.close()
}

await browser.close()

// ── 個別頁（ETF、特別股，2026-10-15）：伺服器端就有標題與內容（不靠瀏覽器再讀）、一圖一表、找不到的代號 noindex。
// ETF 個別頁讀 GET /etfs/:symbol——DEV 要等 analysis-ts 部署才有，對著本機 4000 跑
const DETAIL_PAGES = [
  { path: '/screener/etf/0050', name: '元大台灣50' },
  { path: '/screener/etf/00679b', name: '元大美債20年' },
  { path: '/screener/preferred/2881a', name: '富邦特' },
  { path: '/screener/preferred/2887z1', name: '台新新光己特' }
]
for (const target of DETAIL_PAGES) {
  console.log(`
== 個別頁 ${target.path}`)
  const response = await fetch(`${baseUrl}${target.path}`)
  const html = await response.text()
  // 先拿掉註解：摘要卡的註解裡就寫著「<h1>」
  const h1 = (html.replace(/<!--[\s\S]*?-->/g, '').match(/<h1\b[^>]*>[\s\S]*?<\/h1>/g) ?? []).map(tag => tag.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
  expect(target.path, 'HTTP 200', response.status === 200, String(response.status))
  expect(target.path, `SSR 的 h1 就有「${target.name}」`, h1.some(text => text.includes(target.name)), h1.join(' | '))
  expect(target.path, '一圖一表', isOneChartOneTable(pageShape(html)), JSON.stringify(pageShape(html)))
  // 開發環境的 Site Config 對每一頁都輸出 noindex, nofollow（帶 data-hint="Site Config"），頁面自己的 noindex 是 useHubPageSeo 的 noindex, follow
  expect(target.path, '可以被收錄（頁面沒有自己設 noindex）', !html.includes('<meta name="robots" content="noindex, follow">'))
}
for (const [path, text] of [['/screener/etf/0000', '找不到這檔 ETF'], ['/screener/preferred/9999z', '找不到這檔特別股']]) {
  const html = await (await fetch(`${baseUrl}${path}`)).text()
  expect(path, `不存在的代號寫「${text}」而且 noindex`, html.includes(text) && html.includes('<meta name="robots" content="noindex, follow">'))
}

if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('\nPASS: screener consistency')
