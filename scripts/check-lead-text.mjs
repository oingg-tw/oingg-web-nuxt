// 卡片前面的字（2026-11-06，使用者：「卡片之前的文字描述過多了，會失焦」）。全站每一種頁面模板，1440／375 兩種寬度，量每張卡片前面看得見的字：
//   - 標題到卡片之間不超過 LEAD_MAX（手機四行）：一段答句，不把卡片裡的每一項再列一遍；定義、算法、讀圖方式放到最後一張卡片之後
//   - 兩張卡片之間不超過 GAP_MAX：上一張卡片底下的註記，加上一個沒有卡片的段落，再加下一段答句
// 清單（ul、ol、details）是內容不是前言；文章（/learn、/blog）的字就是內容；首頁（訪客開 /profile 也是導回首頁）與網站地圖沒有答句：都不算。
//
// 用法（只量字數，pnpm dev 也可以）：
//   node scripts/check-lead-text.mjs
//   LEAD_TEXT_URL=http://localhost:3100 node scripts/check-lead-text.mjs
//   LEAD_TEXT_ROUTES=/industries/dividend,/macro node scripts/check-lead-text.mjs   只跑幾頁
import { chromium } from 'playwright'
import { ALL_ROUTES } from './site-routes.mjs'

const baseUrl = process.env.LEAD_TEXT_URL ?? 'http://localhost:3000'
const LEAD_MAX = 80
const GAP_MAX = 160
const EXEMPT = /^\/($|\?|learn|blog|sitemap|profile)/
// 答句長短看資料的頁面：財務業沒有組成，排行有基期門檻與自己的母體
const EXTRA_ROUTES = ['/stock/2881', '/stock/2881/balance-sheet', '/rank/revenue-growth', '/rank/eps-growth', '/rank/eps-turnaround', '/rank/etf-aum']
const filter = (process.env.LEAD_TEXT_ROUTES ?? '').split(',').map(entry => entry.trim()).filter(Boolean)
const routes = (filter.length ? filter : [...new Set([...ALL_ROUTES, ...EXTRA_ROUTES])]).filter(route => !EXEMPT.test(route))

const measure = () => {
  const CARD = '.el-card, .app-card, .app-table-card, table, canvas, .el-table'
  const SKIP = 'nav, footer, header, aside, button, select, input, label, svg, ul, ol, details, .el-radio-group, .el-select, .el-pagination, .visually-hidden, [aria-hidden="true"], .app-skeleton, .app-nav-rail'
  const found = []
  let heading = ''
  let lead = ''
  let gap = ''
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent.replace(/\s+/g, ' ').trim()
        lead += text
        gap += text
      } else if (child.nodeType === Node.ELEMENT_NODE && child.checkVisibility()) {
        if (/^H[1-4]$/.test(child.tagName)) {
          heading = child.innerText.trim().replace(/\s+/g, ' ')
          lead = ''
        } else if (child.matches(CARD)) {
          found.push({ heading, lead, gap })
          lead = ''
          gap = ''
        } else if (!child.matches(SKIP)) {
          walk(child)
        }
      }
    }
  }
  walk(document.querySelector('main') ?? document.body)
  return found
}

const problems = []
const browser = await chromium.launch()
for (const width of [1440, 375]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  for (const route of routes) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'load', timeout: 60000 }).catch(() => null)
    if (!response?.ok()) {
      problems.push(`${width} ${route}：打不開（${response?.status() ?? '逾時'}）`)
      continue
    }
    // 部署環境有常駐的連線，等不到 networkidle；頁面的字在伺服器輸出裡，等不到也量得到
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(300)
    for (const { heading, lead, gap } of await page.evaluate(measure)) {
      if (lead.length > LEAD_MAX) problems.push(`${width} ${route}「${heading}」卡片前 ${lead.length} 字：${lead}`)
      else if (gap.length > GAP_MAX) problems.push(`${width} ${route}「${heading}」兩張卡片之間 ${gap.length} 字：${gap}`)
    }
  }
  await context.close()
}
await browser.close()

if (problems.length) {
  console.log(`卡片前的文字有 ${problems.length} 處超過：\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`PASS: lead text (${routes.length} routes × 2 widths)`)
