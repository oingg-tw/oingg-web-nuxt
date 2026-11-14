// 利益率圖的縱軸上限（app/utils/margin-cap.ts）：5314 世紀的真資料、控股公司（大多超出）、沒有超出、剛好一半
// Run: node scripts/check-margin-cap.mjs（pnpm selfcheck 會跑）
import assert from 'node:assert/strict'
import { cappedPoint, fenceBounds, marginBounds } from '../app/utils/margin-cap.ts'

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

// 杜邦圖的左軸看多數期別（fenceBounds）：3708 近四季 ROE 與稅後淨利率近 5 年，稅後淨利率 +379%／−487%／−157%／−175% 四期離群
// → 左軸 −10～50，ROE 的 38.83% 在裡面，離群的畫在邊上
const roe3708 = [3.47, 3.5, 4.6, 15.48, 14.95, 13.72, 22.27, 20.13, 17.95, 18.13, 9.35, 2.54, 3.59, 3.21, 1.8, 1.63, 38.83, 32.37, 25.96, 20.21]
const npm3708 = [2.04, 1.92, 2.63, 9.04, 9.82, 10.16, 18.55, 18.68, 17.57, 18.45, 9.97, 3.21, 4.72, 4.35, 2.67, 3.43, 378.96, -486.91, -156.68, -175.16]
assert.deepEqual(fenceBounds([...roe3708, ...npm3708]), { min: -10, max: 50 })
assert.equal(cappedPoint(38.83, { min: -10, max: 50 }), null)
assert.deepEqual(cappedPoint(-486.91, { min: -10, max: 50 }), { value: -10, up: false })
// 只看近 1 年：一半是極端值，沒有「多數期別」，照實撐開
assert.equal(fenceBounds([...roe3708.slice(-4), ...npm3708.slice(-4)]), null)
// 2330：沒有離群值，不截；太少期別也不截
const roe2330 = [29.75, 31.44, 34.5, 37.6, 40.14, 37.6, 33.42, 29.27, 26.17, 25.64, 26.49, 28.46, 30.61, 32.3, 34.4, 35.39, 36.01, 37.89, 40.94, 42.84]
const npm2330 = [37.61, 38.47, 40.62, 42.73, 44.92, 44.75, 43.33, 41.42, 38.75, 38.12, 37.81, 39.08, 40.51, 41.64, 42.86, 43.63, 45.03, 46.97, 50.37, 51.54]
assert.equal(fenceBounds([...roe2330, ...npm2330]), null)
assert.equal(fenceBounds([1, 500, 2]), null)

console.log('PASS: margin cap')
