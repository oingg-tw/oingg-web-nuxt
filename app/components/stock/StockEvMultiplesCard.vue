<script setup lang="ts">
import type { LookbackWindow } from '~/utils/lookback-window'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'
import type { MetricsHistoryEntry, MetricsHistoryTimeframe } from '~/composables/stock/useMetricsHistory'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

// EV/EBITDA vs EV/EBIT 卡片 — REBUILT 2026-09-14 several times the same day:
//   1. 從單筆快照表格改成 small-multiples 歷史線圖（per "改成真的歷史線圖"）。
//   2. 兩張小圖合併成一張疊圖（per "請把這兩個線圖合併"，緊接著解釋完 EV/EBITDA vs EV/EBIT 的
//      關係之後）。
//   3. 拿掉右上角的 5 選 2 多選選單，改成固定只顯示 EV/EBITDA 與 EV/EBIT 這兩個（per direct
//      follow-up "EV 倍數家族 右上角的多選拿掉只保留目前預設這兩個 卡片也改名") —
//      evToFcf/evToOcf/evToSales 這三個原本在選單裡的指標，使用者確認之後想另外規劃（見對話中
//      「另外三個拆出來」的討論），不是這張卡的責任了；卡名跟著從「EV 倍數家族」改成
//      「EV/EBITDA vs EV/EBIT」，不再暗示這裡涵蓋全部 5 個 EV 倍數。
//   4. 加了近四季/單季下拉選單，隨即又拿掉（per direct follow-up "我看出一個問題，EV/EBITDA vs
//      EV/EBIT 請用 單季 右上角的選項拿掉"）——固定用 Q_ANN（單季年化），不給使用者切換，跟
//      TTM 一樣是這張卡固定的既定選擇，不是本次新增的可調整項。
//   5. 卡片標題（header 顯示、卡片挑選器 label）改為「現金獲利估值倍數」，per 直接要求
//      2026-09-15（"市場評價這邊卡片都幫我改名平易近人。EV/EBITDA vs EV/EBIT 太浮誇了"）——
//      量尺/圖表本身仍標示 EV/EBITDA、EV/EBIT 這兩個精確指標名稱（tooltip/圖例需要精確度），
//      只有卡片對外的標題换成一般讀者看得懂的說法。組件檔名/內部變數不變，避免無謂大改。
const props = defineProps<{
  symbol: string
}>()

// 超過本檔慣用的 30 字上限（見 feedback_info_text_30_char_limit 記憶）——2026-09-14 per 直接
// 要求（使用者問「EBITDA vs EBIT 差異是?」，回答完後接著說「你說的這些話請放進info」），保留完整
// 解釋而非壓縮成短句，屬於這張卡的刻意例外；el-tooltip 本來就有 maxWidth:280px，可以換行容納。
const INFO_TEXT =
  'EBITDA = EBIT + 折舊攤銷，更貼近現金獲利能力，適合比較資本密集產業；EV/EBITDA 通常小於 EV/EBIT（因為分母加回了折舊攤銷）'

const METRICS = [
  { code: 'evEbitda', label: 'EV/EBITDA' },
  { code: 'evToEbit', label: 'EV/EBIT' }
] as const
type MetricKey = (typeof METRICS)[number]['code']

const symbolRef = computed(() => props.symbol)
const activeTab = ref<LookbackWindow>('近5年')
const limit = computed(() => LOOKBACK_WINDOW_YEARS[activeTab.value] * 4)

// TTM/單季 toggle added 2026-09-14 ("要加上選項讓用戶可以選單季或是TTM"), REMOVED again the same
// day per direct follow-up ("我看出一個問題，EV/EBITDA vs EV/EBIT 請用 單季 右上角的選項拿掉") —
// fixed to Q_ANN, no user control. Reverted Q_ANN→TTM later the same day once analysis-ts removed
// the Q_ANN timeframe entirely (commit 054ae0b, cost-saving move affecting every metric, not just
// evEbitda/evToEbit) — these 2 metrics have no plain 'Q' field either, so TTM is now the only
// timeframe available at all, a known 稽核鏈 gap until analysis-ts adds a real 'Q' field.
const history = useMetricsHistory(symbolRef, ref(METRICS.map(metric => metric.code)), ref<MetricsHistoryTimeframe>('TTM'), limit)
const disabledYears = computed(() =>
  LOOKBACK_YEARS.filter(years => history.total.value !== null && history.total.value! < years * 4)
)

interface Point {
  label: string
  values: Record<MetricKey, number | null>
}

function periodLabel(entry: { fiscalYear: number; fiscalQuarter: number }): string {
  return `${entry.fiscalYear} Q${entry.fiscalQuarter}`
}

const points = computed<Point[]>(() =>
  (history.data.value ?? []).map((entry: MetricsHistoryEntry) => ({
    label: periodLabel(entry),
    values: Object.fromEntries(METRICS.map(metric => [metric.code, entry.values[metric.code]?.value ?? null])) as Record<MetricKey, number | null>
  }))
)

const hasAnyData = computed(() => points.value.some(point => METRICS.some(metric => point.values[metric.code] !== null)))

const latestPoint = computed(() => {
  const list = points.value
  for (let i = list.length - 1; i >= 0; i--) {
    if (METRICS.some(metric => list[i]!.values[metric.code] !== null)) return list[i]!
  }
  return null
})

