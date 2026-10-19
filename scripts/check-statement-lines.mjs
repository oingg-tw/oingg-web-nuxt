// The one runnable check for buildStatementLines (app/utils/financial-statement-rows.ts): GL order with totals after
// their details, the concise threshold, 「其他」 = total − Σ(weight × shown children), weights of −1 (costs), anchoring to the
// nearest ancestor with a value, ancestors of shown lines always shown, non-amount units only when expanded, empty lines
// dropped. Pure, no network.
//
// Run: node scripts/check-statement-lines.mjs
import { buildStatementLines } from '../app/utils/financial-statement-rows.ts'

let failures = 0
const assert = (cond, label) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const col = (statement, key, gl, parent = null, weight = 1, total = false, unit = '千元') => ({ key, statement, label: key, gl, parent, weight, total, unit })
const columns = [
  col('balanceSheet', 'assets', '1XXX', null, 1, true),
  col('balanceSheet', 'current_assets', '11XX', 'assets', 1, true),
  col('balanceSheet', 'cash', '1100', 'current_assets'),
  col('balanceSheet', 'receivables', '1170', 'current_assets'),
  col('balanceSheet', 'tiny', '1200', 'current_assets'),
  // 父欄位這一期沒有數字：要掛到 current_assets，加減方向沿路相乘（-1 × -1 = +1）
  col('balanceSheet', 'empty_total', '1290', 'current_assets', -1, true),
  col('balanceSheet', 'orphan', '1300', 'empty_total', -1),
  col('balanceSheet', 'noncurrent_assets', '15XX', 'assets', 1, true),
  col('balanceSheet', 'ppe', '1600', 'noncurrent_assets'),
  // 合計本身很小（0.5%），但底下有大的科目：一定要列
  col('balanceSheet', 'misc_total', '1900', 'noncurrent_assets', 1, true),
  col('balanceSheet', 'misc_big', '1910', 'misc_total'),
  col('balanceSheet', 'misc_negative', '1920', 'misc_total'),
  col('balanceSheet', 'never_filed', '1950', 'noncurrent_assets'),
  col('balanceSheet', 'zero_line', '1960', 'noncurrent_assets'),
  col('balanceSheet', 'share_count', '', null, 1, false, '股'),
  col('incomeStatement', 'gross_profit', '5900', null, 1, true),
  col('incomeStatement', 'revenue', '4000', 'gross_profit'),
  col('incomeStatement', 'operating_costs', '5000', 'gross_profit', -1),
  // 現金流量表的段落代碼：本期增減 EEEE 底下有營業 AAAA（A10000…），期初 E00100、期末 E00200 是另外的最上層；沒有 GL 的排最後
  col('cashFlowStatement', 'increase', 'EEEE', null, 1, true),
  col('cashFlowStatement', 'operating', 'AAAA', 'increase', 1, true),
  col('cashFlowStatement', 'pretax', 'A10000', 'operating'),
  col('cashFlowStatement', 'fx', 'DDDD', 'increase'),
  col('cashFlowStatement', 'beginning', 'E00100'),
  col('cashFlowStatement', 'ending', 'E00200'),
  col('cashFlowStatement', 'no_gl_root', ''),
  // 合計底下只有一個子科目、金額一樣：只留合計（基準 assets 給 1000，子科目 70% 一定過門檻）
  col('balanceSheet', 'profit', '3900', null, 1, true),
  col('balanceSheet', 'continuing_profit', '3800', 'profit')
]
const balance = {
  assets: '1000', current_assets: '600', cash: '300', receivables: '250', tiny: '5', empty_total: null, orphan: '45',
  noncurrent_assets: '400', ppe: '380', misc_total: '5', misc_big: '50', misc_negative: '-45', never_filed: null, zero_line: '0', share_count: '123'
}
const keys = lines => lines.map(line => line.key)

