// The one runnable check for app/utils/holdings-summary.ts — every case below is a way the money
// maths could silently produce a wrong number on the holdings page. Pure, no network.
//
// Run: node scripts/check-holdings-summary.mjs
import { compareWithBenchmark, dayChange, groupByLabel, holdingRowFigures, sectorOfSymbol, summarizeDayChange, summarizeHoldings, weightedDividendYield } from '../app/utils/holdings-summary.ts'
import { holdingsMonthsBefore } from '../app/utils/holdings-format.ts'

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

console.log('\n成本不明的股數')
{
  // 1,000 股、其中 400 股成本不明；成本已知的 600 股均價 50；收盤 60
  const f = holdingRowFigures({ quantity: 1000, costUnknownQuantity: 400, averageCost: '50', price: '60', dividendPerShare: null })
  assert(close(f.marketValue, 60000), '市值算全部 1,000 股（成本不明的也在庫存裡）')
  assert(close(f.cost, 30000) && close(f.pnl, 6000) && close(f.pnlPct, 20), '成本與損益只算成本已知的 600 股：600×(60−50)＝6,000、+20%')
}
{
  const t = summarizeHoldings([
    { quantity: 4000, costUnknownQuantity: 4000, averageCost: null, price: '80', dividendPerShare: null },
    { quantity: 1000, averageCost: '500', price: '600', dividendPerShare: null }
  ])
  assert(close(t.marketValue, 320000 + 600000), '全部成本不明的那一檔照樣進總市值')
  assert(close(t.pnl, 100000) && close(t.pnlPct, 20), '它不進損益、也不進損益 % 的分母（不會被當成成本 0 的暴利）')
  assert(t.costUnknownCount === 1 && t.unpricedCount === 0, '它被計成「有成本不明股數」，不是「沒報價」')
}

console.log('\n含息損益（領過的現金股利，2026-10-23）')
{
  const f = holdingRowFigures({ ...row(1000, '500', '600'), dividendsReceived: '20000.0000' })
  assert(close(f.pnlWithDividends, 120000) && close(f.pnlWithDividendsPct, 24), '損益 100,000 加股利 20,000 → 含息 120,000、+24%')
  assert(close(f.pnl, 100000) && close(f.pnlPct, 20), '不含息的數字不變')
}
{
  const f = holdingRowFigures({ quantity: 1000, costUnknownQuantity: 250, averageCost: '500', price: '600', dividendPerShare: null, dividendsReceived: '20000' })
  assert(close(f.pnlWithDividends, 75000 + 15000), '成本不明 250 股：只算成本已知那 750 股分到的股利（15,000）')
}
{
  const f = holdingRowFigures(row(1000, '500', '600'))
  assert(close(f.pnlWithDividends, f.pnl), '沒有 dividendsReceived（舊版、匯入預覽）當 0')
  const t = summarizeHoldings([{ ...row(1000, '500', '600'), dividendsReceived: '20000' }, { ...row(1000, '100', '0'), dividendsReceived: '5000' }])
  assert(close(t.pnlWithDividends, 120000) && close(t.pnlWithDividendsPct, 24), '加總只算有報價的列，分母同不含息')
}

console.log('\n組合殖利率（市值加權）')
{
  const y = weightedDividendYield([
    { marketValue: 600000, yieldPct: 2 },
    { marketValue: 300000, yieldPct: 8 },
    { marketValue: 100000, yieldPct: null }, // 例如 ETF：交易所沒有公布這個欄位
    { marketValue: null, yieldPct: 5 } // 沒報價：連總市值都不算
  ])
  assert(close(y.value, (600000 * 2 + 300000 * 8) / 900000), '依市值加權：(60萬×2%＋30萬×8%)÷90萬＝4%，不是兩檔的簡單平均 5%')
  assert(close(y.coverage, 0.9), '沒有殖利率的持股不進加權，回報涵蓋 90% 的市值')
  assert(weightedDividendYield([{ marketValue: 1, yieldPct: null }]).value === null, '沒有任何一檔有值時是 null，不是 0')
}

