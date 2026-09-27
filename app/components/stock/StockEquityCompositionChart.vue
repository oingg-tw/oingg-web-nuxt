<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import type { EquityCompositionPeriod } from '#shared/types/stock-equity-composition'
import { getAccentColor, getChartInk } from '~/utils/chart-palette'
import { CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

// 沒註冊的 series type 不會丟錯，只會靜靜地畫出一個空的座標區（2026-09-21 就是這樣踩到的）。
// BarChart 和 LegendComponent 都是這張圖新用的，少任何一個都不會有錯誤訊息。
use([SVGRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps<{ periods: EquityCompositionPeriod[] }>()

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const { scale: textScale } = useTextScale()

const YI = 1e5 // 千元 → 億元

// 保留盈餘拿強調色，其餘用墨色階——不是配色偷懶，是這張圖的問題（淨值是自己賺的還是股東投的）只有
// 這一層在回答，把五層畫成同樣醒目的五個顏色等於說它們一樣重要。方向性不靠顏色帶：堆疊的順序固定，
// 圖例和 tooltip 各自說了是哪一層。
const series = computed(() => {
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  const ink = chartInk.value
  return [
    { name: '保留盈餘', pick: (p: EquityCompositionPeriod) => p.retainedEarnings, color: accent },
    { name: '資本公積', pick: (p: EquityCompositionPeriod) => p.capitalReserve, color: ink.secondary },
    { name: '股本', pick: (p: EquityCompositionPeriod) => p.issuedCapital, color: ink.muted },
    { name: '其他權益', pick: (p: EquityCompositionPeriod) => p.otherEquity, color: ink.baseline },
    // 庫藏股在恆等式裡是減項，所以送負值進去——ECharts 會把它疊到零軸下面，跟正的那疊分開。法規上限
    // 讓它在幾乎每一檔都是看不見的薄片（2317 是 0.15 億對 19,079 億），但它在式子裡，就該在圖裡。
    { name: '庫藏股', pick: (p: EquityCompositionPeriod) => -p.treasuryShares, color: ink.gridline }
  ]
})

const chartOption = computed(() => {
  const periods = props.periods
  const labelFont = (16 * Number(textScale.value)) / 100
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    // containLabel 只替軸標籤留位置，不認得圖例——bottom: 8 的時候圖例直接印在年度標籤上面。
    // 56 是照圖例在 375 寬會折成兩行抓的（1440 是一行），top: 24 則是給「億元」軸名的，8 會被切掉。
    grid: { left: 8, right: 8, top: 24, bottom: 56, containLabel: true },
    legend: { bottom: 0, textStyle: { color: chartInk.value.primary, fontSize: labelFont }, itemHeight: 12 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (params: { dataIndex?: number }[]) => {
        const period = periods[params[0]?.dataIndex ?? 0]
        if (!period) return ''
        const rows = series.value
          .map(item => `<div>${item.name}　${(item.pick(period) / YI).toFixed(0)} 億</div>`)
          .join('')
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${period.label}　淨值 ${(period.equity / YI).toFixed(0)} 億</div>${rows}</div>`
      }
    },
    xAxis: {
      type: 'category',
      data: periods.map(period => period.label),
      axisLine: { lineStyle: { color: chartInk.value.baseline } },
      axisTick: { show: false },
      // 刻意不設 interval: 0（瀑布圖那邊有設，理由不能照搬）。375 寬六個年度會擠在一起，而這裡
      // 讓 ECharts 自己藏掉撞到的標籤是安全的：圖的正上方就是同樣六列、六個欄位的 SSR 表格，
      // 少一個刻度標籤不會有任何數字消失。瀑布圖沒有那張表，所以它必須每根都標。
      axisLabel: { color: chartInk.value.muted, fontSize: labelFont }
    },
    yAxis: {
      type: 'value',
      name: '億元',
      nameTextStyle: { color: chartInk.value.muted, fontSize: labelFont },
      splitLine: { lineStyle: { color: chartInk.value.gridline } },
      axisLabel: { color: chartInk.value.muted, fontSize: labelFont }
    },
    series: series.value.map(item => ({
      name: item.name,
      type: 'bar',
      stack: 'equity',
      itemStyle: { color: item.color },
      data: periods.map(period => Number((item.pick(period) / YI).toFixed(1)))
    }))
  }
})
</script>

<template>
  <SharedChart class="stock-equity-composition-chart" :option="chartOption" :init-options="{ renderer: 'svg' }" autoresize />
</template>

<style scoped>
.stock-equity-composition-chart {
  width: 100%;
  height: 380px;
}
</style>
