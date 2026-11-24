<script setup lang="ts">
import type { MarginTradingPage } from '#shared/utils/trading-flows'

// 信用交易（2026-11-24，使用者 11-23 選的「信用交易（融資融券、借券）」，數據中台 00185-jqq、業務中台轉發）：融資餘額與使用率、融券餘額與
// 券資比、上櫃的借券賣出餘額。圖是每月月底，表是最近 10 個交易日。上市的借券賣出餘額只在證交所網站、不在開放資料，這一頁不畫，定義段說明。
// 證交所的「今天借券賣出的上限」（TWT96U）等 11-25 之後上游有資料再加
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '信用交易'

const { stock, profile, stockShortName, stockPending } = useStockDetailSummary(code)
const { data, error, refresh } = await useFetch<MarginTradingPage>(() => `/api/stock/${code.value}/margin-trading`, { key: () => `stock-margin-trading-${code.value}`, watch: [code] })
watchLoadFailure(() => `stock-margin-trading:${code.value}`, () => error.value, refresh)

const months = computed(() => data.value?.months ?? [])
const last = computed(() => months.value.at(-1))
const recent = computed(() => data.value?.recent ?? [])
const hasSbl = computed(() => data.value?.sblShortBalanceSource === 'tpex' && months.value.some(month => month.sblShortBalanceLots !== null))
const history = computed(() => ({ latest: data.value?.latest ?? null }))
// 讀不到時不答（彈窗會重讀），免得寫成「不能信用交易」
const marginText = computed(() => (data.value ? marginAnswer(last.value, history.value, stockShortName.value) : ''))
const shortText = computed(() => (data.value ? shortAnswer(last.value, stockShortName.value) : ''))
const sblText = computed(() => {
  const value = last.value?.sblShortBalanceLots ?? null
  return value === null ? '' : `${last.value!.tradeDate} 借券賣出餘額 ${lotsNumber(value)} 張。`
})

const description = computed(() => clampDescription(`${stockShortName.value}（${code.value}）的融資餘額與融資使用率、融券餘額與券資比，每月月底的走勢與最近 10 個交易日的數字，資料取自臺灣證券交易所與證券櫃檯買賣中心。`))

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '信用交易：融資餘額、融資使用率、融券餘額與券資比',
  pathSuffix: '/margin-trading',
  stock,
  description,
  sectorCode: computed(() => profile.value?.sectorCode ?? null),
  noindex: computed(() => !months.value.length)
})

const footer = {
  sources: ['臺灣證券交易所（2026）上市股票融資融券餘額', '證券櫃檯買賣中心（2026）上櫃股票融資融券餘額、借券賣出餘額'],
  links: [{ to: 'https://data.gov.tw/license', label: '政府資料開放授權條款第 1 版', external: true }],
  disclaimer: '以上數字依政府資料開放授權條款第 1 版，取自臺灣證券交易所與證券櫃檯買賣中心的開放資料，不代表本站對此個股之評等或投資建議。'
}
const GUIDE = [
  '融資是向券商借錢買股票，融券是向券商借股票來賣。融資使用率＝融資餘額 ÷ 融資限額，券資比＝融券餘額 ÷ 融資餘額。1 張是 1,000 股。',
  '圖是每個月最後一個交易日的餘額，這個月還沒過完的是最新一天；表是最近 10 個交易日。不在融資融券名單上的日子沒有數字，限額是 0 的日子是暫停，沒有使用率。',
  '借券賣出是向證券金融公司或其他投資人借股票來賣，跟融券分開計算。上櫃公司的借券賣出餘額取自證券櫃檯買賣中心；上市公司的只放在臺灣證券交易所的網站、不在開放資料裡，本站目前沒有。'
]
</script>

<template>
  <StockPageShell
    class="stock-margin-trading-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <StockQuestionSection id="stock-margin" :question="`${stockShortName}的融資用了多少？`" :answer="marginText">
      <StockMarginChart kind="margin" :months="months" />
    </StockQuestionSection>

    <StockQuestionSection v-if="months.length" id="stock-short" :question="`${stockShortName}的融券有多少？`" :answer="shortText">
      <StockMarginChart kind="short" :months="months" />
    </StockQuestionSection>

    <StockQuestionSection v-if="hasSbl" id="stock-sbl" :question="`${stockShortName}的借券賣出餘額多少？`" :answer="sblText">
      <StockMarginChart kind="sbl" :months="months" />
    </StockQuestionSection>

    <StockQuestionSection v-if="recent.length" id="stock-margin-recent" :question="`${stockShortName}最近 10 個交易日的融資融券`">
      <SharedTable :label="`${stockShortName}最近 10 個交易日的融資融券（張）`">
        <thead>
          <tr>
            <th scope="col">日期</th>
            <th scope="col" class="seo-table__num">融資餘額</th>
            <th scope="col" class="seo-table__num">融資使用率</th>
            <th scope="col" class="seo-table__num">融券餘額</th>
            <th scope="col" class="seo-table__num">券資比</th>
            <th v-if="hasSbl" scope="col" class="seo-table__num">借券賣出餘額</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="day in recent" :key="day.tradeDate">
            <th scope="row">{{ day.tradeDate }}</th>
            <td class="seo-table__num">{{ lotsNumber(day.marginBalanceLots) }}</td>
            <td class="seo-table__num">{{ ratePct(day.marginUtilizationRate) }}</td>
            <td class="seo-table__num">{{ lotsNumber(day.shortBalanceLots) }}</td>
            <td class="seo-table__num">{{ ratePct(day.shortToMarginRatio) }}</td>
            <td v-if="hasSbl" class="seo-table__num">{{ lotsNumber(day.sblShortBalanceLots) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>

    <template #guide>
      <StockMetricGuide id-prefix="stock-margin-trading" :topic="TOPIC" definition-question="融資、融券與券資比是什麼？" :definition="GUIDE" />
    </template>
  </StockPageShell>
</template>
