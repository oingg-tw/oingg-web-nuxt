<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent, MarkLineComponent } from 'echarts/components'
import { ensureContrast, getChartInk, getPriceColors, riverColors, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

use([SVGRenderer, BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent, MarkLineComponent])

// Several metricCodes over the same periods, one line each — extracted from
// app/pages/stock/[code]/margins.vue on 2026-09-21 alongside StockWaterfallChart, when the
// 安全韌性 page needed the identical chart for its own three ratios.
//
// Series are separated by LINE TYPE and SYMBOL SHAPE first and colour second（WCAG 1.4.1）: the
// user's own accent colour is one of the three, so two of them can legitimately resolve to the
// same hue on the GOLD accent, and shape still tells them apart. All three colours are ones this
// app has already verified against both surfaces（chart ink, the resolved accent, the darkened
// light-mode gold）rather than new hand-picked hexes. Every consumer also renders the same numbers
// as a real table, so the chart is never the only path to this data.
export interface LineSeriesSpec {
  code: string
  name: string
  lineType: 'solid' | 'dashed' | 'dotted'
  symbol: 'circle' | 'triangle' | 'rect' | 'diamond'
  // Which y-axis this line is measured against. Omitted（the case for every consumer that plots
  // one unit）means the left axis, so nothing had to change when the right one was added.
  axis?: 'left' | 'right'
  // Per-series formatter for the tooltip, for the mixed-unit case where one `format` would print
  // 0.55 次 as「0.55%」. Falls back to `format`.
  format?: (value: number | null) => string
  // Bars for a LEVEL, lines for a RATE — the 月營收 page's reason for wanting both on one chart
  // (2026-09-23): revenue is an amount that stands on its own each month, while its year-on-year
  // change is a relationship between two of them. Drawing both as lines would invite reading the
  // gap between them as meaningful when the two axes are unrelated. Omitted = line, so no existing
  // caller changed.
  type?: 'line' | 'bar'
  // 在這條線自己的軸上畫一條零基準線（2026-09-28「希望要加上一條 baseline，讓人容易看出哪幾季
  // 年增率大於零」）。掛在 series 上而不是 yAxis 上，所以雙軸圖會落在正確的那一軸——月營收那一頁
  // 的年增率走右軸，左軸是月均價，零對左軸沒有意義。
  //
  // 跟 negativeBand 是互補不是重複：色帶標「哪幾個月是負的」，基準線給「零在哪裡」這個參考，兩者
  // 一起看才讀得出「剛好在零附近」那種狀態。
  baseline?: boolean
  // Shade the PERIODS in which this series was negative — full-height vertical bands on the time
  // axis, the recession-shading idiom（2026-09-23）.
  //
  // Two earlier attempts at the same fact were both wrong, and the reason is worth keeping:
  //
  //   1. Colouring each BAR by its sign（`signBy`）spent the colour channel on something the zero
  //      axis already says, and then left the series itself with no hue to be identified by — the
  //      legend swatch had to be drawn neutral, which is the tell that the encoding was wrong.
  //   2. A horizontal band from the axis floor up to zero is anchored to ONE y-axis, and on a
  //      dual-axis chart the other series runs straight through it. Drawn and looked at: 2330's
  //      月均價 line sat inside the「negative」tint for three of five years, which is simply false
  //      information about the series it crosses.
  //
  // A vertical band is anchored to TIME, which every series on the chart shares, so it cannot say
  // anything about a value it does not own. It also answers the question in the words it was
  // asked in —「負成長的區段」.
  //
  // The tint follows this app's market-convention tokens rather than a literal green, because
  // which colour means「down」is a per-reader setting: Taiwan reads red as up, the West the other
  // way, and a third option swaps both for a colourblind-safe pair.
  //
  // Colour is not the only cue（「任何漲跌/數值類資訊禁止純靠色彩」）: the shaded months are exactly
  // the ones where this series is below its own labelled zero line, readable by position alone.
  negativeBand?: boolean
}

// What this chart needs from a row, which is less than a MetricsHistoryEntry carries. Widened
// 2026-09-23 so a MONTHLY series can use the same component: `label` overrides the「2026 Q2」the
// fiscal fields produce, and a MetricsHistoryEntry still satisfies this structurally, so no
// existing caller changed.
export interface LineChartEntry {
  fiscalYear?: number
  fiscalQuarter?: number | null
  label?: string
  values: Record<string, { value: number | null } | null | undefined>
}

const props = defineProps<{
  // Ascending (oldest first), as bff-ts returns it — time runs left to right on the x-axis.
  entries: LineChartEntry[]
  series: readonly LineSeriesSpec[]
  // 'ramp'（預設）＝五階綠→紅漸層，給**有序**的家族：三率、流動/速動/現金比率、杜邦的四個因子、
  // 總額成長率 vs 每股成長率。那些線之間有大小或包含關係，漸層在講那件事。
  //
  // 'accent' ＝使用者選的主題強調色領頭、其餘用墨色，給**量綱不同**的組合（2026-09-28「monthly-revenue
  // 這邊折線的要改回中性用色」→「請用主題色配色」）。月營收那一頁是月均價（元，左軸）配年增率
  // （%，右軸），兩條線之間沒有順序可言，漸層會宣稱一個不存在的關係；但全灰又丟掉了主題識別，所以
  // 第一條拿強調色。那一頁唯一該帶顏色意義的是 negativeBand——年增率為負的月份用跌色淺淺鋪一層。
  palette?: 'ramp' | 'accent' | 'compare'
  unit: string
  format: (value: number | null) => string
  // Set this to put a SECOND y-axis on the right and allow series to opt into it. Omitted = one
  // axis, exactly as before（2026-09-22, added for 杜邦分析, whose four lines are two percentages
  // and two multiples）. A dual axis is the honest way to draw those together: the alternative,
  // indexing every line to a common base, breaks on a loss-making year because a negative base
  // flips the sign of everything after it.
  unitRight?: string
}>()

const { resolvedMode, color: accentColorName, market } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))

