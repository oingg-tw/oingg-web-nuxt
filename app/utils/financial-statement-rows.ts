import type { StatementType } from '#shared/types/financial-statement'

// Line-item definitions of the three statements — extracted from StockFinancialStatementsCard.vue
// on 2026-09-19 (the SEO build) so the server-rendered 當期／去年同期 tables on the 財務報表 page and
// the card's own period-picker view share one row list. Labels/structure match how TWSE-listed
// companies' 資產負債表/損益表/現金流量表 lay out on MOPS; each `key` is the real bff-ts field name
// (GET /stocks/:symbol/financial-statement — the raw XBRL/MOPS snake_case names, re-derived off a
// real response on 2026-09-10 after a whole day of guessed camelCase keys matched nothing). A row
// with no `key` is a pure section header（流動資產／流動負債…）or a subtotal the payload has no
// single field for（特別股負債, the OCI lines, the cash-flow 稅前淨利／其他調整項目合計）— those
// render blank rather than a hand-summed number bff-ts never vouched for.
export interface StatementRow {
  label: string
  key?: string
  indent?: boolean
  emphasis?: boolean
}

export const BALANCE_SHEET_ROWS: StatementRow[] = [
  { label: '流動資產', emphasis: true },
  { label: '現金及約當現金', key: 'cash_and_cash_equivalents', indent: true },
  { label: '應收帳款', key: 'accounts_receivable_net', indent: true },
  { label: '存貨', key: 'inventories', indent: true },
  { label: '流動資產合計', key: 'current_assets', emphasis: true },
  { label: '非流動資產', emphasis: true },
  { label: '不動產、廠房及設備', key: 'property_plant_and_equipment', indent: true },
  { label: '採用權益法之投資', key: 'investment_using_equity_method', indent: true },
  { label: '無形資產', key: 'intangible_assets_and_goodwill', indent: true },
  { label: '非流動資產合計', key: 'noncurrent_assets', emphasis: true },
  { label: '資產總計', key: 'assets', emphasis: true },
  { label: '流動負債', emphasis: true },
  { label: '短期借款', key: 'shortterm_borrowings', indent: true },
  // No combined "accounts_payable" field in the real payload — only split by counterparty
  // (trade_payables_to_trade_suppliers / _to_related_parties). Suppliers is the dominant figure.
  { label: '應付帳款', key: 'trade_payables_to_trade_suppliers', indent: true },
  { label: '流動負債合計', key: 'current_liabilities', emphasis: true },
  { label: '非流動負債', emphasis: true },
  { label: '應付公司債', key: 'noncurrent_portion_of_bonds_issued', indent: true },
  { label: '長期借款', key: 'longterm_borrowings', indent: true },
  { label: '非流動負債合計', key: 'noncurrent_liabilities', emphasis: true },
  { label: '負債總計', key: 'liabilities', emphasis: true },
  { label: '股本', key: 'ordinary_share', indent: true },
  { label: '特別股股本', key: 'preference_share', indent: true },
  { label: '資本公積', key: 'capital_reserve', indent: true },
  { label: '保留盈餘', key: 'retained_earnings', indent: true },
  { label: '其他權益', key: 'other_equity_interest', indent: true },
  { label: '庫藏股', key: 'treasury_shares', indent: true },
  { label: '歸屬於母公司業主之權益合計', key: 'equity_attributable_to_owners_of_parent', emphasis: true },
  { label: '非控制權益', key: 'noncontrolling_interests', indent: true },
  { label: '權益總計', key: 'equity', emphasis: true },
  // No separate "assets = liabilities + equity" field either — reuses `assets` itself, a real
  // accounting identity (this line always equals total assets), not a guess.
  { label: '負債及權益總計', key: 'assets', emphasis: true }
]

export const INCOME_STATEMENT_ROWS: StatementRow[] = [
  { label: '營業收入', key: 'revenue' },
  { label: '營業成本', key: 'operating_costs' },
  { label: '營業毛利', key: 'gross_profit', emphasis: true },
  { label: '推銷費用', key: 'selling_expense', indent: true },
  { label: '管理費用', key: 'administrative_expense', indent: true },
  { label: '研究發展費用', key: 'research_and_development_expense', indent: true },
  { label: '營業費用合計', key: 'operating_expense', emphasis: true },
  { label: '營業利益', key: 'profit_loss_from_operating_activities', emphasis: true },
  { label: '利息收入', key: 'revenue_from_interest', indent: true },
  { label: '財務成本', key: 'finance_costs', indent: true },
  { label: '其他收入', key: 'other_revenue', indent: true },
  { label: '採用權益法認列關聯企業損益之份額', key: 'share_of_profit_loss_of_associates_and_jvs', indent: true },
  { label: '其他營業外損益', key: 'other_gains_losses', indent: true },
  { label: '營業外收支合計', key: 'nonoperating_income_and_expenses', emphasis: true },
  { label: '稅前淨利', key: 'profit_loss_before_tax', emphasis: true },
  { label: '所得稅費用', key: 'income_tax_expense_continuing_operations', indent: true },
  { label: '本期淨利', key: 'profit_loss', emphasis: true },
  { label: '歸屬於母公司業主淨利', key: 'profit_loss_attributable_to_owners_of_parent', indent: true },
  { label: '歸屬於非控制權益淨利', key: 'profit_loss_attributable_to_noncontrolling_interests', indent: true },
  // No single "OCI total" field in the real payload, only its components
  // (oci_will_be_reclassified_net_of_tax / oci_will_not_be_reclassified_net_of_tax) — left
  // unmapped rather than hand-summed into a number bff-ts never itself vouches for.
  { label: '其他綜合損益', indent: true },
  { label: '本期綜合損益總額', emphasis: true },
  { label: '基本每股盈餘（元）', key: 'basic_earnings_loss_per_share', emphasis: true },
  { label: '稀釋每股盈餘（元）', key: 'diluted_earnings_loss_per_share', indent: true }
]

