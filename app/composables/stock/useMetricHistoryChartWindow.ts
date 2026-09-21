import type { LookbackWindow } from '~/utils/lookback-window'

// Shared 近1/2/3/5/8年 lookback-window state for StockMetricHistoryChart.vue (2026-09-21, direct
// request「stock-metric-page__card 卡片要可以切換單季或是近四季，期間要可以選1235年」— the 5-option
// scale it's built on already covers 1/2/3/5, 近8年 stays in per this app's own standing rule that
// every lookback dropdown uses the same 5 options, see lookback-window.ts's own comment).
//
// A dedicated key, not useHistoricalStatisticsWindow's — that one drives 歷年統計表's own window;
// sharing it would mean switching the window on one page silently moved it on a completely
// unrelated one, the same reasoning useStockPeriodSelection.ts documents for its own state.
export function useMetricHistoryChartWindow() {
  return useState<LookbackWindow>('metric-history-chart-window', () => '近5年')
}
