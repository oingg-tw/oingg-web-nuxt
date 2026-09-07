<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricBasis, MetricCode } from '~/composables/stock/useMetricHistory'
import type { DupontBasis, DupontHistoryEntry } from '~/composables/stock/useDupontHistory'

const INFO_TEXT = 'ROE 可以拆成2、3、4或5個因子，拆得越細，看得越清楚獲利是本業、周轉還是槓桿撐出來的；同一拆法下，因子相乘後應該還原回同一個數字。「還原ROE」是用單季數字算出來的單季報酬率，跟最左邊「ROE（實際，TTM）」的近四季年化口徑不同，兩者數字對不上是正常的，不是算錯——拆解對照請看同一列裡「還原ROE」在不同因子數下是否一致，不是跟最左欄比對。'

// Per direct request ("我想把 ROE拆解對照與杜邦分析整合，變成 2因子 3因子 4因子 5因子 的變化，
// 請做一張整合表，我好比較") — a NEW card, additive alongside StockRoeCompositionChart.vue/
// StockDupontChart.vue/StockDupontExtendedChart.vue (直接問過，舊的三張都保留，這張是第4張)。
// Layout confirmed directly ("2345因子 做成除了5年10年外的另一個select") — periods as table
// rows (matching the original ROE拆解對照 table's own layout before it became a chart), with a
// SECOND dropdown next to SharedLookbackWindowSelect that swaps which factor-level's own
// columns render, rather than trying to fit all 4 levels' columns side by side (2+3+4+5 = 14
// factor columns at once would be unreadable).
//
// The 4 levels telescope into each other rather than being 4 unrelated formulas:
//   2因子: ROE = ROA × 權益乘數
//   3因子: ROE = 淨利率 × 總資產週轉率 × 權益乘數        (淨利率 = 稅務利息綜合負擔 × EBIT利潤率)
//   4因子: ROE = 稅務利息綜合負擔 × EBIT利潤率 × 總資產週轉率 × 權益乘數
//   5因子: ROE = 租稅負擔 × 利息負擔 × EBIT利潤率 × 總資產週轉率 × 權益乘數
// 3因子/4因子/5因子's own factors all come from the basis=Q dupont-history fetch, so their
// "還原ROE" columns reconstruct the exact same SINGLE-QUARTER ROE by construction (confirmed
// live: dupontExtendedRoePct always equals decomposedRoePct — see useDupontHistory.ts's own
// comment) — mathematically identical across those 3 levels, not independent estimates.
// Showing all 3 is still useful (per the blog article this was built for: "看到 ROE 異常飆
// 高，先查權益乘數有沒有同步異常"): it reinforces that the pieces always multiply back
// regardless of how finely you split them.
//
// IMPORTANT: none of the 4 levels' own "還原ROE" is on the same basis as the reference
// "ROE（實際，TTM）" column on the far left — that one is trailing-four-quarter annualized,
// every 還原ROE here is a single quarter (2330 2026Q2: ROE實際=34.78%, 還原ROE=11.37% at
// every level — roughly 1/4, not a bug). 2因子 additionally uses the REAL reported ROA (its
// own TTM endpoint) rather than a derived Q-basis one, so it diverges from 3/4/5因子's own
// 還原ROE too, for the same TTM-vs-Q reason. Column labels/INFO_TEXT say this explicitly
// rather than leaving a reader to assume a mismatch is a calculation error.
//
// taxBurden/interestBurden arrive as "Pct" numbers (e.g. 81.93 meaning 81.93%) but combine
// as FRACTIONS, not Pct numbers, confirmed live against real data (2330 2026Q2: 81.93 ×
// (99.64/100) = 81.63, and 81.63 × (68.13 EBIT margin, itself a Pct number) / 100 = 55.62 =
// netProfitMarginPct exactly) — i.e. combinedBurden = taxBurden × (interestBurden/100).
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))
const factorLevel = ref<2 | 3 | 4 | 5>(3)

