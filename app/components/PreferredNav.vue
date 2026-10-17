<script setup lang="ts">
// 特別股專區的導覽（2026-10-18）。項目與順序在 app/utils/preferred-zone.ts；版面與兩份 DOM 的理由在 SectionNav.vue。
// 個別特別股頁傳 activeTo="/preferred"：它不在清單裡，但屬於「特別股總覽」那一項
defineProps<{ activeTo?: string }>()
</script>

<template>
  <SectionNav label="特別股專區" :items="PREFERRED_NAV_ITEMS" :active-to="activeTo" />
</template>