export const CASH_FLOW_STATEMENT_ROWS: StatementRow[] = [
  // No standalone "稅前淨利"/"其他調整項目合計" fields in the real cash-flow payload (it starts
  // straight from the reconciling adjustment line items themselves) — left unmapped rather than
  // guessed or hand-summed.
  { label: '稅前淨利', indent: true },
  { label: '折舊費用', key: 'adj_depreciation_expense', indent: true },
  { label: '攤銷費用', key: 'adj_amortisation_expense', indent: true },
  { label: '其他調整項目合計', indent: true },
  { label: '營業活動產生之現金', key: 'cash_flows_from_used_in_operations', indent: true },
  { label: '支付所得稅', key: 'income_taxes_paid_refund_operating', indent: true },
  { label: '營業活動之淨現金流入（出）', key: 'cash_flows_from_used_in_operating_activities', emphasis: true },
  { label: '取得不動產、廠房及設備', key: 'purchase_of_ppe_investing', indent: true },
  { label: '處分不動產、廠房及設備價款', key: 'proceeds_from_sales_of_ppe_investing', indent: true },
  { label: '取得無形資產', key: 'purchase_of_intangible_assets_investing', indent: true },
  { label: '收取利息', key: 'interest_received_investing', indent: true },
  { label: '收取股利', key: 'dividends_received_investing', indent: true },
  { label: '投資活動之淨現金流入（出）', key: 'net_cash_flows_from_used_in_investing_activities', emphasis: true },
  { label: '發行公司債', key: 'proceeds_from_issuing_bonds', indent: true },
  { label: '償還公司債', key: 'repayments_of_bonds', indent: true },
  { label: '舉借長期借款', key: 'proceeds_from_long_term_debt', indent: true },
  { label: '償還長期借款', key: 'repayments_of_long_term_debt', indent: true },
  { label: '發放現金股利', key: 'dividends_paid_financing', indent: true },
  { label: '支付利息', key: 'interest_paid_financing', indent: true },
  { label: '籌資活動之淨現金流入（出）', key: 'cash_flows_from_used_in_financing_activities', emphasis: true },
  { label: '匯率變動影響數', key: 'effect_of_exchange_rate_changes_on_cash_and_cash_equivalents', indent: true },
  { label: '本期現金及約當現金增加（減少）數', key: 'increase_decrease_in_cash_and_cash_equivalents', emphasis: true },
  { label: '期初現金及約當現金餘額', key: 'cash_and_cash_equivalents_at_beginning_of_period' },
  { label: '期末現金及約當現金餘額', key: 'cash_and_cash_equivalents_at_end_of_period', emphasis: true }
]

export const STATEMENT_DEFINITIONS: { key: StatementType; label: string; rows: StatementRow[] }[] = [
  { key: 'balanceSheet', label: '資產負債表', rows: BALANCE_SHEET_ROWS },
  { key: 'incomeStatement', label: '損益表', rows: INCOME_STATEMENT_ROWS },
  { key: 'cashFlowStatement', label: '現金流量表', rows: CASH_FLOW_STATEMENT_ROWS }
]

// Per-share lines are in 元; everything else on a filing is in 新台幣千元（confirmation requested
// from bff-ts 2026-09-19 — the endpoint doesn't state its unit）.
export const PER_SHARE_KEYS = new Set(['basic_earnings_loss_per_share', 'diluted_earnings_loss_per_share'])

// Deterministic thousands grouping for the bigint-precise strings bff-ts sends（no toLocaleString）.
export function formatStatementAmount(raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return '－'
  const negative = raw.startsWith('-')
  const digits = negative ? raw.slice(1) : raw
  const [integer, fraction] = digits.split('.')
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`
}

// 增減%（當期 vs 去年同期）, two decimals; null when either side is missing or the base is zero.
export function statementChangePercent(current: string | null | undefined, prior: string | null | undefined): string {
  if (!current || !prior) return '－'
  const now = Number(current)
  const then = Number(prior)
  if (!Number.isFinite(now) || !Number.isFinite(then) || then === 0) return '－'
  return `${(((now - then) / Math.abs(then)) * 100).toFixed(2)}%`
}
