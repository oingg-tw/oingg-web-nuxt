<script setup lang="ts">
import { InfoFilled, WarningFilled } from '@element-plus/icons-vue'
import type { MetricBasis, MetricCode } from '~/composables/stock/useMetricHistory'
import type { DupontBasis, DupontHistoryEntry } from '~/composables/stock/useDupontHistory'

const INFO_TEXT = '杜邦分析把 ROE 拆解成 2～5 個「相乘」關係的因子，因子拆得越細，越能看出獲利是本業賺來的、還是靠減稅、借債或資產週轉撐出來的。每張因子卡呈現本期數值相對近4期自身平均的位置，不做同業比較（目前無此資料）。'

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
// - NOT a stacked bar chart either, for the same multiplicative reason.
// - Instead: horizontal "Metric Cards" in DuPont formula order, visually chained with "×"
//   connectors into an assembled ROE total card, each showing 本期 vs 近4期自身平均 as a bar
//   from a shared zero baseline.
//
// Extended twice past the original spec, both per direct follow-up request:
// 1. Computed on TTM instead of single-quarter data — confirmed live (curl against
//    GET /stocks/:symbol/dupont-history?basis=TTM) that netProfitMarginPct/dupontTaxBurdenPct/
//    dupontInterestBurdenPct/dupontEbitMarginPct/assetTurnover/decomposedRoePct/
//    dupontExtendedRoePct are ALL real, non-null values at basis=TTM — only equityMultiplier is
//    null there (a balance-sheet point-in-time snapshot has no trailing-four-quarter variant).
//    This is actually MORE accurate than StockDupontFactorLevelChart.vue's own line-chart
//    version, which fetches its factor breakdown at basis=Q throughout (see that file's own
//    comment) and has to disclaim a "還原ROE（單季）doesn't match ROE（實際，TTM）" mismatch as a
//    result — here, decomposedRoePct/dupontExtendedRoePct come from the backend's own genuine
//    TTM calculation, not a same-component reconstruction from quarterly parts, so levels 3/4/5
//    reconstruct exactly (only level 2, which substitutes a separately-fetched TTM ROA times a
//    single-quarter equity multiplier, can still diverge slightly — same caveat the chart
//    documents for its own level 2).
// 2. Given a 2/3/4/5-factor level switcher, mirroring StockDupontFactorLevelChart.vue's own
//    telescoping levels (同一份 dupont-history 資料, same math) rather than being permanently
//    fixed at 5 factors — the "五階段" in this card's id/original name is now just its default
//    level, not its only mode.
//   2因子: ROE = ROA × 權益乘數
//   3因子: ROE = 淨利率 × 總資產週轉率 × 權益乘數
//   4因子: ROE = 稅務利息綜合負擔 × EBIT利潤率 × 總資產週轉率 × 權益乘數
//   5因子: ROE = 租稅負擔 × 利息負擔 × EBIT利潤率 × 總資產週轉率 × 權益乘數
//
// Precondition confirmed directly with analysis-ts before writing the original version (per the
// doc's own explicit instruction not to assume): the doc's originally-envisioned
// `negativeEquityWarning` text-string mechanism is DEAD — `negativeEquityGuard.ts` is an
// orphaned file with zero consumers under the current pitMetrics architecture.
// `GET /stocks/:symbol/dupont-history` only has `nullReason`/`dupontExtendedRoeNullReason` set
// to 'zero_or_negative_denominator' when a denominator is EXACTLY zero — a genuinely negative
// (but nonzero) equity multiplier is NOT flagged by the backend at all and must be checked
// client-side (analysis-ts's own words: "前端如果要判斷「權益為負」要自己檢查對應數值 < 0，不能
// 等一個警告欄位"). Also confirmed: no industry-median comparison data exists yet, so every card
// compares 本期 against the stock's OWN trailing window average only.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
// Defaults to 2因子 to match StockDupontFactorLevelChart.vue's own default (its sibling, same
// underlying data, same "simplest view first" reasoning per direct request "杜邦拆解對照 預設
// 顯示2因子").
const factorLevel = ref<2 | 3 | 4 | 5>(2)
// Exactly 4 periods — "近4期" already includes the current one (a trailing window ending at the
// present), so 本期 is simply the most recent entry in this same window rather than a 5th period
// fetched on top of it.
const limit = ref(4)

