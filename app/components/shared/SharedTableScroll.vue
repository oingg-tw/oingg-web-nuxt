<script setup lang="ts">
// Horizontal-scroll container for the server-rendered data tables added in the 2026-09-19 SEO
// build（類股名單表、配息數列表、公司健檢的單季表、三大報表…）. A wide table on a phone scrolls
// sideways under a finger but a keyboard user can't reach or move it — axe
// `scrollable-region-focusable`. Element Plus tables get that fixed after mount by
// useFocusableTableScroll (their scroll wrap is EP's own client DOM); these plain <table>s are in
// the HTML from the start, so the region attributes are simply rendered here. The global
// :focus-visible ring then marks the container when tabbed to, and arrow keys scroll it.
// 2026-10-23 起它也是表格的卡片（main.css 的「全站表格」.app-table-card）：表格在卡片裡邊到邊，捲動也在卡片裡
defineProps<{
  // What the table is（「半導體業公司名單」）— announced as「…，可左右捲動」.
  label: string
}>()
</script>

<template>
  <div class="shared-table-scroll app-table-card" tabindex="0" role="region" :aria-label="`${label}，可左右捲動`">
    <slot />
  </div>
</template>

<style scoped>
.shared-table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
