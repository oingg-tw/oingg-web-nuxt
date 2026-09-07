// Shared chart-data shape for the stock-detail page's monthly-revenue chart
// (StockRevenueChart.vue). No real per-stock endpoint backs this one yet — the page shows
// StockChartShell.vue in its place until one does (see stock/[code].vue's own comment).
// ValuationBand/QuarterlyEpsPoint (for the old StockRiverChart.vue/StockEpsChart.vue) removed
// 2026-09-07 once analysis-ts's real GET /companies/metric-history shipped — that endpoint
// returns a single value per period, not the percentile-band shape ValuationBand assumed, and
// only a TTM series for eps, not the separate quarterly+TTM pair QuarterlyEpsPoint assumed, so
// both components were replaced by StockMetricHistoryChart.vue rather than adapted.
export interface MonthlyRevenue {
  month: string
  revenue: number
  yoy: number
}
