// 冷啟動等待（2026-10-26，見 shared/utils/cold-start-timing.ts）：叫醒業務中台冷啟動的那個請求，回應帶 Server-Timing——
// 業務中台的冷啟動 id、web-nuxt 等它多久、web-nuxt 整趟多久、是不是這個 isolate 的第一個請求、使用者連進的 Cloudflare 機房。
// 每個回應都帶（2026-10-27 使用者決定）：沒有冷啟動的只是少了 cold 那幾項，量測就不會因為「這次剛好沒叫醒」而缺資料；瀏覽器只對
// 有 cold 的回應送報告，所以報告數量不變。業務中台內部的分段不在這裡（使用者：只給管理站）。
//
// 伺服器渲染時頁面打自己的 /api（$fetch 或 event.$fetch）是內部請求，Nitro 會替它開新的 async context，裡面的 useEvent() 只看得到
// 內部那個請求。所以在 Nitro 的處理函式外面再包一層：內部請求進來那一刻還在外層的 context 裡，先記下外層（coldStartParent），
// noteBusinessCall 一路往上記到使用者那個請求，beforeResponse 再寫進它的回應。
import type { H3Event } from 'h3'

let served = 0

export default defineNitroPlugin((nitroApp) => {
  const handler = nitroApp.h3App.handler
  nitroApp.h3App.handler = (event: H3Event) => {
    let parent: H3Event | null = null
    try {
      parent = useEvent()
    } catch {
      parent = null
    }
    if (parent && parent !== event) {
      event.context.coldStartParent = parent
      // Cloudflare Workers（2026-10-27）：頁面用全域 $fetch 打自己的 /api 時，Nitro 不把外層的 waitUntil 交給內部請求，內部快取的背景重算
      // 在外層回應送出後就被砍掉（業務中台照樣被叫醒，KV 卻沒更新）。沿用外層的；本機（Node）兩邊都沒有，什麼都不變
      event.context.waitUntil ??= parent.context.waitUntil
    }
    return handler(event)
  }
  nitroApp.hooks.hook('request', (event) => {
    event.context.coldStartClock = { startedAt: performance.now(), first: served++ === 0 }
  })
  nitroApp.hooks.hook('beforeResponse', (event) => {
    const colds = event.context.coldStarts ?? []
    const clock = event.context.coldStartClock
    if (!clock || event.node.res.headersSent) return
    setResponseHeader(event, 'server-timing', coldStartServerTiming(colds, unionMs(event.context.businessWaits ?? []), performance.now() - clock.startedAt, clock.first, event.context.cf?.colo ?? null,
      event.context.cf?.clientTcpRtt ?? null, event.context.analysisWake ?? null))
    // 一個 id 只能有一份報告（業務中台同一個 id 再送會覆蓋）：/api/core 會照轉業務中台的 max-age，這個回應被快取的話，之後讀快取
    // 又會看到同一個 id、送一份幾乎是 0 的報告蓋掉真的。每次冷啟動只有這一個回應，不快取它沒有代價
    if (colds.length) setResponseHeader(event, 'cache-control', 'no-store')
  })
})

declare module 'h3' {
  interface H3EventContext {
    coldStartClock?: { startedAt: number; first: boolean }
    // 伺服器渲染時發出這個內部請求的外層請求
    coldStartParent?: H3Event
    // Cloudflare Workers 的 request.cf（Nitro 放進 context）：colo 是使用者連進的機房，程式改在別處執行（placement）時也是入口那個；
    // clientTcpRtt 是使用者到那個機房的 TCP 來回（ms）。本機沒有
    cf?: { colo?: string; clientTcpRtt?: number }
  }
}
