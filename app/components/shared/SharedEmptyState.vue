<script setup lang="ts">
// A plain-DOM empty state for cards that render during SSR (2026-09-19, the SEO build). Element
// Plus's <el-empty> draws an SVG whose gradient/path ids come from its useId() counter — and that
// counter drifts between the server and the client whenever a ClientOnly component or an SSR-only
// branch changes how many ids were handed out before it（seen live on 公司健檢: server
// `linearGradient-1-el-id-1024-17`, client `…-5` → "Hydration attribute mismatch"）. A sentence
// needs no ids, hydrates cleanly, and reads the same to a screen reader as the SVG never did.
defineProps<{
  description: string
}>()
</script>

<template>
  <p class="shared-empty-state">{{ description }}</p>
</template>

<style scoped>
.shared-empty-state {
  margin: 0;
  padding: 24px 16px;
  text-align: center;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
</style>
