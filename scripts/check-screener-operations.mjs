// 篩選器的「操作」檢查：走過一遍使用者真的會做的動作，每一步斷言 DOM 上看得見的結果。
// 用 `node scripts/check-screener-operations.mjs` 對著跑起來的 `pnpm run dev`
//（SCREENER_OPS_URL / SCREENER_OPS_WIDTH 可覆寫）。
//
// 為什麼要有這一支（2026-10-02 寫）：`app/composables/screener/useScreenerTabs.ts` 有 1410 行、
// 回傳 48 個符號，而它大部分的行為**完全沒有任何東西在驗**。既有的瀏覽器檢查對 /screener 只有 8 條
// 斷言（訪客頁籤、結果列、query 清掉、沒有 page error ×2 組），完全沒碰到條件編輯、區間編輯器、
// 排序、類股範圍、載入更多。那些行為現在就沒被驗，不管要不要重構都該補。
//
// ## 這一支**沒有**覆蓋什麼，以及為什麼（實測出來的，不是省略）
//
// 全程以訪客身分跑，不登入。/screener?template=value 會給訪客一個頁籤（刻意的設計：條件頁的深層
// 連結要讓沒登入的人也能用），所以條件、排序、類股、載入更多都走得完。
//
// 但 2026-10-02 實測發現**所有「建立」路徑都有登入閘門**（useScreenerTabs 的 openNewTabDialog、
// addTab、addTemplateTab、openNewColumnPresetDialog、addColumnPresetOption 都會 `openLogin()`）：
// 訪客按 + 跳出來的是登入對話框，不是新分頁。改名／刪除／排序本身沒有閘門，但訪客只有一個頁籤、
// 一個欄位預設，所以沒有東西可以排序、也沒有第二個預設可以切換。
//
// 於是**頁籤 CRUD 與欄位預設 CRUD 不在這一支的覆蓋範圍內**，那需要一個登入的 session。
// 這件事對重構有直接影響：要拆 useScreenerTabs 的話，那兩個叢集是這張安全網照不到的地方，
// 只有 `nuxt typecheck`（會抓到任何漏掉的符號）在保護。
//
// 閘門本身是測得到的，而且值得測——它是真的行為，重構打壞了會變成「訪客按了沒反應」。
//
// ## 跑法
//
// **每一次操作都會對 bff-ts 發一次真的查詢（約 2 秒）**，所以這一支本來就慢，而且它自己就是負載。
// 跟 check-hub-pages 的兩個 screener 子測試一樣，上游在負載下會回 502（bff-ts 的
// ANALYSIS_SERVICE_TIMEOUT_MS = 10_000，而這台機器上三個服務共用同一個本機上游），所以：
//   - 每一個失敗訊息都帶上「bff-ts 回什麼」，不然分不出上游拒答與我們改壞
//   - 不要跟 check-stock-pages 串著跑，也不要在它跑的時候做別的事（連手動開一個 /screener 都算）
import { chromium } from 'playwright'

const baseUrl = process.env.SCREENER_OPS_URL ?? 'http://localhost:3000'
const width = Number(process.env.SCREENER_OPS_WIDTH ?? 1440)

const failures = []
const upstream = []

function expect(step, name, ok, detail = '') {
  const line = `${step} ${name}${detail ? ` (${detail})` : ''}`
  if (ok) {
    console.log(`  ok   ${line}`)
  } else {
    const status = upstream.length ? `bff-ts 回 ${upstream.join('/')}` : 'bff-ts 沒被呼叫'
    failures.push(`${line}  [${status}]`)
    console.log(`  FAIL ${line}  [${status}]`)
  }
}

// 等條件出現、不要等固定秒數，而且把等了多久印出來——那是 check-hub-pages 的註解花了好幾輪才定下
// 來的做法：固定秒數遲早變成假失敗，而光禿禿的 `(0)` 分不出「沒等夠」與「真的空」。
async function waitFor(locator, timeout = 30000) {
  const start = Date.now()
  const ok = await locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)
  return { ok, ms: Date.now() - start }
}

