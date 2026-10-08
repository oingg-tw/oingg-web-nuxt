// 包住全域 $fetch（Nuxt 把它放在 globalThis.$fetch，每個檔案自動匯入的 $fetch 就是同一個參照）：任何一支 composable 的後端
// 請求失敗時立刻通知 useSystemHealth 的 reportFailure()，不用等它 30 秒一次的輪詢（2026-09-14 使用者回報「searchbar 沒反應就以為
// 網站掛了，其實是連線問題」）。各 composable 自己的 try/catch 與空狀態不變；reportFailure 會再經 /api/system-health 確認，
// 這裡的誤報會立刻自我修正。
export default defineNuxtPlugin(() => {
  const { reportFailure } = useSystemHealth()

  // 只有真的打業務中台的請求才觸發重新檢查：Nuxt 自己的 payload／資產請求與這支外掛的 /api/system-health（同網域、沒有
  // baseURL）不能被當成「業務中台掛了」、也不能遞迴觸發自己。apiFetch 一律帶 baseURL（直連 /api/core 或快取轉發 /api/bff）。
  function isBackendRequest(options: { baseURL?: string }): boolean {
    return options.baseURL === BFF_BASE || options.baseURL === BFF_CACHED_BASE
  }

  // $fetch.create() 在既有實例上疊這兩個 hook（每個呼叫端自己的 retry／timeout 照常），換掉全域參照就涵蓋全站
  const nativeFetch = globalThis.$fetch
  globalThis.$fetch = nativeFetch.create({
    onRequestError({ options }) {
      // 請求根本沒到伺服器（DNS、連線被拒、逾時）——就是「連線斷了，不是網站壞了」那種情況
      if (isBackendRequest(options)) reportFailure()
    },
    onResponseError({ options, response }) {
      // 有回應就只看 5xx；4xx（400／404）是全站「這個查詢沒資料」的日常慣例，不是連線問題
      if (isBackendRequest(options) && response.status >= 500) reportFailure()
    }
  }) as typeof globalThis.$fetch
})
