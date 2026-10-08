<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { LookbackWindow } from '~/utils/lookback-window'
import { formatSignificantDigits } from '~/utils/format-significant-digits'
import { compositionRow } from '#shared/utils/metric-composition'
import type { LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'

use([SVGRenderer, BarChart, GridComponent, TooltipComponent])

// 指標頁的目前值圖表（2026-09-21，「卡片要可以切換單季或是近四季，期間要可以選1235年」；同日澄清「不是每個卡片都要用TTM，
// 但是都要可以選擇1235年」）。徽章頁 2026-09-29 起也用這一張（StockBadgeDetailPage），靜態版已刪。選項組裝在
// useMetricHistoryChartOption。
// 單季／近四季切換只在指標真的兩種都有時出現——`availableTimeframes` 來自型錄（GET /metrics 的 `fields`），不從 metricCode 的
// 名字猜；只有一種期別的指標不顯示只有一個選項的切換。
// 資料走 useMetricsHistory（全站回溯窗卡片共用的 composable），不是 StockMetricDetailPage 做 SSR 用的伺服器路由；父層用 SSR
// 的結果預熱這個 composable 的快取（同 useStockPageDigest 的 prewarm()），預設狀態（defaultTimeframe、近5年）在伺服器 HTML
// 裡就有內容，只有訪客真的切換到的狀態才多一次瀏覽器請求。
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
  // 一起畫的第二支指標（METRIC_PAGES／BADGE_PAGES 的 compareMetricCode）。**由我們決定，沒有選單。**
  // 2026-09-29 一度做成讓讀者自選的下拉：候選是型錄裡所有同單位的指標，於是毛利率頁列出 33 項、
  // 負債比率頁列出 41 項，裡面大半是這家公司根本沒有的（2330 也選得到銀行專用的資本適足率）。
  // 使用者的判斷是「很混淆難用，哪一支放在一起看有價值我們決定就好」，所以整個選單刪掉。
  // 配對本身是策展決定，理由寫在 registry 那一筆的註解裡。
  compareMetricCode?: string
  // 對照指標支援的期別。**給了 compareMetricCode 就一定要給這個**，否則切到對照指標沒有的期別時，
  // 整個請求會 400、連主指標的線都不會畫（實測：/roe 切「年度」時送 roe,roa，而 roa 只有 Q/TTM，
  // bff 回「roa.FY 不是可查詢的欄位」，於是圖空白、total 變 null、區間選項全部誤開）。
  // 由呼叫端從型錄取，不在這裡自己打 useFilterSchema——那支是共用 key 的 useAsyncData，
  // 多個同時掛載的子元件各自呼叫會卡在初始值（見 useFilterSchema 的註解）。
  compareTimeframes?: MetricsHistoryTimeframe[]
  // 對照指標的顯示名稱，由呼叫端從型錄取（這個元件不碰型錄）。
  compareName?: string
}>()

// Stable order regardless of what order the catalog happens to list `fields` in.
const timeframeOptions = computed(() => (['TTM', 'Q', 'FY'] as const).filter(tf => props.availableTimeframes.includes(tf)))

// Local, not shared useState — a "which basis" choice is metric-specific (not every metric even
// offers the same set), unlike the window below which is a general per-visitor preference. Resets
// correctly on its own since each metric page mounts its own instance of this component.
const timeframe = ref<MetricsHistoryTimeframe>(props.defaultTimeframe)
const window = useMetricHistoryChartWindow()

const symbolRef = computed(() => props.symbol)
// 對照指標只在**它自己也有這個期別**時才一起查。沒給 compareTimeframes 就當成只有主指標的期別可用，
// 寧可少畫一條線，也不要讓一個 400 把整張圖連帶弄掉。
const compareCode = computed(() => {
  const code = props.compareMetricCode
  if (!code) return null
  const supported = props.compareTimeframes ?? props.availableTimeframes
  return supported.includes(timeframe.value) ? code : null
})

const codesRef = computed(() => [
  props.metricCode,
  ...(props.partCodes ?? []),
  ...(compareCode.value ? [compareCode.value] : [])
])
// Always the full series（bff-ts caps limit at 40 and `total` never exceeds 24）rather than the
// window's own length. Two reasons, and the second is the feature: the metric page already
// server-fetches 40 periods and registers a superset, so every window projects from it client-side
// without a refetch; and holding every period means a custom range is a slice, not a request.
const FULL_HISTORY_LIMIT = 40
const limit = computed(() => FULL_HISTORY_LIMIT)
const { data, total, pending } = useMetricsHistory(symbolRef, codesRef, timeframe, limit)

