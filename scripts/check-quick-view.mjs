import { chromium } from 'playwright'

// 指標速覽每一種圖都畫得出來（2026-10-16「指標速覽沒有顯示所有的指標圖，為什麼？這邊不是統一模板了嗎」→ slug 對應哪張圖只在
// metric-pages.ts 的 quickViewChartOf，能不能釘也讀它）。每種 kind 各釘一支，用指標速覽自己的「加入指標」彈窗釘（未登入，釘選只在記憶體）：
//   - 2330：每一張卡都要畫出圖（SVG 裡有形狀，或現金循環時間軸的色段），不能落到只有標題的空卡
//   - 2891（金控）：每一支都要有卡——三率、流動資產這些拆不開的是空狀態卡，不是整格消失；杜邦分析畫 ROE、資產報酬率、權益乘數（2026-11-19）
//   - 彈窗裡沒有純表格頁（填權填息、三大報表）
//   - 近期新聞（2026-11-16 起能釘，不在預設）：2330 列出新聞，卡片不比旁邊的圖表卡高
//   - 重新整理（2026-11-28）：每張卡片從伺服器的第一個畫面到畫好，高度都不動（上次畫好的高度記在 cookie，佔位照它畫）；
//     第一次來，手機第一個畫面裡的基本資料與六面向也不動
// 用法：先開伺服器（正式建置：PORT=3100 node --env-file=.env .output/server/index.mjs），
//   QUICK_VIEW_CHECK_URL=http://localhost:3100 node scripts/check-quick-view.mjs
const baseUrl = process.env.QUICK_VIEW_CHECK_URL ?? 'http://localhost:3000'

