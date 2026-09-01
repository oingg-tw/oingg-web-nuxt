<script setup lang="ts">
// Wired to bff-ts's real volume-top20 endpoint (confirmed live 2026-09-01). TPEx rows lack
// transaction/open/high/low/close/dir/change — render '—' for those, not blank/error.
const { data } = useVolumeTop20()

function formatNumber(raw: string | null): string {
  if (raw === null) return '—'
  const value = Number(raw)
  return Number.isFinite(value) ? value.toLocaleString('zh-TW') : raw
}

function formatChange(row: { change: string | null; dir: string | null }): string {
  if (row.change === null) return '—'
  const value = Number(row.change)
  if (!Number.isFinite(value)) return row.change
  const sign = row.dir === '-' ? '-' : row.dir === '+' ? '+' : ''
  return `${sign}${Math.abs(value)}`
}

function changeClass(dir: string | null): string {
  if (dir === '+') return 'volume-top20-card__up'
  if (dir === '-') return 'volume-top20-card__down'
  return ''
}
</script>

<template>
  <el-card class="volume-top20-card" shadow="never">
    <template #header>
      <span>成交量前20</span>
    </template>

    <el-empty v-if="data.rankings.length === 0" description="尚無資料" :image-size="64" />
    <el-table v-else :data="data.rankings" row-key="symbol" size="small" max-height="361">
      <el-table-column prop="rank" label="#" width="36" />
      <el-table-column label="股票" min-width="110">
        <template #default="{ row }">
          <div class="volume-top20-card__stock">
            <span class="volume-top20-card__code">{{ row.symbol }}</span>
            <span class="volume-top20-card__name">{{ row.name ?? '—' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="成交量" align="right" min-width="90">
        <template #default="{ row }">{{ formatNumber(row.volume) }}</template>
      </el-table-column>
      <el-table-column label="收盤" align="right" min-width="60">
        <template #default="{ row }">{{ row.close ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="漲跌" align="right" min-width="60">
        <template #default="{ row }">
          <span :class="changeClass(row.dir)">{{ formatChange(row) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <p v-if="data.tradeDate" class="volume-top20-card__note">資料日期：{{ data.tradeDate }}</p>
  </el-card>
</template>

<style scoped>
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
  color: var(--el-color-danger);
}

.volume-top20-card__down {
  color: var(--el-color-success);
}

.volume-top20-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
