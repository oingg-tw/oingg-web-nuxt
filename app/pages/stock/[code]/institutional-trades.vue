<script setup lang="ts">
import type { InstitutionalTradesPage } from '#shared/utils/trading-flows'

// 三大法人（2026-11-24，使用者 11-23 選的「三大法人買賣超」，數據中台 00185-jqq、業務中台轉發）：外資、投信、自營商每天買賣超。只有上櫃
// 公司有來源（櫃買）；上市的個股三大法人只在證交所網站上，使用者「公司未成立師出無名，等公司成立後去信詢問」，這一頁說明、noindex、不進 sitemap。
// 圖是每月加總，表是最近 10 個交易日
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '三大法人'

const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
const { data, error, refresh } = await useFetch<InstitutionalTradesPage>(() => `/api/stock/${code.value}/institutional-trades`, { key: () => `stock-institutional-trades-${code.value}`, watch: [code] })
watchLoadFailure(() => `stock-institutional-trades:${code.value}`, () => error.value, refresh)

const months = computed(() => data.value?.months ?? [])
const recent = computed(() => data.value?.recent ?? [])
const answer = computed(() => {
  if (!data.value) return ''
  if (!data.value.source) {
    return data.value.market === 'sii'
      ? '上市公司的個股三大法人買賣超，臺灣證券交易所只放在網站上、不在開放資料裡，本站目前沒有。'
      : `目前沒有${stockShortName.value}的三大法人買賣超資料來源。`
  }
  return institutionalAnswer(recent.value[0], stockShortName.value)
})

const description = computed(() => clampDescription(`${stockShortName.value}（${code.value}）外資、投信、自營商每天的買賣超張數，每月加總的走勢與最近 10 個交易日，資料取自證券櫃檯買賣中心。`))

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '三大法人買賣超：外資、投信、自營商',
  pathSuffix: '/institutional-trades',
  stock,
  description,
  sectorCode: computed(() => profile.value?.sectorCode ?? null),
  noindex: computed(() => !months.value.length)
})

const footer = {
  sources: ['證券櫃檯買賣中心（2026）上櫃股票三大法人買賣明細'],
  links: [{ to: 'https://data.gov.tw/license', label: '政府資料開放授權條款第 1 版', external: true }],
  disclaimer: '以上數字依政府資料開放授權條款第 1 版，取自證券櫃檯買賣中心的開放資料，不代表本站對此個股之評等或投資建議。'
}
const GUIDE = [
  '三大法人是外資（外國機構投資人與陸資）、投信（國內的基金）與自營商（券商自己的部位）。買賣超＝當天買進減賣出的張數，正的是買超、負的是賣超，1 張是 1,000 股。',
  '圖是每個月每天買賣超的加總，三類疊在一起，賣超疊在零的下面；線是三大法人合計。表是最近 10 個交易日。',
  '目前只有上櫃公司的資料（證券櫃檯買賣中心）。上市公司的個股三大法人買賣超，臺灣證券交易所只放在網站上、不在開放資料裡，本站目前沒有。'
]
</script>

<template>
  <StockPageShell
    class="stock-institutional-trades-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <StockQuestionSection id="stock-institutional" :question="`三大法人最近買賣${stockShortName}多少？`" :answer="answer">
      <StockInstitutionalChart v-if="months.length" :months="months" />
    </StockQuestionSection>

    <StockQuestionSection v-if="recent.length" id="stock-institutional-recent" :question="`${stockShortName}最近 10 個交易日的三大法人買賣超`">
      <SharedTable :label="`${stockShortName}最近 10 個交易日的三大法人買賣超（張）`">
        <thead>
          <tr>
            <th scope="col">日期</th>
            <th scope="col" class="seo-table__num">外資</th>
            <th scope="col" class="seo-table__num">投信</th>
            <th scope="col" class="seo-table__num">自營商</th>
            <th scope="col" class="seo-table__num">合計</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="day in recent" :key="day.tradeDate">
            <th scope="row">{{ day.tradeDate }}</th>
            <td class="seo-table__num">{{ signedLots(day.foreignNetBuyLots) }}</td>
            <td class="seo-table__num">{{ signedLots(day.investmentTrustNetBuyLots) }}</td>
            <td class="seo-table__num">{{ signedLots(day.dealerNetBuyLots) }}</td>
            <td class="seo-table__num">{{ signedLots(day.totalNetBuyLots) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>

    <template #guide>
      <StockMetricGuide id-prefix="stock-institutional-trades" :topic="TOPIC" definition-question="三大法人買賣超是什麼？" :definition="GUIDE" />
    </template>
  </StockPageShell>
</template>
