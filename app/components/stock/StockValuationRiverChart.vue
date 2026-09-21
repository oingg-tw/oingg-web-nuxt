<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import type { LookbackWindow } from '~/utils/lookback-window'
import { getAccentColor, getChartInk, getPriceColors, riverColors, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'

use([SVGRenderer, LineChart, GridComponent, TooltipComponent])

// 本益比河流圖 / 淨值比河流圖, drawn the way the term conventionally means in Taiwan: the y-axis is
// 股價, each band boundary is 近四季 EPS × a PE multiple (or 每股淨值 × a PB multiple), and the line
// on top is the actual price. Because EPS/BVPS change every quarter the bands rise and fall with
// earnings — that flowing shape IS the "river"; where the price sits inside it says how the
// current valuation compares with this stock's own history.
//
// RESTORED 2026-09-21（「我希望 PER PBR 都改用河流圖 而非長條圖」, then「以前做好的卡片 裡面河流圖
// 怎麼畫的就可以拿出來用」）from the version deleted on 2026-09-20 in the 公司健檢 orphan sweep
// (commit 0067c2d). Every piece of CHART logic below — the per-symbol multiples, the stacked band
// series, the log axis, the tooltip — is that file's, unchanged, because it was already tuned
// through several rounds of live feedback（河道請幫我分五條／依各股歷史區間自動切／河流圖顏色太深
// 了／per pbr 縱軸請幫我用log）and re-deriving any of it would have quietly lost those decisions.
//
// It carries the record of the one wrong turn, too: this REPLACED an earlier attempt that plotted
// the RATIO itself inside a cumulative-percentile envelope. That was arithmetically correct and
// conceptually wrong — a running min only goes down and a running max only goes up, so both outer
// edges flatten into horizontal lines（「現在紅綠色就一條橫線」）. In ratio-space the bands are flat
// by definition; the river only exists in price-space. Do not go back.
//
// TWO things the original had are deliberately NOT restored:
//   * Its own <el-card>/StockCardTitle/expand-toggle chrome and its summary-layer percentile
//     gauge. Those belonged to 公司健檢's card-track spec; a metric page is a document（question →
//     answer → one chart）, so this is just the chart and the page owns the card around it.
//   * useMetricHistory (singular), the one-code-per-request composable it fetched through, which
//     was deleted in the same sweep. This uses useMetricsHistory (plural) instead — still alive,
//     used by every other chart here, and it takes all three codes in ONE request rather than
//     three. Restoring a parallel data path just to avoid rewriting the fetch would have been the
//     more expensive choice.
const props = defineProps<{
  symbol: string
  kind: 'pe' | 'pb' | 'ps'
}>()

const KINDS = {
  pe: { ratioCode: 'peRatio', ratioBasis: 'TTM', baseCode: 'eps', ratioLabel: '本益比', baseLabel: '近四季 EPS' },
  // ratioLabel 本淨比→淨值比 2026-09-16（「全站 本淨比 改為淨值比」）.
  pb: { ratioCode: 'pbRatio', ratioBasis: 'Q', baseCode: 'bvps', ratioLabel: '淨值比', baseLabel: '每股淨值' },
  // 股價營收比河流圖 2026-09-21（「PSR 是不是也用河流圖比較適合?」）. The same shape as the other two
  // once the identity is checked rather than assumed: psr's own formula is 市值 ÷ 營收, which is
  // 股價 ÷ 每股營收, so 每股營收（revenuePerShare, Q+TTM in the catalog）is a real per-share base to
  // multiply the bands from. Verified numerically before wiring — 2330 2026Q2: psr 13.99 ×
  // 每股營收 171.23 = 2395.5 against a filed 股價 of 2395, and the same within rounding on 1101
  // and 2454. Without a per-share base there is no river to draw, which is why this component
  // takes a `kind` rather than any old metricCode.
  ps: { ratioCode: 'psr', ratioBasis: 'TTM', baseCode: 'revenuePerShare', ratioLabel: '股價營收比', baseLabel: '每股營收' }
} as const

const spec = computed(() => KINDS[props.kind])

// Shared with the metric pages' own bar chart so switching pages keeps the reader's window choice
// (useMetricHistoryChartWindow's useState key).
const activeWindow = useMetricHistoryChartWindow()
const limit = computed(() => LOOKBACK_WINDOW_YEARS[activeWindow.value] * 4)

// TWO requests, not three（the original made one per code）: the ratio and its base share a basis
// so they ride together, and the price is a separate call only because it exists at Q while PE's
// ratio/base are TTM. For 'pb' everything is Q anyway and useMetricsHistory's own superset cache
// makes the second call free.
//
// `stockPrice` is analysis-ts's own metricCode (Q basis, added 2026-09-07 at this app's request) —
// the close at each period's knowledgeDate. Its knowledgeDate resolves off the balance sheet, so it
// is guaranteed identical to pbRatio's and only practically identical to peRatio's (income-statement
// resolved; every case checked matches, no proof it always will).
const symbolRef = computed(() => props.symbol)
const ratioBasis = computed<MetricsHistoryTimeframe>(() => spec.value.ratioBasis)
const mainCodes = computed<string[]>(() => [spec.value.ratioCode, spec.value.baseCode])
const priceCodes = ref<string[]>(['stockPrice'])
const priceBasis = ref<MetricsHistoryTimeframe>('Q')
const { data: mainEntries, total: mainTotal } = useMetricsHistory(symbolRef, mainCodes, ratioBasis, limit)
const { data: priceEntries } = useMetricsHistory(symbolRef, priceCodes, priceBasis, limit)

interface RiverPoint {
  label: string
  price: number | null
  ratio: number | null
  base: number | null
}

const quarterKey = (entry: { fiscalYear: number; fiscalQuarter: number }): string => `${entry.fiscalYear}-${entry.fiscalQuarter}`

// One point per ratio period, with the price matched by FISCAL QUARTER rather than array index —
// the two fetches have covered identical quarters so far, but nothing guarantees it per symbol.
// `derivedPrice` (ratio × base) is the fallback wherever stockPrice is null: exact in principle,
// since analysis-ts computes each ratio as price ÷ base, off by one 2-decimal rounding — so a
// symbol whose stockPrice isn't backfilled still gets a line instead of a blank chart.
const points = computed<RiverPoint[]>(() => {
  const priceByQuarter = new Map((priceEntries.value ?? []).map(entry => [quarterKey(entry), entry.values.stockPrice?.value ?? null]))
  return (mainEntries.value ?? []).map(entry => {
    const ratio = entry.values[spec.value.ratioCode]?.value ?? null
    const base = entry.values[spec.value.baseCode]?.value ?? null
    const realPrice = priceByQuarter.get(quarterKey(entry)) ?? null
    const derivedPrice = ratio !== null && base !== null ? ratio * base : null
    return { label: `${entry.fiscalYear} Q${entry.fiscalQuarter}`, price: realPrice ?? derivedPrice, ratio, base }
  })
})

const hasAnyData = computed(() => points.value.some(point => point.price !== null))

// 近10年 stays disabled unless the series genuinely reaches 40 periods — the standing rule for
// every lookback selector in this app（「不滿十年不給看」）, checked on the real `total` rather than
// on how many rows happened to come back.
const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => mainTotal.value !== null && mainTotal.value! < years * 4)
)

