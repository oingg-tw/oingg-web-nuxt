<script setup lang="ts">
import type { MetricsHistoryEntry, MetricsHistoryTimeframe } from '#shared/types/metrics-history'
// 「X 的歷年變化如何？」那一張逐期表，2026-10-01 從 StockMetricDetailPage 抽出來共用
//（「roe 沒有歷年變化的表格又是為什麼? 都補上好嗎?」）。
//
// 那 7 個徽章頁拿到的 series 跟指標頁是同一個端點、同一個形狀（實測 roe 20 期），缺的只是這張表——
// 所以這裡沒有任何徽章專屬的分支，兩個模板傳一樣的東西。
const props = defineProps<{
  entries: MetricsHistoryEntry[]
  metricCode: string
  timeframe: MetricsHistoryTimeframe
  topic: string
  unit: string
  shortName: string
  code: string
  // 上市櫃日（YYYY-MM-DD），只有用到股價的指標（河流圖那幾頁）傳。2026-10-17 6498 久禾光：2025-05-20 才上櫃，之前 7 季財報在 MOPS
  // 有、股價沒有，pbRatio 是 missing_input，原本寫「無法計算」讀起來像資料出錯
  listedOn?: string | null
}>()

const points = computed(() => metricHistoryPoints(props.entries, props.metricCode))
type HistoryPoint = (typeof points.value)[number]
// 財報公布（knowledgeDate）在上市櫃日之前、又缺計算材料：缺的就是股價
const beforeListing = (entry: HistoryPoint) =>
  !!props.listedOn && entry.point?.value === null && entry.point.nullReason === 'missing_input' && (entry.point.knowledgeDate ?? '') < props.listedOn
const text = computed(() => {
  const list = points.value
  return historyTableText({ ...props, basis: TIMEFRAME_LABELS[props.timeframe], count: list.length, from: list.length ? periodLabel(list.at(-1)!, props.timeframe) : '', to: list.length ? periodLabel(list[0]!, props.timeframe) : '' })
})
// 只有一期時不寫涵蓋期間（同 metricHistoryAnswer 的 < 2 門檻）
const answer = computed(() => (points.value.length < 2 ? null : text.value.answer))
</script>

<template>
  <StockQuestionSection v-if="points.length" id="stock-metric-history" :question="text.question" :answer="answer">
    <SharedTableScroll :label="text.label">
      <!-- data-ssr-table="history"：指標頁一圖一表的那一張表（scripts/check-stock-pages.mjs 數它） -->
      <table class="seo-table" data-ssr-table="history">
        <caption class="visually-hidden">{{ text.label }}</caption>
        <thead>
          <tr>
            <th scope="col">期別</th>
            <th scope="col">{{ topic }}{{ unit ? `（${unit}）` : '' }}</th>
            <th scope="col">資料時間</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in points" :key="`${entry.fiscalYear}-${entry.fiscalQuarter}`">
            <th scope="row">{{ periodLabel(entry, timeframe) }}</th>
            <td v-if="beforeListing(entry)" :title="`${listedOn} 才上市櫃，這一期財報公布時還沒有股價`">上市櫃前沒有股價</td>
            <td v-else :title="entry.point ? nullReasonTitle(entry.point) : undefined">{{ metricCellText(entry.point, unit) }}</td>
            <!-- 算不出數值的列不寫資料時間（2026-10-17「沒上市 那為什麼會有資料時間?」）：那個日期是分母的財報公布日，不是這個數字的 -->
            <td>{{ entry.point?.value != null ? entry.point.knowledgeDate ?? '—' : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </SharedTableScroll>
  </StockQuestionSection>
</template>

