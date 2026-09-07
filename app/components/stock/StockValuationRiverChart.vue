<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricBasis, MetricCode, MetricHistoryEntry } from '~/composables/stock/useMetricHistory'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

// 本益比河流圖 / 本淨比河流圖, drawn the way the term conventionally means in Taiwan: the y-axis
// is 股價, each band boundary is 近四季 EPS × a PE multiple (or 每股淨值 × a PB multiple), and
// the line on top is the actual price. Because EPS/BVPS change every quarter, the bands rise and
// fall with earnings — that flowing shape IS the "river"; where the price sits inside it says
// how the current valuation compares to the stock's own history.
//
// Replaces StockMetricHistoryChart.vue's earlier attempt, which plotted the RATIO itself with a
// cumulative-percentile envelope (min/25/50/75/max of every ratio seen so far). That was
// arithmetically correct and conceptually wrong: a running min only ever goes down and a running
// max only ever goes up, so once each extreme is hit the outer edges become flat horizontal
// lines for the rest of the window ("現在紅綠色就一條橫線") — a rectangle, not a river. In
// ratio-space the bands are flat by definition; the river only exists in price-space.
//
// Multiples are NOT a fixed site-wide ladder (10/15/20/25/30): per direct choice ("依各股歷史
// 區間自動切"), the BAND_COUNT boundaries spread evenly from the lowest to the highest ratio
// seen in the displayed window — so 台積電 at 12~30倍 and a bank at 8~15倍 each get a river that
// fills their own chart instead of one pinned to the bottom band and the other bursting the top.
// The price line's position within the bands is therefore exactly the ratio's position within
// that range (price/base = ratio by construction) — nothing here is a second, independent
// estimate. Five visible bands per direct request ("河道請幫我分五條") — BAND_COUNT+1 boundary
// levels, since a band is the gap BETWEEN two levels.
//
// DERIVED PRICE — metric-history has no per-period price field (asked of analysis-ts 2026-09-07,
// pending; bff-ts can't originate it). Each river derives it from its own pair:
//   PE: price = peRatio(TTM) × eps(TTM)      PB: price = pbRatio(Q) × bvps(Q)
// matched by fiscal quarter. Exact in principle (analysis-ts computes each ratio as price ÷
// base), with one 2-decimal rounding (~±0.4元 on a 2,400元 price, invisible at chart scale).
// Deriving per-pair rather than sharing one price across both cards keeps the PB river alive
// for a company with negative TTM EPS (peRatio null there, pbRatio/bvps unaffected). Swap to
// the real field once it exists rather than living with this.
const props = defineProps<{
  symbol: string
  kind: 'pe' | 'pb'
  title: string
  infoText?: string
}>()

const KINDS = {
  pe: { ratioCode: 'peRatio', ratioBasis: 'TTM', baseCode: 'eps', baseBasis: 'TTM', ratioLabel: '本益比', baseLabel: '近四季 EPS' },
  pb: { ratioCode: 'pbRatio', ratioBasis: 'Q', baseCode: 'bvps', baseBasis: 'Q', ratioLabel: '本淨比', baseLabel: '每股淨值' }
} as const satisfies Record<'pe' | 'pb', { ratioCode: MetricCode; ratioBasis: MetricBasis; baseCode: MetricCode; baseBasis: MetricBasis; ratioLabel: string; baseLabel: string }>

const spec = computed(() => KINDS[props.kind])
const ratioLabel = computed(() => spec.value.ratioLabel)
const baseLabel = computed(() => spec.value.baseLabel)

const symbolRef = computed(() => props.symbol)

// Same 近5年/近10年 window convention as StockMetricHistoryChart.vue. No warm-up buffer here:
// the multiples come from the displayed window's own ratio range, so the first displayed
// quarter already has a full band — nothing needs to accumulate first.
const TAB_OPTIONS = ['近5年', '近10年'] as const
const activeTab = ref<(typeof TAB_OPTIONS)[number]>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))

