<script setup lang="ts">
// 景氣循環度的位置（2026-11-28，設計圖 https://claude.ai/artifact/MnW2nnuXRFn2TTiJUNThN5）：百分位的數字、0 到 100 的位置條，條上一格是所屬產業的
// 中位數（讀者的參照：先看產業、再看這家公司）。只寫位置，不分高中低、不貼標籤（見 app/utils/cyclicality.ts 開頭）。個股頁與指標速覽的卡片共用；
// 卡片的數字寫在卡片的標題列（compact），這裡只留兩端是什麼那一句。位置條只是輔助（數字與產業那一句都是文字），對輔助科技隱藏
import type { CyclicalitySector } from '~/utils/cyclicality'

defineProps<{ value: number, sector: CyclicalitySector | null, compact?: boolean }>()
</script>

<template>
  <div class="cycle-position">
    <p class="cycle-position__head">
      <template v-if="!compact">
        <span class="cycle-position__unit">百分位</span>
        <strong class="cycle-position__value">{{ Math.round(value) }}</strong>
      </template>
      <span class="cycle-position__scale">0 最不像景氣循環股、100 最像</span>
    </p>
    <div class="cycle-position__track" aria-hidden="true">
      <span v-if="sector" class="cycle-position__tick" :style="{ left: `${sector.median}%` }" />
      <span class="cycle-position__dot" :style="{ '--cycle-at': `${value}%` }" />
    </div>
    <!-- 產業那一句跟著那一格走：兩邊的空白照比例分（中位數 51 就是 51：49），所以字的中心在中間時對著那一格、靠邊時自己貼邊，不會超出卡片 -->
    <p v-if="sector" class="cycle-position__sector" :style="{ '--cycle-before': sector.median, '--cycle-after': 100 - sector.median }">{{ cyclicalitySectorText(sector) }}</p>
  </div>
</template>

<style scoped>
.cycle-position {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cycle-position__head {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 8px;
  line-height: 1.4;
}

.cycle-position__unit,
.cycle-position__scale,
.cycle-position__sector {
  color: var(--el-text-color-secondary);
  font-size: 0.875rem;
}

.cycle-position__value {
  font-size: 2rem;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.cycle-position__track {
  position: relative;
  height: 16px;
}

.cycle-position__track::before {
  content: '';
  position: absolute;
  inset: 5px 0;
  border-radius: 3px;
  background: var(--el-fill-color);
}

.cycle-position__tick {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 2px solid var(--el-text-color-secondary);
  transform: translateX(-1px);
}

/* 圓點不超出位置條的兩端：百分位 99 的圓心往內收半個圓點 */
.cycle-position__dot {
  position: absolute;
  top: 0;
  left: clamp(8px, var(--cycle-at), 100% - 8px);
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  border: 2px solid var(--app-card-bg);
  border-radius: 50%;
  background: var(--el-color-primary);
  transform: translateX(-50%);
}

.cycle-position__sector {
  margin: 0;
  display: flex;
  line-height: 1.4;
  white-space: nowrap;
}

.cycle-position__sector::before,
.cycle-position__sector::after {
  content: '';
}

.cycle-position__sector::before {
  flex: var(--cycle-before) 1 0;
}

.cycle-position__sector::after {
  flex: var(--cycle-after) 1 0;
}
</style>
