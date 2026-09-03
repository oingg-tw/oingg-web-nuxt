// Data behind guru-tutorials.vue's radar chart. See project_guru_zone_radar_chart_idea memory
// for the full design history — short version: the radar never scores a COMPANY, it scores
// which analytical AXES the currently-selected indicators cover. Zero fabrication risk (no
// live per-stock value involved at this stage — see the separate, conductor-reviewed
// "apply to the user's own watchlist" phase for where a real per-stock value eventually
// enters the picture, once multi-watchlist support exists).
//
// Indicator keys here are a small, self-contained catalog — NOT yet matched against bff-ts's
// live /filters field IDs (useFilterSchema.ts's `<metricKey>.<fieldKey>` format). Wiring this
// to the real screener catalog (so "add indicator" pulls from the actual /filters schema
// instead of this fixed list) is a known follow-up, not done here — don't assume these keys
// resolve to a real screener field yet.

export type AxisKey = 'valuation' | 'growth' | 'profitability' | 'cashQuality' | 'resilience' | 'efficiency'

export interface RadarAxis {
  key: AxisKey
  label: string
}

// Fixed order — also the order axes render around the hexagon, starting from 12 o'clock
// going clockwise (matches IconHexagon.vue's own pointy-top orientation).
export const RADAR_AXES: RadarAxis[] = [
  { key: 'valuation', label: '估值' },
  { key: 'growth', label: '成長' },
  { key: 'profitability', label: '獲利能力' },
  { key: 'cashQuality', label: '現金品質' },
  { key: 'resilience', label: '財務韌性' },
  { key: 'efficiency', label: '營運效率' }
]

export interface GuruIndicator {
  key: string
  label: string
  // Which axes this indicator contributes to, and how much (usually 1 — Piotroski F-Score is
  // the one indicator that genuinely spans four axes at once, matching the original design
  // discussion's own worked example).
  weights: Partial<Record<AxisKey, number>>
}

// Small, hand-picked catalog — every guru below only ever references keys defined here, and
// "add indicator" (once built) will only ever offer entries from this same list, so the two
// can never drift out of sync with each other.
export const GURU_INDICATORS: GuruIndicator[] = [
  { key: 'per', label: '本益比（PER）', weights: { valuation: 1 } },
  { key: 'pbr', label: '股價淨值比（PBR）', weights: { valuation: 1 } },
  { key: 'peg', label: 'PEG 比率', weights: { valuation: 1, growth: 1 } },
  { key: 'dividendYield', label: '現金殖利率', weights: { valuation: 1 } },
  { key: 'roe', label: 'ROE（股東權益報酬率）', weights: { profitability: 1 } },
  { key: 'roic', label: 'ROIC（投入資本回報率）', weights: { profitability: 1 } },
  { key: 'grossMargin', label: '毛利率', weights: { profitability: 1 } },
  { key: 'epsYoy', label: 'EPS 年增率', weights: { growth: 1 } },
  { key: 'revenueYoy', label: '營收年增率', weights: { growth: 1 } },
  { key: 'fcfPayout', label: '自由現金流覆蓋率', weights: { cashQuality: 1 } },
  { key: 'accrualRatio', label: '應計利潤比率', weights: { cashQuality: 1 } },
  { key: 'debtRatio', label: '負債比率', weights: { resilience: 1 } },
  { key: 'currentRatio', label: '流動比率', weights: { resilience: 1 } },
  { key: 'interestCoverage', label: '利息保障倍數', weights: { resilience: 1 } },
  { key: 'dividendYears', label: '連續配息年數', weights: { resilience: 1 } },
  { key: 'payoutRatio', label: '配息率', weights: { cashQuality: 1 } },
  { key: 'assetTurnover', label: '總資產週轉率', weights: { efficiency: 1 } },
  { key: 'inventoryTurnover', label: '存貨週轉率', weights: { efficiency: 1 } },
  {
    key: 'piotroskiFScore',
    label: 'Piotroski F-Score',
    // The one indicator the original design discussion explicitly worked through as a
    // 4-way split, refining F-Score's own 3-category structure (收益性/財務健全/營運效率) by
    // pulling "cash quality" out as its own axis (F-Score's CFO>NI criterion is specifically
    // an earnings-quality check, not a raw profitability one).
    weights: { profitability: 1, cashQuality: 1, resilience: 1, efficiency: 1 }
  },
  { key: 'altmanZScore', label: 'Altman Z-Score', weights: { resilience: 1 } }
]

