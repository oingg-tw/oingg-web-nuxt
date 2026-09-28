<script setup lang="ts">
import type { FilterSchema } from '~/composables/screener/useFilterSchema'
import type { MetricsHistoryEntry, MetricsHistoryTimeframe } from '~/composables/stock/useMetricsHistory'
import { findMetricInSchema } from '~/utils/stock-digest'
import { periodLabel } from '~/utils/stock-series-table'
import { formatSignificantDigits } from '~/utils/format-significant-digits'
import { compositionRow } from '#shared/utils/metric-composition'

// 「由哪些項目組成」——指標頁的一段，不是一頁（2026-09-28「現在就把費用組成頁做起來，希望這個組成拆解
// 頁面也可以做成一個模板重用」）。
//
// 做成段而不是另一個路由與模板：母項本來就有自己的頁（/operating-expense 就是每股營業費用），組成是
// 那一頁少掉的一段，不是另一個主題。多開一條路由等於把同一支指標的定義、限制、誤讀文案複製到第二個
// 模板裡，然後兩份慢慢飄開。重用的單位是 METRIC_PAGES 的 `partMetricCodes` 一行加這個元件，新增一支
// 組成頁不必碰路由、登記表或模板。
//
// 名稱與單位一律從型錄（GET /metrics）讀，前端不放第二份中文——成分改名或改單位時這裡自動跟上。
//
// 一根加不起來的柱子比沒有柱子糟，因為它看起來跟其他柱子一樣可信。所以**只畫恆等式成立的期別**：
// 現有成分加起來等於母項（容差見下）才畫，加不起來就整期不畫，成立的期別少於兩期就整段不渲染
// （金融業的營業費用四項全 null，就是這個情況）。
//
// 缺值的成分當 0，但**那是恆等式的結論不是假設**——這兩件事差很多。2330 的每股預期信用減損損失有
// 16 期是 `insufficient_history`，而那 16 期的推銷＋管理＋研發**剛好等於**營業費用（實測 20/20），
// 所以那一項在那些期就是 0。先當 0 再檢查，跟當 0 之後不檢查，是我在營業費用上踩過的那個坑的兩邊：
// 後者曾經讓我把三家公司當成對不上回報給上游，實際上是我自己把 null 變成 0。
// 順序是「先用現有的值檢查恆等式，通過了才把缺的那幾項寫成 0」。
//
// 已知的邊界：同一期缺**兩項以上**時，恆等式只鎖得住它們的和，鎖不住各自的值（一項 +x、另一項 −x
// 也會通過）。營業費用這組不會發生——預期信用減損是唯一會缺的那一項。之後接別的組成時要重新想這件事。
//
// 前端也不用「母項 − 其他成分」去湊最後一項，那樣恆等式永遠成立，圖上看不出哪一段是推算的。
//
// **恆等式成立不等於數字是對的。** 它擋的是「不一致」，擋不住「一致地錯」——實例：6776 展碁國際的
// 114Q4 單季營業費用在上游是舊值（2026-09-28 analysis-ts 掃到 68 家、300 組），FY2025 15.70 對上同期
// TTM 13.92 差 -11%，但四個成分跟著那個壞掉的母項一起自洽，所以這裡五期全部通過、照常畫，而 2025Q4
// 那根柱子是錯的。從前端測不出來，只能等上游重算後讓快取失效。不要把這段檢查讀成資料品質保證。
const props = defineProps<{
  entries: MetricsHistoryEntry[]
  parentCode: string
  partCodes: string[]
  timeframe: MetricsHistoryTimeframe
  topic: string
  shortName: string
  code: string
}>()

const { data: filterSchema } = useNuxtData<FilterSchema>('filter-schema')
const categories = computed(() => filterSchema.value?.categories ?? [])
const metricOf = (code: string) => findMetricInSchema(categories.value, code)?.metric ?? null
const nameOf = (code: string): string => metricOf(code)?.name ?? code
const unit = computed(() => {
  const raw = metricOf(props.parentCode)?.unit
  return raw && raw !== '無單位' ? raw : ''
})

// 挑期別的規則住在 shared/utils/metric-composition.ts，因為它要有一個跑得起來的檢查
// （scripts/check-metric-composition.mjs）——.vue 裡的 computed 沒辦法從 node 呼叫。
interface CompositionRow {
  entry: MetricsHistoryEntry
  parent: number
  parts: number[]
}

const rows = computed<CompositionRow[]>(() => {
  const out: CompositionRow[] = []
  for (const entry of props.entries) {
    const row = compositionRow({
      parent: entry.values[props.parentCode]?.value ?? null,
      parts: props.partCodes.map(code => entry.values[code]?.value ?? null)
    })
    if (row) out.push({ entry, ...row })
  }
  return out
})

const usable = computed(() => rows.value.length >= 2 && shown.value.length >= 2)
const newest = computed(() => rows.value[rows.value.length - 1] ?? null)

