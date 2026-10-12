// 股價斷點偵測的自我檢查（shared/utils/price-breaks.ts）。樣本取自 5314 的真實收盤（2026-10-12）。
//   node scripts/check-price-breaks.mjs
import assert from 'node:assert/strict'
import { priceBreakMonths } from '../shared/utils/price-breaks.ts'

const day = (tradeDate, close) => ({ tradeDate, close })
const warmup = ['2022-11-14', '2022-11-15', '2022-11-16', '2022-11-17', '2022-11-18', '2022-11-21', '2022-11-22'].map(d => day(d, 4.7))
const series = [
  ...warmup,
  day('2022-11-23', 4.78), day('2022-12-02', 19.9), // 減資後復牌
  day('2022-12-05', 20.5), // 一般漲幅 3%
  day('2025-03-19', 1390), day('2025-03-31', 75.8), // 面額 10 → 0.5
  day('2025-04-01', 83.3), // 漲停 9.9%：不是斷點
  day('2026-08-13', 61.3), day('2026-08-14', 16.2) // 除權
]
// 2022-12-05→2025-03-19 這一段樣本省略了中間的日子，會被判成跳動；只驗這個月份清單裡有三個真的斷點、沒有漲停那一天
const months = priceBreakMonths(series)
for (const m of ['2022-12', '2025-03', '2026-08']) assert.ok(months.includes(m), m)
assert.ok(!months.includes('2025-04'), '漲停不是斷點')
// 上市頭 5 天沒有漲跌幅限制，不判
assert.deepEqual(priceBreakMonths([day('2024-01-02', 10), day('2024-01-03', 20), day('2024-01-04', 30)]), [])
console.log('price breaks: ok')
