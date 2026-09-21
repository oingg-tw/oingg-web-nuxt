<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { CustomChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import type { StockMarginsPageResponse } from '#shared/types/stock-margins-page'
import type { MetricsHistoryEntry } from '#shared/types/metrics-history'
import { clampDescription, findMetricInSchema } from '~/utils/stock-digest'
import { joinClauses, joinSentences } from '~/utils/stock-answers'
import { getAccentColor, getChartAccentGold, getChartInk, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

// /stock/:code/margins — 財報三率, the first child of the nav's own 財報三率 group. Built from the
// direct request「希望有頁面同時解釋 三率 的 關係」, which the three per-rate pages structurally
// cannot answer: each of those shows ONE rate over time, and the thing being asked about is the
// arithmetic BETWEEN them.
//
// Its own route file rather than a METRIC_PAGES entry, the same call balance-sheet.vue and
// dividend.vue already represent: MetricPageDefinition carries a single `metricCode`, and this
// page reads five together per period. Extending that registry to a metricCode ARRAY would have
// put a multi-series branch inside StockMetricDetailPage for exactly one consumer — the same
// `v-if="isBadge"` shape the badge/metric split was made to avoid (see hub-slugs.ts's own comment).
//
// WHY THIS ISN'T A THIN AGGREGATION of the three per-rate pages（the thing 實用內容系統 penalises）:
// the decomposition section below is content that exists on none of them and cannot — it spends
// the 毛利率→營業利益率 gap into its real components（推銷管理費用率、研發費用率）and the
// 營業利益率→稅後淨利率 gap into 業外損益與所得稅, per symbol. 研發費用率 has no page of its own at
// all. The history table carries all three rates in one grid so the gaps are readable down a
// column, which three separate single-column tables can't show.
//
// None of THIS APP'S OWN sentences here are evaluative. 三率三升 is the idiom this page's subject
// is usually taught with, and as a claim（"all three rising is good"）it is a judgement about a
// company, not an arithmetic fact — so the page was built without it, and every sentence written
// here describes the decomposition and nothing else, the same line this app holds on the rank and
// screener pages. The 三率三升 SECTION added later the same day（「三率三升的徽章可以加上去了」）does
// not cross that line: it is analysis-ts's published badge, with its own citation, its own strict
// definition and its own misreadings text, rendered verbatim — the same standing as every other
// guru badge on this site. See that section's own comment.

// echarts is registered per chart component in this app (there is no global plugin — see
// StockMetricHistoryChart.vue's own identical block). LegendComponent is the one this page needs
// that no existing chart here did: it is the first multi-series chart in the app, so it is the
// first to draw a legend. Leaving any of these out does NOT fail at build or typecheck — it throws
// at runtime during hydration（"Renderer 'undefined' is not imported"）, which Nuxt catches into the
// error page while the SSR HTML stays perfectly correct, so curl and `view-source` both look fine
// and only a real browser shows the failure（how this was found, 2026-09-21）.
//
// CustomChart（the waterfall below）fails even more quietly than that: an unregistered SERIES TYPE
// throws nothing at all — ECharts silently draws no series, leaving a chart with axes, category
// labels and an empty plot area. Caught here only by counting the rendered <rect>s rather than
// eyeballing that "a chart appeared". Anything added to this option needs its own entry here.
use([SVGRenderer, CustomChart, LineChart, GridComponent, TooltipComponent, LegendComponent])

const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const TOPIC = '財報三率'

// The three rates in income-statement order, with the cues that tell them apart in the chart.
// Declared up here rather than beside the chart option below because the DATA layer reads it too
// (`ascending` filters on these codes) — and `const` is not hoisted, so a computed that
// useStockPageSeo evaluates during setup would hit the temporal dead zone if this sat lower.
const RATE_SERIES = [
  { code: 'grossMargin', name: '毛利率', lineType: 'solid', symbol: 'circle' },
  { code: 'operatingMargin', name: '營業利益率', lineType: 'dashed', symbol: 'triangle' },
  { code: 'netProfitMargin', name: '稅後淨利率', lineType: 'dotted', symbol: 'rect' }
] as const

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

const { data: marginsData } = await useAsyncData<StockMarginsPageResponse | null>(
  () => `stock-margins-${code.value}`,
  async () => {
    try {
      return await $fetch<StockMarginsPageResponse>(`/api/stock/${code.value}/margins`, { retry: 0, timeout: 15_000 })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[stock-margins] GET /api/stock/${code.value}/margins unavailable (${reason})`)
      }
      return null
    }
  },
  { watch: [code], default: () => null }
)

// bff-ts returns oldest-first; this page reads newest-first everywhere（the table, the "latest"
// figures）, so it reverses once here rather than at each read site. The chart is the one consumer
// that wants the original ascending order back — time runs left to right on an x-axis.
//
// Periods with none of the three rates filed are dropped at the source rather than filtered at
// each read site: a financial gets 20 such periods back（confirmed live on 2891 — the history
// endpoint returns the period rows, with null in every value）, which rendered as a table of 18
// 尚無資料 cells before this filter. A period with nothing to plot has nothing to tabulate either,
// so removing it here fixes the chart and both tables at once. A period missing only SOME of the
// three is kept — that gap is real information and the chart's own connectNulls: false shows it.
const ascending = computed<MetricsHistoryEntry[]>(() =>
  (marginsData.value?.series?.entries ?? []).filter(entry => RATE_SERIES.some(series => entry.values[series.code]?.value != null))
)
const periods = computed(() => [...ascending.value].reverse())
const latest = computed(() => periods.value[0] ?? null)

const valueOf = (entry: MetricsHistoryEntry | null, metricCode: string): number | null => entry?.values[metricCode]?.value ?? null

const grossMargin = computed(() => valueOf(latest.value, 'grossMargin'))
const operatingMargin = computed(() => valueOf(latest.value, 'operatingMargin'))
const netProfitMargin = computed(() => valueOf(latest.value, 'netProfitMargin'))
const expenseRatio = computed(() => valueOf(latest.value, 'operatingExpenseRatio'))
const rdIntensity = computed(() => valueOf(latest.value, 'rdIntensity'))

const periodLabel = (entry: { fiscalYear: number; fiscalQuarter: number }): string => `${entry.fiscalYear} Q${entry.fiscalQuarter}`

// Fixed 2 decimals, NOT this app's usual formatSignificantDigits(value, 3) — the one place a page
// here departs from that helper, and for a reason specific to this page. Every figure on it is a
// percentage in the same range, and the decomposition table's whole claim is that its column adds
// up; 3 significant digits renders 64.23 as "64.2" and 56.10 as "56.1", so a reader checking
// 64.2 − 2.24 − 6.07 gets 55.89 against a printed 56.1 and the page contradicts itself in front of
// them (measured on 2330 before this changed). Two decimals is what the filed figures carry anyway.
const rateText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)}%`)

// Signed form for the two adjustment rows — a bare "5.72%" on a row labelled 加減 reads as the
// opposite of what it does half the time, and 業外損益與所得稅 genuinely falls either way
// (measured: −5.72 on 2330, +1.15 on 2454, where 業外收益 exceeded the tax charge). Both rows'
// values are defined as the amount to ADD to the running figure above them, so the column can be
// chained straight down with no sign gymnastics.
const signedText = (value: number | null): string => (value === null ? '尚無資料' : `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}%`)

// The three rates all divide by the SAME 營收, which is the only reason they can be subtracted from
// each other at all — that is the whole mechanism this page exists to show, and it is also why a
// financial (whose income statement has no 營業收入 line in this sense) has no numbers here.
const hasRates = computed(() => grossMargin.value !== null && operatingMargin.value !== null && netProfitMargin.value !== null)

// 毛利率 − 營業利益率 is an EXACT identity（both are ratios of the same denominator）, so the total
// operating-expense burden is always computable when the two rates exist. Its breakdown is not
// always available（a symbol may be missing one of the two expense ratios）, hence the two shapes.
const expenseTotal = computed(() => (grossMargin.value !== null && operatingMargin.value !== null ? grossMargin.value - operatingMargin.value : null))
const hasExpenseBreakdown = computed(() => expenseRatio.value !== null && rdIntensity.value !== null)
// What 推銷管理 + 研發 leave unexplained: 其他營業收益及費用 plus rounding. Measured at ±0.01 on six
// of seven non-financial symbols sampled and 0.18 on 2330 — shown as its own row rather than
// folded into another so no row ever carries a number it didn't earn.
//
// Signed as the amount to ADD to（毛利率 − 推銷管理 − 研發）to reach 營業利益率, i.e. om − that sum,
// NOT the leftover expense（expenseTotal − the two ratios）which is its negation. Written the other
// way round first and caught by reading the rendered table: 2330 printed「加減 … −0.18%」on a row a
// reader chains downward, where 55.92 + (−0.18) = 55.74 against a printed 56.10. Same convention as
// nonOperatingAndTax below, so both 加減 rows behave identically.
const otherOperating = computed(() =>
  hasExpenseBreakdown.value && grossMargin.value !== null && operatingMargin.value !== null
    ? operatingMargin.value - (grossMargin.value - expenseRatio.value! - rdIntensity.value!)
    : null
)
const nonOperatingAndTax = computed(() =>
  operatingMargin.value !== null && netProfitMargin.value !== null ? netProfitMargin.value - operatingMargin.value : null
)

const latestPeriodText = computed(() => (latest.value ? periodLabel(latest.value) : ''))

// The decomposition as a waterfall: one step per row of the table below, each carrying the y-range
// its bar spans（start → end）rather than a bare magnitude. Requested directly 2026-09-21
//（「三率之間是什麼關係section 那邊希望用瀑布圖而非表格」）— the table stayed, moved into a closed
// <details> beneath the chart, per this app's own document shape（question → answer → one chart,
// the rest in closed details）: a chart is the better READ of a chain of additions, but ECharts
// renders to canvas/SVG that no screen reader and no crawler can parse, so the numbers still have
// to exist as real table markup in the SSR HTML.
//
// `total: true` marks the three bars measured from zero（the rates themselves）; the others float
// between the running figure before and after them. Each delta's `end` is computed from the
// running total rather than by re-deriving it, so the bars are guaranteed to be the same chain the
// table prints — except the three totals, which are pinned to the rate's own filed value so a
// float-accumulated running figure can never drift the anchor bars off their real numbers.
interface WaterfallStep { label: string; start: number; end: number; delta: number | null }

const waterfallSteps = computed<WaterfallStep[]>(() => {
  if (!hasRates.value || expenseTotal.value === null) return []
  const gross = grossMargin.value!
  const operating = operatingMargin.value!
  const net = netProfitMargin.value!
  const steps: WaterfallStep[] = [{ label: '毛利率', start: 0, end: gross, delta: null }]
  let running = gross
  const push = (label: string, amount: number) => {
    steps.push({ label, start: running, end: running + amount, delta: amount })
    running += amount
  }
  if (hasExpenseBreakdown.value) {
    push('推銷及管理', -expenseRatio.value!)
    push('研發', -rdIntensity.value!)
    push('其他與差額', otherOperating.value!)
  } else {
    push('營業費用', -expenseTotal.value)
  }
  steps.push({ label: '營業利益率', start: 0, end: operating, delta: null })
  running = operating
  push('業外與稅', nonOperatingAndTax.value!)
  steps.push({ label: '稅後淨利率', start: 0, end: net, delta: null })
  return steps
})

const valueAnswer = computed(() => {
  if (!latest.value || !hasRates.value) return null
  return joinClauses([
    `${stockShortName.value}（${code.value}）${latestPeriodText.value} 的財報三率（單季）`,
    `毛利率 ${rateText(grossMargin.value)}`,
    `營業利益率 ${rateText(operatingMargin.value)}`,
    `稅後淨利率 ${rateText(netProfitMargin.value)}`,
    latest.value.values.grossMargin?.knowledgeDate ? `資料時間 ${latest.value.values.grossMargin.knowledgeDate}` : null
  ])
})

const relationAnswer = computed(() => {
  if (!hasRates.value || expenseTotal.value === null) return null
  const middle = hasExpenseBreakdown.value
    ? `扣掉推銷及管理費用率 ${rateText(expenseRatio.value)} 與研發費用率 ${rateText(rdIntensity.value)}`
    : `扣掉合計 ${rateText(expenseTotal.value)} 的營業費用`
  return `三率的分母都是同一筆營收，所以可以逐項相減：${stockShortName.value}的毛利率 ${rateText(grossMargin.value)}，${middle}後為營業利益率 ${rateText(operatingMargin.value)}；再計入業外損益與所得稅 ${signedText(nonOperatingAndTax.value)} 後為稅後淨利率 ${rateText(netProfitMargin.value)}。`
})

const historyAnswer = computed(() => {
  const list = periods.value
  if (list.length < 2) return null
  return `以下為 ${stockShortName.value} 由新到舊的財報三率（單季），共 ${list.length} 期，涵蓋 ${periodLabel(list[list.length - 1]!)} 至 ${periodLabel(list[0]!)}。`
})

// 三率三升（2026-09-21,「三率三升的徽章可以加上去了」）. Everything a reader sees here comes from
// the BACKEND — the badge's own summary, its threshold note, and the metric's own limitations and
// misreadings — with no sentence of this app's own beyond the question and the value line. That is
// the standing rule for metric prose, and it matters more than usual on this one: 三率三升 is an
// evaluative idiom, and the framing this page deliberately avoided when it was built（see this
// file's own top comment）is safe to show now precisely BECAUSE analysis-ts publishes it as a
// stated rule with a citation, a strict definition（雙重驗證: each rate must beat both the previous
// quarter and the same quarter last year）and its own misreadings warning that 3 分 says nothing
// about the SIZE of the profit. Writing that framing here instead would have been this app
// judging a company.
const threeMarginsRising = computed(() => marginsData.value?.threeMarginsRising ?? null)
const risingBadge = computed(() =>
  findMetricInSchema(filterSchema.value?.categories ?? [], 'threeMarginsRising')?.metric ?? null
)

// Rendered even with NO reading, by direct instruction（「如果因為 歷史資料不夠 一樣要顯示徽章，
// 我們有區塊在做這件事情。這樣我看到了才有回補的機會」）— this REPLACES the first version, which
// hid the whole section unless the symbol had a score. Hiding it was the wrong call for exactly
// the reason given: threeMarginsRising is backfilled on 2330 and almost nowhere else（1 of 20
// large symbols, measured), and a section that disappears makes that gap invisible to the person
// who could go get it filled. Same treatment the badge TABLE on /stock/{code} already gives every
// other badge — 尚無資料 is a state worth showing, not an error to swallow.
//
// The educational half（summary / 判定方式 / 限制 / 常見誤讀）comes from the CATALOG, not from this
// symbol's reading, so it renders in full either way: a reader on a symbol with no score still
// learns what 三率三升 means and why this site defines it strictly.
const risingAnswer = computed(() => {
  const entry = threeMarginsRising.value
  const denominator = risingBadge.value?.badge?.threshold?.denominator ?? null
  if (!entry || entry.value === null) {
    // Deliberately does NOT name a cause. It said「資料還沒回補」while threeMarginsRising existed
    // only for 2330; after the 2026-09-21 market-wide backfill（1,745 of 2,058 symbols scored）the
    // remaining nulls are analysis-ts's own insufficient_history / missing_input — a company
    // genuinely lacking a prior-quarter or year-ago figure, not a gap waiting to be filled. Stating
    // what the evaluation REQUIRES is true in both cases; blaming a backfill would not be.
    return `${stockShortName.value}最新一季的三率三升尚無資料。這項評定需要三個比率各自的單季數字，以及上一季與去年同季的同期數字，缺其中任何一項就沒有分數。`
  }
  const score = denominator ? `${entry.value} / ${denominator}` : String(entry.value)
  const verdict = entry.passed === null ? '無法判定' : entry.passed ? '符合' : '未符合'
  return joinClauses([
    `${stockShortName.value}最新一季的三率三升分數為 ${score}`,
    `判定 ${verdict}`,
    entry.knowledgeDate ? `資料時間 ${entry.knowledgeDate}` : null
  ])
})

const description = computed(() => {
  if (!hasRates.value) return null
  return clampDescription(joinSentences([valueAnswer.value, relationAnswer.value]) ?? '')
})

// noindex when this symbol has no three rates to relate — a financial, or a symbol whose history
// call failed. Same rule as the metric/badge templates: the page still renders whatever it has for
// a visitor who followed a link here, it just has nothing symbol-specific to be indexed for.
const noindex = computed(() => !hasRates.value)

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '財報三率關係與逐期數據',
  pathSuffix: '/margins',
  stock,
  summary,
  description,
  noindex,
  sectorCode: computed(() => profile.value?.industry ?? null)
})

// --- chart ---
//
// One chart, three lines. Series are separated by LINE TYPE and SYMBOL SHAPE first and colour
// second（WCAG 1.4.1）— the user's own accent colour is one of the three, so two of them can
// legitimately resolve to the same hue on the GOLD accent, and shape still tells them apart. All
// three colours are ones this app has already verified against both surfaces（chart ink, the
// resolved accent, and the darkened light-mode gold）rather than new hand-picked hexes. The table
// below carries the same numbers, so the chart is never the only path to this data.
const { resolvedMode, color: accentColorName } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))