const EV_COLORS = {
  DARK: { evEbitda: '#d4a72c', evToEbit: '#5b8ff9' },
  LIGHT: { evEbitda: '#aa841f', evToEbit: '#4984fd' }
} as const

const { resolvedMode, market } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
const lineColors = computed(() => EV_COLORS[resolvedMode.value])
// Site-wide up/down convention, same choice already made for StockValuationRiverChart.vue's own
// gauges (2.4.3's neutral-color rule overridden by direct instruction there) — these are the
// same kind of valuation-multiple percentile fact, kept consistent rather than picking a
// different palette per card.
const priceColors = computed(() => getPriceColors(resolvedMode.value, market.value))

// ============================================================================
// 摘要層量尺 (summary-layer gauge, 卡片軌元件選型規範 2.4.1/2.4.2) — one gauge per metric since
// both EV/EBITDA and EV/EBIT are independent "where does today's multiple sit in its own
// history" facts; only one shared toggle/expand (see SharedPercentileGaugeExpand.vue's own
// showToggle comment) since there's only one combined chart to reveal.
// ============================================================================

function formatMultiple(value: number): string {
  return `${value.toFixed(2)}倍`
}

const gaugeStatsByMetric = computed(() =>
  Object.fromEntries(
    METRICS.map(metric => {
      const values = points.value.map(point => point.values[metric.code]).filter((value): value is number => value !== null)
      const current = latestPoint.value?.values[metric.code] ?? null
      return [metric.code, computeGaugeStats(values, current)]
    })
  ) as Record<MetricKey, ReturnType<typeof computeGaugeStats>>
)

const chartExpanded = ref(false)

interface AxisTooltipParam {
  dataIndex?: number
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 8, top: 60, bottom: 24, containLabel: true },
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
      const rows = METRICS.map(metric => {
        const v = point.values[metric.code]
        return `<div style="${rowStyle}"><span>${metric.label}</span><strong>${v !== null ? `${v.toFixed(2)}倍` : '資料不足'}</strong></div>`
      }).join('')
      return `<div style="font-size:16px;min-width:180px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.label}</div>
        ${rows}
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
    name: '倍',
    nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
    splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  series: METRICS.map(metric => ({
    name: metric.label,
    type: 'line',
    showSymbol: true,
    symbolSize: 6,
    smooth: true,
    smoothMonotone: 'x',
    lineStyle: { width: 2.5, color: lineColors.value[metric.code] },
    itemStyle: { color: lineColors.value[metric.code] },
    data: points.value.map(point => point.values[metric.code])
  }))
}))
</script>

<template>
  <el-card class="ev-multiples-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="ev-multiples-chart__header">
        <span class="ev-multiples-chart__title">
          現金獲利估值倍數
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="ev-multiples-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <SharedLookbackWindowSelect v-model="activeTab" :disabled-years="disabledYears" />
      </div>
    </template>

    <el-empty v-if="!history.pending.value && !hasAnyData" description="這檔股票尚無歷史資料，可能尚未排入資料回填" :image-size="64" />
    <template v-else-if="gaugeStatsByMetric.evEbitda && gaugeStatsByMetric.evToEbit">
      <SharedPercentileGaugeExpand
        :expanded="chartExpanded"
        :show-toggle="false"
        :loading="history.pending.value"
        :current="gaugeStatsByMetric.evEbitda.current"
        :min="gaugeStatsByMetric.evEbitda.min"
        :max="gaugeStatsByMetric.evEbitda.max"
        :value-text="`EV/EBITDA ${formatMultiple(gaugeStatsByMetric.evEbitda.current)}`"
        :percentile-text="`${activeTab}第${Math.round(gaugeStatsByMetric.evEbitda.currentPercentile)}百分位・${gaugeBandLabel(gaugeStatsByMetric.evEbitda)}`"
        :format-scale-value="formatMultiple"
        :gradient-from="priceColors.down"
        :gradient-to="priceColors.up"
      />
      <SharedPercentileGaugeExpand
        v-model:expanded="chartExpanded"
        :loading="history.pending.value"
        :current="gaugeStatsByMetric.evToEbit.current"
        :min="gaugeStatsByMetric.evToEbit.min"
        :max="gaugeStatsByMetric.evToEbit.max"
        :value-text="`EV/EBIT ${formatMultiple(gaugeStatsByMetric.evToEbit.current)}`"
        :percentile-text="`${activeTab}第${Math.round(gaugeStatsByMetric.evToEbit.currentPercentile)}百分位・${gaugeBandLabel(gaugeStatsByMetric.evToEbit)}`"
        :format-scale-value="formatMultiple"
        :gradient-from="priceColors.down"
        :gradient-to="priceColors.up"
        expand-label="展開看歷史走勢"
        collapse-label="收合走勢圖"
      >
        <VChart v-loading="history.pending.value" class="ev-multiples-chart__chart" :option="option" autoresize />
        <SharedDataFreshnessNote source-label="公開發行公司財務報表" :as-of="latestPoint?.label ?? null" />
      </SharedPercentileGaugeExpand>
    </template>
    <el-empty v-else description="資料不足以計算歷史分位，可能尚未累積足夠期數" :image-size="64" />
  </el-card>
</template>

<style scoped>
.ev-multiples-chart {
  border-radius: 12px;
}

.ev-multiples-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.ev-multiples-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.ev-multiples-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.ev-multiples-chart__chart {
  height: 260px;
  width: 100%;
}
</style>