// 結果表格重跑查詢之後「有沒有變」要比對內容，不是等時間。列數 + 第一列的代號就足夠：
// 兩者都沒變而查詢真的重跑了，那表示這個操作沒有效果，正是要抓的東西。
async function rowsSignature(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
    return { count: rows.length, first: rows[0]?.querySelector('td')?.textContent?.trim() ?? '' }
  })
}

async function waitForRowsChange(page, before, timeout = 45000) {
  const start = Date.now()
  let now = before
  while (Date.now() - start < timeout) {
    now = await rowsSignature(page)
    if (now.count !== before.count || now.first !== before.first) return { changed: true, ms: Date.now() - start, now }
    await page.waitForTimeout(500)
  }
  return { changed: false, ms: Date.now() - start, now }
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width, height: 1000 } })
const page = await context.newPage()

const pageErrors = []
page.on('pageerror', error => pageErrors.push(String(error).slice(0, 160)))
page.on('response', response => {
  if (response.request().method() === 'POST' && response.url().includes('/screener')) upstream.push(response.status())
})

const tabFolder = page.locator('.stock-preset-folder__switcher').first()
const columnFolder = page.locator('.stock-preset-folder__switcher').nth(1)
const loginDialog = page.locator('[aria-label="登入"]')
const tabNames = folder => folder.locator('.stock-preset-folder__tab-label').allTextContents()
  .then(list => list.map(name => name.trim()))

async function closeLogin() {
  await loginDialog.locator('.el-dialog__headerbtn').first().click().catch(() => page.keyboard.press('Escape'))
  await page.waitForTimeout(1000)
}

await page.goto(`${baseUrl}/screener?template=value`, { waitUntil: 'load', timeout: 180000 })
const firstRow = await waitFor(page.locator('.el-table__body tbody tr').first(), 90000)
expect('載入', '訪客從範本拿到結果列', firstRow.ok, `${firstRow.ms}ms`)
if (!firstRow.ok) {
  console.log('\n第一列沒出現，後面的操作都沒有意義，提前結束。')
  console.log(`bff-ts 的 POST /screener 回應：${upstream.join(', ') || '（沒有）'}`)
  console.log(`\nFAILURES:\n  ${failures.join('\n  ')}`)
  await browser.close()
  process.exit(1)
}
await page.waitForTimeout(1500)

// ── 1. 訪客的登入閘門 ────────────────────────────────────────────────────────
// 建立路徑對訪客應該開登入對話框、而且**不要**偷偷建出一個本地分頁。後者是重點：
// 「開了對話框又同時建了一個分頁」會讓訪客以為自己有一個存不起來的頁籤。
for (const [label, folder] of [['條件頁籤', tabFolder], ['欄位預設', columnFolder]]) {
  const before = await folder.locator('.stock-preset-folder__tab').count()
  await folder.locator('.stock-preset-folder__add').click()
  const opened = await waitFor(loginDialog, 10000)
  expect('登入閘門', `訪客按「${label}」的 + 會開登入`, opened.ok, `${opened.ms}ms`)
  expect('登入閘門', `而且沒有偷建分頁（${label}）`, await folder.locator('.stock-preset-folder__tab').count() === before, `${before} 個`)
  await closeLogin()
}

// ── 2. 訪客頁籤可以改名（本地，沒有後端可同步）──────────────────────────────
{
  const [original] = await tabNames(tabFolder)
  // 改名 = 點「已經作用中」的那一個分頁（PresetFolder 的 handleTabLabelClick：分頁還沒作用中時
  // 第一次點只是選取）。訪客只有一個頁籤、而它本來就是作用中的，所以點一次就進改名——寫死「點兩
  // 次」會在第二次找不到 label（它已經變成 input 了）。所以先點一次、看有沒有輸入框，沒有才再點。
  await tabFolder.locator('.stock-preset-folder__tab-label').first().click()
  await page.waitForTimeout(700)
  let input = tabFolder.locator('.stock-preset-folder__tab-rename-input')
  if (!await input.count()) {
    await tabFolder.locator('.stock-preset-folder__tab-label').first().click()
    await page.waitForTimeout(700)
    input = tabFolder.locator('.stock-preset-folder__tab-rename-input')
  }
  if (await input.count()) {
    await input.first().fill('操作檢查用')
    await input.first().press('Enter')
    await page.waitForTimeout(1200)
    const after = await tabNames(tabFolder)
    expect('頁籤', '改名生效', after.includes('操作檢查用'), `${original} → ${after.join(',')}`)
  } else {
    expect('頁籤', '點作用中的分頁會進入改名', false, '沒有出現輸入框')
  }
}

