<script setup lang="ts">
import { getAccentColor, getChartInk, getPriceColors, riverColors, CHART_TOOLTIP_INK } from '~/utils/chart-palette'
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'


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
//   * 原本逐支抓資料的單一指標 history composable。資料現在來自 analysis-ts 的 valuation-river 端點（2026-10-08，見資料段的註解）。
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

// ---- 資料：analysis-ts 的河流圖專用端點（2026-10-08，經 bff-ts 轉出）----
// 之前用 metrics-history 的季資料自己拼（每季一個股價點、底數用換算過的每股值），踩過兩次：先是底數換算到今天的
// 股數、股價與比率卻是當時原值，河道整條偏掉（2755「河流圖怪怪的」）；改成 價÷倍數 之後一致了，但遇到分割或大
// 比例配股，股價線與河道會一起斷崖（5904 面額 10→1 顯示成 −90%）。analysis-ts 的使用者因此決定做專用端點：
//   - prices：每日收盤，換算到今天的股數基準（分割、配股、減資換股；現金股利不調整）
//   - bases：底數的階梯，從財報**公布日**（knowledgeDate）起生效，不是季底——沒有偷看未來
//   - bandMultiples：6 條線＝5 條河道，取這檔在視窗內每日比率的 P5～P95 再均分（使用者「分五條、依各股歷史區間
//     自動切」，兩端改用 P5／P95，避免單日極端值把河道撐開；2330／2412 這類穩定的跟 min～max 幾乎一樣）
// 河道＝底數 × 倍數，在這裡乘。約一成的交易日股價會在最外兩條線之外，那就是在河外，不另外處理。
interface ValuationRiverResponse {
  lookback: { requestedYears: number; from: string; to: string }
  bandMultiples: number[] | null
  prices: { tradeDate: string; close: number }[]
  bases: { effectiveFrom: string; base: number | null }[]
}

// 這檔總共有幾期，只拿來決定期間選單哪些選項不夠長（「不滿十年不給看」）。端點只回傳要求的那段期間，看不出全部
// 歷史有多長，所以另外問一次 metrics-history（limit 1，只要 total）。
const symbolRef = computed(() => props.symbol)
const ratioBasis = computed<MetricsHistoryTimeframe>(() => spec.value.ratioBasis)
const ratioCodes = computed<string[]>(() => [spec.value.ratioCode])
const { total: mainTotal } = useMetricsHistory(symbolRef, ratioCodes, ratioBasis, ref(1))

// 近10年 stays disabled unless the series genuinely reaches 40 periods — the standing rule for
// every lookback selector in this app（「不滿十年不給看」）, checked on the real `total` rather than
// on how many rows happened to come back.
const insufficientYears = computed(() => insufficientLookbackYears(mainTotal.value))
const fittedWindow = computed(() => fitLookbackWindow(activeWindow.value, mainTotal.value))
const shortfall = computed(() => (fittedWindow.value === null ? lessThanAYearText(mainTotal.value) : null))

const years = computed(() => LOOKBACK_WINDOW_YEARS[fittedWindow.value ?? activeWindow.value])
const { data: river, status: riverStatus } = useAsyncData(
  () => `valuation-river:${props.symbol}:${props.kind}:${years.value}`,
  () => $fetch<ValuationRiverResponse>(`/stocks/${props.symbol}/valuation-river`, {
    baseURL: BFF_BASE,
    query: { ratio: props.kind, lookbackYears: years.value }
  }),
  { server: false, lazy: true }
)


interface RiverPoint {
  label: string
  price: number | null
  ratio: number | null
  base: number | null
}

// 每個交易日一個點：底數取 effectiveFrom ≤ 當天的最後一筆（bases 依日期遞增，兩邊一起往前走）。
// 底數 null 或 ≤ 0（例如近四季 EPS 虧損）那段沒有河道，倍數也不顯示。
const points = computed<RiverPoint[]>(() => {
  const data = river.value
  if (!data) return []
  const bases = data.bases
  let k = -1
  return data.prices.map((day) => {
    while (k + 1 < bases.length && bases[k + 1]!.effectiveFrom <= day.tradeDate) k++
    const raw = k >= 0 ? bases[k]!.base : null
    const base = raw !== null && raw > 0 ? raw : null
    return { label: day.tradeDate, price: day.close, ratio: base === null ? null : day.close / base, base }
  })
})

