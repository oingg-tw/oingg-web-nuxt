<script setup lang="ts">
// Wired to bff-ts's real revenue-ranking endpoint (confirmed live 2026-09-01). Fetched once
// (see useRevenueRanking.ts) — the metric toggle here re-sorts the already-fetched rows
// client-side instead of refetching, since revenue data only updates once a day.
import { Money } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import type { RevenueRankingMetric } from '~/composables/dashboard/useRevenueRanking'

const { data, pending } = useRevenueRanking(20)

const metric = ref<RevenueRankingMetric>('yoy')

const METRIC_OPTIONS: { value: RevenueRankingMetric; label: string }[] = [
  { value: 'yoy', label: '年增率' },
  { value: 'mom', label: '月增率' },
  { value: 'revenue', label: '當月營收' }
]

const sortField: Record<RevenueRankingMetric, 'currentMonthRevenue' | 'momChangePercent' | 'yoyChangePercent'> = {
  yoy: 'yoyChangePercent',
  mom: 'momChangePercent',
  revenue: 'currentMonthRevenue'
}

const sortedRows = computed(() => {
  const field = sortField[metric.value]
  return [...data.value.rankings].sort((a, b) => Number(b[field]) - Number(a[field]))
})

function formatPercent(raw: string): string {
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function percentClass(raw: string): string {
  const value = Number(raw)
  if (!Number.isFinite(value) || value === 0) return ''
  return value > 0 ? 'revenue-ranking-card__up' : 'revenue-ranking-card__down'
}

function formatRevenue(raw: string): string {
  const value = Number(raw)
  return Number.isFinite(value) ? value.toLocaleString('zh-TW') : raw
}

// el-table's #empty slot briefly renders at the wrong (much narrower) width on first paint,
// wrapping the description text into single-character lines before self-correcting — see
// ValuationRankingCard.vue's own comment for the full story/repro. Watches `metric` too, not
// just `sortedRows` — switching metric swaps which v-if column renders even when the row set
// itself doesn't change.
const tableRef = ref<TableInstance>()
watch([sortedRows, metric], () => nextTick(() => tableRef.value?.doLayout()))
</script>

<template>
  <el-card class="revenue-ranking-card" shadow="never">
    <template #header>
      <div class="revenue-ranking-card__header">
        <div class="revenue-ranking-card__title">
          <el-icon><Money /></el-icon>
          <span>月營收排行</span>
        </div>
        <el-radio-group v-model="metric" size="small">
          <el-radio-button v-for="option in METRIC_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <!-- Empty state is el-table's own #empty slot, not a sibling el-empty behind a v-if/
         v-else — see MarginShortRatioCard.vue's comment for why (a real reproduced crash). -->
    <el-table ref="tableRef" v-loading="pending" :data="sortedRows" row-key="symbol" size="small" max-height="361" style="min-height: 200px">
      <template #empty>
        <el-empty description="尚無可比較資料" :image-size="64" />
      </template>
      <el-table-column label="股票" min-width="110">
        <template #default="{ row }">
          <div class="revenue-ranking-card__stock">
            <span class="revenue-ranking-card__code">{{ row.symbol }}</span>
            <span class="revenue-ranking-card__name">{{ row.name ?? '—' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column v-if="metric === 'revenue'" label="當月營收" align="right" min-width="110">
        <template #default="{ row }">{{ formatRevenue(row.currentMonthRevenue) }}</template>
      </el-table-column>
      <el-table-column v-if="metric === 'mom'" label="月增率" align="right" min-width="90">
        <template #default="{ row }">
          <span :class="percentClass(row.momChangePercent)">{{ formatPercent(row.momChangePercent) }}</span>
        </template>
      </el-table-column>
      <el-table-column v-if="metric === 'yoy'" label="年增率" align="right" min-width="90">
        <template #default="{ row }">
          <span :class="percentClass(row.yoyChangePercent)">{{ formatPercent(row.yoyChangePercent) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <p v-if="data.yearMonth" class="revenue-ranking-card__note">資料月份：{{ data.yearMonth }}</p>
  </el-card>
</template>

<style scoped>
.revenue-ranking-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.revenue-ranking-card__title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.revenue-ranking-card__title .el-icon {
  color: var(--el-color-primary);
}

.revenue-ranking-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.revenue-ranking-card__code {
  font-weight: 600;
}

.revenue-ranking-card__name {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.revenue-ranking-card__up {
  color: var(--price-up-color);
}

.revenue-ranking-card__down {
  color: var(--price-down-color);
}

.revenue-ranking-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}

/* Root-cause fix for the empty-state width glitch — see ValuationRankingCard.vue's own comment
   for the full DOM-inspection story. .el-scrollbar__view is inline-block by default and
   collapses to its own (wrapped, narrow) content instead of filling its already-correctly-sized
   parent. */
:deep(.el-scrollbar__view) {
  width: 100% !important;
}
</style>
