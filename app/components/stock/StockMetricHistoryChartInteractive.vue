<script setup lang="ts">
import { getPriceColors } from '~/utils/chart-palette'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { LookbackWindow } from '~/utils/lookback-window'
import { computeGaugeStats, gaugeBandLabel } from '~/utils/percentile'
import { formatSignificantDigits } from '~/utils/format-significant-digits'
import { compositionRow } from '#shared/utils/metric-composition'

use([SVGRenderer, BarChart, GridComponent, TooltipComponent])

// The 目前值 chart for metric pages specifically（2026-09-21, direct request「el-card is-never-
// shadow stock-metric-page__card 卡片要可以切換單季或是近四季，期間要可以選1235年」, clarified the
// same day「不是每個卡片都要用TTM，但是都要可以選擇1235年」）— a separate component from
// StockMetricHistoryChart.vue (badge pages, unchanged) rather than retrofitting reactivity onto
// that already-shipped one; see that file's own comment. The two share option-building via
// useMetricHistoryChartOption.ts.
//
// 單季/近四季 toggle only renders when the metric genuinely offers both — `availableTimeframes`
// comes from the metric's own live catalog entry (GET /metrics' own `fields`), never assumed from
// the metricCode's name, matching「不是每個卡片都要用TTM」: a metric whose only real basis is TTM
// (or only Q) shows no toggle at all rather than one with a single, pointless option.
//
// Fetches reactively via useMetricsHistory (the composable every OTHER lookback-window card in
// this app already uses — StockHistoricalStatisticsTable.vue's own comment documents the same
// pattern), not the server route StockMetricDetailPage.vue itself calls for its initial SSR
// render. The parent pre-warms this composable's own cache (useStockPageDigest.ts's own prewarm()
// is the precedent) from that SSR fetch so the DEFAULT state (defaultTimeframe, 近5年) still
// renders real content in the server HTML — only a state the visitor actually switches to costs a
// fresh client request.
const props = defineProps<{
  symbol: string
  metricCode: string
  topic: string
  unit: string
  defaultTimeframe: MetricsHistoryTimeframe
  availableTimeframes: MetricsHistoryTimeframe[]
  // 有成分就把這張圖畫成堆疊柱（2026-09-28「operating-expense 是不是把第一個圖表的柱狀圖直接替換成
  // stackedbar 就好?」）。同一頁本來有兩張圖畫同一個數列的輪廓——上面一根柱子、下面同一根柱子分成三段。
  //
  // 做成「這張圖多一個模式」而不是「用下面那張取代上面這張」，是因為上面這張帶著基準（單季／近四季／
  // 年度）與回看視窗（近 5／8／10 年、自訂區間）兩組控制項，那是 2026-09-21 的直接要求；直接換掉會
  // 把它們一起丟掉。所以成分跟著 codesRef 一起抓，切基準時成分也跟著換。
  //
  // 恆等式不成立的期別不會消失，改畫成一根「未拆解」的中性灰柱子——總額是真的，只是拆不開。實測
  // 抽 124 檔：93% 全期都拆得開、5% 只有一部分、2% 一期都拆不開，所以直接換掉會讓那 2% 的頁面完全
  // 沒有圖。
  partCodes?: string[]
  // 成分的顯示名稱，由呼叫端從型錄取（這個元件不碰型錄）。
  partNames?: string[]
}>()

const TIMEFRAME_TOGGLE_LABEL: Record<MetricsHistoryTimeframe, string> = { TTM: '近四季', Q: '單季', FY: '年度' }
// Stable order regardless of what order the catalog happens to list `fields` in.
const timeframeOptions = computed(() => (['TTM', 'Q', 'FY'] as const).filter(tf => props.availableTimeframes.includes(tf)))

// Local, not shared useState — a "which basis" choice is metric-specific (not every metric even
// offers the same set), unlike the window below which is a general per-visitor preference. Resets
// correctly on its own since each metric page mounts its own instance of this component.
const timeframe = ref<MetricsHistoryTimeframe>(props.defaultTimeframe)
const window = useMetricHistoryChartWindow()