// 5 visible bands（「河道請幫我分五條」）means 6 boundary levels — a band is the gap between two
// adjacent ones. The multiples are NOT a fixed site-wide ladder（「依各股歷史區間自動切」）: they
// spread evenly from the lowest to the highest ratio in the displayed window, so 台積電 at 12~30倍
// and a bank at 8~15倍 each get a river filling its own chart instead of one pinned to the bottom
// band and the other bursting the top.
const BAND_COUNT = 5
const levels = computed<number[] | null>(() => {
  const ratios = points.value.map(point => point.ratio).filter((value): value is number => value !== null)
  if (ratios.length < 2) return null
  const min = Math.min(...ratios)
  const max = Math.max(...ratios)
  if (max <= min) return null
  return Array.from({ length: BAND_COUNT + 1 }, (_, i) => min + ((max - min) * i) / BAND_COUNT)
})

// A non-positive base (a loss-making quarter's EPS) becomes null rather than a plotted point: a
// negative band boundary is meaningless for a valuation band and can't sit on a log axis anyway.
const boundaries = computed<(number | null)[][]>(() => {
  const multiples = levels.value
  if (!multiples) return []
  return multiples.map(multiple => points.value.map(point => (point.base !== null && point.base > 0 ? point.base * multiple : null)))
})

// Y extent pinned to the highest/lowest value actually PLOTTED（「上緣改為最高繪製」）— price line
// or any band boundary. Left unpinned, a log axis rounds out to the next power of ten and leaves
// most of the chart empty.
const axisExtent = computed<{ min: number; max: number } | null>(() => {
  const prices = points.value.map(point => point.price).filter((value): value is number => value !== null && value > 0)
  const bandValues = boundaries.value.flat().filter((value): value is number => value !== null && value > 0)
  const all = [...prices, ...bandValues]
  if (!all.length) return null
  return { min: Math.min(...all), max: Math.max(...all) }
})

