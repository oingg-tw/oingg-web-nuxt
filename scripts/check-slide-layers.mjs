// 手機版的兩個滑層（功能選單、搜尋）收回時不能冒出橫向捲軸（2026-10-20，使用者：「點下選單再收回，會短暫跑出 X 軸 scrollbar；
// 點搜尋再收回不會」）。選單把頁面往右推，關掉後滑回來的 0.22 秒裡超出右邊的部分是捲得到的寬度，所以版面的剪裁要等滑完才拿掉
// （useSlideLayer 的 clipShell）。這支逐幀量 scrollWidth − innerWidth，一般頁與首頁兩種版面、兩個滑層都要是 0。
// 用桌面瀏覽器開 375px：手機的捲軸浮在畫面上、版面寬度跟著內容走，量不到；使用者看到的正是電腦縮窄的樣子。
//
// Run: 本機 dev（:3000）開著，node scripts/check-slide-layers.mjs
import { chromium } from 'playwright'
const base = 'http://localhost:3000'
let failures = 0
const check = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 375, height: 800 } })).newPage()
for (const path of ['/calendar', '/']) {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false, null, { timeout: 60000 }); await page.waitForTimeout(800)
  for (const label of ['選單', '搜尋']) {
    await page.locator('header button', { hasText: label }).first().click(); await page.waitForTimeout(500)
    // 量的迴圈先開始，再按關閉：涵蓋整段滑回動畫
    const sampling = page.evaluate(() => new Promise((resolve) => {
      let worst = 0
      const start = performance.now()
      const tick = () => {
        worst = Math.max(worst, document.documentElement.scrollWidth - innerWidth)
        if (performance.now() - start < 600) requestAnimationFrame(tick)
        else resolve(worst)
      }
      requestAnimationFrame(tick)
    }))
    await page.locator('.slide-layer--open .slide-layer__close').click()
    const worst = await sampling
    check(worst === 0, `${path} ${label}收回時頁面沒有比畫面寬（最多 ${worst}px）`)
    await page.waitForTimeout(400)
  }
}
await browser.close()
if (failures) { console.log(`\n${failures} 項失敗`); process.exit(1) }
console.log('\n全部通過')
