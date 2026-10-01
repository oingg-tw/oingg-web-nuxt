<script setup lang="ts">
import type { MetricProvenanceEntry, MetricProvenanceResponse } from '#shared/types/metric-provenance'
import type { StockQuarter } from '~/composables/stock/useStockPeriodSelection'
import { jumpToStatementRow } from '~/composables/stock/useStatementRowFocus'
import { formatSignificantDigits } from '~/utils/format-significant-digits'
import { PER_SHARE_KEYS, STATEMENT_DEFINITIONS } from '~/utils/financial-statement-rows'

// 「X 是怎麼算出來的？」那一張計算依據表，2026-10-01 從 StockBadgeDetailPage 抽出來共用
// （「eps 沒有怎麼算出來的稽核表格又是為什麼? 都補上好嗎?」）。
//
// 抽出來而不是在指標模板再寫一份：那張表的三個細節都是踩過坑才長成現在這樣的（見下面的註解），
// 複製一份等於把那三個坑也複製一份。現在兩個模板共用同一份。
//
// GET /stocks/{symbol}/metric-provenance?metricCode= 對任何 metricCode 都有回應（實測 eps 5 列、
// 負債比率 2 列、存貨週轉天數 5 列且帶 methodologyNote），所以指標頁不需要另外的欄位或端點。
const props = defineProps<{
  symbol: string
  shortName: string
  topic: string
  provenance: MetricProvenanceResponse | null
  // 這一頁在「是多少」那一段講的那個數字。帶了就會對帳：溯源表描述的若不是同一個數字，整段不渲染。
  // 不帶（或 null）就不對帳——徽章頁在 provenanceMetricCode 跟徽章本身不同支時就是這種情況，
  // 那時兩個數字本來就不該相等。
  expectedValue?: number | null
}>()

const STATEMENT_LABELS: Record<string, string> = Object.fromEntries(
  STATEMENT_DEFINITIONS.map(definition => [definition.key, definition.label])
)

function provenanceSourceText(item: MetricProvenanceEntry): string {
  if (item.type === 'statementField' && item.statementType) return STATEMENT_LABELS[item.statementType] ?? item.statementType
  return item.sourceDescription ?? '—'
}

// 2026-10-01 修的 1000 倍錯誤：報表欄位的數字是**新台幣千元**（shared/types/financial-statement.ts
// 自己的註解，/financial-statements 那一頁也是這樣標的），而這一欄原本整欄直接丟給
// formatSignificantDigits——台積電單季淨利 452,301,407 千元於是顯示成「4.523億」，少了 1000 倍。
// 徽章頁從 2026-09-20 就是這樣，不是抽成共用元件造成的；抽出來以後兩個模板一起修好。
//
// 怎麼確認不是猜的：同一包 provenance 裡 四季淨利合計 × 1000 ÷ 流通股數 = 86.2 元，剛好是台積電
// 的近四季每股盈餘；不乘 1000 的話是 0.0862。
//
// 三種列三種刻度：報表欄位是千元、每股盈餘那兩個欄位本來就是元（PER_SHARE_KEYS 已經有這份清單，
// 財報三表的表格在用同一個）、`type: 'other'`（股數、收盤價、市場快照）是絕對值。
function provenanceScale(item: MetricProvenanceEntry): number {
  if (item.type !== 'statementField') return 1
  return item.fieldKey && PER_SHARE_KEYS.has(item.fieldKey) ? 1 : 1000
}

function formatProvenanceValue(item: MetricProvenanceEntry): string {
  const value = Number(item.value)
  return Number.isFinite(value) ? formatSignificantDigits(value * provenanceScale(item), 4) : String(item.value)
}

function openProvenanceEntry(item: MetricProvenanceEntry): void {
  if (item.type !== 'statementField' || !item.statementType || !item.fieldKey) return
  jumpToStatementRow({ statementType: item.statementType, rowKey: item.fieldKey, year: item.fiscalYear, quarter: item.fiscalQuarter as StockQuarter })
}

