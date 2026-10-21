<script setup lang="ts">
// 除權息的側欄（2026-10-21，使用者：「設計成sidebar的另外一個項目」）：配息月曆看「哪一天有誰」，除權息月覽看「今年哪幾個月多」與每個月的全部標的。
// 版面與兩份 DOM 的理由在 SectionNav.vue
const ITEMS = [
  { label: '配息月曆', to: '/calendar' },
  { label: '除權息月覽', to: '/calendar/months' }
]
</script>

<template>
  <SectionNav label="除權息" :items="ITEMS" />
</template>
