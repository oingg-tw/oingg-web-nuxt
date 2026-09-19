<script setup lang="ts">
// 配股配息 — real route 2026-09-17, promoted from a hash-anchor NuxtLink into stock/[code]/index.vue's
// own 股東回饋 tab category (see StockDetailSidebarNav.vue's git history) to its own URL per direct
// request ("配股配息url改名 stock/2330/dividend"). Per a direct follow-up clarifying scope ("留在
// tabs機制裡，配股配息頁面內容另外設計") — 股東回饋's own dividend-coverage/dividend-growth-rate/
// chowder-number cards STAY inside the tabs system (now living on financial-statements.vue), not
// duplicated here; this page's own content is StockDividendStabilityCard (配息穩定度) and
// StockExDividendCard (下次除權息) instead — both were already-built, dividend-specific persistent
// cards that had been sitting behind a disabled DIVIDEND_CARDS_ENABLED flag on stock/[code]/index.vue
// (see that file's own git history for the on/off/on saga), never actually visible; this page is
// where they finally belong. "只有Header部分會長相一樣" — StockSummaryCard is the shared header (via
// useStockDetailSummary.ts, the same composable every one of these stock detail pages calls).
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)

// Own fetch, not shared with stock/[code]/index.vue — that page's own copy of this same call was
// removed the same day this page was built (its only consumer, this content, moved here).
const { data: exDividendNotices } = useExDividendNotices(computed(() => (stock.value ? [stock.value.code] : [])))

// Catalog awaited once before any card mounts (feedback_useasyncdata_shared_key_race memory).
await useFilterSchema()

// Real numbers into the SSR HTML + the meta description (2026-09-19; see useStockPageDigest.ts).
// The ex-dividend notices above are passed in so the lead sentence can quote the next ex-date.
// The 'dividend' plan also fetches StockDividendCashChainCard's exact metric group, so that card
// (below) renders its equations in the server HTML too.
const { digest, description } = await useStockPageDigest(code, 'dividend', { shortName: stockShortName, exDividendNotices })

// title/description/og/robots/canonical/BreadcrumbList (2026-09-19) — see useStockPageSeo.ts.
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '配股配息', pathSuffix: '/dividend', stock, summary, description })
</script>

<template>
  <div v-loading="stockPending" class="stock-dividend-page">
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
      <!-- The page subject is rendered INTO the summary card's single <h1> (「台積電 2330 配股配息」)
           since 2026-09-19 — no separate page-level <h1> anymore; see StockSummaryCard.vue's own
           heading comment. -->
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" topic="配股配息" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />
      <section class="stock-page-section" aria-labelledby="stock-dividend-heading">
        <h2 id="stock-dividend-heading" class="stock-page-section__title">配股配息</h2>
        <!-- 現金殖利率的市場排名量尺 — added 2026-09-18 per direct request ("配股配息 加上一張 量表
             看出 個股的 現金殖利率，在全部市場PR多少"). Placed first, ahead of 配息穩定度 (which
             already shows the same raw 殖利率 number as one of its own 4 tiles) — this card answers
             a different question about that same number (where it ranks market-wide), so it leads
             the page rather than duplicating that tile. -->
        <StockDividendYieldPercentileCard :symbol="stock.code" />
        <StockDividendStabilityCard :symbol="stock.code" />
        <StockExDividendCard v-if="exDividendNotices" :notices="exDividendNotices[code] ?? []" />
        <StockExDividendCardShell v-else />
        <!-- 股息哪裡來 — the cash-chain equations (每股股利＋留存現金＝每股自由現金流 → …＝每股營業
             現金流 → EPS＋非現金調整＝每股營業現金流, plus the 法定盈餘公積 rule), merged INTO this
             page 2026-09-19 per direct decision after the A/B comparison on the former
             /stock/{code}/dividend-source route: the equation cards won (their numbers are real DOM
             text, already in the SSR HTML via the digest's cache pre-warm; the competing waterfall
             chart was an SVG a crawler couldn't read), and「股利從哪裡來」has little search volume as
             its own URL while it makes THIS page — the one people actually search for（「台積電 股利」）
             — substantially thicker. That route, its nav link and the waterfall component are gone. -->
        <StockDividendCashChainCard :symbol="stock.code" />
      </section>
      <StockPageDigest :digest="digest" />
    </template>
  </div>
</template>

<style scoped>
.stock-dividend-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
