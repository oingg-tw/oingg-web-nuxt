<script setup lang="ts">
// Card shell for 估值排行 (daily_valuation) — 高殖利率／低本益比排行, updated hourly per the
// user's own note. No backend source wired up yet — fixture data only.
export type ValuationRankingMetric = 'yield' | 'per'

export interface ValuationRankingRow {
  code: string
  name: string
  price: number
  dividendYield: number // %
  per: number // 本益比
  pbr: number // 股價淨值比
}

const METRIC_OPTIONS: { value: ValuationRankingMetric; label: string }[] = [
  { value: 'yield', label: '高殖利率' },
  { value: 'per', label: '低本益比' }
]

const metric = ref<ValuationRankingMetric>('yield')

const FIXTURE_ROWS: ValuationRankingRow[] = [
  { code: '2412', name: '中華電', price: 128.5, dividendYield: 5.8, per: 18.2, pbr: 2.6 },
  { code: '2882', name: '國泰金', price: 58.2, dividendYield: 5.5, per: 9.8, pbr: 1.3 },
  { code: '2891', name: '中信金', price: 32.1, dividendYield: 5.2, per: 10.4, pbr: 1.5 },
  { code: '1101', name: '台泥', price: 33.4, dividendYield: 4.9, per: 12.6, pbr: 0.9 },
  { code: '2308', name: '台達電', price: 412.0, dividendYield: 2.1, per: 24.5, pbr: 5.8 }
]

const sortedRows = computed(() =>
  [...FIXTURE_ROWS].sort((a, b) => (metric.value === 'yield' ? b.dividendYield - a.dividendYield : a.per - b.per))
)
</script>

<template>
  <el-card class="valuation-ranking-card" shadow="never">
    <template #header>
      <div class="valuation-ranking-card__header">
        <span>估值排行</span>
        <el-radio-group v-model="metric" size="small">
          <el-radio-button v-for="option in METRIC_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <el-table :data="sortedRows" row-key="code" size="small">
      <el-table-column prop="name" label="股票" min-width="90">
        <template #default="{ row }">
          <div class="valuation-ranking-card__stock">
            <span class="valuation-ranking-card__name">{{ row.name }}</span>
            <span class="valuation-ranking-card__code">{{ row.code }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="股價" align="right" min-width="70">
        <template #default="{ row }">{{ row.price.toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="殖利率" align="right" min-width="70">
        <template #default="{ row }">{{ row.dividendYield.toFixed(2) }}%</template>
      </el-table-column>
      <el-table-column label="本益比" align="right" min-width="70">
        <template #default="{ row }">{{ row.per.toFixed(1) }}</template>
      </el-table-column>
      <el-table-column label="股價淨值比" align="right" min-width="80">
        <template #default="{ row }">{{ row.pbr.toFixed(2) }}</template>
      </el-table-column>
    </el-table>

    <p class="valuation-ranking-card__note">示意資料，尚未串接每小時估值排行</p>
  </el-card>
</template>

<style scoped>
.valuation-ranking-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.valuation-ranking-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.valuation-ranking-card__code {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.valuation-ranking-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
