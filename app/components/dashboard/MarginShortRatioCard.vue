<script setup lang="ts">
// Was a fixture-only "融資融券餘額日增減" shell — replaced with bff-ts's real
// margin-short-ratio-ranking endpoint (confirmed live 2026-09-01), which turned out to be a
// different metric than the fixture guessed at: 券資比 (short-to-margin ratio, a chip-side
// short-squeeze-heat indicator), not day-over-day balance change. Renamed the component to
// match (was MarginBalanceCard).
const { data } = useMarginShortRatioRanking(20)

function formatBalance(raw: string): string {
  const value = Number(raw)
  return Number.isFinite(value) ? value.toLocaleString('zh-TW') : raw
}
</script>

<template>
  <el-card class="margin-short-ratio-card" shadow="never">
    <template #header>
      <span>券資比排行</span>
    </template>

    <el-empty v-if="data.rankings.length === 0" description="尚無可比較資料" :image-size="64" />
    <!-- max-height caps the visible body to 6.5 rows (measured live) — el-table scrolls the
         body internally past that rather than the card growing to fit all 20 rows the API
         can return. The .5 is deliberate: a visibly cut-off row hints there's more to
         scroll to, which a clean 6 or 7 wouldn't. -->
    <el-table v-else :data="data.rankings" row-key="symbol" size="small" max-height="361">
      <el-table-column prop="rank" label="#" width="36" />
      <el-table-column label="股票" min-width="90">
        <template #default="{ row }">
          <div class="margin-short-ratio-card__stock">
            <span class="margin-short-ratio-card__code">{{ row.symbol }}</span>
            <span class="margin-short-ratio-card__name">{{ row.name ?? '—' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="券資比" align="right" min-width="70">
        <template #default="{ row }">
          <span class="margin-short-ratio-card__ratio">{{ Number(row.shortToMarginRatioPct).toFixed(1) }}%</span>
        </template>
      </el-table-column>
      <el-table-column label="融資餘額" align="right" min-width="80">
        <template #default="{ row }">{{ formatBalance(row.marginTodayBalance) }}</template>
      </el-table-column>
      <el-table-column label="融券餘額" align="right" min-width="80">
        <template #default="{ row }">{{ formatBalance(row.shortTodayBalance) }}</template>
      </el-table-column>
    </el-table>

    <p v-if="data.tradeDate" class="margin-short-ratio-card__note">資料日期：{{ data.tradeDate }}</p>
  </el-card>
</template>

<style scoped>
.margin-short-ratio-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.margin-short-ratio-card__code {
  font-weight: 600;
}

.margin-short-ratio-card__name {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.margin-short-ratio-card__ratio {
  font-weight: 600;
  color: var(--el-color-primary);
}

.margin-short-ratio-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
