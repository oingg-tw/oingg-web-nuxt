<script setup lang="ts">
import type { ScreenerFieldValue } from '~/composables/screener/useFilterSearch'

// Split back out of StockDividendInfoCard.vue 2026-09-15 per direct request ("股利卡片幫我拆開，
// 另外建立") — that card itself was a 2026-09-14 merge of this card + StockExDividendCard.vue
// ("股東回饋 下次除權息 希望可以跟 配息穩定度 合併呈現，卡片要更名"). Splitting back apart ahead
// of the interface overhaul; this half keeps the merged card's own field set (including
// shareholderYield.TTM, added to the merged card 2026-09-14 after this card's own original
// version — see that commit's own history) and the current `knowledgeDate` field name
// (ScreenerFieldValue's own `asOfDate` was renamed 2026-09-14, after this card's original
// version last existed as a standalone file — pulling straight from git history here would have
// silently reintroduced that stale field name).
const INFO_TEXT = '殖利率／發放率／連續年數／總回饋率'

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
  { key: 'consecutiveDividendYears.FY', label: '連續配息年數', raw: data.value?.['consecutiveDividendYears.FY'] },
  { key: 'shareholderYield.TTM', label: '股東總回饋率', raw: data.value?.['shareholderYield.TTM'] }
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
        <StockCardTitle title="配息穩定度" :info-text="INFO_TEXT" />
      </div>
    </template>

    <SharedEmptyState v-if="!pending && !hasAnyData" description="這檔股票尚無配息相關資料" />
    <div v-else v-loading="pending" class="dividend-stability-card__tiles">
      <div v-for="tile in tiles" :key="tile.key" class="dividend-stability-card__tile">
        <span class="dividend-stability-card__tile-label">{{ tile.label }}</span>
        <span class="dividend-stability-card__tile-value">{{ formatValue(tile) }}</span>
        <span v-if="tile.raw?.knowledgeDate" class="dividend-stability-card__tile-date">{{ tile.raw.knowledgeDate }}</span>
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
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.dividend-stability-card__tile-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dividend-stability-card__tile-date {
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}
</style>
