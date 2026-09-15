// Shared 近5年/近10年 lookback-window state for StockHistoricalStatisticsTable.vue (歷年統計表) —
// lifted out of the table component itself in case a future sibling control ever needs to read
// the same selection (see useStatementRowFocus.ts/useStockPeriodSelection.ts for this app's
// existing precedent for that pattern). Two other pieces of state used to live here and were both
// removed 2026-09-14:
//   - useHistoricalStatisticsChartedCodes (StockIndicatorTrendChart.vue's own "顯示於圖表"
//     selection) — removed per direct request ("我放棄我有點 複雜化了，把 指標走勢比較圖 拿掉。
//     勾選的機制也自然拿掉").
//   - useHistoricalStatisticsBasis (the TTM/單季 toggle) — removed per direct follow-up ("歷年
//     統計表的 資料與API 要調整 改成 不讓用戶選擇 單季 近四季 畢竟都顯示五年資料了 最新那一季
//     統一用 TTM 呈現 也不給改"); the table now hardcodes a local `ref<MetricsHistoryTimeframe>('TTM')`
//     itself instead, since nothing else needs to read that fixed value.
// 近5年/近10年 unified into the app-wide 近1/2/3/5/8年 scale 2026-09-14 — see
// app/utils/lookback-window.ts's own comment.
import type { LookbackWindow } from '~/utils/lookback-window'

export function useHistoricalStatisticsWindow() {
  return useState<LookbackWindow>('historical-statistics-table-window', () => '近5年')
}
