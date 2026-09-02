<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const code = computed(() => String(route.params.code))
const { data: universe } = useStockUniverse()
const stock = computed(() => getStockByCode(universe.value, code.value))

const { cardDefs, categories, visibleCardIds, isVisible } = useStockCards()
const { data: profile } = useCompanyProfile(stock)

const { watchlist, addStock, removeStock } = useStocks()
const isFavorite = computed(() => watchlist.value.some(item => item.code === stock.value?.code))

function toggleFavorite() {
  if (!stock.value) return
  if (isFavorite.value) {
    removeStock(stock.value.code)
  } else {
    addStock(stock.value.code)
  }
}
</script>

<template>
  <div class="stock-detail-page">
    <el-result
      v-if="!stock"
      icon="warning"
      title="找不到這檔股票"
      sub-title="請確認股票代號是否正確"
    >
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <StockSummaryCard :stock="stock" :is-favorite="isFavorite" @toggle-favorite="toggleFavorite">
        <template #actions>
          <StockDetailActions
            v-model:visible-card-ids="visibleCardIds"
            :card-defs="cardDefs"
            :categories="categories"
          />
        </template>
      </StockSummaryCard>

      <StockProfileCard v-if="isVisible('profile') && profile" :profile="profile" />
      <StockProfileCardShell v-else-if="isVisible('profile')" />

      <!-- Valuation/financial charts here all still await a real bff-ts per-stock endpoint —
           see useStockDetail.ts's own comment. Was previously rendered with seeded-random mock
           data that looked like a real analysis; per explicit product direction, this now shows
           a structure-only shell (StockChartShell) instead of fabricating numbers to fill the
           layout — card header, tab row, and an axis/legend-shaped skeleton, but no value that
           could be mistaken for a real number. -->
      <div class="stock-detail-page__grid">
        <StockChartShell v-if="isVisible('per-river')" title="本益比河流圖" variant="river" />
        <StockChartShell v-if="isVisible('pbr-river')" title="本淨比河流圖" variant="river" />
        <StockChartShell v-if="isVisible('eps')" title="四季 EPS" variant="bars" :tabs="['單季', '近四季']" />
        <StockChartShell v-if="isVisible('revenue')" title="月營收年增率" variant="bars-line" />
      </div>
    </template>
  </div>
</template>

<style scoped>
/* No max-width/margin here on purpose (was a hardcoded 980px, ignoring the toggle entirely)
   — every other page gets its width from desktop.vue/mobile.vue's own .app-shell__inner /
   .app-shell__inner--centered wrapper (the 置中/滿版 switch), so this page should too rather
   than fighting it with a second, independent cap. Reported live ("版面寬度也要幫我調整"). */
.stock-detail-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-detail-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 16px;
}
</style>