// 每一期都是 0 的成分不畫、也不列（2330 的每股預期信用減損損失在 20 期裡全是 0）。它占一格圖例、
// 一個顏色與一整欄，卻沒有任何一期在說話。**只在全部都是 0 時丟掉**，不是「最新一期是 0」——後者會
// 讓一支曾經有過的成分在某一季突然從表上消失，而那一季正是它歸零的那一季，最該看得到。
// 丟掉全 0 的成分不影響恆等式：它加了 0。
const shown = computed(() => props.partCodes.map((_, i) => i).filter(i => rows.value.some(row => row.parts[i] !== 0)))

// 排序由最新一期的大小決定，而且圖、表、答句共用同一個順序——三個地方各自排序的話，讀者在圖上找到的
// 第一層在表上會是第三欄。第 0 層拿強調色，所以最大的那一項排第一個（見 StockStackedBarChart 的註解）。
const order = computed<number[]>(() => {
  const last = newest.value
  const index = [...shown.value]
  if (!last) return index
  return index.sort((a, b) => Math.abs(last.parts[b]!) - Math.abs(last.parts[a]!))
})

const categoriesLabels = computed(() => rows.value.map(row => periodLabel(row.entry, props.timeframe)))
const layers = computed(() =>
  order.value.map(i => ({ name: nameOf(props.partCodes[i]!), values: rows.value.map(row => row.parts[i]!) }))
)

const numberText = (value: number): string => `${formatSignificantDigits(value, 3)}${unit.value}`
const tooltipHeader = (index: number): string => {
  const row = rows.value[index]
  return row ? `${categoriesLabels.value[index]} 合計 ${numberText(row.parent)}` : ''
}

// 答句就是最新一期的分解，由大到小。百分比用母項當分母——恆等式已經檢查過，所以四項加起來必然接近
// 100%，不會出現「加起來 97%」那種讀者無法解釋的畫面。
const answer = computed(() => {
  const last = newest.value
  if (!last) return null
  const parts = order.value
    .map(i => ({ name: nameOf(props.partCodes[i]!), value: last.parts[i]! }))
    .map(part => `${part.name} ${numberText(part.value)}（${last.parent === 0 ? '—' : `${((part.value / last.parent) * 100).toFixed(1)}%`}）`)
  return `${periodLabel(last.entry, props.timeframe)} 的${props.topic} ${numberText(last.parent)}，由${parts.join('、')}組成。`
})

// 這張表**不放母項那一欄**（2026-09-28「operating-expense 表格有重複資料請優化」）。同一頁下面的逐期表
// 已經有「期別＋每股營業費用＋資料時間」，母項放在這裡會讓同一個數字在同一頁出現兩次。
//
// 刪的是這一欄而不是下面整張表：下面那張涵蓋**所有有值的期別**，這張只涵蓋恆等式成立的（實測 2330
// 20/20、1101 15/20、2317 9/20），刪掉下面那張會讓 1101 少 5 期、2317 少 11 期的數值。
//
// 母項沒有消失：堆疊柱的高度就是它，答句也直接寫出最新一期的金額與各項佔比。
// 表格由新到舊，跟站上每一張逐期表一致；圖由舊到新，因為圖是左右讀的。
const tableRows = computed(() => [...rows.value].reverse())
</script>

<template>
  <StockQuestionSection
    v-if="usable"
    id="stock-metric-composition"
    :question="`${topic}是由哪些項目組成的？`"
    :answer="answer"
  >
    <!-- 這一段沒有自己的圖（2026-09-28「operating-expense 表格有重複資料請優化」的同一件事，
         換到圖上）：上面「是多少」那一段的柱狀圖在有成分時本身就是堆疊圖，總高度是母項、分層是成分。
         同一個輪廓畫兩次，留一張就好，而留的是帶基準與視窗控制項的那一張。先圖表再表格仍然成立——
         圖在這一段上面，不在這一段裡面。 -->
    <SharedTableScroll :label="`${shortName} ${code} 的${topic}組成逐期數據`">
      <table class="seo-table" data-ssr-table>
        <caption>{{ shortName }} {{ code }} 的{{ topic }}組成</caption>
        <thead>
          <tr>
            <th scope="col">期別</th>
            <th v-for="i in order" :key="partCodes[i]" scope="col">{{ nameOf(partCodes[i]!) }}{{ unit ? `（${unit}）` : '' }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableRows" :key="`${row.entry.fiscalYear}-${row.entry.fiscalQuarter}`">
            <th scope="row">{{ periodLabel(row.entry, timeframe) }}</th>
            <td v-for="i in order" :key="partCodes[i]">{{ formatSignificantDigits(row.parts[i]!, 3) }}</td>
          </tr>
        </tbody>
      </table>
    </SharedTableScroll>
  </StockQuestionSection>
</template>

<style scoped>
.stock-metric-composition__card {
  margin-bottom: 16px;
}
</style>