// 五階漸層，第一條綠、往後每條跳向紅（2026-09-27「所有線段圖，要改成五等分位的配色。從綠色每個線段
// 跳到紅色。這樣更直觀」）。取代原本的四個離散色（accent／墨黑／金／次墨）——那四個沒有順序感，讀者
// 無從判斷哪條「排在前面」。
//
// 用 riverColors 而不是手寫五個 hex：河流圖的五條河道已經在用同一支產生器，兩張圖的漸層因此一致，
// 而且它吃的是 getPriceColors 的結果，所以**自動跟著使用者自己的市場慣例翻轉**——台股慣例是綠→紅，
// 西方慣例會變成紅→綠，ACCESSIBLE 會變成橘→藍。硬寫綠紅會跟使用者在別處選的設定互相矛盾。
//
// 漸層跨滿**實際的線數**而不是固定取 5 階的前 N 個：固定 5 階的話，杜邦的四條線只會拿到前四色、
// 最後一條停在土黃 #b47526，紅色永遠到不了（量到的）。用 count - 1 當 bandCount，第一條永遠是綠、
// 最後一條永遠是紅，中間平均分。
// 顏色仍然是最後一個線索：lineType 與 symbol 沒有動，單看形狀就能分辨（WCAG 1.4.1）。
const ACCENT_FOLLOWERS = ['primary', 'secondary', 'muted'] as const

const seriesColors = computed(() => {
  // compare：主角＋對照（2026-10-07「ROE 主角用強調色，對照用灰色」）。兩條線不是有序家族，綠→紅
  // 漸層在這裡只會被讀成漲跌；對照線一律灰（muted，≥4.5:1），不是 accent 的墨黑。
  if (props.palette === 'compare') {
    const accent = getAccentColor(resolvedMode.value, accentColorName.value)
    return props.series.map((_, i) => (i === 0 ? accent : chartInk.value.muted))
  }
  if (props.palette === 'accent') {
    const ink = chartInk.value
    // 第一條是使用者選的強調色，其餘接墨色。三個墨色都量過 ≥3:1（primary 12.37/14.89、
    // secondary 5.80/7.95、muted 5.30/4.70）。超過四條線就繞回去，但這個色盤本來就是給兩三條
    // 不同量綱的線用的——真正需要多條的是有序家族，那些走 ramp。
    return props.series.map((_, i) =>
      i === 0
        ? getAccentColor(resolvedMode.value, accentColorName.value)
        : ink[ACCENT_FOLLOWERS[(i - 1) % ACCENT_FOLLOWERS.length]!])
  }
  const count = props.series.length
  // riverColors 的 bandCount 0 會讓內部除以 lineCount - 1 = 0 而回 NaN。單條線沒有漸層可言，
  // 直接給起點色。
  if (count < 2) return [ensureContrast(priceColors.value.down, resolvedMode.value)]
  // 中段經過黃色，對白卡片會掉到 2.83:1——逐條夾到 3:1（見 ensureContrast 的註解）。
  return riverColors(priceColors.value.up, priceColors.value.down, count - 1).lines
    .map(color => ensureContrast(color, resolvedMode.value))
})

// Index ranges of the consecutive periods where a series is below zero. A null period BREAKS a run
// rather than extending it —「not reported」is not「negative」, and shading it would assert a fall
// that was never filed.
function negativeRuns(list: LineChartEntry[], code: string): [number, number][] {
  const runs: [number, number][] = []
  let start: number | null = null
  list.forEach((entry, index) => {
    const value = entry.values[code]?.value
    if (value != null && value < 0) {
      if (start === null) start = index
    } else if (start !== null) {
      runs.push([start, index - 1])
      start = null
    }
  })
  if (start !== null) runs.push([start, list.length - 1])
  return runs
}