const { resolvedMode, color: accentColorName, market } = useAppTheme()
// Price line follows the user's own accent colour（「那條顏色要跟著網站主題色變動」）.
const lineColor = computed(() => getAccentColor(resolvedMode.value, accentColorName.value))
const chartInk = computed(() => getChartInk(resolvedMode.value))
// The site-wide up/down convention, kept for this chart specifically（「紅綠配色還是要帶的」）— an
// explicit exception to the neutral-colour rule the rest of this app's charts follow. The bands
// are also never the only cue: the tooltip names the band a point sits in, in 倍 terms.
const bandPalette = computed(() => {
  const priceColors = getPriceColors(resolvedMode.value, market.value)
  return riverColors(priceColors.up, priceColors.down, BAND_COUNT)
})

const formatMultiple = (value: number): string => `${value.toFixed(1)}倍`

// Log-axis ticks land on even steps in LOG space (10^2.6 = 398.1…), which read as noise as labels;
// rounding to two significant figures ("400") moves the label by well under 1% of its own value.
function formatAxisPrice(value: number): string {
  if (value <= 0) return ''
  const unit = Math.pow(10, Math.floor(Math.log10(value)) - 1)
  return `${Math.round(value / unit) * unit}`
}

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

// ECharts stacks the band series, so every series above the bottom one carries only its own gap
// above the previous boundary. A null boundary stays null in every band at that point (a real
// gap), never coerced to 0.
function bandSeries() {
  const rows = boundaries.value
  if (!rows.length) return []
  return rows.map((own, k) => ({
    name: `level${k}`,
    type: 'line' as const,
    data:
      k === 0
        ? own
        : own.map((value, i) => {
          const previous = rows[k - 1]![i] ?? null
          return value === null || previous === null ? null : value - previous
        }),
    stack: 'river',
    showSymbol: false,
    silent: true,
    smooth: true,
    smoothMonotone: 'x' as const,
    lineStyle: { width: 0 },
    itemStyle: { color: bandPalette.value.lines[k] },
    // opacity 0.28, lowered from 0.45（「河流圖顏色太深了 要淺一點」）.
    ...(k > 0 ? { areaStyle: { color: bandPalette.value.fills[k - 1], opacity: 0.28 } } : {}),
    z: 1
  }))
}

interface AxisTooltipParam { dataIndex?: number }

const chartOption = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 16, top: 36, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: chartInk.value.baseline } },
    appendTo: 'body',
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
    textStyle: { color: CHART_TOOLTIP_INK.primary },
    formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
      const list = Array.isArray(params) ? params : [params]
      const point = points.value[list[0]?.dataIndex ?? 0]
      if (!point) return ''
      const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
      const row = (label: string, value: string, muted = false) =>
        `<div style="${rowStyle}${muted ? `color:${CHART_TOOLTIP_INK.secondary};` : ''}"><span>${label}</span><strong>${value}</strong></div>`
      const band = point.ratio !== null ? bandRangeFor(point.ratio) : null
      // 尚無資料, not the original's 資料不足 — that phrasing is in this app's own compliance
      // register (shared/utils/compliance-words.ts) and was restored-and-corrected here rather
      // than carried over verbatim with the rest of the chart.
      return `<div style="font-size: 1rem;min-width:170px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${point.price !== null ? row('股價', `${point.price.toFixed(1)} 元`) : row('股價', '尚無資料', true)}
        ${point.ratio !== null ? row(spec.value.ratioLabel, formatMultiple(point.ratio)) : row(spec.value.ratioLabel, '尚無資料', true)}
        ${point.base !== null ? row(spec.value.baseLabel, `${point.base.toFixed(2)} 元`) : ''}
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
  // Log scale（「per pbr 縱軸請幫我用log」）— price here can span a wide multiple (2330's own 近5年
  // window runs ~500元 to ~2,400元), where a linear axis compresses the early, cheaper years into a
  // flat sliver at the bottom. Log gives equal PERCENTAGE moves equal visual distance, which is
  // also the more honest read: a 10% move means the same thing at 500元 or at 2,000元.
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
      showSymbol: true,
      symbolSize: 6,
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
  <div class="valuation-river">
    <div class="valuation-river__corner">
      <SharedLookbackWindowSelect v-model="activeWindow" :disabled-years="disabledYears" />
    </div>
    <SharedChart v-if="hasAnyData" class="valuation-river__chart" :option="chartOption" :init-options="{ renderer: 'svg' }" autoresize />
    <p v-else class="valuation-river__empty">目前沒有這檔股票的{{ spec.ratioLabel }}歷史資料。</p>
  </div>
</template>

<style scoped>
.valuation-river {
  position: relative;
}

/* Same top-right placement the bar chart's own controls use（「lookback-window-select 請放在卡片右
   上角」）so the two chart kinds put their one control in the same place. */
.valuation-river__corner {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  display: flex;
  align-items: center;
}

.valuation-river__chart {
  width: 100%;
  height: 20rem;
  margin-top: 12px;
}

.valuation-river__empty {
  margin: 0;
}
</style>
