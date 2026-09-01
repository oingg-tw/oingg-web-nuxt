<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { RadarChart } from 'echarts/charts'
import { RadarComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { StrategyScores } from '~/composables/stock/useStockDetail'

use([CanvasRenderer, RadarChart, RadarComponent, TooltipComponent])

// Six axes match bff-ts's own curated column-preset templates (GET
// /screener/column-preset-templates, confirmed live 2026-09-01) — same 存股領息/價值投資/
// 財務體質排雷/獲利品質拆解/成長型/技術面短線 split used in
// ScreenerOrganismNewColumnPresetDialog, just re-purposed here as a per-stock scorecard
// instead of a column-set picker. StrategyScores itself lives in useStockDetail.ts (its only
// real producer right now — seeded mock data, see generateStockDetail there); no backend
// endpoint scores an individual stock against these six strategies yet.
const props = defineProps<{
  scores: StrategyScores
}>()

const AXES: { key: keyof StrategyScores; label: string }[] = [
  { key: 'dividendIncome', label: '存股領息' },
  { key: 'valueInvesting', label: '價值投資' },
  { key: 'financialHealth', label: '財務體質排雷' },
  { key: 'profitabilityQuality', label: '獲利品質拆解' },
  { key: 'growthOriented', label: '成長型' },
  { key: 'technicalTrading', label: '技術面短線' }
]

interface RadarTooltipParam {
  value: number[]
}

const option = computed(() => ({
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  tooltip: {
    trigger: 'item',
    appendTo: 'body',
    backgroundColor: CHART_TOOLTIP.backgroundColor,
    borderColor: CHART_TOOLTIP.borderColor,
    textStyle: { color: CHART_INK.primary },
    formatter: (params: RadarTooltipParam) => {
      const rowStyle = 'display:flex;justify-content:space-between;gap:16px;padding:2px 0;'
      const rows = AXES.map(
        (axis, i) => `<div style="${rowStyle}"><span>${axis.label}</span><strong>${params.value[i]}</strong></div>`
      ).join('')
      return `<div style="font-size:12px;min-width:140px;">${rows}</div>`
    }
  },
  radar: {
    indicator: AXES.map(axis => ({ name: axis.label, max: 100 })),
    axisName: { color: CHART_INK.secondary, fontSize: 12 },
    splitLine: { lineStyle: { color: CHART_INK.gridline } },
    splitArea: { show: false },
    axisLine: { lineStyle: { color: CHART_INK.baseline } }
  },
  series: [
    {
      type: 'radar',
      data: [
        {
          value: AXES.map(axis => props.scores[axis.key]),
          lineStyle: { width: 2, color: CHART_ACCENT_GOLD },
          itemStyle: { color: CHART_ACCENT_GOLD },
          areaStyle: { color: CHART_ACCENT_GOLD, opacity: 0.25 }
        }
      ]
    }
  ]
}))
</script>

<template>
  <el-card class="radar-card" shadow="never" :body-style="{ padding: '4px 4px 8px' }">
    <template #header>
      <span class="radar-card__title">六面向評分</span>
    </template>
    <VChart class="radar-card__chart" :option="option" autoresize />
  </el-card>
</template>

<style scoped>
.radar-card {
  border-radius: 12px;
}

.radar-card__title {
  font-weight: 600;
}

.radar-card__chart {
  height: 280px;
  width: 100%;
}
</style>