// 每種 kind 一支，列名同指標目錄（STOCK_METRIC_INDEX）。一次最多釘 12 支，所以分兩批
const BATCHES = [
  ['本益比', '每股盈餘', 'ROE', '股東回饋組成', '營業費用組成', '現金殖利率', '月營收', '杜邦分析', '淨值從哪來', '財報三率', '償債能力比率', '現金循環的組成'],
  ['淨值組成', '流動資產組成', '非流動資產組成', '負債組成', '現金流量的組成', '近期新聞', '個股輪廓', '景氣循環度']
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
  // 近期新聞（2026-11-16 起能釘）不是圖：有新聞列表就算畫出來了。六面向（2026-11-27）是自己畫的雷達圖：有連線就算。
  // 景氣循環度（2026-11-28）是自己畫的點與趨勢線：有年度的點就算
  return (await card.locator('[role="img"] svg path').count()) >= 3 || (await card.locator('.cctl__seg').count()) > 0 || (await card.locator('.news-card__item').count()) > 0 || (await card.locator('.six-radar__line').count()) > 0 || (await card.locator('.cycle-trend__dot').count()) > 0
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
    // 搜尋（2026-11-15，使用者：「加入指標彈窗 這邊要放搜尋欄位」）：名稱裡有才列、不分大小寫；沒有就說沒有；關掉再打開是空的
    const search = dialog.getByRole('textbox', { name: '搜尋指標名稱' })
    const chips = dialog.locator('.stock-quick-view-page__picker-item')
    const all = await chips.count()
    await search.fill('營收')
    const revenue = (await chips.allTextContents()).map(text => text.trim())
    // 型錄別名有「營收」的也列（研發費用率的別名是「研發費用占營收比」，2026-11-19），名稱與別名都沒有的不列
    expect(code, `搜「營收」：名稱有營收的都在、ROE 不在（${all} → ${revenue.length} 個）`, revenue.length < all && ['月營收', '股價營收比', '每股營收'].every(label => revenue.includes(label)) && !revenue.includes('ROE'))
    await search.fill('roe')
    expect(code, '搜小寫 roe 找得到 ROE', (await chips.allTextContents()).some(text => text.trim() === 'ROE'))
    // 型錄的搜尋別名（2026-11-19，使用者：「加入指標 輸入 流速動比 沒東西跑出來」）：中文俗稱比對整串、全大寫的縮寫比開頭。
    // 別名是彈窗打開才抓的，所以等；排在 PER 前面，PER 那一條才是在別名到了之後驗不會多撈
    const listsQuickRatio = () => waitFor(async () => (await chips.allTextContents()).some(text => text.trim() === '速動比率'), 15000)
    await search.fill('酸性')
    expect(code, '搜「酸性」找得到速動比率（型錄別名「酸性測驗比率」）', await listsQuickRatio())
    await search.fill('qr')
    expect(code, '搜 qr 找得到速動比率（型錄縮寫 QR）', await listsQuickRatio())
    // 使用者的叫法，數據中台 2026-11-19 加進兩支的別名（9f6d721）
    await search.fill('流速動比')
    expect(code, '搜「流速動比」列出流動比率與速動比率', await waitFor(async () => {
      const shown = (await chips.allTextContents()).map(text => text.trim())
      return shown.includes('流動比率') && shown.includes('速動比率')
    }, 15000))
    // 英文縮寫只寫在頁面標題裡（2026-11-16，使用者：「metrics 搜尋PER找不到本益比河流圖」）；網址代號比字的開頭，per 不對到 operating
    await search.fill('PER')
    const per = (await chips.allTextContents()).map(text => text.trim())
    expect(code, `搜 PER 找得到本益比、不列營業費用組成（${per.join('、')}）`, per.includes('本益比') && !per.includes('營業費用組成'))
    await search.fill('pbr')
    expect(code, '搜 pbr 找得到股價淨值比', (await chips.allTextContents()).some(text => text.trim() === '股價淨值比'))
    await search.fill('找不到的字')
    expect(code, '沒有符合的：寫「沒有符合的指標」', (await chips.count()) === 0 && await dialog.getByText('沒有符合的指標').isVisible())
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '加入指標' }).click()
    await dialog.waitFor()
    expect(code, '關掉再打開：搜尋是空的、全部都在', (await search.inputValue()) === '' && (await chips.count()) === all)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
  }

  // 預設的前兩張：基本資料（2026-11-08，8 列表格）、六面向的雷達圖（2026-11-27，使用者：「雷達圖放進預設」「預設第二張如何?」）。
  // 這兩張都不比圖表卡高（使用者：「我比較擔心他在電腦版 會把別的圖表比例撐高」）：跟第三張（本益比的圖）比。三張都先取消拉伸量自己的
  // 高度，同一列被拉成一樣高的話比不出來
  const cards = page.locator('.stock-quick-view-page__grid > *')
  const titleOf = index => cards.nth(index).locator('h3 a').textContent().then(text => text?.trim()).catch(() => '')
  expect(code, '預設第一張是基本資料', await waitFor(async () => (await titleOf(0)) === '基本資料'))
  expect(code, '預設第二張是個股輪廓（六面向）', (await titleOf(1)) === '個股輪廓')
  expect(code, '基本資料卡 8 列', await waitFor(async () => (await cards.nth(0).locator('.fact-list__item').count()) === 8))
  expect(code, '個股輪廓畫出雷達圖', await waitFor(async () => hasChart(cards.nth(1))))
  await waitFor(async () => hasChart(cards.nth(2)))
  const heights = await page.evaluate(() => {
    const three = [...document.querySelectorAll('.stock-quick-view-page__grid > *')].slice(0, 3)
    for (const card of three) card.style.alignSelf = 'start'
    const sizes = three.map(card => Math.round(card.getBoundingClientRect().height))
    for (const card of three) card.style.alignSelf = ''
    return sizes
  })
  expect(code, '基本資料、個股輪廓不比圖表卡高', heights[0] <= heights[2] && heights[1] <= heights[2], heights.join(' / '))
  // 六面向卡片的軸名在手機上不黏在一起（2026-11-27：卡片的圖只有 188px 寬，軸名那一列跟圖一樣寬時三個四個字的軸名放不下，
  // 「股東回饋」緊接著「成長動能」）。量字本身佔的範圍：同一列的兩個軸名至少隔 4px。金控只畫適用的三個面向，是三角形
  //（2026-11-28，使用者：「雷達圖要是只有三個面向解釋就改成三角形吧」）
  const axisCount = code === '2891' ? 3 : 6
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 900 })
    const touching = await cards.nth(1).evaluate((card) => {
      const names = [...card.querySelectorAll('.six-radar__label > span:first-child')].map((node) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        return { name: node.textContent.trim(), rect: range.getBoundingClientRect() }
      })
      const pairs = []
      for (let a = 0; a < names.length; a++) {
        for (let b = a + 1; b < names.length; b++) {
          const [first, second] = [names[a].rect, names[b].rect]
          const sameRow = Math.max(first.top, second.top) < Math.min(first.bottom, second.bottom)
          if (sameRow && Math.max(first.left, second.left) - Math.min(first.right, second.right) < 4) pairs.push(`${names[a].name}／${names[b].name}`)
        }
      }
      return { count: names.length, pairs }
    })
    expect(code, `${width} 寬：個股輪廓卡片的 ${axisCount} 個軸名不黏在一起`, touching.count === axisCount && touching.pairs.length === 0, touching.pairs.join('、') || `${touching.count} 個軸名`)
  }
  await page.setViewportSize({ width: 1440, height: 900 })

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
    // 金控的杜邦拆不出三項，改畫 ROE ≈ 資產報酬率 × 權益乘數（2026-11-19，使用者：「遇到金控 就畫 ROE 權益乘數 ROA 三條」）
    if (!needChart && labels.includes('杜邦分析')) {
      const dupontCard = cardOf(page, '杜邦分析')
      expect(code, '金控的杜邦分析畫出 ROE、資產報酬率、權益乘數', await waitFor(async () => await hasChart(dupontCard) && (await dupontCard.getByText('資產報酬率').count()) > 0 && (await dupontCard.getByText('稅後淨利率').count()) === 0))
    }
    // 新聞卡跟圖表卡的骨架一樣高（StockNewsCard）：桌機兩欄時不把同一列撐高。量法同基本資料卡，先取消拉伸
    if (labels.includes('近期新聞')) {
      const [news, chart] = await Promise.all(['近期新聞', labels[0]].map(label => cardOf(page, label).evaluate((card) => {
        card.style.alignSelf = 'start'
        const height = Math.round(card.getBoundingClientRect().height)
        card.style.alignSelf = ''
        return height
      })))
      expect(code, '新聞卡不比旁邊的圖表卡高', news <= chart, `${news} / ${chart}`)
    }
  }
  expect(code, '沒有頁面錯誤', pageErrors.length === 0, pageErrors.join(' | '))
  await context.close()
}

