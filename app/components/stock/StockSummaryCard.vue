<script setup lang="ts">
import { Star, StarFilled } from '@element-plus/icons-vue'
import type { Stock } from '~/composables/stock/useStocks'

defineProps<{
  stock: Stock
  isFavorite: boolean
}>()

const emit = defineEmits<{
  toggleFavorite: []
}>()

const { columns } = useStocks()

// Trading-volume and market-cap are technical/chip-flow metrics; this app's focus is
// fundamentals and valuation, so they're left out of the quick-stats grid.
const summaryColumns = computed(() => columns.filter(column => column.key !== 'volume' && column.key !== 'marketCapB'))
</script>

<template>
  <el-card class="summary-card" shadow="never">
    <div class="summary-card__header">
      <h1 class="summary-card__name">
        {{ stock.name }}
        <span class="summary-card__code">{{ stock.code }}</span>
      </h1>
      <div class="summary-card__actions">
        <!-- Caller-supplied extras (e.g. StockDetailActions' "顯示卡片" picker on the stock
             detail page) render here, to the left of the always-present favorite button —
             this card stays a plain summary/favorite-toggle component with no knowledge of
             what a caller chooses to add alongside it. -->
        <slot name="actions" />
        <el-button
          :type="isFavorite ? 'primary' : 'default'"
          :icon="isFavorite ? StarFilled : Star"
          circle
          title="加入最愛"
          @click="emit('toggleFavorite')"
        />
      </div>
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

.summary-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.summary-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Real <h1> now (docs/ui-ux/Taiwan Web Accessibility Guidelines.md — stock/[code].vue was
   the one page in the app with no heading at all, so a screen reader's "jump by heading"
   navigation had nowhere to land), so the browser's UA-default h1 margin needs zeroing out
   here — this component's own layout already handles spacing via .summary-card__header's
   flex gap. */
.summary-card__name {
  margin: 0;
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

/* Not --el-color-danger/success directly — which color means "up" vs "down" flips with
   the market convention (see main.css's --price-up-color/--price-down-color and
   useAppTheme.ts's MarketConvention). */
.is-up {
  color: var(--price-up-color);
}

.is-down {
  color: var(--price-down-color);
}
</style>
