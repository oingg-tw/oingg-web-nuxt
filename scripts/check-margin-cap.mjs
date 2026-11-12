// 利益率圖的縱軸上限（app/utils/margin-cap.ts）：5314 世紀的真資料、控股公司（大多超出）、沒有超出、剛好一半
// Run: node scripts/check-margin-cap.mjs（pnpm selfcheck 會跑）
import assert from 'node:assert/strict'
import { cappedPoint, marginBounds } from '../app/utils/margin-cap.ts'

// 5314 單季近 5 年的營業利益率：8 期 −110%～−523%，其餘 11%～48% → 只截下面
const operating5314 = [-420.22, -522.73, -458.63, -294.31, -191.06, 37.81, -149.51, -219.72, -110.28, 14.65, 48.11, 39.76, 20.4, 46.8, 43.07, 47.88, 44.87, 19.72, 11.48, 13.34]
assert.deepEqual(marginBounds(operating5314), { min: -100 })
assert.deepEqual(cappedPoint(-522.73, { min: -100 }), { value: -100, up: false })
assert.equal(cappedPoint(37.81, { min: -100 }), null)
assert.equal(cappedPoint(-50, null), null)

// 兩邊都超出就兩邊都截（5314 稅後淨利率 2023Q3 +575.37%）
assert.deepEqual(marginBounds([-400, 575, 10, 20, 30]), { min: -100, max: 100 })
assert.deepEqual(cappedPoint(575.37, { min: -100, max: 100 }), { value: 100, up: true })

// 大多數期別都超出（營收很少的控股公司）照實撐開；剛好一半也不截
assert.equal(marginBounds([150, 160, 170, 40]), null)
assert.equal(marginBounds([150, 160, 40, 50]), null)

// 沒有超出、正好 ±100%、沒有值：不截
assert.equal(marginBounds([-100, 100, 50]), null)
assert.equal(marginBounds([]), null)

console.log('PASS: margin cap')
