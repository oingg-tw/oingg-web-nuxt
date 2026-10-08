<script setup lang="ts">
import { Moon, Sunny } from '@element-plus/icons-vue'
import type { MarketConvention, ThemeColor } from '~/composables/theme/useAppTheme'
import type { TextScale } from '~/composables/theme/useTextScale'


// 外觀設定頁（2026-09-16）：手機功能選單的「外觀設定」原本開一個小 popover，使用者要求改成一個真正的頁面（「那麼換一個頁面」；
// /design 是內部的 WCAG 稽核工具，不是對的目標）。視覺照 /design 的色票按鈕（「功能要類似這設計系統」），但是真正的使用者設定頁：
// 沒有對比表、沒有元件預覽，多一區漲跌顏色。
// noindex（2026-09-19）：每人不同的設定頁，不是給爬蟲的內容；也在 nuxt.config 的 sitemap.exclude 裡。
useSeoMeta({ title: '外觀設定', robots: 'noindex, nofollow' })

const { color, market, resolvedMode, setMode, setColor, setMarket } = useAppTheme()
const { scale, setScale } = useTextScale()

// 滿版顯示 moved here 2026-09-17 per direct request ("滿版顯示功能 從menu移到外觀設定中") — used
// to be an el-switch inline in AppHeaderMenu.vue's own row (see that file's own comment for what
// stays there: the `contentWidthMode` READ is still needed there to drive the header's own
// centered-vs-full padding-left math, only the visible toggle UI moved). Same
// useContentWidthMode() composable, same 'full'/'centered' vocabulary — just a swatch-button pair
// here instead of a switch, matching this page's own established pattern (外觀模式 above).
const contentWidthMode = useContentWidthMode()

// Re-scoped 2026-09-17 (150%/200% → 110%/120%) per direct request, after being shown 通傳會
// (NCC) 的網站無障礙規範 2.0 版 PDF — that standard's own reference widget is a modest
// 16px/17.6px/19.2px (~10% per step) control, not an attempt to make the control itself reach
// 200%. See useTextScale.ts's own comment for the full reasoning: real 200% is the browser's own
// native-zoom job (WCAG Technique G142), already unblocked on this app; this control is just the
// supplementary G178 convenience the standard's own reference implementation also treats it as.
const TEXT_SCALE_OPTIONS: { key: TextScale; label: string }[] = [
  { key: '100', label: '100%（預設）' },
  { key: '110', label: '110%' },
  { key: '120', label: '120%' }
]

const THEME_COLOR_OPTIONS: { key: ThemeColor; label: string; swatch: string }[] = [
  { key: 'GOLD', label: '金色', swatch: '#d6b351' },
  { key: 'BLUE', label: '藍色', swatch: '#7eb6e8' },
  { key: 'GREEN', label: '綠色', swatch: '#6bc99a' },
  { key: 'PURPLE', label: '紫色', swatch: '#bfaae8' },
  { key: 'ORANGE', label: '橘色', swatch: '#eb9d6b' },
  { key: 'RED', label: '紅色', swatch: '#ee9baa' },
  { key: 'TEAL', label: '青色', swatch: '#5ac8c8' }
]

const MARKET_OPTIONS: { key: MarketConvention; top: string; bottom: string; label: string }[] = [
  { key: 'ASIA', top: 'var(--el-color-danger)', bottom: 'var(--el-color-success)', label: '亞洲（紅漲綠跌）' },
  { key: 'WESTERN', top: 'var(--el-color-success)', bottom: 'var(--el-color-danger)', label: '歐美（綠漲紅跌）' },
  { key: 'ACCESSIBLE', top: '#648fff', bottom: '#fe6100', label: '無障礙（藍漲橘跌）' }
]