const ratio = useMetricHistory(
  symbolRef,
  computed<MetricCode>(() => spec.value.ratioCode),
  computed<MetricBasis>(() => spec.value.ratioBasis),
  limit
)
const base = useMetricHistory(
  symbolRef,
  computed<MetricCode>(() => spec.value.baseCode),
  computed<MetricBasis>(() => spec.value.baseBasis),
  limit
)

const pending = computed(() => ratio.pending.value || base.pending.value)
const tenYearDisabled = computed(() => ratio.total.value !== null && ratio.total.value <= 20)

interface RiverPoint {
  label: string
  price: number | null
  ratio: number | null
  base: number | null
}

function quarterKey(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear}-${entry.fiscalQuarter}`
}

// One point per ratio period, with the base matched by fiscal quarter rather than by array
// index — the two fetches have covered identical quarters so far, but nothing guarantees that
// for every symbol.
const points = computed<RiverPoint[]>(() => {
  const baseByQuarter = new Map((base.data.value ?? []).map(entry => [quarterKey(entry), entry] as [string, MetricHistoryEntry]))
  return (ratio.data.value ?? []).map(entry => {
    const baseValue = baseByQuarter.get(quarterKey(entry))?.value ?? null
    const price = entry.value !== null && baseValue !== null ? entry.value * baseValue : null
    return { label: `${entry.fiscalYear} Q${entry.fiscalQuarter}`, price, ratio: entry.value, base: baseValue }
  })
})

const hasAnyData = computed(() => points.value.some(point => point.price !== null))

// 5 visible bands (per direct request "河道請幫我分五條") means 6 boundary levels — a band is
// the gap between two adjacent levels, spread evenly across the window's real ratio range (see
// top comment), or null when there's no range to spread across — fewer than two real ratios, or
// all identical.
const BAND_COUNT = 5
const levels = computed<number[] | null>(() => {
  const ratios = points.value.map(point => point.ratio).filter((value): value is number => value !== null)
  if (ratios.length < 2) return null
  const min = Math.min(...ratios)
  const max = Math.max(...ratios)
  if (max <= min) return null
  return Array.from({ length: BAND_COUNT + 1 }, (_, i) => min + ((max - min) * i) / BAND_COUNT)
})

const { resolvedMode, color: accentColor, market } = useAppTheme()
// Price line follows the user's accent color (per direct request for the old river chart's
// line — "那條顏色要跟著網站主題色變動"); bands follow their up/down market convention so the
// expensive top reads as "up" and the cheap bottom as "down", flipping with WESTERN/ACCESSIBLE
// like every other up/down color in the app.
const lineColor = computed(() => getAccentColor(resolvedMode.value, accentColor.value))
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))
const bandPalette = computed(() => riverColors(priceColors.value.up, priceColors.value.down, BAND_COUNT))

// Each boundary k is base × levels[k] per point; ECharts stacks them, so every series above the
// bottom one carries only its gap above the previous boundary. A null base at any point stays
// null in every band there (a real gap), never coerced to 0.
function bandSeries() {
  const multiples = levels.value
  if (!multiples) return []
  const boundaries = multiples.map(multiple => points.value.map(point => (point.base !== null ? point.base * multiple : null)))
  return multiples.map((_, k) => {
    const own = boundaries[k]!
    const data =
      k === 0
        ? own
        : own.map((value, i) => {
            const previous = boundaries[k - 1]![i] ?? null
            return value === null || previous === null ? null : value - previous
          })
    return {
      name: `level${k}`,
      type: 'line' as const,
      data,
      stack: 'river',
      showSymbol: false,
      silent: true,
      smooth: true,
      smoothMonotone: 'x' as const,
      lineStyle: { width: 0 },
      itemStyle: { color: bandPalette.value.lines[k] },
      ...(k > 0 ? { areaStyle: { color: bandPalette.value.fills[k - 1], opacity: 0.45 } } : {}),
      z: 1
    }
  })
}

function formatMultiple(value: number): string {
  return `${value.toFixed(1)}倍`
}

// Which band the point's own ratio sits in, as "a～b 倍" — for the tooltip only.
function bandRangeFor(value: number): string | null {
  const multiples = levels.value
  if (!multiples) return null
  for (let k = 0; k < multiples.length - 1; k++) {
    const low = multiples[k]!
    const high = multiples[k + 1]!
    if (value >= low && (value <= high || k === multiples.length - 2)) return `${formatMultiple(low)}～${formatMultiple(high)}`
  }
  return null
}

interface AxisTooltipParam {
  dataIndex?: number
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 16, top: 16, bottom: 28, containLabel: true },
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
      const point = points.value[dataIndex]
      if (!point) return ''
      const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
      const row = (label: string, value: string, muted = false) =>
        `<div style="${rowStyle}${muted ? `color:${CHART_INK.secondary};` : ''}"><span>${label}</span><strong>${value}</strong></div>`
      const band = point.ratio !== null ? bandRangeFor(point.ratio) : null
      return `<div style="font-size:12px;min-width:170px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${point.price !== null ? row('股價', `${point.price.toFixed(1)} 元`) : row('股價', '資料不足', true)}
        ${point.ratio !== null ? row(ratioLabel.value, formatMultiple(point.ratio)) : row(ratioLabel.value, '資料不足', true)}
        ${point.base !== null ? row(baseLabel.value, `${point.base.toFixed(2)} 元`) : ''}
        ${band ? row('所在河道', band, true) : ''}
      </div>`
    }
  },
  xAxis: {
    type: 'category',
    data: points.value.map(point => point.label),
    axisLine: { lineStyle: { color: CHART_INK.baseline } },
    axisTick: { show: false },
    axisLabel: { color: CHART_INK.muted, fontSize: 11 }
  },
  yAxis: {
    type: 'value',
    name: '元',
    nameTextStyle: { color: CHART_INK.muted, fontSize: 11 },
    scale: true,
    splitLine: { lineStyle: { color: CHART_INK.gridline, type: 'solid' } },
    axisLabel: { color: CHART_INK.muted, fontSize: 11 }
  },
  series: [
    ...bandSeries(),
    {
      name: '股價',
      type: 'line',
      showSymbol: false,
      smooth: true,
      smoothMonotone: 'x',
      lineStyle: { width: 2.5, color: lineColor.value },
      itemStyle: { color: lineColor.value },
      data: points.value.map(point => point.price),
      z: 10
    }
  ]
}))
</script>

<template>
  <el-card class="valuation-river" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="valuation-river__header">
        <span class="valuation-river__title">
          {{ title }}
          <el-tooltip v-if="infoText" :content="infoText" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="valuation-river__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <div class="valuation-river__tabs">
          <button
            v-for="tab in TAB_OPTIONS"
            :key="tab"
            type="button"
            class="valuation-river__tab"
            :class="{ 'is-active': tab === activeTab }"
            :disabled="tab === '近10年' && tenYearDisabled"
            :title="tab === '近10年' && tenYearDisabled ? '這檔股票的歷史資料不足10年，目前顯示的已是完整範圍' : undefined"
            @click="activeTab = tab"
          >{{ tab }}</button>
        </div>
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <VChart v-else v-loading="pending" class="valuation-river__chart" :option="option" autoresize />

    <p v-if="levels" class="valuation-river__note">
      色帶 = {{ baseLabel }} × {{ ratioLabel }}倍數，依{{ activeTab }}歷史區間 {{ formatMultiple(levels[0]!) }}～{{ formatMultiple(levels[levels.length - 1]!) }} 均分五條河道；股價愈靠近下方色帶，代表相對自身歷史的估值愈低。
    </p>
    <p v-else-if="hasAnyData" class="valuation-river__note">
      資料點不足，無法計算歷史區間
    </p>
  </el-card>
</template>

<style scoped>
.valuation-river {
  border-radius: 12px;
}

.valuation-river__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.valuation-river__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.valuation-river__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.valuation-river__tabs {
  display: flex;
  gap: 4px;
}

.valuation-river__tab {
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color-lighter);
  background: transparent;
  cursor: pointer;
}

.valuation-river__tab.is-active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.valuation-river__tab:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.valuation-river__chart {
  height: 240px;
  width: 100%;
}

.valuation-river__note {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