const seriesColors = computed(() => [
  getAccentColor(resolvedMode.value, accentColorName.value),
  chartInk.value.primary,
  getChartAccentGold(resolvedMode.value)
])

interface AxisTooltipParam { dataIndex?: number }

// --- waterfall ---
//
// A `custom` series, not the usual stacked-bar waterfall trick（a transparent placeholder series
// stacked under a visible one）. That trick cannot render this data: ECharts stacks positive and
// negative values into SEPARATE stacks, so any step whose running total crosses zero draws two
// detached bars instead of one floating bar — and margins genuinely cross zero here（1301 台塑,
// 2026 Q2: 營業利益率 −2.02% recovering to 稅後淨利率 +6.07% on 業外損益, measured). `custom` takes
// the bar's own start/end coordinates directly, so a crossing step is just a taller rectangle.
//
// A 2px floor on the drawn height keeps a genuinely-zero step（其他與差額 is +0.00% on several
// symbols）from rendering as an invisible gap in the chain.
const { scale: textScale } = useTextScale()

// SharedChart's own font-size scaling walks the OPTION OBJECT, so it cannot reach text created
// inside renderItem（a function it never descends into）. This chart's bar labels therefore apply
// the same scale by hand — without it they would be the one piece of text in the app that ignores
// the user's 字型大小 setting.
const waterfallOption = computed(() => {
  const steps = waterfallSteps.value
  const accent = getAccentColor(resolvedMode.value, accentColorName.value)
  // useTextScale's `scale` is the SETTING token（'100' | '110' | '120'), not a ratio — the same
  // Number(scale)/100 conversion SharedChart itself does before walking the option tree.
  const labelFont = `${(16 * Number(textScale.value)) / 100}px system-ui, -apple-system, "Segoe UI", sans-serif`
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    // right: 64 reserves room for the value label each bar hangs past its own right edge — with
    // the usual 16px the widest bar's label（毛利率, the chart's full extent）was clipped by the
    // plot edge. containLabel keeps the category names on the left inside the box.
    grid: { left: 8, right: 64, top: 8, bottom: 32, containLabel: true },
    tooltip: {
      trigger: 'item',
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (params: AxisTooltipParam) => {
        const step = steps[params?.dataIndex ?? 0]
        if (!step) return ''
        const body = step.delta === null
          ? rateText(step.end)
          : `${signedText(step.delta)}（${rateText(step.start)} → ${rateText(step.end)}）`
        return `<div style="font-size:1rem"><div style="font-weight:600;margin-bottom:4px">${step.label}</div>${body}</div>`
      }
    },
    // Categories down the Y axis, value across the X — flipped from the vertical-bar version
    // 2026-09-21（「可以改變為縱向的瀑布圖嗎」）. It reads the way the statement it describes does,
    // top to bottom from 毛利率 to 稅後淨利率, and it retires the rotate: 30 the vertical version
    // needed: a horizontal category axis had to angle「推銷及管理」/「業外與稅」to fit seven of them
    // at phone width, where down the side they each get a full row.
    //
    // `inverse: true` is what puts 毛利率 at the TOP — ECharts starts a category y-axis at index 0
    // on the BOTTOM, which would print the whole statement upside down.
    xAxis: {
      type: 'value',
      name: '%',
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      splitLine: { lineStyle: { color: chartInk.value.gridline } },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: steps.map(step => step.label),
      axisLine: { lineStyle: { color: chartInk.value.baseline } },
      axisTick: { show: false },
      // interval: 0 forces EVERY category to print — ECharts drops labels it thinks will collide,
      // and a waterfall with unlabelled bars is unreadable.
      axisLabel: { interval: 0, color: chartInk.value.muted, fontSize: 16 }
    },
    series: [
      {
        type: 'custom',
        encode: { x: [1, 2], y: 0 },
        renderItem: (_params: unknown, api: {
          value: (index: number) => number
          coord: (point: number[]) => number[]
          size: (value: number[]) => number[]
          style: () => Record<string, unknown>
        }) => {
          const index = api.value(0)
          const from = api.coord([api.value(1), index])
          const to = api.coord([api.value(2), index])
          // A 2px floor on the drawn LENGTH（see waterfallSteps' own comment）keeps a genuinely-zero
          // step from vanishing; `height` is the bar's thickness across the category band.
          const height = api.size([0, 1])[1]! * 0.55
          const left = Math.min(from[0]!, to[0]!)
          const width = Math.max(Math.abs(to[0]! - from[0]!), 2)
          const step = steps[index]
          const text = step ? (step.delta === null ? rateText(step.end) : signedText(step.delta)) : ''
          return {
            type: 'group',
            children: [
              { type: 'rect', shape: { x: left, y: from[1]! - height / 2, width, height }, style: api.style() },
              {
                // Always just past the bar's RIGHT edge, whichever direction the bar runs — a
                // left-running（negative）step then labels at its start rather than its end, which
                // keeps every label on one vertical line instead of zig-zagging with the chain.
                // grid.right below reserves the room this needs outside the plot area.
                type: 'text',
                style: {
                  text,
                  x: left + width + 8,
                  y: from[1]!,
                  textAlign: 'left',
                  textVerticalAlign: 'middle',
                  fill: chartInk.value.primary,
                  font: labelFont
                }
              }
            ]
          }
        },
        data: steps.map((step, index) => ({
          value: [index, step.start, step.end],
          // The three rate bars in the accent colour as the chain's anchors; the steps between them
          // in the muted ink. Direction is NOT carried by colour（no red/green）: a margin step is
          // not a price move, and colouring 減 red would read as a judgement this page doesn't
          // make. Each bar's own signed label plus its vertical position carry the direction.
          itemStyle: { color: step.delta === null ? accent : chartInk.value.secondary }
        }))
      }
    ]
  }
})

