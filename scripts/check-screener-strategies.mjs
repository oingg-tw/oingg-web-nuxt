// 選股策略頁的分段與出處說明（app/utils/screener-strategies.ts）。Run: node scripts/check-screener-strategies.mjs
import assert from 'node:assert/strict'
import { conditionText, rangeText, strategyGroups, strategyIntro } from '../app/utils/screener-strategies.ts'
import { findScreenerOption } from '../app/utils/screener-value.ts'
import { minusSign } from '../shared/utils/number-format.ts'

// rangeText 在網站裡靠自動匯入
Object.assign(globalThis, { findScreenerOption, minusSign })

// 業務中台的順序：成長突破、低淨值比、高殖利率（預設）、接近高點。預設那組的類別排最前面，其餘照第一次出現的順序
const templates = [
  { name: '成長突破', category: '大師策略', isDefault: false },
  { name: '低淨值比＋財務體質', category: '大師策略', isDefault: false },
  { name: '高殖利率＋財務體質＋低淨值比', category: '存股主題', isDefault: true },
  { name: '財務體質＋接近高點', category: '量化因子', isDefault: false },
  { name: '殖利率穩定', category: '存股主題', isDefault: false },
  { name: '沒有類別的', category: '', isDefault: false }
]
assert.deepEqual(strategyGroups(templates).map(group => [group.category, group.items.map(item => item.name)]), [
  ['存股主題', ['高殖利率＋財務體質＋低淨值比', '殖利率穩定']],
  ['大師策略', ['成長突破', '低淨值比＋財務體質']],
  ['量化因子', ['財務體質＋接近高點']],
  ['其他', ['沒有類別的']]
])
assert.deepEqual(strategyGroups([]), [])

// 出處說明：「——」後面那段；沒有就整段
assert.equal(strategyIntro('股價淨值比 ≤ 1，且 Piotroski F 分數 ≥ 7——F 分數出自 Joseph Piotroski 2000 年的論文。'), 'F 分數出自 Joseph Piotroski 2000 年的論文。')
assert.equal(strategyIntro('只有一句說明'), '只有一句說明')
assert.equal(strategyIntro(null), '')

// 條件：類別條件寫選項的名稱，「包含／排除」同條件膠囊，對不到的照原值；數字條件照舊，負的界線用「−」
const size = [{ value: 1, label: '大型' }, { value: 2, label: '中型' }, { value: 3, label: '小型' }]
const picked = values => ({ field: 'styleBoxSize.EOD', min: null, max: null, exclude: false, values })
assert.equal(rangeText(picked([1]), '', size), '包含 大型')
assert.equal(rangeText(picked([1, 2]), '', size), '包含 大型、中型')
assert.equal(rangeText({ ...picked([3]), exclude: true }, '', size), '排除 小型')
assert.equal(rangeText(picked([9]), '', size), '包含 9')
assert.equal(rangeText(picked([1]), '', undefined), '包含 1')
// 符號、數字、單位之間是不斷行空白（ ），折行時不會落單；兩端都有寫「0～1.5 倍」
assert.equal(rangeText({ field: 'distanceFrom52wHigh.1Y', min: -15, max: null, exclude: false, values: null }, '%'), '≥ −15%')
assert.equal(rangeText({ field: 'pbRatio.EOD', min: 0, max: 1.5, exclude: false }, '倍'), '0～1.5 倍')
assert.equal(rangeText({ field: 'beta.1Y_1D', min: null, max: 0.8, exclude: false }, ''), '≤ 0.8')
assert.equal(rangeText({ field: 'distanceFrom52wHigh.1Y', min: -20, max: -5, exclude: false }, '%'), '−20～−5%')
assert.equal(rangeText({ field: 'roe.TTM', min: null, max: null, exclude: true, values: [] }, '%'), '排除：有值即可')

// 名稱底下那一行：有期間寫在括號裡，只有每日的（期間是空字串）不寫
assert.equal(conditionText({ label: 'ROE', period: '近四季', range: '≥ 17%' }), 'ROE（近四季）≥ 17%')
assert.equal(conditionText({ label: '本益比', period: '', range: '0 到 20 倍' }), '本益比 0 到 20 倍')
assert.equal(conditionText({ label: '投資風格九宮格：規模', period: '', range: '包含 大型' }), '投資風格九宮格：規模 包含 大型')

console.log('PASS: screener strategies')
