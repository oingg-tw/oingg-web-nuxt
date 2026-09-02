<script setup lang="ts">
import { Lock } from '@element-plus/icons-vue'

// Wired to bff-ts's real disposed-stocks endpoint (confirmed live 2026-09-01) — 處置股清單,
// replaces what the fixture-only AttentionStockCard used to represent before it got renamed
// to actually match the注意股 endpoint instead. TPEx rows lack announcementCount/
// dispositionMeasures/linkInformation — render '—' for those, not blank/error.
//
// Rebuilt as an el-table 2026-09-02 (was a bare <ul>/<li> warning list) to match every other
// dashboard card's table convention — same 6日漲跌 treatment as AttentionStockCard.
//
// 處置原因 column redesigned again the same day to use reasonShort (a short parsed label,
// e.g. "漲跌異常") as a tag instead of the raw multi-clause `reason` sentence, with the full
// text still available on hover via title — falls back to the truncated sentence when
// reasonShort is null (some reasons don't map to a known short label). Date range now reads
// from dispositionStartDate/dispositionEndDate (proper Gregorian dates) instead of the raw
// ROC-format dispositionPeriod string.
const { data } = useDisposedStocks(20)

function formatDispositionRange(row: { dispositionStartDate: string; dispositionEndDate: string }): string {
  return `${row.dispositionStartDate.slice(5)}~${row.dispositionEndDate.slice(5)}`
}

function formatSixDayChange(raw: string | null): string {
  if (raw === null) return '—'
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function sixDayChangeClass(raw: string | null): string {
  if (raw === null) return ''
  const value = Number(raw)
  if (!Number.isFinite(value) || value === 0) return ''
  return value > 0 ? 'disposed-stocks-card__up' : 'disposed-stocks-card__down'
}
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
    <el-table v-else :data="data.items" row-key="symbol" size="small" max-height="361">
      <el-table-column label="股票" min-width="90">
        <template #default="{ row }">
          <div class="disposed-stocks-card__stock">
            <span class="disposed-stocks-card__code">{{ row.symbol }}</span>
            <span class="disposed-stocks-card__name">{{ row.name ?? '—' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="處置原因" min-width="150">
        <template #default="{ row }">
          <div class="disposed-stocks-card__reason-cell">
            <el-tag v-if="row.reasonShort" size="small" type="warning" effect="plain" :title="row.reason">
              {{ row.reasonShort }}
            </el-tag>
            <p v-else class="disposed-stocks-card__reason" :title="row.reason">{{ row.reason }}</p>
            <span class="disposed-stocks-card__period">{{ formatDispositionRange(row) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="6日漲跌" align="right" min-width="70">
        <template #default="{ row }">
          <span :class="sixDayChangeClass(row.sixDayChangePercent)">{{ formatSixDayChange(row.sixDayChangePercent) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <p v-if="data.items.length" class="disposed-stocks-card__note">公告日期新到舊排序</p>
  </el-card>
</template>

<style scoped>
.disposed-stocks-card__title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.disposed-stocks-card__title .el-icon {
  color: var(--el-color-warning);
}

.disposed-stocks-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.disposed-stocks-card__code {
  font-weight: 600;
}

.disposed-stocks-card__name {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.disposed-stocks-card__reason-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.disposed-stocks-card__reason {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.disposed-stocks-card__period {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.disposed-stocks-card__up {
  color: var(--price-up-color);
}

.disposed-stocks-card__down {
  color: var(--price-down-color);
}

.disposed-stocks-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
