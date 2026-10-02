<script setup lang="ts">
import type { MetricsHistoryEntry, MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import { metricHistoryPoints, metricHistoryAnswer, metricCellText } from '~/utils/metric-history-points'
import { TIMEFRAME_WORD, periodLabel } from '~/utils/stock-series-table'
import { nullReasonTitle } from '~/utils/metric-null-reason'

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
const answer = computed(() => metricHistoryAnswer(points.value, props))
</script>

<template>
  <StockQuestionSection v-if="points.length" id="stock-metric-history" :question="`${shortName}的${topic}歷年變化如何？`" :answer="answer">
    <SharedTableScroll :label="`${shortName} ${code} 的${topic}逐期數據`">
      <table class="seo-table" data-ssr-table>
        <caption>{{ shortName }} {{ code }} 的{{ topic }}（{{ TIMEFRAME_WORD[timeframe] }}）</caption>
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

<style scoped>
/* 跟計算依據表同一條：靠左、退一階。指標頁這張表原本沿用瀏覽器預設（居中、同字級），兩張表並排
   時標題對不齊——2026-10-01 兩個模板都開始同時出現這兩張表，所以統一。 */
.seo-table caption {
  text-align: left;
  margin-bottom: 8px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}
</style>
