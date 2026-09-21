import { formatSignificantDigits } from '~/utils/format-significant-digits'
import { getAccentColor, getChartInk, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'

// The "points → echarts bar option" logic, extracted 2026-09-21 out of StockMetricHistoryChart.vue
// so it can be shared with StockMetricHistoryChartInteractive.vue without copy-pasting it a third
// time. StockMetricHistoryChart.vue (badge pages, static entries prop) keeps calling this exactly
// as it did inline before — same option shape, same behaviour, nothing about that component's own
// contract changed. The interactive one (metric pages only, per「el-card is-never-shadow
// stock-metric-page__card 卡片要可以切換單季或是近四季」— that class only exists on the metric-page
// template, badge pages weren't asked for this) builds its own `points` from a reactive fetch
// instead of a static prop, then calls this same function.
export interface MetricHistoryPoint {
  fiscalYear: number
  fiscalQuarter: number
  value: number
}

export function useMetricHistoryChartOption(
  points: Ref<MetricHistoryPoint[]>,
  topic: Ref<string>,
  unit: Ref<string>,
  timeframe: Ref<MetricsHistoryTimeframe>
) {
  const periodLabel = (fiscalYear: number, fiscalQuarter: number): string =>
    timeframe.value === 'FY' ? `${fiscalYear}` : `${fiscalYear} Q${fiscalQuarter}`

  const valueTextOf = (value: number): string => `${formatSignificantDigits(value, 3)}${unit.value}`

  const { resolvedMode, color: accentColorName } = useAppTheme()
  const chartInk = computed(() => getChartInk(resolvedMode.value))
  const accentColor = computed(() => getAccentColor(resolvedMode.value, accentColorName.value))

  interface BarTooltipParam { dataIndex?: number }

  const chartOption = computed(() => {
    const list = points.value
    return {
      textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
      grid: { left: 8, right: 16, top: 16, bottom: 28, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        appendTo: 'body',
        backgroundColor: CHART_TOOLTIP.backgroundColor,
        borderColor: CHART_TOOLTIP.borderColor,
        textStyle: { color: CHART_TOOLTIP_INK.primary },
        formatter: (params: BarTooltipParam | BarTooltipParam[]) => {
          const entry = list[(Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0]
          if (!entry) return ''
          return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${periodLabel(entry.fiscalYear, entry.fiscalQuarter)}</div>${valueTextOf(entry.value)}</div>`
        }
      },
      xAxis: {
        type: 'category',
        data: list.map(entry => periodLabel(entry.fiscalYear, entry.fiscalQuarter)),
        axisLine: { lineStyle: { color: chartInk.value.baseline } },
        axisTick: { show: false },
        axisLabel: { color: chartInk.value.muted, fontSize: 16 }
      },
      yAxis: {
        type: 'value',
        name: unit.value,
        nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
        splitLine: { lineStyle: { color: chartInk.value.gridline } },
        axisLabel: { color: chartInk.value.muted, fontSize: 16 }
      },
      series: [
        {
          name: topic.value,
          type: 'bar',
          data: list.map((entry, index) => ({
            value: entry.value,
            // The latest bar in a highlighted shade so "where we are now" is visible at a glance —
            // the same role a table's own bold current-period row plays where one exists alongside.
            itemStyle: index === list.length - 1 ? { color: chartInk.value.primary } : { color: accentColor.value }
          }))
        }
      ]
    }
  })

  return { chartOption }
}
