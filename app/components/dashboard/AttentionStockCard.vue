<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'
import type { AttentionStockCriteriaDetail } from '~/composables/dashboard/useAttentionStocks'

// Was fixture-only — now wired to bff-ts's real attention-stocks endpoint (confirmed live
// 2026-09-01). No nullable TPEx-only fields here (unlike disposed-stocks/volume-top20/
// revenue-ranking's market-specific gaps) — every field is populated regardless of market.
const { data } = useAttentionStocks(20)

// criteriaDetails (added 2026-09-02) is a structured parse of the `criteria` free-text.
// Only startDate (the earliest date the reason applies from) and times are worth showing —
// endDate and observationDays don't add anything a reader needs here. It's an array because
// the raw text sometimes concatenates two reason clauses with no separator; each entry gets
// its own line. Falls back to the plain criteria text when parsing produced nothing (empty
// array).
function formatCriterion(detail: AttentionStockCriteriaDetail): string {
  return `${detail.startDate}　${detail.times}次`
}
</script>

<template>
  <el-card class="attention-stock-card" shadow="never">
    <template #header>
      <div class="attention-stock-card__title">
        <el-icon><WarningFilled /></el-icon>
        <span>今日注意股票</span>
      </div>
    </template>

    <el-empty v-if="data.items.length === 0" description="尚無注意股票資料" :image-size="64" />
    <el-table v-else :data="data.items" row-key="symbol" size="small" max-height="361">
      <el-table-column label="股票" min-width="120">
        <template #default="{ row }">
          <div class="attention-stock-card__stock">
            <span class="attention-stock-card__code">{{ row.symbol }}</span>
            <span class="attention-stock-card__name">{{ row.name ?? '—' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="注意原因" min-width="140">
        <template #default="{ row }">
          <div v-if="row.criteriaDetails.length" class="attention-stock-card__criteria">
            <span v-for="(detail, index) in row.criteriaDetails" :key="index" class="attention-stock-card__criterion">
              {{ formatCriterion(detail) }}
            </span>
          </div>
          <span v-else>{{ row.criteria }}</span>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<style scoped>
.attention-stock-card__title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.attention-stock-card__title .el-icon {
  color: var(--el-color-warning);
}

.attention-stock-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.attention-stock-card__code {
  font-weight: 600;
}

.attention-stock-card__name {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.attention-stock-card__criteria {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
