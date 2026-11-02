<script setup lang="ts">
import type { LineChartEntry, LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { EtfPageResponse } from '#shared/types/screener-detail'
import type { EtfFacetKey } from '~/utils/etf-pages'
// ETF 每個面向的那一張圖（2026-10-18）：面向頁與速覽首頁畫的是同一張（同個股：指標頁的圖就是速覽格子裡的圖）。外殼是 SharedChartCard，
// 有時間軸的接 useChartPeriod；速覽把標題傳進 #header。填息沒有圖（同個股填息頁，只有表）
const props = defineProps<{
  data: EtfPageResponse
  facet: Exclude<EtfFacetKey, 'overview' | 'fill'>
}>()

const isDesktop = useIsDesktop()
const yuan = (value: number | null) => etfYuan(value)
const pct = (value: number | null) => etfPct(value)
const hundredMillion = (value: number | null) => (value === null ? '－' : `${formatSignificantDigits(value, 4)} 億元`)

function nextMonth(month: string): string {
  const [year, value] = month.split('-').map(Number) as [number, number]
  return value === 12 ? `${year + 1}-01` : `${year}-${String(value + 1).padStart(2, '0')}`
}

const events = computed(() => [...(props.data.distributions?.events ?? [])].sort((a, b) => a.exDividendDate.localeCompare(b.exDividendDate)))
const composed = computed(() => events.value.filter(event => hasEtfComposition(event.composition)))

// ---- 折線／柱狀（StockMultiSeriesLineChart）----
interface LineSpec { entries: LineChartEntry[]; series: LineSeriesSpec[]; unit: string; unitRight?: string; format: (value: number | null) => string; perYear: number | null }
const lineSpec = computed<LineSpec | null>(() => {
  const values = props.data.etf.values
  switch (props.facet) {
    // 每個月一格，有除息的月份畫每單位配息：用月份當橫軸，近N年才是真的 N 年（配息頻率會改）
    case 'distributions': {
      if (!events.value.length) return null
      const byMonth = new Map<string, number>()
      for (const event of events.value) {
        if (event.distributionPerUnit === null) continue
        const month = event.exDividendDate.slice(0, 7)
        byMonth.set(month, (byMonth.get(month) ?? 0) + event.distributionPerUnit)
      }
      const first = events.value[0]!.exDividendDate.slice(0, 7)
      const windowEnd = props.data.distributions?.trailing12MonthWindow?.end.slice(0, 7) ?? ''
      const lastEvent = events.value.at(-1)!.exDividendDate.slice(0, 7)
      const entries: LineChartEntry[] = []
      for (let month = first; month <= (windowEnd > lastEvent ? windowEnd : lastEvent); month = nextMonth(month)) {
        entries.push({ label: month, values: { value: { value: byMonth.get(month) ?? null } } })
      }
      // 配息的月份不到一半（半年配、季配）時柱子至少 8px：近 5 年 60 格，每格只剩 3px
      const barMinWidth = byMonth.size * 2 < entries.length ? 8 : undefined
      return { entries, series: [{ code: 'value', name: '每單位配息', type: 'bar', lineType: 'solid', symbol: 'rect', format: yuan, barMinWidth }], unit: '元', format: yuan, perYear: 12 }
    }
    case 'expenses': {
      const entries = Object.keys(values)
        .flatMap(key => (/^expenseRatio\d{4}$/.test(key) && typeof values[key] === 'number' ? [{ label: key.slice(-4), values: { value: { value: values[key] as number } } }] : []))
        .sort((a, b) => a.label.localeCompare(b.label))
      return entries.length ? { entries, series: [{ code: 'value', name: '總費用率', lineType: 'solid', symbol: 'circle', format: pct }], unit: '%', format: pct, perYear: 1 } : null
    }
    case 'returns': {
      const entries = ETF_RETURN_FIELDS.flatMap(({ field, label }) => (typeof values[field] === 'number' ? [{ label, values: { value: { value: values[field] as number } } }] : []))
      return entries.length ? { entries, series: [{ code: 'value', name: '含息報酬率（累積）', type: 'bar', lineType: 'solid', symbol: 'rect', format: pct, signColored: true }], unit: '%', format: pct, perYear: null } : null
    }
    // 以億元畫：0050 一天上百億，原始的元在縱軸上是 11 位數
    case 'liquidity': {
      const entries = (props.data.liquidity ?? []).map(month => ({ label: month.month, values: { value: { value: month.averageDailyValue / 1e8 } } }))
      return entries.length ? { entries, series: [{ code: 'value', name: '日均成交金額', type: 'bar', lineType: 'solid', symbol: 'rect', format: hundredMillion }], unit: '億元', format: hundredMillion, perYear: 12 } : null
    }
    // 規模（億元，左軸）＋受益人數（右軸）；法定下市門檻畫成虛線，規模小的 ETF 才看得出它離門檻多近
    case 'size': {
      const points = props.data.monthly ?? []
      const entries = points.map(point => ({
        label: point.yearMonth,
        values: {
          aum: { value: point.aum === null ? null : point.aum / 1e8 },
          threshold: { value: point.statutoryAumThreshold === null ? null : point.statutoryAumThreshold / 1e8 },
          holders: { value: point.holders }
        }
      }))
      const people = (value: number | null) => (value === null ? '－' : `${groupThousands(value)} 人`)
      return entries.length
        ? {
            entries,
            series: [
              { code: 'aum', name: '規模', type: 'bar', lineType: 'solid', symbol: 'rect', format: hundredMillion },
              { code: 'threshold', name: '法定下市門檻', lineType: 'dashed', symbol: 'diamond', format: hundredMillion },
              { code: 'holders', name: '受益人數', lineType: 'solid', symbol: 'circle', axis: 'right', format: people }
            ],
            unit: '億元',
            unitRight: '人',
            format: hundredMillion,
            perYear: 12
          }
        : null
    }
    // 每月的平均、最高、最低折溢價（%）；正的是市價高於淨值（溢價）
    case 'premium': {
      const entries = (props.data.premium ?? []).map(month => ({ label: month.month, values: { average: { value: month.average }, highest: { value: month.highest }, lowest: { value: month.lowest } } }))
      return entries.length
        ? {
            entries,
            // 手機上最高、最低換成一條淡色帶（2026-11-02 手機掃描：三條鋸齒線擠成一團），圖上只剩月平均一條線
            series: [
              { code: 'average', name: '月平均', lineType: 'solid', symbol: 'circle', format: pct, baseline: true },
              ...(isDesktop.value
                ? [
                    { code: 'highest', name: '當月最高', lineType: 'dashed', symbol: 'triangle', format: pct },
                    { code: 'lowest', name: '當月最低', lineType: 'dotted', symbol: 'diamond', format: pct }
                  ] as const
                : [{ code: 'lowest', rangeTo: 'highest', name: '當月最低～最高', type: 'range', lineType: 'solid', symbol: 'rect', format: pct }] as const)
            ],
            unit: '%',
            format: pct,
            perYear: 12
          }
        : null
    }
    default:
      return null
  }
})
// 報酬期間在手機上是橫條清單（2026-11-02，使用者選「要比很多項目的圖，手機改成清單或橫條」：八根柱子只寫得出三個期間名）；
// 長度照絕對值、顏色照正負（使用者的漲跌色慣例），數字帶正負號，不只靠顏色
const { resolvedMode, market } = useAppTheme()
const returnRows = computed(() => {
  if (props.facet !== 'returns' || !lineSpec.value) return []
  const values = lineSpec.value.entries.map(entry => entry.values.value?.value ?? 0)
  const max = Math.max(0, ...values.map(Math.abs))
  const colors = getPriceColors(resolvedMode.value, market.value)
  return lineSpec.value.entries.map((entry, index) => {
    const value = values[index]!
    return { label: entry.label ?? '', share: max ? Math.abs(value) / max : 0, color: value < 0 ? colors.down : colors.up, text: fixedSignedRateText(value) }
  })
})

const lineEntries = computed(() => lineSpec.value?.entries ?? [])
const { period, shown } = useChartPeriod({ all: lineEntries, keyOf: entry => entry.label ?? '', perYear: () => lineSpec.value?.perYear ?? 1 })

// ---- 配息組成（堆疊柱，每次配息一根）----
// 一年幾次：先看上游的配息頻率（2026-10-18：剛成立四個月的月配 00400A 只配過 4 次，用「近 12 個月的次數」推成一年 4 期，右上角就寫
// 「近1年」）；頻率不認得再退回近 12 個月有公告組成的次數
const FREQUENCY_PER_YEAR: Record<string, number> = { 月配: 12, 季配: 4, 半年配: 2, 一年兩次配息: 2, 年配: 1 }
const compositionEntries = computed(() => composed.value)
const compositionPerYear = computed(() => {
  const frequency = FREQUENCY_PER_YEAR[String(props.data.etf.values.distributionFrequency ?? '')]
  if (frequency) return frequency
  const last = composed.value.at(-1)?.exDividendDate
  if (!last) return 1
  const yearAgo = `${Number(last.slice(0, 4)) - 1}${last.slice(4)}`
  return Math.max(1, composed.value.filter(event => event.exDividendDate > yearAgo).length)
})
const { period: compositionPeriod, shown: compositionShown } = useChartPeriod({ all: compositionEntries, keyOf: event => event.exDividendDate, perYear: compositionPerYear })

// ---- 持有人結構（堆疊柱，每週一根，五組的集保比例）----
const holderWeeks = computed(() => props.data.holders?.weeks ?? [])
const { period: holdersPeriod, shown: holdersShown } = useChartPeriod({ all: holderWeeks, keyOf: week => week.dataDate, perYear: 52 })
const holderLayers = computed(() => (holdersShown.value[0]?.groups ?? []).map((group, index) => ({ name: group.name, values: holdersShown.value.map(week => week.groups[index]?.custodyPct ?? 0) })))
const compositionLayers = computed(() => ETF_DISTRIBUTION_PARTS.map(part => ({ name: part.name, values: compositionShown.value.map(event => event.composition![part.key] ?? 0) })))
</script>

<template>
  <SharedChartCard v-if="facet === 'composition' && composed.length" :period="compositionPeriod">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <StockStackedBarChart
      :categories="compositionShown.map(event => event.exDividendDate)"
      :layers="compositionLayers"
      unit="%"
      total-name="合計"
      :value-formatter="value => `${value.toFixed(2)}%`"
      :tooltip-header="index => `${compositionShown[index]?.exDividendDate} 除息　每單位 ${yuan(compositionShown[index]?.distributionPerUnit ?? null)}`"
    />
  </SharedChartCard>
  <SharedChartCard v-else-if="facet === 'holders' && holderWeeks.length" :period="holdersPeriod">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <StockStackedBarChart
      :categories="holdersShown.map(week => week.dataDate)"
      :layers="holderLayers"
      unit="%"
      total-name="合計"
      :value-formatter="value => `${value.toFixed(2)}%`"
      :tooltip-header="index => `${holdersShown[index]?.dataDate} 集保股權分散`"
    />
  </SharedChartCard>
  <SharedChartCard v-else-if="lineSpec" :period="lineSpec.perYear === null ? undefined : period">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <ol v-if="returnRows.length" class="etf-returns app-narrow-only" aria-label="含息報酬率（累積）">
      <li v-for="row in returnRows" :key="row.label" class="etf-returns__row">
        <span>{{ row.label }}</span>
        <span class="etf-returns__track" aria-hidden="true"><span class="etf-returns__bar" :style="{ width: `${row.share * 100}%`, background: row.color }" /></span>
        <span class="etf-returns__value">{{ row.text }}</span>
      </li>
    </ol>
    <StockMultiSeriesLineChart :class="{ 'app-wide-only': returnRows.length }" :entries="lineSpec.perYear === null ? lineSpec.entries : shown" :series="lineSpec.series" palette="accent" :unit="lineSpec.unit" :unit-right="lineSpec.unitRight" :format="lineSpec.format" />
  </SharedChartCard>
</template>

<style scoped>
.etf-returns {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.etf-returns__row {
  display: grid;
  grid-template-columns: 4.5em 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--app-divider);
}

.etf-returns__row:first-child {
  border-top: 0;
}

.etf-returns__track {
  height: 12px;
}

.etf-returns__bar {
  display: block;
  min-width: 2px;
  height: 100%;
  border-radius: 2px;
}

.etf-returns__value {
  min-width: 5.5em;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