// Preview chart added 2026-09-16 per direct request ("漲跌底下加上 一個可以很好呈現以上所有設計
// 變化的圖表") — a single small chart that visibly reacts to all 4 settings on this page at once,
// so switching any of them shows its real effect immediately instead of only being visible
// scattered across other pages later. Mock daily price-change data (fixed, not fetched — this
// page has no "current stock" of its own, same reasoning /design's own 元件預覽 section used for
// its plain preview elements), alternating up/down so both price colors always show together.
//
// ECharts options are plain JS, not CSS — none of the 4 settings reach it "for free" the way a
// real DOM element picks up var(--el-color-primary)/rem font-size through the cascade:
// - 主題色/漲跌顏色: getAccentColor()/getPriceColors() (chart-palette.ts) are this app's
//   standing manual mirror of main.css's own theme-color/price-color CSS vars, already used by
//   every other themed chart (river charts, etc.) for the same reason.
// - 外觀模式: 軸線／刻度文字的墨色由 SharedChart 的主題給（2026-10-08 起不再在這裡手動設）。
// - 字型大小: handled by SharedChart.vue now (2026-09-16, once "字體放大以後 發現圖表的字體沒有
//   跟著變化" turned out to be a real site-wide gap, not just this one preview chart) — that
//   wrapper auto-scales every `fontSize` in whatever option it's given, so this component no
//   longer multiplies by `Number(scale.value)/100` itself; doing both here AND in the wrapper
//   would double-scale. The plain, unscaled fontSize values below are what SharedChart reads and
//   scales exactly once.
const MOCK_CHANGES = [1.2, -0.8, 0.6, -1.6, 2.1, -0.4, 0.9, -1.2, 1.8, -0.7, 0.5, 1.3]
// Simple 3-point moving average — purely illustrative (not a real indicator claim), just a
// second series that isn't up/down-colored so 主題色 has something to visibly drive.
const MOCK_TREND = MOCK_CHANGES.map((_, i) => {
  const window = MOCK_CHANGES.slice(Math.max(0, i - 2), i + 1)
  return window.reduce((sum, v) => sum + v, 0) / window.length
})

const previewOption = computed(() => {
  const priceColors = getPriceColors(resolvedMode.value, market.value)
  const accent = getAccentColor(resolvedMode.value, color.value)
  return {
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: MOCK_CHANGES.map((_, i) => `${i + 1}`)
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: '{value}%' }
    },
    series: [
      {
        type: 'bar',
        data: MOCK_CHANGES.map(value => ({ value, itemStyle: { color: value >= 0 ? priceColors.up : priceColors.down } })),
        barMaxWidth: 20
      },
      {
        type: 'line',
        data: MOCK_TREND,
        symbol: 'none',
        lineStyle: { color: accent, width: 2.5 }
      }
    ]
  }
})
</script>

