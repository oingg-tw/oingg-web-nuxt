<script setup lang="ts">
import { Menu, Search } from '@element-plus/icons-vue'
import type { ThemeColor } from '~/composables/theme/useAppTheme'

// Internal design-system/contrast-audit page — not linked from any nav, disallowed in
// public/_robots.txt. Built per direct request ("建立一個 design page，那邊要放上不同主題色的
// 元件。以後計算是否符合AA標準就在那邊計算") to replace the throwaway Playwright scripts this
// session kept writing-then-deleting every time a color changed (7+ occasions: primary/danger
// button text, radio-button checked/unchecked state, light-mode background retunes, gold
// accent comparisons...) with a real, permanent page that computes the same WCAG contrast math
// live in the browser against actual rendered elements.
definePageMeta({ layout: 'landing' })
useSeoMeta({ title: '設計系統稽核 — 內部工具', robots: 'noindex, nofollow' })

const { color: currentColor, resolvedMode, setColor, setMode } = useAppTheme()

const THEME_COLORS: ThemeColor[] = ['GOLD', 'BLUE', 'GREEN', 'PURPLE', 'ORANGE', 'RED', 'TEAL']
const THEME_MODES: Array<'LIGHT' | 'DARK'> = ['LIGHT', 'DARK']

// One container ref + querySelector, not individual template refs per element — a ref placed
// directly on an <el-button>/<el-radio-button> component gives the component's public
// instance, not necessarily its root DOM node (getComputedStyle needs an actual Element).
// Querying by a plain class name inside a known container sidesteps that ambiguity entirely,
// and is the same technique this session's own throwaway Playwright scripts already relied on
// for the exact same measurements (e.g. `document.querySelector('.el-radio-button__inner')`).
const previewRef = ref<HTMLElement>()

// [foreground selector, background selector, WCAG floor]. 'text' = 4.5:1, 'ui' = 3:1
// (UI-component/large-text floor) — matches which rule actually governs each element's real
// use in this app (running body text vs. a button label/icon).
const CHECKS: { label: string; fg: string; bg: string; standard: 'text' | 'ui' }[] = [
  { label: '內文文字 on 頁面背景', fg: '.dp-page-text', bg: '.dp-page-bg', standard: 'text' },
  { label: '次要文字 on 頁面背景', fg: '.dp-secondary-text', bg: '.dp-page-bg', standard: 'text' },
  { label: '提示文字 on 頁面背景', fg: '.dp-placeholder-text', bg: '.dp-page-bg', standard: 'text' },
  { label: '內文文字 on 卡片背景', fg: '.dp-card-text', bg: '.dp-card-bg', standard: 'text' },
  { label: '漲price 文字 on 頁面背景', fg: '.dp-price-up', bg: '.dp-page-bg', standard: 'text' },
  { label: '跌price 文字 on 頁面背景', fg: '.dp-price-down', bg: '.dp-page-bg', standard: 'text' },
  { label: '實心主色按鈕（文字/背景）', fg: '.dp-solid-primary', bg: '.dp-solid-primary', standard: 'ui' },
  { label: 'Plain 主色按鈕（文字/背景）', fg: '.dp-plain-primary', bg: '.dp-plain-primary', standard: 'ui' },
  { label: '實心危險按鈕（文字/背景）', fg: '.dp-solid-danger', bg: '.dp-solid-danger', standard: 'ui' },
  { label: 'Radio-button 選中（文字/背景）', fg: '.dp-radio-checked .el-radio-button__inner', bg: '.dp-radio-checked .el-radio-button__inner', standard: 'ui' },
  { label: 'Radio-button 未選中（文字/背景）', fg: '.dp-radio-unchecked .el-radio-button__inner', bg: '.dp-radio-unchecked .el-radio-button__inner', standard: 'text' }
]

interface CheckResult {
  label: string
  ratio: number
  pass: boolean
  requiredRatio: number
}

const results = ref<CheckResult[]>([])

function readResults() {
  const container = previewRef.value
  results.value = CHECKS.map(check => {
    const requiredRatio = check.standard === 'text' ? 4.5 : 3
    const fgEl = container?.querySelector<HTMLElement>(check.fg)
    const bgEl = container?.querySelector<HTMLElement>(check.bg)
    if (!fgEl || !bgEl) return { label: check.label, ratio: 0, pass: false, requiredRatio }
    const verdict = evaluateContrast(getComputedStyle(fgEl).color, getComputedStyle(bgEl).backgroundColor)
    return { label: check.label, ratio: verdict.ratio, pass: check.standard === 'text' ? verdict.aaNormal : verdict.aaLarge, requiredRatio }
  })
}

