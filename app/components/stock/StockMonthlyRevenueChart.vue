<script setup lang="ts">
import type { LineSeriesSpec, LineChartEntry } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { MonthlyPrice, MonthlyRevenueEntry } from '#shared/types/stock-monthly-revenue-page'
import type { LookbackWindow } from '~/utils/lookback-window'
// 月營收的圖（月均價＋月營收年增率）連同右上角的區間選單與股價跳動說明。月營收頁與指標速覽共用（2026-10-13「我希望把月營收
// 放回來」：速覽畫得出圖才能釘，見 hasPinnableChart）。為什麼是這兩條線、為什麼用月均價，見 pages/stock/[code]/monthly-revenue.vue。
const props = defineProps<{
  // 由舊到新，至少一筆
  entries: MonthlyRevenueEntry[]
  monthlyPrices: MonthlyPrice[]
  priceBreakMonths: string[]
}>()

// 區間選單（2026-09-30「補區間選單」）。**perYear 傳 12**：月頻率的近5年是 60 個月不是 20 個月——helper 的預設 4 是給季頻率用的。
// 視窗狀態沿用指標頁那一份跨頁共用的偏好。
const lookbackWindow = useMetricHistoryChartWindow()
const MONTHS_PER_YEAR = 12
const insufficientYears = computed(() => insufficientLookbackYears(props.entries.length, MONTHS_PER_YEAR, MONTHLY_REVENUE_LOOKBACK_YEARS))
const fittedWindow = computed(() => fitLookbackWindow(lookbackWindow.value, props.entries.length, MONTHS_PER_YEAR, MONTHLY_REVENUE_LOOKBACK_YEARS))

const rateText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)}%`)
const priceText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)} 元`)

const YOY_CODE = 'yoy'
const PRICE_CODE = 'price'

// Joined on the month string. The x-axis is driven by the REVENUE months, not the price ones: the price series runs one month
// further forward, which doesn't answer this question. A month with no price is left null rather than padded, so
// `connectNulls: false` leaves a real gap instead of a straight segment.
const priceByMonth = computed(() => new Map(props.monthlyPrices.map(point => [point.yearMonth, point.avgClose])))
const hasPrice = computed(() => props.entries.some(entry => priceByMonth.value.has(entry.yearMonth)))

const chartEntries = computed<LineChartEntry[]>(() =>
  props.entries.map(entry => ({
    label: entry.yearMonth,
    values: {
      [PRICE_CODE]: { value: priceByMonth.value.get(entry.yearMonth) ?? null },
      // null stays null — a company listed within the last year has no year-ago month; drawing 0 would invent a 100% collapse.
      [YOY_CODE]: { value: entry.yoyChangePct }
    }
  }))
)
const windowedChartEntries = computed(() => sliceToLookbackWindow(chartEntries.value, fittedWindow.value, MONTHS_PER_YEAR))
// 自訂區間（2026-10-14，跟指標圖同一套，見 useCustomPeriodRange）
const { open: customOpen, from: customFrom, to: customTo, keys: monthOptions, toKeys: toMonthOptions, shown: shownEntries, summary: customSummary, labelOf: monthLabel, start: openCustom, stop: closeCustom } =
  useCustomPeriodRange({ all: chartEntries, windowed: windowedChartEntries, keyOf: entry => entry.label ?? '', unit: '個月' })
function handleWindowChange(value: LookbackWindow) {
  lookbackWindow.value = value
  closeCustom()
}
// 只列圖上這一段裡的跳動
const visibleBreakMonths = computed(() => props.priceBreakMonths.filter(month => month >= (shownEntries.value[0]?.label ?? '') && month <= (shownEntries.value.at(-1)?.label ?? '')))

// 年增率是依正負上漲跌色的柱子、月均價是折線（2026-10-14，使用者為了負成長的識別度選的；之前是兩條線＋負值月份的淡色直條）。
// The price series drops out when the price read failed; the year-on-year bars then take the LEFT axis. Units are not repeated
// in the names: at 375px「（元）」「（%）」wrap the legend onto the left axis's own「元」label, and both axes already carry the unit.
const chartSeries = computed<LineSeriesSpec[]>(() =>
  hasPrice.value
    ? [
        { code: PRICE_CODE, name: '月均價', lineType: 'solid', symbol: 'circle', format: priceText },
        { code: YOY_CODE, name: '月營收年增率', type: 'bar', signColored: true, lineType: 'solid', symbol: 'rect', axis: 'right', format: rateText, baseline: true }
      ]
    : [{ code: YOY_CODE, name: '月營收年增率', type: 'bar', signColored: true, lineType: 'solid', symbol: 'rect', format: rateText, baseline: true }]
)
</script>

<template>
  <div>
    <div class="stock-page-window">
      <SharedLookbackWindowSelect
        :model-value="fittedWindow ?? lookbackWindow"
        :insufficient-years="insufficientYears"
        :years="MONTHLY_REVENUE_LOOKBACK_YEARS"
        custom-label="自訂區間…"
        :custom-active="customOpen"
        @update:model-value="handleWindowChange"
        @custom="openCustom"
      />
    </div>
    <StockMultiSeriesLineChart
      :entries="shownEntries"
      :series="chartSeries"
      palette="accent"
      :unit="hasPrice ? '元' : '%'"
      :unit-right="hasPrice ? '%' : undefined"
      :format="hasPrice ? priceText : rateText"
    />
    <SharedPeriodRangeFields
      v-if="customOpen"
      v-model:from="customFrom"
      v-model:to="customTo"
      :keys="monthOptions"
      :to-keys="toMonthOptions"
      :label-of="monthLabel"
      :summary="customSummary"
    />
    <!-- 股價跳動的月份（2026-10-12，5314）：減資、面額變更或除權息讓前後的月均價不能直接相比。只陳述事實、不說資料怎麼處理 -->
    <p v-if="hasPrice && visibleBreakMonths.length" class="stock-monthly-revenue-chart__line">
      {{ visibleBreakMonths.join('、') }} 的股價因減資、面額變更或除權息而跳動，前後的月均價不能直接相比。
    </p>
  </div>
</template>

<style scoped>
.stock-monthly-revenue-chart__line {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
}
</style>
