import { chromium } from 'playwright'
const target = process.argv[2]
const browser = await chromium.launch()
for (const width of [1440, 375]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768 })
  const page = await ctx.newPage()
  await page.goto(target, { waitUntil: 'load', timeout: 180000 })   // warm + cache
  await page.waitForTimeout(1500)
  await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(() => {
    window.__logo = []
    const t0 = performance.now()
    const sample = () => {
      const marks = [...document.querySelectorAll('.app-logo__mark')].filter(el => el.getClientRects().length)
      const el = marks[0]
      if (el) {
        const r = el.getBoundingClientRect(); const img = el.querySelector('img'); const ir = img?.getBoundingClientRect()
        const s = `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} bg=${getComputedStyle(el).backgroundColor} img=${img?.complete ? 'done' : 'loading'} ${ir ? Math.round(ir.width) + 'x' + Math.round(ir.height) : ''} vis=${getComputedStyle(el).visibility} op=${getComputedStyle(el.closest('header') ?? el).opacity} n=${marks.length}`
        if (window.__logo.at(-1)?.s !== s) window.__logo.push({ t: Math.round(performance.now() - t0), s })
      } else if (window.__logo.at(-1)?.s !== 'none') window.__logo.push({ t: Math.round(performance.now() - t0), s: 'none' })
      if (performance.now() - t0 < 5000) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.reload({ waitUntil: 'load', timeout: 180000 })
  await page.waitForTimeout(5500)
  console.log(`== ${width}`)
  for (const e of await page.evaluate(() => window.__logo)) console.log(`  ${e.t}ms ${e.s}`)
  await ctx.close()
}
await browser.close()
