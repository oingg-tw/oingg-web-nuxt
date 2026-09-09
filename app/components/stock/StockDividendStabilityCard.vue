<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
import type { ScreenerFieldValue } from '~/composables/screener/useFilterSearch'

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '殖利率／發放率／連續配息年數'

// Card 1 of the dividend-quality family (design confirmed directly 2026-09-09) — 3 tiles, not a
// chart, because dividendYield（EOD 快照）/dividendPayoutRatio（TTM）/consecutiveDividendYears
// （FY）are 3 genuinely different periodicities that don't share a time axis (see
// useDividendStabilitySnapshot.ts's own comment). Sibling card StockDividendCoverageChart.vue
// covers the 2 TTM-basis metrics as an actual line chart instead, since those two DO share a
// periodicity.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const { data, units, pending } = useDividendStabilitySnapshot(symbolRef)

interface Tile {
  key: string
  label: string
  raw: ScreenerFieldValue | null | undefined
}

const tiles = computed<Tile[]>(() => [
  { key: 'dividendYield.EOD', label: '殖利率', raw: data.value?.['dividendYield.EOD'] },
  { key: 'dividendPayoutRatio.TTM', label: '盈餘發放率', raw: data.value?.['dividendPayoutRatio.TTM'] },
  { key: 'consecutiveDividendYears.FY', label: '連續配息年數', raw: data.value?.['consecutiveDividendYears.FY'] }
])

const hasAnyData = computed(() => tiles.value.some(tile => tile.raw?.value !== null && tile.raw?.value !== undefined))

function formatValue(tile: Tile): string {
  if (!tile.raw || tile.raw.value === null) return '—'
  const unit = units.value[tile.key] ?? ''
  return `${tile.raw.value}${unit}`
}
</script>

<template>
  <el-card class="dividend-stability-card" shadow="never">
    <template #header>
      <div class="dividend-stability-card__header">
        <span class="dividend-stability-card__title">
          配息穩定度
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dividend-stability-card__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無配息相關資料" :image-size="64" />
    <div v-else v-loading="pending" class="dividend-stability-card__tiles">
      <div v-for="tile in tiles" :key="tile.key" class="dividend-stability-card__tile">
        <span class="dividend-stability-card__tile-label">{{ tile.label }}</span>
        <span class="dividend-stability-card__tile-value">{{ formatValue(tile) }}</span>
        <span v-if="tile.raw?.asOfDate" class="dividend-stability-card__tile-date">{{ tile.raw.asOfDate }}</span>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.dividend-stability-card {
  border-radius: 12px;
}

.dividend-stability-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dividend-stability-card__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.dividend-stability-card__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.dividend-stability-card__tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.dividend-stability-card__tile {
  flex: 1;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.dividend-stability-card__tile-label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.dividend-stability-card__tile-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dividend-stability-card__tile-date {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
