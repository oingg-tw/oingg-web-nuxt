<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'
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
    <!-- Disabled shell — the button's whole point is opening the ACTUAL filing for this
         year+quarter, but that needs a reliable MOPS/TWSE URL that doesn't depend on knowing
         this specific company's exact filing date (asked oingg-twse-ts, response pending: the
         one URL pattern they'd already found needs that exact date, which nobody currently
         stores, and guessing it risks linking to a 404). Wire the real href once that comes
         back instead of shipping a link that's frequently wrong. -->
    <el-button size="small" :icon="Document" disabled title="功能開發中——待確認可靠的財報查詢連結格式">
      開啟財報原文
    </el-button>
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
