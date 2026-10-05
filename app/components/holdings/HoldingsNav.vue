<script setup lang="ts">
// 持股管理的導覽（使用者 2026-10-05：「holdings sidebar 要有選項，可以跟大盤比對驗證特定日期間的績效」）。
// 版面與兩份 DOM 的理由在 SectionNav.vue。
const HOLDINGS_NAV_ITEMS = [
  { label: '持股總覽', to: '/holdings' },
  { label: '績效', to: '/holdings/performance' }
]
</script>

<template>
  <SectionNav label="持股管理" :items="HOLDINGS_NAV_ITEMS" />
</template>
