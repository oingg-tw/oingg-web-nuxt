<script setup lang="ts">
import type { Stock } from '~/composables/useStocks'

defineProps<{
  stock: Stock
}>()

const { columns } = useStocks()

// Trading-volume and market-cap are technical/chip-flow metrics; this app's focus is
// fundamentals and valuation, so they're left out of the quick-stats grid.
const summaryColumns = computed(() => columns.filter(column => column.key !== 'volume' && column.key !== 'marketCapB'))
</script>

<template>
  <el-card class="summary-card" shadow="never">
    <div class="summary-card__name">
      {{ stock.name }}
      <span class="summary-card__code">{{ stock.code }}</span>
    </div>
    <div class="summary-card__price">
      <span class="summary-card__price-value">{{ stock.price.toFixed(2) }}</span>
      <span :class="stock.change > 0 ? 'is-up' : stock.change < 0 ? 'is-down' : ''">
        {{ formatStockValue(stock, 'change') }} ({{ formatStockValue(stock, 'changePercent') }}%)
      </span>
    </div>

    <div class="summary-card__grid">
      <div v-for="column in summaryColumns" :key="column.key" class="summary-card__field">
        <span class="summary-card__label">{{ column.label }}</span>
        <span class="summary-card__value">{{ formatStockValue(stock, column.key) }}{{ column.unit }}</span>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.summary-card {
  border-radius: 12px;
}

.summary-card__name {
  font-size: 18px;
  font-weight: 600;
}

.summary-card__code {
  font-size: 13px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  margin-left: 6px;
}

.summary-card__price {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 6px;
}

.summary-card__price-value {
  font-size: 40px;
  font-weight: 600;
  line-height: 1;
}

.summary-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.summary-card__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-card__label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.summary-card__value {
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.is-up {
  color: var(--el-color-danger);
}

.is-down {
  color: var(--el-color-success);
}
</style>