// 每張卡片的高度從第一個畫面到畫好有沒有變（2026-11-28：佔位原本一律一樣高，手機上 2330 的基本資料 462→442、ROE 462→574，
// 資料一到下面整頁跟著動）。每個畫面記一次每張卡片的高度；第一次來只看第一個畫面裡的前兩張（其餘用預設，可能動一次），
// 重新整理之後七張都不能動
for (const width of [375, 1440]) {
  console.log(`\n== /stock/2330 卡片高度 @${width}`)
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  await context.addInitScript(() => {
    window.__cardHeights = []
    const tick = () => {
      document.querySelectorAll('.stock-quick-view-page__grid > .stock-quick-view-page__cell').forEach((card, index) => {
        const seen = (window.__cardHeights[index] ??= [])
        const height = Math.round(card.getBoundingClientRect().height)
        if (seen.at(-1) !== height) seen.push(height)
      })
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const page = await context.newPage()
  const settle = async () => {
    await waitFor(async () => (await page.locator('.stock-quick-view-page__cell').count()) >= 7 && (await page.locator('.stock-quick-view-page__cell .app-skeleton').count()) === 0, 120000)
    // 全部畫好、靜下來半秒才記高度（rememberHeights）
    await page.waitForTimeout(1500)
    return page.evaluate(() => window.__cardHeights.map(list => list.join('→')))
  }
  await page.goto(`${baseUrl}/stock/2330`, { waitUntil: 'networkidle' })
  const first = await settle()
  expect('2330', `${width} 寬第一次來：基本資料與個股輪廓的高度不動`, first.slice(0, 2).every(seen => !seen.includes('→')), first.slice(0, 2).join(' / '))
  await page.reload({ waitUntil: 'networkidle' })
  const again = await settle()
  expect('2330', `${width} 寬重新整理：每張卡片的高度都不動`, again.length >= 7 && again.every(seen => !seen.includes('→')), again.join(' / '))
  await context.close()
}

await browser.close()
if (failures.length) {
  console.log(`\n${failures.length} failed`)
  process.exit(1)
}
console.log('\nall ok')
