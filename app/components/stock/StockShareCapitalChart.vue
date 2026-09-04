<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { CHANGE_SOURCE_LABELS, type CapitalStockEntry } from '~/composables/stock/useCapitalStockHistory'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const props = defineProps<{
  entries: CapitalStockEntry[]
}>()

// '近5年'/'近10年' matches the same lookback-window convention as the PER/PBR river charts
// (docs/investment-knowledge/基本面財報觀察年限分析.md) — this is an event series (0 or several rows
// a year, only when a real capital change happened), not a fixed-cadence series, so "近5年"
// here means "any entry effective in the last 5 years", not "the last 5 entries".
const TAB_OPTIONS = ['近5年', '近10年'] as const
const activeTab = ref<(typeof TAB_OPTIONS)[number]>('近5年')

function entriesWithinYears(years: number): CapitalStockEntry[] {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - years)
  const cutoffLabel = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`
  return props.entries.filter(entry => entry.effectiveDate >= cutoffLabel)
}

const filteredEntries = computed(() => entriesWithinYears(activeTab.value === '近5年' ? 5 : 10))

// This is an EVENT series, not a fixed-cadence one — a company that hasn't changed its capital
// in the last 8 years genuinely has the same "近5年" and "近10年" result, which reads as "the
// tab click did nothing" (reported live) unless it's explained. Only shown once the two windows
// actually produce the same count, so it doesn't clutter a company with a real difference
// between them.
const windowsAreIdentical = computed(() => entriesWithinYears(5).length === entriesWithinYears(10).length)

// bigint doesn't survive JSON or arithmetic with Number directly at this scale without care,
// but paidInShares/paidInCapital are well within Number's safe range for any real Taiwan-listed
// company (low billions at most) — converting once here for chart/display math is fine.
function sharesInHundredMillion(shares: bigint | null): number | null {
  return shares === null ? null : Number(shares) / 1e8
}

function formatAmount(amount: bigint): string {
  return `${(Number(amount) / 1e8).toLocaleString('zh-TW', { maximumFractionDigits: 2 })} 億`
}

function tooltipHtml(entry: CapitalStockEntry): string {
  const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
  const shares = sharesInHundredMillion(entry.paidInShares)
  const rows = [`<div style="${rowStyle}"><span>流通股數</span><strong>${shares === null ? '—' : `${shares.toLocaleString('zh-TW', { maximumFractionDigits: 2 })} 億股`}</strong></div>`]
  for (const { source, amount } of entry.changeSources) {
    rows.push(`<div style="${rowStyle}"><span>${CHANGE_SOURCE_LABELS[source]}</span><strong>${formatAmount(amount)}</strong></div>`)
  }
  if (entry.other) rows.push(`<div style="padding:2px 0;">${entry.other}</div>`)
  if (entry.remarks) rows.push(`<div style="padding:2px 0;color:${CHART_INK.secondary};">${entry.remarks}</div>`)
  return `<div style="font-size:12px;min-width:160px;">
    <div style="font-weight:600;margin-bottom:4px;">${entry.effectiveDate}</div>
    ${rows.join('')}
  </div>`
}

interface AxisTooltipParam {
  dataIndex?: number
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 8, top: 16, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: CHART_INK.baseline } },
    appendTo: 'body',
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
    textStyle: { color: CHART_INK.primary },
    formatter: (params: AxisTooltipParam | AxisTooltipParam[]) => {
      const list = Array.isArray(params) ? params : [params]
      const dataIndex = list[0]?.dataIndex ?? 0
      const entry = filteredEntries.value[dataIndex]
      return entry ? tooltipHtml(entry) : ''
    }
  },
  xAxis: {
    type: 'category',
    data: filteredEntries.value.map(entry => entry.effectiveDate),
    axisLine: { lineStyle: { color: CHART_INK.baseline } },
    axisTick: { show: false },
    axisLabel: { color: CHART_INK.muted, fontSize: 11 }
  },
  yAxis: {
    type: 'value',
    name: '億股',
    nameTextStyle: { color: CHART_INK.muted, fontSize: 11 },
    scale: true,
    splitLine: { lineStyle: { color: CHART_INK.gridline, type: 'solid' } },
    axisLabel: { color: CHART_INK.muted, fontSize: 11 }
  },
  series: [
    {
      name: '流通股數',
      type: 'line',
      // 'end' step, not a smooth curve — the real number only actually changes at each
      // recorded event and is otherwise flat, so a stepped line reads as "held steady, then
      // jumped" instead of implying a gradual drift between two known points that never
      // happened.
      step: 'end',
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: CHART_ACCENT_GOLD },
      itemStyle: { color: CHART_ACCENT_GOLD },
      data: filteredEntries.value.map(entry => sharesInHundredMillion(entry.paidInShares))
    }
  ]
}))
</script>

<template>
  <el-card class="share-capital-chart" shadow="never">
    <template #header>
      <div class="share-capital-chart__header">
        <span class="share-capital-chart__title">股本變化</span>
        <div class="share-capital-chart__tabs">
          <button
            v-for="tab in TAB_OPTIONS"
            :key="tab"
            type="button"
            class="share-capital-chart__tab"
            :class="{ 'is-active': tab === activeTab }"
            @click="activeTab = tab"
          >{{ tab }}</button>
        </div>
      </div>
    </template>

    <el-empty v-if="!filteredEntries.length" description="這段期間沒有股本變動紀錄" :image-size="64" />
    <VChart v-else class="share-capital-chart__chart" :option="option" autoresize />

    <!-- 庫藏股/可轉債轉換 have no structured field on this endpoint (confirmed with
         analysis-ts 2026-09-04) — they only ever show up as free text in an entry's own
         remarks, shown verbatim in the tooltip above rather than parsed into a number. -->
    <p class="share-capital-chart__note">滑鼠移至資料點可查看股本變動來源；庫藏股、可轉債轉換等異動僅顯示原始文字說明</p>
    <p v-if="windowsAreIdentical && filteredEntries.length" class="share-capital-chart__note">
      近5年與近10年結果相同，代表這段期間內的股本變動紀錄本來就一致，並非切換無效
    </p>
  </el-card>
</template>

<style scoped>
.share-capital-chart {
  border-radius: 12px;
}

.share-capital-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.share-capital-chart__title {
  font-weight: 600;
}

.share-capital-chart__tabs {
  display: flex;
  gap: 4px;
}

.share-capital-chart__tab {
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color-lighter);
  background: transparent;
  cursor: pointer;
}

.share-capital-chart__tab.is-active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.share-capital-chart__chart {
  height: 240px;
  width: 100%;
}

.share-capital-chart__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
