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
// 全程以訪客身分跑，不登入。/screener/common?template=value 會給訪客一個頁籤（刻意的設計：條件頁的深層
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
// **每一次操作都會對 業務中台 發一次真的查詢（約 2 秒）**，所以這一支本來就慢，而且它自己就是負載。
// 跟 check-hub-pages 的兩個 screener 子測試一樣，上游在負載下會回 502（業務中台 的
// ANALYSIS_SERVICE_TIMEOUT_MS = 10_000，而這台機器上三個服務共用同一個本機上游），所以：
//   - 每一個失敗訊息都帶上「業務中台 回什麼」，不然分不出上游拒答與我們改壞
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
    const status = upstream.length ? `業務中台 回 ${upstream.join('/')}` : '業務中台 沒被呼叫'
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
// 送出的查詢內容（換期別要看真的送了哪個欄位）
const sentBodies = []
page.on('response', response => {
  if (response.request().method() !== 'POST' || !response.url().includes('/screener')) return
  upstream.push(response.status())
  sentBodies.push(response.request().postData() ?? '')
})

// 2026-10-15 起兩排分頁換成「我的篩選」「顯示欄位」兩組選單（ScreenerPresetSelect，三組篩選共用）
const savedGroup = page.getByRole('group', { name: '我的篩選' })
const columnGroup = page.getByRole('group', { name: '顯示欄位' })
const loginDialog = page.locator('[aria-label="登入"]')
const selectedName = group => group.locator('.el-select__selected-item:not(.is-hidden)').first().textContent().then(text => text?.trim() ?? '')

async function closeLogin() {
  await loginDialog.locator('.el-dialog__headerbtn').first().click().catch(() => page.keyboard.press('Escape'))
  await page.waitForTimeout(1000)
}

await page.goto(`${baseUrl}/screener/common?template=value`, { waitUntil: 'load', timeout: 180000 })
const firstRow = await waitFor(page.locator('.el-table__body tbody tr').first(), 90000)
expect('載入', '訪客從範本拿到結果列', firstRow.ok, `${firstRow.ms}ms`)
if (!firstRow.ok) {
  console.log('\n第一列沒出現，後面的操作都沒有意義，提前結束。')
  console.log(`業務中台 的 POST /screener 回應：${upstream.join(', ') || '（沒有）'}`)
  console.log(`\nFAILURES:\n  ${failures.join('\n  ')}`)
  await browser.close()
  process.exit(1)
}
await page.waitForTimeout(1500)

// ── 1. 訪客的登入閘門 ────────────────────────────────────────────────────────
// 建立路徑對訪客應該開登入對話框、而且**不要**偷偷建出一組（建了就會變成選單上目前選的那一組）。
for (const [label, group, addName] of [['我的篩選', savedGroup, '新增篩選'], ['顯示欄位', columnGroup, '新增欄位組合']]) {
  const before = await selectedName(group)
  await group.getByRole('button', { name: addName }).click()
  const opened = await waitFor(loginDialog, 10000)
  expect('登入閘門', `訪客按「${label}」的 ＋新增 會開登入`, opened.ok, `${opened.ms}ms`)
  await closeLogin()
  expect('登入閘門', `而且沒有偷建一組（${label}）`, await selectedName(group) === before, before)
}

// ── 2. 訪客的那一組是「未儲存」：名稱是範本名、後面標未儲存，「存成我的篩選」對訪客是登入 ─────────────
// （2026-10-15 之前訪客可以就地改名；現在未儲存的那一組不能管理，存起來之後才能改名）
{
  const name = await selectedName(savedGroup)
  expect('未儲存', '訪客那一組標「未儲存」', name.endsWith('（未儲存）'), name)
  await savedGroup.getByRole('button', { name: '存成我的篩選' }).click()
  const opened = await waitFor(loginDialog, 10000)
  expect('未儲存', '訪客按「存成我的篩選」會開登入', opened.ok, `${opened.ms}ms`)
  await closeLogin()
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
          `${before.count}列/${before.first} → ${changed.now.count}列，業務中台 ${lastStatus}，等了 ${changed.ms}ms`)
      } else {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(800)
      }
    }

    // 移除剛剛加的那一個，範本原本的條件要留著——不然就變成「零條件」，而 業務中台 對沒有 filter 的
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
      `${beforeRemove.count}列 → ${back.now.count}列/${back.now.first}，業務中台 ${backStatus}，等了 ${back.ms}ms`)
  }
}

