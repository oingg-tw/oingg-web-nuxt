<script setup lang="ts">
import type { EtfDistributionComposition } from '#shared/types/screener-detail'

// ETF 面向：配息組成（2026-10-18，原本 /screener/etf/{代號} 第二段的下半；更早是篩選結果每列的彈窗）。每次配息依來源分層的堆疊柱＋組成表。
// 比例是投信公告的預估值（上游附註原文收在 details 裡）
const etfData = await useEtf()
const { code, data, shortName } = etfData

const events = computed(() => [...(data.value?.distributions?.events ?? [])].sort((a, b) => b.exDividendDate.localeCompare(a.exDividendDate)))
const share = (value: number | null) => (value === null ? '未揭露' : `${value.toFixed(2)}%`)
function undisclosed(composition: EtfDistributionComposition): string {
  const gap = 100 - ETF_DISTRIBUTION_PARTS.reduce((total, part) => total + (composition[part.key] ?? 0), 0)
  return gap > 0.05 ? `${gap.toFixed(2)}%` : '—'
}

const answer = computed(() => {
  if (!events.value.length) return '目前沒有這檔 ETF 的配息紀錄。'
  const latest = events.value.find(event => hasEtfComposition(event.composition))
  if (!latest) return '投信還沒有公告過這檔 ETF 配息的組成。'
  const composition = latest.composition!
  const announced = events.value.filter(event => hasEtfComposition(event.composition)).length
  return `${events.value.length} 次配息中 ${announced} 次有公告組成。最近一次是 ${latest.exDividendDate} 除息：股利所得 ${share(composition.dividendIncomePct)}、利息所得 ${share(composition.interestIncomePct)}、收益平準金 ${share(composition.incomeEqualizationPct)}、已實現資本利得 ${share(composition.realizedCapitalGainPct)}（投信公告的預估比例）。`
})
const latestWarning = computed(() => events.value.find(event => event.distributionWarning)?.distributionWarning ?? null)
</script>

<template>
  <EtfPage :etf-data="etfData" facet="composition" :description="answer">
    <StockQuestionSection id="etf-composition" :question="`${shortName}（${code}）配的錢從哪裡來？`" :answer="answer">
      <EtfFacetChart v-if="data" :data="data" facet="composition" />
      <SharedTable v-if="events.length" :label="`${shortName}歷次配息組成`" :caption="`${shortName} ${code} 歷次配息組成（投信公告的預估比例，新的在上）`">
        <thead>
          <tr>
            <th scope="col">除息日</th>
            <th scope="col" class="seo-table__num">每單位配息</th>
            <th v-for="part in ETF_DISTRIBUTION_PARTS" :key="part.key" scope="col" class="seo-table__num">{{ part.name }}</th>
            <th scope="col" class="seo-table__num">未揭露</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in events" :key="event.exDividendDate">
            <th scope="row">{{ event.exDividendDate }}</th>
            <td class="seo-table__num">{{ event.distributionPerUnit === null ? '尚未公布' : etfYuan(event.distributionPerUnit) }}</td>
            <td v-if="!hasEtfComposition(event.composition)" :colspan="ETF_DISTRIBUTION_PARTS.length + 1">組成未公告</td>
            <template v-else>
              <td v-for="part in ETF_DISTRIBUTION_PARTS" :key="part.key" class="seo-table__num">{{ share(event.composition![part.key]) }}</td>
              <td class="seo-table__num">{{ undisclosed(event.composition!) }}</td>
            </template>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer">收益平準金是新申購的人買進時付的錢、已實現資本利得是賣股票的價差，兩者都來自基金的本金與資產，不是持股配發的股利或利息。</p>
      <details v-if="latestWarning" class="hub-details">
        <summary>投信公告附註（原文）</summary>
        <blockquote class="etf-composition__warning">{{ latestWarning }}</blockquote>
      </details>
    </StockQuestionSection>
  </EtfPage>
</template>

<style scoped>
.etf-composition__warning {
  margin: 8px 0 0;
  padding-left: 12px;
  border-left: 3px solid var(--el-border-color);
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
</style>
