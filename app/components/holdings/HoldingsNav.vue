<script setup lang="ts">
// 持股管理的導覽（使用者 2026-10-05：「holdings sidebar 要有選項，可以跟大盤比對驗證特定日期間的績效」）。
// 版面與兩份 DOM 的理由在 SectionNav.vue。
// 2026-10-07 重排（使用者：「performance 這一頁太亂了，請把指標拆去別的畫面。盤點一下整個持股管理功能怎麼調整好，
// Sidebar應該有那些項目」）：依「現在有什麼 → 過去發生了什麼 → 風險 → 設定」排。原本的「交易績效」拆成報酬與大盤、
// 已實現損益、績效統計三頁；自訂欄位是總覽表格的設定，移到最後。
// 2026-10-19 分成三組（使用者：「我認為 sidebar 要說明更清楚。也就是把現在持有的與期間持有的分開看」——起因是績效統計的 Beta 0.45 與
// 風險頁的 Beta（回推）0.3 對不上：前者是這段期間實際持有過的組合，後者是現在這組持股回推）。配息日程放「現在持有的」（使用者選的：
// 主要是看接下來的，用現在的持股估算）。
const HOLDINGS_NAV_ITEMS = [
  { label: '持股總覽', to: '/holdings', heading: '現在持有的' },
  // 使用者 2026-10-05：「希望持股分析獨立出來一個 sidebar，這樣就可以評估產業占比」
  { label: '持股分析', to: '/holdings/analysis' },
  // 使用者 2026-10-17：「持股管理那邊也要加上配息日程。放配息表格」
  { label: '配息日程', to: '/holdings/dividends' },
  // 以目前持股回推的風險指標（業務中台 23b7b09）：描述的是「現在這組持股」，不是已實現的交易結果
  { label: '風險', to: '/holdings/risk' },
  // 這段期間實際持有過的組合。已實現損益放第一個（使用者 2026-10-19「期間持有的 已經實現損益放第一個」）
  { label: '已實現損益', to: '/holdings/realized', heading: '期間持有的' },
  // 原「交易績效」的報酬部分（路徑沿用）
  { label: '報酬與大盤', to: '/holdings/performance' },
  // 捕獲率、Beta、Sharpe 這些進階統計，名詞門檻高，自成一頁
  { label: '績效統計', to: '/holdings/statistics' },
  // 使用者 2026-10-05：「讓用戶可以自己定義，比如第二欄數值除以第一欄數值」「可能是另外的 sidebar 項目」
  { label: '自訂欄位', to: '/holdings/columns', heading: '設定' },
  // 2026-10-19 使用者選「側欄加一頁帳戶管理」：新增、改名、刪除、排序帳戶。一個帳戶的人也找得到（切換那一段只在兩個以上帳戶時才有）
  { label: '帳戶管理', to: '/holdings/accounts' }
]

// 帳戶切換在側欄最下面（SharedScopeSwitch，兩個以上帳戶才有）；兩個以上帳戶時，手機底部條寫出正在看哪個帳戶（手機看不到側欄）。
// 讀到帳戶清單之前（ready）不能選（還不知道 ?account= 指的帳戶在不在），畫上次那麼多帳戶的骨架（2026-10-20）：側欄垂直置中，這一段
// 讀完才出現的話整個側欄往上跳。帳戶數記在這裡（持股每一頁都有側欄），帳戶管理頁的骨架讀同一個提示
const { portfolios, selectedPortfolioId, selected, ready } = useHoldingsPortfolios()
const { member } = useMemberGate()
const accountCountHint = useLayoutHint('holdings-accounts', 1)
watch(() => (ready.value ? portfolios.value.length : null), (count) => {
  if (count !== null) accountCountHint.value = count
})
// 多一列是「全部帳戶」
const skeletonRows = computed(() => (!ready.value && member.value && accountCountHint.value > 1 ? accountCountHint.value + 1 : 0))
const showSwitch = computed(() => ready.value && portfolios.value.length > 1)
const accountItems = computed(() => [{ id: null, name: '全部帳戶' }, ...portfolios.value.map(({ id, name }) => ({ id: id as string | null, name }))])
const currentAccount = computed(() => (showSwitch.value ? selected.value?.name ?? '全部帳戶' : null))
</script>

<template>
  <SectionNav label="持股管理" :items="HOLDINGS_NAV_ITEMS" :current-detail="currentAccount">
    <template #after>
      <SharedScopeSwitch
        v-if="showSwitch || skeletonRows"
        heading="帳戶"
        :items="accountItems"
        :active-id="selected?.id ?? null"
        :skeleton-rows="skeletonRows"
        @select="(id) => { selectedPortfolioId = id }"
      />
    </template>
  </SectionNav>
</template>
