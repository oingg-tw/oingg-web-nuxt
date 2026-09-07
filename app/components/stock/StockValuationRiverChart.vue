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
// Five visible bands per direct request ("河道請幫我分五條") — BAND_COUNT+1 boundary levels,
// since a band is the gap BETWEEN two levels.
//
// PRICE comes from analysis-ts's own `stockPrice` metricCode (basis=Q, added 2026-09-07 at our
// request) — the close at each period's knowledgeDate. Its knowledgeDate resolves off the
// balance sheet, so it's guaranteed identical to pbRatio's and only practically identical to
// peRatio's (income-statement resolved; every case checked so far matches, no proof it always
// will). Falls back to ratio × base for any period stockPrice is null — exact in principle
// (analysis-ts computes each ratio as price ÷ base), one 2-decimal rounding — so a symbol
// whose stockPrice isn't backfilled yet still gets a line rather than a blank card.
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
const activeTab = ref<'近5年' | '近10年'>('近5年')
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
// Shared by both river cards via useMetricHistory's cross-instance dedupe — one request, not two.
const stockPrice = useMetricHistory(symbolRef, ref<MetricCode>('stockPrice'), ref<MetricBasis>('Q'), limit)

const pending = computed(() => ratio.pending.value || base.pending.value || stockPrice.pending.value)
// Disabled unless ratio.total actually reaches 40 (a genuine 10 years) — per direct correction
// ("不滿十年不給看"), not just "more than the 20 periods 近5年 already shows". base/stockPrice
// share the exact same depth as ratio (both resolve off the same underlying statement —
// income for PE, balance sheet for PB, per analysis-ts's own confirmation), so ratio.total
// alone is a reliable proxy for all three.
const tenYearDisabled = computed(() => ratio.total.value !== null && ratio.total.value < 40)

interface RiverPoint {
  label: string
  price: number | null
  ratio: number | null
  base: number | null
}

