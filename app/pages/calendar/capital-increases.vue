<script setup lang="ts">
import type { CapitalIncreasesResponse } from '~/utils/capital-increases'

// 現金增資（2026-11-25，使用者「只做現增」「配息月曆改名股東月曆，這樣就可以把現金增資放到sidebar」「好 案照建議」；設計
// https://claude.ai/artifact/B88jqF2TnNYFetB3omEftY）：股東月曆側欄的第三項。三個問題各一張對齊的表：接下來要除權的、已除權要繳款的
//（繳款一截止就不列）、初次上市櫃的公開申購（沒有張數：公司公告只有含競價拍賣的合計）。抽籤日與中籤率沒有授權來源，連到證交所的公告。
// 資料是數據中台的 GET /market/capital-increases（業務中台轉發），三個陣列各自排好序，一小時一份
const { data, error, refresh } = await useAsyncData('market-capital-increases', () => $fetch<CapitalIncreasesResponse>('/api/cached/market/capital-increases'))
watchLoadFailure('market-capital-increases', () => error.value, refresh)
// 個股配息頁連過來的那一家（#ci-代號）淡底標出。站內換頁走 pushState，:target 不會更新，所以讀路由；伺服器拿不到 hash，等水合完才標
const hasHydrated = useHasHydrated()
const route = useRoute()
const isTarget = (symbol: string) => hasHydrated.value && route.hash === `#ci-${symbol}`

const upcoming = computed(() => data.value?.upcoming ?? [])
const paying = computed(() => data.value?.paying ?? [])
const subscriptions = computed(() => data.value?.publicSubscriptions ?? [])
const groups = computed(() => payingGroups(paying.value))
const lead = computed(() => (data.value ? leadText(data.value) : ''))
const codeOf = (row: { symbol: string; companyName: string | null }) => (row.companyName ? row.symbol : '')
// 證交所的公開申購公告：上市、上櫃的抽籤日程與中籤率都在這一頁（另開新視窗）。不帶年份、預設顯示當年（證交所的工作階段 2026-11-26；
// 背後撈資料的 publicForm?yy= 帶年份，不給讀者）
const TWSE_PUBLIC_OFFERINGS = 'https://www.twse.com.tw/zh/announcement/public.html'

const { breadcrumbs } = useHubPageSeo({
  title: '台股現金增資：除權日、繳款期間與認購價',
  description: () => clampDescription(`${lead.value}每一家的除權日、原股東每仟股認購股數、認購價與繳款期間，以及初次上市櫃的公開申購期間與承銷價。`),
  path: '/calendar/capital-increases',
  breadcrumbs: [
    { label: '首頁', to: '/' },
    { label: '現金增資', to: '/calendar/capital-increases' }
  ]
})
const GUIDE = [
  '現金增資是公司發新股換錢：原股東可以照持股比例、用認購價買新股，要自己付錢，不是股利。',
  '除權日前一天收盤時持有，才拿得到認購權。除權日股價照公式往下調，不認購的人持股比例會被稀釋。',
  '繳款期間寫的是原股東及員工的那一段，特定人另有期間；期間內沒有繳款就是放棄認購。繳款截止後這一家就不再列在表上。',
  '每仟股認購：每持有 1,000 股可以認購的股數。認購價常在除權前才定價，還沒訂的寫「待定價」。',
  '初次上市櫃的公開申購：抽籤日、中籤率和可以抽的張數不在公司的公告裡，請看證交所的公開申購公告。'
]
</script>

