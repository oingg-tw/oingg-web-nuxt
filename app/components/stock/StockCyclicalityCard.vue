<script setup lang="ts">
import type { CyclicalityBreakdown } from '~/utils/cyclicality'

// 指標速覽的「景氣循環度」卡片（2026-11-28，能釘、不在預設裡；設計圖 https://claude.ai/artifact/MnW2nnuXRFn2TTiJUNThN5）：位置條與所屬產業的中位數、
// 四項特徵各自的百分位、年度營業利益率的點與趨勢線。百分位的數字寫在卡片的標題列（呼叫端的 header，同其他指標卡片「標題後面接最新數值」）。
// 跟圖表卡的骨架一樣高：窄卡片 363、寬卡片 343，放得進 372 與 360，同一列不會被它撐高。沒有分數時寫原因（不適用的是哪些公司、要幾年），
// 讀不到（breakdown 是 null）留空，同全站「讀不到不說沒有資料」
const props = defineProps<{ breakdown: CyclicalityBreakdown | null, shortName: string }>()
defineSlots<{ header: () => unknown }>()

const value = computed(() => (typeof props.breakdown?.value === 'number' ? props.breakdown.value : null))
const sector = computed(() => cyclicalitySector(props.breakdown, SECTORS))
const items = computed(() => cyclicalityItems(props.breakdown))
const margin = computed(() => props.breakdown?.profitSwing?.operatingMargin)
const trend = computed(() => cyclicalityTrend(margin.value))
const caption = computed(() => cyclicalityTrendCaption(margin.value))
</script>

<template>
  <SharedChartCard>
    <template #header><slot name="header" /></template>
    <div v-if="breakdown" class="cycle-card">
      <template v-if="value !== null">
        <StockCyclicalityPosition :value="value" :sector="sector" compact />
        <dl class="cycle-card__items">
          <div v-for="item in items" :key="item.key">
            <dt>{{ item.label }}</dt>
            <dd>{{ percentileLabel(item.percentile, item.nullReason) }}</dd>
          </div>
        </dl>
        <StockCyclicalityTrend v-if="trend" class="cycle-card__trend" :trend="trend" :label="cyclicalityTrendLabel(shortName, trend, margin)" />
        <p v-if="caption" class="cycle-card__caption">{{ caption }}</p>
      </template>
      <p v-else class="cycle-card__empty">{{ cyclicalityMissingText(breakdown.nullReason) }}</p>
    </div>
  </SharedChartCard>
</template>

<style scoped>
/* 最小高度同其他卡片讀取中的佔位（窄 44＋8＋320、520 起 32＋8＋320；pages/stock/[code]/index.vue 的 BODY_DEFAULTS 照這兩個數字，改這裡要一起改）。
   內容：位置 64＋四項 53＋圖（上下各一列字 44＋圖面 128＋年份 14）＋圖說（窄卡片兩行 40、寬卡片一行 20）＋間距，窄 363、寬 343 */
.cycle-card {
  --cycle-trend-height: 8rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: calc(44px + 8px + 320px);
}

@container (min-width: 520px) {
  .cycle-card {
    min-height: calc(32px + 8px + 320px);
  }
}

.cycle-card__items {
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid var(--app-divider);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  text-align: center;
  line-height: 1.4;
}

.cycle-card__items dt {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
}

.cycle-card__items dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.cycle-card__trend {
  padding-top: 4px;
  border-top: 1px solid var(--app-divider);
}

.cycle-card__caption {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.cycle-card__empty {
  margin: 0;
  color: var(--el-text-color-regular);
}
</style>
