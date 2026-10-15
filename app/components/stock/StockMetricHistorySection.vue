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
}>()

const points = computed(() => metricHistoryPoints(props.entries, props.metricCode))
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
            <td :title="entry.point ? nullReasonTitle(entry.point) : undefined">{{ metricCellText(entry.point, unit) }}</td>
            <td>{{ entry.point?.knowledgeDate ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </SharedTableScroll>
  </StockQuestionSection>
</template>

