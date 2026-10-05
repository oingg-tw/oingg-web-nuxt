// The one runnable check for app/utils/holdings-formula.ts — Excel semantics users will rely on, and the
// "never eval" guarantee. Pure, no network.
//
// Run: node scripts/check-holdings-formula.mjs
import { columnLetter, evaluateRow, parseFormula, rewriteAfterDelete } from '../app/utils/holdings-formula.ts'

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const close = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-9

// 內建欄位：A 股數、B 平均成本、C 收盤價、D 市值
const row = { A: 1000, B: 500, C: 600, D: 600000, E: null }
const one = formula => evaluateRow(row, [{ letter: 'H', formula }]).H

console.log('基本運算')
assert(close(one('=D/A'), 600), '=D/A：第四欄除以第一欄')
assert(close(one('d/a'), 600), '欄位字母不分大小寫，等號可省略')
assert(close(one('=(C-B)/B*100'), 20), '括號與四則運算的優先順序')
assert(close(one('=-2^2'), 4), 'Excel 的 -2^2 是 4（負號先於次方）')
assert(close(one('=50%*A'), 500), '% 是百分比（50% ＝ 0.5）')
assert(close(one('=ROUND(2.5, 0)'), 3) && close(one('=ROUND(-2.5, 0)'), -3), 'ROUND 遠離 0 四捨五入（Excel 規則，不是 Math.round）')
assert(close(one('=ROUND(C/B, 2)'), 1.2), 'ROUND 第二個參數是小數位數')
assert(close(one('=MAX(A, B, C)'), 1000) && close(one('=SUM(A, B)'), 1500) && close(one('=AVERAGE(B, C)'), 550), 'MAX／SUM／AVERAGE')
assert(close(one('=IF(C>B, 1, 0)'), 1) && one('=C=B') === false && one('=C<>B') === true, 'IF 與比較（= 是等於、<> 是不等於）')

console.log('\n錯誤值')
assert(one('=A/0') === '#DIV/0!', '除以 0 是 #DIV/0!')
assert(one('=E*2') === '#N/A', '那一列沒有這個值（例如沒報價）是 #N/A')
assert(one('=Z+1') === '#REF!', '不存在的欄位是 #REF!')
assert(one('=FOO(A)') === '#NAME?', '不認得的函數是 #NAME?')
assert(one('=A/0+E') === '#DIV/0!', '錯誤會往外傳')
assert(close(one('=IFERROR(A/0, -1)'), -1), 'IFERROR 接住錯誤')
assert(close(one('=IF(A>0, A, A/0)'), 1000), 'IF 沒走到的那一支出錯不影響結果')

console.log('\n自訂欄位互相參照')
{
  const r = evaluateRow(row, [{ letter: 'H', formula: '=D/A' }, { letter: 'I', formula: '=H*2' }, { letter: 'J', formula: '=K' }, { letter: 'K', formula: '=J' }])
  assert(close(r.I, 1200), '自訂欄位可以參照另一個自訂欄位')
  assert(r.J === '#REF!' && r.K === '#REF!', '循環參照是 #REF!，不會無窮迴圈')
}

console.log('\n整欄範圍（D:D）')
{
  // 三列持股的市值 600,000、300,000、100,000（其中一列沒報價 → null）
  const table = { D: [600000, 300000, 100000, null], C: [600, 30, 10, null] }
  const share = evaluateRow(row, [{ letter: 'H', formula: '=ROUND(D/SUM(D:D)*100, 2)' }], table).H
  assert(close(share, 60), '市值占比：=D/SUM(D:D)，整欄加總跳過沒有值的列（600,000 ÷ 1,000,000）')
  assert(close(evaluateRow(row, [{ letter: 'H', formula: '=AVERAGE(C:C)' }], table).H, 640 / 3), 'AVERAGE(C:C) 只平均有值的列，空的不算 0')
  assert(evaluateRow(row, [{ letter: 'H', formula: '=D:D' }], table).H === '#VALUE!', '整欄只能放在彙總函數裡')
  assert(evaluateRow(row, [{ letter: 'H', formula: '=SUM(Q:Q)' }], table).H === '#REF!', '不能整欄引用的欄位是 #REF!')
  assert(!parseFormula('=SUM(A:D)').ok, '跨欄範圍會被擋（持股表沒有意義）')
}

console.log('\n絕不執行程式碼')
assert(!parseFormula('=constructor.constructor("return 1")()').ok, '屬性存取與字串不是合法語法')
assert(!parseFormula('=alert(1);').ok, '分號不是合法字元')
assert(one('=alert(1)') === '#NAME?', '任意函數名只會是 #NAME?，不會被呼叫')

console.log('\n語法錯誤（給編輯器的訊息）')
assert(!parseFormula('=(A+B').ok && !parseFormula('=A+').ok && !parseFormula('=').ok, '少右括號、寫一半、空公式都會被擋')

console.log('\n刪除欄位時改寫參照（像 Excel）')
assert(rewriteAfterDelete('=I/H', 'H') === '=H/#REF!', '參照被刪的欄位變 #REF!，後面的欄位往前移')
assert(rewriteAfterDelete('=ROUND(J, 2)', 'H') === '=ROUND(I, 2)', '函數名稱不會被當成欄位改掉')
assert(rewriteAfterDelete('=D/A', 'H') === '=D/A', '前面的內建欄位不受影響')
assert(columnLetter(0) === 'A' && columnLetter(25) === 'Z' && columnLetter(26) === 'AA', '欄位字母：A…Z、AA')

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASS')
process.exitCode = failures ? 1 : 0
