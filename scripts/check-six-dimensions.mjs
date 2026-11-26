// 六面向（app/utils/six-dimensions.ts）：固定的軸序、雷達圖的座標（缺值的軸不連線）、答句。
// Run: node scripts/check-six-dimensions.mjs（pnpm selfcheck 會跑）
import assert from 'node:assert/strict'
import { SIX_DIMENSIONS, percentileLabel, percentileText, radarGeometry, sixDimensionAxes, sixDimensionNullText, sixDimensionsAnswer, sixDimensionsAriaLabel } from '../app/utils/six-dimensions.ts'

const axis = (metricCode, value, nullReason = null) => ({ metricCode, value, nullReason, components: [] })
// 上游的順序亂掉、多給一支、少給一支：照固定的六個軸排，沒有的當沒有值
const axes = sixDimensionAxes({ axes: [axis('valuePercentile', 22.7), axis('growthMomentumPercentile', 82.4), axis('somethingElse', 50), axis('priceTrendPercentile', 91.3), axis('fundamentalImprovementPercentile', null, 'missing_input'), axis('financialSafetyPercentile', 73.5)] })
assert.deepEqual(axes.map(item => [item.label, item.value, item.nullReason]), [['成長動能', 82.4, null], ['價格趨勢', 91.3, null], ['體質改善', null, 'missing_input'], ['價值', 22.7, null], ['財務安全', 73.5, null], ['股東回饋', null, null]])
assert.deepEqual(sixDimensionAxes(null).map(item => item.value), [null, null, null, null, null, null])
assert.equal(SIX_DIMENSIONS.length, 6)
// 不列進篩選器的那份名單（replaced-metrics.ts，使用者 2026-11-27「不要列進篩選器」）跟這裡是同樣六支
const { SIX_DIMENSION_METRICS } = await import('../app/utils/replaced-metrics.ts')
assert.deepEqual(SIX_DIMENSIONS.map(item => item.code), SIX_DIMENSION_METRICS)

// 表格兩位、圖上整數；不是數字的當沒有
assert.equal(percentileText(82.4), '82.40')
assert.equal(percentileText(null), '－')
assert.equal(percentileText(Number.NaN), '－')
assert.equal(percentileLabel(91.3), '91')
assert.equal(percentileLabel(null), '無法計算')

// 算不出來的原因：產業不適用與不到一半有值分開寫；不認得的不猜
assert.equal(sixDimensionNullText('not_applicable_industry'), '組成指標不適用於這個產業')
assert.equal(sixDimensionNullText('missing_input'), '組成指標不到一半有值')
assert.equal(sixDimensionNullText('something_new'), '')
assert.equal(sixDimensionNullText(null), '')

// 座標：第一個軸正上方、順時針；100 落在最外圈、0 落在中心
const full = radarGeometry([100, 100, 100, 100, 100, 100], 100)
assert.deepEqual(full.spokes, [[0, -100], [86.6, -50], [86.6, 50], [0, 100], [-86.6, 50], [-86.6, -50]])
assert.deepEqual(full.dots, full.spokes)
assert.equal(full.rings.find(ring => ring.percent === 100).points, '0,-100 86.6,-50 86.6,50 0,100 -86.6,50 -86.6,-50')
assert.equal(full.rings.find(ring => ring.percent === 50).points, '0,-50 43.3,-25 43.3,25 0,50 -43.3,25 -43.3,-25')
assert.equal(full.line.split('M').length - 1, 6, '六個軸都有值：六段連成一圈')
assert.deepEqual(radarGeometry([0, 50, 100, 0, 0, 0], 100).dots.slice(0, 3), [[0, 0], [43.3, -25], [86.6, 50]])
// 超出 0～100 的值不會畫到圖外
assert.deepEqual(radarGeometry([140, -5, 0, 0, 0, 0], 100).dots.slice(0, 2), [[0, -100], [0, 0]])
// 缺一個軸：它兩邊的線與填色都不畫（少兩段），那一點沒有；其餘照畫
const missing = radarGeometry([82.4, 91.3, 64.1, null, 73.5, 38.2], 110)
assert.equal(missing.dots[3], null)
assert.equal(missing.line.split('M').length - 1, 4)
assert.equal(missing.fill.split('M').length - 1, 4)
assert.ok(!missing.line.includes('NaN') && !missing.fill.includes('null'))
// 兩邊都缺的那一點只剩一個點，不連線；全部都缺什麼都不畫
const lone = radarGeometry([50, null, null, null, null, null], 100)
assert.deepEqual([lone.dots[0], lone.line, lone.fill], [[0, -50], '', ''])
assert.deepEqual(radarGeometry([null, null, null, null, null, null], 100).dots, [null, null, null, null, null, null])

// 答句：最高與最低；算不出來的說出來；至多 80 字（卡片之前的文字，全站規則）
const sample = [['成長動能', 82.4], ['價格趨勢', 91.3], ['體質改善', 64.1], ['價值', 22.7], ['財務安全', 73.5], ['股東回饋', 38.2]].map(([label, value]) => ({ label, value }))
assert.equal(sixDimensionsAnswer(sample, '2026-11-26'), '六個面向裡，價格趨勢的百分位 91，最高；價值的百分位 23，最低。資料日期 2026-11-26。')
// 金融股那種缺兩個角的
const financial = sample.map(item => (['體質改善', '財務安全'].includes(item.label) ? { ...item, value: null } : item))
const financialAnswer = sixDimensionsAnswer(financial, '2026-11-26')
assert.equal(financialAnswer, '六個面向裡，價格趨勢的百分位 91，最高；價值的百分位 23，最低。體質改善、財務安全算不出來。資料日期 2026-11-26。')
// 最長的情況（缺三個、名稱最長）也在 80 字以內
const worst = sixDimensionsAnswer(sample.map(item => (['成長動能', '體質改善', '財務安全'].includes(item.label) ? { ...item, value: null } : item)), '2026-11-26')
assert.ok([...worst].length <= 80, `${[...worst].length} 字：${worst}`)
assert.ok([...financialAnswer].length <= 80)
// 只有一個、全部一樣、一個都沒有
assert.equal(sixDimensionsAnswer(sample.map((item, index) => ({ ...item, value: index === 1 ? 91.3 : null })), '2026-11-26'), '六個面向裡只有價格趨勢算得出來，百分位 91。資料日期 2026-11-26。')
assert.equal(sixDimensionsAnswer(sample.map(item => ({ ...item, value: 50 })), null), '六個面向的百分位都是 50。')
assert.equal(sixDimensionsAnswer(sample.map(item => ({ ...item, value: null })), '2026-11-26'), null)
// 同分時最高取前面的軸、最低也取前面的，不會同一個
assert.equal(sixDimensionsAnswer([{ label: '成長動能', value: 80 }, { label: '價格趨勢', value: 80 }, { label: '價值', value: 20 }, { label: '財務安全', value: 20 }], null), '六個面向裡，成長動能的百分位 80，最高；價值的百分位 20，最低。')

assert.equal(sixDimensionsAriaLabel('範例', financial), '範例六面向雷達圖：成長動能 82、價格趨勢 91、體質改善 無法計算、價值 23、財務安全 無法計算、股東回饋 38')

console.log('PASS: six dimensions')
