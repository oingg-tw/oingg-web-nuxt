<script setup lang="ts">
// 股東月曆的側欄（2026-10-21，使用者：「設計成sidebar的另外一個項目」）：月曆看「哪一天有誰除權息」，全年除權息看「今年哪幾個月多」與每個月的全部標的。
// 版面與兩份 DOM 的理由在 SharedSectionNav.vue。月覽 2026-11-10 改名「全年除權息」（使用者：「side menu 名稱 除權息月覽 改成 全年除權息」），
// 網站導覽的入口、那一頁的標題與麵包屑跟著改，同一頁不叫兩個名字。2026-11-25 配息月曆改名股東月曆（使用者：「配息月曆改名股東月曆，
// 這樣就可以把現金增資放到sidebar」）：側欄與第一項都叫股東月曆，現金增資接在最後（2026-11-26 頁面上線）
const ITEMS = [
  { label: '股東月曆', to: '/calendar' },
  { label: '全年除權息', to: '/calendar/months' },
  { label: '現金增資', to: '/calendar/capital-increases' }
]
</script>

<template>
  <SharedSectionNav label="股東月曆" :items="ITEMS" />
</template>
