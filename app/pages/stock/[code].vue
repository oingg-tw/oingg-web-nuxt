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

      <!-- Section order (估值河流圖 -> 財務數據 -> 公司資訊) matches
           STOCK_CARD_CATEGORIES in useStockCards.ts and encodes actual decision priority for a
           retirement/存股 investor per docs/Retiree Securities Investment Guide.md: valuation
           and financial-trend history is what you check first ("確認體質安全"), company
           background is contextual and comes last — the same "financial decision-support, not
           a corporate directory" reasoning StockProfileCard.vue already applies to its own
           field list. Previously this page put the profile card first and dumped all 4 charts
           into one flat grid; regrouped 2026-09-02 into labeled sections per
           docs/ui-ux/網格排版美學與實踐.md's zone/flowline guidance, reusing the same <section> +
           __section-title convention and 8pt spacing tokens already established in
           dashboard.vue and ky-stocks.vue (not reinvented here).

           Charts here all still await a real bff-ts per-stock endpoint — see useStockDetail.ts's
           own comment. Was previously rendered with seeded-random mock data that looked like a
           real analysis; per explicit product direction, this now shows a structure-only shell
           (StockChartShell) instead of fabricating numbers to fill the layout — card header, tab
           row, and an axis/legend-shaped skeleton, but no value that could be mistaken for a
           real number. The two river-chart shells' "近5年/近10年" tabs reflect
           docs/investment-knowledge/基本面財報觀察年限分析.md's argument for a multi-year valuation-multiple window
           (the CAPE/Shiller logic) — labels only, StockChartShell's tabs are decorative and
           carry no data either way.

           特別股評價 (docs/investment-knowledge/特別股評價注意事項.md) is out of scope here: this page only covers
           the common-stock universe (useStockUniverse) — preferred stocks are
           preferred-stocks.vue's own concern. -->
      <section v-if="isVisible('per-river') || isVisible('pbr-river')" class="stock-detail-page__section">
        <h2 class="stock-detail-page__section-title">估值河流圖</h2>
        <div class="stock-detail-page__grid">
          <StockChartShell v-if="isVisible('per-river')" title="本益比河流圖" variant="river" :tabs="['近5年', '近10年']" />
          <StockChartShell v-if="isVisible('pbr-river')" title="本淨比河流圖" variant="river" :tabs="['近5年', '近10年']" />
        </div>
      </section>

      <section v-if="isVisible('eps') || isVisible('revenue')" class="stock-detail-page__section">
        <h2 class="stock-detail-page__section-title">財務數據</h2>
        <div class="stock-detail-page__grid">
          <StockChartShell v-if="isVisible('eps')" title="四季 EPS" variant="bars" :tabs="['單季', '近四季']" />
          <StockChartShell v-if="isVisible('revenue')" title="月營收年增率" variant="bars-line" />
        </div>
      </section>

      <section v-if="isVisible('profile')" class="stock-detail-page__section">
        <h2 class="stock-detail-page__section-title">公司資訊</h2>
        <StockProfileCard v-if="profile" :profile="profile" />
        <StockProfileCardShell v-else />
      </section>
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
  gap: 24px;
}

.stock-detail-page__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-detail-page__section-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.stock-detail-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 16px;
}
</style>