const roe = useMetricHistory(symbolRef, ref<MetricCode>('roe'), ref<MetricBasis>('TTM'), limit)
const roa = useMetricHistory(symbolRef, ref<MetricCode>('roa'), ref<MetricBasis>('TTM'), limit)
const dupont = useDupontHistory(symbolRef, ref<DupontBasis>('Q'), limit)

const pending = computed(() => roe.pending.value || roa.pending.value || dupont.pending.value)
const tenYearDisabled = computed(() => roe.total.value !== null && roe.total.value < 40)

interface Row {
  label: string
  roe: number | null
  roa: number | null
  dupont: DupontHistoryEntry | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

function byQuarter<T extends { fiscalYear: number; fiscalQuarter: number }>(entries: T[] | null): Map<string, T> {
  return new Map((entries ?? []).map(entry => [periodLabel(entry), entry]))
}

// roe.data anchors the row list, newest period first — table reading convention (matches
// StockFinancialStatementsCard.vue), unlike this page's charts which plot oldest-to-newest.
const rows = computed<Row[]>(() => {
  const roaByQuarter = byQuarter(roa.data.value)
  const dupontByQuarter = byQuarter(dupont.data.value)
  return [...(roe.data.value ?? [])].reverse().map(entry => {
    const key = periodLabel(entry)
    return {
      label: key,
      roe: entry.value,
      roa: roaByQuarter.get(key)?.value ?? null,
      dupont: dupontByQuarter.get(key) ?? null
    }
  })
})

const hasAnyData = computed(() => rows.value.some(row => row.roe !== null))

function combinedBurden(entry: DupontHistoryEntry | null): number | null {
  if (!entry || entry.dupontTaxBurdenPct === null || entry.dupontInterestBurdenPct === null) return null
  return entry.dupontTaxBurdenPct * (entry.dupontInterestBurdenPct / 100)
}

function formatPct(value: number | null): string {
  return value === null ? '－' : `${value.toFixed(2)}%`
}

function formatMultiple(value: number | null): string {
  return value === null ? '－' : `${value.toFixed(2)}倍`
}

interface FactorColumn {
  key: string
  label: string
  format: (row: Row) => string
}

// One column set per level — each ends in its own 還原ROE so the reconstruction is visible
// right next to the factors that produced it, without needing to scroll back to the shared
// ROE（實際）column on the far left.
const FACTOR_COLUMNS: Record<2 | 3 | 4 | 5, FactorColumn[]> = {
  2: [
    { key: 'roa', label: 'ROA（實際，TTM）', format: row => formatPct(row.roa) },
    { key: 'em', label: '權益乘數（單季）', format: row => formatMultiple(row.dupont?.equityMultiplier ?? null) },
    {
      key: 'reconstructed',
      label: '還原 ROE（單季）',
      format: row => formatPct(row.roa !== null && row.dupont?.equityMultiplier != null ? row.roa * row.dupont.equityMultiplier : null)
    }
  ],
  3: [
    { key: 'npm', label: '淨利率', format: row => formatPct(row.dupont?.netProfitMarginPct ?? null) },
    { key: 'at', label: '總資產週轉率', format: row => formatMultiple(row.dupont?.assetTurnover ?? null) },
    { key: 'em', label: '權益乘數（單季）', format: row => formatMultiple(row.dupont?.equityMultiplier ?? null) },
    { key: 'reconstructed', label: '還原 ROE（單季）', format: row => formatPct(row.dupont?.decomposedRoePct ?? null) }
  ],
  4: [
    { key: 'burden', label: '稅務利息綜合負擔', format: row => formatPct(combinedBurden(row.dupont)) },
    { key: 'ebit', label: 'EBIT 利潤率', format: row => formatPct(row.dupont?.dupontEbitMarginPct ?? null) },
    { key: 'at', label: '總資產週轉率', format: row => formatMultiple(row.dupont?.assetTurnover ?? null) },
    { key: 'em', label: '權益乘數（單季）', format: row => formatMultiple(row.dupont?.equityMultiplier ?? null) },
    { key: 'reconstructed', label: '還原 ROE（單季）', format: row => formatPct(row.dupont?.dupontExtendedRoePct ?? null) }
  ],
  5: [
    { key: 'tax', label: '租稅負擔', format: row => formatPct(row.dupont?.dupontTaxBurdenPct ?? null) },
    { key: 'interest', label: '利息負擔', format: row => formatPct(row.dupont?.dupontInterestBurdenPct ?? null) },
    { key: 'ebit', label: 'EBIT 利潤率', format: row => formatPct(row.dupont?.dupontEbitMarginPct ?? null) },
    { key: 'at', label: '總資產週轉率', format: row => formatMultiple(row.dupont?.assetTurnover ?? null) },
    { key: 'em', label: '權益乘數（單季）', format: row => formatMultiple(row.dupont?.equityMultiplier ?? null) },
    { key: 'reconstructed', label: '還原 ROE（單季）', format: row => formatPct(row.dupont?.dupontExtendedRoePct ?? null) }
  ]
}

const activeColumns = computed(() => FACTOR_COLUMNS[factorLevel.value])

// el-table's own `min-width` per column is only a floor WITHIN its default proportional
// distribution, not something that forces the table past its container — confirmed live,
// without this the table just compressed every column below its own min-width instead of
// overflowing (scrollWidth stayed equal to clientWidth despite 5因子's 8 columns). Forcing the
// table's own rendered width to the sum of its columns' min-widths is what actually makes it
// wider than `.dupont-factor-level-table__scroll` and gives that wrapper's overflow-x real
// content to scroll.
const tableMinWidth = computed(() => 100 + 110 + activeColumns.value.length * 130)
</script>

<template>
  <el-card class="dupont-factor-level-table" shadow="never">
    <template #header>
      <div class="dupont-factor-level-table__header">
        <span class="dupont-factor-level-table__title">
          杜邦拆解對照表
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dupont-factor-level-table__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <div class="dupont-factor-level-table__controls">
          <el-select v-model="factorLevel" class="dupont-factor-level-table__level-select">
            <el-option :value="2" label="2因子" />
            <el-option :value="3" label="3因子" />
            <el-option :value="4" label="4因子" />
            <el-option :value="5" label="5因子" />
          </el-select>
          <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
        </div>
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <!-- Column count varies 4-8 depending on factorLevel (期別+ROE實際+2~6 factor columns),
         wider than the card at 5因子 — wrapped in its own overflow-x:auto container rather
         than letting el-table's columns compress to fit (confirmed live: without this, column
         text visibly truncated instead of the table scrolling). -->
    <div v-else class="dupont-factor-level-table__scroll">
      <el-table v-loading="pending" :data="rows" size="small" :style="{ minWidth: `${tableMinWidth}px` }">
        <el-table-column label="期別" prop="label" min-width="100" fixed />
        <el-table-column label="ROE（實際，TTM）" align="right" min-width="110">
          <template #default="{ row }: { row: Row }">{{ formatPct(row.roe) }}</template>
        </el-table-column>
        <el-table-column
          v-for="column in activeColumns"
          :key="column.key"
          :label="column.label"
          align="right"
          min-width="130"
        >
          <template #default="{ row }: { row: Row }">{{ column.format(row) }}</template>
        </el-table-column>
      </el-table>
    </div>
  </el-card>
</template>

<style scoped>
.dupont-factor-level-table {
  border-radius: 12px;
}

.dupont-factor-level-table__scroll {
  overflow-x: auto;
}

.dupont-factor-level-table__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.dupont-factor-level-table__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.dupont-factor-level-table__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.dupont-factor-level-table__controls {
  display: flex;
  gap: 8px;
}

.dupont-factor-level-table__level-select {
  width: 100px;
}

:deep(.el-table) {
  max-height: 320px;
  overflow-y: auto;
}
</style>
