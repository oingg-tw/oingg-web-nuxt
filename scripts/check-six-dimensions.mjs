// 六面向（app/utils/six-dimensions.ts）：固定的軸序、雷達圖的座標（缺值的軸不連線）、答句。
// Run: node scripts/check-six-dimensions.mjs（pnpm selfcheck 會跑）
import assert from 'node:assert/strict'
import { SIX_DIMENSIONS, percentileLabel, percentileText, radarGeometry, radarSlot, sixDimensionAxes, sixDimensionChartAxes, sixDimensionMissingLabel, sixDimensionNullText, sixDimensionScopeNote, sixDimensionScopeText, sixDimensionsAnswer, sixDimensionsAriaLabel } from '../app/utils/six-dimensions.ts'

const axis = (metricCode, value, nullReason = null) => ({ metricCode, value, nullReason, components: [] })
// 上游的順序亂掉、多給一支、少給一支：照固定的六個軸排，沒有的當沒有值
const axes = sixDimensionAxes({ axes: [axis('valuePercentile', 22.7), axis('growthMomentumPercentile', 82.4), axis('somethingElse', 50), axis('priceTrendPercentile', 91.3), axis('fundamentalImprovementPercentile', null, 'missing_input'), axis('financialSafetyPercentile', 73.5)] })
assert.deepEqual(axes.map(item => [item.label, item.value, item.nullReason]), [['成長動能', 82.4, null], ['價格趨勢', 91.3, null], ['體質改善', null, 'missing_input'], ['價值型', 22.7, null], ['財務安全', 73.5, null], ['股東回饋', null, null]])
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
// 沒有值的面向：不適用的寫「不適用」，其餘（含不認得的原因）寫「無法計算」
assert.equal(percentileLabel(null, 'not_applicable_industry'), '不適用')
assert.equal(percentileLabel(null, 'insufficient_history'), '無法計算')
assert.equal(sixDimensionMissingLabel('not_applicable_industry'), '不適用')
assert.equal(sixDimensionMissingLabel('something_new'), '無法計算')
assert.equal(sixDimensionMissingLabel(null), '無法計算')

// 沒有值的原因：整個面向不適用、不到一半有值、歷史不夠長分開寫；不認得的不猜
assert.equal(sixDimensionNullText('not_applicable_industry'), '依產業或財報格式')
assert.equal(sixDimensionNullText('missing_input'), '組成指標不到一半有值')
assert.equal(sixDimensionNullText('insufficient_history'), '組成指標的歷史資料不夠長')
assert.equal(sixDimensionNullText('something_new'), '')
assert.equal(sixDimensionNullText(null), '')

// 比較對象：價值型的三支跟同產業比，其餘跟全部上市櫃公司比（金融保險業分類比那一套 2026-11-27 同一天上線又拿掉）
const part = scope => ({ fieldId: 'x.Q', order: 'desc', negativeLast: false, scope, value: 1, knowledgeDate: null, percentile: 50, nullReason: null })
const scoped = (label, scope) => ({ label, value: 50, components: [part(scope), part(scope)] })
assert.equal(sixDimensionScopeText(scoped('價值型', 'sector')), '跟同產業比')
assert.equal(sixDimensionScopeText(scoped('成長動能', 'market')), '')
// 沒有組成、比較對象混在一起、不認得的比較對象（舊快取裡的 financialType）都不寫
assert.equal(sixDimensionScopeText({ components: [] }), '')
assert.equal(sixDimensionScopeText({ components: [part('sector'), part('market')] }), '')
assert.equal(sixDimensionScopeText(scoped('財務安全', 'financialType')), '')
// 不適用的面向不列組成（上游還是帶著，但沒有排名）：明細表不畫那幾列，也不寫「跟同產業比」；算不出來的面向組成照列
const withParts = (metricCode, value, nullReason) => ({ metricCode, value, nullReason, components: [part('sector'), part('sector')] })
const applicability = sixDimensionAxes({ axes: [withParts('valuePercentile', null, 'not_applicable_industry'), withParts('fundamentalImprovementPercentile', null, 'insufficient_history'), withParts('growthMomentumPercentile', 82.4, null)] })
assert.deepEqual(applicability.map(item => item.components.length), [2, 0, 2, 0, 0, 0])
assert.equal(sixDimensionScopeText(applicability[3]), '')
assert.equal(sixDimensionScopeNote(applicability), '成長動能、體質改善的指標跟同產業的公司比（同產業不到 5 家的跟全部上市櫃公司比）。其餘跟全部上市櫃公司比。')
const general = [scoped('成長動能', 'market'), scoped('價值型', 'sector'), scoped('財務安全', 'market')]
assert.equal(sixDimensionScopeNote(general), '價值型的指標跟同產業的公司比（同產業不到 5 家的跟全部上市櫃公司比）。其餘跟全部上市櫃公司比。')
assert.equal(sixDimensionScopeNote([scoped('成長動能', 'market')]), '')