console.log('\n與大盤比較')
{
  // 加權指數：起點前一天 1000、之後 1100、1210（＝+10%、+21%）
  const index = new Map([['2026-03-30', 900], ['2026-03-31', 1000], ['2026-04-01', 1100], ['2026-04-02', 1210]])
  const c = compareWithBenchmark([
    { tradeDate: '2026-04-01', cumulative: '0.050000' },
    { tradeDate: '2026-04-02', cumulative: '0.080000' }
  ], index)
  assert(close(c.benchmark, 0.21), '指數基準＝起點的前一個交易日收盤（1000），不是起點當天（1100 → 會算成 +10%）也不是更早（900）')
  assert(close(c.points[0].benchmark, 0.1) && close(c.points[1].portfolio, 0.08), '逐日對齊：起點當天指數 +10%、持股照 業務中台 給的累積值')
}
{
  const index = new Map([['2026-03-31', 1000], ['2026-04-01', 1100], ['2026-04-02', 1210]])
  const c = compareWithBenchmark([
    { tradeDate: '2026-03-31', cumulative: null },
    { tradeDate: '2026-04-01', cumulative: null },
    { tradeDate: '2026-04-02', cumulative: '0.010000' }
  ], index)
  assert(c.start === '2026-04-02' && c.points.length === 1 && close(c.benchmark, 0.1), '期間中才開始持股：兩條線都從持股第一天起算（指數 1210÷1100），不把之前那段算進指數')
}
{
  const c = compareWithBenchmark([{ tradeDate: '2026-04-01', cumulative: null }], new Map([['2026-03-31', 1000], ['2026-04-01', 1100]]))
  assert(c.start === null && c.benchmark === null && c.points.length === 0, '整段沒有持股：沒有起點、沒有比較')
}

console.log('\n產業占比')
{
  const map = new Map([['2330', '半導體業'], ['1312', '塑膠工業'], ['2454', '半導體業']])
  assert(sectorOfSymbol('2330', map) === '半導體業' && sectorOfSymbol('0056', map) === 'ETF' && sectorOfSymbol('00878', map) === 'ETF', '普通股照目錄的類股；ETF 自成一類')
  assert(sectorOfSymbol('1312A', map) === '塑膠工業', '特別股歸到發行公司的產業（1312A → 1312）')
  assert(sectorOfSymbol('9999', map) === '其他', '目錄裡沒有的歸「其他」')
  const groups = groupByLabel([{ label: '半導體業', value: 300 }, { label: 'ETF', value: 500 }, { label: '半導體業', value: 400 }, { label: '塑膠工業', value: null }])
  assert(groups.length === 2 && groups[0].label === '半導體業' && groups[0].value === 700 && groups[0].count === 2 && groups[1].label === 'ETF', '同產業加總、由大到小；沒有市值的不計入')
}

console.log('\n今日漲跌')
{
  const up = dayChange({ quantity: 1000, price: '110', previousClose: '100' })
  assert(close(up.amount, 10000) && close(up.pct, 10), '1,000 股、100 → 110：+10,000 元、+10%')
  const none = dayChange({ quantity: 1000, price: null, previousClose: '100' })
  assert(none.amount === null && none.pct === null, '今天沒成交（沒有收盤價）：沒有今日漲跌，不是 0')
  const total = summarizeDayChange([
    { quantity: 1000, price: '110', previousClose: '100' },
    { quantity: 2000, price: '45', previousClose: '50' },
    { quantity: 500, price: null, previousClose: '80' }
  ])
  // +10,000 − 10,000 ＝ 0；分母 100,000 + 100,000（沒成交的那檔不算）
  assert(close(total.amount, 0) && close(total.pct, 0) && total.count === 2, '組合：漲跌金額相加、漲跌幅用前一日市值加權，沒有今日漲跌的那檔不算進分母')
  const skewed = summarizeDayChange([{ quantity: 100, price: '20', previousClose: '10' }, { quantity: 1000, price: '99', previousClose: '100' }])
  assert(close(skewed.pct, (1000 - 1000) / (1000 + 100000) * 100), '組合漲跌幅是加權，不是各檔漲跌幅的平均（+100% 與 −1% 不等於 +49.5%）')
  const empty = summarizeDayChange([{ quantity: 100, price: null, previousClose: null }])
  assert(empty.amount === null && empty.pct === null && empty.count === 0, '一檔都沒有今日漲跌：整個是 null')
  // 晚上：上櫃已經是今天（10-15），上市還停在昨天（10-14）——不能加在一起標成 10-15
  const mixed = summarizeDayChange([
    { quantity: 1000, price: '110', previousClose: '100', date: '2026-10-15' },
    { quantity: 1000, price: '90', previousClose: '100', date: '2026-10-14' }
  ], '2026-10-15')
  assert(close(mixed.amount, 10000) && close(mixed.pct, 10) && mixed.count === 1 && mixed.staleCount === 1, '只加總指定那一天的；停在前一天的那檔不算進去、算在 staleCount')
}

console.log('\n期間：往前推幾個月（holdings-format.ts，預設期間與選單的「近一年」共用）')
{
  assert(holdingsMonthsBefore('2026-10-19', 12) === '2025-10-19', '一般日期往前 12 個月')
  assert(holdingsMonthsBefore('2026-05-31', 3) === '2026-02-28', '月底對不上：落在那個月的最後一天')
  assert(holdingsMonthsBefore('2028-02-29', 12) === '2027-02-28', '閏日往前一年是 2 月 28 日（原本預設用「年份減一」會變成 3 月 1 日，選單就不是「近一年」）')
  assert(holdingsMonthsBefore('2026-01-15', 3) === '2025-10-15', '跨年')
}

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASS')
process.exitCode = failures ? 1 : 0
