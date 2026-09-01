<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'

// Was fixture-only — now wired to bff-ts's real attention-stocks endpoint (confirmed live
// 2026-09-01). No nullable TPEx-only fields here (unlike disposed-stocks/volume-top20/
// revenue-ranking's market-specific gaps) — every field is populated regardless of market.
const { data } = useAttentionStocks(20)
</script>

<template>
  <el-card class="attention-stock-card" shadow="never">
    <template #header>
      <span>今日注意股票</span>
    </template>

    <el-empty v-if="data.items.length === 0" description="尚無注意股票資料" :image-size="64" />
    <ul v-else class="attention-stock-card__list">
      <li v-for="(row, index) in data.items" :key="`${row.symbol}-${index}`" class="attention-stock-card__item">
        <el-icon class="attention-stock-card__icon"><WarningFilled /></el-icon>
        <div class="attention-stock-card__body">
          <div class="attention-stock-card__stock">
            <span class="attention-stock-card__code">{{ row.symbol }}</span>
            <span class="attention-stock-card__name">{{ row.name ?? '—' }}</span>
          </div>
          <p class="attention-stock-card__reason">{{ row.criteria }}</p>
          <span class="attention-stock-card__date">{{ row.tradeDate }}</span>
        </div>
      </li>
    </ul>
  </el-card>
</template>

<style scoped>
.attention-stock-card__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 360px;
  overflow-y: auto;
}

.attention-stock-card__item {
  display: flex;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.attention-stock-card__item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.attention-stock-card__icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 18px;
  color: var(--el-color-warning);
}

.attention-stock-card__body {
  min-width: 0;
}

.attention-stock-card__stock {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.attention-stock-card__code {
  font-weight: 600;
}

.attention-stock-card__name {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.attention-stock-card__reason {
  margin: 2px 0;
  font-size: 16px;
  color: var(--el-text-color-regular);
}

.attention-stock-card__date {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}
</style>
