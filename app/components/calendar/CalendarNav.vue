<script setup lang="ts">
// 除權息的側欄（2026-10-21，使用者：「設計成sidebar的另外一個項目」）：配息月曆看「哪一天有誰」，除權息月覽看「今年哪幾個月多」與每個月的全部標的。
// 版面與兩份 DOM 的理由在 SharedSectionNav.vue。月覽 2026-11-10 改名「全年除權息」（使用者：「side menu 名稱 除權息月覽 改成 全年除權息」），
// 網站導覽的入口、那一頁的標題與麵包屑跟著改，同一頁不叫兩個名字
const ITEMS = [
  { label: '配息月曆', to: '/calendar' },
  { label: '全年除權息', to: '/calendar/months' }
]
</script>

<template>
  <SharedSectionNav label="除權息" :items="ITEMS" />
</template>
