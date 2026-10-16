// 三組篩選（普通股、特別股、ETF）的一致性檢查（2026-10-15 三組篩選重新設計）。使用者：「三組最後使用UIUX要接近，降低用戶負擔」。
// 一致性主要靠架構（三頁都只是 ScreenerPageShell 加一個資料來源），這一支是架構的安全網：同一組斷言跑三頁，任何一頁少一樣就失敗。
//
// 用 `node scripts/check-screener-consistency.mjs` 對著跑起來的 `pnpm run dev`（SCREENER_CHECK_URL 可覆寫）。
// 全程以訪客身分跑：普通股的訪客要先選範本（使用者決定的進入方式），所以從 ?template=value 進；特別股與 ETF 一進來就列出全部。
//
// 每一頁斷言：
//   1. 控制項：「我的篩選」「顯示欄位」兩組選單（各有下拉、＋新增、管理）、新增條件、篩選結果標題、念出檔數的 live region
//   2. 訪客按「＋新增」開登入，不偷建
//   3. 條件流程：新增條件 → 挑數字欄位 → 下限設成不可能的數 → 0 檔 → 「移除最後一個條件」→ 檔數回來（沒有「搜尋」按鈕，自動查）；
//      再加一個顯示欄位（表頭多一欄）、點欄名排序（第一列換人）
//   4. 版面：1440 寬沒有橫向捲軸、排序箭頭不是一顆菱形、表格捲動區可聚焦、第一個畫面至少 8 列、沒有一口氣載完；欄位超出時右緣淡出、
//      第一個畫面就看得到橫向捲軸而且拖得動；往下捲表頭黏在頁首下面。375 寬沒有橫向捲軸、結果是卡片、卡片區不是巢狀捲動
// 另外 ETF、特別股的個別頁：SSR 就有標題與內容、一圖一表（同個股頁那一條，scripts/page-shape.mjs）、找不到的代號 noindex。
import { chromium } from 'playwright'
import { isOneChartOneTable, pageShape } from './page-shape.mjs'

const baseUrl = process.env.SCREENER_CHECK_URL ?? 'http://localhost:3000'