// 每年幾期，**從實際抓到的期別推算，不寫死 4**（2026-10-01）。寫死 4 在兩種情況下都錯，而且第二種
// 比第一種常見得多：
//
//   年度（FY）基準：一年一期。2330 的 roe FY 有 2019~2025 共 7 期，寫死 4 的話「近5年」要 20 期
//     ⇒ 近5年／近8年／近10年全部被 disable，而這家公司明明有七個完整年度。FY 是 2026-10-01 才開放
//     選的，所以這個 bug 跟那個選項同齡。**這一條影響每一家上市櫃公司**。
//   興櫃公司：依法只申報半年報與年報，近一年只有 2 期（實測 1293 的 roe TTM 是 13 期 / 8 年，期別
//     只有 Q2、Q4）。寫死 4 的話「近5年」實際切到約 10 年、「近10年」永遠開不了（13 期到不了 40）。
//
// 推算方式是「出現過的期別數」而不是「期數 ÷ 年數」：後者會被最新那個未完成的年度拉低（2330 的
// 25 期 / 8 年 = 3.1，四捨五入成 3，錯）。出現過的期別數對三種情況都對：上市櫃 {Q1..Q4}=4、
// 興櫃 {Q2,Q4}=2、年度 {Q4}=1。
//
// 不到兩個年度就不推算、維持季頻假設：剛上市的公司只有 Q1、Q2 兩期時，期別數是 2 但它其實是季頻，
// 推算會把半年當成一年。兩個年度之後才看得出真正的申報頻率。
const periodsPerYear = computed(() => {
  const entries = data.value ?? []
  if (new Set(entries.map(entry => entry.fiscalYear)).size < 2) return 4
  return new Set(entries.map(entry => entry.fiscalQuarter)).size || 4
})

