<script setup lang="ts">
// Personal/settings page (2026-09-19): nothing here is content for a crawler — keep it out of the
// index, and out of the sitemap via nuxt.config's own sitemap.exclude.
useSeoMeta({ robots: 'noindex, nofollow' })

// Real bug fixed 2026-09-14 (mock-data survey) — `watchlist` from useStocks() used to be a
// ready-made Stock[] straight from MOCK_STOCK_UNIVERSE; now useStocks() only tracks which CODES
// are on the list, and useWatchlistStocks resolves the real per-symbol quote for each one (see
// that composable's own comment for why N parallel single-symbol requests, not a batch endpoint
// that doesn't exist yet).
const { watchlistCodes, columns, visibleColumnKeys, visibleColumns, addStock, removeStock } = useStocks()
const { data: watchlist, pending, droppedCount } = useWatchlistStocks(watchlistCodes)

// 這一頁自己要能加股票（2026-09-28）。原本的空狀態是一條死路——「尚未加入任何股票」，然後整頁沒有任何
// 地方可以加，使用者得自己知道要去個股頁點☆。加在頁首而不是只放進空狀態，是因為連續加好幾檔是這一頁
// 最常見的動作，塞進空狀態的話第一檔加完它就消失了。
//
// 搜尋沿用 useStockSearch()（站上的搜尋列與導覽列都用它），不另外寫一套比對邏輯。
const { keyword, fetchSuggestions } = useStockSearch()

// 只收普通股：清單的報價是打 GET /stocks/{symbol} 解析出來的，那支端點只認普通股。特別股與 ETF 各有
// 自己的端點與頁面（useStockSearch 的 routeFor 就是照 kind 分三條路），硬加進來的結果是 useWatchlistStocks
// 靜默把它丟掉、只在上面多一句「N 檔暫時無法載入」——那會讓使用者以為是暫時性的載入問題，而不是這一頁
// 本來就不支援。所以在入口就說清楚，不要讓它掉進 droppedCount。
function handleSelect(item: Record<string, unknown>) {
  const code = String(item.code ?? '')
  if (!code || code === '__no_match__') return
  if (item.kind === 'preferred' || item.kind === 'etf') {
    ElMessage.warning(item.kind === 'etf' ? 'ETF 請到 ETF 專區查看，觀察清單目前只收普通股' : '特別股有自己的頁面，觀察清單目前只收普通股')
    keyword.value = ''
    return
  }
  addStock(code)
  keyword.value = ''
}
</script>

<template>
  <div class="stock-page">
    <div class="stock-page__header">
      <h1 class="stock-page__title">
        觀察清單
        <!-- 檔數跟在標題後面：這一頁沒有其他地方說得出「我追蹤了幾檔」，而那是使用者回到這一頁時
             第一個想知道的事。沒有任何一檔時不顯示，免得空狀態旁邊掛一個「共 0 檔」。 -->
        <span v-if="watchlistCodes.length" class="stock-page__count">共 {{ watchlistCodes.length }} 檔</span>
      </h1>
      <StockListActions v-model:visible-column-keys="visibleColumnKeys" :columns="columns" />
    </div>

    <el-autocomplete
      v-model="keyword"
      :fetch-suggestions="fetchSuggestions"
      class="stock-page__add"
      placeholder="加入股票：輸入代號或名稱，例如 2330 或 台積電"
      aria-label="加入股票到觀察清單"
      clearable
      @select="handleSelect"
    >
      <template #default="{ item }">
        <span>{{ item.code }}</span>
        <span class="stock-page__add-name">{{ item.name }}</span>
      </template>
    </el-autocomplete>

    <p v-if="droppedCount > 0" class="stock-page__note">
      {{ droppedCount }} 檔股票目前沒有可用的報價資料，暫未顯示
    </p>

    <div v-loading="pending" class="stock-page__content">
      <el-empty v-if="!pending && !watchlistCodes.length" description="還沒有追蹤任何股票，用上面的搜尋框加入第一檔" :image-size="64" />
      <template v-else>
        <StockTable class="view-table" :stocks="watchlist" :columns="visibleColumns" @remove="removeStock" />
        <StockCard class="view-card" :stocks="watchlist" :columns="visibleColumns" @remove="removeStock" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.stock-page {
  width: 100%;
}

.stock-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 16px;
}

.stock-page__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.stock-page__count {
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.stock-page__add {
  width: 100%;
  max-width: 480px;
  margin: 0 0 16px;
}

.stock-page__add-name {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}

.stock-page__note {
  margin: 0 0 16px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.view-card {
  display: none;
}

@media (max-width: 767px) {
  .view-table {
    display: none;
  }

  .view-card {
    display: flex;
  }
}
</style>