// ── 3. 條件：加 → 挑指標 → 設區間 → 結果換一批 → 移除 ───────────────────────
{
  const pillsBefore = await page.locator('.condition-pill').count()
  await page.locator('.screener-filters__add-slot').first().click()
  // 2026-10-07 起選指標與設定範圍在同一個面板（ScreenerConditionPanel，el-dialog .condition-panel）
  const picker = await waitFor(page.locator('.condition-panel .indicator-dialog'), 15000)
  expect('條件', '按新增條件會開指標挑選器', picker.ok, `${picker.ms}ms`)

  if (picker.ok) {
    const categories = await page.locator('.indicator-dialog__category').count()
    expect('條件', '挑選器有分類', categories >= 5, `${categories} 類`)
    const metrics = await page.locator('.indicator-dialog__metric').count()
    expect('條件', '挑選器有指標', metrics > 0, `${metrics} 支`)

    const picked = (await page.locator('.indicator-dialog__metric').first().locator('.indicator-dialog__metric-label').textContent())?.trim() ?? ''
    await page.locator('.indicator-dialog__metric').first().click()
    await page.waitForTimeout(1200)

    // **挑了欄位之後膠囊數「不該」增加**，那是明文要求的行為，不是漏掉：早期版本按下「新增條件」
    // 就立刻塞一個空白膠囊，使用者指出那讀起來像「已經有一個條件了」。現在挑欄位只產生一個 draft
    // （useScreenerTabs 的 handleSelect），要等值也設好、而且編輯器關掉才會變成真的 slot
    //（closeRangeEditor）。我第一版把這條寫成「要多一個」，是我沒讀那段註解。
    const pillsDraft = await page.locator('.condition-pill').count()
    expect('條件', '挑了欄位還不算一個條件（要等值也設好）', pillsDraft === pillsBefore, `${pillsBefore} → ${pillsDraft}`)

    const editor = await waitFor(page.locator('.condition-panel .range-editor'), 15000)
    expect('條件', '選完會接著開區間編輯器', editor.ok, `${editor.ms}ms`)

    let pillsAfter = pillsDraft
    if (editor.ok) {
      //  而不是 ：第一個 input 是**期別選擇器**（el-select、
      // readonly），不是下限。而且數字輸入框有幾個取決於 mode——ScreenerRangeEditor 的
      // above/below/between/outside/equal 各渲染不同的組合，預設 above 只有「起」一個。
      // 我第一版寫死「兩個輸入框」然後去填 index 0，填到的是那個 readonly 的 select。
      const inputs = page.locator('.condition-panel input[role="spinbutton"]')
      const inputCount = await inputs.count()
      expect('條件', '區間編輯器有數字輸入框', inputCount >= 1, `${inputCount} 個（預設 mode 是「以上」，只有「起」）`)
      if (inputCount >= 1) {
        const before = await rowsSignature(page)
        // 下限設成一個大到不可能的數，而不是隨便一個上限：第一版挑到貝他係數、上限給 50，那等於
        // 沒有篩選（beta ≤ 50 全部命中），所以「結果有沒有變」永遠是沒變。用「不可能」的下限就
        // 跟挑到哪一支指標無關——任何數值指標都會變成 0 列，而那是一個明確、可斷言的結果。
        await inputs.first().fill('999999999')
        await inputs.first().press('Enter')
        await page.waitForTimeout(600)
        // 關閉面板才 commit。Escape 讓 el-dialog 關閉 → close → closePanel → closeRangeEditor。
        await page.keyboard.press('Escape')
        await page.waitForTimeout(1200)

        pillsAfter = await page.locator('.condition-pill').count()
        expect('條件', `設好值並關閉後才真的多一個條件（${picked}）`, pillsAfter === pillsBefore + 1,
          `${pillsBefore} → ${pillsAfter}`)

        const changed = await waitForRowsChange(page, before)
        const lastStatus = upstream[upstream.length - 1]
        expect('條件', '不可能的下限會讓結果變成 0 列', changed.now.count === 0 && lastStatus === 200,
          `${before.count}列/${before.first} → ${changed.now.count}列，bff-ts ${lastStatus}，等了 ${changed.ms}ms`)
      } else {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(800)
      }
    }

    // 移除剛剛加的那一個，範本原本的條件要留著——不然就變成「零條件」，而 bff-ts 對沒有 filter 的
    // 請求回 400（實測訊息是 "At least one filter is required"），結果也是 0 列，兩種 0 混在一起
    // 就分不出來了。
    const beforeRemove = await rowsSignature(page)
    await page.locator('.condition-pill').last().locator('.condition-pill__remove').click()
    await page.waitForTimeout(1500)
    const pillsNow = await page.locator('.condition-pill').count()
    expect('條件', '移除後膠囊少一個', pillsNow === pillsAfter - 1, `${pillsAfter} → ${pillsNow}`)
    const back = await waitForRowsChange(page, beforeRemove, 30000)
    const backStatus = upstream[upstream.length - 1]
    expect('條件', '移除條件後結果回來', back.now.count > 0 && backStatus === 200,
      `${beforeRemove.count}列 → ${back.now.count}列/${back.now.first}，bff-ts ${backStatus}，等了 ${back.ms}ms`)
  }
}

