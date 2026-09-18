<script setup lang="ts">
// 股息哪裡來 — real route 2026-09-17, per direct request ("配股配息 與 財務報表 中間 放上一功能
// 股息哪裡來" → then "整頁滑動的概念完全捨棄...股利怎麼來？他URL是像這樣 stock/2330/新頁面，命名
// 交給你，以利SEO"). StockRevenueToDividendBridge (label "股利怎麼來？") used to be a persistent
// card on stock/[code].vue itself, toggled on/off/on repeatedly during "the interface overhaul"
// (see that component's own comment for the full history) — this page IS that overhaul's answer:
// its own dedicated route instead of a slot inside the old mega-page. "只有Header部分會長相一樣"
// — StockSummaryCard is the shared header (via useStockDetailSummary.ts, the same composable
// stock/[code]/index.vue itself now calls), everything below it is this page's own focused
// content.
//
// Real bug found + fixed 2026-09-17: this page (and financial-statements.vue) originally lived
// as SIBLINGS of a separate top-level stock/[code].vue file (`pages/stock/[code].vue` next to
// `pages/stock/[code]/dividend-source.vue`) — Nuxt's file-based router registered the routes
// correctly (confirmed via router.getRoutes()) but resolved the WRONG page component for a soft
// navigation to this path (rendered stock/[code].vue's own content instead of this file's), and a
// cold page load crashed entirely client-side with a Nuxt-internal, untraceable
// "Cannot read properties of null (reading 'toString')" error (no stack in server logs, console,
// pageerror, or even CDP's Runtime.exceptionThrown — confirmed via extensive live bisection,
// eventually narrowed down to reproducing on a maximally-stripped version of THIS file with zero
// content of its own, ruling out every composable/component this page actually uses). Moving the
// parent page to the conventional `pages/stock/[code]/index.vue` location — a sibling of this file
// inside the SAME directory, not a same-named file next to the directory — fixed it outright.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)

const requestUrl = useRequestURL()
useHead({
  title: () => `${stockShortName.value} 股息哪裡來`,
  link: [{ rel: 'canonical', href: computed(() => `${requestUrl.origin}/stock/${code.value}/dividend-source`) }]
})
</script>

<template>
  <StockDetailSidebarNav :code="code" />

  <div v-loading="stockPending" class="stock-dividend-source-page">
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
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" @toggle-favorite="toggleFavorite" />
      <h1 class="stock-dividend-source-page__title">股息哪裡來</h1>
      <!-- 兩張卡片並列比較 2026-09-18 per直接要求（"股息哪裡來幫我加上一張卡片與現在的股利怎麼來
           類似，我要比較效果"）— StockDividendCashChainCard（倒推、縱向文字列、終點FCF）放在
           StockRevenueToDividendBridge（正推、瀑布圖、終點營收）前面，方便直接對照兩種設計
           方向；兩者都用同一個 dividendPerShare/eps/ocfPerShare/fcfPerShare 資料來源，只是敘事
           方向與呈現形式不同，見前者自己的完整設計理由說明。 -->
      <StockDividendCashChainCard :symbol="stock.code" />
      <StockRevenueToDividendBridge :symbol="stock.code" />
    </template>
  </div>
</template>

<style scoped>
.stock-dividend-source-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 16px per docs/ui-ux/accessibility-guidelines.md §1.1 — site-wide floor, no exceptions. */
.stock-dividend-source-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}
</style>
