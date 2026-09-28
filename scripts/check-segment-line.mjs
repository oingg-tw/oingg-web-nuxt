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

// 每一步把母項拉滿高度（2026-09-28「當公司的毛利是低的時候，後面第三四五步驟都變成超扁的一條線，這個
// 能讓他下一步的時候長高再切嗎？」）。--size 的分母從 每股營收 換成**那一步的母項**，所以三條的高度
// 在任何毛利率下都是 100% / cut% / rest%，而且 cut ＋ rest 必定回到 100%。
//
// 2317 是這個改動的理由，數字取自頁面（114 年度）。用營收當分母時第三步最矮的一條只有 2.95%。
const hon = { revenue: 582.42, cuts: [546.61, 17.18, 5.02, 6.44, 7.17] }
assert.ok(near(sum(hon.cuts), hon.revenue), '2317 的五塊也必須恰好加回每股營收')
const honRems = [hon.revenue]
hon.cuts.forEach((cut, i) => { if (i < hon.cuts.length - 1) honRems.push(honRems[i] - cut) })
const honTrack = []
honRems.forEach((rem, i) => { honTrack.push(rem); if (i < hon.cuts.length - 1) honTrack.push(hon.cuts[i]) })

// 元件裡的 sizeOf：0.8% 是地板，讓極小的一塊仍然畫得出來。
const sizeOf = (value, denom) => Math.max((value / denom) * 100, 0.8)
let worstParent = 100
let worstRevenue = 100
for (let step = 2; step <= 5; step += 1) {
  const [parent, cut, rest] = visibleAt(step)
  const denom = honTrack[parent]
  assert.ok(near(sizeOf(denom, denom), 100), `step ${step}: 母項必須滿高`)
  assert.ok(
    near(sizeOf(honTrack[cut], denom) + sizeOf(honTrack[rest], denom), 100),
    `step ${step}: 切塊與餘額的高度必須加回 100%`
  )
  // 第二步不算進來：那一步的母項本來就是 每股營收，毛利 6.15% 矮就是 2317 真的毛利率 6.15%，兩個分母
  // 給出同一個高度。使用者報的是「第三四五步驟」，改動也只在那裡有差別。
  if (step >= 3) {
    for (const slot of [cut, rest]) {
      worstParent = Math.min(worstParent, sizeOf(honTrack[slot], denom))
      worstRevenue = Math.min(worstRevenue, sizeOf(honTrack[slot], hon.revenue))
    }
  }
}
// 這兩個數字就是這個改動的全部內容：第三步之後，舊分母下 2317 最矮的一條不到 3%（貼在地上），新分母下超過 25%。
assert.ok(worstRevenue < 5, `舊分母（每股營收）下 2317 第三步之後最矮的一條應該 < 5%，量到 ${worstRevenue.toFixed(2)}%`)
assert.ok(worstParent > 25, `新分母（當步母項）下第三步之後最矮的一條應該 > 25%，量到 ${worstParent.toFixed(2)}%`)

console.log(`segment line per-step scale: ok（2317 第三步之後最矮的一條 ${worstRevenue.toFixed(2)}% → ${worstParent.toFixed(2)}%）`)