const symbolRef = computed(() => props.symbol)
const codesRef = computed(() => [props.metricCode, ...(props.partCodes ?? [])])
// Always the full series（bff-ts caps limit at 40 and `total` never exceeds 24）rather than the
// window's own length. Two reasons, and the second is the feature: the metric page already
// server-fetches 40 periods and registers a superset, so every window projects from it client-side
// without a refetch; and holding every period means a custom range is a slice, not a request.
const FULL_HISTORY_LIMIT = 40
const limit = computed(() => FULL_HISTORY_LIMIT)
const { data, total, pending } = useMetricsHistory(symbolRef, codesRef, timeframe, limit)

const insufficientYears = computed(() => insufficientLookbackYears(total.value))
// Shown INSTEAD of the chart when the chosen window reaches further back than this company goes.
// Selecting such a window is allowed on purpose — see SharedLookbackWindowSelect's own note.
const shortfall = computed(() =>
  !customActive.value && insufficientYears.value.includes(LOOKBACK_WINDOW_YEARS[window.value])
    ? lookbackShortfallText(window.value, total.value)
    : null
)

// 「你連年數都不給我看，那我就是在賭，我不賭」— a reader could see 近10年 greyed out and had no way
// to tell whether that is this company's age or our gap. `total` was already fetched and used to
// DISABLE the options; it was simply never shown. This states it.
//
// It matters more now than when it was asked for: depth is per symbol, not per site（2330 has 24
// quarters, 8069 has 10, 6916 has 8）, and bff-ts traced the cause — each company's ceiling is
// where its 股本歷史 starts, since a per-share figure needs a share count. So the number is a fact
// about the company, not a number we are hiding.
//
// Floored, never rounded up: 23 quarters is 5.75 years and reads as 5, because overstating coverage
// is the failure this line exists to prevent. Sits with the window selector rather than under the
// chart — it explains a CONTROL（why an option is disabled）, not the picture, which is the line
//「圖表不配說明文字」draws.
const coverageText = computed(() => {
  const periods = total.value
  if (periods === null || periods <= 0) return null
  const years = Math.floor(periods / 4)
  return years >= 1 ? `本站共 ${periods} 季（約 ${years} 年）` : `本站共 ${periods} 季`
})

const allPoints = computed(() =>
  (data.value ?? [])
    .map(entry => ({
      fiscalYear: entry.fiscalYear,
      fiscalQuarter: entry.fiscalQuarter,
      value: entry.values[props.metricCode]?.value ?? null,
      // 挑期別的規則跟組成表共用同一支（shared/utils/metric-composition.ts），所以圖與表不會各自
      // 判斷一次而給出不同的期別集合。
      parts: compositionRow({
        parent: entry.values[props.metricCode]?.value ?? null,
        parts: (props.partCodes ?? []).map(code => entry.values[code]?.value ?? null)
      })?.parts ?? null
    }))
    .filter((entry): entry is typeof entry & { value: number } => entry.value !== null)
)

// 自訂區間（2026-09-25,「如果要納入可以自選時間日期區間」）. Quarters, not dates: the data IS
// quarterly, so a day-level picker would offer a precision that does not exist — picking 2024-03-17
// and 2024-03-01 return the same thing, and an elderly reader concludes they mis-clicked.
//
// The two dropdowns list ONLY periods this symbol actually has, and 到 is filtered to 從 or later.
// So neither「這段沒有資料」nor a reversed range can be expressed at all — the burden a range
// control usually carries is the possibility of being wrong, and this removes it by construction
// rather than by validation. No calendar popup either: a stacked layer is the thing ext-03 ranked
// fifth on his elder-friendly list（「看到兩層疊起來就卡住，然後打電話給我」）.
const periodKey = (entry: { fiscalYear: number; fiscalQuarter: number }) => `${entry.fiscalYear}Q${entry.fiscalQuarter}`
const periodLabel = (key: string) => key.replace('Q', ' Q')

const customOpen = ref(false)
const customFrom = ref<string | null>(null)
const customTo = ref<string | null>(null)

