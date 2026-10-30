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
//      再加一個顯示欄位（表頭多一欄）、點表頭打開欄位選單排序（第一列換人）
//   4. 版面：1440 寬沒有橫向捲軸、排序箭頭不是一顆菱形、表格捲動區可聚焦、第一個畫面至少 8 列、沒有一口氣載完；欄位超出時右緣淡出、
//      第一個畫面就看得到橫向捲軸而且拖得動；往下捲表頭黏在頁首下面。375 寬沒有橫向捲軸、結果是卡片、卡片區不是巢狀捲動
// 另外 ETF、特別股的個別頁：SSR 就有標題與內容、一圖一表（同個股頁那一條，scripts/page-shape.mjs）、找不到的代號 noindex。
import { chromium } from 'playwright'
import { isOneChartOneTable, pageShape } from './page-shape.mjs'

const baseUrl = process.env.SCREENER_CHECK_URL ?? 'http://localhost:3000'

// SCREENER_CHECK_ONLY=特別股,ETF 只跑其中幾頁
const only = process.env.SCREENER_CHECK_ONLY?.split(',')
// wide：欄位多到超出 1440 寬的網址（2026-10-22 表頭折行之後欄位窄了，預設欄位放得下，右緣淡出與橫向捲軸要另外開一頁測）。
// 普通股的從型錄挑（見 wideQuery），特別股、ETF 用各自範本裡實際有的欄位
const PAGES = [
  { name: '普通股', universe: 'common', path: '/screener/common?template=value', search: '股東權益報酬率', column: '負債比率', sortColumn: '殖利率' },
  { name: '特別股', universe: 'preferred', path: '/screener/preferred', search: '殖利率', column: '發行價', sortColumn: '殖利率', wide: 'c=latestClosePrice,issuePrice,premiumRatePct,nominalDividendRatePct,currentYieldPct,ytwPct,exDividendMonths,cumulativeDividend,participatingExcessDividend,liquidationPreference,votingRights,convertible,redeemable,marketType,issueDate' },
  // ETF 的預設順序就是規模由大到小（2026-10-31），排序改測淨值，第一列才會換
  { name: 'ETF', universe: 'etf', path: '/screener/etf', search: '規模', column: '受益人數', sortColumn: '淨值', wide: 'c=aum,return1y,expenseRatio,trailing12MonthExpenseRatioPct,nav,market,fundType,return3m,return6m,returnYtd,return2y,return3y,return5y,return10y,holders,netFlow,dcaAmount,marketShareRate' }
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

// 普通股：型錄前 16 個數字欄位，加一個條件（業務中台要至少一個）
async function wideQuery(target) {
  if (target.wide) return target.wide
  const schema = await (await fetch(`${baseUrl}/api/hub/filter-schema`)).json()
  const fields = schema.categories.flatMap(category => category.metrics).filter(metric => metric.kind !== 'categorical').map(metric => `${metric.key}.${metric.fields[0].key}`).slice(0, 16)
  return `f=roe.TTM:15~&c=${fields.join(',')}`
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
    // 顯示欄位的改名／移動／刪除在「欄位設定」面板最上面（2026-10-21 合併），沒有自己的「管理」
    expect(target.name, `「${label}」${label === '我的篩選' ? '有' : '沒有'}管理`, await group.getByRole('button', { name: `管理${label}` }).count() === (label === '我的篩選' ? 1 : 0))
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

  // ── 3b. 顯示欄位：欄位設定彈窗（2026-10-22 從就地展開改成彈窗）。改的是草稿：取消不動表格；＋ 新增欄位在同一個彈窗換一頁挑指標
  // （不疊彈窗）；儲存之後表頭多一欄（訪客改的是內建那一組，存在這次瀏覽）
  const headerLabels = () => page.locator('.smt-table-view .el-table__header th .screener-result-table__column-label').allTextContents()
  const columnsBefore = await headerLabels()
  const settingsDialog = page.getByRole('dialog', { name: /^(欄位設定|新增欄位)$/ })
  await page.getByRole('button', { name: '欄位設定' }).click()
  const dialogOpen = await visible(settingsDialog, 10000)
  expect(target.name, '「欄位設定」打開彈窗', dialogOpen.ok)
  if (dialogOpen.ok) {
    await settingsDialog.getByRole('button', { name: /^把「.+」下移$/ }).first().click()
    await settingsDialog.getByRole('button', { name: '取消' }).click()
    await settingsDialog.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
    expect(target.name, '取消之後表頭順序沒變', (await headerLabels()).join('|') === columnsBefore.join('|'))
    await page.getByRole('button', { name: '欄位設定' }).click()
    await visible(settingsDialog, 10000)
    await settingsDialog.getByRole('button', { name: '＋ 新增欄位' }).click()
    const picker = await visible(settingsDialog.locator('.indicator-dialog'), 15000)
    expect(target.name, '「＋ 新增欄位」在同一個彈窗換成挑指標（不疊彈窗）', picker.ok && await page.locator('.el-dialog:visible').count() === 1)
    if (picker.ok) {
      await settingsDialog.getByRole('textbox', { name: '搜尋指標名稱' }).fill(target.column)
      const item = settingsDialog.locator('.indicator-dialog__item').first()
      if ((await visible(item, 10000)).ok) await item.click()
      const added = await visible(settingsDialog.locator('.column-settings__row', { hasText: target.column }), 5000)
      expect(target.name, `挑了「${target.column}」回到清單、多一列`, added.ok)
      await settingsDialog.getByRole('button', { name: '儲存' }).click()
      let columnsAfter = columnsBefore
      for (const start = Date.now(); Date.now() - start < 30000; await page.waitForTimeout(300)) {
        columnsAfter = await headerLabels()
        if (columnsAfter.length > columnsBefore.length) break
      }
      expect(target.name, `儲存之後表頭多一欄「${target.column}」`, columnsAfter.length === columnsBefore.length + 1 && columnsAfter.some(text => text.includes(target.column)), `${columnsBefore.length} → ${columnsAfter.length}`)
      const closed = await settingsDialog.waitFor({ state: 'hidden', timeout: 3000 }).then(() => true).catch(() => false)
      expect(target.name, '儲存之後彈窗會關', closed)
    }
    if (await settingsDialog.isVisible()) await page.keyboard.press('Escape')
  }

  // ── 3c. 排序：點表頭打開欄位選單（2026-10-22），選「由大到小」，第一列換人
  const firstSymbol = () => page.locator('.smt-table-view .el-table__body tbody tr').first().locator('td').first().textContent().then(text => text?.trim() ?? '')
  const symbolBefore = await firstSymbol()
  await page.locator('.smt-table-view .screener-result-table__head', { hasText: target.sortColumn }).first().click()
  await page.locator('.column-menu [role="menu"]').getByRole('menuitem', { name: /由大到小/ }).click()
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
  // 移除欄位只在「欄位設定」彈窗裡（表頭的 ✕ 2026-10-21 拿掉）：移除、儲存（彈窗自己關）
  await page.getByRole('button', { name: '欄位設定' }).first().click()
  const removeDialog = page.getByRole('dialog', { name: '欄位設定' })
  await removeDialog.getByRole('button', { name: new RegExp(`^移除「[^」]*${target.sortColumn}`) }).first().click()
  await removeDialog.getByRole('button', { name: '儲存' }).click()
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
    // 排序箭頭：兩個三角形之間要有空隙，不然看起來是一顆菱形。2026-10-22 起表頭是欄位選單的按鈕，箭頭是裡面的 SharedSortIcon
    // （el-table 自己的藏起來）；量一欄沒在排序的（排序中只剩一個三角形）
    const caret = [...(table?.querySelectorAll('th .screener-result-table__head .sort-icon') ?? [])].find(icon => !/is-(ascending|descending)/.test(icon.className))
    const upBottom = caret?.querySelector('.sort-icon__caret--up')?.getBoundingClientRect().bottom ?? 0
    const downTop = caret?.querySelector('.sort-icon__caret--down')?.getBoundingClientRect().top ?? 0
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
  let desktop = await measureDesktop()
  expect(target.name, '1440 寬沒有橫向捲軸', desktop.overflow <= 0, `超出 ${desktop.overflow}px`)
  expect(target.name, '排序箭頭兩個三角形分開（不是菱形）', desktop.caretGap >= 1, `間隔 ${desktop.caretGap}px`)
  expect(target.name, '表格捲動區可用鍵盤聚焦、有名稱', /^0\/region\/\S+/.test(desktop.region), desktop.region)
  // 上方控制項不佔太多高度（2026-10-15「就是擔心上面的篩選太高，佔用了下面的結果表格」）：1440×900 量到 11 列，門檻留 3 列給條件變多
  expect(target.name, '第一個畫面至少 8 列', desktop.firstScreenRows >= 8, `${desktop.firstScreenRows} 列`)
  // 表格跟著整頁捲、不再一口氣載完：哨兵只在捲到附近才載下一頁（以表身為 root 的舊觀察者會一直看得到它）
  if (desktop.total > 100) expect(target.name, '停在頂端時只載了前幾頁', desktop.rowsCount < desktop.total, `${desktop.rowsCount}／${desktop.total} 列`)
  // 欄位多到超出右邊時（2026-10-15「篩選的欄位太多 破版了」「我希望橫向scrollbar可以呈現在第一個畫面…用滑鼠往右邊拉動」）。
  // 預設欄位放得下的話，用網址帶十幾個欄位重開（app/utils/screener-url.ts）
  if (!desktop.scrollsX) {
    await page.goto(`${baseUrl}/screener/${target.universe}?${await wideQuery(target)}`, { waitUntil: 'load', timeout: 180000 })
    await page.addStyleTag({ content: 'nuxt-devtools-frame { display: none !important; }' })
    await visible(page.locator('.screener-result-table .el-table__body tbody tr'), 90000)
    await page.evaluate(() => scrollTo(0, 0))
    await page.waitForTimeout(2000)
    desktop = await measureDesktop()
  }
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
    // 超出時寫出是誰撐出去的（最外層那幾個；fixed 的抽屜本來就停在畫面外）
    const width = document.documentElement.clientWidth
    const wide = [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > width + 1 && getComputedStyle(element).position !== 'fixed')
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      wide: wide.filter(element => !wide.includes(element.parentElement)).slice(0, 3).map(element => `${String(element.className).split(' ')[0]} 右緣 ${Math.round(element.getBoundingClientRect().right)}`),
      cardsVisible: !!cards && cards.getBoundingClientRect().height > 0 && getComputedStyle(cards).display !== 'none',
      cardCount: document.querySelectorAll('.smt-card').length,
      nested
    }
  })
  expect(target.name, '375 寬沒有橫向捲軸', mobile.overflow <= 0, `超出 ${mobile.overflow}px${mobile.overflow > 0 ? `：${mobile.wide.join('、')}` : ''}`)
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