const hasAnyData = computed(() => points.value.some(point => point.price !== null))


// 5 visible bands（「河道請幫我分五條」）means 6 boundary levels — a band is the gap between two
// adjacent ones. The multiples are NOT a fixed site-wide ladder（「依各股歷史區間自動切」）: each stock's
// own P5～P95 split evenly, computed by analysis-ts（see the data comment above）.
const BAND_COUNT = 5
const levels = computed<number[] | null>(() => {
  const multiples = river.value?.bandMultiples
  return multiples && multiples.length === BAND_COUNT + 1 ? multiples : null
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
    // 不平滑：底數在財報公布日跳一階，河道照實跳
    lineStyle: { width: 0 },
    itemStyle: { color: bandPalette.value.lines[k] },
    // opacity 0.28, lowered from 0.45（「河流圖顏色太深了 要淺一點」）.
    ...(k > 0 ? { areaStyle: { color: bandPalette.value.fills[k - 1], opacity: 0.28 } } : {}),
    z: 1
  }))
}

interface AxisTooltipParam { dataIndex?: number }

const chartOption = computed(() => ({
  grid: { left: 8, right: 16, top: 36, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: chartInk.value.baseline } },
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
    // 每日一點，標籤只寫年月
    axisLabel: { formatter: (value: string) => value.slice(0, 7) }
  },
  // Log scale（「per pbr 縱軸請幫我用log」）— price here can span a wide multiple (2330's own 近5年
  // window runs ~500元 to ~2,400元), where a linear axis compresses the early, cheaper years into a
  // flat sliver at the bottom. Log gives equal PERCENTAGE moves equal visual distance, which is
  // also the more honest read: a 10% move means the same thing at 500元 or at 2,000元.
  yAxis: {
    type: 'log',
    name: '元',
    logBase: 10,
    ...(axisExtent.value ? { min: axisExtent.value.min, max: axisExtent.value.max } : {}),
    axisLabel: { formatter: formatLogAxisTick }
  },
  series: [
    ...bandSeries(),
    {
      name: '股價',
      type: 'line',
      // 每日收盤，沒有「轉折點」可標（高齡友善規格的 ≥ 8px 標記是給季資料那種疏的點，2026-09-30）；
      // 也不平滑——每日資料本身就夠細，平滑只會畫出不存在的價格
      showSymbol: false,
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
      <SharedLookbackWindowSelect :model-value="fittedWindow ?? activeWindow" :insufficient-years="insufficientYears" @update:model-value="value => (activeWindow = value)" />
    </div>
    <!-- The shortfall wins over the generic empty line: it names both numbers, so the reader can
         tell「這家公司只有這麼短」from「你們沒有資料」. -->
    <p v-if="shortfall" class="valuation-river__empty">{{ shortfall }}</p>
    <SharedChart v-else-if="hasAnyData" class="valuation-river__chart" :option="chartOption" autoresize />
    <!-- 載入中與讀取失敗都先保留圖的位置，不出文字 -->
    <div v-else-if="riverStatus !== 'success'" class="valuation-river__chart" />
    <p v-else class="valuation-river__empty">目前沒有這檔股票的{{ spec.ratioLabel }}歷史資料。</p>
  </div>
</template>

<style scoped>
/* Same top-right placement the bar chart's own controls use（「lookback-window-select 請放在卡片右
   上角」）so the two chart kinds put their one control in the same place. Anchored to the ancestor
   card like StockMetricHistoryChartInteractive's corner, not to this component: this root used to be
   position: relative, so the select sat inside the chart body instead of the card's corner —
   visibly off in a card with a header（指標速覽, 2026-10-07「是下拉選單的樣式問題」）. */
.valuation-river__corner {
  position: absolute;
  top: 12px;
  right: 12px;
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
