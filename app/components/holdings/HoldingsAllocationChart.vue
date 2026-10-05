<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { PieChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { getAccentColor, getChartInk, getStackLayerColors, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

// 持股比例的圓餅圖（使用者 2026-10-05：「我希望有圓餅圖可以看持股比例」）。
//
// 只畫市值最大的 6 檔，其餘合成「其他」：26 片的圓餅圖讀不出任何東西，而完整的比例在下面表格的「占比」欄
// ——圖不是唯一的資料路徑。每一片直接標名稱與百分比（不靠圖例、也不只靠顏色）。
//
// 顏色：第一片是使用者選的強調色，其餘用 getStackLayerColors（已量過對卡片底色 ≥3:1 的類別色，見
// chart-palette.ts）。片與片之間用卡片底色的描邊分開，相鄰兩片亮度接近時也分得出邊界。
//
// ECharts 沒有全域註冊：PieChart 與 SVG renderer 漏掉的話，SSR 看起來正常、瀏覽器裡才壞（而且不報錯）。
use([SVGRenderer, PieChart, TooltipComponent])

const props = defineProps<{
  // 已依市值由大到小排好
  items: { label: string; value: number }[]
}>()

const TOP = 6

const { resolvedMode, color: accentColorName } = useAppTheme()

const slices = computed(() => {
  const positive = props.items.filter(item => item.value > 0)
  const head = positive.slice(0, TOP)
  const rest = positive.slice(TOP).reduce((sum, item) => sum + item.value, 0)
  return rest > 0 ? [...head, { label: `其他 ${positive.length - TOP} 檔`, value: rest }] : head
})

const chartOption = computed(() => {
  const ink = getChartInk(resolvedMode.value)
  const colors = [getAccentColor(resolvedMode.value, accentColorName.value), ...getStackLayerColors(resolvedMode.value)]
  const total = slices.value.reduce((sum, item) => sum + item.value, 0)
  return {
    color: colors,
    tooltip: {
      ...CHART_TOOLTIP,
      textStyle: { color: CHART_TOOLTIP_INK.primary, fontSize: 16 },
      formatter: (params: { name: string; value: number }) =>
        `${params.name}<br>市值 ${holdingsMoney(params.value)} 元（${((params.value / total) * 100).toFixed(1)}%）`
    },
    series: [{
      type: 'pie',
      radius: ['38%', '68%'],
      center: ['50%', '50%'],
      itemStyle: { borderColor: resolvedMode.value === 'DARK' ? '#1e1e1e' : '#ffffff', borderWidth: 2 },
      label: { color: ink.primary, fontSize: 16, formatter: '{b}\n{d}%' },
      labelLine: { lineStyle: { color: ink.muted } },
      data: slices.value.map(item => ({ name: item.label, value: item.value }))
    }]
  }
})
</script>

<template>
  <SharedChart v-if="slices.length" class="holdings-allocation-chart" :option="chartOption" autoresize role="img" :aria-label="`持股比例：${slices.map(item => item.label).join('、')}`" />
</template>

<style scoped>
.holdings-allocation-chart {
  width: 100%;
  height: 360px;
}

@media (max-width: 767px) {
  .holdings-allocation-chart {
    height: 300px;
  }
}
</style>
