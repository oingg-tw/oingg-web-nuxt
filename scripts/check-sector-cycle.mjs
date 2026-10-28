// /industries/cycle 的數字核對（2026-10-10）：從業務中台原始端點用這支檔案自己的寫法重算兩個類股的起伏幅度與相關係數，
// 跟 /api/hub/sector-cycle-summary 比對到小數兩位。兩邊寫法各自獨立，對不上就是 server/utils/hub-data.ts 的算法壞了。
// 用法：node scripts/check-sector-cycle.mjs（需要 dev server 與業務中台都在跑）
import assert from 'node:assert/strict'

const BUSINESS = process.env.BUSINESS_URL ?? 'http://localhost:4000'
const APP = process.env.APP_URL ?? 'http://localhost:3000'
const SECTORS = ['15', '02'] // 航運（起伏最大的一類）、食品（最平穩的一類）
const get = async url => { const res = await fetch(url); assert.ok(res.ok, `${url} → ${res.status}`); return res.json() }

const summary = await get(`${APP}/api/hub/sector-cycle-summary`)
const indicator = await get(`${BUSINESS}/macro/business-cycle-indicator`)
const coincident = Object.fromEntries(indicator.entries.filter(e => e.coincidentIndexDetrended !== null).map(e => [e.yearMonth ?? e.period, Number(e.coincidentIndexDetrended)])) // Go 換版並存（contract-delta A15）

for (const code of SECTORS) {
  const { entries } = await get(`${BUSINESS}/industries/${code}/monthly-revenue-history?limit=132`)
  // 連續三個月（entries 依月份遞增；索引相鄰之外再檢查月份真的相鄰）
  const monthIndex = ym => { const [y, m] = ym.split('-').map(Number); return y * 12 + m }
  const yoy = []
  for (let i = 2; i < entries.length; i++) {
    const w = entries.slice(i - 2, i + 1)
    if (monthIndex(w[2].yearMonth) - monthIndex(w[0].yearMonth) !== 2) continue
    const now = w.reduce((s, e) => s + Number(e.currentMonthRevenue), 0)
    const before = w.reduce((s, e) => s + Number(e.lastYearSameMonthRevenue), 0)
    if (before > 0) yoy.push({ ym: w[2].yearMonth, v: (now / before - 1) * 100 })
  }
  const avg = xs => xs.reduce((s, x) => s + x, 0) / xs.length
  const sd = xs => Math.sqrt(avg(xs.map(x => (x - avg(xs)) ** 2)))
  const paired = yoy.filter(p => p.ym in coincident)
  const xs = paired.map(p => p.v); const ys = paired.map(p => coincident[p.ym])
  const r = avg(xs.map((x, i) => (x - avg(xs)) * (ys[i] - avg(ys)))) / (sd(xs) * sd(ys))

  const row = summary.sectors.find(s => s.code === code)
  assert.ok(row, `sector ${code} missing from summary`)
  assert.equal(row.amplitude, Math.round(sd(yoy.map(p => p.v)) * 100) / 100, `${code} amplitude`)
  assert.equal(row.correlation, Math.round(r * 100) / 100, `${code} correlation`)
  assert.equal(row.months, paired.length, `${code} months`)
  // 熱度圖的一列（2026-10-21）：逐月年增率跟上面自己算的一致（小數一位），沒有值的月份是 null
  const byMonth = new Map(yoy.map(p => [p.ym, Math.round(p.v * 10) / 10]))
  summary.months.forEach((month, i) => assert.equal(row.yoy[i], byMonth.get(month) ?? null, `${code} yoy ${month}`))
  // 類股頁的月營收圖（2026-10-21 起畫近三個月累計年增率）：同一份數字
  const industryPage = await get(`${APP}/api/hub/industry/${code}`)
  for (const [month, value] of byMonth) assert.equal(industryPage.revenueYoy3m[month], value, `${code} industry revenueYoy3m ${month}`)
  console.log(`ok ${code} ${row.name}: amplitude ${row.amplitude}, r ${row.correlation} (${row.months} months), heatmap row matches`)
}

// 熱度圖的月份軸與對齊的景氣同時指標
assert.ok(summary.months.length > 24 && summary.months.every((month, i) => i === 0 || summary.months[i - 1] < month), 'months ascending')
assert.ok(summary.sectors.every(row => row.yoy.length === summary.months.length), 'every heatmap row aligned to months')
summary.months.forEach((month, i) => assert.equal(summary.coincident[i], month in coincident ? Math.round(coincident[month] * 100) / 100 : null, `coincident ${month}`))

// 景氣收縮期：用原始的基準日期自己算一次（高峰的下一個月到谷底）。擴張（谷底的下一個月到高峰）與收縮的月數都要等於官方公布
// 的月數——對不上就是月份算錯，或基準日期本身寫錯：收縮期從高峰算起，高峰寫錯時擴張月數最先對不上（第 14 次循環就是這樣抓到的）
const reference = await get(`${BUSINESS}/macro/business-cycle-reference-dates`)
const nextMonth = ym => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}` }
const toIndex = ym => { const [y, m] = ym.split('-').map(Number); return y * 12 + m }
const span = (from, to) => toIndex(to) - toIndex(from) + 1
// 第 14 次的高峰曾寫成 2014-01（國發會 2014-10），2026-10-21 本 check 抓到，gov-ts 2026-10-22 更正
for (const cycle of reference.entries) {
  if (cycle.peak && cycle.expansionMonths != null) assert.equal(span(nextMonth(cycle.troughStart), cycle.peak), cycle.expansionMonths, `cycle ${cycle.cycleNo} expansion months`)
  if (cycle.peak && cycle.troughEnd && cycle.contractionMonths != null) assert.equal(span(nextMonth(cycle.peak), cycle.troughEnd), cycle.contractionMonths, `cycle ${cycle.cycleNo} contraction months`)
}
const expected = reference.entries.flatMap(cycle => (cycle.peak ? [{ from: nextMonth(cycle.peak), to: cycle.troughEnd }] : []))
const within = (first, last) => expected.filter(p => p.from <= last && (p.to ?? last) >= first)
assert.deepEqual(summary.contractions, within(summary.months[0], summary.months.at(-1)), 'heatmap contractions')
// 類股頁的營收圖用同一份（航運）
const industry = await get(`${APP}/api/hub/industry/${SECTORS[0]}`)
const revenueMonths = industry.revenueTrend.entries.map(entry => entry.yearMonth)
assert.deepEqual(industry.businessCycle.contractions, within(revenueMonths[0], revenueMonths.at(-1)), 'industry page contractions')
assert.ok(Object.keys(industry.businessCycle.coincident).length > 24, 'industry page: coincident by month')
console.log(`ok heatmap ${summary.months.length} months; contractions ${summary.contractions.map(p => `${p.from}～${p.to ?? '…'}`).join('、')}; ${reference.entries.length} cycles' month counts match`)

// 形狀：每列都有兩個數字或明確的 null，月份字串遞增
assert.ok(summary.sectors.length >= 30, `only ${summary.sectors.length} sectors`)
assert.ok(summary.firstMonth < summary.lastMonth, 'firstMonth/lastMonth')
console.log(`ok ${summary.sectors.length} sectors, ${summary.firstMonth}–${summary.lastMonth}`)