// 座標：第一個軸正上方、順時針；100 落在最外圈、0 落在中心
const full = radarGeometry([100, 100, 100, 100, 100, 100], 100)
assert.deepEqual(full.spokes, [[0, -100], [86.6, -50], [86.6, 50], [0, 100], [-86.6, 50], [-86.6, -50]])
assert.deepEqual(full.dots, full.spokes)
assert.equal(full.rings.find(ring => ring.percent === 100).points, '0,-100 86.6,-50 86.6,50 0,100 -86.6,50 -86.6,-50')
assert.equal(full.rings.find(ring => ring.percent === 50).points, '0,-50 43.3,-25 43.3,25 0,50 -43.3,25 -43.3,-25')
assert.equal(full.line.split('M').length - 1, 6, '六個軸都有值：六段連成一圈')
assert.deepEqual(full.box, [-93, -106, 186, 212])
assert.deepEqual(radarGeometry([0, 50, 100, 0, 0, 0], 100).dots.slice(0, 3), [[0, 0], [43.3, -25], [86.6, 50]])
// 超出 0～100 的值不會畫到圖外
assert.deepEqual(radarGeometry([140, -5, 0, 0, 0, 0], 100).dots.slice(0, 2), [[0, -100], [0, 0]])
// 缺一個軸：它兩邊的線與填色都不畫（少兩段），那一點沒有；其餘照畫
const missing = radarGeometry([82.4, 91.3, 64.1, null, 73.5, 38.2], 110)
assert.equal(missing.dots[3], null)
assert.equal(missing.line.split('M').length - 1, 4)
assert.equal(missing.fill.split('M').length - 1, 4)
assert.ok(!missing.line.includes('NaN') && !missing.fill.includes('null'))
// 金融股只畫適用的三個面向（使用者 2026-11-28「雷達圖要是只有三個面向解釋就改成三角形吧」）：三個軸隔 120 度，三段連成一個三角形；
// 圖比六邊形扁（底邊在 50），軸名放上、右下、左下
const financialAxes = [['成長動能', 82.4], ['價格趨勢', 91.3], ['體質改善', null], ['價值型', null], ['財務安全', null], ['股東回饋', 38.2]].map(([label, value]) => ({ label, value, nullReason: value === null ? 'not_applicable_industry' : null }))
const chartAxes = sixDimensionChartAxes(financialAxes)
assert.deepEqual(chartAxes.map(item => item.label), ['成長動能', '價格趨勢', '股東回饋'])
const triangle = radarGeometry(chartAxes.map(item => item.value), 100)
assert.deepEqual(triangle.spokes, [[0, -100], [86.6, 50], [-86.6, 50]])
assert.deepEqual(triangle.box, [-93, -106, 186, 162])
assert.equal(triangle.line.split('M').length - 1, 3)
assert.equal(triangle.fill.split('M').length - 1, 3)
assert.equal(triangle.rings.find(ring => ring.percent === 50).points, '0,-50 43.3,25 -43.3,25')
assert.deepEqual(chartAxes.map((_, k) => radarSlot(k, chartAxes.length)), [0, 2, 4])
assert.deepEqual(SIX_DIMENSIONS.map((_, k) => radarSlot(k, 6)), [0, 1, 2, 3, 4, 5])
// 算不出來的面向照畫（那一個軸不連線）：剛掛牌的金融股還是三角形，一般公司還是六個軸
const newlyListed = sixDimensionChartAxes(financialAxes.map(item => (item.label === '價格趨勢' ? { ...item, value: null, nullReason: 'insufficient_history' } : item)))
assert.deepEqual(newlyListed.map(item => item.label), ['成長動能', '價格趨勢', '股東回饋'])
assert.equal(radarGeometry(newlyListed.map(item => item.value), 100).line.split('M').length - 1, 1)
assert.equal(sixDimensionChartAxes(financialAxes.map(item => ({ ...item, nullReason: item.value === null ? 'missing_input' : null }))).length, 6)
// 適用的不到三個畫不成多邊形：照六個軸畫
assert.equal(sixDimensionChartAxes(financialAxes.map(item => (item.label === '股東回饋' ? { ...item, value: null, nullReason: 'not_applicable_industry' } : item))).length, 6)
// 兩邊都缺的那一點只剩一個點，不連線；全部都缺什麼都不畫
const lone = radarGeometry([50, null, null, null, null, null], 100)
assert.deepEqual([lone.dots[0], lone.line, lone.fill], [[0, -50], '', ''])
assert.deepEqual(radarGeometry([null, null, null, null, null, null], 100).dots, [null, null, null, null, null, null])

