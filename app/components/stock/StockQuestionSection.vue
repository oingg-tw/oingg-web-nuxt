<script setup lang="ts">
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
    answer?: string | null
    // 答句還在讀取時放的骨架（2026-10-23，換頁不等資料）：給一句跟真的答句差不多長的範例字，字透明、每行畫底色，換行跟真的一樣，
    // 答句到了不會把下面推動。沒有答句也不在讀取中就什麼都不畫（同 answer 的規則）
    answerSkeleton?: string | null
  }>(),
  { answer: null, answerSkeleton: null }
)
</script>

<template>
  <section :id="id" class="stock-page-section stock-question-section" :aria-labelledby="`${id}-heading`" tabindex="-1">
    <h2 :id="`${id}-heading`" class="stock-page-section__title">{{ question }}</h2>
    <p v-if="answer" class="stock-answer">{{ answer }}</p>
    <p v-else-if="answerSkeleton" class="stock-answer" aria-hidden="true"><span class="app-skeleton app-skeleton--flow">{{ answerSkeleton }}</span></p>
    <slot />
  </section>
</template>

<style scoped>
.stock-question-section {
  scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 16px);
}

.stock-question-section:focus:not(:focus-visible) {
  outline: none;
}
</style>