// ── 4. 排序 ──────────────────────────────────────────────────────────────────
// 兩種排序都要驗，因為它們走完全不同的路：
//   - 指標欄位是**後端**排序（sortable="custom"，emit 給 changeSort，重發一次查詢）
//   - 股價是**前端**排序（指標型錄外的欄位，bff-ts 的 sortField 驗證看不到它——2026-10-02 實測
//     送 sortField: "stock.price" 會回 400，表格整個變空。見 SharedMetricTable 的註解）
//
// 「第一列換人」單獨當斷言是不夠的：表格變成**空的**也會讓第一列「變了」，而那正是修掉的那個 bug
// 的症狀。所以後端那條要同時要求列數仍然大於 0 且 bff-ts 回 200。
{
  const headerIndex = async label => page.evaluate(text =>
    [...document.querySelectorAll('.el-table__header th')].findIndex(th => th.querySelector('.cell')?.textContent?.trim().startsWith(text)), label)
  const sortable = page.locator('.el-table__header th.is-sortable')
  expect('排序', '表頭有可排序欄位', await sortable.count() >= 3, `${await sortable.count()} 欄`)

  // 後端排序。el-table 的 sort 事件到查詢回來之間有 debounce，所以等的是「列變了」而不是固定秒數。
  const metricColumn = '本益比'
  const metricIndex = await headerIndex(metricColumn)
  if (metricIndex >= 0) {
    const before = await rowsSignature(page)
    const postsBefore = upstream.length
    await page.locator('.el-table__header th').nth(metricIndex).locator('.caret-wrapper').click()
    const changed = await waitForRowsChange(page, before)
    const sent = upstream.length > postsBefore
    const lastStatus = upstream[upstream.length - 1]
    expect('排序', `依「${metricColumn}」是後端排序`, sent && lastStatus === 200,
      `發了 ${upstream.length - postsBefore} 次請求，最後 ${lastStatus}`)
    expect('排序', `依「${metricColumn}」排序後還有結果`, changed.changed && changed.now.count > 0,
      `${before.count}列/${before.first} → ${changed.now.count}列/${changed.now.first}，等了 ${changed.ms}ms`)
  } else {
    expect('排序', `找得到「${metricColumn}」欄`, false)
  }

  // 前端排序：股價。要驗的是「真的排好了」而不只是「變了」——第一版只改了 sortable 沒配
  // sort-method，表頭標著 descending 但順序是亂的（el-table 預設拿 prop 當 row 的鍵去讀，
  // 而值其實在 row.values[field].value）。所以這裡直接量單調性。
  const priceIndex = await headerIndex('股價')
  if (priceIndex >= 0) {
    const postsBefore = upstream.length
    await page.locator('.el-table__header th').nth(priceIndex).locator('.caret-wrapper').click()
    await page.waitForTimeout(2500)
    const values = await page.evaluate(idx => [...document.querySelectorAll('.el-table__body tbody tr')]
      .map(tr => Number(tr.querySelectorAll('td')[idx]?.textContent?.trim())), priceIndex)
    const descending = values.every((value, i) => i === 0 || values[i - 1] >= value)
    expect('排序', '依「股價」是前端排序（不發請求）', upstream.length === postsBefore,
      `多發了 ${upstream.length - postsBefore} 次`)
    expect('排序', '依「股價」真的排成遞減、而且列沒有消失', descending && values.length > 0,
      `${values.length} 列，前 5：${values.slice(0, 5).join(' / ')}`)
  } else {
    expect('排序', '找得到「股價」欄', false)
  }
}