const chartOption = computed(() => {
  const list = ascending.value
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { left: 8, right: 16, top: 48, bottom: 28, containLabel: true },
    legend: { top: 0, textStyle: { color: chartInk.value.muted, fontSize: 16 } },
    tooltip: {
      trigger: 'axis',
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
        const entry = list[(Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0]
        if (!entry) return ''
        const rows = RATE_SERIES.map(series => `<div>${series.name}：${rateText(entry.values[series.code]?.value ?? null)}</div>`).join('')
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
    yAxis: {
      type: 'value',
      name: '%',
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      splitLine: { lineStyle: { color: chartInk.value.gridline } },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    series: RATE_SERIES.map((series, index) => ({
      name: series.name,
      type: 'line',
      symbol: series.symbol,
      symbolSize: 8,
      lineStyle: { width: 2, type: series.lineType, color: seriesColors.value[index] },
      itemStyle: { color: seriesColors.value[index] },
      // `connectNulls: false` on purpose — a period with no filed figure leaves a real gap in the
      // line rather than a straight segment implying a value that was never reported.
      connectNulls: false,
      data: list.map(entry => entry.values[series.code]?.value ?? null)
    }))
  }
})
</script>

<template>
  <div v-loading="stockPending" class="stock-margins-page">
    <template v-if="stockPending" />
    <el-result v-else-if="!stock" icon="warning" sub-title="請確認股票代號是否正確">
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-margins-value" :question="`${stockShortName}（${code}）的財報三率分別是多少？`" :answer="valueAnswer">
        <el-card shadow="never" class="stock-margins-page__card">
          <template v-if="hasRates">
            <SharedChart v-if="ascending.length > 1" class="stock-margins-page__chart" :option="chartOption" :init-options="{ renderer: 'svg' }" autoresize />
          </template>
          <p v-else class="stock-margins-page__line">
            目前沒有這檔股票的財報三率資料。三率都以營業收入為分母，銀行與保險業的損益表沒有相同定義的營業收入，因此不會有這組數字。
          </p>
        </el-card>
      </StockQuestionSection>

      <StockQuestionSection v-if="relationAnswer" id="stock-margins-relation" question="三率之間是什麼關係？" :answer="relationAnswer">
        <!-- 瀑布圖 first, the table folded beneath it（2026-09-21,「三率之間是什麼關係section 那邊
             希望用瀑布圖而非表格」）. The table is kept rather than replaced: it is this section's
             only machine-readable and screen-reader-readable form of the same numbers — ECharts
             draws to SVG shapes with no semantics — and check-stock-pages.mjs's own `ssrTables`
             floor exists for exactly that reason. <details> is how the rest of this app parks a
             secondary view（see the document-shape rule: question → answer → one chart, rest in
             closed details）, and its contents are in the SSR HTML whether or not it is open. -->
        <el-card shadow="never" class="stock-margins-page__card">
          <SharedChart class="stock-margins-page__waterfall" :option="waterfallOption" :init-options="{ renderer: 'svg' }" autoresize />
        </el-card>

        <!-- Label sharpened 2026-09-21 after「瀑布圖底下的 看拆解表格 這樣還有意義嗎」— a fair
             question, since the waterfall now prints a signed value beside every bar and a sighted
             reader gets most of the table from the chart alone. It stays, for two reasons that
             have nothing to do with how it looks: ECharts draws to SVG shapes carrying no text
             semantics, so this table is the ONLY form of the decomposition a screen reader can
             read or a crawler can index — and the decomposition is this page's distinct content,
             the whole reason it isn't a thin re-print of the three per-rate pages. What the label
             says now is what a sighted reader actually gains by opening it: the full item names
             (the chart's axis has room for「推銷及管理」, not「推銷及管理費用率」) and the running
             figure at each step rather than just the step's own size. -->
        <details class="stock-margins-page__details">
          <summary>看完整項目名稱與逐列數字</summary>
          <SharedTableScroll :label="`${stockShortName} ${code} 的財報三率拆解`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} {{ latestPeriodText }} 由毛利率逐項減到稅後淨利率（單季，各項均為佔營收比率）</caption>
            <thead>
              <tr>
                <th scope="col">項目</th>
                <th scope="col">佔營收比率</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">毛利率</th>
                <td>{{ rateText(grossMargin) }}</td>
              </tr>
              <template v-if="hasExpenseBreakdown">
                <tr>
                  <th scope="row">減：推銷及管理費用率</th>
                  <td>{{ rateText(expenseRatio) }}</td>
                </tr>
                <tr>
                  <th scope="row">減：研發費用率</th>
                  <td>{{ rateText(rdIntensity) }}</td>
                </tr>
                <tr>
                  <th scope="row">加減：其他營業損益與四捨五入差額</th>
                  <td>{{ signedText(otherOperating) }}</td>
                </tr>
              </template>
              <tr v-else>
                <th scope="row">減：營業費用合計</th>
                <td>{{ rateText(expenseTotal) }}</td>
              </tr>
              <tr>
                <th scope="row">等於：營業利益率</th>
                <td>{{ rateText(operatingMargin) }}</td>
              </tr>
              <tr>
                <th scope="row">加減：業外損益與所得稅</th>
                <td>{{ signedText(nonOperatingAndTax) }}</td>
              </tr>
              <tr>
                <th scope="row">等於：稅後淨利率</th>
                <td>{{ rateText(netProfitMargin) }}</td>
              </tr>
            </tbody>
          </table>
          </SharedTableScroll>
        </details>

        <p class="stock-answer stock-margins-page__links">
          每一率各自的定義、限制與逐期數據：
          <NuxtLink :to="`/stock/${code}/gross-margin`">毛利率</NuxtLink>、
          <NuxtLink :to="`/stock/${code}/operating-margin`">營業利益率</NuxtLink>、
          <NuxtLink :to="`/stock/${code}/net-profit-margin`">稅後淨利率</NuxtLink>。
          原始金額見<NuxtLink :to="`/stock/${code}/income-statement`">損益表</NuxtLink>。
        </p>
      </StockQuestionSection>

      <StockQuestionSection v-if="periods.length" id="stock-margins-history" :question="`${stockShortName}的財報三率歷年怎麼變化？`" :answer="historyAnswer">
        <SharedTableScroll :label="`${stockShortName} ${code} 的財報三率逐期數據`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} 的財報三率（單季）</caption>
            <thead>
              <tr>
                <th scope="col">期別</th>
                <th scope="col">毛利率（%）</th>
                <th scope="col">營業利益率（%）</th>
                <th scope="col">稅後淨利率（%）</th>
                <th scope="col">資料時間</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in periods" :key="`${entry.fiscalYear}-${entry.fiscalQuarter}`">
                <th scope="row">{{ periodLabel(entry) }}</th>
                <td v-for="series in RATE_SERIES" :key="series.code">{{ rateText(entry.values[series.code]?.value ?? null) }}</td>
                <td>{{ entry.values.grossMargin?.knowledgeDate ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>

      <!-- Gated on hasRates, NOT on having a score — see risingAnswer's own comment. A symbol whose
           three rates exist at all gets this section, with 尚無資料 when the evaluation isn't
           backfilled yet. A financial (no 營收 to divide by, so no rates at all) is the one case
           that skips it: the first section already explains why it has no 三率, and a second
           尚無資料 block would be noise rather than a visible gap.
           Placed last on purpose: it is a verdict about the TREND, and the table above is the
           trend it is a verdict about. -->
      <StockQuestionSection v-if="hasRates" id="stock-margins-rising" :question="`${stockShortName}最新一季是三率三升嗎？`" :answer="risingAnswer">
        <el-card shadow="never" class="stock-margins-page__card">
          <p v-if="risingBadge?.badge?.summary" class="stock-answer">{{ risingBadge.badge.summary }}</p>

          <section v-if="risingBadge?.badge?.threshold?.note" class="stock-margins-page__note" aria-labelledby="stock-margins-rising-rule">
            <h3 id="stock-margins-rising-rule" class="stock-margins-page__note-title">判定方式</h3>
            <p class="stock-answer">{{ risingBadge.badge.threshold.note }}</p>
          </section>

          <section v-if="risingBadge?.limitations" class="stock-margins-page__note" aria-labelledby="stock-margins-rising-limits">
            <h3 id="stock-margins-rising-limits" class="stock-margins-page__note-title">限制</h3>
            <p class="stock-answer">{{ risingBadge.limitations }}</p>
          </section>

          <section v-if="risingBadge?.misreadings" class="stock-margins-page__note" aria-labelledby="stock-margins-rising-misreadings">
            <h3 id="stock-margins-rising-misreadings" class="stock-margins-page__note-title">常見誤讀</h3>
            <p class="stock-answer">{{ risingBadge.misreadings }}</p>
          </section>

          <p v-if="risingBadge?.badge?.author" class="stock-margins-page__line">出處：{{ risingBadge.badge.author }}</p>
          <p v-if="risingBadge?.badge?.sourceUrl" class="stock-margins-page__line">
            <a :href="risingBadge.badge.sourceUrl" target="_blank" rel="noopener noreferrer">三率三升的公開說明（另開新視窗）</a>
          </p>
        </el-card>
      </StockQuestionSection>
    </template>
  </div>
</template>

<style scoped>
.stock-margins-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-margins-page__chart {
  width: 100%;
  height: 320px;
}

/* One row per waterfall step, seven of them, each needing a full 16px label line plus its bar —
   so this is sized from the row count rather than reusing the line chart's height above. */
.stock-margins-page__waterfall {
  width: 100%;
  height: 400px;
}

.stock-margins-page__details {
  margin-top: 16px;
}

/* ≥48px target for the disclosure toggle, this app's own floor — a <summary> is a real button to
   every browser but gets no size from the UA beyond its text's own line box. */
.stock-margins-page__details > summary {
  display: flex;
  align-items: center;
  min-height: 48px;
  cursor: pointer;
}

.stock-margins-page__line {
  margin: 0;
}

.stock-margins-page__links {
  margin-top: 16px;
}

.stock-margins-page__note + .stock-margins-page__note,
.stock-answer + .stock-margins-page__note {
  margin-top: 16px;
}

.stock-margins-page__note-title {
  margin: 0 0 4px;
  font-size: 1rem;
}
</style>
