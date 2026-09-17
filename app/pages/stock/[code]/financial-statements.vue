<script setup lang="ts">
// 財務報表 — real route 2026-09-17, split out of stock/[code].vue's own 會計模式 per direct
// request ("整頁滑動的概念完全捨棄...股利怎麼來？他URL是像這樣 stock/2330/新頁面，命名交給你，以利
// SEO。只有Header部分會長相一樣") — StockPeriodSelector/StockFinancialStatementsCard are the exact
// same two components 會計模式 used to render inside stock/[code].vue's own experienceMode
// Transition (see that file's own git history for the "三表的表格" build-out); this page reuses
// them directly rather than re-implementing anything. "只有Header部分會長相一樣" — StockSummaryCard
// is the shared header (via useStockDetailSummary.ts, the same composable stock/[code].vue itself
// now calls), everything below it is this page's own focused content, no tabs/other-mode content
// carried over.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)

const requestUrl = useRequestURL()
useHead({
  title: () => `${stockShortName.value} 財務報表`,
  link: [{ rel: 'canonical', href: computed(() => `${requestUrl.origin}/stock/${code.value}/financial-statements`) }]
})
</script>

<template>
  <StockDetailSidebarNav :code="code" />

  <div v-loading="stockPending" class="stock-financial-statements-page">
    <!-- Same three-way pending/not-found/found branch as stock/[code].vue's own (see that file's
         own comment for why a bare v-if/v-else pair can't distinguish "still loading" from
         "genuinely doesn't exist"). -->
    <template v-if="stockPending" />
    <el-result
      v-else-if="!stock"
      icon="warning"
      title="找不到這檔股票"
      sub-title="請確認股票代號是否正確"
    >
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" @toggle-favorite="toggleFavorite" />
      <h1 class="stock-financial-statements-page__title">財務報表</h1>
      <StockPeriodSelector :symbol="stock.code" />
      <StockFinancialStatementsCard :symbol="stock.code" />
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

/* 16px per docs/ui-ux/accessibility-guidelines.md §1.1 — site-wide floor, no exceptions. */
.stock-financial-statements-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}
</style>