// ── 6. 網址就是篩選（2026-10-22，使用者要書籤與分享，app/utils/screener-url.ts）：除權息月覽的連結 ?f=exDividendMonths(.EOD):7 打開一組只有
//「除權息月份：包含 7 月」的篩選；網址一直帶著目前的條件，拿同一個網址在新的瀏覽器再開一次（書籤）是同一組、同樣的檔數。
// 檔數跟月覽的 7 月比：篩選只含還在交易的，已下市、已收回的不算（analysis-ts 2026-10-22 量 DEV：普通股、特別股 7 月各差 1、ETF 一致），
// 所以只能比月覽少、最多少 3。還沒到的月份兩邊都用去年同月（上游對過 9～12 月），這裡不重複
const july = (await (await fetch(`${baseUrl}/api/hub/ex-dividend-months`)).json()).cells.find(cell => cell.month.endsWith('-07'))
const pillTexts = async page => (await page.locator('.condition-pill').allTextContents()).map(text => text.replace(/\s+/g, '')).join('|')
for (const target of PAGES) {
  const path = `/screener/${target.universe}?f=${target.universe === 'common' ? 'exDividendMonths.EOD' : 'exDividendMonths'}:7`
  console.log(`\n== ${target.name} ${path}`)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'load', timeout: 180000 })
  const counted = await waitForCount(page, text => /符合上述條件 \d+ 檔/.test(text), 90000)
  const pills = await pillTexts(page)
  expect(target.name, '打開「除權息月份：包含 7 月」', pills === '除權息月份包含7月', pills)
  const found = Number(counted.text.match(/(\d+) 檔/)?.[1])
  const listed = july.counts[target.universe]
  expect(target.name, '檔數比月覽 7 月少 0～3 檔（已下市、已收回的不算）', counted.ok && listed - found >= 0 && listed - found <= 3, `篩選 ${found}、月覽 ${listed}`)
  const bookmark = page.url()
  expect(target.name, '網址帶著目前的條件', decodeURIComponent(bookmark).includes('exDividendMonths'), bookmark.replace(baseUrl, ''))
  await context.close()
  const reopened = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const again = await reopened.newPage()
  await again.goto(bookmark, { waitUntil: 'load', timeout: 180000 })
  const recount = await waitForCount(again, text => /符合上述條件 \d+ 檔/.test(text), 90000)
  expect(target.name, '用同一個網址再開是同一組（書籤）', (await pillTexts(again)) === pills && recount.text === counted.text, `${recount.text}`)
  await reopened.close()
}

