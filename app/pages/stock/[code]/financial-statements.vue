<script setup lang="ts">
// 財務報表 — real route 2026-09-17, split out of stock/[code]/index.vue's own 會計模式 per direct
// request ("整頁滑動的概念完全捨棄...股利怎麼來？他URL是像這樣 stock/2330/新頁面，命名交給你，以利
// SEO。只有Header部分會長相一樣") — StockPeriodSelector/StockFinancialStatementsCard are the exact
// same two components 會計模式 used to render; this page reuses them directly.
//
// The latest filing's three statements SPLIT OUT to their own URLs 2026-09-20 per direct request
// ("資產負債表/損益表/現金流量表各自讓他們是 /stock/2330/某某表"; "想看其他季度的報表" and "資料
// 摘要與來源" stay here) — see /stock/:code/{balance-sheet,income-statement,cash-flow-statement}
// and useStockStatements.ts (the shared fetch/formatting those three and this page both use).
// This page is now the browse-ANY-period widget (StockPeriodSelector + StockFinancialStatementsCard,
// interactive/client-rendered) plus the digest, with plain links to the three latest-period pages
// so a visitor landing here still reaches them in one click.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)

// Catalog awaited once before any card mounts (feedback_useasyncdata_shared_key_race memory).
await useFilterSchema()

// `.latest` seeds StockPeriodSelector below; `statementHeadlines` feeds this page's own one-row-
// per-statement summary table (the per-statement question/answer content, and the full statement
// tables themselves, now live on the three split pages — this is a lighter, purely SSR-crawlable
// stand-in so this page keeps at least one real <table> of its own, not just an interactive
// client-rendered widget).
const { latest, statementHeadlines } = await useStockStatements(code, stockShortName)

// Real numbers into the SSR HTML + the meta description (see useStockPageDigest.ts).
const { digest, description } = await useStockPageDigest(code, 'financial-statements', { shortName: stockShortName })

// title/description/og/robots/canonical/BreadcrumbList (2026-09-19) — see useStockPageSeo.ts.
const sectorCode = computed(() => profile.value?.industry ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '財務報表', titleKeywords: '資產負債表、損益表與現金流量表', pathSuffix: '/financial-statements', stock, summary, description, sectorCode })
</script>

<template>
  <div v-loading="stockPending" class="stock-financial-statements-page">
    <!-- Same three-way pending/not-found/found branch as stock/[code]/index.vue's own (see that
         file's own comment for why a bare v-if/v-else pair can't distinguish "still loading" from
         "genuinely doesn't exist"). -->
    <template v-if="stockPending" />
    <el-result
      v-else-if="!stock"
      icon="warning"
      sub-title="請確認股票代號是否正確"
    >
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <!-- Page subject lives in the summary card's single <h1> since 2026-09-19 — see
           StockSummaryCard.vue's own heading comment. -->
      <StockSummaryCard :stock="stock" :is-favorite="isFavorite" :short-name="stockShortName" topic="財務報表" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-statements-latest-links" :question="`${stockShortName}最新一期的三大財務報表在哪裡？`" :answer="latest ? `${latest.year} 年第 ${latest.season} 季申報的資產負債表、損益表與現金流量表，各有自己的頁面，逐行對照去年同期數字。` : null">
        <table class="seo-table" data-ssr-table>
          <caption class="visually-hidden">{{ stockShortName }}{{ code }}最新一期三大財務報表重點數字與連結</caption>
          <thead>
            <tr>
              <th scope="col">報表</th>
              <th scope="col">重點數字</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row"><NuxtLink :to="`/stock/${code}/balance-sheet`" class="seo-table__link">資產負債表</NuxtLink></th>
              <td>{{ statementHeadlines.balanceSheet ?? '－' }}</td>
            </tr>
            <tr>
              <th scope="row"><NuxtLink :to="`/stock/${code}/income-statement`" class="seo-table__link">損益表</NuxtLink></th>
              <td>{{ statementHeadlines.incomeStatement ?? '－' }}</td>
            </tr>
            <tr>
              <th scope="row"><NuxtLink :to="`/stock/${code}/cash-flow-statement`" class="seo-table__link">現金流量表</NuxtLink></th>
              <td>{{ statementHeadlines.cashFlowStatement ?? '－' }}</td>
            </tr>
          </tbody>
        </table>
      </StockQuestionSection>

      <StockQuestionSection id="stock-statements-browse" question="想看其他季度的報表？" answer="用下方的年度與季別選擇器切換，三張報表同時更新；每一期都與其去年同期並列。">
        <StockPeriodSelector :symbol="stock.code" />
        <StockFinancialStatementsCard :symbol="stock.code" />
      </StockQuestionSection>

      <StockQuestionSection id="stock-statements-source" question="這三張報表的資料多久更新一次？" answer="資產負債表、損益表與現金流量表整理自公開資訊觀測站（MOPS）的公司申報資料，公司每季申報後更新，非本站自行編製。">
        <p class="stock-answer">單位為新台幣千元；每股盈餘（EPS）為元。虧損或無申報資料的期別以「－」表示。</p>
      </StockQuestionSection>

      <p class="stock-page-section__link">
        <NuxtLink :to="`/stock/${code}/metrics-history`">看 {{ stockShortName }} {{ code }} 由這些報表算出的指標逐年數據</NuxtLink>
      </p>
      <StockPageDigest :digest="digest" />
    </template>
  </div>
</template>

<style scoped>
.stock-financial-statements-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
