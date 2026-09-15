<script setup lang="ts">
import type { LookbackWindow } from '~/utils/lookback-window'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricsHistoryEntry } from '~/composables/stock/useMetricsHistory'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, MarkLineComponent])

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = 'PEAD文獻旗艦指標：盈餘意外標準化分數'

// 成長動能 tab's time-series companion to the SUE guru badge (see guru-badges.ts's own 'sue'
// entry) — design confirmed directly 2026-09-10 ("兩個都做": both a badge AND a chart). The
// badge only ever shows the LATEST quarter's snapshot; PEAD (Post-Earnings-Announcement Drift)
// literature's own core claim is about the pattern ACROSS consecutive quarters (an extreme SUE
// quarter tends to be followed by continued drift, not an isolated one-off), so a chart is the
// more faithful way to actually let a reader see that pattern, not just today's single number.
// A ±2 mark-line is drawn at the same threshold the badge itself uses (PEAD literature's common
// "significant surprise" cutoff) so a reader can see at a glance which quarters crossed it,
// without needing to cross-reference the badge's own written threshold separately.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const activeTab = ref<LookbackWindow>('近5年')
const limit = computed(() => LOOKBACK_WINDOW_YEARS[activeTab.value] * 4)

const history = useMetricsHistory(symbolRef, ref(['sue']), ref('Q'), limit)

const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => history.total.value !== null && history.total.value! < years * 4)
)

interface Point {
  label: string
  sue: number | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    sue: entry.values.sue?.value ?? null
  }))
)

const hasAnyData = computed(() => points.value.some(point => point.sue !== null))

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    const point = list[i]!
    if (point.sue !== null) return point
  }
  return null
})

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColor = computed(() => getChartAccentGold(resolvedMode.value))

interface AxisTooltipParam {
  dataIndex?: number
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 8, top: 36, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: chartInk.value.baseline } },
    appendTo: 'body',
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
    textStyle: { color: CHART_TOOLTIP_INK.primary },
    formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
      const list = Array.isArray(params) ? params : [params]
      const dataIndex = list[0]?.dataIndex ?? 0
      const point = points.value[dataIndex]
      if (!point) return ''
      return `<div style="font-size:16px;min-width:150px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        <div>SUE：<strong>${point.sue !== null ? `${point.sue.toFixed(2)} 分` : '資料不足'}</strong></div>
      </div>`
    }
  },
  xAxis: {
    type: 'category',
    data: points.value.map(point => point.label),
    axisLine: { lineStyle: { color: chartInk.value.baseline } },
    axisTick: { show: false },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  yAxis: {
    type: 'value',
    name: '分',
    nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
    scale: true,
    splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  series: [
    {
      name: 'SUE',
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: lineColor.value },
      itemStyle: { color: lineColor.value },
      data: points.value.map(point => point.sue),
      markLine: {
        symbol: 'none',
        silent: true,
        label: { color: chartInk.value.muted, fontSize: 16 },
        lineStyle: { color: chartInk.value.gridline, type: 'dashed' },
        data: [{ yAxis: 2, name: '顯著正向意外門檻' }, { yAxis: -2, name: '顯著負向意外門檻' }]
      }
    }
  ]
}))
</script>

<template>
  <el-card class="sue-chart" shadow="never">
    <template #header>
      <div class="sue-chart__header">
        <span class="sue-chart__title">
          標準化未預期盈餘 (SUE)
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="sue-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :disabled-years="disabledYears" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else>
      <VChart v-loading="history.pending.value" class="sue-chart__chart" :option="option" autoresize />
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.sue-chart {
  border-radius: 12px;
}

.sue-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sue-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.sue-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.sue-chart__chart {
  height: 240px;
  width: 100%;
}
</style>
