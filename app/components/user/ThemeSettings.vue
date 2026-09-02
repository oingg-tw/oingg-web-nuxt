<script setup lang="ts">
import { Moon, Sunny } from '@element-plus/icons-vue'
import type { MarketConvention, ThemeColor } from '~/composables/theme/useAppTheme'

// All three theme controls (mode/color/market) in one place — previously three separate
// rows duplicated across UserMenuButton.vue, each with its own "外觀模式"/"主題色"/"漲跌顏色"
// caption. The captions were briefly removed on the theory that each control is visually
// self-explanatory, then reinstated per explicit user correction — kept as visible text,
// not just title/aria-label, even though the icon/swatch/split-button themselves carry
// real information too.
const { color, market, resolvedMode, setMode, setColor, setMarket } = useAppTheme()

// Swatch preview colors only — decorative, not the actual styling source (that's main.css's
// own html.dark[data-theme-color='...'] blocks, which is where the swatch hex below actually
// has to match). All seven ThemeColor keys have a real CSS block now — add a new one by
// adding both together: a CSS block there, and its preview swatch + label here.
const THEME_COLOR_OPTIONS: { key: ThemeColor; label: string; swatch: string }[] = [
  { key: 'GOLD', label: '金色', swatch: '#d6b351' },
  { key: 'BLUE', label: '藍色', swatch: '#7eb6e8' },
  { key: 'GREEN', label: '綠色', swatch: '#6bc99a' },
  { key: 'PURPLE', label: '紫色', swatch: '#bfaae8' },
  { key: 'ORANGE', label: '橘色', swatch: '#eb9d6b' },
  { key: 'RED', label: '紅色', swatch: '#ee9baa' },
  { key: 'TEAL', label: '青色', swatch: '#5ac8c8' }
]

// Each button IS its own explanation — top half is whatever color that convention uses for
// "up", bottom half for "down" — so there's nothing left to say in a text label that the
// button doesn't already show. ASIA/WESTERN read through --el-color-danger/success (which
// already track light/dark mode correctly); ACCESSIBLE uses the same fixed hex as its own
// main.css block (not an alias — see that block's own comment for why).
const MARKET_OPTIONS: { key: MarketConvention; top: string; bottom: string; label: string }[] = [
  { key: 'ASIA', top: 'var(--el-color-danger)', bottom: 'var(--el-color-success)', label: '亞洲（紅漲綠跌）' },
  { key: 'WESTERN', top: 'var(--el-color-success)', bottom: 'var(--el-color-danger)', label: '歐美（綠漲紅跌）' },
  { key: 'ACCESSIBLE', top: '#648fff', bottom: '#fe6100', label: '無障礙（藍漲橘跌）' }
]
</script>

<template>
  <div class="theme-settings">
    <div class="theme-settings__row">
      <span class="theme-settings__label">外觀模式</span>
      <el-switch
        :model-value="resolvedMode === 'DARK'"
        inline-prompt
        size="large"
        :active-icon="Moon"
        :inactive-icon="Sunny"
        title="切換外觀模式"
        aria-label="切換外觀模式"
        @update:model-value="value => setMode(value ? 'DARK' : 'LIGHT')"
      />
    </div>

    <div class="theme-settings__row theme-settings__row--top">
      <span class="theme-settings__label">主題色</span>
      <div class="theme-settings__swatches">
        <button
          v-for="option in THEME_COLOR_OPTIONS"
          :key="option.key"
          type="button"
          class="theme-settings__swatch"
          :class="{ 'is-active': color === option.key }"
          :style="{ background: option.swatch }"
          :title="option.label"
          :aria-label="`切換主題色為${option.label}`"
          @click="setColor(option.key)"
        />
      </div>
    </div>

    <div class="theme-settings__row">
      <span class="theme-settings__label">漲跌顏色</span>
      <div class="theme-settings__market">
        <button
          v-for="option in MARKET_OPTIONS"
          :key="option.key"
          type="button"
          class="theme-settings__market-btn"
          :class="{ 'is-active': market === option.key }"
          :title="option.label"
          :aria-label="`切換漲跌顏色為${option.label}`"
          @click="setMarket(option.key)"
        >
          <span class="theme-settings__market-half" :style="{ background: option.top }" />
          <span class="theme-settings__market-half" :style="{ background: option.bottom }" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.theme-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

/* The color row's swatch grid wraps to two lines (see .theme-settings__swatches) —
   center-aligning against that taller block left the label floating oddly mid-height;
   top-aligning it with the first row of swatches reads correctly instead. */
.theme-settings__row--top {
  align-items: flex-start;
  padding-top: 2px;
}

.theme-settings__label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

/* 4 per row, wrapping the remaining 3 to a second row — 7 swatches in one unbroken line
   was cramping "主題色" down to two lines of its own (the row only has so much width to
   split between the label and the swatch group). Width is exactly 4 swatches + 3 gaps
   (4×24px + 3×6px) so a 5th item has nowhere left to go but the next line. */
.theme-settings__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  width: 114px;
}

.theme-settings__market {
  display: flex;
  gap: 6px;
}

/* el-switch hardcodes its inline-prompt icon/label at 12px regardless of the `size` prop
   (theme-chalk's .el-switch__inner-wrapper rule isn't driven by the size map the way every
   other switch dimension is) — well under this project's 16px floor
   (docs/ui-ux/accessibility-guidelines.md §1.1). size="large" above is a separate knob that only
   grows the actual touch target (core 20px → 24px, WCAG 2.5.8), not this. */
.theme-settings__row :deep(.el-switch__inner-wrapper) {
  font-size: 16px;
}

/* Sized as a compact secondary control (not the project's 44px primary-action floor) since
   these are settings toggles inside an already-small popover, not main actions — still
   comfortably clears WCAG's 24px minimum hit area. */
.theme-settings__swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  padding: 0;
  cursor: pointer;
}

.theme-settings__swatch.is-active {
  border-color: var(--el-text-color-primary);
}

/* A rounded square rather than a circle — a circular 50/50 split leaves thin, hard-to-read
   crescents near the edges; a square reads as two clean, equal color bands.
   Two real stacked elements (.theme-settings__market-half below), not a single
   linear-gradient background — a gradient's hard color stop still left a visible seam of
   the wrong color right at the rounded corners in every browser tested (border-radius
   clipping a gradient background exactly at a hard stop is inconsistent), and adding
   overflow: hidden on top of the gradient didn't fully fix it either. Two flat-color
   elements filling their own half of the button is a plain, unambiguous rectangle-clipping
   case with no gradient math involved — this renders cleanly everywhere. */
.theme-settings__market-btn {
  display: flex;
  flex-direction: column;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 2px solid transparent;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
}

.theme-settings__market-half {
  flex: 1;
}

.theme-settings__market-btn.is-active {
  border-color: var(--el-text-color-primary);
}
</style>
