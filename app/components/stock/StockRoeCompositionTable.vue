<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricBasis, MetricCode } from '~/composables/stock/useMetricHistory'
import type { DupontBasis } from '~/composables/stock/useDupontHistory'

const INFO_TEXT = 'ROE ≈ ROA × 權益乘數：同一個 ROE，可能是資產報酬率真的高，也可能是靠拉高槓桿（權益乘數）撐出來的。三個數字並列，比只看 ROE 更容易看出獲利是不是靠借錢堆出來的。'

// Per direct request ("個股瀏覽 卡片 獲利品質 多做一張表，這個表是把ROE ROA 權益乘數 放在一起
// 看") after the user read docs/blog's own ROE不能跨產業比較 article (`content/blog/ROE不能跨
// 產業比較：杜邦五因子拆解與三大商業模式原型.md`) — that article's core teaching is "ROE 高
// 不代表公司賺錢能力強... 看到 ROE 數字異常飆高，第一步該查權益乘數有沒有同步異常升高", which
// is awkward to verify by eye across 3 separate line charts (ROE 趨勢/ROA 趨勢 are on
// StockMetricHistoryChart.vue, 權益乘數 is a line inside StockDupontChart.vue) — a table putting
// all 3 numbers in the same row per period makes that comparison direct instead of inferred.
//
// ROE/ROA come from analysis-ts's dedicated roe-history/roa-history endpoints (basis=TTM, same
// as StockMetricHistoryChart.vue's own cards); 權益乘數 has no TTM variant (balance-sheet
// point-in-time snapshot — see useDupontHistory.ts's own comment), so it's sourced from a
// separate basis=Q dupont-history fetch and merged in by fiscal quarter, same pattern
// StockDupontChart.vue already uses for its own 權益乘數 line.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const roe = useMetricHistory(symbolRef, ref<MetricCode>('roe'), ref<MetricBasis>('TTM'), limit)
const roa = useMetricHistory(symbolRef, ref<MetricCode>('roa'), ref<MetricBasis>('TTM'), limit)
const dupont = useDupontHistory(symbolRef, ref<DupontBasis>('Q'), limit)

const pending = computed(() => roe.pending.value || roa.pending.value || dupont.pending.value)
// Disabled unless total actually reaches 40 (a genuine 10 years) — same "不滿十年不給看"
// convention as every other lookback-window card on this page (see e.g.
// StockMetricHistoryChart.vue's own comment).
const tenYearDisabled = computed(() => roe.total.value !== null && roe.total.value < 40)

interface Row {
  label: string
  roe: number | null
  roa: number | null
  equityMultiplier: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

function byQuarter<T extends { fiscalYear: number; fiscalQuarter: number }>(entries: T[] | null): Map<string, T> {
  return new Map((entries ?? []).map(entry => [periodLabel(entry), entry]))
}

// roe.data anchors the row list (same "one fetch drives the period axis, others matched in by
// quarter" shape as StockValuationRiverChart.vue's `points`) — newest period first, the natural
// reading order for a table (StockFinancialStatementsCard.vue's own three-statement tables read
// the same way), unlike the charts on this page which plot oldest-to-newest left-to-right.
const rows = computed<Row[]>(() => {
  const roaByQuarter = byQuarter(roa.data.value)
  const dupontByQuarter = byQuarter(dupont.data.value)
  return [...(roe.data.value ?? [])].reverse().map(entry => {
    const key = periodLabel(entry)
    return {
      label: key,
      roe: entry.value,
      roa: roaByQuarter.get(key)?.value ?? null,
      equityMultiplier: dupontByQuarter.get(key)?.equityMultiplier ?? null
    }
  })
})

const hasAnyData = computed(() => rows.value.some(row => row.roe !== null || row.roa !== null || row.equityMultiplier !== null))

function formatPct(value: number | null): string {
  return value === null ? '－' : `${value.toFixed(2)}%`
}

function formatMultiple(value: number | null): string {
  return value === null ? '－' : `${value.toFixed(2)}倍`
}
</script>

<template>
  <el-card class="roe-composition-table" shadow="never">
    <template #header>
      <div class="roe-composition-table__header">
        <span class="roe-composition-table__title">
          ROE 拆解對照
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="roe-composition-table__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <el-table v-else v-loading="pending" :data="rows" size="small">
      <el-table-column label="期別" prop="label" min-width="100" />
      <el-table-column label="ROE" align="right" min-width="100">
        <template #default="{ row }: { row: Row }">{{ formatPct(row.roe) }}</template>
      </el-table-column>
      <el-table-column label="ROA" align="right" min-width="100">
        <template #default="{ row }: { row: Row }">{{ formatPct(row.roa) }}</template>
      </el-table-column>
      <el-table-column label="權益乘數（單季）" align="right" min-width="130">
        <template #default="{ row }: { row: Row }">{{ formatMultiple(row.equityMultiplier) }}</template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<style scoped>
.roe-composition-table {
  border-radius: 12px;
}

.roe-composition-table__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.roe-composition-table__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.roe-composition-table__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

:deep(.el-table) {
  max-height: 320px;
  overflow-y: auto;
}
</style>
