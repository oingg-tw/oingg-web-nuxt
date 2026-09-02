<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'
import type { Stock, StockColumnDef } from '~/composables/stock/useStocks'
import { formatStockValue } from '~/composables/stock/useStocks'

defineProps<{
  stocks: Stock[]
  columns: StockColumnDef[]
}>()

const emit = defineEmits<{
  remove: [code: string]
}>()

const router = useRouter()
</script>

<template>
  <div class="stock-card-list">
    <el-card
      v-for="stock in stocks"
      :key="stock.code"
      class="stock-card"
      shadow="never"
      tabindex="0"
      role="link"
      :aria-label="`查看 ${stock.name} ${stock.code} 個股頁`"
      @click="router.push(`/stock/${stock.code}`)"
      @keydown.enter.self="router.push(`/stock/${stock.code}`)"
    >
      <div class="stock-card__header">
        <div>
          <span class="stock-card__name">{{ stock.name }}</span>
          <span class="stock-card__code">{{ stock.code }}</span>
        </div>
        <el-button
          :icon="Close"
          circle
          text
          size="small"
          @click.stop="emit('remove', stock.code)"
        />
      </div>

      <div class="stock-card__price">
        <span>{{ stock.price.toFixed(2) }}</span>
        <span :class="stock.change > 0 ? 'is-up' : stock.change < 0 ? 'is-down' : ''">
          {{ formatStockValue(stock, 'change') }} ({{ formatStockValue(stock, 'changePercent') }}%)
        </span>
      </div>

      <div class="stock-card__grid">
        <div v-for="column in columns" :key="column.key" class="stock-card__field">
          <span class="stock-card__label">{{ column.label }}</span>
          <span>{{ formatStockValue(stock, column.key) }}{{ column.unit }}</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.stock-card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stock-card {
  border-radius: 12px;
  cursor: pointer;
}

.stock-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stock-card__name {
  font-weight: 600;
  margin-right: 8px;
}

.stock-card__code {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.stock-card__price {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 22px;
  font-weight: 600;
  margin: 8px 0 12px;
}

.stock-card__price span:last-child {
  font-size: 14px;
  font-weight: 400;
}

.stock-card__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 16px;
}

.stock-card__field {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.stock-card__label {
  color: var(--el-text-color-secondary);
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
