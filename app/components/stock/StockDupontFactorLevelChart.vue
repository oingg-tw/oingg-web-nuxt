<script setup lang="ts">
import type { LookbackWindow } from '~/utils/lookback-window'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import type { MetricTimeframe, MetricCode } from '~/composables/stock/useMetricHistory'
import type { DupontTimeframe, DupontHistoryEntry } from '~/composables/stock/useDupontHistory'

use([SVGRenderer, LineChart, GridComponent, TooltipComponent])

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = 'ROE拆解成ROA×權益乘數兩因子'

// Converted from a table (StockDupontFactorLevelTable.vue) to a chart per direct request
// ("杜邦拆解對照表 table 請換成 圖表 比照 杜邦分析") — same family as StockDupontChart.vue/
// StockDupontExtendedChart.vue/StockRoeCompositionChart.vue now, same ECharts setup/fixed-color
// conventions. Kept the SAME data plumbing and factor-level math as the table version — only the
// rendering changed. See that file's own git history for the original telescoping-math
// derivation notes (dupontTaxBurdenPct × (dupontInterestBurdenPct/100) = netProfitMarginPct
// etc.), condensed here since the table's own column-by-column doc isn't needed once there's no
// column layout to explain.
//
// The 4 levels used to telescope into each other rather than being 4 unrelated formulas (only
// 2因子 survives below, kept here for context):
//   2因子: ROE = ROA × 權益乘數
//   3因子: ROE = 淨利率 × 總資產週轉率 × 權益乘數        (淨利率 = 稅務利息綜合負擔 × EBIT利潤率)
//   4因子: ROE = 稅務利息綜合負擔 × EBIT利潤率 × 總資產週轉率 × 權益乘數
//   5因子: ROE = 租稅負擔 × 利息負擔 × EBIT利潤率 × 總資產週轉率 × 權益乘數
// A reconstructed "還原ROE" line (product of the displayed factors) used to render alongside
// ROE（實際，TTM）, but was removed per direct request ("杜邦拆解對照 不要顯示還原ROE") — it was
// a single-quarter figure next to a TTM one and needed its own caveat to explain the mismatch.
//
// The 3/4/5因子 picker options were removed 2026-09-14, per the 高齡友善圖表類型可用性分級與選型
// 決策框架 the user shared that day (line charts capped at ≤2 — 5因子 alone put 7 lines on
// screen at once, the single worst violation in this whole pass). That first pass then tried
// keeping ROE + one of {ROA, 權益乘數} as an overlay's 2 plotted lines and demoting the other to
// tooltip-only — first ROA (per "預設顯示2因子"), then swapped to 權益乘數 per direct correction
// ("杜邦分析 我認為主角是 權益乘數"). Both single-choice versions read as broken in practice: with
// only 2 of 3 factors ever visible, and 權益乘數 in particular barely moving quarter to quarter
// for most companies, toggling 單季/近四季 looked like nothing was happening ("超像壞掉").
//
// Rebuilt 2026-09-14 as SMALL MULTIPLES instead — same fix already applied the same day to
// StockMarginsChart.vue for the exact same shape of problem (3 co-equal sub-dimensions of one
// theme, here ROE/ROA/權益乘數 instead of 毛利率/營業利益率/稅後淨利率). 3 independent single-line
// mini-charts stacked vertically, each trivially within the ≤2-line cap (1 line each), so all 3
// factors stay visible together with no picker and no timeframe-dependent disappearing act.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const activeTab = ref<LookbackWindow>('近5年')
const limit = computed(() => LOOKBACK_WINDOW_YEARS[activeTab.value] * 4)

// 單季/近四季 timeframe toggle added to the header 2026-09-14, per direct request ("杜邦分析 右上角
// 改成放 單季 與 近四季 選項") — same control/convention as StockMetricHistoryChart.vue's own
// timeframeTab (see that file's own comment). One `timeframeTab` drives two separately-typed computeds
// (timeframeRef for roe/roa's own MetricTimeframe, dupontTimeframeRef for dupont's own DupontTimeframe) — kept as
// two computeds rather than one shared ref even though both types are now identically 'Q'|'TTM'
// (MetricTimeframe's short-lived extra 'Q_ANN' member, and the type mismatch it caused here, is gone
// — analysis-ts removed the Q_ANN timeframe entirely 2026-09-14, commit 054ae0b); not worth
// collapsing back into one shared ref for what's now just cosmetic duplication. 權益乘數 is a
// balance-sheet point-in-time snapshot — analysis-ts's dupont-history
// endpoint originally returned it null under timeframe=TTM, but fixed same-day once asked (now
// returns the same Q-snapshot value under both bases, since their own TTM ROE decomposition
// already used that same value internally) — so there's no timeframe where any of the 3 mini-charts
// below goes all-null.
// Default flipped 近四季→單季 2026-09-14 per direct request across all cards ("針對所有卡片，都
// 先幫我改成單季呈現或是預設單季") — reasoning: TTM/近四季 is a multi-quarter rolling aggregate,
// which can't map back to one single filed disclosure the way 稽核鏈 (audit-chain provenance
// jumps) needs ("因為要落實稽核鍊就不可能總是呈現近四季給用戶"). Still user-toggleable, just a
// different default.
const timeframeTab = ref<'單季' | '近四季'>('單季')
const timeframeRef = computed<MetricTimeframe>(() => (timeframeTab.value === '單季' ? 'Q' : 'TTM'))
const dupontTimeframeRef = computed<DupontTimeframe>(() => (timeframeTab.value === '單季' ? 'Q' : 'TTM'))

const roe = useMetricHistory(symbolRef, ref<MetricCode>('roe'), timeframeRef, limit)
const roa = useMetricHistory(symbolRef, ref<MetricCode>('roa'), timeframeRef, limit)
const dupont = useDupontHistory(symbolRef, dupontTimeframeRef, limit)

