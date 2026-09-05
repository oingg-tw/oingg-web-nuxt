<script setup lang="ts">
import type { Stock } from '~/composables/stock/useStocks'

defineProps<{
  stock: Stock
  rank: number
}>()
</script>

<template>
  <NuxtLink :to="`/stock/${stock.code}`" class="landing-rank-card">
    <span class="landing-rank-card__rank">{{ rank }}</span>
    <h3 class="landing-rank-card__name">
      {{ stock.name }}
      <span class="landing-rank-card__code">{{ stock.code }}</span>
    </h3>
    <div class="landing-rank-card__metrics">
      <div class="landing-rank-card__metric">
        <span class="landing-rank-card__metric-label">殖利率</span>
        <span class="landing-rank-card__metric-value">{{ formatStockValue(stock, 'dividendYield') }}%</span>
      </div>
      <div class="landing-rank-card__metric">
        <span class="landing-rank-card__metric-label">股價</span>
        <span class="landing-rank-card__metric-value">{{ stock.price.toFixed(2) }}</span>
      </div>
    </div>
  </NuxtLink>
</template>

<style scoped>
.landing-rank-card {
  flex: 0 0 200px;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.landing-rank-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 12px 28px -8px rgb(0 0 0 / 30%);
  transform: translateY(-2px);
}

.landing-rank-card__rank {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.landing-rank-card__name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.landing-rank-card__code {
  display: block;
  margin-top: 2px;
  font-size: 14px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.landing-rank-card__metrics {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.landing-rank-card__metric {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.landing-rank-card__metric-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.landing-rank-card__metric-value {
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
