// 篩選結果表哪些欄上漲跌色（app/utils/price-direction.ts 的 colorsByDirection），名稱取自三組篩選的型錄
// Run: node scripts/check-price-direction.mjs
import assert from 'node:assert/strict'
import { colorsByDirection } from '../app/utils/price-direction.ts'

for (const name of ['營收成長年增率', '近三個月營收年增率變化', '股本變化年增率', '收盤價漲跌', '收盤價漲跌幅', '52 週股價漲跌幅']) {
  assert.equal(colorsByDirection(name), true, name)
}
// 標準差永遠是正的；價格、溢價率是水準，資產報酬率是獲利能力，都沒有漲跌的方向
for (const name of ['營收年增率波動', '收盤價', '溢價率', '資產報酬率']) {
  assert.equal(colorsByDirection(name), false, name)
}

console.log('check-price-direction: ok')