// 答句：最高與最低；算不出來的說出來；至多 80 字（卡片之前的文字，全站規則）
const sample = [['成長動能', 82.4], ['價格趨勢', 91.3], ['體質改善', 64.1], ['價值型', 22.7], ['財務安全', 73.5], ['股東回饋', 38.2]].map(([label, value]) => ({ label, value }))
assert.equal(sixDimensionsAnswer(sample, '2026-11-26'), '六個面向裡，價格趨勢的百分位 91，最高；價值型的百分位 23，最低。資料日期 2026-11-26。')
// 金融股：三個面向不適用，跟算不出來的分開說
const financial = sample.map(item => (['體質改善', '價值型', '財務安全'].includes(item.label) ? { ...item, value: null, nullReason: 'not_applicable_industry' } : item))
const financialAnswer = sixDimensionsAnswer(financial, '2026-11-26')
assert.equal(financialAnswer, '六個面向裡，價格趨勢的百分位 91，最高；股東回饋的百分位 38，最低。體質改善、價值型、財務安全不適用。資料日期 2026-11-26。')
// 缺兩個角、原因是算不出來的
const missingTwo = sixDimensionsAnswer(sample.map(item => (['體質改善', '財務安全'].includes(item.label) ? { ...item, value: null, nullReason: 'missing_input' } : item)), '2026-11-26')
assert.equal(missingTwo, '六個面向裡，價格趨勢的百分位 91，最高；價值型的百分位 23，最低。體質改善、財務安全算不出來。資料日期 2026-11-26。')
// 最長的情況也在 80 字以內：缺三個、名稱最長；剛掛牌的金融股（三個不適用，再一個算不出來，數字都是三位）
const worst = sixDimensionsAnswer(sample.map(item => (['成長動能', '體質改善', '財務安全'].includes(item.label) ? { ...item, value: null } : item)), '2026-11-26')
assert.ok([...worst].length <= 80, `${[...worst].length} 字：${worst}`)
const newFinancial = sixDimensionsAnswer(financial.map(item => (item.label === '價格趨勢' ? { ...item, value: null, nullReason: 'insufficient_history' } : item.label === '成長動能' ? { ...item, value: 100 } : item.label === '股東回饋' ? { ...item, value: 99.6 } : item)), '2026-11-26')
assert.equal(newFinancial, '六個面向裡，成長動能的百分位 100，最高；股東回饋的百分位 100，最低。體質改善、價值型、財務安全不適用。價格趨勢算不出來。資料日期 2026-11-26。')
assert.ok([...newFinancial].length <= 80, `${[...newFinancial].length} 字：${newFinancial}`)
assert.ok([...financialAnswer].length <= 80)
// 只有一個、全部一樣、一個都沒有
assert.equal(sixDimensionsAnswer(sample.map((item, index) => ({ ...item, value: index === 1 ? 91.3 : null })), '2026-11-26'), '六個面向裡只有價格趨勢算得出來，百分位 91。資料日期 2026-11-26。')
assert.equal(sixDimensionsAnswer(sample.map(item => ({ ...item, value: 50 })), null), '六個面向的百分位都是 50。')
assert.equal(sixDimensionsAnswer(sample.map(item => ({ ...item, value: null })), '2026-11-26'), null)
// 同分時最高取前面的軸、最低也取前面的，不會同一個
assert.equal(sixDimensionsAnswer([{ label: '成長動能', value: 80 }, { label: '價格趨勢', value: 80 }, { label: '價值型', value: 20 }, { label: '財務安全', value: 20 }], null), '六個面向裡，成長動能的百分位 80，最高；價值型的百分位 20，最低。')

assert.equal(sixDimensionsAriaLabel('範例', financial), '範例六面向雷達圖：成長動能 82、價格趨勢 91、體質改善 不適用、價值型 不適用、財務安全 不適用、股東回饋 38')
assert.equal(sixDimensionsAriaLabel('範例', sample.map(item => (item.label === '體質改善' ? { ...item, value: null, nullReason: 'missing_input' } : item))), '範例六面向雷達圖：成長動能 82、價格趨勢 91、體質改善 無法計算、價值型 23、財務安全 74、股東回饋 38')

console.log('PASS: six dimensions')
