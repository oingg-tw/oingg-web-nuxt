// 年增率對數刻度（app/utils/growth-log-scale.ts，2026-10-21 月營收年增率方案 A）的自我檢查：兩家真的形狀各一組，加上邊界。
// Run: node scripts/check-growth-log-scale.mjs（pnpm selfcheck 會跑）
import assert from 'node:assert/strict'
import { GROWTH_LOG_FLOOR, growthLogAxis, growthLogCap, growthLogLabel, growthLogTicks, growthLogValue } from '../app/utils/growth-log-scale.ts'

const labels = changes => growthLogTicks(changes).map(growthLogLabel)

// 5314 世紀近 5 年：3 個月營收 0（−100%）、最高 +49,674.73% → 10 倍一格
assert.deepEqual(labels([-100, -99.06, -50, 168, 797, 49674.73]), ['−99%', '−90%', '0%', '+900%', '+9,900%', '+99,900%'])
// 2330 台積電近 5 年：−15.4%～+67.9% → 常見倍數
assert.deepEqual(labels([-15.4, 67.9]), ['−20%', '0%', '+25%', '+50%', '+100%'])
// 全部持平也有一段軸
assert.deepEqual(labels([0]), ['−20%', '0%', '+25%'])
// 一到兩個 10 倍：1、2、5 倍。5314 營收成長年增率近 3 年（−10%～+2,000%）原本用細刻度又拉到 ×100，底下的字疊在一起
assert.deepEqual(labels([-10, 2000]), ['−50%', '0%', '+100%', '+400%', '+900%', '+1,900%', '+4,900%'])
// 只有成長、沒有衰退：0% 一定在
assert.deepEqual(labels([300]), ['−50%', '0%', '+100%', '+400%'])
// 窄的負成長（−60%～+10%）也包得住
assert.deepEqual(labels([-60, 10]), ['−67%', '−50%', '−33%', '−20%', '0%', '+25%'])
// 6170 近 5 年（−54.83%～+57.32%）：軸底停在 −67%，不是 −80%（2026-11-26，−50% 的下一格原本是 −80%，軸底空了三成五）
assert.deepEqual(labels([-54.83, 57.32]), ['−67%', '−50%', '−33%', '−20%', '0%', '+25%', '+50%', '+100%'])
// 上面同理：剛過 +100% 停在 +200%，不是 +400%
assert.deepEqual(labels([-10, 110]), ['−20%', '0%', '+25%', '+50%', '+100%', '+200%'])
// 刻度不會擠：最多 8 個（細刻度的範圍最多 0.6 個 10 倍，剛好跨過兩端的刻度時最多）
for (const changes of [[-100, 49674.73], [-10, 2000], [-15.4, 67.9], [-60, 10], [-99, 9999], [-51, 95], [-34, 160], [-21, 215], [-70, 45]]) assert.ok(growthLogTicks(changes).length <= 8, `${changes} 的刻度數`)
// 營收 0 畫在最底；更小的倍數不會穿出軸外
assert.equal(growthLogValue(-100), GROWTH_LOG_FLOOR)
assert.equal(growthLogValue(-99.999), GROWTH_LOG_FLOOR)
// 翻倍與腰斬一樣高、方向相反
assert.ok(Math.abs(growthLogValue(100) + growthLogValue(-50)) < 1e-12)
// 刻度包住所有柱子
for (const changes of [[-100, 49674.73], [-15.4, 67.9], [-60, 30], [5, 900]]) {
  const ticks = growthLogTicks(changes)
  for (const change of changes) assert.ok(growthLogValue(change) >= ticks[0] - 1e-9 && growthLogValue(change) <= ticks.at(-1) + 1e-9, `${change} 在軸內`)
}
// ---- 離多數期別太遠的不決定軸（growthLogAxis），畫到邊上加箭頭（growthLogCap）----
const axisLabels = changes => growthLogAxis(changes).axisLabel.customValues.map(growthLogLabel)
// 8462 柏文近 5 年的月營收年增率（真資料）：2021-06 停業，隔年同月 +42,329%，其餘多在 8%～35%。原本的軸是 −90%～+99,900%，
// 一般月份只有 1% 高；現在軸照其餘期別定，2022-06～08 三期畫到頂
const yoy8462 = [-2.01, -5.68, -2.16, 1.48, -1.42, -9.17, 74.81, 42329.38, 440.94, 181.21, 78.21, 25.29, -1.37, 3.94, -4.79, 15.09, 6.05, 16.98, 33.78, 31.9, 27.66, 20, 23.44, 22.46, 21.9, 18.59, 35.22, 12.36, 14.99, 19.9, 19.92, 20.12, 18.93, 16.96, 19.24, 17.78, 18.46, 19.6, 10.2, 28.45, 17.79, 16.68, 13.65, 16.43, 18.66, 17.59, 20.46, 21.59, 18.17, 21.76, 30.55, 8.5, 21.92, 20.72, 20.06, 20.11, 18.28, 16.75, 16.17, 15.08]
assert.deepEqual(labels(yoy8462), ['−90%', '0%', '+900%', '+9,900%', '+99,900%'])
assert.deepEqual(axisLabels(yoy8462), ['−20%', '0%', '+25%', '+50%', '+100%'])
const axis8462 = growthLogAxis(yoy8462)
assert.deepEqual(yoy8462.filter(change => growthLogCap(change, axis8462)), [42329.38, 440.94, 181.21])
assert.deepEqual(growthLogCap(42329.38, axis8462), { value: axis8462.max, up: true })
// +78.21%、−9.17% 在軸裡，照畫
assert.equal(growthLogCap(78.21, axis8462), null)
assert.equal(growthLogCap(-9.17, axis8462), null)
// 往下也一樣：停業那幾個月（−99.78%）在多數月份 ±30% 的那一段裡畫到底
const axisDown = growthLogAxis([-99.78, -83.32, 12, 15, 18, 20, 22, 25, 28, 30, 16, 19])
assert.deepEqual(growthLogCap(-99.78, axisDown), { value: axisDown.min, up: false })
assert.equal(growthLogCap(12, axisDown), null)
// 5314 世紀近 5 年（真資料）：月月大起大落，沒有哪一期離多數期別特別遠，照舊整段畫（這套刻度當初就是為它選的）
const yoy5314 = [-60.46, -48.14, -64.11, -26.71, -96.7, -98.2, -93.36, -65.37, 7.27, 48.52, -99.06, -82.95, 14.51, 622.18, -85.34, -59.59, 21933.96, 93.87, 4318.75, -100, -100, 45.21, 12857.14, -100, 393.86, 38.15, 6066.66, 4098.18, 334.14, 49674.73, 1274.63, 4229.31, 1699.88, 943.64, 957.38, 1684.32, 396.55, 154.95, 183.5, 148.67, 213.28, 368.42, 422.69, 561.8, 796.78, 811.59, 1056.3, 411.78, 384.77, 227.05, 265.4, 136.75, 132.51, 138.62, 157.45, 167.87, 149.63, 102.52, 45.71, 50.72]
assert.deepEqual(axisLabels(yoy5314), labels(yoy5314))
assert.ok(yoy5314.every(change => growthLogCap(change, growthLogAxis(yoy5314)) === null))
// 很穩定的公司：四分位距很小，+35% 不算破表（要離四分位數 2 倍以上才算），軸把它包進去
const steady = [16, 17, 18, 19, 20, 21, 18, 19, 35]
assert.deepEqual(axisLabels(steady), ['−20%', '0%', '+25%', '+50%'])
assert.equal(growthLogCap(35, growthLogAxis(steady)), null)
// 期別太少（不到 4 期）不談離群；剛好在軸頂的不算超出；沒有這種刻度的軸（空物件）不截
assert.deepEqual(axisLabels([5, 10, 5000]), labels([5, 10, 5000]))
assert.equal(growthLogCap(100, growthLogAxis([-10, 100])), null)
assert.equal(growthLogCap(5000, {}), null)

console.log('PASS: growth log scale')
