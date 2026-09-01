<script setup lang="ts">
import type { AttentionStockCriteriaDetail } from '~/composables/dashboard/useAttentionStocks'

// Was fixture-only — now wired to bff-ts's real attention-stocks endpoint (confirmed live
// 2026-09-01). No nullable TPEx-only fields here (unlike disposed-stocks/volume-top20/
// revenue-ranking's market-specific gaps) — every field is populated regardless of market.
const { data } = useAttentionStocks(20)

// criteriaDetails (added 2026-09-02) is a structured parse of the `criteria` free-text —
// render it as a short date-range + trigger label instead of the raw Chinese sentence. It's
// an array because the raw text sometimes concatenates two reason clauses with no separator;
// each entry gets its own line. Falls back to the plain criteria text when parsing produced
// nothing (empty array).
function formatCriterion(detail: AttentionStockCriteriaDetail): string {
  const range = `${detail.startDate}~${detail.endDate}`
  const label = detail.observationDays !== null
    ? `${detail.observationDays}個營業日內達${detail.times}次`
    : `連續${detail.times}次`
  return `${range}　${label}`
}
</script>

<template>
  <el-card class="attention-stock-card" shadow="never">
    <template #header>
      <span>今日注意股票</span>
    </template>

    <el-empty v-if="data.items.length === 0" description="尚無注意股票資料" :image-size="64" />
    <el-table v-else :data="data.items" row-key="symbol" size="small" max-height="361">
      <el-table-column label="股票" min-width="90">
        <template #default="{ row }">
          <div class="attention-stock-card__stock">
            <span class="attention-stock-card__code">{{ row.symbol }}</span>
            <span class="attention-stock-card__name">{{ row.name ?? '—' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="注意原因" min-width="200">
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
