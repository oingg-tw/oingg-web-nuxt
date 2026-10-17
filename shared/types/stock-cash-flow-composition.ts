import type { CashFlowComposition } from '../utils/cash-flow-composition'

// 現金流量的組成（GET /api/stock/:code/cash-flow-composition，2026-10-17）。金額千元。單季與年度各一份：現金流量是流量，年度是
// 四季相加（不是資產負債表那樣取 Q4 的時點），所以由伺服器加好；年度那一份的 fiscalQuarter 是 null。拆不開的單季是 null。
export interface CashFlowCompositionPeriod {
  fiscalYear: number
  fiscalQuarter: number | null
  cashFlow: CashFlowComposition | null
}

export interface StockCashFlowCompositionResponse {
  symbol: string
  // 由舊到新：單季在前、年度在後各自排序
  periods: CashFlowCompositionPeriod[]
}
