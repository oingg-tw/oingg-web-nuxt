import { chromium } from 'playwright'
const b = await chromium.launch()
// SSR HTML first — the links must still be in the raw markup
const raw = await (await fetch('http://localhost:3000/stock/2330/dividend')).text()
const navLinks = [...raw.matchAll(/href="(\/stock\/2330[^"]*)"/g)].map(m => m[1])
console.log('SSR 原始 HTML 內 /stock/2330* 連結:', new Set(navLinks).size, '個')
console.log('  含 <details>:', /<details[^>]*stock-page-nav-mobile/.test(raw), ' 含 summary:', /stock-page-nav-mobile__bar/.test(raw))

const p = await b.newPage({ viewport: { width: 375, height: 812 } })
const errs = []; p.on('pageerror', e => errs.push(String(e)))
await p.goto('http://localhost:3000/stock/2330', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
const m = async (tag) => {
  const r = await p.evaluate(() => {
    const d = document.querySelector('.stock-page-nav-mobile')
    const box = d.getBoundingClientRect()
    const main = document.getElementById('main-content')
    const last = main.lastElementChild?.getBoundingClientRect()
    return {
      open: d.hasAttribute('open'), top: Math.round(box.top), h: Math.round(box.height),
      vh: window.innerHeight, pad: getComputedStyle(main).paddingBottom,
      barText: d.querySelector('summary').innerText.replace(/\n/g, ' '),
      覆蓋內容: last ? Math.round(last.bottom) > Math.round(box.top) && Math.round(last.bottom) < window.innerHeight + 5 : null
    }
  })
  console.log(`${tag} open=${r.open} 位置 y=${r.top} 高=${r.h} (視窗 ${r.vh})  main padding-bottom=${r.pad}`)
  console.log(`   bar: 「${r.barText}」`)
}
await m('收合')
await p.locator('.stock-page-nav-mobile__bar').click()
await p.waitForTimeout(400)
await m('展開')
// keyboard
await p.keyboard.press('Escape')
await p.locator('.stock-page-nav-mobile__bar').focus()
await p.keyboard.press('Enter')
await p.waitForTimeout(300)
console.log('鍵盤 Enter 後 open =', await p.evaluate(() => document.querySelector('.stock-page-nav-mobile').hasAttribute('open')))
// scroll to bottom, is the bar still there?
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await p.waitForTimeout(500)
const bottom = await p.evaluate(() => {
  const d = document.querySelector('.stock-page-nav-mobile').getBoundingClientRect()
  return { top: Math.round(d.top), vh: window.innerHeight }
})
console.log('捲到頁尾後 bar 仍在 y=' + bottom.top + '（視窗 ' + bottom.vh + '）→', bottom.top < bottom.vh ? '可見 ✓' : '不見 ✗')
console.log('page errors:', errs.length ? errs : 'none')
await p.screenshot({ path: 'C:/Users/Chuia/AppData/Local/Temp/claude/c--Users-Chuia-Documents-oingg-web-nuxt/69477f7d-a4be-4487-a74a-6cc526bf2492/scratchpad/sheet-bottom.png' })
await b.close()
