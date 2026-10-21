// 年增率對數刻度（app/utils/growth-log-scale.ts，2026-10-21 月營收年增率方案 A）的自我檢查：兩家真的形狀各一組，加上邊界。
// Run: node scripts/check-growth-log-scale.mjs（pnpm selfcheck 會跑）
import assert from 'node:assert/strict'
import { GROWTH_LOG_FLOOR, growthLogLabel, growthLogTicks, growthLogValue } from '../app/utils/growth-log-scale.ts'

const labels = changes => growthLogTicks(changes).map(growthLogLabel)

// 5314 世紀近 5 年：3 個月營收 0（−100%）、最高 +49,674.73% → 10 倍一格
assert.deepEqual(labels([-100, -99.06, -50, 168, 797, 49674.73]), ['-99%', '-90%', '0%', '+900%', '+9,900%', '+99,900%'])
// 2330 台積電近 5 年：−15.4%～+67.9% → 常見倍數
assert.deepEqual(labels([-15.4, 67.9]), ['-20%', '0%', '+25%', '+50%', '+100%'])
// 全部持平也有一段軸
assert.deepEqual(labels([0]), ['-20%', '0%', '+25%'])
// 一到兩個 10 倍：1、2、5 倍。5314 營收成長年增率近 3 年（−10%～+2,000%）原本用細刻度又拉到 ×100，底下的字疊在一起
assert.deepEqual(labels([-10, 2000]), ['-50%', '0%', '+100%', '+400%', '+900%', '+1,900%', '+4,900%'])
// 只有成長、沒有衰退：0% 一定在
assert.deepEqual(labels([300]), ['-50%', '0%', '+100%', '+400%'])
// 窄的負成長（−60%～+10%）也包得住
assert.deepEqual(labels([-60, 10]), ['-80%', '-50%', '-33%', '-20%', '0%', '+25%'])
// 刻度不會擠：最多 8 個
for (const changes of [[-100, 49674.73], [-10, 2000], [-15.4, 67.9], [-60, 10], [-99, 9999]]) assert.ok(growthLogTicks(changes).length <= 8, `${changes} 的刻度數`)
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
console.log('PASS: growth log scale')
