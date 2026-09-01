<script setup lang="ts">
// Was fixture-only — now wired to bff-ts's real foreign-holding-ranking endpoint (confirmed
// live 2026-09-01). No company name in the response (just `symbol`), unlike the screener's
// own results — shows code only.
const direction = ref<'increase' | 'decrease'>('increase')
const { data } = useForeignHoldingRanking(10)

const rows = computed(() => (direction.value === 'increase' ? data.value.increases : data.value.decreases))

// bff-ts's own backfill hasn't accumulated two comparable trading days yet — a real "no data
// yet" state (tradeDate/previousTradeDate both null, increases/decreases both empty), not an
// error, so this reads as "資料還在準備" rather than a blank/broken-looking table.
const isBackfilling = computed(() => data.value.tradeDate === null)
</script>

<template>
  <el-card class="foreign-holding-card" shadow="never">
    <template #header>
      <div class="foreign-holding-card__header">
        <span>外資持股比率變動（前 {{ data.topPercent }}%）</span>
        <el-radio-group v-model="direction" size="small">
          <el-radio-button value="increase">加碼</el-radio-button>
          <el-radio-button value="decrease">減碼</el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <el-empty v-if="isBackfilling" description="資料還在準備中，稍後再回來看看" :image-size="64" />
    <el-table v-else :data="rows" row-key="symbol" size="small">
      <el-table-column prop="symbol" label="股票" min-width="70" />
      <el-table-column label="持股比率" align="right" min-width="80">
        <template #default="{ row }">{{ Number(row.sharesHeldPercent).toFixed(2) }}%</template>
      </el-table-column>
      <el-table-column label="變動" align="right" min-width="80">
        <template #default="{ row }">
          <span :class="Number(row.changePercentagePoints) >= 0 ? 'is-buy' : 'is-sell'">
            {{ Number(row.changePercentagePoints) > 0 ? '+' : '' }}{{ Number(row.changePercentagePoints).toFixed(2) }}pp
          </span>
        </template>
      </el-table-column>
    </el-table>

    <p v-if="data.tradeDate" class="foreign-holding-card__note">
      資料日期：{{ data.tradeDate }}（對比 {{ data.previousTradeDate }}）
    </p>
  </el-card>
</template>

<style scoped>
.foreign-holding-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}

.is-buy {
  color: var(--price-up-color);
}

.is-sell {
  color: var(--price-down-color);
}

.foreign-holding-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
