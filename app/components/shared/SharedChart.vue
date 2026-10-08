<script setup lang="ts">
import VChart from 'vue-echarts'
import { use, registerTheme } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import { chartTheme } from '~/utils/chart-palette'

// 全站 ECharts 的唯一入口（2026-10-08 起）：零件在這裡註冊一次——原本 17 個圖表檔各自 use([...])，漏一個 series type 不會報錯、
// 漏 renderer 只在真的瀏覽器裡才壞；主題在這裡依明暗模式與字型大小登記一次——原本每個 option 都重抄字型、tooltip 的深色底、軸與
// legend 的墨色（見 chartTheme）。呼叫端只給 option 與覆寫（formatter、splitLine:{show:false}、特別的顏色）。
//
// 不開 ECharts 自己的 aria.enabled：它每次 setOption 都會改寫根元素的 role／aria-label，蓋掉自訂名稱。這裡給 role="img" 與預設
// 名稱（各 series 的名字＋「圖表」），呼叫端可用 aria-label 覆寫。
//
// 字型大小（2026-09-16，「字體放大以後 發現圖表的字體沒有跟著變化」）：ECharts 把文字畫進 svg，不吃 <html> 的 rem；option 裡每個
// fontSize 由下面的 scaleFontSizes 乘上比例，主題的字型大小在 chartTheme 裡先乘好（主題不會被走訪）。
//
// **initOptions 必須是模組層級的常數**：vue-echarts 用參考比對 initOptions，行內物件每次重繪都會 dispose 再 init，v-if 切換時會
// 炸出 "Initialize failed: invalid dom"（2026-09-29 實測）。
// 只註冊每張圖都會用到的；Pie／Custom／Scatter 各只有一兩個使用者，留在那些元件裡（全部集中時共用的 echarts chunk 多 52 KB gz，實測）
use([SVGRenderer, BarChart, LineChart, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent])
const INIT_OPTIONS = { renderer: 'svg' } as const
// registerTheme 是全域的；同一組（模式×比例）只登記一次
const registeredThemes = new Set<string>()

defineOptions({ inheritAttrs: false })
const props = defineProps<{ option: Record<string, unknown> }>()
const attrs = useAttrs()

const { scale } = useTextScale()
const { resolvedMode } = useAppTheme()

const theme = computed(() => {
  const name = `oingg-${resolvedMode.value}-${scale.value}`
  if (!registeredThemes.has(name)) {
    registerTheme(name, chartTheme(resolvedMode.value, Number(scale.value) / 100))
    registeredThemes.add(name)
  }
  return name
})

// 走訪整個 option（series、axisLabel、legend.textStyle、rich 子樣式…），每個叫 fontSize 的鍵都乘上比例；'12px' 這種字串形式也處理。
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

const label = computed(() => {
  if (typeof attrs['aria-label'] === 'string' && attrs['aria-label']) return attrs['aria-label']
  const series = props.option.series
  const names = (Array.isArray(series) ? series : series ? [series] : [])
    .map(entry => (entry as { name?: unknown }).name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0)
  return names.length ? `${[...new Set(names)].join('、')} 圖表` : '圖表'
})
</script>

<template>
  <VChart v-bind="attrs" role="img" :aria-label="label" :option="scaledOption" :theme="theme" :init-options="INIT_OPTIONS" />
</template>
