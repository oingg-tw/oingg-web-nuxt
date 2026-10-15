<script setup lang="ts">
// 篩選區的導覽（2026-10-15，使用者：「股票篩選功能我知道要怎麼設計了，Sidebar那邊就放普通股篩選 特別股篩選 ETF 篩選」）。
// 版面與兩份 DOM 的理由在 SectionNav.vue（總經、持股管理、新手專區同一套）。
// activeTo：清單外的子頁（條件說明頁 /screener/{slug}、個別特別股頁）標在哪一項底下。
defineProps<{ activeTo?: string }>()

const SCREENER_NAV_ITEMS = [
  { label: '普通股篩選', to: '/screener' },
  { label: '特別股篩選', to: '/preferred-stocks' },
  { label: 'ETF 篩選', to: '/etf-zone' }
]
</script>

<template>
  <SectionNav label="股票篩選" :items="SCREENER_NAV_ITEMS" :active-to="activeTo" />
</template>
