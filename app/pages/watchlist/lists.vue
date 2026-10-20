<script setup lang="ts">
// 清單管理（2026-10-19，使用者：「觀察清單是否可以比照持股那邊的設計辦理」）：新增、改名、排序、刪除觀察清單，同持股的帳戶管理
//（操作與刪除的復原都在 SharedCollectionManager）。切換在側欄最下面，只有兩組以上時才出現——一組的人要新增第二組，入口就是這一頁。
// 刪除一組＝連同裡面的股票一起刪（業務中台），提示寫明。
useSeoMeta({ title: '清單管理', robots: 'noindex, nofollow' })

const hasHydrated = useHasHydrated()
const authResolved = useAuthResolved()
const currentUser = useCurrentUser()
const { open: openLogin } = useLoginDialog()
// 清單是登入時由 app.vue 的 useWatchlistSync 讀進來的：讀到之前先不畫（不然會先閃「還沒有任何清單」）。synced 在開始讀時就是 true，
// 讀完要再看 sync-pending
const synced = useState('watchlist-synced-from-server', () => false)
const syncPending = useState('watchlist-sync-pending', () => false)
const { watchlists, createWatchlist, renameWatchlist, deleteWatchlist, reorderWatchlists } = useStocks()
</script>

<template>
  <div class="app-page watchlist-lists-page">
    <h1 class="app-page__title app-page__title--app">清單管理</h1>
    <p class="watchlist-lists-page__subtitle">每一組清單各自加股票、寫備註；顯示的欄位所有清單共用一套。在側欄切換要看哪一組</p>

    <WatchlistNav />

    <div v-if="!hasHydrated || !authResolved || (currentUser && (!synced || syncPending))" class="app-loading-placeholder" role="status"><span class="visually-hidden">載入中</span></div>

    <section v-else-if="!currentUser" class="watchlist-lists-page__guest">
      <h2 class="app-page__h2">登入後管理你的觀察清單</h2>
      <p class="watchlist-lists-page__subtitle">清單存在你的帳號裡，換電腦或手機都在。</p>
      <el-button type="primary" size="large" @click="openLogin">登入／註冊</el-button>
    </section>

    <SharedCollectionManager
      v-else
      :items="watchlists"
      list-title="你的清單"
      empty-text="第一次加入股票時，會自動建立「我的觀察清單」。"
      add-title="新增清單"
      name-label="清單名稱"
      placeholder="例如：存股名單"
      :delete-message="(name: string) => `已刪除「${name}」和裡面的股票`"
      :delete-label="(name: string) => `刪除「${name}」和裡面的股票`"
      :create="createWatchlist"
      :rename="renameWatchlist"
      :remove="deleteWatchlist"
      :reorder="reorderWatchlists"
    />
  </div>
</template>

<style scoped>
.watchlist-lists-page__subtitle {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
}

/* 同持股頁的訪客卡（HoldingsPageShell） */
.watchlist-lists-page__guest {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  margin-top: 24px;
  padding: 24px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}
</style>
