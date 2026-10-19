// The one runnable check for app/utils/holdings-traits.ts: which tags a portfolio gets. Thresholds are inclusive,
// a tag needs ≥50% coverage, market-relative tags wait for the market baseline, nulls never tag. Pure, no network.
//
// Run: node scripts/check-holdings-traits.mjs
import { TAG_RULES, boxCell, traitTags, traitText } from '../app/utils/holdings-traits.ts'

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// 九宮格 9 格：列是規模、欄是風格；grid([[大型 價值, 混合, 成長], [中型…], [小型…]])
const BOX = ['large', 'mid', 'small'].flatMap(row => ['Value', 'Core', 'Growth'].map(column => `${row}${column}Pct`))
const grid = rows => Object.fromEntries(rows.flat().map((value, index) => [BOX[index], value]))
const KEYS = ['peRatio', 'pbRatio', 'dividendYield', 'roe', 'revenueGrowth', 'beta', 'revenueYoyVolatility', 'top3HoldingsPct', 'largeCapPct', ...BOX]
// 值可以寫成 [value, coverage]，給那一項自己的涵蓋率（規模與九宮格的分母不一樣時）
const traits = (values, coverage = '0.900000') => Object.fromEntries(KEYS.map((key) => {
  const value = values[key]
  if (Array.isArray(value)) return [key, { value: value[0], coverage: value[1] }]
  return [key, { value: value ?? null, coverage: value === undefined ? '0.000000' : coverage }]
}))
const tagsOf = (portfolio, market = null, coverage) => traitTags({ asOf: '2026-10-16', portfolio: traits(portfolio, coverage), market: market ? traits(market, '1.000000') : null })

console.log('Beta 的標籤不需要大盤')
assert(same(tagsOf({ beta: '0.750000' }), ['低 Beta']), 'Beta 0.75：低 Beta')
assert(same(tagsOf({ beta: '0.800000' }), ['低 Beta']), 'Beta 剛好 0.8 也算（≤）')
assert(same(tagsOf({ beta: '0.850000' }), []), 'Beta 0.85：沒有標籤')
assert(same(tagsOf({ beta: '1.200000' }), ['高 Beta']), 'Beta 剛好 1.2 是高 Beta（≥）')

console.log('跟大盤比的標籤：大盤還沒有就不貼')
assert(same(tagsOf({ dividendYield: '6.000000' }), []), '殖利率 6%、大盤 null：不貼')
assert(same(tagsOf({ dividendYield: '6.000000' }, { dividendYield: '3.500000' }), ['高殖利率']), '殖利率 6% 對大盤 3.5%（1.71 倍）：高殖利率')
assert(same(tagsOf({ dividendYield: '5.000000' }, { dividendYield: '3.500000' }), []), '殖利率 5% 對大盤 3.5%（1.43 倍）：不貼')
assert(same(tagsOf({ peRatio: '10.000000' }, { peRatio: '15.000000' }), ['低本益比']), '本益比 10 對 15（0.67 倍）：低本益比')
assert(same(tagsOf({ peRatio: '20.000000' }, { peRatio: '15.000000' }), ['高本益比']), '本益比 20 對 15（1.33 倍）：高本益比')
assert(same(tagsOf({ pbRatio: '1.000000' }, { pbRatio: '2.000000' }), ['低股價淨值比']), '股價淨值比 1 對 2：低股價淨值比')
assert(same(tagsOf({ roe: '20.000000' }, { roe: '14.000000' }), ['高 ROE']), 'ROE 20% 對 14%（＋6）：高 ROE')
assert(same(tagsOf({ roe: '18.000000' }, { roe: '14.000000' }), []), 'ROE 18% 對 14%（＋4）：不貼')
assert(same(tagsOf({ revenueGrowth: '25.000000' }, { revenueGrowth: '12.000000' }), ['高成長']), '營收成長 25% 對 12%（＋13）：高成長')
assert(same(tagsOf({ revenueYoyVolatility: '30.000000' }, { revenueYoyVolatility: '15.000000' }), ['景氣循環型']), '營收年增率波動 30 對 15：景氣循環型')

