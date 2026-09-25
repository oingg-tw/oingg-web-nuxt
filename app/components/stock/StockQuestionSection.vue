<script setup lang="ts">
import type { Component } from 'vue'
// One document-style section of a /stock/:code page (2026-09-19, the SEO build): a question-form
// heading（「台積電（2330）配了多少股利？殖利率多少？」）, a short number-led answer paragraph, then
// whatever the section shows（a table, at most one chart）. The user's own reason for this shape:
// a card per metric had made the pages look cluttered; a question, its answer and one table read
// like a page about the company. tabindex="-1" so an in-page link to the section moves focus into
// it. `answer` is omitted, not replaced by a placeholder, when the page has no number for it.
withDefaults(
  defineProps<{
    id: string
    question: string
    // 可選的標題圖示（2026-09-26，/stock/{code}/metrics 一頁七段，需要讓讀者用形狀掃而不是逐段讀
    // 標題）。純裝飾：問句本身就在旁邊，所以標成 aria-hidden，可及名稱不變——跟側邊欄的 icon 同一條
    // 規則。沒傳就什麼都不渲染，其他頁面不受影響。
    icon?: Component
    answer?: string | null
    level?: 'h2' | 'h3'
  }>(),
  { answer: null, level: 'h2', icon: undefined }
)
</script>

<template>
  <section :id="id" class="stock-page-section stock-question-section" :aria-labelledby="`${id}-heading`" tabindex="-1">
    <component :is="level" :id="`${id}-heading`" class="stock-page-section__title">
      <el-icon v-if="icon" class="stock-question-section__icon" aria-hidden="true"><component :is="icon" /></el-icon>{{ question }}
    </component>
    <p v-if="answer" class="stock-answer">{{ answer }}</p>
    <slot />
  </section>
</template>

<style scoped>
.stock-question-section {
  scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 16px);
}

.stock-question-section__icon {
  margin-right: 8px;
  vertical-align: -0.1em;
  color: var(--el-color-primary);
}

.stock-question-section:focus:not(:focus-visible) {
  outline: none;
}
</style>
