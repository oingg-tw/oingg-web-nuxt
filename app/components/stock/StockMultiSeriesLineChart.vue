<script setup lang="ts">
// Several metricCodes over the same periods, one line each — extracted from
// app/pages/stock/[code]/margins.vue on 2026-09-21 alongside StockWaterfallChart, when the
// 安全韌性 page needed the identical chart for its own three ratios.
//
// Series are separated by LINE TYPE and SYMBOL SHAPE first and colour second（WCAG 1.4.1）, so
// shape alone still tells the lines apart. The colours come from getSeriesColors / the inks / the
// resolved accent, all checked against the card surface rather than new hand-picked hexes. Every
// consumer also renders the same numbers as a real table, so the chart is never the only path to
// this data.
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
  // 柱子依正負上漲跌色（2026-10-14，使用者選「一格，年增率柱＋月均價線」，為了負成長的識別度）。跟指標頁柱狀圖同一條規則
  //（useMetricHistoryChartOption 的 itemStyle：按數值正負上色、跟著使用者的市場慣例翻轉，2026-10-01 使用者定的）。只對
  // type 'bar' 有效；圖例小方塊用漲色。零線（baseline）與柱子朝上朝下本身就說明正負，顏色不是唯一線索。
  signColored?: boolean
  // 年增率畫成「是去年的幾倍」的對數（2026-10-21，5314 月營收的年增率 +49,675% 把其餘月份壓成細條，使用者在真資料方案頁選了 A）：
  // 這條所在的那一軸整條換成這種刻度，刻度標回百分比；營收 0（−100%）沒有倍數，畫到最底、灰色。提示框照舊寫原始的百分比。
  // 換算與刻度在 app/utils/growth-log-scale.ts
  growthLog?: boolean
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
  // Ascending (oldest first), as 業務中台 returns it — time runs left to right on the x-axis.
  entries: LineChartEntry[]
  // 資料還沒到：同樣高的骨架塊（2026-10-20，使用者：「載入之前，可以讓用戶看的出來畫面結構」「然後不要閃動」）
  loading?: boolean
  series: readonly LineSeriesSpec[]
  // 'category'（預設）＝主題色領頭、其餘用分類色（getSeriesColors）：杜邦、三率、流動/速動/現金比率等
  //（2026-10-17 使用者選「主題色＋分類色」，取代 2026-09-27 起的五階綠→紅漸層——綠紅是漲跌色，這些線沒有漲跌的意思）。
  //
  // 'accent' ＝使用者選的主題強調色領頭、其餘用墨色，給**量綱不同**的組合（2026-09-28「monthly-revenue
  // 這邊折線的要改回中性用色」→「請用主題色配色」）。月營收那一頁是月均價（元，左軸）配年增率
  // （%，右軸），兩條線之間沒有順序可言；但全灰又丟掉了主題識別，所以
  // 第一條拿強調色。那一頁唯一該帶顏色意義的是 negativeBand——年增率為負的月份用跌色淺淺鋪一層。
  palette?: 'category' | 'accent' | 'compare'
  unit: string
  format: (value: number | null) => string
  // Set this to put a SECOND y-axis on the right and allow series to opt into it. Omitted = one
  // axis, exactly as before（2026-09-22, added for 杜邦分析, whose four lines are two percentages
  // and two multiples）. A dual axis is the honest way to draw those together: the alternative,
  // indexing every line to a common base, breaks on a loss-making year because a negative base
  // flips the sign of everything after it.
  unitRight?: string
  // 時間上的區段，畫成灰底（2026-10-21，類股月營收圖的「景氣收縮期」）：跟 negativeBand 的漲跌色淡底用色相分開。from／to 是 x 軸上的
  // 標籤，to 是 null 就畫到最後一期；圖例多一項（說明每一段，連太窄寫不下字的那種），提示框標出這一期落在哪一段
  periods?: { from: string; to: string | null; label: string }[]
}>()

const { resolvedMode, color: accentColorName, market } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))

