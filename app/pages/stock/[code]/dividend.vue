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

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite } = useStockDetailSummary(code)

// Own fetch, not shared with stock/[code]/index.vue — that page's own copy of this same call was
// removed the same day this page was built (its only consumer, this content, moved here).
const { data: exDividendNotices } = useExDividendNotices(computed(() => (stock.value ? [stock.value.code] : [])))

const requestUrl = useRequestURL()
useHead({
  title: () => `${stockShortName.value} 配股配息`,
  link: [{ rel: 'canonical', href: computed(() => `${requestUrl.origin}/stock/${code.value}/dividend`) }]
})
</script>

<template>
  <StockDetailSidebarNav :code="code" />

  <div v-loading="stockPending" class="stock-dividend-page">
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
      <h1 class="stock-dividend-page__title">配股配息</h1>
      <!-- 現金殖利率的市場排名量尺 — added 2026-09-18 per direct request ("配股配息 加上一張 量表
           看出 個股的 現金殖利率，在全部市場PR多少"). Placed first, ahead of 配息穩定度 (which
           already shows the same raw 殖利率 number as one of its own 4 tiles) — this card answers
           a different question about that same number (where it ranks market-wide), so it leads
           the page rather than duplicating that tile. -->
      <StockDividendYieldPercentileCard :symbol="stock.code" />
      <StockDividendStabilityCard :symbol="stock.code" />
      <StockExDividendCard v-if="exDividendNotices" :notices="exDividendNotices[code] ?? []" />
      <StockExDividendCardShell v-else />
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

/* 16px per docs/ui-ux/accessibility-guidelines.md §1.1 — site-wide floor, no exceptions. */
.stock-dividend-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}
</style>
