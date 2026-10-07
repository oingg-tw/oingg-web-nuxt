import type { LookbackWindow } from '~/utils/lookback-window'

// StockMetricHistoryChartInteractive 共用的 近1/2/3/5/8年 回溯窗狀態（2026-09-21，「期間要可以選1235年」；近8年留著是因為全站
// 每個回溯下拉都用同一組五個選項，見 lookback-window.ts）。
// 獨立的 key，不跟 useHistoricalStatisticsWindow 共用：那個驅動歷年統計表自己的窗，共用會讓一頁的切換默默改到另一頁
// （同 useStockPeriodSelection 對自己狀態的理由）。
export function useMetricHistoryChartWindow() {
  return useState<LookbackWindow>('metric-history-chart-window', () => '近5年')
}
