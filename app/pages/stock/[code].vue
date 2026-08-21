<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const code = computed(() => String(route.params.code))
const stock = computed(() => getStockByCode(code.value))
const detail = computed(() => (stock.value ? generateStockDetail(stock.value) : null))

const { cardDefs, categories, visibleCardIds, isVisible } = useStockCards()
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
      <div class="stock-detail-page__toolbar">
        <el-popover placement="bottom-end" width="240" trigger="click">
          <template #reference>
            <el-button :icon="Setting" circle />
          </template>
          <div class="card-picker">
            <p class="card-picker__title">顯示卡片</p>
            <el-checkbox-group v-model="visibleCardIds">
              <div v-for="category in categories" :key="category" class="card-picker__group">
                <p class="card-picker__group-title">{{ category }}</p>
                <el-checkbox
                  v-for="card in cardDefs.filter(c => c.category === category)"
                  :key="card.id"
                  :value="card.id"
                  :label="card.label"
                />
              </div>
            </el-checkbox-group>
          </div>
        </el-popover>
      </div>

      <StockSummaryCard v-if="isVisible('summary')" :stock="stock" />

      <ClientOnly v-if="isVisible('per-river')">
        <StockRiverChart
          title="本益比河流圖"
          subtitle="股價 vs. 近四季 EPS x 本益比區間"
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
          subtitle="股價 vs. 每股淨值 x 股價淨值比區間"
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
    </template>

    <StockSearchBar />
  </div>
</template>

<style scoped>
.stock-detail-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px 16px calc(88px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-detail-page__toolbar {
  display: flex;
  justify-content: flex-end;
}

.stock-detail-page__chart-skeleton {
  padding: 20px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

.card-picker__title {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.card-picker__group + .card-picker__group {
  margin-top: 12px;
}

.card-picker__group-title {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.card-picker :deep(.el-checkbox-group) {
  display: flex;
  flex-direction: column;
}

.card-picker :deep(.el-checkbox) {
  height: 26px;
}
</style>
