// Shared chart-data shapes for the stock-detail page's valuation/financial charts
// (StockRiverChart.vue, StockEpsChart.vue, StockRevenueChart.vue). No real per-stock endpoint
// backs any of these yet — the page shows StockChartShell.vue in their place until one does
// (see stock/[code].vue's own comment). Kept here, decoupled from any generator, so wiring up
// the real data later only means adding a fetch that produces this shape.
export interface ValuationBand {
  multiple: number
  label: string
  values: number[]
}

export interface MonthlyRevenue {
  month: string
  revenue: number
  yoy: number
}

export interface QuarterlyEpsPoint {
  quarter: string
  eps: number
  ttmEps: number
}
