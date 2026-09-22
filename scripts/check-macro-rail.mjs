// 總經特區's nav became a pinned sidebar 2026-09-22（「macro-nav 能做成sidebar嗎」）. This asserts
// the four things that break if the two-copy + CSS arrangement is wired wrong — the same failure
// modes the stock rail's own rewrite hit（see StockPageNav.vue's comment）:
//
//   1. BOTH copies are in the SSR HTML (a Teleport/ClientOnly version would ship an empty rail)
//   2. exactly one is visible at each width, and it's the right one
//   3. the rail does not overlap the page's own content at desktop width
//   4. the active page's link carries aria-current plus a non-colour cue
//
// Also checks the stock rail at the same widths, since its chrome moved to AppNavRail.vue in the
// same change and a regression there would be silent.
//
// Run: node scripts/check-macro-rail.mjs   (dev server must be up)
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const failures = []
const check = (cond, label, detail = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`)
  if (!cond) failures.push(label)
}

const browser = await chromium.launch()

async function inspect(path, { railSelector, inlineSelector, width }) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } })
  page.on('pageerror', e => failures.push(`pageerror ${path} @${width}: ${e.message}`))

  // Raw SSR HTML first — a rail that only exists after hydration is the bug this pattern replaced.
  const html = await (await fetch(`${BASE}${path}`)).text()
  const ssrHasRail = html.includes(railSelector.slice(1))
  const ssrHasInline = html.includes(inlineSelector.slice(1))

  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  const rail = page.locator(railSelector).first()
  const inline = page.locator(inlineSelector).first()
  const railVisible = await rail.isVisible().catch(() => false)
  const inlineVisible = await inline.isVisible().catch(() => false)
  const railBox = railVisible ? await rail.boundingBox() : null

  // Where the page's own content starts, to prove the fixed rail isn't sitting on top of it.
  const contentLeft = await page.evaluate(() => {
    const h1 = document.querySelector('main h1')
    return h1 ? h1.getBoundingClientRect().left : null
  })

  const activeLinks = await page.locator(`${railSelector} a[aria-current="page"], ${inlineSelector} a[aria-current="page"]`).count()
  const activeStyle = await page.evaluate((sel) => {
    const link = document.querySelector(`${sel} a[aria-current="page"]`)
    if (!link) return null
    const s = getComputedStyle(link)
    return { weight: s.fontWeight, decoration: s.textDecorationLine }
  }, railVisible ? railSelector : inlineSelector)

  await page.close()
  return { ssrHasRail, ssrHasInline, railVisible, inlineVisible, railBox, contentLeft, activeLinks, activeStyle }
}

for (const [label, path, railSel, inlineSel] of [
  ['總經特區 /macro/policy-rate', '/macro/policy-rate', '.app-nav-rail', '.macro-nav--inline'],
  ['總經特區 /macro/inflation', '/macro/inflation', '.app-nav-rail', '.macro-nav--inline'],
  ['個股 /stock/2330', '/stock/2330', '.app-nav-rail', '.stock-page-nav-mobile']
]) {
  for (const width of [1440, 375]) {
    console.log(`\n${label} @ ${width}px`)
    const r = await inspect(path, { railSelector: railSel, inlineSelector: inlineSel, width })
    check(r.ssrHasRail, 'rail 在 SSR HTML 裡')
    check(r.ssrHasInline, '窄版副本在 SSR HTML 裡')
    if (width === 1440) {
      check(r.railVisible && !r.inlineVisible, '桌機只顯示 rail', `rail=${r.railVisible} inline=${r.inlineVisible}`)
      check(r.railBox?.width === 240, 'rail 寬度 240px', `${r.railBox?.width}`)
      check(
        r.contentLeft !== null && r.railBox !== null && r.contentLeft >= r.railBox.x + r.railBox.width,
        'rail 未壓到內容',
        `content left ${r.contentLeft} vs rail right ${r.railBox ? r.railBox.x + r.railBox.width : '?'}`
      )
    } else {
      check(!r.railVisible && r.inlineVisible, '手機只顯示窄版副本', `rail=${r.railVisible} inline=${r.inlineVisible}`)
    }
    check(r.activeLinks > 0, '當前頁連結有 aria-current')
    check(
      r.activeStyle !== null && Number(r.activeStyle.weight) >= 700 && r.activeStyle.decoration.includes('underline'),
      '當前狀態不只靠顏色（粗體＋底線）',
      JSON.stringify(r.activeStyle)
    )
  }
}

await browser.close()
console.log(failures.length ? `\nFAILED (${failures.length}):\n  ${failures.join('\n  ')}` : '\nALL PASS')
process.exitCode = failures.length ? 1 : 0
