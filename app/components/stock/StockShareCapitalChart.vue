<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { CHANGE_SOURCE_LABELS, type CapitalStockEntry } from '~/composables/stock/useCapitalStockHistory'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const props = defineProps<{
  entries: CapitalStockEntry[]
}>()

// '近5年'/'近10年' matches the same lookback-window convention as the PER/PBR river charts
// (docs/investment-knowledge/基本面財報觀察年限分析.md) — this is an event series (0 or several rows
// a year, only when a real capital change happened), not a fixed-cadence series, so "近5年"
// here means "any entry effective in the last 5 years", not "the last 5 entries".
const activeTab = ref<'近5年' | '近10年'>('近5年')

function entriesWithinYears(years: number): CapitalStockEntry[] {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - years)
  const cutoffLabel = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`
  return props.entries.filter(entry => entry.effectiveDate >= cutoffLabel)
}

const filteredEntries = computed(() => entriesWithinYears(activeTab.value === '近5年' ? 5 : 10))

// This endpoint returns EVERY entry it has (no limit/pagination, and no `total`/depth field
// either — see useCapitalStockHistory.ts's own comment), so unlike the metric-history family
// this can't defer to a backend-given field the way the other 5 cards do; the full dataset is
// already client-side, so the OLDEST entry's own date IS the depth signal.
//
// Per direct correction ("不滿十年不給看") this checks whether the underlying data genuinely
// reaches back a full decade — NOT whether 近5年/近10年 currently show the same count. Those
// can differ even with only ~5 years of real coverage (a sparse EVENT series can have its
// count identical across two windows purely by coincidence, or non-identical while still not
// spanning a real decade), and previously stayed enabled whenever counts diverged at all,
// which wasn't the right signal either. 2330 is the clearest case: entries reach back to 1991
// (genuinely >10 years), so 近10年 correctly stays enabled even though NO capital change
// happened between ~2016 and 2022 — the sparse event gap doesn't mean the coverage is shallow.
const oldestEntryDate = computed(() => props.entries.reduce((oldest, entry) => (entry.effectiveDate < oldest ? entry.effectiveDate : oldest), '9999-99'))
const tenYearInsufficient = computed(() => {
  if (!props.entries.length) return true
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 10)
  const cutoffLabel = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`
  return oldestEntryDate.value > cutoffLabel
})

// bigint doesn't survive JSON or arithmetic with Number directly at this scale without care,
// but paidInShares/paidInCapital are well within Number's safe range for any real Taiwan-listed
// company (low billions at most) — converting once here for chart/display math is fine.
function sharesInHundredMillion(shares: bigint | null): number | null {
  return shares === null ? null : Number(shares) / 1e8
}

function formatAmount(amount: bigint): string {
  return `${(Number(amount) / 1e8).toLocaleString('zh-TW', { maximumFractionDigits: 2 })} 億`
}

function tooltipHtml(entry: CapitalStockEntry): string {
  const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
  const shares = sharesInHundredMillion(entry.paidInShares)
  const rows = [`<div style="${rowStyle}"><span>流通股數</span><strong>${shares === null ? '—' : `${shares.toLocaleString('zh-TW', { maximumFractionDigits: 2 })} 億股`}</strong></div>`]
  for (const { source, amount } of entry.changeSources) {
    rows.push(`<div style="${rowStyle}"><span>${CHANGE_SOURCE_LABELS[source]}</span><strong>${formatAmount(amount)}</strong></div>`)
  }
  if (entry.other) rows.push(`<div style="padding:2px 0;">${entry.other}</div>`)
  if (entry.remarks) rows.push(`<div style="padding:2px 0;color:${CHART_INK.secondary};">${entry.remarks}</div>`)
  return `<div style="font-size:12px;min-width:160px;">
    <div style="font-weight:600;margin-bottom:4px;">${entry.effectiveDate}</div>
    ${rows.join('')}
  </div>`
}

interface AxisTooltipParam {
  dataIndex?: number
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 8, top: 16, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: CHART_INK.baseline } },
    appendTo: 'body',
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
    textStyle: { color: CHART_INK.primary },
    formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
      const list = Array.isArray(params) ? params : [params]
      const dataIndex = list[0]?.dataIndex ?? 0
      const entry = filteredEntries.value[dataIndex]
      return entry ? tooltipHtml(entry) : ''
    }
  },
  xAxis: {
    type: 'category',
    data: filteredEntries.value.map(entry => entry.effectiveDate),
    axisLine: { lineStyle: { color: CHART_INK.baseline } },
    axisTick: { show: false },
    axisLabel: { color: CHART_INK.muted, fontSize: 11 }
  },
  yAxis: {
    type: 'value',
    name: '億股',
    nameTextStyle: { color: CHART_INK.muted, fontSize: 11 },
    scale: true,
    splitLine: { lineStyle: { color: CHART_INK.gridline, type: 'solid' } },
    axisLabel: { color: CHART_INK.muted, fontSize: 11 }
  },
  series: [
    {
      name: '流通股數',
      type: 'line',
      // 'end' step, not a smooth curve — the real number only actually changes at each
      // recorded event and is otherwise flat, so a stepped line reads as "held steady, then
      // jumped" instead of implying a gradual drift between two known points that never
      // happened.
      step: 'end',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: CHART_ACCENT_GOLD },
      itemStyle: { color: CHART_ACCENT_GOLD },
      data: filteredEntries.value.map(entry => sharesInHundredMillion(entry.paidInShares))
    }
  ]
}))
</script>

<template>
  <el-card class="share-capital-chart" shadow="never">
    <template #header>
      <div class="share-capital-chart__header">
        <span class="share-capital-chart__title">股本變化</span>
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearInsufficient" />
      </div>
    </template>

    <el-empty v-if="!filteredEntries.length" description="這段期間沒有股本變動紀錄" :image-size="64" />
    <VChart v-else class="share-capital-chart__chart" :option="option" autoresize />
  </el-card>
</template>

<style scoped>
.share-capital-chart {
  border-radius: 12px;
}

.share-capital-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.share-capital-chart__title {
  font-weight: 600;
}

.share-capital-chart__chart {
  height: 240px;
  width: 100%;
}

</style>
