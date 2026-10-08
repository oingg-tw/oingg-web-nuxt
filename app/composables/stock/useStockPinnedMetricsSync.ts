// 使用者釘在個股側邊欄的指標：登入時從帳號載下來，之後每次變動整份 PUT 回去（2026-10-08，業務中台 e9c0786：
// GET/PUT /users/me/pinned-metrics，`{ slugs: string[] | null }`，整份取代、保序不去重、上限 50）。前身是卡片偏好那條同步鏈裡的
// pinnedMetricSlugs，那條鏈刪掉時把釘選的持久化一起帶走了，使用者決定開一支只放釘選的端點補回來。
//
// **必須從 app.vue 呼叫，不能從頁面元件**：watcher 綁在註冊它的元件上，頁面一卸載就停（2026-09-09 在前身上踩過，症狀是
// 「儲存功能並未生效」）。
//
// GET 回 null＝這個帳號從沒存過：保留本地預設，而且**不主動 PUT**——維持 null 代表「還在用預設」，之後改了預設他們會拿到新的。
// 登出時換回預設，同一個分頁換人登入才不會先看到上一個人的釘選。
export function useStockPinnedMetricsSync() {
  const { pinnedSlugs } = useStockPinnedMetrics()
  const authedFetch = useAuthedFetch()
  const currentUser = useCurrentUser()
  const authResolved = useAuthResolved()
  const applying = useState('pinned-metrics-sync-applying-started', () => false)
  const synced = useState('pinned-metrics-synced-from-server', () => false)
  const pending = useState('pinned-metrics-sync-pending', () => false)
  // 剛從帳號載下來（或剛存成功）的那一份；跟它相同的變動不 PUT，免得把載入的值原樣回寫一次
  let lastSaved = JSON.stringify(pinnedSlugs.value)

  onMounted(() => {
    if (applying.value) return
    applying.value = true
    usePostLoginLoader().registerPending(pending)

    watch(
      [authResolved, currentUser],
      async ([resolved, user]) => {
        if (!resolved) return
        if (!user) {
          if (synced.value) {
            synced.value = false
            pinnedSlugs.value = [...DEFAULT_PINNED_METRIC_SLUGS]
            lastSaved = JSON.stringify(pinnedSlugs.value)
          }
          return
        }
        if (synced.value) return
        synced.value = true
        pending.value = true
        try {
          const { slugs } = await authedFetch<{ slugs: string[] | null }>('/users/me/pinned-metrics')
          if (slugs !== null) {
            pinnedSlugs.value = slugs
            lastSaved = JSON.stringify(slugs)
          }
        } catch (error) {
          devWarn('pinned-metrics', 'GET /users/me/pinned-metrics failed', error)
        }
        pending.value = false
      },
      { immediate: true }
    )

    // 載入中的變動不存：GET 回來會整份蓋掉本地，存了也是白存
    watch(pinnedSlugs, async (slugs) => {
      const serialized = JSON.stringify(slugs)
      if (serialized === lastSaved || !currentUser.value || !synced.value || pending.value) return
      try {
        await authedFetch('/users/me/pinned-metrics', { method: 'PUT', body: { slugs } })
        lastSaved = serialized
      } catch (error) {
        devWarn('pinned-metrics', 'PUT /users/me/pinned-metrics failed', error)
      }
    })
  })
}