// ── 3b. 換期別（2026-10-21，使用者：「篩選條件 要可以 調整區間 比如單季 變成 TTM」）──────────────────────────
// periodSiblingsOf 原本只留跟條件同 field.name 的欄位，而 field.name 就是期別代碼，所以範圍編輯器的期別切換從來沒出現過
{
  await page.locator('.screener-filters__add-slot').first().click()
  const picker = await waitFor(page.locator('.condition-panel .indicator-dialog'), 15000)
  if (picker.ok) {
    await page.locator('.condition-panel .indicator-dialog__search input').fill('股東權益報酬率')
    await page.waitForTimeout(600)
    await page.locator('.indicator-dialog__metric', { hasText: '股東權益報酬率' }).first().click()
    const editor = await waitFor(page.locator('.condition-panel .range-editor'), 15000)
    const periods = page.locator('.condition-panel .range-editor__period')
    const labels = (await periods.allTextContents()).map(text => text.trim())
    expect('換期別', '股東權益報酬率可以換單季、近四季、年度', editor.ok && ['單季', '近四季', '年度'].every(label => labels.includes(label)), labels.join('／') || '沒有期別按鈕')
    if (labels.includes('單季')) {
      const quarter = periods.filter({ hasText: '單季' })
      await quarter.click()
      await page.waitForTimeout(300)
      expect('換期別', '按「單季」就換過去', await quarter.getAttribute('aria-pressed') === 'true')
      const sent = sentBodies.length
      // 同上一段：輸入框要按 Enter 才寫進去，關閉面板才算一個條件
      const input = page.locator('.condition-panel input[role="spinbutton"]').first()
      await input.fill('0')
      await input.press('Enter')
      await page.waitForTimeout(600)
      await page.keyboard.press('Escape')
      const start = Date.now()
      while (sentBodies.length === sent && Date.now() - start < 30000) await page.waitForTimeout(300)
      const pillText = (await page.locator('.condition-pill').last().textContent())?.replace(/\s+/g, ' ').trim() ?? ''
      expect('換期別', '膠囊寫「單季」', pillText.includes('單季'), pillText)
      expect('換期別', '送出的條件是 roe.Q', sentBodies.slice(sent).some(body => body.includes('"roe.Q"')), `${sentBodies.length - sent} 次查詢`)
      await page.locator('.condition-pill').last().locator('.condition-pill__remove').click()
      await page.waitForTimeout(1500)
    } else {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(800)
    }
  }
}

// ── 4. 排序 ──────────────────────────────────────────────────────────────────
// 兩種排序都要驗，因為它們走完全不同的路：
//   - 指標欄位是**後端**排序（sortable="custom"，emit 給 changeSort，重發一次查詢）
//   - 股價是**前端**排序（指標型錄外的欄位，業務中台 的 sortField 驗證看不到它——2026-10-02 實測
//     送 sortField: "stock.price" 會回 400，表格整個變空。見 SharedMetricTable 的註解）
//
// 「第一列換人」單獨當斷言是不夠的：表格變成**空的**也會讓第一列「變了」，而那正是修掉的那個 bug
// 的症狀。所以後端那條要同時要求列數仍然大於 0 且 業務中台 回 200。
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
    await page.locator('.el-table__header th').nth(metricIndex).locator('.screener-result-table__column-label').click()
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
    // 先等列數穩定：表格現在最高一個螢幕（2026-10-15），20 列剛好碰到底，無限捲動會自己再載一頁——那不是排序發的請求
    for (let stable = 0, last = -1; stable < 4;) {
      const count = await page.locator('.el-table__body tbody tr').count()
      stable = count === last ? stable + 1 : 0
      last = count
      await page.waitForTimeout(500)
    }
    const postsBefore = upstream.length
    // 點欄名，不點排序箭頭：箭頭 2026-10-15 放大到 24px，點正中間會直接點到「由小到大」那一個，而不是照 sort-orders 輪
    await page.locator('.el-table__header th').nth(priceIndex).locator('.screener-result-table__column-label').click()
    await page.waitForTimeout(2500)
    const values = await page.evaluate(idx => [...document.querySelectorAll('.el-table__body tbody tr')]
      .map(tr => Number(tr.querySelectorAll('td')[idx]?.textContent?.trim().replaceAll(',', ''))), priceIndex)
    // 沒有股價的列（—）照設計沉到最底（SharedMetricTable 的 sortMethodFor），不算亂序；有價的那一段要遞減
    const priced = values.filter(Number.isFinite)
    const descending = priced.every((value, i) => i === 0 || priced[i - 1] >= value)
      && values.slice(priced.length).every(value => !Number.isFinite(value))
    expect('排序', '依「股價」是前端排序（不發請求）', upstream.length === postsBefore,
      `多發了 ${upstream.length - postsBefore} 次`)
    expect('排序', '依「股價」真的排成遞減、而且列沒有消失', descending && values.length > 0,
      `${values.length} 列（${values.length - priced.length} 列沒有股價），前 5：${values.slice(0, 5).join(' / ')}`)
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

