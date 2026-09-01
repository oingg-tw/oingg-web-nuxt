<script setup lang="ts">
// Wired to bff-ts's real price-limit-range endpoint (confirmed live 2026-09-01) — 漲跌停幅度
//最大/最小各20檔. TPEx rows lack openingRefPrice/previousDayPrice/allowOddLotTrade.
const { data } = usePriceLimitRange()

const view = ref<'widest' | 'narrowest'>('widest')
const rows = computed(() => (view.value === 'widest' ? data.value.widest : data.value.narrowest))
</script>

<template>
  <el-card class="price-limit-range-card" shadow="never">
    <template #header>
      <div class="price-limit-range-card__header">
        <span>漲跌停幅度排行</span>
        <el-radio-group v-model="view" size="small">
          <el-radio-button value="widest">最大</el-radio-button>
          <el-radio-button value="narrowest">最小</el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <el-empty v-if="rows.length === 0" description="尚無資料" :image-size="64" />
    <el-table v-else :data="rows" row-key="symbol" size="small" max-height="361">
      <el-table-column prop="rank" label="#" width="36" />
      <el-table-column label="股票" min-width="110">
        <template #default="{ row }">
          <div class="price-limit-range-card__stock">
            <span class="price-limit-range-card__code">{{ row.symbol }}</span>
            <span class="price-limit-range-card__name">{{ row.name ?? '—' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="漲停" align="right" min-width="60">
        <template #default="{ row }"><span class="price-limit-range-card__up">{{ row.limitUp }}</span></template>
      </el-table-column>
      <el-table-column label="跌停" align="right" min-width="60">
        <template #default="{ row }"><span class="price-limit-range-card__down">{{ row.limitDown }}</span></template>
      </el-table-column>
      <el-table-column label="幅度" align="right" min-width="70">
        <template #default="{ row }">{{ row.limitRange }}</template>
      </el-table-column>
    </el-table>

    <p v-if="data.tradeDate" class="price-limit-range-card__note">資料日期：{{ data.tradeDate }}</p>
  </el-card>
</template>

<style scoped>
.price-limit-range-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.price-limit-range-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.price-limit-range-card__code {
  font-weight: 600;
}

.price-limit-range-card__name {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.price-limit-range-card__up {
  color: var(--el-color-danger);
}

.price-limit-range-card__down {
  color: var(--el-color-success);
}

.price-limit-range-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
