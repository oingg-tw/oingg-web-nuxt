<script setup lang="ts">
// Extracted from StockDetailActions.vue 2026-09-14 per direct request ("summary-card__sticky-bar
// 這邊也要顯示 卡片 表格 會計") — the sticky bar (condensed header shown once the full
// StockSummaryCard scrolls out of view) previously had no way to switch modes at all ("no
// #actions slot... to keep this from becoming a second full toolbar" was a deliberate call, but
// only ever covered the settings-gear/顯示卡片 dialog, not this 3-way toggle). Both
// StockDetailActions.vue (full card) and StockSummaryCard.vue's sticky bar now mount this same
// tiny component instead of each keeping their own copy of the radio-group — they already share
// the underlying state via useStockExperienceMode()'s own useState, so this is purely a markup/
// CSS dedupe, not new shared state.
//
// size prop lets the sticky bar request a smaller control to match its own compact bar (see its
// own __sticky-favorite button, also size="small") without hardcoding one size in here for both
// call sites.
const props = withDefaults(defineProps<{ size?: 'default' | 'small' }>(), { size: 'default' })

const { mode: experienceMode } = useStockExperienceMode()

// Hidden on mobile 2026-09-15 per direct request ("手機板不顯示 stock-experience-mode-select
// 一律用 卡片 mode") — same useIsWideLayout() single source of truth app.vue itself uses to pick
// desktop.vue vs mobile.vue (not a raw CSS breakpoint here, since this needs to also force the
// underlying STATE back to CARD, not just hide the control visually — 表格/會計 mode's own
// content still exists and would keep rendering on a narrow window if this only hid the radio
// buttons without resetting `experienceMode` itself). Forces back to CARD the moment the layout
// actually flips to mobile, not just on initial mount, so switching into a narrower window
// mid-session (or the reverse) stays correct.
const isWide = useIsWideLayout()
watch(isWide, wide => {
  if (!wide) experienceMode.value = 'CARD'
}, { immediate: true })
</script>

<template>
  <el-radio-group v-if="isWide" v-model="experienceMode" :size="props.size" aria-label="顯示模式" class="stock-experience-mode-select">
    <el-radio-button value="CARD">卡片</el-radio-button>
    <el-radio-button value="TABLE">表格</el-radio-button>
    <el-radio-button value="ACCOUNTING">會計</el-radio-button>
  </el-radio-group>
</template>

<style scoped>
.stock-experience-mode-select {
  display: flex;
  flex-wrap: wrap;
}

/* Two real WCAG AA gaps fixed 2026-09-14 (reported live: "卡片 表格 會計 這邊 按鈕 沒做好 不符合
   無障礙 AA"):
   1. Element Plus's own el-radio-group defaults its root `aria-label` to the literal placeholder
      string "radio-group" when none is passed (confirmed live via getComputedStyle/DOM inspection
      — not a real description, just its own internal fallback) — a screen reader announced this
      exact meaningless string instead of what the control actually does. The `aria-label="顯示
      模式"` above on the template fixes this directly (fails 1.3.1/4.1.2 without it).
   2. Focus-visible outline was completely invisible to sighted keyboard users — a real 2.4.7
      (Focus Visible) failure. el-radio-button hides its real `<input type="radio">` with
      `opacity: 0` and shows a sibling `.el-radio-button__inner` span as the visible pill; this
      app's own global `:focus-visible` rule (main.css) still matches and outlines the HIDDEN
      input (confirmed live: outline-color/width were both set correctly on
      `.el-radio-button__original-radio:focus-visible`), but `opacity: 0` makes that outline
      exactly as invisible as the rest of the element — tabbing through 卡片/表格/會計 produced
      zero visible difference between focused and unfocused. Fixed by drawing the SAME outline on
      the visible `.el-radio-button__inner` sibling instead, via the adjacent-sibling selector
      (confirmed live: input and .inner are direct siblings under the same <label>). */
.stock-experience-mode-select :deep(.el-radio-button__original-radio:focus-visible + .el-radio-button__inner) {
  outline: 2px solid var(--el-color-primary) !important;
  outline-offset: 2px !important;
}
</style>
