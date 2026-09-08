<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricBasis, MetricCode } from '~/composables/stock/useMetricHistory'
import type { DupontBasis, DupontHistoryEntry } from '~/composables/stock/useDupontHistory'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

const INFO_TEXT = 'ROE 可以拆成2、3、4或5個因子，拆得越細，看得越清楚獲利是本業、周轉還是槓桿撐出來的；同一拆法下，因子相乘後應該還原回同一個數字。「還原ROE」是用單季數字算出來的單季報酬率，跟「ROE（實際，TTM）」的近四季年化口徑不同，兩者數字對不上是正常的，不是算錯——換因子數比較時請看「還原ROE」線本身變不變，不是跟 ROE（實際）比對。'

// Converted from a table (StockDupontFactorLevelTable.vue) to a chart per direct request
// ("杜邦拆解對照表 table 請換成 圖表 比照 杜邦分析") — same family as StockDupontChart.vue/
// StockDupontExtendedChart.vue/StockRoeCompositionChart.vue now, same ECharts setup/dual-axis/
// fixed-color conventions. Kept the SAME data plumbing and factor-level math as the table
// version — only the rendering changed. See that file's own git history for the original
// telescoping-math derivation notes (dupontTaxBurdenPct × (dupontInterestBurdenPct/100) =
// netProfitMarginPct etc.), condensed here since the table's own column-by-column doc isn't
// needed once there's no column layout to explain.
//
// The 4 levels telescope into each other rather than being 4 unrelated formulas:
//   2因子: ROE = ROA × 權益乘數
//   3因子: ROE = 淨利率 × 總資產週轉率 × 權益乘數        (淨利率 = 稅務利息綜合負擔 × EBIT利潤率)
//   4因子: ROE = 稅務利息綜合負擔 × EBIT利潤率 × 總資產週轉率 × 權益乘數
//   5因子: ROE = 租稅負擔 × 利息負擔 × EBIT利潤率 × 總資產週轉率 × 權益乘數
// 3/4/5因子's own 還原ROE all reconstruct the same single-quarter number by construction
// (dupontExtendedRoePct always equals decomposedRoePct) — 2因子 alone can diverge since it uses
// the real reported TTM ROA instead of a derived Q-basis one.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const activeTab = ref<'近5年' | '近10年'>('近5年')
const limit = computed(() => (activeTab.value === '近5年' ? 20 : 40))
const factorLevel = ref<2 | 3 | 4 | 5>(3)

const roe = useMetricHistory(symbolRef, ref<MetricCode>('roe'), ref<MetricBasis>('TTM'), limit)
const roa = useMetricHistory(symbolRef, ref<MetricCode>('roa'), ref<MetricBasis>('TTM'), limit)
const dupont = useDupontHistory(symbolRef, ref<DupontBasis>('Q'), limit)

const pending = computed(() => roe.pending.value || roa.pending.value || dupont.pending.value)
const tenYearDisabled = computed(() => roe.total.value !== null && roe.total.value < 40)

