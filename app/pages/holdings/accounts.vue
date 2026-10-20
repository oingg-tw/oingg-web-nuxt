<script setup lang="ts">
// 帳戶管理（2026-10-19，使用者選「側欄加一頁帳戶管理」）：新增、改名、排序、刪除持股帳戶。切換在側欄最下面（HoldingsNav 的
// SharedScopeSwitch），只有兩個以上帳戶時才出現——所以一個帳戶的人要新增第二個，入口就是這一頁。操作與刪除的復原在
// SharedCollectionManager（觀察清單的清單管理也用它）。刪除帳戶＝連同它的所有交易一起刪（業務中台），提示寫明。
useSeoMeta({ title: '帳戶管理', robots: 'noindex, nofollow' })

const { portfolios, createPortfolio, renamePortfolio, deletePortfolio, reorderPortfolios } = useHoldingsPortfolios()
// 讀的時候畫上次那麼多列骨架（2026-10-20，useLayoutHint，帳戶數由側欄 HoldingsNav 記）；0＝上次一個帳戶都沒有，直接是那句說明
const accountCountHint = useLayoutHint('holdings-accounts', 1)
</script>

<template>
  <HoldingsPageShell
    title="帳戶管理"
    subtitle="一個券商一個帳戶，持股與成本各自計算；在側欄切換要看哪個帳戶"
    guest-title="登入後管理你的持股帳戶"
    guest-text="帳戶與交易紀錄存在你的帳號裡，只有你看得到。"
  >
    <template #default="{ loading }">
      <SharedCollectionManager
        :items="portfolios"
        :skeleton-rows="loading ? accountCountHint : 0"
        list-title="你的帳戶"
        empty-text="第一次記交易或匯入時，會自動建立「我的帳戶」。"
        add-title="新增帳戶"
        name-label="帳戶名稱（例如券商名稱）"
        placeholder="例如：元大"
        :delete-message="(name: string) => `已刪除「${name}」和它的所有交易`"
        :delete-label="(name: string) => `刪除「${name}」和它的所有交易`"
        :create="createPortfolio"
        :rename="renamePortfolio"
        :remove="deletePortfolio"
        :reorder="reorderPortfolios"
      />
    </template>
  </HoldingsPageShell>
</template>
