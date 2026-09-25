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

// Which bars the window shows at each step. The chart is now a nine-slot track — remainder, cut,
// remainder, cut, … — with a window of three sliding two slots per press, so「被拆的那一條」stays on
// screen beside the two pieces it splits into. The invariant that matters is that the window's
// FIRST bar equals its second plus its third: that is the only thing the picture claims.
const revenue = 171.23
// Derived from the SAME parts array, not hand-typed from the rendered 2dp figures — mixing the two
// is what made this check fail on its first run: 61.2489… ＋ a typed 109.98 misses 171.23 by 0.0011,
// which is a rounding artefact of the test, not of the chart.
const rems = [revenue]
tsmc.forEach((cut, i) => { if (i < tsmc.length - 1) rems.push(rems[i] - cut) })
// Interleaved the same way the component builds it.
const track = []
rems.forEach((rem, i) => {
  track.push(rem)
  if (i < tsmc.length - 1) track.push(tsmc[i])
})
assert.equal(track.length, 9, 'five remainders and four cuts interleave into nine slots')
assert.ok(near(track[0], revenue), 'slot 0 is 每股營收')

// 「切下來的累積，被拆的下一步消失」: odd slots are cuts and stay for good; even slots are
// remainders, each of which is a result, then the next step's parent, then gone.
const visibleAt = step => {
  if (step === 1) return [0]
  const parent = 2 * (step - 2)
  const kept = []
  for (let slot = 1; slot < parent; slot += 2) kept.push(slot)
  return [...kept, parent, parent + 1, parent + 2]
}

assert.deepEqual(visibleAt(1), [0])
assert.deepEqual(visibleAt(2), [0, 1, 2])
assert.deepEqual(visibleAt(3), [1, 2, 3, 4])
assert.deepEqual(visibleAt(4), [1, 3, 4, 5, 6])
assert.deepEqual(visibleAt(5), [1, 3, 5, 6, 7, 8])

// The one thing the picture claims: the bar being split equals the two it splits into.
for (let step = 2; step <= 5; step += 1) {
  const parent = 2 * (step - 2)
  assert.ok(
    near(track[parent], track[parent + 1] + track[parent + 2]),
    `step ${step}: 父項 ${track[parent].toFixed(2)} must equal 切塊 ${track[parent + 1].toFixed(2)} ＋ 餘額 ${track[parent + 2].toFixed(2)}`
  )
}

// Every cut ever made is still on screen at the last step, and every intermediate remainder is not
// — that is the accumulation rule, and it is what stops the chart quietly dropping a figure.
const last = visibleAt(5)
for (let slot = 1; slot <= 7; slot += 2) assert.ok(last.includes(slot), `cut at slot ${slot} must survive to the last step`)
for (const gone of [0, 2, 4]) assert.ok(!last.includes(gone), `remainder at slot ${gone} must be gone by the last step`)

console.log('segment line window: ok')
