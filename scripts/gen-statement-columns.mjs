// 產生 app/utils/financial-statement-columns.ts：三大財報每一欄的中文科目名、GL 順序、加總父欄位與加減方向、單位。
// 資料是 mops-ts 從 taxonomy 推導的中繼資料（2026-10-19，使用者「財報頁 照上次的方向改」：預設精簡、加「其他」、可展開全部科目；
// 不靠名稱猜加總關係，「其他」＝父 − Σ(加減方向 × 子) 才算得對）。mops 新增或改名欄位時會給新的一份，重跑這支即可。
//
// 用法：node scripts/gen-statement-columns.mjs [TSV 路徑]（預設 D:/0MOPS/_reports/xbrl-statement-column-metadata-20261019b.tsv）
import fs from 'node:fs'

const source = process.argv[2] ?? 'D:/0MOPS/_reports/xbrl-statement-column-metadata-20261019b.tsv'
const lines = fs.readFileSync(source, 'utf8').trim().split(/\r?\n/)
const header = lines.shift().split('\t')
const rows = lines.map(line => Object.fromEntries(line.split('\t').map((value, i) => [header[i], value.trim()])))

const UNITS = { 千元: '千元', '元/股': '元', '%': '%', 股: '股' }
const columns = rows.map((row) => {
  const unit = UNITS[row.unit]
  if (!unit) throw new Error(`未知的單位「${row.unit}」：${row.view_column}`)
  if (row.parent_view_column && !['1', '-1'].includes(row.calc_weight)) throw new Error(`加減方向不是 ±1：${row.view_column}`)
  return {
    key: row.view_column,
    statement: row.statement,
    // 一般業（ci）的標準科目名優先，沒有才用另一套產業別（mim）的
    label: row.zh_ci || row.zh_mim,
    gl: row.gl_ci || row.gl_mim,
    parent: row.parent_view_column || null,
    weight: row.parent_view_column ? Number(row.calc_weight) : 1,
    total: row.is_total === 'Y',
    unit
  }
})

// 父欄位一定要在同一張表裡（mops 的規則），不然組表時會掛空
const keys = new Set(columns.map(column => `${column.statement}:${column.key}`))
for (const column of columns) {
  if (column.parent && !keys.has(`${column.statement}:${column.parent}`)) throw new Error(`${column.key} 的父欄位 ${column.parent} 不在 ${column.statement}`)
}

const body = columns.map(column => `  ${JSON.stringify(column)}`).join(',\n')
const output = `// 由 scripts/gen-statement-columns.mjs 產生，不要手改（來源：mops-ts 從 taxonomy 推導的財報欄位中繼資料，${source.split('/').pop()}）。
// 每一欄：中文標準科目名（ci 優先）、GL 代碼（照 MOPS 報表順序排）、最近一個也有收的加總父欄位與加減方向、是否合計、單位。
// 組表規則在 financial-statement-rows.ts 的 buildStatementLines。
import type { StatementColumn } from './financial-statement-rows'

export const STATEMENT_COLUMNS: StatementColumn[] = [
${body}
]
`
fs.writeFileSync('app/utils/financial-statement-columns.ts', output)
console.log(`寫入 ${columns.length} 欄：${['balanceSheet', 'incomeStatement', 'cashFlowStatement'].map(s => `${s} ${columns.filter(c => c.statement === s).length}`).join('、')}`)
