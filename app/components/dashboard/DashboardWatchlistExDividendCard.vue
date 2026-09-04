<script setup lang="ts">
import { Calendar } from '@element-plus/icons-vue'

// GET /stocks/ex-dividend-notices, wired to real data 2026-09-04 (see useExDividendNotices.ts).
// Per explicit user direction, scoped to the signed-in user's own watchlist only — not a
// cross-market ranking of every upcoming ex-dividend event, which would belong on a screener/
// browse page instead, not this "things relevant to stocks I already track" card.
const { watchlist } = useStocks()
const { data: notices } = useExDividendNotices(computed(() => watchlist.value.map(stock => stock.code)))

interface UpcomingRow {
  code: string
  name: string
  exDate: string
  exType: string
}

// Only watchlist stocks that actually HAVE something scheduled — a full list padded with "—"
// for the (usually most) stocks with nothing upcoming would bury the handful that matter.
// Sorted soonest-first, since that's the one thing worth scanning this card for.
const upcoming = computed<UpcomingRow[]>(() => {
  if (!notices.value) return []
  return watchlist.value
    .flatMap(stock => {
      const entries = notices.value![stock.code]
      if (!entries?.length) return []
      const next = [...entries].sort((a, b) => a.exDate.localeCompare(b.exDate))[0]!
      return [{ code: stock.code, name: stock.name, exDate: next.exDate, exType: next.exType }]
    })
    .sort((a, b) => a.exDate.localeCompare(b.exDate))
})
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
    <el-empty v-else-if="!notices" description="資料尚未提供" :image-size="64" />
    <el-empty v-else-if="!upcoming.length" description="觀察清單目前沒有股票排定除權息" :image-size="64" />
    <div v-else class="watchlist-ex-dividend-card__list">
      <div v-for="row in upcoming" :key="row.code" class="watchlist-ex-dividend-card__row">
        <div class="watchlist-ex-dividend-card__stock">
          <span class="watchlist-ex-dividend-card__code">{{ row.code }}</span>
          <span class="watchlist-ex-dividend-card__name">{{ row.name }}</span>
        </div>
        <div class="watchlist-ex-dividend-card__meta">
          <span class="watchlist-ex-dividend-card__date">{{ row.exDate }}</span>
          <el-tag size="small" type="warning">{{ row.exType }}</el-tag>
        </div>
      </div>
    </div>
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

.watchlist-ex-dividend-card__meta {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.watchlist-ex-dividend-card__date {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}
</style>
