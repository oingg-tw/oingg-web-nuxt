<script setup lang="ts">
// 財務報表 — real route 2026-09-17, split out of stock/[code]/index.vue's own 會計模式 per direct
// request ("整頁滑動的概念完全捨棄...股利怎麼來？他URL是像這樣 stock/2330/新頁面，命名交給你，以利
// SEO。只有Header部分會長相一樣") — StockPeriodSelector/StockFinancialStatementsCard are the exact
// same two components 會計模式 used to render inside stock/[code]/index.vue's own experienceMode
// Transition (see that file's own git history for the "三表的表格" build-out); this page reuses
// them directly rather than re-implementing anything. "只有Header部分會長相一樣" — StockSummaryCard
// is the shared header (via useStockDetailSummary.ts, the same composable
// stock/[code]/index.vue itself now calls), everything below it is this page's own focused
// content, no tabs/other-mode content carried over.
//
// 顯示設定／tabs機制 briefly lived here too (2026-09-17, "請把 顯示設定 以及 tabs機制，移動到財務
// 報表底下"), then moved out again the very next day to their own dedicated route,
// company-health.vue, per direct follow-up ("summary 上面的 卡片 表格 會計 顯示設定 都拔掉...卡片
// 表格 會計 做在sidebar上面。財務報表 (會計) 指標歷史 (表格) 公司健檢 (卡片)") — 財務報表 is
// specifically 會計模式's own new home, not a catch-all; this file is back to exactly what it was
// before that detour.
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
    <!-- Same three-way pending/not-found/found branch as stock/[code]/index.vue's own (see that
         file's own comment for why a bare v-if/v-else pair can't distinguish "still loading" from
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
      <!-- Page subject lives in the summary card's single <h1> since 2026-09-19 — see
           StockSummaryCard.vue's own heading comment. -->
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" topic="財務報表" @toggle-favorite="toggleFavorite" />
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
</style>