const periodOptions = computed(() => allPoints.value.map(periodKey))
const toOptions = computed(() => {
  const from = customFrom.value
  return from === null ? periodOptions.value : periodOptions.value.filter(key => key >= from)
})

const customActive = computed(() => customOpen.value && customFrom.value !== null && customTo.value !== null)

// Opening prefills the range the reader is already looking at, so the chart never blanks on the
// way in — switching a control should not cost you the view you had.
function openCustom() {
  customOpen.value = true
  const shown = windowPoints.value
  customFrom.value = shown.length ? periodKey(shown[0]!) : (periodOptions.value[0] ?? null)
  customTo.value = shown.length ? periodKey(shown[shown.length - 1]!) : (periodOptions.value.at(-1) ?? null)
}

watch(customFrom, from => {
  if (from !== null && customTo.value !== null && customTo.value < from) customTo.value = from
})

const windowPoints = computed(() => allPoints.value.slice(-LOOKBACK_WINDOW_YEARS[window.value] * 4))

const points = computed(() => {
  if (!customActive.value) return windowPoints.value
  return allPoints.value.filter(entry => {
    const key = periodKey(entry)
    return key >= customFrom.value! && key <= customTo.value!
  })
})

const customSummary = computed(() =>
  customActive.value ? `已選 ${periodLabel(customFrom.value!)} 到 ${periodLabel(customTo.value!)}，共 ${points.value.length} 季` : null
)

// WHERE THIS NUMBER SITS IN ITS OWN HISTORY（2026-09-24,「我希望每個指標都跟 monthly-revenue 一樣，
// 跟某個東西相比以後特別顯得有用」, then「跟自己的過去比」and「只講位置，不做評價」）.
//
// Every single-metric page drew one series and left the reader with no way to tell whether the
// latest figure is high or low for THIS company. The comparison is the company's own record, not
// a peer median and not the share price: shared/types/stock-solvency-page.ts records the standing
// rule that a merely CORRELATED pairing（a fundamental against 股價）implies a claim about the
// company, with 月營收 × 股價 as the one accepted exception. A percentile over the company's own
// filed numbers asserts nothing — it is the same kind of statement as 安全韌性's subtraction chain.
//
// Nothing here is new machinery. app/utils/percentile.ts and SharedPercentileGaugeExpand.vue were
// both extracted for exactly this question（that component's own comment:「where does this single
// value sit in its own history/peer range」）and until now reached only peRatio and pbRatio, via
// the digest. This wires the same two to the other 17 metric pages.
//
// It lives in THIS component rather than the page because the window and basis selectors are
// here. A gauge computed from the page's own SSR series would keep describing 20 quarters after
// the reader switched the chart to 8.
//
// 8 periods, measured rather than picked: across all 19 metric pages × 6 symbols（114 pairs that
// returned data）8 keeps 89% of them, 4 would keep 92% and 10 only 80% — the curve is flat below
// 8 and starts costing above it. Below the floor the gauge does not render at all, rather than
// placing a value among three or four points and calling the result a percentile. Counted on
// non-null periods, since a period with no filed figure is not a value.
const MIN_GAUGE_PERIODS = 8

const gaugeStats = computed(() => {
  // `points` is ascending（the chart draws it left to right）, so the newest figure is last.
  const values = points.value.map(point => point.value)
  if (values.length < MIN_GAUGE_PERIODS) return null
  return computeGaugeStats(values, values[values.length - 1] ?? null)
})

const PERIOD_WORD: Record<MetricsHistoryTimeframe, string> = { TTM: '季', Q: '季', FY: '年' }

const gaugeValueText = computed(() =>
  gaugeStats.value ? `${props.topic} ${formatSignificantDigits(gaugeStats.value.current, 3)}${props.unit}` : ''
)

// States the ACTUAL period count, never a rounded「近5年」— the window selector can be on 近5年
// while the company only filed 13 of those quarters, and the sentence has to be true of what was
// measured. The band label comes from percentile.ts, whose own comment records why it is worded
// as three statistical ranges and never as 便宜/合理/昂貴.
const gaugePercentileText = computed(() => {
  const stats = gaugeStats.value
  if (!stats) return ''
  return `近 ${points.value.length} ${PERIOD_WORD[timeframe.value]}第 ${Math.round(stats.currentPercentile)} 百分位（${gaugeBandLabel(stats)}）`
})

