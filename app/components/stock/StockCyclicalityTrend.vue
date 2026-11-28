<script setup lang="ts">
// 年度營業利益率的點與趨勢線（景氣循環度的獲利起伏量的就是這個：每年離長期趨勢線多遠；2026-11-28，設計圖
// https://claude.ai/artifact/MnW2nnuXRFn2TTiJUNThN5）。十個點的圖直接畫，不經 ECharts：伺服器的 HTML 裡就有，手機不用等圖表庫。
// 線是橫向拉伸的 SVG（preserveAspectRatio none、線寬不跟著縮放），點與字是 HTML：卡片的高度固定、寬度不定，圖要撐滿寬度，字與圓點不能變形。
// 高度由外面給（--cycle-trend-height）：指標速覽的卡片矮一點，個股頁高一點。整張圖是 role="img" 加一句完整的替代文字
import type { CyclicalityTrend } from '~/utils/cyclicality'

defineProps<{ trend: CyclicalityTrend, label: string }>()
</script>

<template>
  <div class="cycle-trend" role="img" :aria-label="label">
    <div class="cycle-trend__plot">
      <svg class="cycle-trend__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line class="cycle-trend__zero" x1="0" :y1="trend.zero" x2="100" :y2="trend.zero" />
        <line v-for="stem in trend.stems" :key="stem.x" class="cycle-trend__stem" :x1="stem.x" :y1="stem.y1" :x2="stem.x" :y2="stem.y2" />
        <line class="cycle-trend__trend" :x1="trend.line[0]" :y1="trend.line[1]" :x2="trend.line[2]" :y2="trend.line[3]" />
      </svg>
      <span
        v-for="dot in trend.dots"
        :key="dot.year"
        class="cycle-trend__dot"
        :class="dot.capped && `cycle-trend__dot--${dot.capped}`"
        :style="{ left: `${dot.x}%`, top: `${dot.y}%` }"
      />
      <span
        v-for="item in trend.labels"
        :key="item.text"
        class="cycle-trend__label"
        :class="[`cycle-trend__label--${item.align}`, { 'cycle-trend__label--below': item.below }]"
        :style="{ left: `${item.x}%`, top: `${item.y}%` }"
      >{{ item.text }}</span>
      <span v-if="trend.zeroLabel" class="cycle-trend__zero-label" :class="`cycle-trend__zero-label--${trend.zeroLabel}`" :style="{ top: `${trend.zero}%` }">0%</span>
    </div>
    <p class="cycle-trend__years"><span>{{ trend.years[0] }}</span><span>{{ trend.years[1] }}</span></p>
  </div>
</template>

<style scoped>
.cycle-trend {
  font-size: 0.875rem;
  line-height: 1;
  color: var(--el-text-color-secondary);
}

/* 圖面上下各留一列字的高度（最高那一年的數字在點上面、最低的在點下面：字 0.875rem 加 8px），左右留半個圓點 */
.cycle-trend__plot {
  position: relative;
  height: var(--cycle-trend-height, 9rem);
  margin: calc(0.875rem + 8px) 5px;
}

.cycle-trend__lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.cycle-trend__lines line {
  vector-effect: non-scaling-stroke;
}

.cycle-trend__zero {
  stroke: var(--el-border-color);
}

.cycle-trend__stem {
  stroke: var(--el-border-color);
}

.cycle-trend__trend {
  stroke: var(--el-text-color-secondary);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
}

.cycle-trend__dot {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-primary);
  transform: translate(-50%, -50%);
}

/* 超過 ±100% 畫在邊上的年度：箭頭朝外（全站利益率圖的規則，app/utils/margin-cap.ts） */
.cycle-trend__dot--up,
.cycle-trend__dot--down {
  width: 10px;
  height: 10px;
  border-radius: 0;
  clip-path: polygon(50% 0, 100% 100%, 50% 75%, 0 100%);
}

.cycle-trend__dot--down {
  transform: translate(-50%, -50%) rotate(180deg);
}

.cycle-trend__label {
  position: absolute;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  transform: translate(-50%, calc(-100% - 8px));
}

.cycle-trend__label--below {
  transform: translate(-50%, 8px);
}

.cycle-trend__label--start {
  transform: translate(-5px, calc(-100% - 8px));
}

.cycle-trend__label--start.cycle-trend__label--below {
  transform: translate(-5px, 8px);
}

.cycle-trend__label--end {
  transform: translate(calc(-100% + 5px), calc(-100% - 8px));
}

.cycle-trend__label--end.cycle-trend__label--below {
  transform: translate(calc(-100% + 5px), 8px);
}

/* 「0%」寫在線的上面、靠那一端 */
.cycle-trend__zero-label {
  position: absolute;
  transform: translateY(calc(-100% - 3px));
}

.cycle-trend__zero-label--start {
  left: 0;
}

.cycle-trend__zero-label--end {
  right: 0;
}

.cycle-trend__years {
  margin: 0;
  display: flex;
  justify-content: space-between;
  font-variant-numeric: tabular-nums;
}
</style>
