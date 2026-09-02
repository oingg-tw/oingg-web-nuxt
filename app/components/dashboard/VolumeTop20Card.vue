<script setup lang="ts">
import { DataLine } from '@element-plus/icons-vue'

// Wired to bff-ts's real volume-top20 endpoint (confirmed live 2026-09-01). TPEx rows lack
// transaction/open/high/low/close/dir/change/changePercent — render '—' for those, not
// blank/error. Uses changePercent (bff-ts-computed, unified TWSE/TPEx algorithm, confirmed
// live 2026-09-02) instead of the raw dir/change pair.
const { data, pending } = useVolumeTop20()

function formatNumber(raw: string | null): string {
  if (raw === null) return '—'
  const value = Number(raw)
  return Number.isFinite(value) ? value.toLocaleString('zh-TW') : raw
}

function formatChangePercent(raw: string | null): string {
  if (raw === null) return '—'
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function changePercentClass(raw: string | null): string {
  if (raw === null) return ''
  const value = Number(raw)
  if (!Number.isFinite(value) || value === 0) return ''
  return value > 0 ? 'volume-top20-card__up' : 'volume-top20-card__down'
}
</script>

<template>
  <el-card class="volume-top20-card" shadow="never">
    <template #header>
      <div class="volume-top20-card__title">
        <el-icon><DataLine /></el-icon>
        <span>成交量前20</span>
      </div>
    </template>

    <!-- Empty state is el-table's own #empty slot, not a sibling el-empty behind a v-if/
         v-else — see MarginShortRatioCard.vue's comment for why (a real reproduced crash). -->
    <el-table v-loading="pending" :data="data.rankings" row-key="symbol" size="small" max-height="361" style="min-height: 200px">
      <template #empty>
        <el-empty description="尚無資料" :image-size="64" />
      </template>
      <el-table-column label="股票" min-width="100">
        <template #default="{ row }">
          <div class="volume-top20-card__stock">
            <span class="volume-top20-card__code">{{ row.symbol }}</span>
            <span class="volume-top20-card__name">{{ row.name ?? '—' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="成交量" align="right" min-width="80">
        <template #default="{ row }">{{ formatNumber(row.volume) }}</template>
      </el-table-column>
      <el-table-column label="收盤" align="right" min-width="55">
        <template #default="{ row }">{{ row.close ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="漲跌幅" align="right" min-width="85">
        <template #default="{ row }">
          <span :class="changePercentClass(row.changePercent)">{{ formatChangePercent(row.changePercent) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <p v-if="data.tradeDate" class="volume-top20-card__note">資料日期：{{ data.tradeDate }}</p>
  </el-card>
</template>

<style scoped>
.volume-top20-card__title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.volume-top20-card__title .el-icon {
  color: var(--el-color-primary);
}

.volume-top20-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.volume-top20-card__code {
  font-weight: 600;
}

.volume-top20-card__name {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.volume-top20-card__up {
  color: var(--price-up-color);
}

.volume-top20-card__down {
  color: var(--price-down-color);
}

.volume-top20-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
