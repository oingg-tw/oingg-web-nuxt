// 數字格式化的自我檢查（shared/utils/number-format.ts，2026-10-12）。例子取自使用者回報的 7711 與台積電的真實量級。
//   node scripts/check-number-format.mjs
import assert from 'node:assert/strict'
import { formatLogAxisTick, formatMoney, formatSignificantDigits, groupThousands } from '../shared/utils/number-format.ts'
import { cellPeriodText } from '../app/utils/screener-value.ts'

assert.equal(groupThousands(2446), '2,446')
assert.equal(groupThousands('-1234567.89'), '-1,234,567.89')
// 對數軸刻度：兩位有效數字、千分位；十元以下不能有浮點殘差（2543 股價淨值比河流圖的軸底 7.300000000000001）
assert.equal(formatLogAxisTick(7.29), '7.3')
assert.equal(formatLogAxisTick(0.0456), '0.046')
assert.equal(formatLogAxisTick(398.1), '400')
assert.equal(formatLogAxisTick(5011.87), '5,000')
assert.equal(formatLogAxisTick(0), '')
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
// 一格數字的資料時間（app/utils/screener-value.ts）：有財報期別寫期別，季別寫成 26Q2；沒有期別（逐日、即時）才寫日期
assert.equal(cellPeriodText({ knowledgeDate: '2026-08-12', fiscalPeriod: '2026Q2' }), '26Q2')
assert.equal(cellPeriodText({ knowledgeDate: '2026-08-12', fiscalPeriod: '2025' }), '2025') // 每季更新的年度指標：值是 2025 年度的
assert.equal(cellPeriodText({ knowledgeDate: '2026-10-10', fiscalPeriod: '2026-09' }), '2026-09')
assert.equal(cellPeriodText({ knowledgeDate: '2026-10-22', fiscalPeriod: null }), '2026-10-22')
assert.equal(cellPeriodText({ knowledgeDate: '2026-10-22' }), '2026-10-22')
console.log('number format: ok')
