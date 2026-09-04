<script setup lang="ts">
import { Calendar } from '@element-plus/icons-vue'

// Structural-only placeholder — twse-ts's export.ex_dividend_notice is real (109 rows in prod,
// confirmed by analysis-ts 2026-09-04) but has no public API yet, same situation 股本變化 was in
// before its own endpoint existed (see useCapitalStockHistory.ts's own history). Per explicit
// user direction, this card is scoped to the signed-in user's own watchlist only — not a
// cross-market ranking of every upcoming ex-dividend event, which would belong on a screener/
// browse page instead, not this "things relevant to stocks I already track" card.
//
// The watchlist itself IS real (useStocks.ts), so that part renders for real here — only the
// per-stock ex-dividend fields are skeleton blocks, per the same "只做版面結構，不放任何數字"
// direction as every other unbacked card on this page.
const { watchlist } = useStocks()
</script>

<template>
  <el-card class="watchlist-ex-dividend-card" shadow="never">
    <template #header>
      <div class="watchlist-ex-dividend-card__title">
        <el-icon><Calendar /></el-icon>
        <span>觀察清單近期除權息</span>
      </div>
    </template>

    <el-empty v-if="!watchlist.length" description="尚未加入觀察清單" :image-size="64" />
    <div v-else class="watchlist-ex-dividend-card__list">
      <div v-for="stock in watchlist" :key="stock.code" class="watchlist-ex-dividend-card__row">
        <div class="watchlist-ex-dividend-card__stock">
          <span class="watchlist-ex-dividend-card__code">{{ stock.code }}</span>
          <span class="watchlist-ex-dividend-card__name">{{ stock.name }}</span>
        </div>
        <span class="watchlist-ex-dividend-card__value" />
      </div>
    </div>

    <p class="watchlist-ex-dividend-card__note">資料尚未提供</p>
  </el-card>
</template>

<style scoped>
.watchlist-ex-dividend-card__title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.watchlist-ex-dividend-card__title .el-icon {
  color: var(--el-color-primary);
}

.watchlist-ex-dividend-card__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.watchlist-ex-dividend-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.watchlist-ex-dividend-card__row:last-child {
  border-bottom: none;
}

.watchlist-ex-dividend-card__stock {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.watchlist-ex-dividend-card__code {
  font-weight: 600;
}

.watchlist-ex-dividend-card__name {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.watchlist-ex-dividend-card__value {
  flex-shrink: 0;
  height: 14px;
  width: 100px;
  border-radius: 4px;
  background: var(--el-fill-color);
}

.watchlist-ex-dividend-card__note {
  margin: 16px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
