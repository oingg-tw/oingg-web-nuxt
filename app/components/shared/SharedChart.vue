<script setup lang="ts">
import VChart from 'vue-echarts'
import { use, registerTheme } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendPlainComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
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
use([SVGRenderer, BarChart, LineChart, GridComponent, LegendPlainComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent])
const INIT_OPTIONS = { renderer: 'svg' } as const
// registerTheme 是全域的；同一組（模式×比例）只登記一次
const registeredThemes = new Set<string>()

// 同時進到範圍的圖排隊，一個 task 畫一張、畫面上方的先畫（2026-11-12 PSI 手機：速覽 5 張、ETF 首頁 8 張圖在同一個 task 裡接連 init 與
// setOption，/stock/2330 有 221–373 ms 的長任務）。每張之間讓出主執行緒，捲動、點擊不必等全部畫完
const drawQueue: { top: number; start: () => void }[] = []
let draining = false
function drawNext() {
  drawQueue.sort((a, b) => a.top - b.top)
  const next = drawQueue.shift()
  if (!next) {
    draining = false
    return
  }
  next.start()
  setTimeout(drawNext, 0)
}
function queueDraw(top: number, start: () => void) {
  drawQueue.push({ top, start })
  if (draining) return
  draining = true
  setTimeout(drawNext, 0)
}

defineOptions({ inheritAttrs: false })
const props = defineProps<{ option: Record<string, unknown> }>()
const attrs = useAttrs()

const { scale } = useTextScale()
const { resolvedMode } = useAppTheme()

const theme = computed(() => {
  const name = `oingg-${resolvedMode.value}-${scale.value}`
  if (!registeredThemes.has(name)) {
    registerTheme(name, chartTheme(resolvedMode.value, scale.value / 100))
    registeredThemes.add(name)
  }
  return name
})

// 全是數字、字串或 null 的陣列（資料點）不必複製，原樣交給 ECharts；toRaw：不把 reactive 的 proxy 交出去（2026-11-12 PSI：河流圖 7 條線
// 各一千多個點，原本每次重算都整份複製兩次）
const isFlat = (list: unknown[]) => list.every(item => item === null || (typeof item !== 'object' && typeof item !== 'function'))

// 走訪整個 option（series、axisLabel、legend.textStyle、rich 子樣式…），每個叫 fontSize 的鍵都乘上比例；'12px' 這種字串形式也處理。
function scaleFontSizes(value: unknown, ratio: number): unknown {
  if (Array.isArray(value)) return isFlat(value) ? toRaw(value) : value.map(item => scaleFontSizes(item, ratio))
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

// 圖例不能點（2026-10-14，杜邦圖 a11y 稽核）：ECharts 的圖例預設點一下就隱藏那條線，但那是只有滑鼠做得到的功能（WCAG 2.1.1 鍵盤
// 可操作）。全站圖都經過這裡，所以一處關掉；圖例只剩說明線條是什麼，數值另有 SSR 表格。呼叫端明寫 selectedMode 的照它的。
function withStaticLegend(option: Record<string, unknown>): Record<string, unknown> {
  const legend = option.legend
  if (!legend) return option
  const fix = (entry: unknown) => (entry && typeof entry === 'object' ? { selectedMode: false, ...(entry as Record<string, unknown>) } : entry)
  return { ...option, legend: Array.isArray(legend) ? legend.map(fix) : fix(legend) }
}

// 負號一律是減號「−」（2026-11-03，使用者：「負號統一」）：每個 formatter／valueFormatter 函式的輸出換掉連字號負號（minusSign 只換
// 數字前面那個，日期與 HTML 標籤裡的不動）；數值軸沒給 formatter 的補一個 groupThousands——ECharts 預設的刻度印「-0.5」
function withMinusSign(value: unknown, key = ''): unknown {
  if (typeof value === 'function') {
    if (key !== 'formatter' && key !== 'valueFormatter') return value
    return (...args: unknown[]) => {
      const out = (value as (...params: unknown[]) => unknown)(...args)
      return typeof out === 'string' ? minusSign(out) : out
    }
  }
  if (Array.isArray(value)) return isFlat(value) ? toRaw(value) : value.map(item => withMinusSign(item, key))
  if (value === null || typeof value !== 'object') return value
  const result: Record<string, unknown> = {}
  for (const [entryKey, entry] of Object.entries(value as Record<string, unknown>)) result[entryKey] = withMinusSign(entry, entryKey)
  const axisType = result.type ?? (key === 'yAxis' ? 'value' : 'category')
  if ((key === 'xAxis' || key === 'yAxis') && axisType === 'value') {
    const axisLabel = (result.axisLabel ?? {}) as Record<string, unknown>
    if (!axisLabel.formatter) result.axisLabel = { ...axisLabel, formatter: (tick: number) => groupThousands(tick) }
  }
  return result
}

// markRaw：vue-echarts 深層監看 option，每次重算都會再走訪一遍；這裡每次都是新物件，換參考就夠它知道要更新
const scaledOption = computed(() => markRaw(withMinusSign(withStaticLegend(scaleFontSizes(props.option, scale.value / 100) as Record<string, unknown>)) as Record<string, unknown>))

// 有東西蓋住頁面時收起提示框與指示線（hideChartTips，見 chart-palette.ts）。只發 hideTip 的話軸上的指示線還在
const chartRef = ref<InstanceType<typeof VChart> | null>(null)
function hideTip() {
  chartRef.value?.dispatchAction({ type: 'hideTip' })
  chartRef.value?.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' })
}

// 圖進到畫面附近（上下 300px）才掛上 ECharts（2026-10-23，手機換頁延遲：一頁多張圖時，換頁那一刻所有圖一起算，中階手機速覽要 0.9 秒
// 才換掉舊頁）。2026-11-12 PSI 手機起連 init 都等：原本只延後資料，畫面外的圖照樣 init、掛 ResizeObserver、量尺寸（ETF 首頁 8 張）。
// 之前是一個空的 div，帶呼叫端同樣的 class 與 style，大小一樣，所以版面不動；伺服器輸出的就是這個 div
const inView = ref(false)
const placeholderRef = ref<HTMLElement | null>(null)
const placeholderAttrs = computed(() => ({ class: attrs.class, style: attrs.style }))
let observer: IntersectionObserver | undefined
let disposed = false

onMounted(() => {
  window.addEventListener(HIDE_CHART_TIPS, hideTip)
  observer = new IntersectionObserver((entries) => {
    const entry = entries.find(item => item.isIntersecting)
    if (!entry) return
    observer?.disconnect()
    queueDraw(entry.boundingClientRect.top, () => {
      if (!disposed) inView.value = true
    })
  }, { rootMargin: '300px 0px' })
  observer.observe(placeholderRef.value!)
})
onUnmounted(() => {
  disposed = true
  window.removeEventListener(HIDE_CHART_TIPS, hideTip)
  observer?.disconnect()
})

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
  <VChart v-if="inView" ref="chartRef" v-bind="attrs" role="img" :aria-label="label" :option="scaledOption" :theme="theme" :init-options="INIT_OPTIONS" />
  <div v-else ref="placeholderRef" v-bind="placeholderAttrs" class="shared-chart-placeholder" role="img" :aria-label="label" />
</template>

<style>
/* 同 vue-echarts 給 x-vue-echarts 的預設（寬高 100%），特異性 0：呼叫端的 class 一樣蓋得過，佔位跟掛上之後的圖一樣大 */
:where(.shared-chart-placeholder) {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
</style>
