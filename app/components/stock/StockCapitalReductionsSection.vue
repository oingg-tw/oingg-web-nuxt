<script setup lang="ts">
import type { CapitalReduction } from '~/utils/capital-reductions'

// 股本變化頁的「有沒有減資？」（2026-11-24，數據中台盤點三）：歷次減資，新的在上，含已公告、還沒恢復買賣的。每股退還、恢復買賣各一欄，
// 換發股數、基準日與停止買賣起訖寫在那一列底下（手機放得下五欄）
const props = defineProps<{ code: string; shortName: string }>()

const { data, error, refresh } = await useFetch<{ events: CapitalReduction[] }>(() => `/api/cached/stocks/${props.code}/capital-reductions`, {
  query: { includeUpcoming: 'true' },
  key: () => `stock-capital-reductions-${props.code}`,
  watch: [() => props.code]
})
watchLoadFailure(() => `stock-capital-reductions:${props.code}`, () => (error.value?.statusCode === 404 ? null : error.value), refresh)
const events = computed(() => [...(data.value?.events ?? [])].sort((a, b) => b.firstAnnouncedOn.localeCompare(a.firstAnnouncedOn)))
// 讀不到時不答（彈窗會重讀），免得寫成「查不到減資紀錄」
const answer = computed(() => (error.value && error.value.statusCode !== 404 ? '' : reductionAnswer(events.value, props.shortName)))
</script>

<template>
  <StockQuestionSection id="stock-capital-reductions" :question="`${shortName}（${code}）有沒有減資？`" :answer="answer">
    <SharedTable v-if="events.length" :label="`${shortName}的減資紀錄`">
      <thead>
        <tr>
          <th scope="col">公告日</th>
          <th scope="col">原因</th>
          <th scope="col">減資比率</th>
          <th scope="col">每股退還</th>
          <th scope="col">恢復買賣</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="event in events" :key="event.firstAnnouncedOn">
          <tr>
            <td>{{ event.firstAnnouncedOn }}</td>
            <td>{{ CAPITAL_REDUCTION_KIND[event.kind] ?? '－' }}</td>
            <td>{{ reductionRatioText(event) }}</td>
            <td>{{ refundText(event) }}</td>
            <td>{{ event.resumeDate ?? '還沒恢復買賣' }}</td>
          </tr>
          <tr v-if="reductionRemark(event)" class="seo-table__remark">
            <td colspan="5"><span class="seo-table__remark-text">{{ reductionRemark(event) }}</span></td>
          </tr>
        </template>
      </tbody>
    </SharedTable>
  </StockQuestionSection>
</template>