const pending = computed(() => roe.pending.value || roa.pending.value || dupont.pending.value)
const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => roe.total.value !== null && roe.total.value! < years * 4)
)

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

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]!.roe !== null) return list[i]!
  }
  return null
})

// Reused across the DuPont/ROE-composition chart family wherever the same underlying field
// appears, so e.g. ROA always reads as the same color regardless of which card it's on —
// roeActual/roa/equityMultiplier match StockDupontChart.vue/StockRoeCompositionChart.vue's own
// palette. taxBurden/interestBurden/ebitMargin/assetTurnover entries removed 2026-09-14 along
// with the 3/4/5因子 options that used them (see this file's own top comment).
//
// Contrast-checked directly (relative-luminance formula, not eyeballed) against both card
// surfaces this app's theme system actually uses — #1e1e1e dark / #faf9f6 light — per direct
// request ("顏色要過accessbility標準"): every value here clears WCAG 1.4.11's 3:1 non-text
// floor in both modes (DARK 4.51–10.17:1, LIGHT 3.31–3.51:1). Most of these hex values are
// inherited from sibling charts that already passed the same check (see StockDupontChart.vue/
// StockDupontExtendedChart.vue's own comments) — re-verified here rather than assumed, since
// this component recombines them into new simultaneous groupings those siblings never render.
const FACTOR_LEVEL_LINE_COLORS = {
  DARK: { roeActual: '#5b8ff9', roa: '#c792ea', equityMultiplier: '#6bc99a' },
  LIGHT: { roeActual: '#4984fd', roa: '#b368e5', equityMultiplier: '#268a55' }
}

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => FACTOR_LEVEL_LINE_COLORS[resolvedMode.value])

interface AxisTooltipParam {
  dataIndex?: number
}

// One independent single-line option per factor — each satisfies the ≤2-line cap trivially.
// y-axis min/max are functions (not a fixed 0 floor) so the axis always includes 0 as a
// reference baseline without clipping genuinely negative values (ROE/ROA can go negative on a
// loss quarter) — same convention as StockMarginsChart.vue's own miniOption.
function miniOption(name: string, color: string, unit: '%' | '×', value: (point: Point) => number | null) {
  return {
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { left: 8, right: 8, top: 8, bottom: 24, containLabel: true },
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
        const v = value(point)
        const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
        return `<div style="font-size: 1rem;min-width:150px;">
          <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
          <div style="${rowStyle}"><span>${name}</span><strong>${v !== null ? `${v.toFixed(2)}${unit}` : '資料不足'}</strong></div>
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
    yAxis: {
      type: 'value',
      name: unit,
      nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
      min: (extent: { min: number }) => Math.min(0, extent.min),
      max: (extent: { max: number }) => Math.max(0, extent.max),
      splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
      axisLabel: { color: chartInk.value.muted, fontSize: 16 }
    },
    series: [
      {
        name,
        type: 'line',
        showSymbol: true,
        symbolSize: 6,
        smooth: true,
        smoothMonotone: 'x',
        lineStyle: { width: 2.5, color },
        itemStyle: { color },
        data: points.value.map(value),
        z: 10
      }
    ]
  }
}

const roeOption = computed(() => miniOption('ROE', lineColors.value.roeActual, '%', point => point.roe))
const roaOption = computed(() => miniOption('ROA', lineColors.value.roa, '%', point => point.roa))
const equityMultiplierOption = computed(() =>
  miniOption('權益乘數', lineColors.value.equityMultiplier, '×', point => point.dupont?.equityMultiplier ?? null)
)
</script>

<template>
  <el-card class="dupont-factor-level-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="dupont-factor-level-chart__header">
        <StockCardTitle title="杜邦分析" :info-text="INFO_TEXT" />
        <div class="dupont-factor-level-chart__header-actions">
          <el-select v-model="timeframeTab" size="default" class="dupont-factor-level-chart__basis-select" aria-label="期別（單季或近四季）">
            <el-option label="單季" value="單季" />
            <el-option label="近四季" value="近四季" />
          </el-select>
          <SharedLookbackWindowSelect v-model="activeTab" :disabled-years="disabledYears" />
        </div>
      </div>
    </template>

    <SharedEmptyState v-if="!pending && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" />
    <template v-else>
      <div class="dupont-factor-level-chart__grid">
        <div class="dupont-factor-level-chart__mini">
          <span class="dupont-factor-level-chart__mini-title">ROE 歷史走勢</span>
          <SharedChart v-loading="pending" class="dupont-factor-level-chart__mini-chart" :option="roeOption" :init-options="{ renderer: 'svg' }" autoresize />
        </div>
        <div class="dupont-factor-level-chart__mini">
          <span class="dupont-factor-level-chart__mini-title">ROA 歷史走勢</span>
          <SharedChart v-loading="pending" class="dupont-factor-level-chart__mini-chart" :option="roaOption" :init-options="{ renderer: 'svg' }" autoresize />
        </div>
        <div class="dupont-factor-level-chart__mini">
          <span class="dupont-factor-level-chart__mini-title">權益乘數歷史走勢</span>
          <SharedChart v-loading="pending" class="dupont-factor-level-chart__mini-chart" :option="equityMultiplierOption" :init-options="{ renderer: 'svg' }" autoresize />
        </div>
      </div>
      <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
    </template>
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

.dupont-factor-level-chart__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dupont-factor-level-chart__basis-select {
  width: 104px;
}

.dupont-factor-level-chart__grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dupont-factor-level-chart__mini-title {
  display: block;
  margin: 0 8px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.dupont-factor-level-chart__mini-chart {
  height: 8.75rem;
  width: 100%;
}
</style>
