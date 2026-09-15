<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '現金流量股利3/5/8年複合成長率'

// New card 2026-09-14 per direct request ("幫發想股東回饋卡片呈現") — surfaces
// analysis-ts's own dividendGrowthRate3y/5y/8y family (FY timeframe, CAGR of an approximated
// dividend-per-share derived from the cash flow statement's own dividendsPaid ÷ paidInShares,
// not the precise declared-DPS figure — see dividendGrowthRateDefinition.ts's own formulaNote
// for why), never surfaced anywhere in this app before this. Snapshot stat row, same visual
// pattern as StockBetaComparisonChart.vue's own 3-window Beta stats (added earlier the same
// session) — a CAGR is itself already a multi-year summary number, not something that reads
// naturally as its own time series the way a quarterly ratio would, so 3 side-by-side numbers
// says more than a line chart would here.
//
// Deliberately connects to Chowder Number in its own INFO/detail: confirmed directly against
// chowderNumberDefinition.ts that Chowder Number = dividendYield + dividendGrowthRate5y — this
// card's 5年 tile is literally the same underlying number as half of that badge's own score, just
// never broken out on its own before. Helps a reader understand WHY a stock's Chowder Number is
// high/low (yield-driven vs. growth-driven) instead of it being one opaque composite number.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const METRIC_CODES = ['dividendGrowthRate3y', 'dividendGrowthRate5y', 'dividendGrowthRate8y']
const limit = ref(1)

const history = useMetricsHistory(symbolRef, ref(METRIC_CODES), ref('FY'), limit)

interface Stat {
  code: string
  label: string
}

const STATS: Stat[] = [
  { code: 'dividendGrowthRate3y', label: '3年' },
  { code: 'dividendGrowthRate5y', label: '5年（同 Chowder）' },
  { code: 'dividendGrowthRate8y', label: '8年' }
]

const latestEntry = computed(() => history.data.value?.at(-1) ?? null)

const stats = computed(() =>
  STATS.map(stat => ({
    label: stat.label,
    value: latestEntry.value?.values[stat.code]?.value ?? null
  }))
)

const hasAnyData = computed(() => stats.value.some(stat => stat.value !== null))

function formatValue(value: number | null): string {
  return value !== null ? `${value > 0 ? '+' : ''}${value.toFixed(1)}%` : '資料不足'
}
</script>

<template>
  <el-card class="dividend-growth-rate-card" shadow="never">
    <template #header>
      <div class="dividend-growth-rate-card__header">
        <span class="dividend-growth-rate-card__title">
          股利成長率
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dividend-growth-rate-card__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <div v-loading="history.pending.value" class="dividend-growth-rate-card__stats">
        <div v-for="stat in stats" :key="stat.label" class="dividend-growth-rate-card__stat">
          <span class="dividend-growth-rate-card__stat-label">{{ stat.label }}</span>
          <span class="dividend-growth-rate-card__stat-value">{{ formatValue(stat.value) }}</span>
        </div>
      </div>
      <SharedDataFreshnessNote source-label="公開發行公司現金流量表／股本變動申報" :as-of="latestEntry ? `${latestEntry.fiscalYear}` : null" />
    </template>
  </el-card>
</template>

<style scoped>
.dividend-growth-rate-card {
  border-radius: 12px;
}

.dividend-growth-rate-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dividend-growth-rate-card__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.dividend-growth-rate-card__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.dividend-growth-rate-card__stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.dividend-growth-rate-card__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1 1 0;
  min-width: 90px;
  padding: 12px 4px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.dividend-growth-rate-card__stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.dividend-growth-rate-card__stat-value {
  font-size: 20px;
  font-weight: 600;
}
</style>