// ── 6. 類股範圍（放最後：它會把結果縮到只剩幾列）──────────────────────────────────────────────────────────────
// 2026-10-15 起類股是一個類別型條件（挑選面板裡的「類股」分類），不再是條件區旁邊另一組選單
{
  await page.locator('.screener-filters__add-slot:visible').first().click()
  await waitFor(page.locator('.condition-panel .indicator-dialog'), 15000)
  await page.getByRole('textbox', { name: '搜尋指標名稱' }).fill('類股')
  const item = page.locator('.condition-panel .indicator-dialog__item').first()
  const found = await waitFor(item, 10000)
  expect('類股', '挑選面板有「類股」', found.ok)
  if (found.ok) {
    await item.click()
    const options = page.locator('.condition-panel .range-editor__option')
    const shown = await waitFor(options.first(), 10000)
    const count = shown.ok ? await options.count() : 0
    expect('類股', '列出可以勾的類股', count >= 10, `${count} 個`)
    if (count) {
      // 2026-10-19 加強：原本只比「列數或第一列變了沒」，前一段（載入更多）晚到的結果就能讓它過（實測包含水泥工業時
      // 「40 列 → 60 列、第一列都是 3363」）。改成等帶類股範圍的那一個請求回來，再比「符合上述條件 N 檔」
      const screenerPost = (key) => response => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/screener')
        && (JSON.parse(response.request().postData() ?? '{}')[key]?.length ?? 0) > 0
      const countNow = async () => {
        const text = (await page.locator('.screener-shell__count').first().textContent()) ?? ''
        return /搜尋中/.test(text) ? null : Number(text.replace(/[^0-9]/g, '')) || null
      }
      // 連續兩次讀到同一個數字才算（請求回來之後畫面還要一拍才換）
      const settledCount = async () => {
        let last = null
        for (let i = 0; i < 40; i++) {
          const now = await countNow()
          if (now !== null && now === last) return now
          last = now
          await page.waitForTimeout(500)
        }
        return last
      }
      const allCount = await settledCount()
      const name = (await options.first().textContent())?.trim() ?? ''
      await options.first().click()
      const included = page.waitForResponse(screenerPost('sectorCodes'), { timeout: 30000 }).catch(() => null)
      await page.getByRole('button', { name: '完成' }).click()
      const pill = await waitFor(page.locator('.condition-pill__value', { hasText: `包含 ${name}` }), 10000)
      expect('類股', `膠囊寫「類股：包含 ${name}」`, pill.ok)
      expect('類股', '送出 sectorCodes', !!(await included))
      const includeCount = await settledCount()
      expect('類股', `只看「${name}」之後檔數變少（${allCount} → ${includeCount} 檔）`, includeCount !== null && allCount !== null && includeCount < allCount)

      // 2026-10-19：一組只有一個類股條件（以前第二顆看得到、送出時卻被忽略）。再從面板選一次類股，打開的是原本那一個、
      // 勾選還在；切成「排除」之後膠囊還是一顆，送出的是 excludeSectorCodes，檔數變多
      await page.locator('.screener-filters__add-slot:visible').first().click()
      await waitFor(page.locator('.condition-panel .indicator-dialog'), 15000)
      await page.getByRole('textbox', { name: '搜尋指標名稱' }).fill('類股')
      await page.locator('.condition-panel .indicator-dialog__item').first().click()
      await waitFor(options.first(), 10000)
      const checked = (await page.locator('.condition-panel .range-editor__option.is-checked').allTextContents()).map(text => text.trim())
      expect('類股', '再選一次類股，打開的是原本那一個（勾選還在）', checked.length === 1 && checked[0] === name, checked.join('、'))
      await page.locator('.condition-panel .range-editor__include').getByText('排除').click()
      const excludedRequest = page.waitForResponse(screenerPost('excludeSectorCodes'), { timeout: 30000 }).catch(() => null)
      await page.getByRole('button', { name: '完成' }).click()
      const excluded = await waitFor(page.locator('.condition-pill__value', { hasText: `排除 ${name}` }), 10000)
      expect('類股', `改成排除：膠囊寫「類股：排除 ${name}」`, excluded.ok)
      const sectorPills = await page.locator('.condition-pill__field', { hasText: /^類股$/ }).count()
      expect('類股', '類股條件還是只有一個', sectorPills === 1, `${sectorPills} 個`)
      const body = JSON.parse((await excludedRequest)?.request().postData() ?? '{}')
      expect('類股', '送出 excludeSectorCodes、沒有 sectorCodes', body.excludeSectorCodes?.length === 1 && !body.sectorCodes, JSON.stringify({ sectorCodes: body.sectorCodes, excludeSectorCodes: body.excludeSectorCodes }))
      const excludeCount = await settledCount()
      expect('類股', `排除「${name}」之後檔數變多（只看 ${includeCount} → 排除 ${excludeCount} 檔）`, excludeCount !== null && includeCount !== null && excludeCount > includeCount)
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
  await m.goto(`${baseUrl}/screener/common?template=value`, { waitUntil: 'networkidle' })
  const firstCard = await waitFor(m.locator('.smt-card').first(), 90000)
  expect('手機', '結果是卡片', firstCard.ok, `${firstCard.ms}ms`)

  if (firstCard.ok) {
    const layout = await m.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      tableHidden: getComputedStyle(document.querySelector('.smt-table-view')).display === 'none'
    }))
    expect('手機', '表格藏起來、沒有橫向捲動', layout.tableHidden && layout.overflow <= 1, `overflow ${layout.overflow}`)

    const countText = await m.locator('.screener-shell__count').textContent()
    expect('手機', '顯示並朗讀符合檔數', /符合上述條件 [\d,]+ 檔/.test(countText ?? '') && await m.locator('.screener-shell__count[role="status"]').count() === 1, countText ?? '')

    const groups = await m.getByRole('group', { name: /^(我的篩選|顯示欄位)$/ }).count()
    expect('手機', '「我的篩選」「顯示欄位」兩組選單都在', groups === 2, `${groups} 組`)

    // 排序選單：選「本益比」→ 後端排序（多一次 POST）
    const requestsBefore = upstream.length
    await m.locator('.smt-toolbar__select').first().selectOption({ label: '本益比' })
    await m.waitForTimeout(4000)
    expect('手機', '排序選單選本益比會打後端', upstream.length > requestsBefore && upstream.at(-1) === 200, `多發了 ${upstream.length - requestsBefore} 次`)
    expect('手機', '排序後卡片還在', await m.locator('.smt-card').count() > 0)

    // 欄位設定：下移第一欄 → 卡片裡的欄位順序跟著換
    const labelsBefore = await m.locator('.smt-card').first().locator('dt').allTextContents()
    await m.getByRole('button', { name: '欄位設定' }).click()
    const settingsRows = await m.locator('.column-settings__row').count()
    expect('手機', '欄位設定列出每一欄', settingsRows === labelsBefore.length, `${settingsRows} 列 / ${labelsBefore.length} 欄`)
    await m.locator('.column-settings__row').first().getByRole('button', { name: /^下移/ }).click()
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

console.log(`\n業務中台 的 POST /screener 回應：${upstream.join(', ') || '（沒有）'}`)
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):\n  ${failures.join('\n  ')}`)
  await browser.close()
  process.exit(1)
}
console.log('\nPASS: screener operations')
await browser.close()
