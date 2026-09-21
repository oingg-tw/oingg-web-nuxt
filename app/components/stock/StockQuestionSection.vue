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
    level?: 'h2' | 'h3'
  }>(),
  { answer: null, level: 'h2' }
)
</script>

<template>
  <section :id="id" class="stock-page-section stock-question-section" :aria-labelledby="`${id}-heading`" tabindex="-1">
    <component :is="level" :id="`${id}-heading`" class="stock-page-section__title">{{ question }}</component>
    <p v-if="answer" class="stock-answer">{{ answer }}</p>
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
