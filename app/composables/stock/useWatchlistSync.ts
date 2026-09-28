// 登入時把帳號裡的觀察清單整份載下來（2026-09-28）。新增與刪除不在這裡——那兩個動作發生在使用者
// 按下去的當下，直接由 useStocks 的 addStock/removeStock 打 API，沒有 watcher 生命週期的問題。
// 這支只負責「一登入就把清單換成帳號裡的那一份」。
//
// **必須從 app.vue 呼叫，不能從頁面元件。** watcher 註冊在哪個元件就綁在哪個元件上，Vue 會在它 unmount
// 時自動停掉——觀察清單頁一離開就 unmount，而 `applying` 是 session 級的 useState，之後再也不會重新註冊。
// 這個坑 2026-09-09 在 useStockDetailPreferencesSync 上踩過一次，症狀是「儲存功能並未生效」。
//
// 不做合併：登入時遠端那一份直接取代本地。未登入時加的股票不會在登入後被推上去，因為那需要一支
// 整份取代的端點（POST 是單筆、重複回 409），逐筆補推的失敗處理比它換來的價值複雜。使用者的預期
// 也比較接近「登入之後看到的是我帳號裡的清單」，而不是「兩份被靜靜合成一份」。
export function useWatchlistSync() {
  const { watchlistCodes, watchlistIds } = useStocks()
  const currentUser = useCurrentUser()
  // currentUser 一開始是 null，而「確定沒登入」也是 null——只看它分不出這兩件事，會讓訪客的清單
  // 被一次空載入清掉。見 useAuthResolved.ts 自己的註解。
  const authResolved = useAuthResolved()
  const { fetchWatchlist } = useUserWatchlist()

  const syncedFromServer = useState('watchlist-synced-from-server', () => false)
  const applying = useState('watchlist-sync-applying-started', () => false)
  const watchlistSyncPending = useState('watchlist-sync-pending', () => false)

  onMounted(() => {
    if (applying.value) return
    applying.value = true
    usePostLoginLoader().registerPending(watchlistSyncPending)

    watch(
      [authResolved, currentUser],
      async ([resolved, user]) => {
        if (!resolved) return
        if (!user) {
          // 登出：把本地清單與 id 表清掉，否則下一個人在同一個分頁登入會先看到上一個人的清單。
          if (syncedFromServer.value) {
            syncedFromServer.value = false
            watchlistCodes.value = []
            watchlistIds.value = {}
          }
          return
        }
        if (syncedFromServer.value) return
        syncedFromServer.value = true
        watchlistSyncPending.value = true
        const items = await fetchWatchlist()
        watchlistSyncPending.value = false
        // undefined ＝ 這次沒問到（網路或驗證失敗），保留本地不動；[] ＝ 帳號裡真的是空的，要套用。
        // 把前者當後者會在一次網路失敗之後清空使用者的清單。
        if (items === undefined) return
        watchlistCodes.value = items.map(item => item.symbol)
        watchlistIds.value = Object.fromEntries(items.map(item => [item.symbol, item.id]))
      },
      { immediate: true }
    )
  })
}