<template>
  <div class="app-page appearance-page">
    <div class="appearance-page__header">
      <h1 class="app-page__title app-page__title--app appearance-page__title">外觀設定</h1>
      <p class="appearance-page__subtitle">調整外觀模式、字型大小、版面寬度、主題色與漲跌顏色，變更會立即套用到全站</p>
    </div>

    <!-- 字型大小 added 2026-09-16 per direct request, alongside
         docs/0_researches/數位無障礙文字縮放標準與字級階層工程實施規範.md — 5 steps reaching a
         real 200% at the top (see useTextScale.ts's own comment for why that specific number),
         driving <html>'s own root font-size so every rem-based font-size in the app scales at
         once (see that composable + main.css's own comment for the site-wide px→rem conversion
         this shipped alongside). -->
    <section class="appearance-page__section">
      <h2 class="app-page__h2 appearance-page__section-title">字型大小</h2>
      <div class="appearance-page__swatches" role="group" aria-label="字型大小">
        <button
          v-for="option in TEXT_SCALE_OPTIONS"
          :key="option.key"
          type="button"
          class="appearance-page__swatch"
          :class="{ 'is-active': scale === option.key }"
          :aria-pressed="scale === option.key"
          @click="setScale(option.key)"
        >
          {{ option.label }}
        </button>
      </div>
    </section>

    <section class="appearance-page__section">
      <h2 class="app-page__h2 appearance-page__section-title">外觀模式</h2>
      <div class="appearance-page__swatches" role="group" aria-label="外觀模式">
        <button
          type="button"
          class="appearance-page__swatch"
          :class="{ 'is-active': resolvedMode === 'LIGHT' }"
          :aria-pressed="resolvedMode === 'LIGHT'"
          @click="setMode('LIGHT')"
        >
          <el-icon class="appearance-page__swatch-icon"><Sunny /></el-icon>
          淺色
        </button>
        <button
          type="button"
          class="appearance-page__swatch"
          :class="{ 'is-active': resolvedMode === 'DARK' }"
          :aria-pressed="resolvedMode === 'DARK'"
          @click="setMode('DARK')"
        >
          <el-icon class="appearance-page__swatch-icon"><Moon /></el-icon>
          深色
        </button>
      </div>
    </section>

    <section class="appearance-page__section">
      <h2 class="app-page__h2 appearance-page__section-title">版面寬度</h2>
      <div class="appearance-page__swatches" role="group" aria-label="版面寬度">
        <button
          type="button"
          class="appearance-page__swatch"
          :class="{ 'is-active': contentWidthMode === 'centered' }"
          :aria-pressed="contentWidthMode === 'centered'"
          @click="contentWidthMode = 'centered'"
        >
          置中
        </button>
        <button
          type="button"
          class="appearance-page__swatch"
          :class="{ 'is-active': contentWidthMode === 'full' }"
          :aria-pressed="contentWidthMode === 'full'"
          @click="contentWidthMode = 'full'"
        >
          滿版
        </button>
      </div>
    </section>

    <section class="appearance-page__section">
      <h2 class="app-page__h2 appearance-page__section-title">主題色</h2>
      <div class="appearance-page__swatches" role="group" aria-label="主題色">
        <button
          v-for="option in THEME_COLOR_OPTIONS"
          :key="option.key"
          type="button"
          class="appearance-page__swatch"
          :class="{ 'is-active': color === option.key }"
          :aria-pressed="color === option.key"
          @click="setColor(option.key)"
        >
          <span class="appearance-page__swatch-dot" :style="{ background: option.swatch }" />
          {{ option.label }}
        </button>
      </div>
    </section>

    <section class="appearance-page__section">
      <h2 class="app-page__h2 appearance-page__section-title">漲跌顏色</h2>
      <div class="appearance-page__swatches" role="group" aria-label="漲跌顏色">
        <button
          v-for="option in MARKET_OPTIONS"
          :key="option.key"
          type="button"
          class="appearance-page__swatch"
          :class="{ 'is-active': market === option.key }"
          :aria-pressed="market === option.key"
          @click="setMarket(option.key)"
        >
          <span class="appearance-page__swatch-split">
            <span class="appearance-page__swatch-half" :style="{ background: option.top }" />
            <span class="appearance-page__swatch-half" :style="{ background: option.bottom }" />
          </span>
          {{ option.label }}
        </button>
      </div>

      <!-- Preview chart — see this component's own script-side comment for why every one of
           the 4 settings above needs manual wiring here instead of picking them up for free. -->
      <div class="appearance-page__preview">
        <SharedChart class="appearance-page__preview-chart" :option="previewOption" autoresize aria-label="漲跌顏色預覽圖表" />
      </div>
    </section>
  </div>
</template>

<style scoped>

.appearance-page__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.appearance-page__subtitle {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.appearance-page__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.appearance-page__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* min-height 48px，不是舊 popover 的 24–32px 圓鈕——整頁有空間，值得花在觸控下限上（同 /design 的色票按鈕）。 */
.appearance-page__swatch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 8px 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 1rem;
  cursor: pointer;
}

.appearance-page__swatch.is-active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  font-weight: 600;
}

.appearance-page__swatch-icon {
  font-size: 1.125rem;
}

.appearance-page__swatch-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Column (top/bottom), not row (left/right) — per direct request ("appearance-page__swatch-split
   要轉方向 紅綠是上下的"). top/bottom in MARKET_OPTIONS already named the halves this way; only
   the CSS axis needed to match. */
.appearance-page__swatch-split {
  display: flex;
  flex-direction: column;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.appearance-page__swatch-half {
  flex: 1;
}

.appearance-page__preview {
  margin-top: 4px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-page);
}

.appearance-page__preview-chart {
  height: 12.5rem;
  width: 100%;
}
</style>
