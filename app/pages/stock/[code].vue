<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const code = computed(() => String(route.params.code))
const { data: universe } = useStockUniverse()
const stock = computed(() => getStockByCode(universe.value, code.value))
const detail = computed(() => (stock.value ? generateStockDetail(stock.value) : null))

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

      <div class="stock-detail-page__grid">
        <ClientOnly v-if="isVisible('per-river')">
          <StockRiverChart
            title="本益比河流圖"
            :quarters="detail!.quarters"
            :price="detail!.price"
            :bands="detail!.perBands"
          />
          <template #fallback>
            <el-skeleton class="stock-detail-page__chart-skeleton" :rows="4" animated />
          </template>
        </ClientOnly>

        <ClientOnly v-if="isVisible('pbr-river')">
          <StockRiverChart
            title="本淨比河流圖"
            :quarters="detail!.quarters"
            :price="detail!.price"
            :bands="detail!.pbrBands"
          />
          <template #fallback>
            <el-skeleton class="stock-detail-page__chart-skeleton" :rows="4" animated />
          </template>
        </ClientOnly>

        <ClientOnly v-if="isVisible('eps')">
          <StockEpsChart :quarters="detail!.quarterlyEps" />
          <template #fallback>
            <el-skeleton class="stock-detail-page__chart-skeleton" :rows="3" animated />
          </template>
        </ClientOnly>

        <ClientOnly v-if="isVisible('revenue')">
          <StockRevenueChart :months="detail!.monthlyRevenue" />
          <template #fallback>
            <el-skeleton class="stock-detail-page__chart-skeleton" :rows="3" animated />
          </template>
        </ClientOnly>
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

.stock-detail-page__chart-skeleton {
  padding: 20px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}
</style>