const insufficientYears = computed(() => insufficientLookbackYears(total.value, periodsPerYear.value))
// 讀者選的區間收斂成這一檔填得滿的最大區間；null＝連一年都沒有。見 lookback-window.ts 的註解。
const fittedWindow = computed(() => fitLookbackWindow(window.value, total.value, periodsPerYear.value))
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
// 單位詞跟著申報頻率走：季頻說「季」，興櫃的半年報說「半年」，年度基準說「年度」。原本一律寫
// 「季」，所以年度基準會寫成「共 7 季」、興櫃會把半年期間叫成季——兩個都是在讀者看得見的地方
// 把一個期間說成另一種期間。
const PERIOD_WORD: Record<number, string> = { 4: '季', 2: '半年', 1: '年度' }
const coverageText = computed(() => {
  const periods = total.value
  if (periods === null || periods <= 0) return null
  const word = PERIOD_WORD[periodsPerYear.value] ?? '期'
  // 年度基準不加括號：「共 7 年度（約 7 年）」把同一件事說了兩次。
  if (periodsPerYear.value === 1) return `本站共 ${periods} ${word}`
  const years = Math.floor(periods / periodsPerYear.value)
  return years >= 1 ? `本站共 ${periods} ${word}（約 ${years} 年）` : `本站共 ${periods} ${word}`
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

// Shown INSTEAD of the chart when the chosen window reaches further back than this company goes.
// Selecting such a window is allowed on purpose — see SharedLookbackWindowSelect's own note.
const shortfall = computed(() => {
  // 這個期別一期都沒有值（請求成功、entries 回來了、但值全是 null）。興櫃公司的單季就是這種：
  // 他們依法只申報半年報與年報，所以單季**永久**是空的，不是還沒回填。期別切換鈕是從型錄長出來的，
  // 而型錄說的是「這支指標有哪些期別」不是「這家公司有哪些期別」，所以按鈕擋不掉——改在這裡說明白。
  //
  // 「這類公司沒有這個數字」跟「尚無資料」對讀者的意思完全不同（analysis-ts 2026-10-01 也是這樣要求
  // 的）：前者不會讓人再回來看一次。
  if (!customActive.value && allPoints.value.length === 0 && (data.value?.length ?? 0) > 0) {
    return `這家公司沒有${props.topic}的${TIMEFRAME_WORD[timeframe.value]}數字。`
  }
  return !customActive.value && fittedWindow.value === null ? lessThanAYearText(total.value) : null
})

// 自訂區間（2026-09-25,「如果要納入可以自選時間日期區間」）. Quarters, not dates: the data IS
// quarterly, so a day-level picker would offer a precision that does not exist — picking 2024-03-17
// and 2024-03-01 return the same thing, and an elderly reader concludes they mis-clicked.
//
// The two dropdowns list ONLY periods this symbol actually has, and 到 is filtered to 從 or later.
// So neither「這段沒有資料」nor a reversed range can be expressed at all — the burden a range
// control usually carries is the possibility of being wrong, and this removes it by construction
// rather than by validation. No calendar popup either: a stacked layer is the thing ext-03 ranked
// fifth on his elder-friendly list（「看到兩層疊起來就卡住，然後打電話給我」）.
const periodKey = (entry: { fiscalYear: number; fiscalQuarter: number | null }) => `${entry.fiscalYear}Q${entry.fiscalQuarter}`
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

const windowPoints = computed(() =>
  allPoints.value.slice(-LOOKBACK_WINDOW_YEARS[fittedWindow.value ?? window.value] * periodsPerYear.value)
)

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

// 量尺（百分位）2026-09-30 依直接指示刪除：「只要折線圖符合以下規範，沒有必要一定得出量尺」。
// 規範是高齡友善介面的線條規格——折線 ≤ 2 條、線寬 ≥ 2.5px、轉折點 ≥ 8px 實心標記——而這張圖的
// 兩種折線模式都已經照這個做（見 StockMultiSeriesLineChart）。位置資訊留在圖上，不另外畫一條尺。
//
// 連帶刪掉的：gaugeStats／gaugeValueText／gaugePercentileText／formatGaugeScale／priceColors，
// 以及 utils/percentile.ts 的 import。percentile.ts 本身留著，stock-digest.ts 還在用。

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

// 兩條線的資料。points 已經是這一頁自己的視窗與基準過濾後的結果，對照那一支直接從同一批 entries
// 取——兩條線因此必然來自同一次請求、同一個期別集合，不會出現「一條到 2026Q2、另一條到 2026Q1」。
const compareEntries = computed(() => {
  const source = data.value ?? []
  const shown = new Set(points.value.map(point => `${point.fiscalYear}Q${point.fiscalQuarter}`))
  return source.filter(entry => shown.has(`${entry.fiscalYear}Q${entry.fiscalQuarter}`))
})

// 對照那一支在這家公司身上、在目前這個基準下實際有值的期別。策展的配對也不保證每家公司都有
// （銀行沒有存貨相關的指標、有些基準只有單季），而一條全空的線比不畫更難解釋——讀者會當成 0。
// 所以少於兩點就退回原本的柱狀圖，並在答句的位置說一句為什麼。
const comparePoints = computed(() =>
  compareCode.value === null ? [] : compareEntries.value.filter(entry => entry.values[compareCode.value!]?.value != null)
)

// ramp（五階綠→紅漸層）而不是 accent：對照指標依定義同單位，兩條線之間有可比的大小關係，
// 那正是 StockMultiSeriesLineChart 自己的註解說 ramp 該用在哪裡的情況。
const compareSeries = computed<LineSeriesSpec[]>(() => [
  { code: props.metricCode, name: props.topic, lineType: 'solid', symbol: 'circle' },
  { code: compareCode.value ?? '', name: props.compareName ?? '', lineType: 'dashed', symbol: 'triangle' }
])

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
      <el-radio-group v-if="timeframeOptions.length > 1" v-model="timeframe" aria-label="期別">
        <el-radio-button v-for="tf in timeframeOptions" :key="tf" :value="tf">{{ TIMEFRAME_WORD[tf] }}</el-radio-button>
      </el-radio-group>
      <SharedLookbackWindowSelect
        :model-value="fittedWindow ?? window"
        :insufficient-years="insufficientYears"
        custom-label="自訂區間…"
        :custom-active="customOpen"
        @update:model-value="handleWindowChange"
        @custom="openCustom"
      />
    </div>
    <!-- Needs ≥2 bars to read as a trend at all; a single-period window (or a fetch that hasn't
         resolved yet) renders nothing rather than a one-bar chart. -->
    <SharedEmptyState v-if="shortfall" :description="shortfall" />
    <StockMultiSeriesLineChart
      v-else-if="comparePoints.length > 1"
      v-loading="pending"
      class="stock-metric-history-chart-interactive__chart"
      :entries="compareEntries"
      :series="compareSeries"
      palette="compare"
      :unit="unit"
      :format="value => (value === null ? '—' : `${formatSignificantDigits(value, 3)}${unit}`)"
    />
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
    <SharedChart v-else-if="points.length > 1" v-loading="pending" class="stock-metric-history-chart-interactive__chart" :option="chartOption" autoresize />
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
   where it was first put, and it overlapped the bars. The corner is absolutely positioned, so a
   wrapped line inside it has nothing to push. */
.stock-metric-history-chart-interactive__coverage {
  margin: 0;
  text-align: right;
  font-size: 1rem;
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


/* Same fixed height StockDividendYieldPercentileCard.vue's own chart uses — this app's other
   SharedChart consumer, kept for a consistent chart footprint rather than a one-off value here. */
.stock-metric-history-chart-interactive__chart {
  height: 15rem;
  width: 100%;
  margin-top: 12px;
}
</style>