// ── 5. 載入更多 ──────────────────────────────────────────────────────────────
// **排在縮小類股之前**：類股一限定就可能只剩幾列、本來就沒有下一頁，那時這一段會無意義地失敗。
{
  const before = await page.locator('.el-table__body tbody tr').count()
  // 哨兵與「沒有更多結果」那句**共用基礎 class**，結束狀態只多一個 --end——所以要排除它，
  // 不然 count() 永遠是 1，連「已經沒有下一頁」都會被當成「有哨兵」而硬等 45 秒。
  const sentinel = page.locator('.screener-result-table__load-more:not(.screener-result-table__load-more--end)')
  if (await sentinel.count()) {
    const start = Date.now()
    let after = before
    while (Date.now() - start < 45000) {
      await sentinel.first().scrollIntoViewIfNeeded().catch(() => {})
      after = await page.locator('.el-table__body tbody tr').count()
      if (after > before) break
      await page.waitForTimeout(600)
    }
    expect('載入更多', '捲到底會多載一頁', after > before, `${before} → ${after} 列，等了 ${Date.now() - start}ms`)
  } else {
    console.log(`  skip 載入更多 這批結果沒有下一頁（${before} 列）`)
  }
}

// ── 6. 類股範圍（放最後：它會把結果縮到只剩幾列） ──────────────────────────────────────────────────────────────
{
  const before = await rowsSignature(page)
  const select = page.locator('.screener-page__sector-filter-select')
  expect('類股', '有類股選單', await select.count() === 1)
  if (await select.count()) {
    await select.click()
    await page.waitForTimeout(1200)
    const options = page.locator('.el-select-dropdown__item:visible')
    const count = await options.count()
    expect('類股', '選單展開後有選項', count >= 10, `${count} 個`)
    if (count) {
      const name = (await options.first().textContent())?.trim() ?? ''
      await options.first().click()
      await page.keyboard.press('Escape')
      const changed = await waitForRowsChange(page, before)
      expect('類股', `限定「${name}」之後結果換一批`, changed.changed,
        `${before.count}列/${before.first} → ${changed.now.count}列/${changed.now.first}，等了 ${changed.ms}ms`)
    }
  }
}

