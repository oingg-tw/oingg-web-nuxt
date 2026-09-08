<script setup lang="ts">
import { InfoFilled, WarningFilled } from '@element-plus/icons-vue'
import type { DupontBasis, DupontHistoryEntry } from '~/composables/stock/useDupontHistory'

const INFO_TEXT = '五階段杜邦分析把 ROE 拆解成租稅負擔、利息負擔、營業利潤率、總資產週轉率、權益乘數五個「相乘」關係的因子，用來看出獲利是本業賺來的、還是靠減稅或借債堆出來的假性 ROE。每張因子卡呈現本期數值相對近4季自身平均的位置，不做同業比較（目前無此資料）。'

// Built per conductor's docs/3_audiences/前端工程師/個股瀏覽.md 第五節規格 ("按照這邊指示再做
// 一個版本的杜邦拆解卡片") — a THIRD DuPont-family card, additive alongside StockDupontChart.vue
// (3-factor line chart)/StockDupontExtendedChart.vue (5-factor line chart)/
// StockDupontFactorLevelChart.vue (2-5-factor comparison line chart), not replacing any of them.
// This one uses a completely different visual form per that doc's own explicit mandate:
//
// - NOT a radar chart: the doc classifies multi-axis radar as "工程禁止" for this exact use
//   case — polar-coordinate area doesn't linearly correspond to the underlying values, and a
//   MULTIPLICATIVE relationship (factors multiply to ROE, they don't sum) makes "bigger
//   polygon area = better" a doubly-wrong visual metaphor.
// - NOT a stacked bar chart either, for the same multiplicative reason — a stacked bar's own
//   "each segment is a slice of the total" visual language implies addition, contradicting how
//   these 5 numbers actually combine.
// - Instead: 5 horizontal "Metric Cards" in DuPont formula order (租稅負擔 → 利息負擔 →
//   EBIT利潤率 → 總資產週轉率 → 權益乘數), visually chained with "×" connectors into an
//   assembled ROE total card, each showing 本期 vs 近4季自身平均 as a bar from a shared zero
//   baseline.
//
// Precondition confirmed directly with analysis-ts before writing this (per the doc's own
// explicit instruction not to assume): the doc's originally-envisioned `negativeEquityWarning`
// text-string mechanism is DEAD — `negativeEquityGuard.ts` is an orphaned file with zero
// consumers under the current pitMetrics architecture. `GET /stocks/:symbol/dupont-history`
// only has `nullReason`/`dupontExtendedRoeNullReason` set to 'zero_or_negative_denominator'
// when a denominator is EXACTLY zero — a genuinely negative (but nonzero) equity multiplier is
// NOT flagged by the backend at all and must be checked client-side (analysis-ts's own words:
// "前端如果要判斷「權益為負」要自己檢查對應數值 < 0，不能等一個警告欄位"). Also confirmed: no
// industry-median comparison data exists yet, so every card compares 本期 against the stock's
// OWN trailing-4-quarter average only, per the doc's own documented fallback for exactly this
// situation.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const basis = ref<DupontBasis>('Q')
// Exactly 4 quarters — "近4季" already includes the current one (a trailing-4-quarter window
// ending at the present), matching this app's own TTM convention elsewhere, so 本期 is simply
// the most recent entry in this same window rather than a 5th quarter fetched on top of it.
const limit = ref(4)

const { data: entries, pending } = useDupontHistory(symbolRef, basis, limit)

// Oldest-to-newest from the API (confirmed by every sibling chart's own x-axis convention) —
// the current quarter is always the LAST entry, never reversed here.
const current = computed<DupontHistoryEntry | null>(() => {
  const list = entries.value
  return list && list.length > 0 ? list[list.length - 1]! : null
})

const hasAnyData = computed(() => current.value !== null)

