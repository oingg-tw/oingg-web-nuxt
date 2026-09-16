<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([SVGRenderer, BarChart, GridComponent, TooltipComponent])

// 直向懸浮瀑布圖 — 抽成元件 2026-09-15 per直接要求（"我希望卡片的呈現方式可以收斂。避免每個卡片
// 都長出自己的樣子。"）：這個視覺模式（上到下排列的「階段」小計，中間懸浮插入「落差」列，讓
// 「上一階段 − 落差 = 本階段」視覺上直接對齊）第一次是在 StockRevenueToDividendBridge.vue
// 為了呈現「營收怎麼一步步變成股利」做出來的，過程中經過好幾輪直接要求才定案（上到下呈現、
// 加上落差項目、懸浮對齊、最後一階段換色標出「到這裡才是真的到口袋的錢」）——第二張卡片
// （法定可供分配盈餘 vs 實際發放）要用同一種語言呈現時，不該重新長一次，所以抽出來。
//
// 跟 SharedPercentileGaugeExpand.vue 同樣的抽象原則：這個元件只負責「怎麼畫」（懸浮長條的堆疊
// 數學、上到下排列、tooltip 格式），不負責「畫什麼」（呼叫哪些 metricCode、怎麼組出每個階段的
// 金額）——那些是各卡片自己的領域邏輯，留在呼叫端；卡片外殼（el-card/header/info tooltip/
// freshness note）也留在呼叫端，因為每張卡片的標題、說明文字、資料來源都不一樣。
//
// 懸浮長條技法：每個 gap 列用兩段堆疊長條畫成——一段透明的 placeholder（把長條「墊高」到該從
// 哪裡開始畫）+ 一段實色的 value（實際長度）。stage 列的 placeholder 固定是 0（從最左邊畫起），
// gap 列的 placeholder 是兩個相鄰階段裡較小的那個值，讓 gap 長條懸浮對齊在兩個階段值之間。
export interface BridgeStage {
  label: string
  value: number | null
}

const props = withDefaults(
  defineProps<{
    // 呼叫端已經算好的「階段」小計，由上到下的順序 — 這個元件不算任何領域數字，只負責排版。
    stages: BridgeStage[]
    // 相鄰兩個 stages 之間「扣了什麼/加了什麼」的標籤，長度必須是 stages.length − 1。
    gapLabels: string[]
    formatValue: (value: number) => string
    unitLabel?: string
    loading?: boolean
    // 最後一個 stage 換一個獨立顏色標出來（例如「股利」代表錢真的離開公司）— 不提供則全部
    // stage 用同一個主題色，沒有特別標出的終點。
    highlightLastStage?: boolean
    // 同上，但標第一個 stage——2026-09-15 加，供 StockRevenueToDividendBridge.vue「股利怎麼來」
    // 反向瀑布圖使用（股利改放在陣列最前面，仍然要標出來）。跟 highlightLastStage 可以同時給
    // true（例如頭尾都想標），彼此獨立判斷，不互斥。
    highlightFirstStage?: boolean
    highlightColor?: string
  }>(),
  {
    unitLabel: '元',
    loading: false,
    highlightLastStage: false,
    highlightFirstStage: false,
    highlightColor: undefined
  }
)

type RowKind = 'stage' | 'gap' | 'highlight'

interface Row {
  label: string
  kind: RowKind
  // displayValue：stage/highlight 就是該階段金額；gap 是「前一階段 − 本階段」，正值=真的被
  // 扣掉，負值=這一步反而比前一階段多，正負號保留給 tooltip/標籤直接顯示，不做美化。
  displayValue: number | null
  // placeholder/barValue 是畫圖用的堆疊底座與長度，見本檔開頭「懸浮長條技法」說明。
  placeholder: number
  barValue: number
}

function stageRow(label: string, value: number | null, kind: RowKind): Row {
  return { label, kind, displayValue: value, placeholder: 0, barValue: value ?? 0 }
}

function gapRow(label: string, current: number | null, next: number | null): Row {
  if (current === null || next === null) return { label, kind: 'gap', displayValue: null, placeholder: 0, barValue: 0 }
  return {
    label,
    kind: 'gap',
    displayValue: current - next,
    placeholder: Math.min(current, next),
    barValue: Math.abs(current - next)
  }
}

