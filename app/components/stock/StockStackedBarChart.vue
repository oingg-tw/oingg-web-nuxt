<script setup lang="ts">
import { getAccentColor, getChartInk, getStackLayerColors } from '~/utils/chart-palette'

// 沒註冊的 series type 不會丟錯，只會靜靜地畫出一個空的座標區（2026-09-21 就是這樣踩到的）。
// BarChart 和 LegendComponent 都是這張圖新用的，少任何一個都不會有錯誤訊息。

// 一般化自 StockEquityCompositionChart.vue（2026-09-27 當天）。第二個使用者出現的時候抽出來而不是
// 複製：疊層的負值處理、圖例與 grid 的留白、ECharts 註冊這三件都是量出來的，兩份手維護的複本會
// 靜靜地飄開。兩個使用者分別是資產負債表頁的「淨值組成」（存量，億元）與「每股淨值怎麼變的」
// （流量，元／股），單位和層數都不同，所以這裡不碰數字，只負責畫。
//
// 第一層拿強調色、其餘用墨色階：堆疊圖的每一層不是一樣重要，把 N 層畫成 N 個同樣醒目的顏色等於說
// 它們一樣重要。呼叫端把「回答問題的那一層」排第一個。方向性不靠顏色帶——順序固定，圖例和 tooltip
// 各自說了是哪一層。
export interface StackedBarLayer {
  name: string
  // 已經換算成顯示單位的值，一個類別一個。負值會疊到零軸下面，這是刻意的（其他權益的匯率換算差額、
  // 現金股利都是真的負數）。
  values: number[]
}

const props = defineProps<{
  categories: string[]
  layers: StackedBarLayer[]
  unit: string
  // 這一層改用色階最後那個中性灰，而不是照順序拿下一個顏色（2026-09-28）。用途是「拆不開的那一塊」
  // ——它不是一個成分，是「這一期沒辦法拆」，用一個跟其他成分同樣鮮明的顏色會讓它讀起來像第四個科目。
  // 灰色本身也在 getStackLayerColors 裡、對比量過，不是另外挑一個沒驗過的顏色。
  neutralLayerName?: string
  // 每個類別的合計與說明，由呼叫端算——存量的合計是權益，流量的是期初→期末，這裡無從判斷。
  tooltipHeader: (index: number) => string
  height?: number
}>()

const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

// 第 0 層跟著使用者選的強調色，其餘來自 getStackLayerColors（對比度量過，見那邊的註解）。
// 第一版用 chartInk 的 baseline/gridline 當第 4、5 層，兩個對 light 卡片只有 1.65 和 1.21，
// 而且六層配五個值會繞回去撞色——1294 的「現金股利」和「其他」曾經是同一個灰。
const layerColors = computed(() => {
  const ramp = getStackLayerColors(resolvedMode.value)
  const neutral = ramp[ramp.length - 1]!
  const ordered = [getAccentColor(resolvedMode.value, accentColorName.value), ...ramp]
  // 中性層佔掉灰色，其餘各層照順序跳過它，否則會有兩層同色。
  if (!props.neutralLayerName) return ordered
  const rest = ordered.filter(color => color !== neutral)
  let i = 0
  return props.layers.map(layer => (layer.name === props.neutralLayerName ? neutral : rest[i++ % rest.length]!))
})

const chartOption = computed(() => {
  const { categories, layers } = props
  return {
    // containLabel 只替軸標籤留位置，不認得圖例——bottom: 8 的時候圖例直接印在類別標籤上面。
    // 56 是照圖例在 375 寬會折成兩行抓的（1440 是一行），top: 24 則是給軸名的，8 會被切掉。
    grid: { left: 8, right: 8, top: 24, bottom: 56, containLabel: true },
    legend: { bottom: 0, textStyle: { color: chartInk.value.primary }, itemHeight: 12 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: { dataIndex?: number }[]) => {
        const index = params[0]?.dataIndex ?? 0
        const rows = layers
          .map(layer => `<div>${layer.name}　${layer.values[index] ?? 0}</div>`)
          .join('')
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${props.tooltipHeader(index)}</div>${rows}</div>`
      }
    },
    xAxis: {
      type: 'category',
      data: categories,
      // 刻意不設 interval: 0（瀑布圖那邊有設，理由不能照搬）。375 寬六個類別會擠在一起，而這裡讓
      // ECharts 自己藏掉撞到的標籤是安全的：兩個使用者的圖正上方都是同樣列數的 SSR 表格，少一個
      // 刻度標籤不會有任何數字消失。瀑布圖沒有那張表，所以它必須每根都標。
    },
    yAxis: {
      type: 'value',
      name: props.unit,
    },
    series: layers.map((layer, index) => ({
      name: layer.name,
      type: 'bar',
      stack: 'composition',
      itemStyle: { color: layerColors.value[index] },
      data: layer.values
    }))
  }
})
</script>

<template>
  <SharedChart class="stock-stacked-bar-chart" :option="chartOption" autoresize />
</template>

<style scoped>
.stock-stacked-bar-chart {
  width: 100%;
  height: v-bind('`${props.height ?? 380}px`');
}
</style>