console.log('九宮格與集中度：固定門檻，不必等大盤')
assert(same(tagsOf({ largeCapPct: '50.00' }), ['中小型為主']), '大型股剛好 50% 也算（≤）：中小型為主')
assert(same(tagsOf({ largeCapPct: '50.01' }), []), '大型股 50.01%：不貼')
const newListings = { largeCapPct: ['40.00', '1.0000'], ...Object.fromEntries(Object.entries(grid([['0.00', '100.00', '0.00'], ['0.00', '0.00', '0.00'], ['0.00', '0.00', '0.00']])).map(([key, value]) => [key, [value, '0.4000']])) }
assert(same(tagsOf(newListings), ['中小型為主']), '新上市的小型股占六成、分不出風格：九宮格只剩大型 100%，中小型為主仍照規模（大型 40%）判斷')
assert(same(tagsOf(grid([['10.00', '40.00', '0.00'], ['26.74', '0.00', '0.00'], ['13.26', '10.00', '0.00']])), ['價值型為主']), '價值欄合計剛好 50%（浮點數會算成 49.99999999999999）：價值型為主')
assert(same(tagsOf(grid([['0.00', '20.00', '30.00'], ['0.00', '0.00', '20.00'], ['0.00', '30.00', '0.00']])), ['成長型為主']), '成長欄合計 50%：成長型為主')
assert(same(tagsOf(grid([['0.00', '100.00', '0.00'], ['0.00', '0.00', '0.00'], ['0.00', '0.00', '0.00']])), []), '全在大型混合（像台積電）：沒有規模、風格標籤')
assert(same(tagsOf(grid([['0.00', '0.00', '0.00'], ['0.00', '0.00', '0.00'], ['90.00', '10.00', '0.00']]), null, '0.4000'), []), 'ETF 占六成（九宮格只涵蓋 40%）：小型價值 90% 也不貼')
assert(same(tagsOf({ top3HoldingsPct: '50.00' }), ['持股集中']), '前三大剛好 50% 也算（≥）：持股集中')
assert(same(tagsOf({ top3HoldingsPct: '49.99' }), []), '前三大 49.99%：不貼')
assert(same(tagsOf({ top3HoldingsPct: '0' }, null, '1'), []) && traitText('0', 'pct') === '0.0%', '全是 ETF（前三大 "0"）：不貼，表格寫 0.0% 而不是「－」')

console.log('涵蓋不到一半、沒有值')
assert(same(tagsOf({ beta: '0.500000' }, null, '0.400000'), []), '涵蓋 40%：Beta 0.5 也不貼')
assert(same(tagsOf({ beta: '0.500000' }, null, '0.500000'), ['低 Beta']), '涵蓋剛好 50%：貼')
assert(same(tagsOf({}), []), '全部 null：沒有標籤')
assert(same(tagsOf({ beta: '0.700000', dividendYield: '7.000000', peRatio: '9.000000' }, { dividendYield: '3.000000', peRatio: '15.000000' }), ['低 Beta', '高殖利率', '低本益比']), '多個標籤照規則順序')

console.log('九宮格的格子：整數，底色照整數')
const cell = value => JSON.stringify(boxCell(value))
assert(cell('0.3') === '{"text":"<1%","level":1}' && cell('0') === '{"text":"0%","level":0}' && cell(null) === '{"text":"－","level":0}', '0.3 寫 <1%（淺色）、0 寫 0%（不上色）、null 是「－」')
assert(cell('9.6') === '{"text":"10%","level":2}' && cell('9.4') === '{"text":"9%","level":1}', '9.6 寫 10%、底色跟 10% 一樣；9.4 寫 9%')
assert(cell('24.6') === '{"text":"25%","level":3}' && cell('100.00') === '{"text":"100%","level":3}', '24.6 寫 25%、最深；100 寫 100%')

console.log('寫法與措辭')
assert(traitText('30.804155', 'pct') === '30.8%' && traitText('0.937223', 'ratio') === '0.94' && traitText(null, 'ratio') === '－', '百分比一位小數、倍數兩位、null 是「－」')
const EVALUATIVE = /便宜|昂貴|穩健|優質|安全|推薦|適合|建議|好|差/
assert(TAG_RULES.every(rule => !EVALUATIVE.test(rule.label) && !EVALUATIVE.test(rule.rule)), '標籤與規則沒有評價字眼（只寫高／低與門檻）')

if (failures) {
  console.log(`\n${failures} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過')
