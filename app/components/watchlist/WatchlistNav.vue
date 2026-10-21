<script setup lang="ts">
import type { StockNavNode } from '~/utils/stock-page-nav'
// 觀察清單的側欄。2026-10-21 重排（使用者：「watchlist sidebar 再調整下 用起來UIUX怪怪的」，選了「清單就是導覽」）：原本照持股的做法
// ——頁面連結（觀察清單、清單管理）在上、切換哪一組（SharedScopeSwitch）在最下面——但觀察清單只有一個內容頁，結果「觀察清單」跟
// 「存股名單」同時標成目前位置、在清單管理頁也還標著某一組，真正要選的東西又被排在最下面。現在每一組就是一個連結（/watchlist?list=），
// 清單管理在最後、隔一條線；任何時候只有一項是目前位置。一組都沒有（訪客、還沒加過）就是一個「觀察清單」。
// 同日「清單也要可以拖曳排序 這邊也是請抽成共用 因為機制跟個股瀏覽一樣」：用個股、ETF 同一個 StockPageNavList（拖曳那一段＝清單）。
// 拖曳的鍵盤與單指替代路徑是清單管理頁的上移／下移（WCAG 2.5.7）；手機不能拖（同個股）。順序存帳號（reorderWatchlists，失敗會還原）
const { watchlists, activeWatchlist, reorderWatchlists } = useStocks()
const currentUser = useCurrentUser()
const route = useRoute()
// 清單還在讀（同清單管理頁）：畫上次那麼多組的骨架（2026-10-20）。側欄垂直置中，晚出現的列會讓整個側欄跳。
// 組數記在這裡，觀察清單兩頁都有側欄，清單管理頁的骨架讀同一個提示
const { resolving, member } = useMemberGate()
const synced = useState('watchlist-synced-from-server', () => false)
const syncPending = useState('watchlist-sync-pending', () => false)
const loading = computed(() => resolving.value || (!!currentUser.value && (!synced.value || syncPending.value)))
const listCountHint = useLayoutHint('watchlist-lists', 1)
watch(() => (loading.value || !currentUser.value ? null : watchlists.value.length), (count) => {
  if (count !== null) listCountHint.value = count
})

const hasLists = computed(() => !loading.value && !!currentUser.value && watchlists.value.length > 0)
const listNodes = computed<StockNavNode[]>(() => {
  if (loading.value && member.value) return Array.from({ length: Math.max(listCountHint.value, 1) }, () => ({ label: '', skeleton: true }))
  if (!hasLists.value) return []
  const onListPage = route.path === '/watchlist'
  return watchlists.value.map(list => ({ label: list.name, to: () => `/watchlist?list=${list.id}`, current: onListPage && list.id === activeWatchlist.value?.id }))
})
const fixedNodes = computed<StockNavNode[]>(() => [
  // 一組都沒有時清單那一段是空的，留一個進觀察清單頁的連結
  ...(listNodes.value.length ? [] : [{ label: '觀察清單', to: () => '/watchlist' }]),
  // 新增、改名、排序、刪除
  { label: '清單管理', to: () => '/watchlist/lists', trailing: true }
])
// 手機底部條「目前：」：正在看的那一組，或清單管理
const currentLabel = computed(() => (route.path === '/watchlist/lists' ? '清單管理' : hasLists.value ? activeWatchlist.value?.name ?? null : '觀察清單'))

function move(oldIndex: number, newIndex: number) {
  if (!hasLists.value) return
  const ids = watchlists.value.map(list => list.id)
  const [moved] = ids.splice(oldIndex, 1)
  ids.splice(newIndex, 0, moved!)
  void reorderWatchlists(ids)
}
</script>

<template>
  <AppBottomNav :current="currentLabel" label="觀察清單導覽">
    <StockPageNavList :items="fixedNodes" :sortable-items="listNodes" :sortable-heading="listNodes.length ? '清單' : ''" label="觀察清單" @reorder="move" />
  </AppBottomNav>
  <AppNavRail label="觀察清單導覽（釘選）">
    <StockPageNavList :items="fixedNodes" :sortable-items="listNodes" :sortable-heading="listNodes.length ? '清單' : ''" label="觀察清單" @reorder="move" />
  </AppNavRail>
</template>