function average(selector: (entry: DupontHistoryEntry) => number | null): number | null {
  const values = (entries.value ?? []).map(selector).filter((value): value is number => value !== null)
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

interface FactorCard {
  key: string
  label: string
  unit: '%' | '×'
  current: number | null
  average: number | null
}

const factorCards = computed<FactorCard[]>(() => [
  {
    key: 'tax',
    label: '租稅負擔',
    unit: '%',
    current: current.value?.dupontTaxBurdenPct ?? null,
    average: average(entry => entry.dupontTaxBurdenPct)
  },
  {
    key: 'interest',
    label: '利息負擔',
    unit: '%',
    current: current.value?.dupontInterestBurdenPct ?? null,
    average: average(entry => entry.dupontInterestBurdenPct)
  },
  {
    key: 'ebit',
    label: '營業利潤率（EBIT）',
    unit: '%',
    current: current.value?.dupontEbitMarginPct ?? null,
    average: average(entry => entry.dupontEbitMarginPct)
  },
  {
    key: 'turnover',
    label: '總資產週轉率',
    unit: '×',
    current: current.value?.assetTurnover ?? null,
    average: average(entry => entry.assetTurnover)
  },
  {
    key: 'equity',
    label: '權益乘數',
    unit: '×',
    current: current.value?.equityMultiplier ?? null,
    average: average(entry => entry.equityMultiplier)
  }
])

// Negative equity check happens HERE, client-side, on the most recent quarter's own equity
// multiplier — per analysis-ts's own direct confirmation this is now the only way to detect
// it (see this file's own top comment). A neutral, factual description, not a backend-provided
// string (that mechanism no longer exists) — worded to state the mechanical fact (equity ≤ 0
// makes the multiplier and any ROE built from it uninformative) without a conclusory verdict.
const hasNegativeEquity = computed(() => current.value?.equityMultiplier !== null && (current.value?.equityMultiplier ?? 0) < 0)
const NEGATIVE_EQUITY_NOTE = '本期股東權益為負數，權益乘數與由此組裝出的 ROE 數值意義有限，請自行判斷是否採用；不代表公司經營結論。'

function barPercent(value: number | null, referenceMax: number): number {
  if (value === null || referenceMax <= 0) return 0
  return Math.min(100, Math.max(0, (Math.abs(value) / referenceMax) * 100))
}

function referenceMax(card: FactorCard): number {
  const candidates = [card.current, card.average].filter((value): value is number => value !== null).map(Math.abs)
  return candidates.length ? Math.max(...candidates) * 1.25 : 1
}

function formatValue(value: number | null, unit: '%' | '×'): string {
  return value === null ? '無法計算' : `${value.toFixed(2)}${unit === '%' ? '%' : '倍'}`
}
</script>

<template>
  <el-card class="dupont-five-stage" shadow="never">
    <template #header>
      <span class="dupont-five-stage__title">
        杜邦拆解對照（五階段指標卡）
        <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '300px' }">
          <el-icon class="dupont-five-stage__info"><InfoFilled /></el-icon>
        </el-tooltip>
      </span>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <div v-else v-loading="pending" class="dupont-five-stage__row">
      <template v-for="(card, index) in factorCards" :key="card.key">
        <div class="dupont-five-stage__connector" v-if="index > 0">×</div>
        <div class="dupont-five-stage__card" :class="{ 'dupont-five-stage__card--warning': card.key === 'equity' && hasNegativeEquity }">
          <p class="dupont-five-stage__label">{{ card.label }}</p>

          <template v-if="card.key === 'equity' && hasNegativeEquity">
            <p class="dupont-five-stage__value dupont-five-stage__value--warning">{{ formatValue(card.current, card.unit) }}</p>
            <el-tooltip :content="NEGATIVE_EQUITY_NOTE" placement="top" :popper-style="{ maxWidth: '280px' }">
              <p class="dupont-five-stage__warning-note"><el-icon><WarningFilled /></el-icon>股東權益為負</p>
            </el-tooltip>
          </template>
          <template v-else>
            <p class="dupont-five-stage__value">{{ formatValue(card.current, card.unit) }}</p>
            <div class="dupont-five-stage__bar-track">
              <div class="dupont-five-stage__bar-fill" :style="{ width: `${barPercent(card.current, referenceMax(card))}%` }" />
              <div
                v-if="card.average !== null"
                class="dupont-five-stage__bar-avg"
                :style="{ left: `${barPercent(card.average, referenceMax(card))}%` }"
              />
            </div>
            <p v-if="card.current !== null && card.average !== null" class="dupont-five-stage__compare">
              <span v-if="card.current > card.average" class="is-up">▲ 高於近4季自身平均</span>
              <span v-else-if="card.current < card.average" class="is-down">▼ 低於近4季自身平均</span>
              <span v-else class="dupont-five-stage__compare-flat">－ 與近4季自身平均持平</span>
            </p>
            <p v-else class="dupont-five-stage__compare dupont-five-stage__compare-flat">近4季平均：{{ formatValue(card.average, card.unit) }}</p>
          </template>
        </div>
      </template>

      <div class="dupont-five-stage__connector">=</div>
      <div class="dupont-five-stage__card dupont-five-stage__card--total">
        <p class="dupont-five-stage__label">組裝 ROE（單季）</p>
        <p class="dupont-five-stage__value" :class="{ 'dupont-five-stage__value--warning': hasNegativeEquity }">
          {{ formatValue(current?.dupontExtendedRoePct ?? null, '%') }}
        </p>
        <p v-if="hasNegativeEquity" class="dupont-five-stage__warning-note">
          <el-icon><WarningFilled /></el-icon>股東權益為負，此數值意義有限
        </p>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.dupont-five-stage {
  border-radius: 12px;
  grid-column: 1 / -1;
}

.dupont-five-stage__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.dupont-five-stage__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.dupont-five-stage__row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.dupont-five-stage__connector {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-placeholder);
}

.dupont-five-stage__card {
  flex: 1 0 150px;
  min-width: 150px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.dupont-five-stage__card--total {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.dupont-five-stage__card--warning {
  border-color: var(--el-color-danger-light-5);
}

.dupont-five-stage__label {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.dupont-five-stage__value {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

.dupont-five-stage__value--warning {
  color: var(--el-color-danger);
}

.dupont-five-stage__bar-track {
  position: relative;
  height: 8px;
  border-radius: 4px;
  background: var(--el-fill-color);
  overflow: visible;
}

.dupont-five-stage__bar-fill {
  height: 100%;
  border-radius: 4px;
  background: var(--el-color-primary);
}

.dupont-five-stage__bar-avg {
  position: absolute;
  top: -2px;
  width: 2px;
  height: 12px;
  background: var(--el-text-color-secondary);
}

.dupont-five-stage__compare {
  margin: 0;
  font-size: 16px;
}

.dupont-five-stage__compare-flat {
  color: var(--el-text-color-placeholder);
}

.is-up {
  color: var(--price-up-color);
}

.is-down {
  color: var(--price-down-color);
}

.dupont-five-stage__warning-note {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 16px;
  color: var(--el-color-danger);
  cursor: help;
}
</style>
