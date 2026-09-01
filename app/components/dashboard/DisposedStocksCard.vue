<script setup lang="ts">
import { Lock, WarningFilled } from '@element-plus/icons-vue'

// Wired to bff-ts's real disposed-stocks endpoint (confirmed live 2026-09-01) — 處置股清單,
// replaces what the fixture-only AttentionStockCard used to represent before it got renamed
// to actually match the注意股 endpoint instead. TPEx rows lack announcementCount/
// dispositionMeasures/linkInformation — render '—' for those, not blank/error.
const { data } = useDisposedStocks(20)
</script>

<template>
  <el-card class="disposed-stocks-card" shadow="never">
    <template #header>
      <div class="disposed-stocks-card__title">
        <el-icon><Lock /></el-icon>
        <span>處置股清單</span>
      </div>
    </template>

    <el-empty v-if="data.items.length === 0" description="尚無處置股資料" :image-size="64" />
    <ul v-else class="disposed-stocks-card__list">
      <li v-for="(row, index) in data.items" :key="`${row.symbol}-${index}`" class="disposed-stocks-card__item">
        <el-icon class="disposed-stocks-card__icon"><WarningFilled /></el-icon>
        <div class="disposed-stocks-card__body">
          <div class="disposed-stocks-card__stock">
            <span class="disposed-stocks-card__code">{{ row.symbol }}</span>
            <span class="disposed-stocks-card__name">{{ row.name ?? '—' }}</span>
          </div>
          <p class="disposed-stocks-card__reason">{{ row.reason }}</p>
          <span class="disposed-stocks-card__period">處置期間：{{ row.dispositionPeriod }}</span>
        </div>
      </li>
    </ul>

    <p v-if="data.items.length" class="disposed-stocks-card__note">公告日期新到舊排序</p>
  </el-card>
</template>

<style scoped>
.disposed-stocks-card__title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.disposed-stocks-card__title .el-icon {
  color: var(--el-color-warning);
}

.disposed-stocks-card__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 360px;
  overflow-y: auto;
}

.disposed-stocks-card__item {
  display: flex;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.disposed-stocks-card__item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.disposed-stocks-card__icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 18px;
  color: var(--el-color-warning);
}

.disposed-stocks-card__body {
  min-width: 0;
}

.disposed-stocks-card__stock {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.disposed-stocks-card__code {
  font-weight: 600;
}

.disposed-stocks-card__name {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.disposed-stocks-card__reason {
  margin: 2px 0;
  font-size: 16px;
  color: var(--el-text-color-regular);
}

.disposed-stocks-card__period {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.disposed-stocks-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