console.log('資產負債表，預設精簡（≥2% 總資產）')
{
  const { lines, hidden } = buildStatementLines(columns, 'balanceSheet', balance, null, false)
  assert(same(keys(lines), ['cash', 'receivables', 'orphan', 'current_assets__other', 'current_assets', 'ppe', 'misc_big', 'misc_negative', 'misc_total', 'noncurrent_assets__other', 'noncurrent_assets', 'assets']),
    `明細在前、合計在後，依 GL 排（實得 ${keys(lines).join(',')}）`)
  assert(lines.find(line => line.key === 'current_assets__other')?.current === '5', '「其他」＝流動資產 600 −（300＋250＋45），小科目 tiny 併進去')
  assert(lines.find(line => line.key === 'orphan') !== undefined, '父欄位沒有數字的科目掛到最近有數字的祖先')
  assert(lines.find(line => line.key === 'misc_total')?.total === true, '合計本身低於門檻，但底下有列出的科目：照樣列、而且是合計')
  assert(lines.find(line => line.key === 'noncurrent_assets__other')?.current === '15', '非流動資產的「其他」＝400 −（380＋5），沒收錄的子科目都在這裡')
  assert(!keys(lines).includes('misc_total__other'), '50 + (−45) = 5：雜項合計沒有「其他」')
  assert(!keys(lines).includes('never_filed') && !keys(lines).includes('zero_line'), '沒申報、是 0 的科目不列')
  assert(!keys(lines).includes('share_count'), '股數不是金額，精簡模式不列')
  assert(!keys(lines).includes('tiny'), '低於門檻的明細不單獨列')
  assert(hidden === 2, `精簡模式藏了 2 個有數字的科目（tiny、股數），實得 ${hidden}`)
}

console.log('資產負債表，展開全部')
{
  const { lines, hidden } = buildStatementLines(columns, 'balanceSheet', balance, null, true)
  assert(keys(lines).includes('tiny') && keys(lines).includes('share_count'), '展開後 tiny 與股數都在')
  assert(!keys(lines).includes('current_assets__other'), '流動資產的明細加起來剛好 600：沒有「其他」')
  assert(hidden === 0, '展開時沒有藏起來的')
}

console.log('損益表：營業成本是減項')
{
  const exact = buildStatementLines(columns, 'incomeStatement', { gross_profit: '40', revenue: '100', operating_costs: '60' }, null, false).lines
  assert(same(keys(exact), ['revenue', 'operating_costs', 'gross_profit']), '營收、成本、毛利依序')
  assert(!keys(exact).includes('gross_profit__other'), '100 − 60 = 40：沒有「其他」')
  const off = buildStatementLines(columns, 'incomeStatement', { gross_profit: '41', revenue: '100', operating_costs: '60' }, { gross_profit: '30', revenue: '90', operating_costs: '60' }, false).lines
  const other = off.find(line => line.key === 'gross_profit__other')
  assert(other?.current === '1' && other?.prior === '0', '「其他」兩期各自算：當期 1、去年同期 0')
}

console.log('現金流量表的段落順序（GL 有字母也有數字）')
{
  const flows = { operating: '100', pretax: '80', fx: '-5', increase: '95', beginning: '1000', ending: '1095', no_gl_root: '-30' }
  const order = keys(buildStatementLines(columns, 'cashFlowStatement', flows, null, true).lines)
  assert(same(order, ['pretax', 'operating__other', 'operating', 'fx', 'increase', 'beginning', 'ending', 'no_gl_root']),
    `營業 → 匯率 → 本期增減 → 期初 → 期末 → 沒有 GL 的（實得 ${order.join(',')}）`)
}

console.log('合計底下只有一個一樣的子科目')
{
  const merged = keys(buildStatementLines(columns, 'balanceSheet', { assets: '1000', profit: '700', continuing_profit: '700' }, { assets: '1000', profit: '400', continuing_profit: '400' }, false).lines)
  assert(merged.includes('profit') && !merged.includes('continuing_profit'), `兩期都一樣：只留合計（實得 ${merged.join(',')}）`)
  const differs = keys(buildStatementLines(columns, 'balanceSheet', { assets: '1000', profit: '700', continuing_profit: '700' }, { assets: '1000', profit: '400', continuing_profit: '390' }, false).lines)
  assert(differs.includes('continuing_profit') && differs.includes('profit__other'), `去年同期不一樣：子科目與「其他」都要列（實得 ${differs.join(',')}）`)
}

if (failures) {
  console.log(`\n${failures} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過')
