// The one runnable check for app/utils/holdings-summary.ts — every case below is a way the money
// maths could silently produce a wrong number on the holdings page. Pure, no network.
//
// Run: node scripts/check-holdings-summary.mjs
import { holdingRowFigures, summarizeHoldings } from '../app/utils/holdings-summary.ts'

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const close = (a, b) => a !== null && Math.abs(a - b) < 1e-9

const row = (quantity, averageCost, price, dividendPerShare = null) => ({ quantity, averageCost, price, dividendPerShare })

console.log('單一列')
{
  const f = holdingRowFigures(row(1000, '500.0000', '600'))
  assert(close(f.marketValue, 600000), '1,000 股 × 600 = 市值 600,000')
  assert(close(f.pnl, 100000), '損益 = 市值 − 成本 = 100,000')
  assert(close(f.pnlPct, 20), '報酬率 +20%')
}
{
  const f = holdingRowFigures(row(1000, '500', '450'))
  assert(close(f.pnl, -50000) && close(f.pnlPct, -10), '虧損列是負的（−50,000、−10%）')
}
{
  const f = holdingRowFigures(row(1000, '500', '0'))
  assert(f.marketValue === null && f.pnl === null, '價格 "0" 當成沒有報價，不算出市值 0、虧損 100%')
}
{
  const f = holdingRowFigures(row(1000, '0', '600'))
  assert(close(f.marketValue, 600000) && f.pnlPct === null, '成本 0（配股取得）時報酬率是 null，不是無限大')
}
{
  assert(holdingRowFigures(row(1000, '500', '')).marketValue === null, '空字串價格解析成 null')
  assert(holdingRowFigures(row(1000, '500', 'abc')).marketValue === null, '非數字字串解析成 null')
}

console.log('\n加總')
{
  const t = summarizeHoldings([
    row(1000, '500', '600', '22'),  // 有報價、有股利
    row(2000, '50', null, '1.35')   // 沒報價、有股利
  ])
  assert(close(t.marketValue, 600000), '沒報價的列不進總市值')
  assert(close(t.pnlPct, 20), '報酬率的分母只用有報價那些列的成本（全部成本會壓成 16.7%）')
  assert(t.unpricedCount === 1, '沒報價的列被計數')
  assert(close(t.annualDividend, 1000 * 22 + 2000 * 1.35), '沒報價的列仍然算進預估股利（暫停交易照樣配息）')
}
{
  const t = summarizeHoldings([row(1000, '500', '600', null), row(100, '30', '40', '2')])
  assert(close(t.annualDividend, 200) && t.dividendMissingCount === 1, '沒有股利資料的列不進股利、而且被計數')
}
{
  const t = summarizeHoldings([])
  assert(t.marketValue === null && t.pnl === null && t.pnlPct === null && t.annualDividend === null, '沒有持股時總計是 null，不是 0')
}
{
  const t = summarizeHoldings([row(1000, '500', null), row(10, '5', '0')])
  assert(t.marketValue === null && t.pnl === null && t.unpricedCount === 2, '全部沒報價時總市值與損益是 null')
}

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASS')
process.exitCode = failures ? 1 : 0