const rows = computed<Row[]>(() => {
  const list = props.stages
  const result: Row[] = []
  list.forEach((stage, index) => {
    const isLast = index === list.length - 1
    const isFirst = index === 0
    const isHighlighted = (isLast && props.highlightLastStage) || (isFirst && props.highlightFirstStage)
    result.push(stageRow(stage.label, stage.value, isHighlighted ? 'highlight' : 'stage'))
    if (!isLast) result.push(gapRow(props.gapLabels[index] ?? '', stage.value, list[index + 1]!.value))
  })
  return result
})

const hasAnyData = computed(() => rows.value.some(row => row.kind !== 'gap' && row.displayValue !== null))

const { resolvedMode, color: accentColor } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const barColor = computed(() => getAccentColor(resolvedMode.value, accentColor.value))
const barColorMuted = computed(() => `${barColor.value}59`)
const resolvedHighlightColor = computed(() => props.highlightColor ?? (resolvedMode.value === 'DARK' ? '#4caf7d' : '#2f9e58'))

interface AxisTooltipParam {
  dataIndex?: number
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 56, top: 8, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    appendTo: 'body',
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
    textStyle: { color: CHART_TOOLTIP_INK.primary },
    formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
      const list = Array.isArray(params) ? params : [params]
      const dataIndex = list[0]?.dataIndex ?? 0
      const row = rows.value[dataIndex]
      if (!row) return ''
      const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
      const amountLabel = row.kind === 'gap' ? '與上一階段的差額' : '金額'
      const amountText =
        row.displayValue === null
          ? '資料不足'
          : row.kind !== 'gap'
            ? props.formatValue(row.displayValue)
            : `${row.displayValue >= 0 ? '−' : '+'}${props.formatValue(Math.abs(row.displayValue))}${row.displayValue < 0 ? '（此階段較上一階段增加）' : ''}`
      return `<div style="font-size: 1rem;min-width:190px;">
        <div style="font-weight:600;margin-bottom:4px;">${row.label}</div>
        <div style="${rowStyle}"><span>${amountLabel}</span><strong>${amountText}</strong></div>
      </div>`
    }
  },
  xAxis: {
    type: 'value',
    name: props.unitLabel,
    nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
    splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  // 上到下呈現 — per直接要求（"我希望圖表是從上到下呈現 讓用戶看的出來遞減 不是從左到右"）：
  // 類別軸換成 yAxis，inverse:true 讓陣列第一項畫在最上面 — ECharts 的 category yAxis 預設由
  // 下往上排列陣列順序，不翻轉的話第一項會畫在最底部，剛好上下顛倒。
  yAxis: {
    type: 'category',
    inverse: true,
    data: rows.value.map(row => row.label),
    axisLine: { lineStyle: { color: chartInk.value.baseline } },
    axisTick: { show: false },
    axisLabel: { color: chartInk.value.muted, fontSize: 14 }
  },
  series: [
    {
      name: 'placeholder',
      type: 'bar',
      stack: 'bridge',
      silent: true,
      itemStyle: { color: 'transparent' },
      data: rows.value.map(row => row.placeholder)
    },
    {
      name: 'value',
      type: 'bar',
      stack: 'bridge',
      barMaxWidth: 28,
      itemStyle: {
        color: (p: { dataIndex: number }) => {
          const kind = rows.value[p.dataIndex]?.kind
          if (kind === 'highlight') return resolvedHighlightColor.value
          if (kind === 'stage') return barColor.value
          return barColorMuted.value
        },
        borderRadius: [0, 4, 4, 0]
      },
      label: {
        show: true,
        position: 'right',
        color: chartInk.value.secondary,
        fontSize: 13,
        formatter: (p: { dataIndex: number }) => {
          const row = rows.value[p.dataIndex]
          if (!row || row.displayValue === null) return '—'
          if (row.kind !== 'gap') return props.formatValue(row.displayValue)
          return `${row.displayValue >= 0 ? '−' : '+'}${props.formatValue(Math.abs(row.displayValue))}`
        }
      },
      data: rows.value.map(row => row.barValue)
    }
  ]
}))
</script>

<template>
  <el-empty v-if="!loading && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
  <VChart
    v-else
    v-loading="loading"
    class="bridge-chart"
    :style="{ height: `${rows.length * 40 + 40}px` }"
    :option="option"
    :init-options="{ renderer: 'svg' }"
    autoresize
  />
</template>

<style scoped>
.bridge-chart {
  width: 100%;
}
</style>
