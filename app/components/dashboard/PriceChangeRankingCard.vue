<script setup lang="ts">
import { TrendCharts } from '@element-plus/icons-vue'

// Wired to bff-ts's real price-change-ranking endpoint (confirmed live 2026-09-02) — 漲跌幅
// 排行. gainers/losers both come back in one response, so the toggle here is a pure
// client-side view switch, no refetch (unlike EtfRankingCard's metric toggle).
const { data } = usePriceChangeRanking(20)

const view = ref<'gainers' | 'losers'>('gainers')
const rows = computed(() => (view.value === 'gainers' ? data.value.gainers : data.value.losers))

// tradeDate is per-row, not a single shared date (see usePriceChangeRanking.ts's own comment —
// TWSE and TPEx can be on different "latest trading day"s), so the footer summarizes each
// market's own latest date instead of picking one row's date to represent everyone.
const marketDateLabel = computed(() => {
  const latest: Partial<Record<'TWSE' | 'TPEx', string>> = {}
  for (const row of [...data.value.gainers, ...data.value.losers]) {
    if (!latest[row.market] || row.tradeDate > latest[row.market]!) latest[row.market] = row.tradeDate
  }
  const parts: string[] = []
  if (latest.TWSE) parts.push(`上市:${latest.TWSE.slice(5)}`)
  if (latest.TPEx) parts.push(`上櫃:${latest.TPEx.slice(5)}`)
  return parts.join('　')
})

function formatPercent(raw: string): string {
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function percentClass(raw: string): string {
  const value = Number(raw)
  if (!Number.isFinite(value) || value === 0) return ''
  return value > 0 ? 'price-change-ranking-card__up' : 'price-change-ranking-card__down'
}
</script>

<template>
  <el-card class="price-change-ranking-card" shadow="never">
    <template #header>
      <div class="price-change-ranking-card__header">
        <div class="price-change-ranking-card__title">
          <el-icon><TrendCharts /></el-icon>
          <span>漲跌幅排行</span>
        </div>
        <el-radio-group v-model="view" size="small">
          <el-radio-button value="gainers">漲幅</el-radio-button>
          <el-radio-button value="losers">跌幅</el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <el-empty v-if="rows.length === 0" description="尚無資料" :image-size="64" />
    <el-table v-else :data="rows" row-key="symbol" size="small" max-height="361">
      <el-table-column label="股票" min-width="110">
        <template #default="{ row }">
          <div class="price-change-ranking-card__stock">
            <span class="price-change-ranking-card__code">{{ row.symbol }}</span>
            <span class="price-change-ranking-card__name">{{ row.name ?? '—' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="收盤" align="right" min-width="70">
        <template #default="{ row }">{{ row.close }}</template>
      </el-table-column>
      <el-table-column label="漲跌幅" align="right" min-width="80">
        <template #default="{ row }">
          <span :class="percentClass(row.changePercent)">{{ formatPercent(row.changePercent) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <p v-if="marketDateLabel" class="price-change-ranking-card__note">資料日期：{{ marketDateLabel }}</p>
  </el-card>
</template>

<style scoped>
.price-change-ranking-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.price-change-ranking-card__title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.price-change-ranking-card__title .el-icon {
  color: var(--el-color-primary);
}

.price-change-ranking-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.price-change-ranking-card__code {
  font-weight: 600;
}

.price-change-ranking-card__name {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.price-change-ranking-card__up {
  color: var(--price-up-color);
}

.price-change-ranking-card__down {
  color: var(--price-down-color);
}

.price-change-ranking-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
