<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'
import type { StockQuarter } from '~/composables/stock/useStockPeriodSelection'

const props = defineProps<{
  symbol: string
}>()

const { year, quarter } = useStockPeriodSelection()

// MOPS's own server-rendered financial-statement page — no filing-date lookup needed (unlike
// doc.twse.com.tw's PDF-direct-link pattern, which needs the exact 申報年月 nobody stores).
// Confirmed live by oingg-twse-ts 2026-09-06 against a real symbol/period (2330, 2025 Q4) —
// SYEAR is the WESTERN year here (unlike bff-ts's financial-statement endpoint, which wants
// 民國年 — two different upstream systems, two different calendars, not a typo).
// REPORT_ID=C is the 合併財報 (consolidated) code; no individual-statement code confirmed yet.
const reportUrl = computed(
  () => `https://mopsov.twse.com.tw/server-java/t164sb01?step=1&CO_ID=${props.symbol}&SYEAR=${year.value}&SSEASON=${quarter.value}&REPORT_ID=C`
)

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
    <el-button tag="a" :href="reportUrl" target="_blank" rel="noopener" size="small" :icon="Document" title="在 MOPS 開啟原始財報">
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
