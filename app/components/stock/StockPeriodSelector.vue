<script setup lang="ts">
import type { StockQuarter } from '~/composables/stock/useStockPeriodSelection'

const { year, quarter } = useStockPeriodSelection()

// Last 10 years, matching the ≥5yr/ideally-10yr lookback window this app already targets for
// fundamental history (docs/基本面財報觀察年限分析.md — the same reasoning behind the river-chart
// shells' own 近5年/近10年 tabs).
const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => currentYear - i)
const QUARTER_OPTIONS: { value: StockQuarter; label: string }[] = [
  { value: 1, label: '第一季' },
  { value: 2, label: '第二季' },
  { value: 3, label: '第三季' },
  { value: 4, label: '第四季' }
]
</script>

<template>
  <div class="stock-period-selector">
    <span class="stock-period-selector__label">查看期別</span>
    <el-select v-model="year" size="small" class="stock-period-selector__year">
      <el-option v-for="option in YEAR_OPTIONS" :key="option" :value="option" :label="`${option}年`" />
    </el-select>
    <el-select v-model="quarter" size="small" class="stock-period-selector__quarter">
      <el-option v-for="option in QUARTER_OPTIONS" :key="option.value" :value="option.value" :label="option.label" />
    </el-select>
  </div>
</template>

<style scoped>
.stock-period-selector {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.stock-period-selector__label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.stock-period-selector__year {
  width: 100px;
}

.stock-period-selector__quarter {
  width: 100px;
}
</style>
