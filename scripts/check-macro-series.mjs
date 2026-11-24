// 總經參考序列頁的資料整理（shared/utils/macro-series.ts）：政策利率換成每月、M2 組成加起來等於 M2、CPI 分項的層級
// Run: node scripts/check-macro-series.mjs
import assert from 'node:assert/strict'
import { cpiTree, m2Composition, policyRateMonths } from '../shared/utils/macro-series.ts'

// 重貼現率是當月底適用的那一個：月中調整的那個月算新利率；拆款利率沒有的月份是 null；畫到兩者較晚的那個月
const months = policyRateMonths(
  [{ effectiveDate: '2024-03-22', discountRate: 2 }, { effectiveDate: '2023-12-20', discountRate: 1.875 }],
  [{ yearMonth: '2024-01', ratePct: 0.7 }, { yearMonth: '2024-04', ratePct: 0.8 }]
)
assert.deepEqual(months.map(point => `${point.period} ${point.values.discountRate} ${point.values.callLoanRate}`), [
  '2023-12 1.875 null', '2024-01 1.875 0.7', '2024-02 1.875 null', '2024-03 2 null', '2024-04 2 0.8'
])
// 跨年
assert.equal(policyRateMonths([{ effectiveDate: '2025-11-30', discountRate: 1 }], [{ yearMonth: '2026-02', ratePct: 0.5 }]).map(point => point.period).join(','), '2025-11,2025-12,2026-01,2026-02')
assert.deepEqual(policyRateMonths([], []), [])

// M2 組成：2026-09 的真數字（百萬元），六層加起來等於 M2，單位換成億元
const at = (yearMonth, amountMillionNtd) => ({ yearMonth, amountMillionNtd })
const items = [
  ['m2', 71361845], ['currency_held_by_public', 3575963], ['deposit_money_total', 27488496], ['quasi_money_total', 40297386],
  ['time_and_savings_deposits', 22813117], ['foreign_currency_deposits', 9864365], ['postal_savings_deposits', 7240371]
].map(([category, amount]) => ({ category, entries: [at('2026-09', amount)] }))
const [row] = m2Composition(items)
assert.equal(row.period, '2026-09')
assert.equal(row.values.other_quasi_money, 3795.33)
const sum = Object.values(row.values).reduce((total, value) => total + value, 0)
assert.ok(Math.abs(sum - 713618.45) < 0.01, `六層加起來是 M2（${sum}）`)
// 缺一項就算不出其他準貨幣
assert.equal(m2Composition(items.map(item => (item.category === 'postal_savings_deposits' ? { ...item, entries: [at('2026-09', null)] } : item)))[0].values.other_quasi_money, null)

// CPI 分項：七大類 depth 0，往下一層加一；照主計總處的順序；最新一期取最後一個有年增率的
const entry = (yearMonth, yoyChangePct) => ({ yearMonth, yoyChangePct })
const tree = cpiTree([
  { itemName: '肉類', parentItemName: '食物類', itemOrder: 6, entries: [entry('2026-10', 3.1)] },
  { itemName: '總指數', parentItemName: null, itemOrder: 1, entries: [entry('2026-09', 1.9), entry('2026-10', 2.33)] },
  { itemName: '生鮮家畜', parentItemName: '肉類', itemOrder: 7, entries: [entry('2026-09', 4), entry('2026-10', null)] },
  { itemName: '食物類', parentItemName: '總指數', itemOrder: 2, entries: [entry('2026-10', 2.05)] }
])
assert.deepEqual(tree.map(item => `${item.name}:${item.depth}:${item.yearMonth}:${item.yoyChangePct}`), ['總指數:-1:2026-10:2.33', '食物類:0:2026-10:2.05', '肉類:1:2026-10:3.1', '生鮮家畜:2:2026-09:4'])
console.log('PASS: macro series')
