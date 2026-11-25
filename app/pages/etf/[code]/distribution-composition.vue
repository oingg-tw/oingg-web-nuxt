<script setup lang="ts">
import type { EtfDistributionComposition } from '#shared/types/screener-detail'

// ETF 面向：配息組成（2026-10-18，原本 /screener/etf/{代號} 第二段的下半；更早是篩選結果每列的彈窗）。每次配息依來源分層的堆疊柱＋組成表。
// 比例是投信公告的預估值（上游附註原文收在 details 裡）
const etfData = await useEtf()
const { code, data, shortName } = etfData

const events = computed(() => [...(data.value?.distributions?.events ?? [])].sort((a, b) => b.exDividendDate.localeCompare(a.exDividendDate)))
// 組成是 2023-11-01 起才規定要公告（證交所臺證上二字第 1120018011 號公告，基金後台 2026-11-24 查證；之前只要求揭露股息占比，
// 資料裡 2023-01 以前一筆都沒有、2023-02～10 是部分投信先揭露）。使用者問「為什麼etf有些配息組成未公告？」：在那之前沒有組成的配息
// 不再每列寫「組成未公告」，表格下面說一次；規定之後還沒有的（剛公告、少數例外）才是真的未公告，照列
const RULE_DATE = '2023-11-01'
const listed = computed(() => events.value.filter(event => hasEtfComposition(event.composition) || event.exDividendDate >= RULE_DATE))
const beforeRule = computed(() => events.value.length - listed.value.length)
const share = (value: number | null) => (value === null ? '未揭露' : `${value.toFixed(2)}%`)
function undisclosed(composition: EtfDistributionComposition): string {
  const gap = 100 - ETF_DISTRIBUTION_PARTS.reduce((total, part) => total + (composition[part.key] ?? 0), 0)
  return gap > 0.05 ? `${gap.toFixed(2)}%` : '－'
}

// 答句寫占比最大的那一項，每一項都在下面的表裡（2026-11-06，使用者：「卡片之前的文字描述過多了，會失焦」）；逐項的長句給搜尋結果
function answerFor(detailed: boolean) {
  if (!events.value.length) return '目前沒有這檔 ETF 的配息紀錄。'
  const latest = events.value.find(event => hasEtfComposition(event.composition))
  if (!latest) return events.value.every(event => event.exDividendDate < RULE_DATE) ? '這檔 ETF 的配息都在 2023 年 11 月以前，當時還沒有規定公告組成。' : '投信還沒有公告過這檔 ETF 配息的組成。'
  const composition = latest.composition!
  const largest = [...ETF_DISTRIBUTION_PARTS].sort((a, b) => (composition[b.key] ?? 0) - (composition[a.key] ?? 0))[0]!
  if (!detailed) return `最近一次 ${latest.exDividendDate} 除息，占比最大的是${largest.name} ${share(composition[largest.key])}（投信公告的預估比例）。`
  return `最近一次是 ${latest.exDividendDate} 除息：股利所得 ${share(composition.dividendIncomePct)}、利息所得 ${share(composition.interestIncomePct)}、收益平準金 ${share(composition.incomeEqualizationPct)}、已實現資本利得 ${share(composition.realizedCapitalGainPct)}（投信公告的預估比例）。`
}
const answer = computed(() => answerFor(false))
const description = computed(() => answerFor(true))
const latestWarning = computed(() => events.value.find(event => event.distributionWarning)?.distributionWarning ?? null)
</script>

<template>
  <EtfPage :etf-data="etfData" facet="composition" :description="description">
    <StockQuestionSection id="etf-composition" :question="`${shortName}（${code}）配的錢從哪裡來？`" :answer="answer">
      <EtfFacetChart v-if="data" :data="data" facet="composition" />
      <SharedTable v-if="listed.length" :label="`${shortName}歷次配息組成`" :caption="`${shortName} ${code} 歷次配息組成（投信公告的預估比例，新的在上）`">
        <thead>
          <tr>
            <th scope="col">除息日</th>
            <th scope="col" class="seo-table__num">每單位配息</th>
            <th v-for="part in ETF_DISTRIBUTION_PARTS" :key="part.key" scope="col" class="seo-table__num">{{ part.name }}</th>
            <th scope="col" class="seo-table__num">未揭露</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in listed" :key="event.exDividendDate">
            <th scope="row">{{ event.exDividendDate }}</th>
            <td class="seo-table__num">{{ etfDistributionText(event) }}</td>
            <td v-if="!hasEtfComposition(event.composition)" :colspan="ETF_DISTRIBUTION_PARTS.length + 1">組成未公告</td>
            <template v-else>
              <td v-for="part in ETF_DISTRIBUTION_PARTS" :key="part.key" class="seo-table__num">{{ share(event.composition![part.key]) }}</td>
              <td class="seo-table__num">{{ undisclosed(event.composition!) }}</td>
            </template>
          </tr>
        </tbody>
      </SharedTable>
      <p v-if="beforeRule" class="hub-answer">2023 年 11 月 1 日起，證交所規定 ETF 配息要在除息前公告預估的收益分配組成（臺證上二字第 1120018011 號公告）；在這之前多半沒有公告，所以更早的 {{ beforeRule }} 次配息不列在表裡，每次配多少見「配息」頁。</p>
      <p class="hub-answer">收益平準金是新申購的人買進時付的錢、已實現資本利得是賣股票的價差，兩者都來自基金的本金與資產，不是持股配發的股利或利息。</p>
      <details v-if="latestWarning" class="app-card hub-details">
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