// The bar is fed the PERCENTILE（0–100）rather than the raw value, so the marker's own linear
// position IS the percentile by construction. StockDividendYieldPercentileCard.vue's comment
// records why that matters: the marker interpolates linearly between min and max, so a skewed
// window puts it nowhere near where the stated percentile reads. Labelling the two ends with the
// window's real lowest and highest figure is exactly correct under that scale — percentile 0 IS
// the minimum and 100 IS the maximum.
function formatGaugeScale(value: number): string {
  const stats = gaugeStats.value
  if (!stats) return ''
  return `${formatSignificantDigits(value === 0 ? stats.min : stats.max, 3)}${props.unit}`
}

// 量尺改成綠→紅而不是強調色的深淺（2026-09-27「從綠色每個線段跳到紅色」）。元件註解裡本來就有
// 一條「量尺的顏色還是要紅綠配色，而且要與漲跌顏色綁定」的既有指示，當時只套在河流圖那個採用者
// 身上，這裡補齊，兩個呼叫端因此一致。
// 紅代表數值高不代表好：台股慣例紅＝漲＝多，所以編的是量級不是評價——EPS 高是紅、負債比高也是紅。
const { resolvedMode, market } = useAppTheme()
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))

// 堆疊模式（partCodes 有值時）。層的順序由**最新一期拆得開的那一筆**的大小決定，圖與下面的組成表
// 共用同一個順序——兩邊各自排序的話，讀者在圖上找到的第一層在表上會是第三欄。
const UNSPLIT = '未拆解'
const stacked = computed(() => {
  const names = props.partNames ?? []
  if (!props.partCodes?.length || !names.length || points.value.length < 2) return null
  const usable = [...points.value].reverse().find(point => point.parts)
  if (!usable) return null
  const order = names.map((_, i) => i).sort((a, b) => Math.abs(usable.parts![b]!) - Math.abs(usable.parts![a]!))
  // 全期都是 0 的成分不畫（2330 的每股預期信用減損在每一期都是 0）。
  const shown = order.filter(i => points.value.some(point => point.parts && point.parts[i] !== 0))
  if (!shown.length) return null
  const layers = shown.map(i => ({ name: names[i]!, values: points.value.map(point => point.parts?.[i] ?? 0) }))
  // 拆不開的期別：成分全部 0，總額整根放進中性層。這一層完全是 0 的話就不加，否則 93% 的公司會多
  // 一個永遠空白的圖例。
  const unsplit = points.value.map(point => (point.parts ? 0 : point.value))
  if (unsplit.some(value => value !== 0)) layers.push({ name: UNSPLIT, values: unsplit })
  return { categories: points.value.map(point => periodLabel(periodKey(point))), layers }
})

const stackedTooltipHeader = (index: number): string => {
  const point = points.value[index]
  return point ? `${periodLabel(periodKey(point))} 合計 ${formatSignificantDigits(point.value, 3)}${props.unit}` : ''
}

const { chartOption } = useMetricHistoryChartOption(
  points,
  computed(() => props.topic),
  computed(() => props.unit),
  timeframe
)

// Picking a fixed window leaves 自訂 rather than sitting beside it. Both controls were live at once
// for a few minutes and the corner read「近5年」while the chart drew 18 季 — two controls each
// claiming to be the one in effect, which the reader has no way to resolve. Closing on selection is
// gentler than disabling the window select while 自訂 is open: nothing is taken away, the two simply
// cannot both be true.
function handleWindowChange(value: LookbackWindow) {
  window.value = value
  customOpen.value = false
}
</script>

