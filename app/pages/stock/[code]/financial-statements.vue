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
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)

// Catalog awaited once before any card mounts (feedback_useasyncdata_shared_key_race memory).
await useFilterSchema()

// `.latest` seeds StockPeriodSelector below and the first answer's default period.
const { latest } = await useStockStatements(code, stockShortName)
const browseAnswer = computed(() => `${latest.value ? `預設是 ${latest.value.year} 年第 ${latest.value.season} 季；` : ''}用年度與季別選擇器切換，資產負債表、損益表與現金流量表同時更新，每一期都與去年同期並列，方便逐行核對。`)
// 頁尾（2026-10-14）：最新一期三張報表各自的頁原本是第一段的小表，現在放這裡
const footerLinks = computed(() => [
  { to: `/stock/${code.value}/balance-sheet`, label: `${stockShortName.value} ${code.value} 最新一期的資產負債表` },
  { to: `/stock/${code.value}/income-statement`, label: `${stockShortName.value} ${code.value} 最新一期的損益表` },
  { to: `/stock/${code.value}/cash-flow-statement`, label: `${stockShortName.value} ${code.value} 最新一期的現金流量表` }
])

// Real numbers into the SSR HTML + the meta description (see useStockPageDigest.ts).
const { digest, description } = await useStockPageDigest(code, 'financial-statements', { shortName: stockShortName })

// title/description/og/robots/canonical/BreadcrumbList (2026-09-19) — see useStockPageSeo.ts.
const sectorCode = computed(() => profile.value?.sectorCode ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '三大財務報表', titleKeywords: '資產負債表、損益表與現金流量表', pathSuffix: '/financial-statements', stock, summary, description, sectorCode })
</script>

<template>
  <StockPageShell
    class="app-page stock-financial-statements-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :is-emerging="profile?.isEmerging ?? null"
    :is-favorite="isFavorite"
    :short-name="stockShortName"
    topic="三大財務報表"
    :breadcrumbs="breadcrumbs"
    :footer="{ sources: digest?.sources ?? [], freshness: digest && buildDigestFreshnessText(digest), links: footerLinks }"
    @toggle-favorite="toggleFavorite"
  >
    <!-- 主角是三大財務報表本身（2026-10-14，使用者：「最新一期的三大財務報表在哪裡？裡面的連結應該放在頁尾。這一頁的主題就讓它是
         給用戶稽核用。主角是 "三大財務報表"」）：原本第一段是連到三張最新一期報表頁的小表，現在那三個連結在頁尾，第一段直接是可以切換
         年度與季別的三張表。 -->
    <StockQuestionSection id="stock-statements-browse" :question="`${stockShortName}（${code}）的三大財務報表，每一期是多少？`" :answer="browseAnswer">
      <StockPeriodSelector :symbol="code" />
      <StockFinancialStatementsCard :symbol="code" />
    </StockQuestionSection>

    <StockQuestionSection id="stock-statements-source" question="這三張報表的資料多久更新一次？" answer="資產負債表、損益表與現金流量表整理自公開資訊觀測站（MOPS）的公司申報資料，公司每季申報後更新，非本站自行編製。">
      <p class="stock-answer">單位為新台幣千元；每股盈餘（EPS）為元。虧損或無申報資料的期別以「－」表示。</p>
    </StockQuestionSection>
  </StockPageShell>
</template>

<style scoped>

</style>
