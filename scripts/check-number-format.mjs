// 數字格式化的自我檢查（shared/utils/number-format.ts，2026-10-12）。例子取自使用者回報的 7711 與台積電的真實量級。
//   node scripts/check-number-format.mjs
import assert from 'node:assert/strict'
import { formatMoney, formatSignificantDigits, groupThousands } from '../shared/utils/number-format.ts'

assert.equal(groupThousands(2446), '2,446')
assert.equal(groupThousands('-1234567.89'), '-1,234,567.89')
// 金額：自動萬／億／兆＋4 位有效數字
assert.equal(formatMoney(3_205_190), '320.5萬元') // 7711 不動產廠房及設備（約 0.2% 的 16 億）
assert.equal(formatMoney(576_300_000), '5.763億元')
assert.equal(formatMoney(4_565_700_742_000), '4.566兆元') // 台積電流動資產（千元 ×1000）
assert.equal(formatMoney(2446), '2,446元')
assert.equal(formatMoney(-30_000_000), '-3,000萬元')
assert.equal(formatMoney(0), '0元')
assert.equal(formatMoney(-0.0001), '-0.0001元')
// 指標數值：4 位有效數字
assert.equal(formatSignificantDigits(86.27, 4), '86.27')
assert.equal(formatSignificantDigits(123.45, 4), '123.5')
assert.equal(formatSignificantDigits(1234.5, 4), '1,235')
assert.equal(formatSignificantDigits(56_780_000, 4), '5,678萬')
assert.equal(formatSignificantDigits(-0.00004, 1), '-0.00004')
console.log('number format: ok')