await browser.close()

// ── 個別頁（ETF、特別股，2026-10-15）：伺服器端就有標題與內容（不靠瀏覽器再讀）、一圖一表、找不到的代號 noindex。
// ETF 個別頁讀 GET /etfs/:symbol——DEV 要等 analysis-ts 部署才有，對著本機 4000 跑
const DETAIL_PAGES = [
  { path: '/etf/0050/distributions', name: '元大台灣50' },
  { path: '/etf/00679b/distribution-composition', name: '元大美債20年' },
  { path: '/etf/00878/expenses', name: '國泰永續高股息' },
  { path: '/preferred/2881a', name: '富邦特' },
  { path: '/preferred/2887z1', name: '台新新光己特' },
  // 特別股每檔四個面向（2026-10-18）；配息紀錄是唯一有圖的那一面
  { path: '/preferred/2881a/dividends', name: '富邦特' }
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
for (const [path, text] of [['/etf/0000', '找不到這檔 ETF'], ['/preferred/9999z', '找不到這檔特別股']]) {
  const html = await (await fetch(`${baseUrl}${path}`)).text()
  expect(path, `不存在的代號寫「${text}」而且 noindex`, html.includes(text) && html.includes('<meta name="robots" content="noindex, follow">'))
}
// 特別股個別頁 2026-10-18 搬到 /preferred/{代號}：舊網址 301 到新網址（大寫代號也轉成小寫），篩選頁本身不轉
{
  const moved = await fetch(`${baseUrl}/screener/preferred/2881A`, { redirect: 'manual' })
  expect('/screener/preferred/2881A', '舊網址 301 到 /preferred/2881a', moved.status === 301 && new URL(moved.headers.get('location') ?? '', baseUrl).pathname === '/preferred/2881a', `${moved.status} ${moved.headers.get('location')}`)
  const screener = await fetch(`${baseUrl}/screener/preferred`, { redirect: 'manual' })
  expect('/screener/preferred', '篩選頁本身不轉址', screener.status === 200, String(screener.status))
  // ETF 個別頁 2026-10-18 搬到 /etf/{代號}
  const etfMoved = await fetch(`${baseUrl}/screener/etf/0050`, { redirect: 'manual' })
  expect('/screener/etf/0050', '舊網址 301 到 /etf/0050', etfMoved.status === 301 && new URL(etfMoved.headers.get('location') ?? '', baseUrl).pathname === '/etf/0050', `${etfMoved.status} ${etfMoved.headers.get('location')}`)
  // 特別股專區同日拆掉（「我要的不是專區」）：/preferred 與比較頁轉到篩選器，個別頁的面向不受影響
  for (const path of ['/preferred', '/preferred/yields', '/preferred/dividends']) {
    const zone = await fetch(`${baseUrl}${path}`, { redirect: 'manual' })
    expect(path, '專區頁 301 到 /screener/preferred', zone.status === 301 && new URL(zone.headers.get('location') ?? '', baseUrl).pathname === '/screener/preferred', `${zone.status} ${zone.headers.get('location')}`)
  }
}

if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('\nPASS: screener consistency')