// 預設的 category 見 getSeriesColors（2026-10-17 取代綠→紅漸層，理由寫在那裡）。顏色仍然是最後一個線索：lineType 與 symbol
// 沒有動，單看形狀就能分辨（WCAG 1.4.1）。
const ACCENT_FOLLOWERS = ['primary', 'secondary', 'muted'] as const

const seriesColors = computed(() => {
  // compare：主角＋對照（2026-10-07「ROE 主角用強調色，對照用灰色」）。對照線灰（muted，≥4.5:1），不是 accent 的墨黑。
  // 第三條起（右軸那一條，ROE 頁的權益乘數）接分類色：兩條灰線只剩線型可分，而右軸那一條是另一個量尺，顏色不同才不會被當成對照
  if (props.palette === 'compare') {
    const others = getSeriesColors(resolvedMode.value, accentColorName.value, props.series.length)
    return props.series.map((_, i) => (i === 1 ? chartInk.value.muted : i === 0 ? others[0]! : others[i - 1]!))
  }
  if (props.palette === 'accent') {
    const ink = chartInk.value
    // 第一條是使用者選的強調色，其餘接墨色。三個墨色都量過 ≥3:1（primary 12.37/14.89、
    // secondary 5.80/7.95、muted 5.30/4.70）。超過四條線就繞回去，但這個色盤本來就是給兩三條
    // 不同量綱的線用的——要分得開的多條線走預設的 category。
    return props.series.map((_, i) =>
      i === 0
        ? getAccentColor(resolvedMode.value, accentColorName.value)
        : ink[ACCENT_FOLLOWERS[(i - 1) % ACCENT_FOLLOWERS.length]!])
  }
  return getSeriesColors(resolvedMode.value, accentColorName.value, props.series.length)
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

// 線疊在柱子上時，線底下多畫一條卡片底色的寬線、點加底色外框（2026-10-14，使用者：「顏色上應該沒有符合 a11y」）。量過：月均價的金
//（#8a6823）對紅柱 1.09:1、對綠柱 1.08:1，落在柱子上就融在一起，不符 WCAG 1.4.11。加了這圈底色後，金對白 5.14、白對紅 5.62、
// 白對綠 5.55（深色模式底色 #1e1e1e 對紅 5.48、對綠 7.43），線的兩側都 ≥3:1，而且不用改線或柱的顏色。只在圖上有柱子時才畫。
const HALO_WIDTH = 2
const hasBars = computed(() => props.series.some(series => series.type === 'bar'))

const periodLabel = (entry: LineChartEntry): string => entry.label ?? (entry.fiscalQuarter === null ? `${entry.fiscalYear} 年` : `${entry.fiscalYear} Q${entry.fiscalQuarter}`)

// periods 換成 x 軸上的索引；標籤不在軸上的區段不畫
const periodRanges = computed(() => {
  const labels = props.entries.map(periodLabel)
  return (props.periods ?? []).flatMap((period) => {
    const from = labels.indexOf(period.from)
    const to = period.to === null ? labels.length - 1 : labels.indexOf(period.to)
    return from >= 0 && to >= from ? [{ from, to, label: period.label }] : []
  })
})
const periodNames = computed(() => [...new Set(periodRanges.value.map(range => range.label))])
const periodFill = computed(() => ({ color: chartInk.value.muted, opacity: 0.16 }))

interface AxisTooltipParam { dataIndex?: number }

const axisIndexOf = (series: LineSeriesSpec) => (series.axis === 'right' ? 1 : 0)

const chartOption = computed(() => {
  const list = props.entries
  const legendCount = props.series.length + periodNames.value.length
  // 有 growthLog 序列的軸：刻度從這段畫得到的值算（左軸、右軸各自）
  const logAxis = [0, 1].map((axisIndex) => {
    const growth = props.series.filter(series => series.growthLog && axisIndexOf(series) === axisIndex)
    if (!growth.length) return {}
    const ticks = growthLogTicks(list.flatMap(entry => growth.flatMap((series) => {
      const value = entry.values[series.code]?.value
      return value == null ? [] : [value]
    })))
    return { min: ticks[0], max: ticks.at(-1), axisLabel: { customValues: ticks, formatter: growthLogLabel }, axisTick: { customValues: ticks }, splitLine: { show: false } }
  })
  return {
    // Top space reserved for the LEGEND, which wraps. 48 was a constant tuned when both consumers
    // had three short names（two rows at 375px）; 杜邦's four names with units take five rows there
    // and were measured drawing straight over the lines. One extra row per series past the second
    // covers the worst case — phone width, one entry per row — and at desktop, where the legend is
    // a single row, the surplus reads as spacing rather than as a defect.
    grid: { left: 8, right: 16, top: 48 + Math.max(0, legendCount - 2) * 24, bottom: 28, containLabel: true },
    legend: {
      top: 0,
      data: [
        ...props.series.map(series => series.name),
        // 圖例的小圖示也是灰底，跟圖上的一樣
        ...periodNames.value.map(name => ({ name, icon: 'rect', itemStyle: periodFill.value }))
      ]
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
        const index = (Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0
        const entry = list[index]
        if (!entry) return ''
        const rows = props.series.map(series => `<div>${series.name}：${(series.format ?? props.format)(entry.values[series.code]?.value ?? null)}</div>`).join('')
        const inPeriod = periodRanges.value.find(range => index >= range.from && index <= range.to)
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${periodLabel(entry)}${inPeriod ? `（${inPeriod.label}）` : ''}</div>${rows}</div>`
      }
    },
    xAxis: {
      type: 'category',
      data: list.map(entry => periodLabel(entry)),
    },
    // The right axis draws no gridlines of its own — two interleaved sets of horizontal lines
    // read as a grid that belongs to neither series.
    yAxis: [
      {
        type: 'value',
        name: props.unit,
        ...logAxis[0]
      },
      ...(props.unitRight
        ? [{
            type: 'value',
            name: props.unitRight,
            splitLine: { show: false },
            ...logAxis[1]
          }]
        : [])
    ],
    series: [...props.series.flatMap((series, index) => [
      ...(hasBars.value && series.type !== 'bar'
        ? [{
            // 不給名字：SharedChart 用各 series 的名字組圖表的 aria-label，外框不是資料
            name: '',
            type: 'line',
            yAxisIndex: series.axis === 'right' ? 1 : 0,
            z: 2,
            silent: true,
            tooltip: { show: false },
            emphasis: { disabled: true },
            symbol: series.symbol,
            symbolSize: 8 + HALO_WIDTH * 2,
            lineStyle: { width: 2.5 + HALO_WIDTH * 2, color: CARD_SURFACE[resolvedMode.value] },
            itemStyle: { color: CARD_SURFACE[resolvedMode.value] },
            connectNulls: false,
            data: list.map(entry => entry.values[series.code]?.value ?? null)
          }]
        : []),
      {
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
        ? { barMaxWidth: 18, itemStyle: { color: series.signColored ? priceColors.value.up : seriesColors.value[index] } }
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
      data: list.map((entry) => {
        const value = entry.values[series.code]?.value ?? null
        const plotted = value !== null && series.growthLog ? growthLogValue(value) : value
        if (value === null || !(series.type === 'bar' && series.signColored)) return plotted
        const color = series.growthLog && value <= -100 ? chartInk.value.muted : value < 0 ? priceColors.value.down : priceColors.value.up
        return { value: plotted, itemStyle: { color } }
      })
    }]), ...periodNames.value.map(name => ({
      // 只承載區段的灰底（與圖例那一項），沒有資料、不進提示框；灰底跨整個繪圖區的高度，所以掛在哪一軸都一樣
      name,
      type: 'line',
      data: [],
      silent: true,
      tooltip: { show: false },
      itemStyle: periodFill.value,
      markArea: {
        silent: true,
        itemStyle: periodFill.value,
        data: periodRanges.value.filter(range => range.label === name).map(range => [{ xAxis: range.from - 0.5 }, { xAxis: range.to + 0.5 }])
      }
    }))]
  }
})
</script>

<template>
  <div v-if="loading" class="stock-multi-line-chart app-skeleton" aria-hidden="true" />
  <SharedChart v-else-if="entries.length > 1" class="stock-multi-line-chart" :option="chartOption" autoresize />
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