<template>
  <div class="stock-metric-history-chart-interactive">
    <!-- Corner-positioned against the ancestor card, not this div — see
         StockMetricDetailPage.vue's own .stock-metric-page__card comment（「lookback-window-select
         請放在卡片右上角」）. TTM/單季 sits to its LEFT inside the same corner group, per direct
         follow-up（「每個卡片 近五年的左邊要有選項選擇 TTM 或是 單季」）— one group, not two separate
         rows, with the toggle first in source/visual order. -->
    <div class="stock-metric-history-chart-interactive__corner">
      <el-radio-group v-if="timeframeOptions.length > 1" v-model="timeframe" aria-label="期別（單季或近四季）">
        <el-radio-button v-for="tf in timeframeOptions" :key="tf" :value="tf">{{ TIMEFRAME_TOGGLE_LABEL[tf] }}</el-radio-button>
      </el-radio-group>
      <SharedLookbackWindowSelect
        :model-value="window"
        :insufficient-years="insufficientYears"
        custom-label="自訂區間…"
        :custom-active="customOpen"
        @update:model-value="handleWindowChange"
        @custom="openCustom"
      />
    </div>
    <!-- No expand toggle: the detail it would reveal is the chart, which is already right below.
         A neutral single-hue ramp, NOT the up/down pair StockDividendYieldPercentileCard passes —
         red-to-green would say a high value is good, which is false for 負債比率 and is a verdict
         either way（「只講位置，不做評價」）. -->
    <SharedPercentileGaugeExpand
      v-if="gaugeStats"
      :show-toggle="false"
      :expanded="false"
      :current="gaugeStats.currentPercentile"
      :min="0"
      :max="100"
      :value-text="gaugeValueText"
      :percentile-text="gaugePercentileText"
      :format-scale-value="formatGaugeScale"
      :gradient-from="priceColors.down"
      :gradient-to="priceColors.up"
    />
    <!-- Needs ≥2 bars to read as a trend at all; a single-period window (or a fetch that hasn't
         resolved yet) renders nothing rather than a one-bar chart. -->
    <SharedEmptyState v-if="shortfall" :description="shortfall" />
    <StockStackedBarChart
      v-else-if="stacked"
      v-loading="pending"
      class="stock-metric-history-chart-interactive__chart"
      :categories="stacked.categories"
      :layers="stacked.layers"
      :unit="unit"
      :neutral-layer-name="UNSPLIT"
      :tooltip-header="stackedTooltipHeader"
    />
    <SharedChart v-else-if="points.length > 1" v-loading="pending" class="stock-metric-history-chart-interactive__chart" :option="chartOption" :init-options="{ renderer: 'svg' }" autoresize />
    <SharedEmptyState v-else-if="!pending" description="這個期間沒有足夠的資料可以畫圖" />
    <!-- 2026-09-26：左下角原本有一個「自訂區間／改用固定區間」切換鈕，跟右上角的區間下拉在做同一件事
         （都是在選要看哪一段期間），卻放在畫面的對角線兩端——使用者回報「邏輯重疊了」。現在自訂是下拉
         裡的最後一個選項，選期間這件事只有一個入口。

         從／到兩個下拉仍然留在圖下方：它們需要橫向空間，右上角那個角落放不下，而且它們是「打開之後」
         的內容不是入口。入口只有一個，這就是重疊消失的地方。

         Real <button>, speakable labels「從」「到」, no icon-only控制 — ext-03's own list
         （「畫面每一塊要能用嘴巴指」）. -->
    <div class="stock-metric-history-chart-interactive__footer">
      <p v-if="coverageText" class="stock-metric-history-chart-interactive__coverage">{{ coverageText }}</p>
    </div>

    <div v-if="customOpen" class="stock-metric-history-chart-interactive__custom">
      <label class="stock-metric-history-chart-interactive__custom-field">
        <span>從</span>
        <el-select v-model="customFrom" size="default" class="stock-metric-history-chart-interactive__custom-select">
          <el-option v-for="key in periodOptions" :key="key" :label="periodLabel(key)" :value="key" />
        </el-select>
      </label>
      <label class="stock-metric-history-chart-interactive__custom-field">
        <span>到</span>
        <el-select v-model="customTo" size="default" class="stock-metric-history-chart-interactive__custom-select">
          <el-option v-for="key in toOptions" :key="key" :label="periodLabel(key)" :value="key" />
        </el-select>
      </label>
      <p v-if="customSummary" class="stock-metric-history-chart-interactive__custom-summary">{{ customSummary }}</p>
    </div>
  </div>
