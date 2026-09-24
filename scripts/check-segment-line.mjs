// One runnable check for StockDividendSegmentLine.vue's only claim: the five parts of the line are
// an exact partition of 每股營收, so the diagram can never show parts that do not add back to the
// whole. The deductions telescope, which is why this holds for any company — and why a company
// whose 業外 is a net GAIN（1303 南亞）produces a negative part and must be excluded instead of
// drawn with an absolute value. Run: node scripts/check-segment-line.mjs
import assert from 'node:assert/strict'

const partition = (revenue, grossMargin, operatingMargin, netProfitMargin, dividend) => {
  const gross = (revenue * grossMargin) / 100
  const operating = (revenue * operatingMargin) / 100
  const net = (revenue * netProfitMargin) / 100
  return [revenue - gross, gross - operating, operating - net, net - dividend, dividend]
}
const sum = list => list.reduce((a, b) => a + b, 0)
const near = (a, b) => Math.abs(a - b) < 1e-9

// 2330 2026Q2, the numbers rendered on the page
const tsmc = partition(171.23, 64.23, 56.10, 50.38, 20.50)
assert.ok(near(sum(tsmc), 171.23), 'parts must partition 每股營收 exactly')
assert.ok(tsmc.every(p => p > 0), '2330 deducts at every step')

// The telescoping holds whatever the margins are — including a loss-making operation
const odd = partition(35.41, 12.0, -2.02, 6.07, 1.0)
assert.ok(near(sum(odd), 35.41), 'partition holds for any margins')

// …but the gain case yields a NEGATIVE part, which a part-whole line cannot draw. 1303 南亞:
// 營業利益率 6.22% < 稅後淨利率 17.51%, so 本業以外與稅 is negative and the guard must reject it.
const nanya = partition(35.41, 20.0, 6.22, 17.51, 2.0)
assert.ok(nanya[2] < 0, '1303 has a negative 本業以外與稅 part')
assert.ok(!nanya.every(p => p > 0), 'guard must reject it rather than draw |amount|')

console.log('segment line partition: ok')

// Panel k must show k cuts, and the remainder must equal step k's own result — the off-by-one that
// labelled 營業利益 96.06 as「EPS」on panel 4 while the equation under it said 86.27.
const revenue = 171.23
const results = [171.23, 109.98, 96.06, 86.27, 20.50]
results.forEach((to, panel) => {
  const cuts = tsmc.slice(0, panel)
  const remainder = revenue - cuts.reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(remainder - to) < 0.01, `panel ${panel}: line remainder ${remainder.toFixed(2)} must equal the step result ${to}`)
})
console.log('segment line panels: ok')
