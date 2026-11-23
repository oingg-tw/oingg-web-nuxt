// 篩選結果表哪些欄上漲跌色（app/utils/price-direction.ts 的 colorsByDirection），名稱取自三組篩選的型錄
// Run: node scripts/check-price-direction.mjs
import assert from 'node:assert/strict'
import { colorsByDirection } from '../app/utils/price-direction.ts'

for (const name of [
  '營收成長年增率', '近三個月營收年增率變化', '股本變化年增率', '收盤價漲跌', '收盤價漲跌幅', '52 週股價漲跌幅', '集保戶數月增率',
  // 2026-11-24：期間報酬率、多年成長率、淨申購
  '近3月報酬率', '近1年報酬率', '近10年報酬率', '近3年年化報酬率', '今年以來報酬率', '成立以來報酬率',
  '每股盈餘 3 年複合成長率', '營收 5 年複合成長率', '現金流量股利 3 年成長率', '持股股利 5 年成長率', '淨申購（申購-贖回）'
]) {
  assert.equal(colorsByDirection(name), true, name)
}
// 標準差永遠是正的；價格、溢價率是水準，資產報酬率這些是獲利能力，永續成長率是推算的能力，本益成長比是比值，都沒有漲跌的方向
for (const name of ['營收年增率波動', '收盤價', '溢價率', '資產報酬率', '投入資本報酬率', '現金投入資本報酬率', 'Greenblatt 資本報酬率', '淨營業資產報酬率', '永續成長率', '本益成長比', '每股業外損益差額']) {
  assert.equal(colorsByDirection(name), false, name)
}

console.log('check-price-direction: ok')