// 用收盤價算的指標，表格要說自己用的是哪一天的價格——它跟頁面上方的「目前值」可能不同（那個用
// 今天的價，這張表用知識日當天的收盤），兩個都對，caption 講清楚就不會被讀成互相矛盾。
// 對帳（2026-10-01）。analysis-ts 通知約 25 支指標的溯源數值跟指標本身還有落差，平均分母類最明顯，
// 正在修。我自己量了 41 個帶期別的指標頁（以各頁自己的期別比，不是一律 TTM）：34 支相符、**7 支不符**
// ——存貨週轉天數差 16.03、應收 9.33、應付 3.99、營業週期 25.36、現金循環週期 21.37、
// 資本支出佔營收 5.46、研發密集度 0.31（2026-10-01，2330）。
//
// 那 7 頁上「X 是怎麼算出來的？」描述的不是「X 是多少？」講的那個數字，而讀者會拿表格去驗算。
// 一段自己跟自己矛盾的稽核表比沒有稽核表糟，所以對不起來就不渲染。
//
// 門檻用誤差預算推導、不是用觀測值挑的：兩個數字是同一個量、各自獨立四捨五入到小數兩位（±0.005），
// 合計 ±0.01，取 0.02 留一倍餘裕；大數值那一端小數兩位不是限制因素，所以再給 0.2% 的相對門檻。
// 實測這條線把 0.31 跟 0.01 乾淨分開。
//
// 這是**通則不是那 7 支的名單**：上游修好就自己恢復，而未來任何一支出現同樣的問題也會被擋住。
const reconciles = computed(() => {
  const expected = props.expectedValue
  const actual = props.provenance?.value
  if (expected == null || actual == null) return true
  return Math.abs(actual - expected) <= Math.max(0.02, Math.abs(expected) * 0.002)
})

const caption = computed(() => {
  const priceEntry = props.provenance?.entries.find(item => item.sourceDescription?.includes('收盤價'))
  return priceEntry
    ? `${props.shortName} ${props.symbol} 的計算依據（${priceEntry.sourceDescription}）`
    : `${props.shortName} ${props.symbol} 的計算依據`
})
</script>

<template>
  <StockQuestionSection v-if="provenance?.entries.length && reconciles" id="stock-metric-provenance" :question="`${topic}是怎麼算出來的？`">
    <!-- SharedTableScroll, same as every other data-ssr-table in this app: the long 用途 strings make
         this the widest table in the family and it scrolled sideways at 375px without it. -->
    <SharedTableScroll :label="`${shortName} ${symbol} 的${topic}計算依據`">
      <table class="seo-table" data-ssr-table>
        <caption>{{ caption }}</caption>
        <thead>
          <tr>
            <th scope="col">用途</th>
            <th scope="col">會計期別</th>
            <th scope="col">來源</th>
            <th scope="col">數值</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in provenance.entries" :key="index">
            <td>
              <!-- v-if 的條件必須跟 openProvenanceEntry 的早退條件一字不差（2026-09-28）。原本只看
                   `type === 'statementField'`，而處理函式在缺 statementType 或 fieldKey 時直接 return——
                   於是那種列會渲染一顆按得下去、按了什麼都不會發生的按鈕。上游 2026-09-28 讓「這一期
                   沒有對應欄位」變成一個可表達的狀態（fieldKey 給 null），所以這種列會變多。
                   兩個條件寫兩次是刻意的：模板決定「能不能按」、函式決定「按了做什麼」，兩邊都得成立。 -->
              <button v-if="item.type === 'statementField' && item.statementType && item.fieldKey" type="button" class="stock-provenance__link" @click="openProvenanceEntry(item)">
                {{ item.role }}
              </button>
              <template v-else>{{ item.role }}</template>
            </td>
            <td>{{ item.fiscalYear }} Q{{ item.fiscalQuarter }}</td>
            <td>{{ provenanceSourceText(item) }}</td>
            <td>{{ formatProvenanceValue(item) }}</td>
          </tr>
        </tbody>
      </table>
    </SharedTableScroll>
    <p v-if="provenance.methodologyNote" class="stock-answer">{{ provenance.methodologyNote }}</p>
    <slot />
  </StockQuestionSection>
</template>

<style scoped>
/* Visible on purpose, not .visually-hidden like the directory tables' captions — it carries the
   as-of price date the 計算依據 table itself used (see `caption`'s own comment), which a sighted
   reader needs alongside the table, not just a screen reader. */
.seo-table caption {
  text-align: left;
  margin-bottom: 8px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

/* 真的 <button>，不是看起來可以按的 div——它會跳到財報三表的那一列，是一個動作不是一個連結。
   樣式照搬徽章頁原本那一條（2026-10-01 抽成共用元件時一起搬過來），`font: inherit` 讓它跟同一格
   的純文字列對齊：同一欄裡有的列可跳、有的不可跳，字體一變就看起來像兩種資料。 */
.stock-provenance__link {
  padding: 0;
  border: none;
  background: transparent;
  font: inherit;
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
</style>