export const GURU_INDICATOR_MAP: Record<string, GuruIndicator> = Object.fromEntries(
  GURU_INDICATORS.map(indicator => [indicator.key, indicator])
)

export interface Guru {
  key: string
  name: string
  // Short line describing the guru's own core philosophy — shown in the character-select
  // preview pane, not a claim this app is making about any stock.
  tagline: string
  indicatorKeys: string[]
}

// Starting indicator sets below are a reasonable-effort mapping to each guru's own
// well-documented public criteria (see docs/product-design/oingg.com 台股選股 Preset 設計研究
// 報告.md's own master-strategy list) — not a precise, sourced-to-the-footnote reproduction of
// any one guru's exact published rule set. Editable by design (see the "add indicator" flow):
// treat these as a starting preset, never a final verdict on what "counts" as e.g. a real
// Graham stock.
export const GURUS: Guru[] = [
  {
    key: 'graham-value',
    name: '葛拉漢價值',
    tagline: '便宜、財務穩健的價值股',
    indicatorKeys: ['pbr', 'per', 'debtRatio', 'currentRatio']
  },
  {
    key: 'graham-netnet',
    name: '葛拉漢 Net-Net',
    tagline: '股價低於清算價值的深度價值股',
    indicatorKeys: ['pbr', 'currentRatio', 'debtRatio']
  },
  {
    key: 'buffett-moat',
    name: '巴菲特護城河',
    tagline: '長期高資本報酬、具定價權的優質企業',
    indicatorKeys: ['roe', 'roic', 'grossMargin', 'debtRatio']
  },
  {
    key: 'magic-formula',
    name: 'Magic Formula',
    tagline: '高盈餘殖利率＋高資本報酬率的組合排序',
    indicatorKeys: ['roic', 'per']
  },
  {
    key: 'lynch-garp',
    name: '彼得林區 GARP',
    tagline: '成長合理、價格也合理的中小型成長股',
    indicatorKeys: ['peg', 'epsYoy', 'revenueYoy']
  },
  {
    key: 'canslim',
    name: 'CANSLIM',
    tagline: '獲利與營收動能強勁的成長飆股',
    indicatorKeys: ['epsYoy', 'revenueYoy', 'roe']
  },
  {
    key: 'piotroski',
    name: 'Piotroski 品質濾網',
    tagline: '用九項財務體質檢驗避開價值陷阱',
    indicatorKeys: ['piotroskiFScore']
  },
  {
    key: 'dividend-income',
    name: '存股高殖利率',
    tagline: '長期穩定配息、注重現金流的收息股',
    indicatorKeys: ['dividendYield', 'dividendYears', 'payoutRatio', 'fcfPayout']
  }
]

// Sum of every selected indicator's weight on each axis, in RADAR_AXES' own fixed order —
// purely a count of "how much does this indicator set touch each axis," never a per-stock
// value. `indicatorKeys` may contain a key not present in GURU_INDICATOR_MAP (defensive only —
// shouldn't happen since "add indicator" is meant to only ever add real catalog keys).
export function computeAxisValues(indicatorKeys: string[]): number[] {
  return RADAR_AXES.map(axis =>
    indicatorKeys.reduce((sum, key) => sum + (GURU_INDICATOR_MAP[key]?.weights[axis.key] ?? 0), 0)
  )
}
