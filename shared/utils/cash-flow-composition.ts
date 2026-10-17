// 現金流量的組成：一期的現金收入與支出拆成幾個大項（2026-10-17，使用者：「個股指標頁面我需要一個現金流量的組成 就知道支出與收入占比」，
// 選了「幾個大項」、預設年度）。
//
// 來源是現金流量表原始科目（GET /stocks/:symbol/financial-statement?statementType=cashFlowStatement，千元字串，單季，流入正、流出負）。
// 營業、投資、籌資三個小計與匯率影響都是上游的原生欄位，四者相加必須等於現金增減——這是真的驗算，不是用恆等式推出來的第三段
//（2026-09-27 擋下這一頁的理由）。2026-10-17 驗過：抽 40 檔 × 近 8 季，有現金流量表的 248 份全部三個小計都有、相加差 ≤ 1 千元、
// 期初＋增減＝期末；沒有現金流量表的 72 份全是 9 家興櫃或剛上櫃的公司（資產負債表有、現金流量表沒有，已回報上游）。
//
// 小計之下只拆最常被問的幾項，其餘歸進同一段的「其他」（殘差，同 balance-composition.ts 的其他），所以各段一定加得回上游的小計。
// 借款類科目用正負號分舉借與償還：短期借款、應付短期票券有的公司報增減兩個科目、有的報一個淨額，看號碼比看科目名稱可靠。
//
// shared/utils 不 import 任何東西（scripts/check-balance-composition.mjs 直接載入）。

const CAPEX_KEYS = ['purchase_of_ppe_classified_as_investing_activities', 'purchase_of_intangible_assets_investing', 'acquisition_of_use_of_right_assets'] as const
const DEBT_KEYS = [
  'proceeds_from_issuing_bonds', 'repayments_of_bonds',
  'proceeds_from_long_term_debt', 'repayments_of_long_term_debt',
  'increase_in_short_term_loans', 'decrease_in_short_term_loans',
  'increase_in_short_term_notes_and_bills_payable', 'decrease_in_short_term_notes_and_bills_payable',
  'increase_in_other_borrowings', 'decrease_in_other_borrowings'
] as const

export type CashFlowPart = 'operating' | 'capex' | 'otherInvesting' | 'dividends' | 'borrowing' | 'repayment' | 'otherFinancing' | 'exchangeRate'

export const CASH_FLOW_PART_LABELS: Record<CashFlowPart, string> = {
  operating: '營業活動',
  capex: '資本支出',
  otherInvesting: '其他投資活動',
  dividends: '發放現金股利',
  borrowing: '舉借債務',
  repayment: '償還債務',
  otherFinancing: '其他籌資活動',
  exchangeRate: '匯率影響'
}

// 給組成圖（StockBalanceCompositionChart）的合計名稱與各項名稱，同 BALANCE_COMPOSITION_KINDS 的形狀
export const CASH_FLOW_COMPOSITION_KIND = { total: '現金增減', labels: CASH_FLOW_PART_LABELS as Record<string, string> }

export interface CashFlowComposition {
  // 現金增減（千元）＝各項相加
  netChange: number
  parts: Record<CashFlowPart, number>
}

const value = (statement: Record<string, string | null>, key: string): number | null => {
  const raw = statement[key]
  if (raw === null || raw === undefined || raw === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function cashFlowCompositionOf(statement: Record<string, string | null> | null | undefined): CashFlowComposition | null {
  if (!statement) return null
  const operating = value(statement, 'cash_flows_from_used_in_operating_activities')
  const investing = value(statement, 'net_cash_flows_from_used_in_investing_activities')
  const financing = value(statement, 'cash_flows_from_used_in_financing_activities')
  const netChange = value(statement, 'increase_decrease_in_cash_and_cash_equivalents')
  if (operating === null || investing === null || financing === null || netChange === null) return null
  const exchangeRate = value(statement, 'effect_of_exchange_rate_changes_on_cash_and_cash_equivalents') ?? 0
  // 容差 1 千元：上游各欄各自四捨五入到千元
  if (Math.abs(operating + investing + financing + exchangeRate - netChange) > 1) return null

  const sum = (keys: readonly string[]) => keys.reduce((total, key) => total + (value(statement, key) ?? 0), 0)
  const debt = DEBT_KEYS.map(key => value(statement, key) ?? 0)
  const capex = sum(CAPEX_KEYS)
  const dividends = value(statement, 'dividends_paid_classified_as_financing_activities') ?? 0
  const borrowing = debt.filter(amount => amount > 0).reduce((a, b) => a + b, 0)
  // 租賃本金也是還債（IFRS 16 把租賃當成借款）
  const repayment = debt.filter(amount => amount < 0).reduce((a, b) => a + b, 0) + (value(statement, 'payments_of_lease_liabilities_financing') ?? 0)
  return {
    netChange,
    parts: {
      operating,
      capex,
      otherInvesting: investing - capex,
      dividends,
      borrowing,
      repayment,
      otherFinancing: financing - dividends - borrowing - repayment,
      exchangeRate
    }
  }
}

// 年度＝同一個會計年度四季相加。少任何一季（含拆不開的那一季）就不算那一年：三季湊出來的「年度」會被讀成全年
export function annualCashFlow(quarters: { fiscalYear: number; fiscalQuarter: number; cashFlow: CashFlowComposition | null }[]): { fiscalYear: number; cashFlow: CashFlowComposition }[] {
  const years = [...new Set(quarters.map(quarter => quarter.fiscalYear))].sort((a, b) => a - b)
  return years.flatMap((year) => {
    const four = [1, 2, 3, 4].map(q => quarters.find(quarter => quarter.fiscalYear === year && quarter.fiscalQuarter === q)?.cashFlow ?? null)
    if (four.some(cashFlow => cashFlow === null)) return []
    const total = (pick: (cashFlow: CashFlowComposition) => number) => four.reduce((sum, cashFlow) => sum + pick(cashFlow!), 0)
    const parts = Object.fromEntries((Object.keys(CASH_FLOW_PART_LABELS) as CashFlowPart[]).map(part => [part, total(cashFlow => cashFlow.parts[part])])) as Record<CashFlowPart, number>
    return [{ fiscalYear: year, cashFlow: { netChange: total(cashFlow => cashFlow.netChange), parts } }]
  })
}
