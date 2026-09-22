import { chromium } from 'playwright'
const b = await chromium.launch()
for (const w of [1440, 375]) {
  const p = await b.newPage({ viewport: { width: w, height: 1200 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e)))
  await p.goto('http://localhost:3000/stock/1101', { waitUntil: 'networkidle' })
  await p.waitForTimeout(2500)
  // horizontal overflow?
  const over = await p.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
    wide: [...document.querySelectorAll('*')]
      .filter(el => el.getBoundingClientRect().width > window.innerWidth + 1)
      .slice(0, 6)
      .map(el => `${el.tagName.toLowerCase()}.${(el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : '')} w=${Math.round(el.getBoundingClientRect().width)}`)
  }))
  console.log(`w=${w} scrollWidth=${over.docW} innerWidth=${over.winW} 溢出元素:`, over.wide.length ? over.wide : 'none', 'errors:', errs.length || 'none')
  const card = p.locator('.summary-card').first()
  if (await card.count()) {
    await card.screenshot({ path: `C:/Users/Chuia/AppData/Local/Temp/claude/c--Users-Chuia-Documents-oingg-web-nuxt/69477f7d-a4be-4487-a74a-6cc526bf2492/scratchpad/1101-summary-${w}.png` })
    console.log('  summary-card text:', (await card.innerText()).replace(/\n/g, ' ⏐ ').slice(0, 300))
  } else console.log('  找不到 .summary-card')
  await p.close()
}
await b.close()
