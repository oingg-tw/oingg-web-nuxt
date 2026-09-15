<script setup lang="ts">
import { ArrowUp, ArrowDown } from '@element-plus/icons-vue'

// 摘要層量尺 + 就地展開 (卡片軌元件選型規範 2.4, 2026-09-15訂立, 跨全部卡片通用) — extracted out
// of StockValuationRiverChart.vue, the pattern's first adopter, once the user asked for it as a
// shared component ("這樣的模式請抽成元件，好統一格式") so every later card that needs to show
// "where does this single value sit in its own history/peer range" (PBR percentile, ROE vs
// peers, dividend yield range, …) renders the same gauge shape instead of a bespoke one. Named
// neutrally (not e.g. "River") since the pattern itself — gauge by default, full chart/table only
// on demand — is meant to apply across every card family the spec covers, not just river charts.
//
// Deliberately does NOT own the underlying stats math (percentile/rank) or the wording of the
// value/percentile line — those are domain-specific (a multiple vs a percentage vs a peer count)
// and stay with the caller (see app/utils/percentile.ts for the two calculations every caller
// shares). This component only owns the visual shape: value+percentile line, gradient bar with a
// current-value marker, min/max scale labels, and the expand/collapse toggle that reveals
// whatever detail content the caller puts in the default slot (a chart, a table, anything).
//
// Gradient (not discrete bands) bound to whatever two colors the caller passes, per direct
// follow-up on the first adopter ("量尺的顏色還是要紅綠配色，而且要漸層，而且要與漲跌顏色綁定") —
// this OVERRIDES 2.4.3's own "avoid red/green" rule by direct instruction; callers that don't
// want that convention can pass any other from/to pair instead, the component itself is neutral.
//
// Never a modal (2.4.4) — the expand toggle only ever grows THIS card's own height via the
// default slot; multiple cards using this component can be expanded at once with no coordination
// needed between them, since each instance owns only its own `expanded` state.
//
// showToggle added for cards overlaying 2 metrics on one chart (StockEvMultiplesCard.vue,
// StockYieldFamilyCard.vue — both metrics are separate percentile facts, so each gets its own
// gauge, but there's only ONE chart to expand) — the first gauge renders with showToggle=false
// (just the visual, no button/slot) and a shared `expanded` ref, the second (or last) instance
// owns the actual toggle button and default-slot content. A single-metric card never sets this.
const props = withDefaults(
  defineProps<{
    valueText: string
    percentileText: string
    current: number
    min: number
    max: number
    formatScaleValue: (value: number) => string
    gradientFrom: string
    gradientTo: string
    expanded: boolean
    loading?: boolean
    expandLabel?: string
    collapseLabel?: string
    showToggle?: boolean
  }>(),
  {
    loading: false,
    expandLabel: '展開看詳情',
    collapseLabel: '收合',
    showToggle: true
  }
)

defineEmits<{
  'update:expanded': [value: boolean]
}>()

const markerPosition = computed(() => {
  if (props.max <= props.min) return 0
  return Math.min(100, Math.max(0, ((props.current - props.min) / (props.max - props.min)) * 100))
})

const gradient = computed(() => `linear-gradient(to right, ${props.gradientFrom}, ${props.gradientTo})`)
</script>

<template>
  <div v-loading="loading" class="percentile-gauge">
    <div class="percentile-gauge__value">
      <span class="percentile-gauge__number">{{ valueText }}</span>
      <span class="percentile-gauge__percentile">{{ percentileText }}</span>
    </div>
    <div class="percentile-gauge__bar" :style="{ background: gradient }">
      <span class="percentile-gauge__marker" :style="{ left: `${markerPosition}%` }" />
    </div>
    <div class="percentile-gauge__scale">
      <span>{{ formatScaleValue(min) }}</span>
      <span>{{ formatScaleValue(max) }}</span>
    </div>
  </div>

  <template v-if="showToggle">
    <button
      type="button"
      class="percentile-gauge__toggle"
      :aria-expanded="expanded"
      @click="$emit('update:expanded', !expanded)"
    >
      {{ expanded ? collapseLabel : expandLabel }}
      <el-icon><component :is="expanded ? ArrowUp : ArrowDown" /></el-icon>
    </button>

    <template v-if="expanded">
      <slot />
    </template>
  </template>
</template>

<style scoped>
.percentile-gauge {
  padding: 4px 8px 8px;
}

.percentile-gauge__value {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  margin-bottom: 8px;
}

.percentile-gauge__number {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

/* Objective statistical-percentile wording only (2.4.3) — the caller-assembled percentileText
   must never carry an evaluative label like 便宜/合理/昂貴, only this component's own styling
   (secondary, non-alarming) is owned here. */
.percentile-gauge__percentile {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.percentile-gauge__bar {
  position: relative;
  display: flex;
  height: 16px;
  border-radius: 999px;
  overflow: hidden;
}

/* Current-value marker — a plain vertical line, not a colored dot, so it reads as "this is
   where you are" rather than adding a 4th color to interpret. */
.percentile-gauge__marker {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 3px;
  margin-left: -1.5px;
  border-radius: 2px;
  background: var(--el-text-color-primary);
  box-shadow: 0 0 0 2px var(--el-bg-color);
}

.percentile-gauge__scale {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-placeholder);
}

.percentile-gauge__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  border: none;
  border-top: 1px solid var(--el-border-color-lighter);
  background: transparent;
  font-size: 15px;
  color: var(--el-color-primary);
  cursor: pointer;
}

.percentile-gauge__toggle:hover {
  background: var(--el-fill-color-light);
}
</style>