// SCREENER_CHECK_ONLY=特別股,ETF 只跑其中幾頁
const only = process.env.SCREENER_CHECK_ONLY?.split(',')
const PAGES = [
  { name: '普通股', path: '/screener/common?template=value', search: '股東權益報酬率', column: '負債比率', sortColumn: '殖利率' },
  { name: '特別股', path: '/screener/preferred', search: '殖利率', column: '發行價', sortColumn: '殖利率' },
  { name: 'ETF', path: '/screener/etf', search: '規模', column: '受益人數', sortColumn: '規模' }
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
  // pnpm dev 才有的 Nuxt DevTools 膠囊浮在畫面底部正中央，會蓋住橫向捲軸把手的中心點（2026-10-16 量到 elementFromPoint 拿到它），
  // 「點得到把手」就看把手寬度碰運氣。build 後的伺服器沒有這個元素，這行不影響
  await page.addStyleTag({ content: 'nuxt-devtools-frame { display: none !important; }' })
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

  // ── 3b. 顯示欄位：欄位設定 → ＋ 新增欄位 → 表頭多一欄（訪客改的是內建那一組，存在這次瀏覽）
  const headerLabels = () => page.locator('.smt-table-view .el-table__header th .screener-result-table__column-label').allTextContents()
  const columnsBefore = await headerLabels()
  await page.getByRole('button', { name: '欄位設定' }).click()
  await page.locator('.smt-settings__add').click()
  const columnPicker = await visible(page.locator('.condition-panel .indicator-dialog'), 15000)
  expect(target.name, '「＋ 新增欄位」開挑選面板', columnPicker.ok)
  if (columnPicker.ok) {
    await page.getByRole('textbox', { name: '搜尋指標名稱' }).fill(target.column)
    const columnItem = page.locator('.condition-panel .indicator-dialog__item').first()
    if ((await visible(columnItem, 10000)).ok) await columnItem.click()
    let columnsAfter = columnsBefore
    for (const start = Date.now(); Date.now() - start < 30000; await page.waitForTimeout(300)) {
      columnsAfter = await headerLabels()
      if (columnsAfter.length > columnsBefore.length) break
    }
    expect(target.name, `新增欄位「${target.column}」後表頭多一欄`, columnsAfter.length === columnsBefore.length + 1 && columnsAfter.some(text => text.includes(target.column)), `${columnsBefore.length} → ${columnsAfter.length}`)
    // 等關閉動畫：特別股、ETF 的表頭是立刻多一欄的（不用等查詢），那時面板還在淡出
    const closed = await page.locator('.condition-panel .indicator-dialog').waitFor({ state: 'hidden', timeout: 3000 }).then(() => true).catch(() => false)
    expect(target.name, '選完欄位面板會關', closed)
    if (await page.locator('.condition-panel .indicator-dialog').isVisible()) await page.keyboard.press('Escape')
  }
  await page.getByRole('button', { name: '欄位設定' }).click()

  // ── 3c. 排序：點欄名（第一下照這一欄自己的方向），第一列換人
  const firstSymbol = () => page.locator('.smt-table-view .el-table__body tbody tr').first().locator('td').first().textContent().then(text => text?.trim() ?? '')
  const symbolBefore = await firstSymbol()
  await page.locator('.smt-table-view .el-table__header th .screener-result-table__column-label', { hasText: target.sortColumn }).first().click()
  let symbolAfter = symbolBefore
  for (const start = Date.now(); Date.now() - start < 30000; await page.waitForTimeout(300)) {
    symbolAfter = await firstSymbol()
    if (symbolAfter && symbolAfter !== symbolBefore) break
  }
  expect(target.name, `依「${target.sortColumn}」排序後第一列換了`, symbolAfter !== symbolBefore, `${symbolBefore} → ${symbolAfter}`)

  // ── 3d. 移除正在排序的那一欄，再捲到底載入下一頁（2026-10-16 ETF「sortField "expenseRatio" 要嘛是 "symbol"，要嘛要先出現在 columns 裡
  // 才能排序」：排序的那一欄已經不在這次的欄位裡，上游 400。換欄位組合是同一條路，修在 useUniverseScreener 的 applyColumns。
  // 普通股的上游接受這種排序（同日實測移除後照常載入下一頁），所以那一頁只是一起量、沒有改）
  const rejected = []
  const onResponse = response => {
    if (response.status() >= 400 && response.url().includes('/api/core/')) rejected.push(`${response.status()} ${new URL(response.url()).pathname}`)
  }
  page.on('response', onResponse)
  const tableRows = page.locator('.smt-table-view .el-table__body tbody tr')
  // 移除排序中的那一欄會清掉排序、從第一頁重查（特別股在瀏覽器排序，沒有這個請求）：等重查回來再量，不然捲到底時重查還在跑，
  // 載入下一頁被略過（build 後量到；普通股先存欄位設定才重查，固定等幾百毫秒不夠）
  const research = page.waitForResponse(response => /\/api\/core\/(etf-)?screener\b/.test(response.url()), { timeout: 5000 }).catch(() => null)
  await page.locator('.smt-table-view .el-table__header').getByRole('button', { name: new RegExp(`^移除${target.sortColumn}`) }).first().click()
  await research
  await waitForCount(page, text => /\d+ 檔/.test(text))
  const rowsBefore = await tableRows.count()
  const totalCount = Number(((await page.locator('.screener-shell__count').textContent()) ?? '').match(/([\d,]+) 檔/)?.[1]?.replaceAll(',', '') ?? 0)
  if (totalCount > rowsBefore) {
    let rowsAfter = rowsBefore
    for (const start = Date.now(); Date.now() - start < 20000 && rowsAfter <= rowsBefore && !rejected.length; await page.waitForTimeout(400)) {
      // 每一輪先往上再捲回底：到底時若還在重查，載入下一頁會被略過，而哨兵一直待在畫面內就不會再觸發（三頁一起跑時偶爾碰到）
      await page.evaluate(() => scrollBy(0, -400))
      await page.waitForTimeout(150)
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
      rowsAfter = await tableRows.count()
    }
    expect(target.name, `移除排序中的「${target.sortColumn}」後還能載入下一頁`, rowsAfter > rowsBefore, `${rowsBefore} → ${rowsAfter} 列`)
  }
  await page.waitForTimeout(500)
  page.off('response', onResponse)
  const errorToasts = await page.locator('.el-message--error:visible').count()
  expect(target.name, '移除排序中的欄位後沒有被上游拒絕', !rejected.length && !errorToasts, rejected.join('、') || (errorToasts ? `${errorToasts} 個錯誤提示` : '無'))
  await page.evaluate(() => scrollTo(0, 0))

  // ── 4a. 桌機版面（第一個畫面：捲回頂端量）
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(2000)
  const measureDesktop = () => page.evaluate(() => {
    const table = document.querySelector('.smt-table-view .el-table')
    const rowsCount = document.querySelectorAll('.screener-result-table .el-table__body tbody tr').length
    const wrap = table?.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')
    const header = table?.querySelector('.el-table__header-wrapper')
    const bar = table?.querySelector('.el-table__body-wrapper .el-scrollbar__bar.is-horizontal')
    const barShown = !!bar && getComputedStyle(bar).display !== 'none'
    const thumb = bar?.querySelector('.el-scrollbar__thumb')?.getBoundingClientRect()
    // 排序箭頭：兩個三角形各是 10px 框的一半（升冪是下半、降冪是上半），可見部分之間要有空隙，不然看起來是一顆菱形
    const caret = table?.querySelector('th .caret-wrapper')
    const upBottom = caret?.querySelector('.sort-caret.ascending')?.getBoundingClientRect().bottom ?? 0
    const downTop = caret?.querySelector('.sort-caret.descending')?.getBoundingClientRect().top ?? 0
    const barTop = barShown ? bar.getBoundingClientRect().top : window.innerHeight
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      viewport: window.innerHeight,
      rowsCount,
      total: Number((document.querySelector('.screener-shell__count')?.textContent ?? '').match(/([\d,]+) 檔/)?.[1]?.replaceAll(',', '') ?? 0),
      caretGap: Math.round(downTop - upBottom),
      region: `${wrap?.getAttribute('tabindex')}/${wrap?.getAttribute('role')}/${wrap?.getAttribute('aria-label')}`,
      scrollsX: !!wrap && wrap.scrollWidth > wrap.clientWidth,
      scrollLeft: wrap?.scrollLeft ?? 0,
      fade: table ? getComputedStyle(table, '::after').content !== 'none' : false,
      barShown,
      barInView: barShown && bar.getBoundingClientRect().top >= 0 && bar.getBoundingClientRect().bottom <= window.innerHeight,
      thumbHit: !!thumb && document.elementFromPoint((thumb.left + thumb.right) / 2, (thumb.top + thumb.bottom) / 2)?.classList.contains('el-scrollbar__thumb'),
      thumbCenter: thumb ? [(thumb.left + thumb.right) / 2, (thumb.top + thumb.bottom) / 2] : null,
      headerTop: header ? Math.round(header.getBoundingClientRect().top) : null,
      siteHeader: Math.round(Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-header-height')) || 0),
      firstScreenRows: header ? Math.floor((barTop - header.getBoundingClientRect().bottom) / 41) : 0
    }
  })
  const desktop = await measureDesktop()
  expect(target.name, '1440 寬沒有橫向捲軸', desktop.overflow <= 0, `超出 ${desktop.overflow}px`)
  expect(target.name, '排序箭頭兩個三角形分開（不是菱形）', desktop.caretGap >= 1, `間隔 ${desktop.caretGap}px`)
  expect(target.name, '表格捲動區可用鍵盤聚焦、有名稱', /^0\/region\/\S+/.test(desktop.region), desktop.region)
  // 上方控制項不佔太多高度（2026-10-15「就是擔心上面的篩選太高，佔用了下面的結果表格」）：1440×900 量到 11 列，門檻留 3 列給條件變多
  expect(target.name, '第一個畫面至少 8 列', desktop.firstScreenRows >= 8, `${desktop.firstScreenRows} 列`)
  // 表格跟著整頁捲、不再一口氣載完：哨兵只在捲到附近才載下一頁（以表身為 root 的舊觀察者會一直看得到它）
  if (desktop.total > 100) expect(target.name, '停在頂端時只載了前幾頁', desktop.rowsCount < desktop.total, `${desktop.rowsCount}／${desktop.total} 列`)
  // 欄位多到超出右邊時（2026-10-15「篩選的欄位太多 破版了」「我希望橫向scrollbar可以呈現在第一個畫面…用滑鼠往右邊拉動」）
  if (desktop.scrollsX) {
    expect(target.name, '欄位超出時右緣淡出', desktop.fade)
    expect(target.name, '第一個畫面就看得到橫向捲軸、點得到把手', desktop.barInView && desktop.thumbHit, `捲軸在畫面內 ${desktop.barInView}、點到把手 ${desktop.thumbHit}`)
    if (desktop.thumbCenter) {
      const [x, y] = desktop.thumbCenter
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + 150, y, { steps: 8 })
      await page.mouse.up()
      await page.waitForTimeout(300)
      const dragged = await measureDesktop()
      expect(target.name, '用滑鼠拖得動橫向捲軸', dragged.scrollLeft > 0, `scrollLeft ${dragged.scrollLeft}`)
    }
  } else {
    console.log(`  skip 橫向捲軸 這一頁的欄位在 1440 寬放得下`)
  }
  await page.evaluate(() => scrollBy(0, 600))
  await page.waitForTimeout(600)
  const scrolled = await measureDesktop()
  expect(target.name, '往下捲時表頭黏在頁首下面', Math.abs(scrolled.headerTop - scrolled.siteHeader) <= 2, `表頭 ${scrolled.headerTop}、頁首 ${scrolled.siteHeader}`)
  await page.evaluate(() => scrollTo(0, 0))

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

