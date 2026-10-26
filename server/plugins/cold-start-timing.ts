// 冷啟動等待（2026-10-26，見 shared/utils/cold-start-timing.ts）：叫醒業務中台冷啟動的那個請求，回應帶 Server-Timing——
// 業務中台的冷啟動 id、web-nuxt 等它多久、web-nuxt 整趟多久、web-nuxt 行程已經啟動多久、是不是 web-nuxt 啟動後的第一個請求。
// 其他請求什麼都不加。業務中台內部的分段不在這裡（使用者：只給管理站）。
//
// 伺服器渲染時頁面打自己的 /api（$fetch 或 event.$fetch）是內部請求，Nitro 會替它開新的 async context，裡面的 useEvent() 只看得到
// 內部那個請求。所以在 Nitro 的處理函式外面再包一層：內部請求進來那一刻還在外層的 context 裡，先記下外層（coldStartParent），
// noteBusinessColdStart 一路往上記到使用者那個請求，beforeResponse 再寫進它的回應。
// performance.now() 在 Node 是行程啟動後的毫秒數，請求開始時讀一次，就同時是「行程啟動多久」與整趟計時的起點
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
    if (parent && parent !== event) event.context.coldStartParent = parent
    return handler(event)
  }
  nitroApp.hooks.hook('request', (event) => {
    event.context.coldStartClock = { startedAt: performance.now(), first: served++ === 0 }
  })
  nitroApp.hooks.hook('beforeResponse', (event) => {
    const cold = event.context.coldStart
    const clock = event.context.coldStartClock
    if (!cold || !clock || event.node.res.headersSent) return
    setResponseHeader(event, 'server-timing', coldStartServerTiming(cold.id, cold.waitMs, performance.now() - clock.startedAt, clock.startedAt, clock.first))
  })
})

declare module 'h3' {
  interface H3EventContext {
    coldStartClock?: { startedAt: number; first: boolean }
    // 伺服器渲染時發出這個內部請求的外層請求
    coldStartParent?: H3Event
  }
}
