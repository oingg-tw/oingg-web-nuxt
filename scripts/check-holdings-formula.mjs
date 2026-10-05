// The one runnable check for app/utils/holdings-formula.ts — Excel semantics users will rely on, and the
// "never eval" guarantee. Pure, no network.
//
// Run: node scripts/check-holdings-formula.mjs
import { columnLetter, evaluateTable, parseFormula, rewriteAfterDelete } from '../app/utils/holdings-formula.ts'

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const close = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-9

const fields = (shares, avgcost, price, marketvalue, dividend = null) => ({ SHARES: shares, AVGCOST: avgcost, PRICE: price, MARKETVALUE: marketvalue, PNL: null, RETURN: null, DIVIDEND: dividend })
const row = fields(1000, 500, 600, 600000)
// 預設的前四欄也只是公式：A 股數、B 平均成本、C 收盤價、D 市值
const base = [
  { letter: 'A', formula: '=SHARES()' },
  { letter: 'B', formula: '=AVGCOST()' },
  { letter: 'C', formula: '=PRICE()' },
  { letter: 'D', formula: '=MARKETVALUE()' },
  { letter: 'E', formula: '=PNL()' }
]
const one = formula => evaluateTable([row], [...base, { letter: 'H', formula }])[0].H

console.log('資料函數（每一欄都只是公式，可以自由刪改）')
{
  const r = evaluateTable([row], base)[0]
  assert(r.A === 1000 && r.C === 600 && r.D === 600000, '=SHARES()、=PRICE()、=MARKETVALUE() 取那一列的持股資料')
  assert(r.E === '#N/A', '那一列沒有的資料（例如沒報價、成本不明）是 #N/A')
  assert(close(one('=PRICE()/AVGCOST()'), 1.2), '資料函數也可以直接寫進公式，不必先有那一欄')
  assert(one('=PRICE(1)') === '#VALUE!', '資料函數不收參數')
}

console.log('\n基本運算')
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
assert(one('=E*2') === '#N/A', '#N/A 會往外傳')
assert(one('=Z+1') === '#REF!', '不存在的欄位是 #REF!')
assert(one('=FOO(A)') === '#NAME?', '不認得的函數是 #NAME?')
assert(one('=A/0+E') === '#DIV/0!', '錯誤會往外傳')
assert(close(one('=IFERROR(A/0, -1)'), -1), 'IFERROR 接住錯誤')
assert(close(one('=IF(A>0, A, A/0)'), 1000), 'IF 沒走到的那一支出錯不影響結果')

console.log('\n欄位互相參照')
{
  const r = evaluateTable([row], [...base, { letter: 'H', formula: '=D/A' }, { letter: 'I', formula: '=H*2' }, { letter: 'J', formula: '=K' }, { letter: 'K', formula: '=J' }])[0]
  assert(close(r.I, 1200), '欄位可以參照另一個公式欄')
  assert(r.J === '#REF!' && r.K === '#REF!', '循環參照是 #REF!，不會無窮迴圈')
}

console.log('\n整欄範圍（D:D）')
{
  const rows = [fields(1000, 500, 600, 600000), fields(10000, 25, 30, 300000), fields(10000, 8, 10, 100000), fields(5, 1, null, null)]
  const cols = [...base, { letter: 'H', formula: '=ROUND(D/SUM(D:D)*100, 2)' }, { letter: 'I', formula: '=AVERAGE(C:C)' }, { letter: 'J', formula: '=H/SUM(H:H)' }]
  const r = evaluateTable(rows, cols)
  assert(close(r[0].H, 60), '市值占比：=D/SUM(D:D)，沒有報價的那一列（#N/A）像空白儲存格一樣跳過')
  assert(close(r[0].I, 640 / 3), 'AVERAGE(C:C) 只平均有值的列，空的不算 0')
  assert(close(r[1].J, 0.3), '公式欄也能整欄引用（H 是公式欄，J 用 SUM(H:H)）')
  assert(evaluateTable([row], [...base, { letter: 'H', formula: '=D/SUM(H:H)' }])[0].H === '#REF!', '透過整欄繞回自己的循環參照是 #REF!')
  assert(one('=D:D') === '#VALUE!', '整欄只能放在彙總函數裡')
  assert(one('=SUM(Q:Q)') === '#REF!', '不存在的欄位整欄引用是 #REF!')
  assert(!parseFormula('=SUM(A:D)').ok, '跨欄範圍會被擋（持股表沒有意義）')
}

console.log('\n絕不執行程式碼')
assert(!parseFormula('=constructor.constructor("return 1")()').ok, '屬性存取與字串不是合法語法')
assert(!parseFormula('=alert(1);').ok, '分號不是合法字元')
assert(one('=alert(1)') === '#NAME?', '任意函數名只會是 #NAME?，不會被呼叫')

console.log('\n語法錯誤（給編輯器的訊息）')
assert(!parseFormula('=(A+B').ok && !parseFormula('=A+').ok && !parseFormula('=').ok, '少右括號、寫一半、空公式都會被擋')

console.log('\n刪除欄位時改寫參照（像 Excel）')
assert(rewriteAfterDelete('=C/B', 'B') === '=B/#REF!', '參照被刪的欄位變 #REF!，後面的欄位往前移')
assert(rewriteAfterDelete('=ROUND(D, 2)', 'A') === '=ROUND(C, 2)', '函數名稱不會被當成欄位改掉')
assert(rewriteAfterDelete('=PRICE()/A', 'A') === '=PRICE()/#REF!', '資料函數不受欄位刪除影響')
assert(rewriteAfterDelete('=SUM(D:D)', 'B') === '=SUM(C:C)', '整欄範圍跟著往前移')
assert(columnLetter(0) === 'A' && columnLetter(25) === 'Z' && columnLetter(26) === 'AA', '欄位字母：A…Z、AA')

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASS')
process.exitCode = failures ? 1 : 0
