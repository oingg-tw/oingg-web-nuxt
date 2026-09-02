<script setup lang="ts">
import { Coin } from '@element-plus/icons-vue'
import type { EtfRankingMetric } from '~/composables/dashboard/useEtfRanking'

// Wired to bff-ts's real etf-ranking endpoint (confirmed live 2026-09-02). metric is a genuine
// server-side toggle (see useEtfRanking.ts's own comment) — switching it refetches, unlike
// RevenueRankingCard's once-a-day client-side re-sort.
const metric = ref<EtfRankingMetric>('aum')
const { data } = useEtfRanking(metric)

const METRIC_LABELS: Record<EtfRankingMetric, string> = {
  aum: '規模',
  holders: '受益人數',
  netFlow: '淨申購',
  dcaAmount: '定期定額金額',
  return3m: '近3月報酬率',
  return6m: '近6月報酬率',
  returnYtd: '今年以來報酬率',
  return1y: '近1年報酬率',
  return2y: '近2年報酬率',
  return3y: '近3年報酬率',
  return5y: '近5年報酬率',
  return10y: '近10年報酬率',
  expenseRatio: '總費用率'
}

const METRIC_GROUPS: { label: string; options: EtfRankingMetric[] }[] = [
  { label: '規模資金', options: ['aum', 'holders', 'netFlow', 'dcaAmount'] },
  { label: '報酬率', options: ['return3m', 'return6m', 'returnYtd', 'return1y', 'return2y', 'return3y', 'return5y', 'return10y'] },
  { label: '費用', options: ['expenseRatio'] }
]

// value's unit/scale is entirely different per metric — aum/netFlow/dcaAmount are raw NT$ (can
// run into the trillions, per bff-ts's own example), holders is a plain headcount, everything
// else is a percentage.
const CURRENCY_METRICS = new Set<EtfRankingMetric>(['aum', 'netFlow', 'dcaAmount'])
const PERCENT_METRICS = new Set<EtfRankingMetric>([
  'return3m', 'return6m', 'return1y', 'return2y', 'return3y', 'return5y', 'return10y', 'returnYtd', 'expenseRatio'
])

function formatValue(raw: string): string {
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  if (CURRENCY_METRICS.has(metric.value)) return `${(value / 1e8).toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 億`
  if (metric.value === 'holders') return value.toLocaleString('zh-TW')
  if (PERCENT_METRICS.has(metric.value)) return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
  return raw
}

function valueClass(raw: string): string {
  if (!PERCENT_METRICS.has(metric.value) || metric.value === 'expenseRatio') return ''
  const value = Number(raw)
  if (!Number.isFinite(value) || value === 0) return ''
  return value > 0 ? 'etf-ranking-card__up' : 'etf-ranking-card__down'
}
</script>

<template>
  <el-card class="etf-ranking-card" shadow="never">
    <template #header>
      <div class="etf-ranking-card__header">
        <div class="etf-ranking-card__title">
          <el-icon><Coin /></el-icon>
          <span>ETF 排行</span>
        </div>
        <el-select v-model="metric" size="small" style="width: 140px">
          <el-option-group v-for="group in METRIC_GROUPS" :key="group.label" :label="group.label">
            <el-option v-for="option in group.options" :key="option" :value="option" :label="METRIC_LABELS[option]" />
          </el-option-group>
        </el-select>
      </div>
    </template>

    <el-empty v-if="data.rankings.length === 0" description="尚無可比較資料" :image-size="64" />
    <el-table v-else :data="data.rankings" row-key="symbol" size="small" max-height="361">
      <el-table-column label="ETF" min-width="120">
        <template #default="{ row }">
          <div class="etf-ranking-card__stock">
            <span class="etf-ranking-card__code">{{ row.symbol }}</span>
            <span class="etf-ranking-card__name">{{ row.shortName }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="發行人" min-width="90">
        <template #default="{ row }">{{ row.issuerName }}</template>
      </el-table-column>
      <el-table-column :label="METRIC_LABELS[metric]" align="right" min-width="90">
        <template #default="{ row }">
          <span :class="valueClass(row.value)">{{ formatValue(row.value) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <p v-if="data.rankings[0]?.asOf" class="etf-ranking-card__note">資料期間：{{ data.rankings[0].asOf }}</p>
  </el-card>
</template>

<style scoped>
.etf-ranking-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.etf-ranking-card__title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.etf-ranking-card__title .el-icon {
  color: var(--el-color-primary);
}

.etf-ranking-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.etf-ranking-card__code {
  font-weight: 600;
}

.etf-ranking-card__name {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.etf-ranking-card__up {
  color: var(--price-up-color);
}

.etf-ranking-card__down {
  color: var(--price-down-color);
}

.etf-ranking-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