// TTM is the PRIMARY source now (see this file's own top comment for why this differs from
// StockDupontFactorLevelChart.vue's own Q-basis fetch) — carries every factor field except
// equityMultiplier at this basis.
const dupont = useDupontHistory(symbolRef, ref<DupontBasis>('TTM'), limit)
// Q-basis, equityMultiplier only — the one field with no TTM variant.
const equityBasis = useDupontHistory(symbolRef, ref<DupontBasis>('Q'), limit)
// TTM ROA — only consumed at factorLevel 2 (ROE = ROA × 權益乘數).
const roa = useMetricHistory(symbolRef, ref<MetricCode>('roa'), ref<MetricBasis>('TTM'), limit)

const pending = computed(() => dupont.pending.value || equityBasis.pending.value || roa.pending.value)

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

function byQuarter<T extends { fiscalYear: number; fiscalQuarter: number }>(entries: T[] | null): Map<string, T> {
  return new Map((entries ?? []).map(entry => [periodLabel(entry), entry]))
}

interface Point {
  label: string
  roa: number | null
  dupont: DupontHistoryEntry | null
  equityMultiplier: number | null
}

// dupont.data (TTM) anchors the period axis, same "one fetch drives the axis, others matched in
// by quarter" shape as several sibling charts (StockValuationRiverChart.vue,
// StockDupontFactorLevelChart.vue) — oldest-to-newest, current period is always the last entry.
const points = computed<Point[]>(() => {
  const roaByQuarter = byQuarter(roa.data.value)
  const equityByQuarter = byQuarter(equityBasis.data.value)
  return (dupont.data.value ?? []).map(entry => {
    const key = periodLabel(entry)
    return {
      label: key,
      roa: roaByQuarter.get(key)?.value ?? null,
      dupont: entry,
      equityMultiplier: equityByQuarter.get(key)?.equityMultiplier ?? null
    }
  })
})

const current = computed<Point | null>(() => {
  const list = points.value
  return list.length > 0 ? list[list.length - 1]! : null
})

const hasAnyData = computed(() => points.value.some(point => point.dupont !== null))

