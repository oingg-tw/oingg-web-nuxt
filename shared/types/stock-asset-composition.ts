import type { AssetComposition } from '../utils/asset-composition'

// 資產組成逐年一根柱子（GET /api/stock/:code/asset-composition，2026-10-12）。金額單位千元，分組見 shared/utils/asset-composition.ts。
export interface AssetCompositionPeriod extends AssetComposition {
  fiscalYear: number
  fiscalQuarter: number
  label: string
}

export interface StockAssetCompositionResponse {
  symbol: string
  periods: AssetCompositionPeriod[]
}
