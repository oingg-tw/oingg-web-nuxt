// /industries/cycle 的數字核對（2026-10-10）：從業務中台原始端點用這支檔案自己的寫法重算兩個類股的起伏幅度與相關係數，
// 跟 /api/hub/sector-cycle-summary 比對到小數兩位。兩邊寫法各自獨立，對不上就是 server/utils/hub-data.ts 的算法壞了。
// 用法：node scripts/check-sector-cycle.mjs（需要 dev server 與業務中台都在跑）
import assert from 'node:assert/strict'

const BFF = process.env.BFF_URL ?? 'http://localhost:4000'
const APP = process.env.APP_URL ?? 'http://localhost:3000'
const SECTORS = ['15', '02'] // 航運（起伏最大的一類）、食品（最平穩的一類）
const get = async url => { const res = await fetch(url); assert.ok(res.ok, `${url} → ${res.status}`); return res.json() }

const summary = await get(`${APP}/api/hub/sector-cycle-summary`)
const indicator = await get(`${BFF}/macro/business-cycle-indicator`)
const coincident = Object.fromEntries(indicator.entries.filter(e => e.coincidentIndexDetrended !== null).map(e => [e.period, Number(e.coincidentIndexDetrended)]))

for (const code of SECTORS) {
  const { entries } = await get(`${BFF}/industries/${code}/monthly-revenue-history?limit=60`)
  // 連續三個月（entries 依月份遞增；索引相鄰之外再檢查月份真的相鄰）
  const monthIndex = ym => { const [y, m] = ym.split('-').map(Number); return y * 12 + m }
  const yoy = []
  for (let i = 2; i < entries.length; i++) {
    const w = entries.slice(i - 2, i + 1)
    if (monthIndex(w[2].yearMonth) - monthIndex(w[0].yearMonth) !== 2) continue
    const now = w.reduce((s, e) => s + Number(e.revenue), 0)
    const before = w.reduce((s, e) => s + Number(e.lastYearRevenue), 0)
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
  console.log(`ok ${code} ${row.name}: amplitude ${row.amplitude}, r ${row.correlation} (${row.months} months)`)
}

// 形狀：每列都有兩個數字或明確的 null，月份字串遞增
assert.ok(summary.sectors.length >= 30, `only ${summary.sectors.length} sectors`)
assert.ok(summary.firstMonth < summary.lastMonth, 'firstMonth/lastMonth')
console.log(`ok ${summary.sectors.length} sectors, ${summary.firstMonth}–${summary.lastMonth}`)