// ── 7. 手機 375px（2026-10-07 篩選器重新設計：卡片、排序選單、欄位設定、條件面板、分頁語意）────────
{
  const mobile = await browser.newContext({ viewport: { width: 375, height: 800 } })
  const m = await mobile.newPage()
  m.on('pageerror', error => pageErrors.push(`[375] ${error.message}`))
  m.on('response', (response) => {
    if (response.url().includes('/screener') && response.request().method() === 'POST') upstream.push(response.status())
  })
  await m.goto(`${baseUrl}/screener?template=value`, { waitUntil: 'networkidle' })
  const firstCard = await waitFor(m.locator('.smt-card').first(), 90000)
  expect('手機', '結果是卡片', firstCard.ok, `${firstCard.ms}ms`)

  if (firstCard.ok) {
    const layout = await m.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      tableHidden: getComputedStyle(document.querySelector('.smt-table-view')).display === 'none'
    }))
    expect('手機', '表格藏起來、沒有橫向捲動', layout.tableHidden && layout.overflow <= 1, `overflow ${layout.overflow}`)

    const countText = await m.locator('.screener-page__count').textContent()
    expect('手機', '顯示並朗讀符合檔數', /目前符合 [\d,]+ 檔/.test(countText ?? '') && await m.locator('.screener-page__count[role="status"]').count() === 1, countText ?? '')

    const tablists = await m.locator('[role="tablist"]').evaluateAll(lists => lists.map(list => list.querySelectorAll('[role="tab"][aria-selected="true"]').length))
    expect('手機', '兩個分頁列都有選中的 tab', tablists.length === 2 && tablists.every(n => n === 1), JSON.stringify(tablists))

    // 排序選單：選「本益比」→ 後端排序（多一次 POST）
    const requestsBefore = upstream.length
    await m.locator('.smt-toolbar__select').first().selectOption({ label: '本益比' })
    await m.waitForTimeout(4000)
    expect('手機', '排序選單選本益比會打後端', upstream.length > requestsBefore && upstream.at(-1) === 200, `多發了 ${upstream.length - requestsBefore} 次`)
    expect('手機', '排序後卡片還在', await m.locator('.smt-card').count() > 0)

    // 欄位設定：下移第一欄 → 卡片裡的欄位順序跟著換
    const labelsBefore = await m.locator('.smt-card').first().locator('dt').allTextContents()
    await m.getByRole('button', { name: '欄位設定' }).click()
    const settingsRows = await m.locator('.smt-settings__row').count()
    expect('手機', '欄位設定列出每一欄', settingsRows === labelsBefore.length, `${settingsRows} 列 / ${labelsBefore.length} 欄`)
    await m.locator('.smt-settings__row').first().getByRole('button', { name: /^下移/ }).click()
    await m.waitForTimeout(1500)
    const labelsAfter = await m.locator('.smt-card').first().locator('dt').allTextContents()
    expect('手機', '下移第一欄後順序對調', labelsAfter[0] === labelsBefore[1] && labelsAfter[1] === labelsBefore[0], `${labelsBefore.slice(0, 2)} → ${labelsAfter.slice(0, 2)}`)

    // 條件面板：手機是貼底的面板；選了指標換到第二步，有看得見的標籤；沒設值就關，不多一個條件
    const pillsBefore = await m.locator('.condition-pill').count()
    await m.locator('.screener-filters__add-slot:visible').first().click()
    const panel = await waitFor(m.locator('.condition-panel .indicator-dialog'), 15000)
    expect('手機', '新增條件打開面板', panel.ok, `${panel.ms}ms`)
    if (panel.ok) {
      await m.waitForTimeout(500)
      const box = await m.locator('.el-dialog.condition-panel').boundingBox()
      expect('手機', '面板貼在畫面底部', box !== null && Math.abs(box.y + box.height - 800) <= 2, box ? `底 ${Math.round(box.y + box.height)}` : '找不到')
      await m.locator('.indicator-dialog__metric').first().click()
      const range = await waitFor(m.locator('.condition-panel .range-editor'), 10000)
      const labels = range.ok ? await m.locator('.condition-panel .range-editor__label').allTextContents() : []
      expect('手機', '第二步有看得見的標籤', labels.includes('條件') && labels.length >= 2, labels.join('/'))
      await m.getByRole('button', { name: '完成' }).click()
      await m.waitForTimeout(800)
      expect('手機', '沒設值就完成不會多一個條件', await m.locator('.condition-pill').count() === pillsBefore)
    }

    // 卡片的無限捲動
    const cardsBefore = await m.locator('.smt-card').count()
    await m.locator('.smt-card').last().scrollIntoViewIfNeeded()
    const start = Date.now()
    while (Date.now() - start < 30000 && await m.locator('.smt-card').count() <= cardsBefore) await m.waitForTimeout(500)
    const cardsAfter = await m.locator('.smt-card').count()
    expect('手機', '捲到底會多載一頁', cardsAfter > cardsBefore, `${cardsBefore} → ${cardsAfter}`)
  }
  await mobile.close()
}

expect('全程', '沒有 page error', pageErrors.length === 0, pageErrors.join(' | '))

console.log(`\nbff-ts 的 POST /screener 回應：${upstream.join(', ') || '（沒有）'}`)
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):\n  ${failures.join('\n  ')}`)
  await browser.close()
  process.exit(1)
}
console.log('\nPASS: screener operations')
await browser.close()
