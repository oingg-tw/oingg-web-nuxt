<script setup lang="ts">
// 持股管理的導覽（使用者 2026-10-05：「holdings sidebar 要有選項，可以跟大盤比對驗證特定日期間的績效」）。
// 版面與兩份 DOM 的理由在 SectionNav.vue。
const HOLDINGS_NAV_ITEMS = [
  { label: '持股總覽', to: '/holdings' },
  // 使用者 2026-10-05：「希望持股分析獨立出來一個 sidebar，這樣就可以評估產業占比」
  { label: '持股分析', to: '/holdings/analysis' },
  // 使用者 2026-10-05：「應該改名為交易績效，畢竟這邊計算的是已實現損益」
  { label: '交易績效', to: '/holdings/performance' },
  // 使用者 2026-10-05：「讓用戶可以自己定義，比如第二欄數值除以第一欄數值」「可能是另外的 sidebar 項目」
  { label: '自訂欄位', to: '/holdings/columns' },
  // 以目前持股回推的風險指標（bff-ts 23b7b09）；放在側欄而不是交易績效頁，因為它描述的是「現在這組持股」，
  // 不是已實現的交易結果（2026-10-05 使用者同意這個放法）
  { label: '風險', to: '/holdings/risk' }
]
</script>

<template>
  <SectionNav label="持股管理" :items="HOLDINGS_NAV_ITEMS" />
</template>
