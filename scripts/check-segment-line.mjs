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

// 「讓被拆解的項目成為核心。那些已經被拆解的上一步驟的，就讓它滑出圖表外就好」（2026-09-25，使用者
// 推翻了自己前一輪的累積模型）. So the window does NOT accumulate: each step shows exactly the bar
// being split plus the two it splits into, and everything already split has left the frame.
// A sixth「自動重播後留下五塊」step was asked for and withdrawn the same day（「第六步先不要做。前面
// 五步驟都搞不定了」）, so five steps is the whole model — if a sixth comes back, its own claim
// （the five cuts sum to 每股營收）is `sum(tsmc) === revenue`, already asserted above.
const visibleAt = step => {
  if (step === 1) return [0]
  const parent = 2 * (step - 2)
  return [parent, parent + 1, parent + 2]
}

assert.deepEqual(visibleAt(1), [0])
assert.deepEqual(visibleAt(2), [0, 1, 2])
assert.deepEqual(visibleAt(3), [2, 3, 4])
assert.deepEqual(visibleAt(4), [4, 5, 6])
assert.deepEqual(visibleAt(5), [6, 7, 8])
assert.equal(visibleAt(5)[2], track.length - 1, 'the last step must end on the last slot — 每股股利')

// Each step makes exactly one claim: the bar being split equals the two it splits into.
for (let step = 2; step <= 5; step += 1) {
  const [parent, cut, rest] = visibleAt(step)
  assert.ok(
    near(track[parent], track[cut] + track[rest]),
    `step ${step}: 父項 ${track[parent].toFixed(2)} must equal 切塊 ${track[cut].toFixed(2)} ＋ 餘額 ${track[rest].toFixed(2)}`
  )
}

// Each step's parent is the previous step's remainder — that is what makes the five frames one
// continuous walk rather than five unrelated pictures, now that nothing stays on screen to show it.
for (let step = 3; step <= 5; step += 1) {
  assert.equal(visibleAt(step)[0], visibleAt(step - 1)[2], `step ${step} must reopen step ${step - 1}'s remainder`)
}

console.log('segment line window: ok')
