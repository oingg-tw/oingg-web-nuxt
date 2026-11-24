<script setup lang="ts">
import type { AttentionStock, DisposedStock } from '~/utils/market-alerts'

// 注意與處置股票（2026-11-24，使用者選「做一頁」）：全市場目前處置中、即將處置的股票，與最近被列為注意股票的。個股摘要卡的狀態標籤是
// 單一公司的；這一頁是全市場一覽。依交易所的資料來源規定，兩張表底下各寫一行出處（CLAUDE.md 的 Exchange data credit）
// 上市、上櫃各讀一份（見 mergeMarkets）
const readMarkets = <T>(path: string) => useAsyncData(`market-${path}`, () => Promise.all(ALERT_MARKETS.map(async market => ({
  market,
  items: (await $fetch<{ items: T[] }>(`/api/cached/market/${path}`, { query: { limit: MARKET_LIST_LIMIT, market } })).items
}))))
const [disposed, attention] = await Promise.all([readMarkets<DisposedStock>('disposed-stocks'), readMarkets<AttentionStock>('attention-stocks')])
watchLoadFailure('market-disposed-stocks', () => disposed.error.value, disposed.refresh)
watchLoadFailure('market-attention-stocks', () => attention.error.value, attention.refresh)

// 伺服器算的「今天」帶到瀏覽器，處置中與將處置在 hydration 時不會不一樣
const today = useState('taipei-today', () => holdingsTaipeiDate())
const live = computed(() => liveDispositions(mergeMarkets(disposed.data.value ?? [], item => item.announcementDate), today.value))
const notices = computed(() => mergeMarkets(attention.data.value ?? [], item => item.tradeDate))
const disposedAnswer = computed(() => (disposed.data.value ? dispositionAnswer(live.value) : ''))
const attentionText = computed(() => (attention.data.value ? attentionAnswer(attention.data.value) : ''))
const nameOf = (item: { symbol: string; companyName: string | null }) => [item.companyName, item.symbol].filter(Boolean).join(' ')
const pct = (value: number | null) => (value === null ? '－' : minusSign(`${value > 0 ? '+' : ''}${value.toFixed(2)}%`))

const breadcrumbs = [
  { label: '首頁', to: '/' },
  { label: '注意與處置股票', to: '/market/alerts' }
]
useHubPageSeo({
  title: '台股注意股票與處置股票一覽',
  description: () => clampDescription(`${disposedAnswer.value}${attentionText.value}全市場處置中與即將處置的股票、處置期間與原因，以及最近被列為注意股票的原因，資料取自臺灣證券交易所與證券櫃檯買賣中心。`),
  path: '/market/alerts',
  breadcrumbs
})
const GUIDE = [
  '注意股票：一檔股票的漲跌幅、成交量、周轉率等在短期內異常，達到交易所「公布注意交易資訊」的標準時，交易所在收盤後公布，提醒投資人注意。被列為注意股票不代表公司本身有問題。',
  '處置股票：短期內多次達到注意標準（例如連續三個營業日），交易所會在一段期間內處置：改成人工管制撮合、每隔一段時間才撮合一次，投資人買賣達一定數量要先收足款券，信用交易要收足自備款或保證金。措施依處置次數加重，詳細內容以交易所的公告為準。',
  '處置表列的是上市、上櫃各自最近 50 則處置公告裡，處置期間還沒結束的；注意表是上市、上櫃各自最近 50 則注意股票公告，合在一起，新的在上。上櫃的處置公告沒有「第幾次處置」。'
]
</script>

<template>
  <div class="app-page app-page--compact">
    <h1 class="app-page__title">注意與處置股票</h1>
    <StockBreadcrumb :items="breadcrumbs" />

    <section class="stock-page-section" aria-labelledby="alerts-disposed-heading">
      <h2 id="alerts-disposed-heading" class="stock-page-section__title">目前有哪些股票被處置？</h2>
      <p class="hub-answer">{{ disposedAnswer }}</p>
      <SharedTable v-if="live.length" label="處置中與即將處置的股票">
        <thead>
          <tr>
            <th scope="col">股票</th>
            <th scope="col">處置期間</th>
            <th scope="col">狀態</th>
            <th scope="col">原因</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in live" :key="`${item.symbol}-${item.dispositionStartDate}`">
            <th scope="row"><NuxtLink :to="securityPath(item.symbol)" class="seo-table__link">{{ nameOf(item) }}</NuxtLink></th>
            <td>{{ monthDay(item.dispositionStartDate) }}～{{ monthDay(item.dispositionEndDate) }}</td>
            <td>{{ item.upcoming ? '將處置' : '處置中' }}</td>
            <td>{{ [item.reason, item.dispositionMeasures].filter(Boolean).join('・') || '－' }}</td>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer hub-sources">資料來源：臺灣證券交易所、證券櫃檯買賣中心（處置股票）。</p>
    </section>

    <section class="stock-page-section" aria-labelledby="alerts-attention-heading">
      <h2 id="alerts-attention-heading" class="stock-page-section__title">最近哪些股票被列為注意股票？</h2>
      <p class="hub-answer">{{ attentionText }}</p>
      <SharedTable v-if="notices.length" label="最近被列為注意股票的股票">
        <thead>
          <tr>
            <th scope="col">日期</th>
            <th scope="col">股票</th>
            <th scope="col" class="seo-table__num">收盤價</th>
            <th scope="col" class="seo-table__num">六日漲跌幅</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(item, index) in notices" :key="`${item.tradeDate}-${item.symbol}-${index}`">
            <tr>
              <td>{{ item.tradeDate }}</td>
              <th scope="row"><NuxtLink :to="securityPath(item.symbol)" class="seo-table__link">{{ nameOf(item) }}</NuxtLink></th>
              <td class="seo-table__num">{{ item.close ?? '－' }}</td>
              <td class="seo-table__num" :class="priceDirectionClass(item.sixDayChangePct)">{{ pct(item.sixDayChangePct) }}</td>
            </tr>
            <tr v-if="item.reason" class="seo-table__remark">
              <td colspan="4"><span class="seo-table__remark-text">{{ item.reason }}</span></td>
            </tr>
          </template>
        </tbody>
      </SharedTable>
      <p class="hub-answer hub-sources">資料來源：臺灣證券交易所、證券櫃檯買賣中心（注意股票）。</p>
    </section>

    <StockMetricGuide id-prefix="alerts" topic="注意與處置股票" definition-question="注意股票與處置股票是什麼？" :definition="GUIDE" />
  </div>
</template>
