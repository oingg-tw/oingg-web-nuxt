<script setup lang="ts">
// 觀察清單的側欄（2026-10-19，使用者：「觀察清單是否可以比照持股那邊的設計辦理」）：跟持股一樣，頁面連結在上（清單、清單管理，管理上面一條
// 分隔線），切換哪一組在最下面（SharedScopeSwitch，兩組以上才有）；手機是同一份清單收在底部條，「目前：」後面寫出正在看哪一組。
// 版面與兩份 DOM 的理由在 SectionNav.vue。
const WATCHLIST_NAV_ITEMS = [
  { label: '觀察清單', to: '/watchlist' },
  // 新增、改名、排序、刪除。一組的人也找得到（切換那一段只在兩組以上時才有）
  { label: '清單管理', to: '/watchlist/lists', divided: true }
]

const { watchlists, activeWatchlist, activeWatchlistId } = useStocks()
const currentUser = useCurrentUser()
const route = useRoute()
const showSwitch = computed(() => !!currentUser.value && watchlists.value.length > 1)
const listItems = computed(() => watchlists.value.map(({ id, name }) => ({ id: id as string | null, name })))
const currentList = computed(() => (showSwitch.value ? activeWatchlist.value?.name ?? null : null))

// 在清單管理頁點某一組＝想看那一組：回到清單頁（持股的帳戶不同，換帳戶時每一頁都跟著換，所以留在原頁）
function select(id: string | null) {
  if (!id) return
  activeWatchlistId.value = id
  if (route.path !== '/watchlist') void navigateTo({ path: '/watchlist', query: { list: id } })
}
</script>

<template>
  <SectionNav label="觀察清單" :items="WATCHLIST_NAV_ITEMS" :current-detail="currentList">
    <template #after>
      <SharedScopeSwitch v-if="showSwitch" heading="清單" :items="listItems" :active-id="activeWatchlist?.id ?? null" @select="select" />
    </template>
  </SectionNav>
</template>
