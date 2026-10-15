<script setup lang="ts">
import type { LineSeriesSpec, LineChartEntry } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { CashDividendPoint, DividendYieldPoint } from '#shared/types/stock-dividend-yield-history'
// 殖利率的歷年走勢圖卡（2026-10-15，使用者：「重新設計 dividend 該指標都先跟自己比，就像其他多數指標一樣」）：每月最後一個交易日
// 一點，近N年＋自訂區間由 SharedChartCard／useChartPeriod 負責。配股配息頁第一段與指標速覽共用。
// 現金股利畫成柱子（同日「殖利率 要把現金股利做成柱狀圖放進去」）：除息那個月一根，高度是那一次的每股現金股利（元，右軸），
// 季配息的公司一年四根。殖利率＝股利 ÷ 股價，所以線往上可能是股利變多、也可能是股價變低——柱子讓讀者分得出是哪一個。
// 跟全市場比的那張分布圖在配股配息頁的下一段，不疊在這裡。
const props = defineProps<{
  // 由舊到新，至少一筆
  entries: DividendYieldPoint[]
  cashDividends: CashDividendPoint[]
}>()

const YIELD_CODE = 'dividendYield'
const CASH_CODE = 'cashDividend'
const rateText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)}%`)
const cashText = (value: number | null): string => (value === null ? '這個月沒有除息' : `${formatSignificantDigits(value, 4)} 元`)
// 單位不寫進名稱：兩個軸自己標了 % 與 元（同月營收圖，375 寬時圖例會折到軸名上）
const SERIES: LineSeriesSpec[] = [
  { code: YIELD_CODE, name: '殖利率', lineType: 'solid', symbol: 'circle', format: rateText },
  { code: CASH_CODE, name: '現金股利', type: 'bar', lineType: 'solid', symbol: 'rect', axis: 'right', format: cashText }
]

// 月份當 key（'YYYY-MM'），同月營收：最新一點是月中的某一天，標月份讀者才不會以為少了一個月。同一個月除息兩次就相加
const cashByMonth = computed(() => {
  const map = new Map<string, number>()
  for (const point of props.cashDividends) {
    const month = point.exDividendDate.slice(0, 7)
    map.set(month, (map.get(month) ?? 0) + point.cashDividend)
  }
  return map
})
const chartEntries = computed<LineChartEntry[]>(() =>
  props.entries.map((entry) => {
    const month = entry.tradeDate.slice(0, 7)
    return { label: month, values: { [YIELD_CODE]: { value: entry.value }, [CASH_CODE]: { value: cashByMonth.value.get(month) ?? null } } }
  })
)
const hasCash = computed(() => chartEntries.value.some(entry => entry.values[CASH_CODE]?.value != null))
const { period, shown } = useChartPeriod({ all: chartEntries, keyOf: entry => entry.label ?? '', perYear: 12 })
</script>

<template>
  <SharedChartCard :period="period">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <StockMultiSeriesLineChart
      :entries="shown"
      :series="hasCash ? SERIES : SERIES.slice(0, 1)"
      palette="accent"
      unit="%"
      :unit-right="hasCash ? '元' : undefined"
      :format="rateText"
    />
  </SharedChartCard>
</template>
