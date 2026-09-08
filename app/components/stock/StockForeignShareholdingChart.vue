<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { InfoFilled } from '@element-plus/icons-vue'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

// 30-char strict cap (standing rule, see feedback_info_text_30_char_limit memory).
const INFO_TEXT = '外資持股比例的歷史變化，屬客觀籌碼統計'

// Built per conductor's docs/3_audiences/前端工程師/個股瀏覽.md 第5之二節規格
// ("個股瀏覽增加一張外資持股卡片"), against the real GET /stocks/:symbol/foreign-shareholding-
// history endpoint bff-ts shipped 2026-09-08 (commit af4b3cf) — see
// useForeignShareholdingHistory.ts's own comment for the endpoint's contract quirks (reversed
// ordering, limit default/max, no total/hasMore).
//
// Deliberately narrower than the doc's own full spec, per the doc's OWN documented data-
// availability caveat and this app's "don't fabricate" ethos:
// - Only 2330 has any backfilled data (twse-ts's one-time historical load); every other symbol
//   gets an explicit "尚未提供" empty state, never a silently-empty chart that could read as
//   "外資持股 0%".
// - Single line only (外資持股比例 — sharesHeldPercent), per the doc's own explicit mandate
//   ("非雙折線，只呈現外資持股比例一條線") — no overlaid institution-type comparison, no pie
//   chart of investor-type composition (both explicitly forbidden by the doc's chart-selection
//   framework for this exact use case).
// - No 買賣超金額/短期籌碼情緒 sub-view — the backfilled data only has END-OF-DAY shareholding
//   percentage/share counts, not day-over-day net-buy amounts, so a "近20日買賣超金額" reading
//   would have to be derived (share-count delta × unknown daily price) rather than read directly
//   from a real field; left out rather than approximated.
// - No simplified/expert-mode split — this page's own mode toggle (卡片/會計, see stock/[code].
//   vue's own comment) is NOT a novice/pro split like dashboard.vue's, so there is no existing
//   "簡易軌" to gate a stripped-down single-number view behind. One unified view for everyone.
const props = defineProps<{
  symbol: string
}>()

const symbolRef = computed(() => props.symbol)
const { data: entries, pending } = useForeignShareholdingHistory(symbolRef)

type Window = '短期' | '中期' | '長期'
// 中期 default per the doc's own instruction ("預設顯示中期（3個月），避免簡易軌使用者一次看到
// 過多資訊") — this page has no 簡易軌 to protect, but the underlying reasoning (don't default
// to the most cluttered view) still applies generally.
const activeWindow = ref<Window>('中期')

// Daily data — window sizes are trading-day counts, not calendar-day math, matching how the
// doc itself frames them ("近20個交易日" / 一年約 250 個交易日, matching every other TTM/4-季
// convention on this page rather than switching to calendar-day slicing just for this one card).
const WINDOW_DAYS: Record<Window, number> = { 短期: 20, 中期: 60, 長期: 250 }

const hasAnyData = computed(() => (entries.value?.length ?? 0) > 0)

const windowedEntries = computed(() => {
  const list = entries.value ?? []
  const days = WINDOW_DAYS[activeWindow.value]
  return list.slice(Math.max(0, list.length - days))
})

const latest = computed(() => {
  const list = entries.value
  return list && list.length > 0 ? list[list.length - 1]! : null
})

const { resolvedMode } = useAppTheme()
const chartInk = computed(() => getChartInk(resolvedMode.value))
// Fixed, not accent-linked — this card's line needs to read consistently regardless of the
// user's chosen theme accent, same reasoning as the DuPont-family charts' own fixed palettes.
const LINE_COLOR = { DARK: '#5ac8c8', LIGHT: '#2f9797' }
const lineColor = computed(() => LINE_COLOR[resolvedMode.value])

interface AxisTooltipParam {
  dataIndex?: number
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  grid: { left: 8, right: 8, top: 16, bottom: 28, containLabel: true },
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
      const point = windowedEntries.value[dataIndex]
      if (!point) return ''
      return `<div style="font-size:16px;min-width:150px;">
        <div style="font-weight:600;margin-bottom:4px;">${point.tradeDate}</div>
        <div style="display:flex;justify-content:space-between;gap:16px;"><span>外資持股比例</span><strong>${point.sharesHeldPercent.toFixed(2)}%</strong></div>
      </div>`
    }
  },
  xAxis: {
    type: 'category',
    data: windowedEntries.value.map(entry => entry.tradeDate),
    axisLine: { lineStyle: { color: chartInk.value.baseline } },
    axisTick: { show: false },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  yAxis: {
    type: 'value',
    name: '%',
    nameTextStyle: { color: chartInk.value.muted, fontSize: 16 },
    scale: true,
    splitLine: { lineStyle: { color: chartInk.value.gridline, type: 'solid' } },
    axisLabel: { color: chartInk.value.muted, fontSize: 16 }
  },
  series: [
    {
      name: '外資持股比例',
      type: 'line',
      showSymbol: true,
      symbolSize: 8,
      smooth: false,
      lineStyle: { width: 2.5, color: lineColor.value },
      itemStyle: { color: lineColor.value },
      data: windowedEntries.value.map(entry => entry.sharesHeldPercent)
    }
  ]
}))
</script>

<template>
  <el-card class="foreign-shareholding-chart" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <div class="foreign-shareholding-chart__header">
        <span class="foreign-shareholding-chart__title">
          外資持股比例變化
          <el-tooltip :content="INFO_TEXT" placement="top" :popper-style="{ maxWidth: '280px' }">
            <el-icon class="foreign-shareholding-chart__info"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
        <el-select v-if="hasAnyData" v-model="activeWindow" class="foreign-shareholding-chart__window" size="default">
          <el-option label="短期（近20交易日）" value="短期" />
          <el-option label="中期（近3個月）" value="中期" />
          <el-option label="長期（近1年）" value="長期" />
        </el-select>
      </div>
    </template>

    <el-empty
      v-if="!pending && !hasAnyData"
      description="這檔股票尚未提供外資持股歷史資料"
      :image-size="64"
    />
    <template v-else>
      <VChart v-loading="pending" class="foreign-shareholding-chart__chart" :option="option" autoresize />
      <SharedDataFreshnessNote source-label="TWSE T86 報表，每日 T+1 揭露" :as-of="latest?.tradeDate ?? null" />
    </template>
  </el-card>
</template>

<style scoped>
.foreign-shareholding-chart {
  border-radius: 12px;
}

.foreign-shareholding-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.foreign-shareholding-chart__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.foreign-shareholding-chart__info {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.foreign-shareholding-chart__window {
  width: 170px;
}

.foreign-shareholding-chart__chart {
  height: 260px;
  width: 100%;
}

</style>
