<script setup lang="ts">
// 新手專區的導覽（2026-10-12 重做）：從哪裡開始＋六組。指標頁與主題頁不在清單上，傳所屬組的路徑標出目前位置。
// 版面與兩份 DOM 的理由都在 SectionNav.vue。
defineProps<{ activeTo?: string }>()
</script>

<template>
  <SectionNav label="新手專區" :items="LEARN_NAV_ITEMS" :active-to="activeTo" />
</template>
