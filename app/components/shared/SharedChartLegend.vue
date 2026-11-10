<script setup lang="ts">
// 圖表的圖例與單位，全站一種畫法（2026-11-02，使用者：兩條 Y 軸照舊，「但是調整樣式與單位呈現看能不能爭取空間」）：圖上方一列 HTML，
// 單位寫在這一列的兩端——左軸的在最左、右軸的在最右，各在自己的刻度上方，Y 軸上方不再另印一列單位（圖裡的 yAxis 不給 name）。
// HTML 自己換行，圖裡不必猜要預留幾列，也不會像 ECharts 的圖例那樣折行時壓到單位（類股月營收的「%」蓋在「景氣收縮期」上）。
// 放不下時右軸那組換到下一列、靠右。圖例只是說明，不能點（同 SharedChart 的 withStaticLegend）。
export interface ChartLegendItem {
  name: string
  color: string
  // line＝線（dash、symbol）；bar＝實心方塊；band＝淡色底（區段）；outline＝虛線框（市場事件的日收盤急跌段）；dot＝單獨一個點（類股發放率的中位數）
  kind: 'line' | 'bar' | 'band' | 'outline' | 'dot'
  dash?: 'solid' | 'dashed' | 'dotted'
  symbol?: 'circle' | 'emptyCircle' | 'triangle' | 'rect' | 'diamond' | 'none'
}
export interface ChartLegendGroup { unit?: string; items: ChartLegendItem[]; right?: boolean }

defineProps<{ groups: ChartLegendGroup[] }>()

const DASHES = { solid: undefined, dashed: '6 4', dotted: '2 3' } as const
</script>

<template>
  <div class="shared-chart-legend">
    <p v-for="(group, groupIndex) in groups" :key="groupIndex" class="shared-chart-legend__group" :class="{ 'shared-chart-legend__group--right': group.right }">
      <span v-if="group.unit" class="shared-chart-legend__unit">{{ group.unit }}</span>
      <span v-for="item in group.items" :key="item.name" class="shared-chart-legend__item">
        <svg viewBox="0 0 28 14" width="28" height="14" aria-hidden="true">
          <rect v-if="item.kind === 'bar'" x="8" y="2" width="12" height="10" rx="2" :fill="item.color" />
          <rect v-else-if="item.kind === 'band'" x="5" y="2" width="18" height="10" :fill="item.color" fill-opacity="0.16" :stroke="item.color" stroke-opacity="0.5" />
          <rect v-else-if="item.kind === 'outline'" x="5.5" y="2.5" width="17" height="9" fill="none" :stroke="item.color" stroke-dasharray="3 2" />
          <circle v-else-if="item.kind === 'dot'" cx="14" cy="7" r="5" :fill="item.color" />
          <template v-else>
            <line x1="1" y1="7" x2="27" y2="7" :stroke="item.color" stroke-width="2.5" :stroke-dasharray="DASHES[item.dash ?? 'solid']" />
            <circle v-if="item.symbol === 'circle'" cx="14" cy="7" r="4" :fill="item.color" />
            <circle v-else-if="item.symbol === 'emptyCircle'" cx="14" cy="7" r="3.5" :stroke="item.color" stroke-width="2" style="fill: var(--el-card-bg-color, #fff)" />
            <rect v-else-if="item.symbol === 'rect'" x="10" y="3" width="8" height="8" :fill="item.color" />
            <polygon v-else-if="item.symbol === 'triangle'" points="14,2 18.5,11 9.5,11" :fill="item.color" />
            <polygon v-else-if="item.symbol === 'diamond'" points="14,1.5 19.5,7 14,12.5 8.5,7" :fill="item.color" />
          </template>
        </svg>{{ item.name }}
      </span>
    </p>
  </div>
</template>

<style scoped>
.shared-chart-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 16px;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--el-text-color-regular);
}

.shared-chart-legend__group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  margin: 0;
}

.shared-chart-legend__group--right {
  justify-content: flex-end;
  margin-left: auto;
}

.shared-chart-legend__group--right .shared-chart-legend__unit {
  order: 1;
}

.shared-chart-legend__unit {
  color: var(--el-text-color-secondary);
}

.shared-chart-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
</style>