function quarterKey(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear}-${entry.fiscalQuarter}`
}

function byQuarter(entries: MetricHistoryEntry[] | null): Map<string, MetricHistoryEntry> {
  return new Map((entries ?? []).map(entry => [quarterKey(entry), entry]))
}

// One point per ratio period, with base/price matched by fiscal quarter rather than by array
// index — the fetches have covered identical quarters so far, but nothing guarantees that for
// every symbol.
const points = computed<RiverPoint[]>(() => {
  const baseByQuarter = byQuarter(base.data.value)
  const priceByQuarter = byQuarter(stockPrice.data.value)
  return (ratio.data.value ?? []).map(entry => {
    const key = quarterKey(entry)
    const baseValue = baseByQuarter.get(key)?.value ?? null
    const realPrice = priceByQuarter.get(key)?.value ?? null
    const derivedPrice = entry.value !== null && baseValue !== null ? entry.value * baseValue : null
    return { label: `${entry.fiscalYear} Q${entry.fiscalQuarter}`, price: realPrice ?? derivedPrice, ratio: entry.value, base: baseValue }
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

// Band boundaries per level per point. A non-positive base (a loss-making quarter's EPS) is
// treated as null rather than plotted: a negative boundary is meaningless for a valuation band
// and can't sit on the log axis below anyway.
const boundaries = computed<(number | null)[][]>(() => {
  const multiples = levels.value
  if (!multiples) return []
  return multiples.map(multiple => points.value.map(point => (point.base !== null && point.base > 0 ? point.base * multiple : null)))
})

// Y-axis extent — top/bottom edges pinned to the highest/lowest value actually PLOTTED
// (price line or any band boundary — per direct follow-up "上緣改為最高繪製", superseding an
// earlier "上緣用股價最高點" that pinned the top to price alone and let a band above the
// highest price run off-card), not wherever ECharts' own log-tick rounding would land; left
// unpinned, a log axis rounds out to the next power of ten and leaves most of the card empty.
const axisExtent = computed<{ min: number; max: number } | null>(() => {
  const prices = points.value.map(point => point.price).filter((value): value is number => value !== null && value > 0)
  const bandValues = boundaries.value.flat().filter((value): value is number => value !== null && value > 0)
  const all = [...prices, ...bandValues]
  if (!all.length) return null
  return { min: Math.min(...all), max: Math.max(...all) }
})

const { resolvedMode, color: accentColor, market } = useAppTheme()
// Price line follows the user's accent color (per direct request for the old river chart's
// line — "那條顏色要跟著網站主題色變動"); bands follow their up/down market convention so the
// expensive top reads as "up" and the cheap bottom as "down", flipping with WESTERN/ACCESSIBLE
// like every other up/down color in the app.
const lineColor = computed(() => getAccentColor(resolvedMode.value, accentColor.value))
// Axis labels/lines/gridlines render on the card's own surface, which changes with the site
// theme — unlike tooltip text (CHART_TOOLTIP_INK, fixed, since the tooltip's own dark surface
// never changes). See getChartInk()'s own comment in chart-palette.ts.
const chartInk = computed(() => getChartInk(resolvedMode.value))
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))
const bandPalette = computed(() => riverColors(priceColors.value.up, priceColors.value.down, BAND_COUNT))

// ECharts stacks the band series, so every series above the bottom one carries only its gap
// above the previous boundary. A null boundary at any point stays null in every band there (a
// real gap), never coerced to 0.
function bandSeries() {
  const rows = boundaries.value
  if (!rows.length) return []
  return rows.map((own, k) => {
    const data =
      k === 0
        ? own
        : own.map((value, i) => {
            const previous = rows[k - 1]![i] ?? null
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
      // opacity lowered from 0.45 per direct feedback ("河流圖顏色太深了 要淺一點").
      ...(k > 0 ? { areaStyle: { color: bandPalette.value.fills[k - 1], opacity: 0.28 } } : {}),
      z: 1
    }
  })
}

function formatMultiple(value: number): string {
  return `${value.toFixed(1)}倍`
}

// Log-axis tick values land on even steps in log space (10^2.6 = 398.1…), which read as noise
// as labels; rounding to two significant figures ("400") moves the LABEL by well under 1% of
// the tick's real position — invisible at chart scale, far more legible.
function formatAxisPrice(value: number): string {
  if (value <= 0) return ''
  const unit = Math.pow(10, Math.floor(Math.log10(value)) - 1)
  return `${Math.round(value / unit) * unit}`
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
      const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
      const row = (label: string, value: string, muted = false) =>
        `<div style="${rowStyle}${muted ? `color:${CHART_TOOLTIP_INK.secondary};` : ''}"><span>${label}</span><strong>${value}</strong></div>`
      const band = point.ratio !== null ? bandRangeFor(point.ratio) : null
      return `<div style="font-size:16px;min-width:170px;">
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
    axisLine: { lineStyle: { color: chartInk.value.baseline } },
    axisTick: { show: false },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  // Log scale per direct request ("per pbr 縱軸請幫我用log") — price here can span a wide
  // multiple (2330's own 近5年 window runs ~500元 to ~2,400元), where a linear axis compresses
  // the early, cheaper years into a flat-looking sliver at the bottom. Log makes equal
  // PERCENTAGE moves equal visual distance regardless of price level, which is also the more
  // honest read for a valuation chart — a 10% move means the same thing at 500元 or 2,000元.
  yAxis: {
    type: 'log',
    name: '元',
    nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
    logBase: 10,
    ...(axisExtent.value ? { min: axisExtent.value.min, max: axisExtent.value.max } : {}),
    splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
    axisLabel: { color: chartInk.value.muted, fontSize: 16, formatter: formatAxisPrice }
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
        <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <VChart v-else v-loading="pending" class="valuation-river__chart" :option="option" autoresize />
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

.valuation-river__chart {
  height: 240px;
  width: 100%;
}
</style>
