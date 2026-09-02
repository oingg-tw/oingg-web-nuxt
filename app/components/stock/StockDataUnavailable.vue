<script setup lang="ts">
// Placeholder for stock-detail chart sections whose backing data isn't wired to a real
// endpoint yet (per-stock valuation river/EPS/revenue history) — replaces what used to be
// 100% fabricated (seeded-random) chart data that looked real but wasn't. Shown instead of
// silently padding the layout with fake numbers, per explicit product direction.
defineProps<{
  title: string
}>()
</script>

<template>
  <el-card class="stock-data-unavailable" shadow="never" :body-style="{ padding: '32px 16px' }">
    <template #header>
      <span class="stock-data-unavailable__title">{{ title }}</span>
    </template>
    <el-empty description="資料尚未提供" :image-size="64" />
  </el-card>
</template>

<style scoped>
.stock-data-unavailable {
  border-radius: 12px;
}

.stock-data-unavailable__title {
  font-weight: 600;
}
</style>
