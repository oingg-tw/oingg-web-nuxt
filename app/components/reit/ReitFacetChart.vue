<script setup lang="ts">
import type { LineChartEntry, LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { ReitPageResponse } from '#shared/types/screener-detail'
// REITs 每個面向的那一張圖（2026-10-30）：面向頁與速覽畫的是同一張（同 EtfFacetChart）。外殼是 SharedChartCard、時間軸接 useChartPeriod，
// 速覽把標題傳進 #header
const props = defineProps<{
  data: ReitPageResponse
  // spread：收益分配頁第二張圖（分配率與 10 年期公債殖利率，2026-11-24），不是一個面向
  facet: 'nav' | 'liquidity' | 'holders' | 'distributions' | 'spread'
}>()

const yuan = (value: number | null) => reitYuan(value)
const perUnit = (value: number | null) => reitYuan(value, 4)

interface LineSpec { entries: LineChartEntry[]; series: LineSeriesSpec[]; unit: string; format: (value: number | null) => string; perYear: number }
const spec = computed<LineSpec | null>(() => {
  if (props.facet === 'holders') return null
  if (props.facet === 'nav') {
    // 每月月底的收盤價與淨值：兩條線的距離就是折溢價
    const entries = (props.data.navMonths ?? []).map(month => ({ label: month.month, values: { close: { value: month.close }, nav: { value: month.nav } } }))
    return entries.length
      ? {
          entries,
          series: [
            { code: 'close', name: '收盤價', lineType: 'solid', symbol: 'circle', format: yuan },
            { code: 'nav', name: '每單位淨值', lineType: 'dashed', symbol: 'diamond', format: yuan }
          ],
          unit: '元',
          format: yuan,
          perYear: 12
        }
      : null
  }
  // 分配率與 10 年期公債殖利率（2026-11-24，數據中台 (b′)）：兩條線的距離就是利差（手機一張圖最多兩條線）。算不出來的月份是缺口
  if (props.facet === 'spread') {
    const pct = (value: number | null) => reitPct(value)
    const entries = (props.data.spread ?? []).map(point => ({ label: point.yearMonth, values: { yield: { value: point.recentYearDistributionYieldPct }, bond: { value: point.govBondYield10yPct } } }))
    return entries.length
      ? {
          entries,
          series: [
            { code: 'yield', name: '分配率', lineType: 'solid', symbol: 'circle', format: pct },
            { code: 'bond', name: '10 年期公債殖利率', lineType: 'dashed', symbol: 'diamond', format: pct }
          ],
          unit: '%',
          format: pct,
          perYear: 12
        }
      : null
  }
  // 每月日均成交張數（受益權單位不分割，張數跨年可比；ETF 畫金額是因為分割）
  if (props.facet === 'liquidity') {
    const entries = (props.data.liquidity ?? []).map(month => ({ label: month.month, values: { value: { value: month.averageDailyLots } } }))
    return entries.length
      ? { entries, series: [{ code: 'value', name: '日均成交張數', type: 'bar', lineType: 'solid', symbol: 'rect', format: reitLots }], unit: '張', format: reitLots, perYear: 12 }
      : null
  }
  // 每次分配一根：一年幾根照近一年實際分配的次數（近N年才是真的 N 年）
  const events = [...(props.data.distributions ?? [])].sort((a, b) => a.exDividendDate.localeCompare(b.exDividendDate))
  const entries = events.map(event => ({ label: event.exDividendDate, values: { value: { value: event.distributionPerUnit } } }))
  return entries.length
    ? {
        entries,
        series: [{ code: 'value', name: '每單位分配', type: 'bar', lineType: 'solid', symbol: 'rect', format: perUnit }],
        unit: '元',
        format: perUnit,
        perYear: Math.max(1, props.data.reit.recentYearDistributionCount ?? 1)
      }
    : null
})
const entries = computed(() => spec.value?.entries ?? [])
const { period, shown } = useChartPeriod({ all: entries, keyOf: entry => entry.label ?? '', perYear: () => spec.value?.perYear ?? 1 })

// 持有人結構：圖在 SharedHoldersChart（ETF 面向、個股 /holders 也用）
const holderWeeks = computed(() => props.data.holders?.weeks ?? [])
</script>

<template>
  <SharedHoldersChart v-if="facet === 'holders' && holderWeeks.length" :weeks="holderWeeks">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
  </SharedHoldersChart>
  <SharedChartCard v-else-if="spec" :period="period">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <StockMultiSeriesLineChart :entries="shown" :series="spec.series" palette="accent" :unit="spec.unit" :format="spec.format" />
  </SharedChartCard>
</template>