</template>

<style scoped>
.stock-metric-history-chart-interactive__footer {
  /* 自訂區間的切換鈕 2026-09-26 移進右上角的下拉之後，這裡只剩涵蓋期間那一行，所以不再需要
     space-between——留著會讓那一行在寬螢幕上莫名其妙地靠左。 */
  margin-top: 8px;
}

.stock-metric-history-chart-interactive__custom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}

.stock-metric-history-chart-interactive__custom-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  color: var(--el-text-color-regular);
}

.stock-metric-history-chart-interactive__custom-select {
  width: 9.5em;
}

.stock-metric-history-chart-interactive__custom-summary {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

/* Phone: the two dropdowns stack instead of squeezing side by side. */
@media (max-width: 480px) {
  .stock-metric-history-chart-interactive__custom {
    flex-direction: column;
    align-items: stretch;
  }

  .stock-metric-history-chart-interactive__custom-select {
    width: 100%;
  }
}

/* In normal flow under the chart, NOT in the corner group with the control it explains — which is
   where it was first put, and it overlapped the bars on any symbol short enough to suppress the
   percentile gauge（MIN_GAUGE_PERIODS = 8, so 6916's 7 quarters). The corner is absolutely
   positioned, so a wrapped line inside it has nothing to push. Invisible on 2330, which has the
   gauge holding that space open. */
.stock-metric-history-chart-interactive__coverage {
  margin: 0;
  text-align: right;
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.stock-metric-history-chart-interactive {
  margin-top: 12px;
}

.stock-metric-history-chart-interactive__corner {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

/* 「radio select 高度不同 希望可以讓他看起來不突兀」(2026-09-21). The two controls' OUTER boxes
   already measured the same 32px and sat on the same top edge — what differed was the chrome a
   reader actually sees: el-select draws its border on .el-select__wrapper, which fills that 32px,
   while el-radio-button draws its own pill on .el-radio-button__inner, which Element Plus sizes
   from padding alone and which measured 26px. So two bordered boxes side by side, one 6px shorter
   than the other. Measured rather than eyeballed, which is why the fix is on the INNER element —
   setting a height on the group itself would have changed nothing visible.

   :deep() because both targets live inside Element Plus's own markup, not this component's. */
.stock-metric-history-chart-interactive__corner :deep(.el-radio-button__inner) {
  display: inline-flex;
  align-items: center;
  height: 32px;
}

/* Clearance for the corner controls, which are absolutely positioned against the CARD — so they
   overlap whatever the card's first child happens to be, and as of 2026-09-24 that is the gauge
   （reported:「debt-ratio 右上角的select與圖表有文字遮蓋」）. The gauge's percentile text is flush
   right, by the shared component's own `justify-content: space-between`, which put it straight
   under the select.
   Measured rather than guessed, at 1280 and 375: the corner sits at y=13 and is 32px tall, so its
   bottom edge is 45px down, while the gauge's first row started at 29px. 28px of padding (up from
   the component's own 4px) moves it to 53px — 8px clear. The widest corner is 262px (basis toggle
   plus window select) and still fits one row at 375px, so one row is the case to clear.
   Padding on the GAUGE, not a margin on this whole component: the chart alone never needed the
   clearance（it has its own top space）and a metric under the 8-period floor renders no gauge at
   all, so nothing should move for it. */
.stock-metric-history-chart-interactive :deep(.percentile-gauge) {
  padding-top: 28px;
}

.stock-metric-history-chart-interactive__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

/* Same fixed height StockDividendYieldPercentileCard.vue's own chart uses — this app's other
   SharedChart consumer, kept for a consistent chart footprint rather than a one-off value here. */
.stock-metric-history-chart-interactive__chart {
  height: 15rem;
  width: 100%;
  margin-top: 12px;
}
</style>
