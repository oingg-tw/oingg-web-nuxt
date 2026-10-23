<script setup lang="ts">
// 個股卡片的標題（2026-09-19 個股頁 a11y／SEO 重做）：原本每張卡各寫一個 <span class="x__title">，那不是標題。每頁一個 <h1>
// （StockSummaryCard）、每段一個 <h2>，卡片標題就是底下的 <h3>，螢幕報讀器的標題清單與爬蟲的大綱才看得到每張卡。
defineProps<{ title: string }>()
</script>

<template>
  <h3 class="stock-card-title">{{ title }}</h3>
</template>

<style scoped>
/* 跟原本的 <span> 標題一樣是 1rem、600 字重；不然 <h3> 預設的字級與外距會改掉每張卡的標題列。min-width: 0 讓長標題在標題列
   （旁邊有選單時）裡換行，不把選單擠出去 */
.stock-card-title {
  min-width: 0;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
  color: var(--el-text-color-primary);
}
</style>
