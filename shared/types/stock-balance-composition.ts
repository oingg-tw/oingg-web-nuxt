import type { AssetComposition, DebtComposition, EquityComposition } from '../utils/balance-composition'

// 資產負債表的三種組成，逐季（GET /api/stock/:code/balance-composition，2026-10-12）。金額單位千元；拆不開的那一種是 null
// （金融業的資產與負債不分流動與非流動，淨值仍拆得開）。年度／單季、近N年由頁面的圖表控制項自己切。
export interface BalanceCompositionPeriod {
  fiscalYear: number
  fiscalQuarter: number
  totalAssets: number
  assets: AssetComposition | null
  debt: DebtComposition | null
  equity: EquityComposition | null
}

export interface StockBalanceCompositionResponse {
  symbol: string
  // 由舊到新
  periods: BalanceCompositionPeriod[]
}