const periodLabel = (entry: LineChartEntry): string => entry.label ?? (entry.fiscalQuarter === null ? `${entry.fiscalYear} 年` : `${entry.fiscalYear} Q${entry.fiscalQuarter}`)

interface AxisTooltipParam { dataIndex?: number }

const chartOption = computed(() => {
  const list = props.entries
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    // Top space reserved for the LEGEND, which wraps. 48 was a constant tuned when both consumers
    // had three short names（two rows at 375px）; 杜邦's four names with units take five rows there
    // and were measured drawing straight over the lines. One extra row per series past the second
    // covers the worst case — phone width, one entry per row — and at desktop, where the legend is
    // a single row, the surplus reads as spacing rather than as a defect.
    grid: { left: 8, right: 16, top: 48 + Math.max(0, props.series.length - 2) * 24, bottom: 28, containLabel: true },
    legend: {
      top: 0,
      textStyle: { color: chartInk.value.muted, fontSize: 16 },
      data: props.series.map(series => series.name)
    },
    tooltip: {
      trigger: 'axis',
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
        const entry = list[(Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0]
        if (!entry) return ''
        const rows = props.series.map(series => `<div>${series.name}：${(series.format ?? props.format)(entry.values[series.code]?.value ?? null)}</div>`).join('')
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${periodLabel(entry)}</div>${rows}</div>`
      }
    },
    xAxis: {
      type: 'category',
      data: list.map(entry => periodLabel(entry)),
      axisLine: { lineStyle: { color: chartInk.value.baseline } },
      axisTick: { show: false },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    // The right axis draws no gridlines of its own — two interleaved sets of horizontal lines
    // read as a grid that belongs to neither series.
    yAxis: [
      {
        type: 'value',
        name: props.unit,
        nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
        splitLine: { lineStyle: { color: chartInk.value.gridline } },
        axisLabel: { color: chartInk.value.muted, fontSize: 16 }
      },
      ...(props.unitRight
        ? [{
            type: 'value',
            name: props.unitRight,
            nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
            splitLine: { show: false },
            axisLabel: { color: chartInk.value.muted, fontSize: 16 }
          }]
        : [])
    ],
    series: props.series.map((series, index) => ({
      name: series.name,
      type: series.type ?? 'line',
      yAxisIndex: series.axis === 'right' ? 1 : 0,
      // Bars draw behind lines regardless of source order, so a line is never hidden by the
      // column it sits over.
      z: series.type === 'bar' ? 1 : 3,
      ...(series.baseline
        ? {
            markLine: {
              silent: true,
              symbol: 'none',
              // 用 baseline 的墨色而不是資料線的顏色：它是刻度不是資料，要讀得出來但不能跟線爭。
              lineStyle: { color: chartInk.value.baseline, width: 1, type: 'solid' },
              label: { show: false },
              data: [{ yAxis: 0 }]
            }
          }
        : {}),
      ...(series.type === 'bar'
        ? { barMaxWidth: 18, itemStyle: { color: seriesColors.value[index] } }
        : {
            symbol: series.symbol,
            // 高齡友善介面的線條規格（2026-09-30 直接指示）：折線 ≤ 2 條、線寬 ≥ 2.5px、轉折點
            // ≥ 8px 實心標記。規格表寫主要資料折線最小 2.0px、建議 2.5–3.0px，這裡取建議區間的下緣。
            symbolSize: 8,
            lineStyle: { width: 2.5, type: series.lineType, color: seriesColors.value[index] },
            itemStyle: { color: seriesColors.value[index] },
            // `connectNulls: false` on purpose — a period with no filed figure leaves a real gap
            // in the line rather than a straight segment implying a value that was never reported.
            connectNulls: false
          }),
      // One band per CONTIGUOUS run of negative periods, rather than one per period: adjacent bands
      // would draw their edges against each other and read as stripes within a single downturn.
      // The ±0.5 puts each edge on the category boundary instead of on a point, so a one-period
      // run is a band the width of a period rather than a zero-width line.
      // `silent` so it never takes the axis tooltip from the points drawn over it.
      ...(series.negativeBand
        ? {
            markArea: {
              silent: true,
              itemStyle: { color: priceColors.value.down, opacity: 0.14 },
              data: negativeRuns(list, series.code).map(([from, to]) => [{ xAxis: from - 0.5 }, { xAxis: to + 0.5 }])
            }
          }
        : {}),
      data: list.map(entry => entry.values[series.code]?.value ?? null)
    }))
  }
})
</script>

<template>
  <SharedChart v-if="entries.length > 1" class="stock-multi-line-chart" :option="chartOption" autoresize />
</template>

<style scoped>
.stock-multi-line-chart {
  width: 100%;
  height: 320px;
}

/* The reserved legend space above comes out of the same 320px, so at phone width — where the
   legend actually wraps — the plot would be squeezed to pay for it. Give the height back instead
   of shrinking the lines. */
@media (max-width: 600px) {
  .stock-multi-line-chart {
    height: 400px;
  }
}
</style>
