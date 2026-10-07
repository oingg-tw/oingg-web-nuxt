<script setup lang="ts">
// 持股管理的導覽（使用者 2026-10-05：「holdings sidebar 要有選項，可以跟大盤比對驗證特定日期間的績效」）。
// 版面與兩份 DOM 的理由在 SectionNav.vue。
// 2026-10-07 重排（使用者：「performance 這一頁太亂了，請把指標拆去別的畫面。盤點一下整個持股管理功能怎麼調整好，
// Sidebar應該有那些項目」）：依「現在有什麼 → 過去發生了什麼 → 風險 → 設定」排。原本的「交易績效」拆成報酬與大盤、
// 已實現損益、績效統計三頁；自訂欄位是總覽表格的設定，移到最後。
const HOLDINGS_NAV_ITEMS = [
  { label: '持股總覽', to: '/holdings' },
  // 使用者 2026-10-05：「希望持股分析獨立出來一個 sidebar，這樣就可以評估產業占比」
  { label: '持股分析', to: '/holdings/analysis' },
  // 原「交易績效」的報酬部分（路徑沿用）
  { label: '報酬與大盤', to: '/holdings/performance' },
  { label: '已實現損益', to: '/holdings/realized' },
  // 捕獲率、Beta、Sharpe 這些進階統計，名詞門檻高，自成一頁
  { label: '績效統計', to: '/holdings/statistics' },
  // 以目前持股回推的風險指標（bff-ts 23b7b09）：描述的是「現在這組持股」，不是已實現的交易結果
  { label: '風險', to: '/holdings/risk' },
  // 使用者 2026-10-05：「讓用戶可以自己定義，比如第二欄數值除以第一欄數值」「可能是另外的 sidebar 項目」
  { label: '自訂欄位', to: '/holdings/columns' }
]
</script>

<template>
  <SectionNav label="持股管理" :items="HOLDINGS_NAV_ITEMS" />
</template>
