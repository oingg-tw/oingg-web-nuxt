<script setup lang="ts">
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
//
// Toggle button/slot mechanics delegated to SharedExpandToggle.vue 2026-09-15 (extracted once a
// 2nd, non-gauge card needed the exact same "summary always shown, detail behind a button" shape
// — see that component's own comment) — this component now only owns the gauge's own visual.
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

// 落點分色：標記左邊紅、右邊綠（2026-09-27「落點的左邊就用紅色，右邊就用綠色。這樣用顏色還是落點
// 都可以判斷數值的高低」）。
//
// 這是第三版，前兩版各自壞在一個量得出來的地方：
//   連續漸層    看得出偏哪一邊，看不出落在第幾個五分之一
//   五個色段    色段看起來像五個刻度，而落點其實是連續的；相鄰兩段的對比在數學上不可能過 3:1
//   落點分色    紅色面積 = 落點本身，兩個純色各自對背景 5.6:1 / 5.1:1，冗餘編碼
//
// **紅色面積隨數值變大。** 台股慣例紅＝漲＝多，所以編的是量級不是評價——EPS 高是紅、負債比高也是
// 紅，兩者的「高」意義相反，圖上只說「這一期比較高」。本站不做評等，這個編碼剛好不需要下判斷。
//
// 左紅右綠是刻意的，跟 gradientFrom/To 的名字相反：from 是量尺左端的色、to 是右端，而這裡要的是
// 「已經走過的部分塗成高的顏色」。用 color-mix 或 JS 算色都不需要了，兩個純色硬切在落點上即可，
// 所以兩個呼叫端傳 hex 還是傳 CSS 變數都一樣能用。
//
// 標記本身留著，而且它剛好落在兩色交界：3px 的近黑條同時是精確落點與兩色的分隔線——相鄰的紅與綠
// 彼此只有約 1.1:1，靠它隔開。
const gradient = computed(() => {
  const position = markerPosition.value
  return `linear-gradient(to right, ${props.gradientTo} 0% ${position}%, ${props.gradientFrom} ${position}% 100%)`
})
</script>

<template>
  <SharedExpandToggle v-if="showToggle" :expanded="expanded" :expand-label="expandLabel" :collapse-label="collapseLabel" @update:expanded="$emit('update:expanded', $event)">
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

    <template #expanded>
      <slot />
    </template>
  </SharedExpandToggle>

  <div v-else v-loading="loading" class="percentile-gauge">
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

/* 1.75rem = 28px, the bottom of the KPI band the CJK typography spec sets — and that spec names
   殖利率 as its own example（「KPI 數據（殖利率、信評、配息金額）應作為視覺主角，用 28–40px 以上、
   粗體、等寬數字對齊」）. It was 22px, which reads as body text at the size the rest of the card
   uses. Applied to the shared component rather than one caller: the 19 metric pages' gauges carry
   the same kind of number, and giving the 配息 one its own size is how the inconsistency this
   change exists to fix got started. */
.percentile-gauge__number {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--el-text-color-primary);
  /* Digits on a shared width so the number does not jitter between symbols. */
  font-variant-numeric: tabular-nums;
}

/* Objective statistical-percentile wording only (2.4.3) — the caller-assembled percentileText
   must never carry an evaluative label like 便宜/合理/昂貴, only this component's own styling
   (secondary, non-alarming) is owned here. */
.percentile-gauge__percentile {
  font-size: 1rem;
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
   where you are" rather than adding a 4th color to interpret. `left` is set inline to a percent
   along the bar (see template), which places this element's own LEFT EDGE there — `transform:
   translateX(-50%)` re-centers the 3px-wide line on that point instead (real bug fixed
   2026-09-16, "全站嚴禁出現 負 margin 負 padding" — this used to be a `margin-left: -1.5px`,
   the same visual result but via a negative margin). top/bottom stay at -3px: those extend the
   marker's own box PAST its parent's bounds on purpose (a few px taller than the bar itself, so
   the line visibly pokes out top/bottom instead of being flush) — not something a transform can
   express as directly (percentage-based, both edges independently offset), and no live user
   report ever flagged this side, so left untouched rather than restructuring what already works.
   Not a hidden exception to "no negative margin/padding" either way — top/bottom here are
   `top`/`bottom` positioning offsets, not margin or padding. */
.percentile-gauge__marker {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 3px;
  transform: translateX(-50%);
  border-radius: 2px;
  background: var(--el-text-color-primary);
  box-shadow: 0 0 0 2px var(--el-bg-color);
}

.percentile-gauge__scale {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  /* Real bug fixed 2026-09-15 (reported live: "percentile-gauge__scale 這邊的字體有 16px 嗎") —
     13px, hardcoded in raw px so it bypassed --el-font-size-base's own global 16px floor
     entirely (that floor only covers Element Plus's own components' text, not a plain custom
     class like this one). 16px is the standing minimum across this app, no exceptions. */
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-placeholder);
}
</style>