function average(selector: (point: Point) => number | null): number | null {
  const values = points.value.map(selector).filter((value): value is number => value !== null)
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function combinedBurden(entry: DupontHistoryEntry | null): number | null {
  if (!entry || entry.dupontTaxBurdenPct === null || entry.dupontInterestBurdenPct === null) return null
  return entry.dupontTaxBurdenPct * (entry.dupontInterestBurdenPct / 100)
}

// Same telescoping math as StockDupontFactorLevelChart.vue's own reconstructedRoe() — 3因子/
// 4因子/5因子 all read a genuine TTM-native field (decomposedRoePct/dupontExtendedRoePct, see
// this file's top comment for why that's exact here rather than reconstructed from Q parts);
// only 2因子 multiplies two separately-fetched values and can diverge slightly as a result.
function reconstructedRoe(point: Point | null): number | null {
  if (!point) return null
  if (factorLevel.value === 2) {
    return point.roa !== null && point.equityMultiplier !== null ? point.roa * point.equityMultiplier : null
  }
  if (factorLevel.value === 3) return point.dupont?.decomposedRoePct ?? null
  return point.dupont?.dupontExtendedRoePct ?? null
}

interface FactorDef {
  key: string
  label: string
  unit: '%' | '×'
  value: (point: Point) => number | null
}

// One entry per factor at each level, same order/grouping as StockDupontFactorLevelChart.vue's
// own FACTOR_SERIES (kept in sync intentionally — same underlying telescoping decomposition).
const LEVEL_FACTORS: Record<2 | 3 | 4 | 5, FactorDef[]> = {
  2: [{ key: 'roa', label: 'ROA 實際 TTM', unit: '%', value: point => point.roa }],
  3: [{ key: 'npm', label: '淨利率', unit: '%', value: point => point.dupont?.netProfitMarginPct ?? null }],
  4: [
    { key: 'burden', label: '稅務利息綜合負擔', unit: '%', value: point => combinedBurden(point.dupont) },
    { key: 'ebit', label: 'EBIT 利潤率', unit: '%', value: point => point.dupont?.dupontEbitMarginPct ?? null }
  ],
  5: [
    { key: 'tax', label: '租稅負擔', unit: '%', value: point => point.dupont?.dupontTaxBurdenPct ?? null },
    { key: 'interest', label: '利息負擔', unit: '%', value: point => point.dupont?.dupontInterestBurdenPct ?? null },
    { key: 'ebit', label: 'EBIT 利潤率', unit: '%', value: point => point.dupont?.dupontEbitMarginPct ?? null }
  ]
}

// 總資產週轉率 appears at every level except 2因子 (ROA already bundles it); 權益乘數（單季）
// appears at every level, always last, right before the assembled total.
function activeFactorDefs(): FactorDef[] {
  const base = LEVEL_FACTORS[factorLevel.value]
  const withTurnover =
    factorLevel.value === 2
      ? base
      : [...base, { key: 'at', label: '總資產週轉率', unit: '×' as const, value: (point: Point) => point.dupont?.assetTurnover ?? null }]
  return [...withTurnover, { key: 'em', label: '權益乘數（單季）', unit: '×', value: (point: Point) => point.equityMultiplier }]
}

interface FactorCard {
  key: string
  label: string
  unit: '%' | '×'
  current: number | null
  average: number | null
}

const factorCards = computed<FactorCard[]>(() =>
  activeFactorDefs().map(def => ({
    key: def.key,
    label: def.label,
    unit: def.unit,
    current: current.value ? def.value(current.value) : null,
    average: average(def.value)
  }))
)

const totalLabel = computed(() => (factorLevel.value === 2 ? '組裝 ROE（TTM，還原）' : '組裝 ROE（TTM）'))

// Negative equity check happens HERE, client-side, on the most recent period's own equity
// multiplier — per analysis-ts's own direct confirmation this is now the only way to detect it
// (see this file's own top comment). A neutral, factual description, not a backend-provided
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
      <div class="dupont-five-stage__header">
        <span class="dupont-five-stage__title">
          杜邦拆解對照（指標卡）
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '300px' }">
            <el-icon class="dupont-five-stage__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <el-select v-model="factorLevel" class="dupont-five-stage__level-select">
          <el-option :value="2" label="2因子" />
          <el-option :value="3" label="3因子" />
          <el-option :value="4" label="4因子" />
          <el-option :value="5" label="5因子" />
        </el-select>
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <div v-loading="pending" class="dupont-five-stage__row">
        <template v-for="(card, index) in factorCards" :key="card.key">
          <div class="dupont-five-stage__connector" v-if="index > 0">×</div>
          <div class="dupont-five-stage__card" :class="{ 'dupont-five-stage__card--warning': card.key === 'em' && hasNegativeEquity }">
            <p class="dupont-five-stage__label">{{ card.label }}</p>

            <template v-if="card.key === 'em' && hasNegativeEquity">
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
                <span v-if="card.current > card.average" class="is-up">▲ 高於近4期自身平均</span>
                <span v-else-if="card.current < card.average" class="is-down">▼ 低於近4期自身平均</span>
                <span v-else class="dupont-five-stage__compare-flat">－ 與近4期自身平均持平</span>
              </p>
              <p v-else class="dupont-five-stage__compare dupont-five-stage__compare-flat">近4期平均：{{ formatValue(card.average, card.unit) }}</p>
            </template>
          </div>
        </template>

        <div class="dupont-five-stage__connector">=</div>
        <div class="dupont-five-stage__card dupont-five-stage__card--total">
          <p class="dupont-five-stage__label">{{ totalLabel }}</p>
          <p class="dupont-five-stage__value" :class="{ 'dupont-five-stage__value--warning': hasNegativeEquity }">
            {{ formatValue(reconstructedRoe(current), '%') }}
          </p>
          <p v-if="hasNegativeEquity" class="dupont-five-stage__warning-note">
            <el-icon><WarningFilled /></el-icon>股東權益為負，此數值意義有限
          </p>
        </div>
      </div>
      <SharedDataFreshnessNote
        v-if="current"
        source-label="公開發行公司財務報表"
        :as-of="current.label"
      />
    </template>
  </el-card>
</template>

<style scoped>
.dupont-five-stage {
  border-radius: 12px;
  grid-column: 1 / -1;
}

.dupont-five-stage__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
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

.dupont-five-stage__level-select {
  width: 100px;
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
