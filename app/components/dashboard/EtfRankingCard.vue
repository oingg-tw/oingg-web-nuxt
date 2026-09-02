<script setup lang="ts">
import { Coin, InfoFilled, WarningFilled } from '@element-plus/icons-vue'
import type { EtfRankingMetric } from '~/composables/dashboard/useEtfRanking'

// Wired to bff-ts's real etf-ranking endpoint (confirmed live 2026-09-02). metric is a genuine
// server-side toggle (see useEtfRanking.ts's own comment) — switching it refetches (each
// metric cached client-side per session so repeat switches don't), unlike RevenueRankingCard's
// once-a-day client-side re-sort.
//
// Rebuilt 2026-09-02 as this page's full-width primary content (was a small dashboard card,
// moved here — see etf-zone.vue's own comment) — table styled closer to the screener result
// table (default el-table size, stripe, no small-card max-height cap) now that it's carrying
// that role instead of competing for space with five other cards.
//
// Leveraged/inverse warning icon added same day, referencing docs/Retiree Securities
// Investment Guide.md's explicit section on why these products don't belong in a retirement
// portfolio (daily-rebalancing volatility drag) — see isLeveragedOrInverse's own comment for
// why the wording stays mechanical/factual rather than a "don't hold this" recommendation.
const metric = ref<EtfRankingMetric>('aum')
const { data, pending } = useEtfRanking(metric)

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

// bff-ts's category strings are prefixed with the market ("上市ETF_"/"上櫃ETF_") — this app
// dropped market badges elsewhere per user request, so strip that prefix here too rather than
// showing it only in this one table.
function formatCategory(raw: string): string {
  return raw.replace(/^(上市|上櫃)ETF_/, '')
}

// Added per docs/Retiree Securities Investment Guide.md — leveraged/inverse ETFs rebalance
// daily against a single-day return target, which structurally erodes value over any holding
// period longer than a day or two ("volatility drag") even when the underlying index round-
// trips back to its starting level (the doc works a concrete 2x-leverage example: +10%/-9.09%
// nets a 1.82% loss despite the index ending flat). Purely factual/structural — states what the
// product mechanically does, not a "don't buy this" recommendation — consistent with
// ValuationRankingCard's neutral-tone requirement from conductor.
function isLeveragedOrInverse(assetClass: string | null): boolean {
  return assetClass === '槓桿型' || assetClass === '反向型'
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
        <el-select v-model="metric" style="width: 180px">
          <el-option-group v-for="group in METRIC_GROUPS" :key="group.label" :label="group.label">
            <el-option v-for="option in group.options" :key="option" :value="option" :label="METRIC_LABELS[option]" />
          </el-option-group>
        </el-select>
      </div>
    </template>

    <!-- Empty state is el-table's own #empty slot, not a sibling el-empty behind a v-if/
         v-else — see MarginShortRatioCard.vue's comment for why (a real reproduced crash). -->
    <el-table v-loading="pending" :data="data.rankings" row-key="symbol" stripe style="min-height: 200px">
      <template #empty>
        <el-empty description="尚無可比較資料" :image-size="64" />
      </template>
      <el-table-column prop="rank" label="#" width="52" />
      <el-table-column label="ETF" min-width="140">
        <template #default="{ row }">
          <div class="etf-ranking-card__stock">
            <span class="etf-ranking-card__code">{{ row.symbol }}</span>
            <span class="etf-ranking-card__name">{{ row.shortName }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="發行人" min-width="100">
        <template #default="{ row }">{{ row.issuerName }}</template>
      </el-table-column>
      <el-table-column label="類別" min-width="150">
        <template #default="{ row }">
          <span class="etf-ranking-card__category">
            {{ formatCategory(row.category) }}
            <el-icon
              v-if="isLeveragedOrInverse(row.assetClass)"
              class="etf-ranking-card__leverage-icon"
              title="槓桿/反向型ETF採每日重新平衡機制，指數長期在原地震盪時，淨值可能因複利耗損而偏離指數表現"
            >
              <WarningFilled />
            </el-icon>
          </span>
        </template>
      </el-table-column>
      <el-table-column min-width="90">
        <template #header>
          配息頻率
          <el-icon
            class="etf-ranking-card__info-icon"
            title="單次配息金額達新台幣2萬元，該筆全額需扣2.11%二代健保補充保費；月配型ETF較容易將單次配息控制在門檻以下"
          >
            <InfoFilled />
          </el-icon>
        </template>
        <template #default="{ row }">{{ row.distributionFrequency ?? '—' }}</template>
      </el-table-column>
      <el-table-column :label="METRIC_LABELS[metric]" align="right" min-width="110">
        <template #default="{ row }">
          <span :class="valueClass(row.value)">{{ formatValue(row.value) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <p class="etf-ranking-card__note">⚠ 槓桿/反向型ETF採每日重新平衡機制，長期持有可能因複利耗損偏離指數表現</p>
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

.etf-ranking-card__category {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.etf-ranking-card__leverage-icon {
  color: var(--el-color-warning);
}

.etf-ranking-card__info-icon {
  color: var(--el-text-color-placeholder);
  vertical-align: middle;
  margin-left: 2px;
}
</style>
