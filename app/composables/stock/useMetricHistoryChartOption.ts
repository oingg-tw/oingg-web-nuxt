import { formatSignificantDigits } from '~/utils/format-significant-digits'
import { getChartInk, getPriceColors, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'
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

  const { resolvedMode, market } = useAppTheme()
  const chartInk = computed(() => getChartInk(resolvedMode.value))
  const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))

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
          // 紅綠配色，而且**跟使用者自己的市場慣例連動**（2026-10-01 直接指示：「柱狀圖，改用紅綠
          // 配色作為主色調，這個顏色會跟主題的紅綠配色連動」）。顏色來自 getPriceColors，所以台股
          // 慣例是正紅負綠、歐美慣例自動翻轉、選了 ACCESSIBLE 的人拿到藍／橘——跟站上線圖、河流圖
          // 用的是同一支函式，不會出現「同一個漲跌概念在兩張圖上顏色相反」。
          //
          // 按**數值正負**上色，不是按跟前一期的增減：這張圖畫的是水準不是動能（每股盈餘 1.2 元就是
          // 賺錢，跟上一季比較低不代表虧損）。全為正的指標（負債比率、週轉天數…）因此整排同色，
          // 那是正確的——顏色在那種資料上本來就不帶資訊，不該硬造一個方向出來。
          //
          // **最後一柱不再用特別的顏色**（同日指示）。原本把它染成墨色當「現在在這裡」的提示，
          // 但 X 軸最右邊本來就是最新一期，而那個染色會跟正負上色打架：一根虧損的最新期會變成墨色，
          // 讀者看不出它是負的。
          data: list.map(entry => ({
            value: entry.value,
            itemStyle: { color: entry.value < 0 ? priceColors.value.down : priceColors.value.up }
          }))
        }
      ]
    }
  })

  return { chartOption }
}
