<script setup lang="ts">
// 指標歷史 — real route 2026-09-18, split out of stock/[code]/index.vue's own 表格模式 per direct
// request ("summary 上面的 卡片 表格 會計 顯示設定 都拔掉...卡片 表格 會計 做在sidebar上面。財務報表
// (會計) 指標歷史 (表格) 公司健檢 (卡片)") — StockHistoricalStatisticsTable is the exact same
// component 表格模式 used to render inside stock/[code]/index.vue's own experienceMode Transition
// (見那個檔案自己的 git history，"表格模式 (2026-09-13, ...) 稽核鏈" 的完整說明); this page reuses
// it directly. "所有卡片一律呈現" — 公司基本資訊 no longer gated behind isVisible('profile') (that
// gating existed only to serve the now-removed 顯示設定 picker); always renders here.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)

// Catalog awaited once before any card mounts (feedback_useasyncdata_shared_key_race memory) —
// StockHistoricalStatisticsTable awaits it internally too, but this page-level await resolves the
// shared key first.
await useFilterSchema()

// Real numbers into the SSR HTML + the meta description (2026-09-19; see useStockPageDigest.ts).
const { digest, description } = await useStockPageDigest(code, 'metrics-history', { shortName: stockShortName })

// title/description/og/robots/canonical/BreadcrumbList (2026-09-19) — see useStockPageSeo.ts.
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: '指標歷史', pathSuffix: '/metrics-history', stock, summary, description })
</script>

<template>
  <div v-loading="stockPending" class="stock-metrics-history-page">
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
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" topic="指標歷史" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />
      <section class="stock-page-section" aria-labelledby="stock-metrics-history-heading">
        <h2 id="stock-metrics-history-heading" class="stock-page-section__title">指標歷史</h2>
        <!-- StockIndicatorTrendChart.vue (指標走勢比較圖) and the table's own 圖表 checkbox column
             REMOVED 2026-09-14 per direct request ("我放棄 我有點 複雜化了，把 指標走勢比較圖 拿掉。
             勾選的機制也自然拿掉") — this table is back to just plain numbers, no charting
             affordance ("就讓它是純數字"). -->
        <StockHistoricalStatisticsTable :symbol="stock.code" />
      </section>
      <!-- 公司基本資訊 is its own top-level section (StockProfileCard renders an <h2>), a sibling
           of the 指標歷史 section, not part of it. -->
      <StockProfileCard v-if="profile" :profile="profile" class="stock-metrics-history-page__profile" />
      <StockProfileCardShell v-else class="stock-metrics-history-page__profile" />
      <StockPageDigest :digest="digest" />
    </template>
  </div>
</template>

<style scoped>
.stock-metrics-history-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
