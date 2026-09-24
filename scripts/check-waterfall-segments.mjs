// One runnable check for the sign-dependent part of StockDividendWaterfallSteps.vue: the bar's
// solid segment is anchored on `to` when a step DEDUCTS and on `from` when it ADDS, and the two
// segments must sum to the larger of the pair. Getting this wrong draws from + 2×|delta|, which is
// invisible on any company that deducts at every step (2330 does) and wrong on 1303/1326/9904,
// whose 業外 is a net gain. Run: node scripts/check-waterfall-segments.mjs
import assert from 'node:assert/strict'

const total = 171.23
const widthOf = v => Math.max(Math.abs(v) / total * 100, 0.8)
const segments = ({ from, delta, to }) => {
  if (delta === null || delta === 0) return { solid: widthOf(to), extra: null, adds: false }
  const adds = delta < 0
  return { solid: widthOf(adds ? from : to), extra: widthOf(delta), adds }
}
const near = (a, b) => Math.abs(a - b) < 1e-9

// Deduction: solid + slice = from（the bar shrinks to `to`）
const cut = segments({ from: 171.23, delta: 61.25, to: 109.98 })
assert.ok(!cut.adds)
assert.ok(near(cut.solid + cut.extra, widthOf(171.23)), 'deduction segments must sum to `from`')

// Addition: solid + slice = to（the bar grows past `from`）— 1303 南亞's 業外 is a net gain
const add = segments({ from: 6.22, delta: -11.29, to: 17.51 })
assert.ok(add.adds)
assert.ok(near(add.solid + add.extra, widthOf(17.51)), 'addition segments must sum to `to`')
// The bug this check exists for: anchoring the solid part on `to` in the adding case
assert.ok(!near(widthOf(17.51) + widthOf(-11.29), widthOf(17.51)), 'anchoring on `to` double-counts the gain')

// First step has no arithmetic at all
assert.equal(segments({ from: null, delta: null, to: total }).extra, null)

console.log('waterfall segments: ok')
