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
    <StockSearchBar>
      <template #actions>
        <StockDetailActions
          v-if="stock"
          v-model:visible-card-ids="visibleCardIds"
          :card-defs="cardDefs"
          :categories="categories"
          :is-favorite="isFavorite"
          @toggle-favorite="toggleFavorite"
        />
        <UserMenuButton />
      </template>
    </StockSearchBar>

    <AppMenuBar>
      <StockDetailActions
        v-if="stock"
        v-model:visible-card-ids="visibleCardIds"
        :card-defs="cardDefs"
        :categories="categories"
        :is-favorite="isFavorite"
        @toggle-favorite="toggleFavorite"
      />
      <UserMenuButton />
    </AppMenuBar>

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
      <StockSummaryCard :stock="stock" />

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
  padding: calc(76px + env(safe-area-inset-top)) 16px calc(88px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (min-width: 768px) {
  .stock-detail-page {
    padding-bottom: 20px;
  }
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
