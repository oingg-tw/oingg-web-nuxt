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
      <StockDataUnavailable v-else-if="isVisible('profile')" title="公司詳細資料" />

      <!-- Valuation/financial charts here all still await a real bff-ts per-stock endpoint —
           see useStockDetail.ts's own comment. Was previously rendered with seeded-random mock
           data that looked like a real analysis; per explicit product direction, this now shows
           StockDataUnavailable instead of fabricating numbers to fill the layout. -->
      <div class="stock-detail-page__grid">
        <StockDataUnavailable v-if="isVisible('per-river')" title="本益比河流圖" />
        <StockDataUnavailable v-if="isVisible('pbr-river')" title="本淨比河流圖" />
        <StockDataUnavailable v-if="isVisible('eps')" title="四季 EPS" />
        <StockDataUnavailable v-if="isVisible('revenue')" title="月營收年增率" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.stock-detail-page {
  max-width: 980px;
  margin: 0 auto;
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