// Re-measure whenever the theme actually changes on <html>. NOT a watch(resolvedMode/
// currentColor) + nextTick() — useAppTheme() applies mode/color to <html> via useHead's
// htmlAttrs binding, which patches the DOM through unhead's own scheduler, not Vue's render
// cycle. nextTick() only guarantees Vue's queued updates have flushed, not unhead's, so that
// approach read stale computed styles (verified: switching mode left every ratio unchanged
// even though the underlying CSS variables had genuinely updated a moment later). A
// MutationObserver on the real class/data-theme-color attributes reacts to the actual DOM
// change regardless of which mechanism produced it.
let observer: MutationObserver | undefined

onMounted(() => {
  readResults()
  observer = new MutationObserver(() => readResults())
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme-color'] })
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div class="design-page">
    <header class="design-page__header">
      <h1 class="design-page__title">設計系統稽核</h1>
      <p class="design-page__lead">
        內部工具，不對外連結。切換下方主題色/外觀模式，即時計算各項文字與背景組合是否符合 WCAG AA 對比標準。
      </p>
    </header>

    <section class="design-page__section">
      <h2 class="design-page__section-title">外觀模式</h2>
      <div class="design-page__swatches">
        <button
          v-for="key in THEME_MODES"
          :key="key"
          type="button"
          class="design-page__swatch"
          :class="{ 'is-active': resolvedMode === key }"
          @click="setMode(key)"
        >
          {{ key === 'DARK' ? '深色' : '淺色' }}
        </button>
      </div>
    </section>

    <section class="design-page__section">
      <h2 class="design-page__section-title">主題色</h2>
      <div class="design-page__swatches">
        <button
          v-for="key in THEME_COLORS"
          :key="key"
          type="button"
          class="design-page__swatch"
          :class="{ 'is-active': currentColor === key }"
          @click="setColor(key)"
        >
          {{ key }}
        </button>
      </div>
    </section>

    <section class="design-page__section">
      <h2 class="design-page__section-title">對比度計算結果</h2>
      <table class="design-page__table">
        <thead>
          <tr>
            <th>檢查項目</th>
            <th>對比度</th>
            <th>門檻</th>
            <th>結果</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="result in results" :key="result.label">
            <td>{{ result.label }}</td>
            <td>{{ result.ratio.toFixed(2) }}:1</td>
            <td>{{ result.requiredRatio }}:1</td>
            <td>
              <span class="design-page__badge" :class="result.pass ? 'is-pass' : 'is-fail'">
                {{ result.pass ? '通過' : '不通過' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="design-page__section">
      <h2 class="design-page__section-title">元件預覽（供量測用的實際渲染元素）</h2>
      <div ref="previewRef" class="design-page__preview">
        <p class="dp-page-bg design-page__preview-page">
          <span class="dp-page-text">內文文字（--el-text-color-primary）</span><br>
          <span class="dp-secondary-text" style="color: var(--el-text-color-secondary)">次要文字（--el-text-color-secondary）</span><br>
          <span class="dp-placeholder-text" style="color: var(--el-text-color-placeholder)">提示文字（--el-text-color-placeholder）</span><br>
          <span class="dp-price-up" style="color: var(--price-up-color)">▲ 漲price 文字</span>
          <span class="dp-price-down" style="color: var(--price-down-color)">▼ 跌price 文字</span>
        </p>

        <div class="dp-card-bg design-page__preview-card">
          <span class="dp-card-text">卡片背景上的內文文字</span>
        </div>

        <div class="design-page__preview-row">
          <el-button class="dp-solid-primary" type="primary">實心主色按鈕</el-button>
          <el-button class="dp-plain-primary" type="primary" plain>Plain 主色按鈕</el-button>
          <el-button class="dp-solid-danger" type="danger">實心危險按鈕</el-button>
        </div>

        <el-radio-group model-value="a" class="design-page__preview-row">
          <el-radio-button class="dp-radio-checked" label="a">選中狀態</el-radio-button>
          <el-radio-button class="dp-radio-unchecked" label="b">未選中狀態</el-radio-button>
        </el-radio-group>

        <div class="design-page__preview-row">
          <el-button circle :icon="Menu" title="範例：手機版選單觸控熱區" />
          <el-button circle :icon="Search" title="範例：手機版搜尋觸控熱區" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.design-page {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.design-page__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.design-page__title {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
}

.design-page__lead {
  margin: 0;
  font-size: 18px;
  color: var(--el-text-color-secondary);
}

.design-page__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.design-page__section-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

.design-page__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.design-page__swatch {
  padding: 8px 16px;
  min-height: 48px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 16px;
  cursor: pointer;
}

.design-page__swatch.is-active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  font-weight: 600;
}

.design-page__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 18px;
}

.design-page__table th,
.design-page__table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.design-page__badge {
  display: inline-flex;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
}

.design-page__badge.is-pass {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.design-page__badge.is-fail {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.design-page__preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.design-page__preview-page {
  margin: 0;
  padding: 16px;
  background: var(--el-bg-color-page);
  border-radius: 8px;
  line-height: 1.8;
}

.design-page__preview-card {
  padding: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.design-page__preview-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
