// 選股策略頁的分段與出處說明（app/utils/screener-strategies.ts）。Run: node scripts/check-screener-strategies.mjs
import assert from 'node:assert/strict'
import { strategyGroups, strategyIntro } from '../app/utils/screener-strategies.ts'

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

console.log('PASS: screener strategies')