<template>
  <div class="app-page capital-increases">
    <h1 class="app-page__title">現金增資</h1>
    <StockBreadcrumb :items="breadcrumbs" />
    <CalendarNav />
    <p v-if="lead" class="hub-answer">{{ lead }}</p>

    <StockQuestionSection id="capital-increases-upcoming" question="接下來哪些公司要現金增資除權？" :answer="data ? upcomingAnswer(upcoming) : null">
      <SharedTable v-if="upcoming.length" label="接下來要現金增資除權的公司" table-class="capital-increases__table">
        <thead>
          <tr>
            <th scope="col">公司</th>
            <th scope="col" class="seo-table__num">除權日</th>
            <th scope="col" class="seo-table__num">每仟股<wbr>認購（股）</th>
            <th scope="col" class="seo-table__num">認購價<wbr>（元）</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in upcoming" :id="`ci-${row.symbol}`" :key="row.symbol" :class="{ 'capital-increases__target': isTarget(row.symbol) }">
            <th scope="row" class="capital-increases__name">
              <NuxtLink :to="securityPath(row.symbol)" class="seo-table__link">{{ row.companyName ?? row.symbol }}</NuxtLink>
              <span v-if="codeOf(row)" class="capital-increases__code">{{ codeOf(row) }}</span>
            </th>
            <td class="seo-table__num">{{ dayText(row.exRightsDate) }}</td>
            <td class="seo-table__num">{{ ratioText(row) }}</td>
            <td class="seo-table__num">{{ priceText(row.subscriptionPricePerShare) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>

    <StockQuestionSection id="capital-increases-paying" question="已除權的，什麼時候繳款？" :answer="data ? payingAnswer(paying) : null">
      <SharedTable v-if="paying.length" label="已除權、還沒繳完款的現金增資" table-class="capital-increases__table" class="capital-increases__card">
        <thead>
          <tr>
            <th scope="col">公司</th>
            <th scope="col" class="seo-table__num">繳款<wbr>期間</th>
            <th scope="col" class="seo-table__num">每仟股<wbr>認購（股）</th>
            <th scope="col" class="seo-table__num">認購價<wbr>（元）</th>
          </tr>
        </thead>
        <tbody v-for="group in groups" :key="group.phase">
          <tr class="capital-increases__group">
            <th colspan="4" scope="rowgroup">{{ group.label }} <span class="capital-increases__muted">{{ group.rows.length }} 家</span></th>
          </tr>
          <tr v-for="row in group.rows" :id="`ci-${row.symbol}`" :key="row.symbol" :class="{ 'capital-increases__target': isTarget(row.symbol) }">
            <th scope="row" class="capital-increases__name">
              <NuxtLink :to="securityPath(row.symbol)" class="seo-table__link">{{ row.companyName ?? row.symbol }}</NuxtLink>
              <span v-if="codeOf(row)" class="capital-increases__code">{{ codeOf(row) }}</span>
            </th>
            <td class="seo-table__num capital-increases__period"><span v-for="part in periodParts(row.subscriptionPaymentStartDate, row.subscriptionPaymentEndDate)" :key="part">{{ part }}</span></td>
            <td class="seo-table__num">{{ ratioText(row) }}</td>
            <td class="seo-table__num">{{ priceText(row.subscriptionPricePerShare) }}</td>
          </tr>
        </tbody>
      </SharedTable>
    </StockQuestionSection>

    <StockQuestionSection id="capital-increases-ipo" question="最近有哪些公司初次上市櫃、公開申購？" :answer="data ? publicSubscriptionAnswer(subscriptions) : null">
      <SharedTable v-if="subscriptions.length" label="初次上市櫃的公開申購" table-class="capital-increases__table">
        <thead>
          <tr>
            <th scope="col">公司</th>
            <th scope="col" class="seo-table__num">公開申購<wbr>期間</th>
            <th scope="col" class="seo-table__num">承銷價<wbr>（元）</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in subscriptions" :key="row.symbol">
            <th scope="row" class="capital-increases__name">
              <span>{{ row.companyName ?? row.symbol }}</span>
              <span class="capital-increases__code">{{ [codeOf(row), MARKET_LABELS[row.market]].filter(Boolean).join('・') }}</span>
            </th>
            <td class="seo-table__num">{{ periodText(row.publicSubscriptionStartDate, row.publicSubscriptionEndDate) }}</td>
            <td class="seo-table__num">
              {{ row.underwritingPrice ? priceText(row.underwritingPrice) : '還沒公告' }}
              <span v-if="row.underwritingPrice && row.underwritingPriceStatus === 'provisional'" class="capital-increases__code">暫定</span>
            </td>
          </tr>
        </tbody>
      </SharedTable>
      <p class="hub-answer">
        抽籤日、中籤率請看<a :href="TWSE_PUBLIC_OFFERINGS" target="_blank" rel="noopener noreferrer" class="hub-inline-link">證交所的公開申購公告</a>（另開新視窗，上市、上櫃都在這一頁）。
      </p>
    </StockQuestionSection>

    <StockMetricGuide id-prefix="capital-increases" topic="現金增資" definition-question="現金增資怎麼看？" :definition="GUIDE" />
    <p class="hub-answer hub-sources">資料來源：公開資訊觀測站（現金增資認股基準日、承銷價格公告）、臺灣證券交易所與證券櫃檯買賣中心的除權除息預告表。</p>
  </div>
</template>

<style scoped>
/* 表頭放不下才折，只在詞與詞之間（「每仟股／認購（股）」），同股東月曆一天的彈窗 */
.capital-increases__table thead th {
  white-space: normal;
  word-break: keep-all;
}

/* 繳款狀態那一列用淡底跟資料列分開 */
.capital-increases__table .capital-increases__group > th {
  background: var(--el-fill-color-lighter);
  font-weight: 600;
}

/* 公司欄吃掉剩下的寬度、可以折行，數字欄照內容寬 */
.capital-increases__table .capital-increases__name {
  width: 100%;
  white-space: normal;
}

/* 繳款期間那張表看自己的寬度：四欄排成一行要 377px（公司四個字 92＋繳款期間 121＋每仟股 88＋認購價 76，2026-11-26 在 375 寬量的），
   卡片窄於 380 時繳款期間只在「～」後面折：兩段各一個 span，這時才變 inline-block，段與段之間可以折、段裡不折（<wbr> 不行：Chromium 在 nowrap
   裡也照樣折，寬螢幕也變兩行）。公司欄這時不吃滿，否則可以折的欄會被壓到最窄 */
.capital-increases__card {
  container-type: inline-size;
}

@container not (min-width: 380px) {
  .capital-increases__table .capital-increases__name {
    width: auto;
  }

  .capital-increases__table .capital-increases__period {
    white-space: normal;
  }

  .capital-increases__period > span {
    display: inline-block;
    white-space: nowrap;
  }
}

.capital-increases__code {
  display: block;
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

/* 個股配息頁連過來的那一列（#ci-代號）：捲動時讓開頂部，淡底標出是哪一家 */
.capital-increases__table tbody tr[id] {
  scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 16px);
}

.capital-increases__table .capital-increases__target > * {
  background: var(--el-color-primary-light-9);
}

.capital-increases__muted {
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
</style>
