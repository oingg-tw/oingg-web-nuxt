<script setup lang="ts">
// 持股管理的導覽（使用者 2026-10-05：「holdings sidebar 要有選項，可以跟大盤比對驗證特定日期間的績效」）。
// 版面與兩份 DOM 的理由在 SectionNav.vue。
const HOLDINGS_NAV_ITEMS = [
  { label: '持股總覽', to: '/holdings' },
  // 使用者 2026-10-05：「應該改名為交易績效，畢竟這邊計算的是已實現損益」
  { label: '交易績效', to: '/holdings/performance' },
  // 使用者 2026-10-05：「讓用戶可以自己定義，比如第二欄數值除以第一欄數值」「可能是另外的 sidebar 項目」
  { label: '自訂欄位', to: '/holdings/columns' }
]
</script>

<template>
  <SectionNav label="持股管理" :items="HOLDINGS_NAV_ITEMS" />
</template>
