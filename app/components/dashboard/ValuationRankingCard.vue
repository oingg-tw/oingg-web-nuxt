<script setup lang="ts">
import { Coin } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import type { ValuationRanking, ValuationRankingField } from '~/composables/dashboard/useValuationRanking'
import type { ScreenerFieldValue } from '~/composables/screener/useFilterSearch'

// Wired to bff-ts's real GET /screener/ranking (confirmed live 2026-09-02) — NOT the
// /valuation/ranking path conductor originally mentioned; see useValuationRanking.ts's own
// comment for why that guess 404'd. Metric toggle covers all three valuation angles from one
// endpoint (just a different field param), mirroring RevenueRankingCard/EtfRankingCard's
// established metric-toggle pattern. No stock.price field in this endpoint's response, so
// (unlike the earlier fixture-shell version) there's no 股價 column here.
//
// All three fields are fetched independently up front (three static field refs, each its own
// useValuationRanking call — none ever changes, so each only ever fetches once) rather than
// one call driven by the visible `metric` toggle. Two reasons: the cross-metric ★ badge below
// needs all three rankings loaded regardless of which is on screen, and this avoids registering
// two separate useAsyncData calls under the same cache key (one for "whichever is active", one
// for badge tracking) — `metric` just picks which of the three already-loaded results to show.
const metric = ref<ValuationRankingField>('dividendYield.dividendYieldPct')

const METRIC_OPTIONS: { value: ValuationRankingField; label: string }[] = [
  { value: 'dividendYield.dividendYieldPct', label: '高殖利率' },
  { value: 'per.peRatio', label: '低本益比' },
  { value: 'pbr.pbRatio', label: '低淨值比' }
]

const dividendYieldField = ref<ValuationRankingField>('dividendYield.dividendYieldPct')
const perField = ref<ValuationRankingField>('per.peRatio')
const pbrField = ref<ValuationRankingField>('pbr.pbRatio')
const { data: dividendYieldData, pending: dividendYieldPending } = useValuationRanking(dividendYieldField)
const { data: perData, pending: perPending } = useValuationRanking(perField)
const { data: pbrData, pending: pbrPending } = useValuationRanking(pbrField)

const dataByField: Record<ValuationRankingField, Ref<ValuationRanking>> = {
  'dividendYield.dividendYieldPct': dividendYieldData,
  'per.peRatio': perData,
  'pbr.pbRatio': pbrData
}
const pendingByField: Record<ValuationRankingField, Ref<boolean>> = {
  'dividendYield.dividendYieldPct': dividendYieldPending,
  'per.peRatio': perPending,
  'pbr.pbRatio': pbrPending
}

const data = computed(() => dataByField[metric.value].value)
const pending = computed(() => pendingByField[metric.value].value)

// Explicit map rather than deriving from METRIC_OPTIONS' own label (e.g. label.slice(1) to
// drop the 高/低 prefix) — conductor's own review flagged that trick as fragile: it only
// works because all three current labels happen to be "one modifier char + 3 chars," and
// would silently break for a differently-shaped label on a future fourth metric.
const COLUMN_LABELS: Record<ValuationRankingField, string> = {
  'dividendYield.dividendYieldPct': '殖利率',
  'per.peRatio': '本益比',
  'pbr.pbRatio': '淨值比'
}

const PERCENT_FIELDS = new Set<ValuationRankingField>(['dividendYield.dividendYieldPct'])

function fieldValue(row: { values: Record<string, ScreenerFieldValue | null> }, field: ValuationRankingField): ScreenerFieldValue | null {
  return row.values[field] ?? null
}

function formatValue(field: ValuationRankingField, entry: ScreenerFieldValue | null): string {
  if (!entry || entry.value === null) return '—'
  return PERCENT_FIELDS.has(field) ? `${entry.value}%` : entry.value
}

// Per conductor's design feedback 2026-09-02: primary sort stays purely single-metric
// (predictable, transparent — never reordered by this), but a secondary visual marker flags
// rows that ALSO rank well on the other two metrics — matches how a 存股 investor actually
// screens (high yield alone isn't enough; high yield AND reasonable valuation is the real
// candidate). Kept purely factual (a tooltip naming which other metric(s) it ranks well on),
// not a judgment call like "cheap"/"buy signal" — conductor was explicit that oingg's
// data-tool-not-advisor positioning rules out anything that reads as a recommendation.
// TOP_N=3 out of a limit-20 ranking (top 15%) — revisit if the limit ever changes.
const TOP_N = 3

