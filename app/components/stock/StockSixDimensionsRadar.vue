<script setup lang="ts">
// 六面向的雷達圖（2026-11-27，設計圖 https://claude.ai/artifact/FWP3mJfa44md4csrM31MAb）。直接畫成 SVG，不經 ECharts：六個點的幾何很簡單，
// SVG 在伺服器的 HTML 裡就有，不用等圖表庫、也不會先留一個空框。軸名與數字是 HTML（格線排在圖的四周），不是 SVG 的字：圖可以隨
// 容器縮放，字永遠是內文的大小（SVG 的字會跟著圖一起縮，手機上會小於 16px）。單色、不分高低的顏色：高低只是位置。虛線那一圈是 50。
// 數字同時在旁邊的表格；圖是 role="img" 加一句完整的替代文字，四周的字對輔助科技隱藏，不重複念
const props = defineProps<{
  // 六個軸：0 正上，順時針（1 右上、2 右下、3 正下、4 左下、5 左上）
  axes: { label: string; value: number | null }[]
  label: string
}>()

// 圖本身的座標：半徑 100，四周留 6 給頂點的圓點
const RADIUS = 100
const geometry = computed(() => radarGeometry(props.axes.map(axis => axis.value), RADIUS))
const outerRings = computed(() => geometry.value.rings.filter(ring => ring.percent !== 50))
const middleRing = computed(() => geometry.value.rings.find(ring => ring.percent === 50)?.points ?? '')
</script>

<template>
  <div class="six-radar">
    <div class="six-radar__layout">
      <svg class="six-radar__plot" role="img" :aria-label="label" viewBox="-93 -106 186 212">
        <g class="six-radar__grid">
          <polygon v-for="ring in outerRings" :key="ring.percent" :points="ring.points" />
          <line v-for="(spoke, index) in geometry.spokes" :key="index" x1="0" y1="0" :x2="spoke[0]" :y2="spoke[1]" />
        </g>
        <polygon class="six-radar__middle" :points="middleRing" />
        <path v-if="geometry.fill" class="six-radar__fill" :d="geometry.fill" />
        <path v-if="geometry.line" class="six-radar__line" :d="geometry.line" />
        <template v-for="(dot, index) in geometry.dots" :key="index">
          <circle v-if="dot" class="six-radar__dot" :cx="dot[0]" :cy="dot[1]" r="5" />
        </template>
      </svg>
      <p v-for="(axis, index) in axes" :key="axis.label" :class="`six-radar__label six-radar__label--${index}`" aria-hidden="true">
        <span>{{ axis.label }}</span>
        <span :class="axis.value === null ? 'six-radar__missing' : 'six-radar__value'">{{ percentileLabel(axis.value) }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.six-radar {
  container-type: inline-size;
}

/* 窄的時候（手機、指標速覽的格子）：圖撐滿寬度，最寬 15rem；六個軸名排在圖的上面一列、下面一列，左右兩個各靠自己那一側的角。
   軸名放圖的兩旁要吃掉 144px，320 寬的手機上圖只剩 87px */
.six-radar__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  grid-template-areas:
    'a5 a0 a1'
    'plot plot plot'
    'a4 a3 a2';
  align-items: center;
  gap: 4px 8px;
  max-width: 15rem;
  margin-inline: auto;
}

/* 352px 以上軸名放回圖的兩旁、各自貼著自己的軸：軸名 64＋間距 8＋圖至少 208＋間距 8＋軸名 64。圖跨兩列，左右的軸名各在一列的中間，
   也就是圖高的 1/4 與 3/4，側邊四個軸的外端就在那裡 */
@container (min-width: 352px) {
  .six-radar__layout {
    grid-template-columns: max-content minmax(0, 15rem) max-content;
    grid-template-areas:
      '. a0 .'
      'a5 plot a1'
      'a4 plot a2'
      '. a3 .';
    justify-content: center;
    max-width: none;
  }
}

.six-radar__plot {
  grid-area: plot;
  display: block;
  width: 100%;
  height: auto;
}

.six-radar__grid {
  fill: none;
  stroke: var(--app-divider);
}

.six-radar__middle {
  fill: none;
  stroke: var(--el-text-color-secondary);
  stroke-dasharray: 5 4;
}

.six-radar__fill {
  fill: var(--el-color-primary);
  fill-opacity: 0.14;
}

.six-radar__line {
  fill: none;
  stroke: var(--el-color-primary);
  stroke-width: 2;
  stroke-linecap: round;
}

/* 線寬不跟著圖縮放：圖縮小時線還是 1px、2px */
.six-radar__grid,
.six-radar__middle,
.six-radar__line,
.six-radar__dot {
  vector-effect: non-scaling-stroke;
}

.six-radar__dot {
  fill: var(--el-color-primary);
  stroke: var(--app-card-bg);
  stroke-width: 2;
}

.six-radar__label {
  margin: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.35;
  white-space: nowrap;
  text-align: center;
}

.six-radar__label--0 { grid-area: a0; }
.six-radar__label--1 { grid-area: a1; text-align: right; }
.six-radar__label--2 { grid-area: a2; text-align: right; }
.six-radar__label--3 { grid-area: a3; }
.six-radar__label--4 { grid-area: a4; text-align: left; }
.six-radar__label--5 { grid-area: a5; text-align: left; }

@container (min-width: 352px) {
  .six-radar__label--1,
  .six-radar__label--2 {
    text-align: left;
  }

  .six-radar__label--4,
  .six-radar__label--5 {
    text-align: right;
  }
}

.six-radar__value {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.six-radar__missing {
  color: var(--el-text-color-secondary);
}
</style>
