// 冷啟動等待（2026-10-26，見 shared/utils/cold-start-timing.ts）：回應的 Server-Timing 帶 cold 的，就是叫醒業務中台冷啟動的那個請求，
// 把瀏覽器量到的時間送回 /api/cold-start-timing。其他請求什麼都不送。打開頁面那一下（document）等頁面接手完再讀，那時早就收完了；
// 之後的 /api 請求（換頁、按鈕）用 PerformanceObserver 看。sendBeacon 自己的請求不看，免得回報又被當成回報
export default defineNuxtPlugin(() => {
  if (typeof PerformanceObserver === 'undefined' || !navigator.sendBeacon) return
  // 一個 id 只送一次（業務中台同一個 id 再送會覆蓋前一次）；伺服器那邊也讓帶 id 的回應不被快取
  const sent = new Set<string>()
  const send = (entry: PerformanceResourceTiming, kind: 'document' | 'api') => {
    // 一頁可能叫醒好幾個容器，每個 id 一份
    for (const report of coldStartReportsOf(entry, kind, performance.timeOrigin)) {
      if (sent.has(report.id)) continue
      sent.add(report.id)
      navigator.sendBeacon('/api/cold-start-timing', JSON.stringify(report))
    }
  }
  onNuxtReady(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (navigation) send(navigation, 'document')
  })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
      if ((entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') && new URL(entry.name).pathname.startsWith('/api/')) send(entry, 'api')
    }
  }).observe({ type: 'resource', buffered: true })
})
