import type { ChartEmptyReport } from '#shared/utils/chart-empty'

// 空圖回報的瀏覽器那一半（2026-11-12，見 shared/utils/chart-empty.ts）：同一檔、同一張圖、同一組條件與原因，一個瀏覽階段只送一次
//（sessionStorage 讀不到就這一頁送一次）。sendBeacon 不看回應；伺服器端渲染時不送
export function reportChartEmpty(report: Omit<ChartEmptyReport, 'route'>): void {
  if (!import.meta.client || !navigator.sendBeacon) return
  const key = `chart-empty:${report.symbol}:${report.chart}:${report.metric}:${report.timeframe}:${report.lookbackYears}:${report.reason}`
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    // 私密瀏覽、封鎖網站資料：照送
  }
  navigator.sendBeacon('/api/chart-empty', JSON.stringify({ ...report, route: location.pathname }))
}

// 在畫面上停留 2 秒以上的空圖才送：資料陸續到的時候，中間會短暫出現別的空狀態（例如近四季全空、自動換成單季之前那一下）
export function watchChartEmpty(report: () => Omit<ChartEmptyReport, 'route'> | null): void {
  if (!import.meta.client) return
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(report, (next) => {
    clearTimeout(timer)
    if (next) timer = setTimeout(() => reportChartEmpty(next), 2000)
  }, { immediate: true })
  onUnmounted(() => clearTimeout(timer))
}
