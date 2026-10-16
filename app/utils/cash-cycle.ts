import type { MetricsHistoryEntry } from '#shared/types/metrics-history'

// 現金循環的互動時間軸畫哪一期（/cash-cycle 與指標速覽共用，2026-10-16）：五個天數都在的最新一期。不是單純取最後一期：上游缺口會
// 讓最近幾期整片是 null（2412 就是這樣），取最後一期會得到一頁空白，往回找則會顯示它最後一次算得出來的那一期，並在旁邊標明是哪一期。
export function latestCashCycleEntry(entries: MetricsHistoryEntry[]): MetricsHistoryEntry | null {
  return [...entries].reverse().find(entry =>
    ['inventoryDays', 'receivablesDays', 'payablesDays', 'operatingCycle', 'cashConversionCycle']
      .every(metricCode => entry.values[metricCode]?.value != null)) ?? null
}