interface Point {
  label: string
  roe: number | null
  roa: number | null
  dupont: DupontHistoryEntry | null
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

function byQuarter<T extends { fiscalYear: number; fiscalQuarter: number }>(entries: T[] | null): Map<string, T> {
  return new Map((entries ?? []).map(entry => [periodLabel(entry), entry]))
}

// Oldest-to-newest, matching every other chart in this family (unlike the old table version,
// which reversed to newest-first for table-reading convention — a chart reads left-to-right
// chronologically instead).
const points = computed<Point[]>(() => {
  const roaByQuarter = byQuarter(roa.data.value)
  const dupontByQuarter = byQuarter(dupont.data.value)
  return (roe.data.value ?? []).map(entry => {
    const key = periodLabel(entry)
    return {
      label: key,
      roe: entry.value,
      roa: roaByQuarter.get(key)?.value ?? null,
      dupont: dupontByQuarter.get(key) ?? null
    }
  })
})

const hasAnyData = computed(() => points.value.some(point => point.roe !== null))

function combinedBurden(entry: DupontHistoryEntry | null): number | null {
  if (!entry || entry.dupontTaxBurdenPct === null || entry.dupontInterestBurdenPct === null) return null
  return entry.dupontTaxBurdenPct * (entry.dupontInterestBurdenPct / 100)
}

function reconstructedRoe(point: Point): number | null {
  if (factorLevel.value === 2) {
    return point.roa !== null && point.dupont?.equityMultiplier != null ? point.roa * point.dupont.equityMultiplier : null
  }
  if (factorLevel.value === 3) return point.dupont?.decomposedRoePct ?? null
  return point.dupont?.dupontExtendedRoePct ?? null
}

// Reused across the DuPont/ROE-composition chart family wherever the same underlying field
// appears, so e.g. 權益乘數 always reads as the same color regardless of which card it's on —
// assetTurnover/ebitMargin/taxBurden/interestBurden match StockDupontExtendedChart.vue's own
// palette (the 4/5-factor levels here share those exact fields), equityMultiplier/roa match
// StockDupontChart.vue/StockRoeCompositionChart.vue. roeActual/reconstructed are new — the two
// headline lines every level shows, so they need their own clearly-distinct colors rather than
// reusing a "supporting factor" one. Each has a LIGHT variant per this family's own WCAG 1.4.11
// fix (see StockDupontChart.vue's own comment for the contrast-floor reasoning).
const FACTOR_LEVEL_LINE_COLORS = {
  DARK: {
    roeActual: '#5b8ff9',
    reconstructed: '#e0575b',
    roa: '#c792ea',
    taxBurden: '#f2994e',
    interestBurden: '#f6c344',
    ebitMargin: '#6fcf73',
    assetTurnover: '#56ccf2',
    equityMultiplier: '#5ac8c8'
  },
  LIGHT: {
    roeActual: '#4984fd',
    reconstructed: '#e35458',
    roa: '#b368e5',
    taxBurden: '#da690b',
    interestBurden: '#b28104',
    ebitMargin: '#319d36',
    assetTurnover: '#0a94c1',
    equityMultiplier: '#2f9797'
  }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => FACTOR_LEVEL_LINE_COLORS[resolvedMode.value])

interface FactorSeries {
  key: string
  name: string
  unit: '%' | '×'
  color: string
  dashed?: boolean
  value: (point: Point) => number | null
}

// One entry per factor line at each level, in the same order the old table's own columns used
// — the reconstructed-ROE line itself is added separately below (always last, always the same
// treatment) rather than repeated in every level's own list.
const FACTOR_SERIES: Record<2 | 3 | 4 | 5, FactorSeries[]> = {
  2: [{ key: 'roa', name: 'ROA（實際，TTM）', unit: '%', color: '', value: point => point.roa }],
  3: [{ key: 'npm', name: '淨利率', unit: '%', color: '', dashed: true, value: point => point.dupont?.netProfitMarginPct ?? null }],
  4: [
    { key: 'burden', name: '稅務利息綜合負擔', unit: '%', color: '', dashed: true, value: point => combinedBurden(point.dupont) },
    { key: 'ebit', name: 'EBIT 利潤率', unit: '%', color: '', value: point => point.dupont?.dupontEbitMarginPct ?? null }
  ],
  5: [
    { key: 'tax', name: '租稅負擔', unit: '%', color: '', value: point => point.dupont?.dupontTaxBurdenPct ?? null },
    { key: 'interest', name: '利息負擔', unit: '%', color: '', value: point => point.dupont?.dupontInterestBurdenPct ?? null },
    { key: 'ebit', name: 'EBIT 利潤率', unit: '%', color: '', value: point => point.dupont?.dupontEbitMarginPct ?? null }
  ]
}

// 總資產週轉率/權益乘數 appear at every level except 2因子 (which has no turnover factor of its
// own — ROA already bundles it) / every level including 2因子 respectively.
function activeFactorSeries(): FactorSeries[] {
  const base = FACTOR_SERIES[factorLevel.value]
  const withTurnover =
    factorLevel.value === 2
      ? base
      : [...base, { key: 'at', name: '總資產週轉率', unit: '×' as const, color: '', value: (point: Point) => point.dupont?.assetTurnover ?? null }]
  return [
    ...withTurnover,
    { key: 'em', name: '權益乘數（單季）', unit: '×', color: '', dashed: factorLevel.value === 2, value: point => point.dupont?.equityMultiplier ?? null }
  ]
}

const colorByKey = computed<Record<string, string>>(() => ({
  roa: lineColors.value.roa,
  npm: chartInk.value.secondary,
  burden: chartInk.value.secondary,
  tax: lineColors.value.taxBurden,
  interest: lineColors.value.interestBurden,
  ebit: lineColors.value.ebitMargin,
  at: lineColors.value.assetTurnover,
  em: lineColors.value.equityMultiplier
}))

const activeSeries = computed(() => activeFactorSeries())

interface AxisTooltipParam {
  dataIndex?: number
}

const option = computed(() => {
  const series = activeSeries.value
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { left: 8, right: 8, top: 36, bottom: 28, containLabel: true },
    legend: {
      top: 0,
      left: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 3,
      textStyle: { color: chartInk.value.secondary, fontSize: 16 }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: chartInk.value.baseline } },
      appendTo: 'body',
      backgroundColor: CHART_TOOLTIP.backgroundColor,
      borderColor: CHART_TOOLTIP.borderColor,
      textStyle: { color: CHART_TOOLTIP_INK.primary },
      formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
        const list = Array.isArray(params) ? params : [params]
        const dataIndex = list[0]?.dataIndex ?? 0
        const point = points.value[dataIndex]
        if (!point) return ''
        const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
        const row = (label: string, value: number | null, unit: string) =>
          `<div style="${rowStyle}"><span>${label}</span><strong>${value !== null ? `${value.toFixed(2)}${unit}` : '資料不足'}</strong></div>`
        return `<div style="font-size:16px;min-width:180px;">
          <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
          ${row('ROE（實際，TTM）', point.roe, '%')}
          ${series.map(s => row(s.name, s.value(point), s.unit)).join('')}
          ${row('還原 ROE（單季）', reconstructedRoe(point), '%')}
        </div>`
      }
    },
    xAxis: {
      type: 'category',
      data: points.value.map(point => point.label),
      axisLine: { lineStyle: { color: chartInk.value.baseline } },
      axisTick: { show: false },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    yAxis: [
      {
        type: 'value',
        name: '%',
        nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
        scale: true,
        splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
        axisLabel: { color: chartInk.value.muted, fontSize: 16 }
      },
      {
        type: 'value',
        name: '倍',
        nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
        scale: true,
        splitLine: { show: false },
        axisLabel: { color: chartInk.value.muted, fontSize: 16 }
      }
    ],
    series: [
      {
        name: 'ROE（實際，TTM）',
        type: 'line',
        yAxisIndex: 0,
        showSymbol: false,
        smooth: true,
        smoothMonotone: 'x',
        lineStyle: { width: 2.5, color: lineColors.value.roeActual },
        itemStyle: { color: lineColors.value.roeActual },
        data: points.value.map(point => point.roe),
        z: 10
      },
      ...series.map(s => ({
        name: s.name,
        type: 'line',
        yAxisIndex: s.unit === '%' ? 0 : 1,
        showSymbol: false,
        smooth: true,
        smoothMonotone: 'x',
        lineStyle: { width: 1.5, color: colorByKey.value[s.key], type: s.dashed ? 'dashed' : 'solid' },
        itemStyle: { color: colorByKey.value[s.key] },
        data: points.value.map(point => s.value(point))
      })),
      {
        // 單季 explicitly in the label — every other line here is TTM (ROE實際) or Q-basis by
        // necessity (the factor lines); this one is the reconstructed product of those factors,
        // always single-quarter, never directly comparable to the ROE（實際）line above it.
        name: '還原 ROE（單季）',
        type: 'line',
        yAxisIndex: 0,
        showSymbol: false,
        smooth: true,
        smoothMonotone: 'x',
        lineStyle: { width: 2, color: lineColors.value.reconstructed },
        itemStyle: { color: lineColors.value.reconstructed },
        data: points.value.map(point => reconstructedRoe(point)),
        z: 9
      }
    ]
  }
})
</script>

<template>
  <el-card class="dupont-factor-level-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="dupont-factor-level-chart__header">
        <span class="dupont-factor-level-chart__title">
          杜邦拆解對照
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="dupont-factor-level-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <div class="dupont-factor-level-chart__controls">
          <el-select v-model="factorLevel" class="dupont-factor-level-chart__level-select">
            <el-option :value="2" label="2因子" />
            <el-option :value="3" label="3因子" />
            <el-option :value="4" label="4因子" />
            <el-option :value="5" label="5因子" />
          </el-select>
          <SharedLookbackWindowSelect v-model="activeTab" :ten-year-insufficient="tenYearDisabled" />
        </div>
      </div>
    </template>

    <el-empty v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <VChart v-else v-loading="pending" class="dupont-factor-level-chart__chart" :option="option" autoresize />
  </el-card>
</template>

<style scoped>
.dupont-factor-level-chart {
  border-radius: 12px;
}

.dupont-factor-level-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.dupont-factor-level-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.dupont-factor-level-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.dupont-factor-level-chart__controls {
  display: flex;
  gap: 8px;
}

.dupont-factor-level-chart__level-select {
  width: 100px;
}

.dupont-factor-level-chart__chart {
  height: 280px;
  width: 100%;
}
</style>