const topRankBySymbol = computed<Record<ValuationRankingField, Set<string>>>(() => ({
  'dividendYield.dividendYieldPct': new Set(dividendYieldData.value.results.slice(0, TOP_N).map(r => r.symbol)),
  'per.peRatio': new Set(perData.value.results.slice(0, TOP_N).map(r => r.symbol)),
  'pbr.pbRatio': new Set(pbrData.value.results.slice(0, TOP_N).map(r => r.symbol))
}))

function otherTopMetrics(symbol: string): string[] {
  return METRIC_OPTIONS.filter(o => o.value !== metric.value && topRankBySymbol.value[o.value].has(symbol)).map(o => o.label)
}

// el-table's #empty slot briefly renders far too narrow on first paint — reported ("重新整理的
// 時候 卡片沒資料 會出現 尚無資料 但是那個尚無資料本身是跑版的"), confirmed live via Playwright
// DOM inspection: root cause is `.el-scrollbar__view` (the direct parent of the empty block,
// inside el-table's internal scrollbar) being `display: inline-block`, which shrinks to its own
// content width instead of filling `.el-scrollbar__wrap` (its parent, which DOES already have
// the correct full width at that point) — a self-referential collapse, since inline-block sizing
// allows text to wrap, so the empty description text wrapping into single characters is what
// produces the narrow width that then perpetuates the wrap. A doLayout()-on-data-change fix
// (matching OrganismResultTable.vue's column-width-jitter fix) was tried first but didn't help —
// doLayout() recalculates el-table's own column widths, not this scrollbar-internal collapse.
// Fixed instead with the pure-CSS override below (:deep(.el-scrollbar__view)), which isn't
// subject to any JS timing race. doLayout() kept as a secondary aid for actual column-width
// jitter (a separate, already-solved issue — see that file's own comment).
const tableRef = ref<TableInstance>()
watch(data, () => nextTick(() => tableRef.value?.doLayout()))
</script>

<template>
  <el-card class="valuation-ranking-card" shadow="never">
    <template #header>
      <div class="valuation-ranking-card__header">
        <div class="valuation-ranking-card__title">
          <el-icon><Coin /></el-icon>
          <span>估值排行</span>
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
    <el-table ref="tableRef" v-loading="pending" :data="data.results" row-key="symbol" size="small" max-height="361" style="min-height: 200px">
      <template #empty>
        <el-empty description="尚無可比較資料" :image-size="64" />
      </template>
      <el-table-column label="股票" min-width="120">
        <template #default="{ row }">
          <div class="valuation-ranking-card__stock">
            <span class="valuation-ranking-card__code">
              {{ row.symbol }}
              <el-tag
                v-if="otherTopMetrics(row.symbol).length"
                size="small"
                type="info"
                effect="plain"
                :title="`同時也在${otherTopMetrics(row.symbol).join('、')}前${TOP_N}名`"
              >
                ★
              </el-tag>
            </span>
            <span class="valuation-ranking-card__name">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="COLUMN_LABELS[metric]" align="right" min-width="90">
        <template #default="{ row }">{{ formatValue(metric, fieldValue(row, metric)) }}</template>
      </el-table-column>
    </el-table>

    <p class="valuation-ranking-card__note">★ 同時位居其他估值指標前{{ TOP_N }}名</p>
    <p v-if="fieldValue(data.results[0] ?? { values: {} }, metric)" class="valuation-ranking-card__note">
      資料日期：{{ fieldValue(data.results[0]!, metric)?.asOfDate }}
    </p>
  </el-card>
</template>

<style scoped>
.valuation-ranking-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.valuation-ranking-card__title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.valuation-ranking-card__title .el-icon {
  color: var(--el-color-primary);
}

.valuation-ranking-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.valuation-ranking-card__code {
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.valuation-ranking-card__name {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.valuation-ranking-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}

/* Root-cause fix for the empty-state width glitch — see the tableRef comment above for the
   full DOM-inspection story. .el-scrollbar__view is inline-block by default and collapses to
   its own (wrapped, narrow) content instead of filling its already-correctly-sized parent. */
:deep(.el-scrollbar__view) {
  width: 100% !important;
}
</style>
