<script setup lang="ts">
import VChart from 'vue-echarts'

// Drop-in wrapper around vue-echarts' own VChart, added 2026-09-16 per direct request
// ("字體放大以後 發現圖表的字體沒有跟著變化") — auto-scales every `fontSize` value inside the
// `option` prop by the user's own 字型大小 setting (useTextScale.ts). ECharts renders text onto
// canvas/svg from its own plain-JS option object, not real DOM text, so none of it responds to
// <html>'s own scaled root font-size the way every other rem-based text in this app now does
// (see that composable's own comment for the site-wide px→rem conversion this shipped alongside).
//
// One centralized wrapper here — instead of hand-editing the ~26 chart components that each
// build their own option object — mirrors how main.css's single --el-font-size-base override
// already covers every Element Plus component's font-size instead of patching each one
// individually. Call sites just rename their `<VChart ...>` tag to `<SharedChart ...>`; every
// other prop/attr/directive (class, :style, autoresize, v-loading, v-if/v-else) passes through
// unchanged via Vue's own single-root attrs/directive fallthrough — this component declares no
// other prop than `option`, so nothing else needs forwarding logic here.
//
// **initOptions 必須是模組層級的常數，不能讓呼叫端寫成行內物件。** vue-echarts 的
// `watch([manualUpdate, realInitOptions], () => { cleanup(); init() })` 用參考比對：行內的
// `:init-options="{ renderer: 'svg' }"` 每次父元件重繪都是一個新物件，於是每一次重繪都會
// dispose 再 init 一次圖表。多數時候只是白做工看不出來，但只要重繪的同一輪裡這個元素正在被
// v-if/v-else-if 換掉，init 就會拿到已經脫離文件的節點 → 丟出 "Initialize failed: invalid dom"，
// 接著 ECharts 在 Vue patch 中途動了 DOM，Vue 自己撞上 "Cannot read properties of null
// (reading 'nextSibling')"，整塊圖表區就死了。2026-09-29 由「跟誰一起看」切換柱狀圖↔折線圖
// 時實測到（11 個呼叫端全部寫行內物件，全部有同一個問題，只是沒有人在換元件）。
// 全站 11 個呼叫端本來就都傳同一個值，所以搬進來之後呼叫端一個字都不用寫。
const INIT_OPTIONS = { renderer: 'svg' } as const

const props = defineProps<{ option: Record<string, unknown> }>()

const { scale } = useTextScale()

// Recurses through the whole option tree (series, axisLabel, legend.textStyle,
// tooltip.textStyle, a series' own label/rich sub-styles, …) — ECharts options nest fontSize
// under many different shapes depending on which chart element it belongs to, so this doesn't
// special-case any one of them; it just multiplies every key literally named `fontSize`,
// wherever it's found, by the current scale ratio. Numbers scale directly; the rare string form
// ('12px', used by a few rich-text sub-styles) is parsed and re-appended. Every other value
// (including fontWeight, which is NOT a size) passes through untouched.
function scaleFontSizes(value: unknown, ratio: number): unknown {
  if (Array.isArray(value)) return value.map(item => scaleFontSizes(item, ratio))
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'fontSize' && typeof val === 'number') {
        result[key] = val * ratio
      } else if (key === 'fontSize' && typeof val === 'string' && val.endsWith('px')) {
        result[key] = `${parseFloat(val) * ratio}px`
      } else {
        result[key] = scaleFontSizes(val, ratio)
      }
    }
    return result
  }
  return value
}

const scaledOption = computed(() => scaleFontSizes(props.option, Number(scale.value) / 100) as Record<string, unknown>)
</script>

<template>
  <VChart :option="scaledOption" :init-options="INIT_OPTIONS" />
</template>
