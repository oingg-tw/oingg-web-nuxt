<script setup lang="ts">
import { use } from 'echarts/core'
import { ScatterChart } from 'echarts/charts'
import { MarkLineComponent } from 'echarts/components'
import type { SectorCompanyRow } from '#shared/types/hub'

// 類股頁的盈餘發放率（2026-11-10，使用者選的設計頁 claude.ai/artifact/9C1Go34LxegryCVFdiJaBo 類股頁那一張）：電腦版一條數線，每家公司
// 一個點，標出類股的中位數與 100%；手機照設計頁收成三組表（高於、低於中位數、沒有數值），表內照代號排。
// 點的高度是代號算出來的固定值，只為了讓靠在一起的點上下錯開，不代表任何數字。軸畫到 200%（全市場超過的約 27 家，一個類股頂多幾家），
// 超過的畫在最右邊、換成三角形，實際數字在提示框
use([ScatterChart, MarkLineComponent])

const props = defineProps<{
  // 有數值的公司（跟類股分布同一年度）
  shown: SectorCompanyRow[]
  // 同一年度沒有數值的公司：虧損，或還沒有年度數字
  missing: SectorCompanyRow[]
  median: number
  sectorName: string
}>()

const PLOT_MAX = 200
const { resolvedMode, color: accentColorName } = useAppTheme()
const accent = computed(() => getAccentColor(resolvedMode.value, accentColorName.value))
const ink = computed(() => getChartInk(resolvedMode.value))
const payout = (row: SectorCompanyRow) => row.dividendPayoutRatio as number
const jitter = (symbol: string) => 0.1 + 0.8 * ([...symbol].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 997, 7) / 997)

const legend = computed(() => [{
  items: [
    { name: '公司', color: accent.value, kind: 'dot' as const },
    { name: '類股中位數', color: ink.value.primary, kind: 'line' as const },
    { name: '100%：配出的比賺的多', color: ink.value.secondary, kind: 'line' as const, dash: 'dashed' as const }
  ]
}])

interface PointParam { data?: { row: SectorCompanyRow } }
const option = computed(() => ({
  grid: { left: 8, right: 24, top: 16, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'item',
    formatter: (param: PointParam) => {
      const row = param.data?.row
      return row ? `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${row.symbol} ${row.name}</div><div>盈餘發放率 ${industryPct(row.dividendPayoutRatio)}</div></div>` : ''
    }
  },
  xAxis: { type: 'value', min: 0, max: PLOT_MAX, interval: 25, axisLabel: { formatter: (value: number) => `${value}%` } },
  yAxis: { type: 'value', min: 0, max: 1, show: false },
  series: [{
    type: 'scatter',
    // 10px：高齡友善規格對標記的下限是 8px（同類股頁的殖利率散佈圖）
    symbolSize: 10,
    itemStyle: { color: accent.value, opacity: 0.7 },
    data: props.shown.map(row => ({
      value: [Math.min(payout(row), PLOT_MAX), jitter(row.symbol)],
      ...(payout(row) > PLOT_MAX && { symbol: 'triangle', symbolRotate: -90, symbolSize: 12 }),
      row
    })),
    markLine: {
      symbol: 'none',
      silent: true,
      label: { show: false },
      data: [
        { xAxis: props.median, lineStyle: { color: ink.value.primary, type: 'solid', width: 2 } },
        { xAxis: 100, lineStyle: { color: ink.value.secondary, type: 'dashed', width: 2 } }
      ]
    }
  }]
}))

// 手機：設計頁的三組，收合的表（同殖利率那一段的 IndustryQuadrantTables）
const toRow = (row: SectorCompanyRow, cell: string) => ({ key: row.symbol, name: row.name, code: row.symbol, to: securityPath(row.symbol), cells: [cell] })
const groups = computed(() => {
  const above = props.shown.filter(row => payout(row) >= props.median)
  const below = props.shown.filter(row => payout(row) < props.median)
  return [
    { title: `發放率在類股中位數以上（${above.length} 家）`, rows: above.map(row => toRow(row, industryPct(row.dividendPayoutRatio))) },
    { title: `發放率低於類股中位數（${below.length} 家）`, rows: below.map(row => toRow(row, industryPct(row.dividendPayoutRatio))) },
    { title: `沒有數值（${props.missing.length} 家）`, rows: props.missing.map(row => toRow(row, row.dividendPayoutRatioLoss ? '虧損' : '－')) }
  ]
})
</script>

<template>
  <SharedChartCard class="app-wide-only">
    <SharedChartLegend :groups="legend" />
    <SharedChart class="industry-payout-chart" :option="option" autoresize :aria-label="`${sectorName}各公司盈餘發放率的分布，標出類股中位數與 100%`" />
  </SharedChartCard>
  <IndustryQuadrantTables class="app-narrow-only" :groups="groups" :columns="['公司', '發放率']" collapsed />
</template>

<style scoped>
/* 只有電腦版畫，一條數線：點只是上下錯開，15rem 就看得出疏密 */
.industry-payout-chart {
  height: 15rem;
}
</style>