// ── 5. 載入時的版面位移（2026-10-16）：每頁用新分頁在兩種寬度各載一次，結果出來後加總非輸入造成的 layout-shift。
// 修之前 DEV 412 寬（CPU 放慢 4 倍、3 次都一樣）普通股 0.189＝頁首後備高度 57→68px 的 0.011＋範本選擇區先出現再被換掉的 0.112＋
// 檔數文字把期別切換擠到下一行的 0.066；其他頁都有頁首那 0.011。門檻 0.005 要抓得到最小的那一段（0.011）。
// CPU 放慢 4 倍（同 PSI 的機器）：不放慢時頁首在第一次繪製前就接手，頁首那段量不到（DEV 同日不放慢：普通股 1440 0.027、375 0.065，其他頁 0）
// 只對打包過的伺服器有意義（DEV 網址，或 pnpm build 後的 .output）：pnpm dev 不內嵌元件樣式（Nuxt 的 features.inlineStyles 只在 dev 是
// false），延後 hydration 的頁首樣式晚到，本機 dev 1440 寬每頁都量到一段 DEV 沒有的 0.005（logo x 156→16，2026-10-16 各 3 次）
const CLS_LIMIT = 0.005
const isDevServer = (await (await fetch(baseUrl)).text()).includes('/@vite/client')
if (isDevServer) console.log('\n  skip 載入時的版面位移：這是 pnpm dev（不內嵌元件樣式），請對 DEV 網址或 build 後的伺服器跑')
for (const target of isDevServer ? [] : PAGES) {
  for (const [width, height, mobile] of [[1440, 900, false], [375, 812, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile })
    const page = await context.newPage()
    await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.addInitScript(() => {
      window.__cls = []
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue
          const sources = entry.sources.map(source => source.node?.className?.split?.(' ')[0] ?? source.node?.nodeName ?? '(removed)')
          window.__cls.push({ value: entry.value, sources: sources.join('+') })
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto(`${baseUrl}${target.path}`, { waitUntil: 'load', timeout: 180000 })
    const counted = await waitForCount(page, text => /\d+ 檔/.test(text), 90000)
    await page.waitForTimeout(2000)
    const shifts = await page.evaluate(() => window.__cls)
    const total = shifts.reduce((sum, shift) => sum + shift.value, 0)
    const detail = shifts.map(shift => `${shift.value.toFixed(3)} ${shift.sources}`).join('；') || '無'
    expect(target.name, `${width} 寬載入時沒有版面位移（CLS ${total.toFixed(3)}）`, counted.ok && total <= CLS_LIMIT, detail)
    await context.close()
  }
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
