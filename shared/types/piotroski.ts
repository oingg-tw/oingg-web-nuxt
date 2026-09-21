// Wire shape of bff-ts's GET /stocks/:symbol/piotroski-breakdown — shared by
// usePiotroskiBreakdown.ts (re-exported there, with the full history of the shape) and
// server/utils/stock-data.ts.

export interface PiotroskiBreakdownGroups {
  profitability: {
    positiveRoa: boolean | null
    positiveCfo: boolean | null
    roaImproved: boolean | null
    accrualQuality: boolean | null
  }
  leverageLiquidity: {
    leverageDecreased: boolean | null
    liquidityImproved: boolean | null
    noDilution: boolean | null
  }
  operatingEfficiency: {
    grossMarginImproved: boolean | null
    assetTurnoverImproved: boolean | null
  }
}

export interface PiotroskiGroupMetadata {
  key: 'profitability' | 'leverageLiquidity' | 'operatingEfficiency'
  name: string
  nameEn: string
  summary: string
  detail: string
  denominator: number
}

export interface PiotroskiBreakdown {
  symbol: string
  found: boolean
  fiscalYear: number | null
  fiscalQuarter: number | null
  knowledgeDate: string | null
  knowledgeDateIsFallback: boolean | null
  totalScore: number | null
  groups: PiotroskiBreakdownGroups | null
  // Static (not per symbol) — present even when found: false. Optional until analysis-ts ships it.
  signalLabels?: Record<string, string>
  groupMetadata?: PiotroskiGroupMetadata[]
}
