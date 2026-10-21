<script setup lang="ts">
import { use } from 'echarts/core'
import { BoxplotChart, ScatterChart } from 'echarts/charts'
import type { IndustryPageData } from '#shared/types/hub'
import type { IndustryFacetKey } from '#shared/utils/hub-slugs'
import type { LineChartEntry, LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
// 類股每個面向的那一張圖（2026-10-21，同 EtfFacetChart）：面向頁與速覽首頁畫的是同一張。外殼是 SharedChartCard，有時間軸的（月營收、
// 獲利能力）接 useChartPeriod；速覽把標題傳進 #header。公司名單沒有圖。散佈圖與箱型圖只有這裡用，自己註冊（SharedChart 只註冊共用的零件）
use([ScatterChart, BoxplotChart])

const props = defineProps<{
  data: IndustryPageData
  sectorName: string
  facet: Exclude<IndustryFacetKey, 'overview' | 'companies'>
}>()

const { resolvedMode, color: accentColorName } = useAppTheme()
const isDesktop = useIsDesktop()
const accent = computed(() => getAccentColor(resolvedMode.value, accentColorName.value))

// ---- 月營收：合計營收年增率（上游用「當月與去年同月都有營收」的同一批公司相加後算）＋景氣同時指標（右軸）＋景氣收縮期的虛線框 ----
// （景氣線 2026-10-21，使用者在 /industries/cycle 選「B＋類股頁加景氣線」：單一類股跟景氣的對照放在這裡）
const coincidentByMonth = computed(() => props.data.businessCycle?.coincident ?? {})
const hasCycle = computed(() => Object.keys(coincidentByMonth.value).length > 0)
const revenueEntries = computed<LineChartEntry[]>(() => (props.data.revenueTrend?.entries ?? []).map(entry => ({
  label: entry.yearMonth,
  values: { yoy: { value: entry.yoyChangePct }, coincident: { value: coincidentByMonth.value[entry.yearMonth] ?? null } }
})))
const revenueSeries = computed<LineSeriesSpec[]>(() => [
  { code: 'yoy', name: '營收年增率', lineType: 'solid', symbol: 'circle', negativeBand: true },
  ...(hasCycle.value
    ? [{ code: 'coincident', name: '景氣同時指標', lineType: 'dashed', symbol: 'diamond', axis: 'right', format: (value: number | null) => (value === null ? '－' : `${value.toFixed(1)}（100＝長期趨勢）`) } as const]
    : [])
])
const { period: revenuePeriod, shown: revenueShown } = useChartPeriod({ all: revenueEntries, keyOf: entry => entry.label ?? '', perYear: 12 })
// 收縮期夾在畫出來的月份裡（框的兩端要是 x 軸上的月份）
const revenuePeriods = computed(() => {
  const first = revenueShown.value[0]?.label
  const last = revenueShown.value.at(-1)?.label
  if (!first || !last) return []
  return (props.data.businessCycle?.contractions ?? [])
    .filter(period => period.from <= last && (period.to ?? last) >= first)
    .map(period => ({ from: period.from < first ? first : period.from, to: period.to === null || period.to > last ? last : period.to, label: '景氣收縮期' }))
})

// ---- 獲利能力：三率中位數（近四季）----
const marginRows = computed(() => industryMarginRows(props.data))
const { period: marginPeriod, shown: marginShown } = useChartPeriod({ all: marginRows, keyOf: row => `${row.fiscalYear} Q${row.fiscalQuarter}`, perYear: 4 })

// ---- 指標分布：箱型圖（2026-10-09 產業分析設計）----
// 四列單位不同（倍、%），所以各自一個座標，不共軸；鬚取 10／90 百分位（一家 900 倍本益比會把最小最大的軸壓扁）。
// 只畫分布，不標公司名——合規上這一段講的是類股，不是成員之間比高下
const distribution = computed(() => industryDistribution(props.data))
const distributionOption = computed(() => {
  const items = distribution.value
  const ink = getChartInk(resolvedMode.value)
  const band = 100 / items.length
  return {
    tooltip: {
      trigger: 'item',
      formatter: (param: { seriesIndex: number }) => {
        const item = items[param.seriesIndex]
        if (!item) return ''
        const s = item.stat
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${props.sectorName}的${item.label}（${s.count} 家）</div>`
          + `<div>10%：${industryStat(s.p10, item.unit)}</div><div>25%：${industryStat(s.q1, item.unit)}</div><div>中位數：${industryStat(s.median, item.unit)}</div>`
          + `<div>75%：${industryStat(s.q3, item.unit)}</div><div>90%：${industryStat(s.p90, item.unit)}</div></div>`
      }
    },
    grid: items.map((_, i) => ({ left: 8, right: 24, top: `${i * band + 4}%`, height: `${band - 12}%`, containLabel: true })),
    // 手機寬度刻度只留 3 個，不然「0%10%20%30%」會黏成一串
    xAxis: items.map((item, i) => ({ type: 'value', gridIndex: i, scale: true, splitNumber: isDesktop.value ? 5 : 3, axisLabel: { hideOverlap: true, formatter: (value: number) => `${value}${item.unit === '倍' ? '' : '%'}` } })),
    yAxis: items.map((item, i) => ({ type: 'category', gridIndex: i, data: [item.label], axisTick: { show: false }, axisLabel: { color: ink.primary } })),
    series: items.map((item, i) => ({
      type: 'boxplot',
      xAxisIndex: i,
      yAxisIndex: i,
      boxWidth: [16, 28],
      itemStyle: { color: 'transparent', borderColor: accent.value, borderWidth: 2 },
      data: [[item.stat.p10, item.stat.q1, item.stat.median, item.stat.q3, item.stat.p90]]
    }))
  }
})

// ---- 殖利率與股利成長：公司散佈圖（2026-10-01）----
// 軸跟 /industries/dividend 的類股版一樣（X 股利 3 年成長率、Y 殖利率），從總覽點進來看到的是同一張圖換一個層級。兩軸都有值才畫。
// 不標公司名：一個類股最多 200 多個點，標籤沒有任何排法不會糊掉；名字在提示框與公司名單裡
const scatterRows = computed(() => industryScatterRows(props.data))
type ScatterRow = (typeof scatterRows)['value'][number]
interface ScatterParam { data?: { row: ScatterRow } }
const scatterOption = computed(() => ({
  grid: { left: 8, right: 16, top: 24, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'item',
    formatter: (param: ScatterParam) => {
      const row = param.data?.row
      if (!row) return ''
      return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${row.symbol} ${row.name}</div>`
        + `<div>${row.dividendYield === 0 ? NO_DIVIDEND_TEXT : `殖利率 ${row.dividendYield?.toFixed(2)}%`}</div>`
        + `<div>股利 3 年成長率 ${row.dividendGrowthRate3y?.toFixed(1)}%</div></div>`
    }
  },
  xAxis: { type: 'value', name: '股利 3 年成長率 %', nameLocation: 'middle', nameGap: 28, axisLabel: { formatter: (value: number) => `${value}%` } },
  yAxis: { type: 'value', name: '殖利率 %', nameTextStyle: { align: 'left' }, axisLabel: { formatter: (value: number) => `${value}%` } },
  series: [
    {
      type: 'scatter',
      // 10px：高齡友善規格對標記的下限是 8px，這裡取 10 讓密集區仍然點得到
      symbolSize: 10,
      itemStyle: { color: accent.value, opacity: 0.7 },
      data: scatterRows.value.map(row => ({ value: [row.dividendGrowthRate3y as number, row.dividendYield as number], row }))
    }
  ]
}))
</script>

<template>
  <SharedChartCard v-if="facet === 'revenue' && revenueEntries.length > 1" :period="revenuePeriod">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <StockMultiSeriesLineChart
      :entries="revenueShown"
      :series="revenueSeries"
      palette="accent"
      unit="%"
      :unit-right="hasCycle ? '指數' : undefined"
      scale-right
      :periods="revenuePeriods"
      :format="industrySignedPct"
    />
  </SharedChartCard>
  <SharedChartCard v-else-if="facet === 'margins' && marginRows.length > 1" :period="marginPeriod">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <StockMultiSeriesLineChart :entries="marginShown" :series="INDUSTRY_MARGIN_SERIES" unit="%" :format="industryPct" />
  </SharedChartCard>
  <SharedChartCard v-else-if="facet === 'distribution' && distribution.length">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <SharedChart class="industry-facet-chart__distribution" :option="distributionOption" autoresize :aria-label="`${sectorName}本益比、股價淨值比、殖利率與 ROE 的分布箱型圖`" />
  </SharedChartCard>
  <SharedChartCard v-else-if="facet === 'dividend' && scatterRows.length > 1">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <SharedChart class="app-chart" :option="scatterOption" autoresize :aria-label="`${sectorName}各公司殖利率與股利 3 年成長率的散佈圖`" />
  </SharedChartCard>
</template>

<style scoped>
/* 四列各自一個座標，用 .app-chart 的 70vw 高度在手機上每列不到 40px、箱子畫不出來；固定高度讓每列約 80px */
.industry-facet-chart__distribution {
  width: 100%;
  height: 22rem;
}
</style>
