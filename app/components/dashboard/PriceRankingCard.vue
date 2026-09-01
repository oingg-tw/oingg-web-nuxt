<script setup lang="ts">
// Card shell for 股價排行 (daily_price) — bff-ts already has a real endpoint for this
// (GET /api/rankings/price?metric=change|volume|turnover, per the user's own note), so this
// is the one card here closest to being wired up for real once that's reachable; still
// fixture data for now so the layout can be reviewed independently of that integration.
export type PriceRankingMetric = 'change' | 'volume' | 'turnover'

export interface PriceRankingRow {
  code: string
  name: string
  price: number
  changePercent: number
  volume: number // 股 (shares)
  turnover: number // NT$ thousand
}

const METRIC_OPTIONS: { value: PriceRankingMetric; label: string }[] = [
  { value: 'change', label: '漲跌幅' },
  { value: 'volume', label: '成交量' },
  { value: 'turnover', label: '成交值' }
]

const metric = ref<PriceRankingMetric>('change')

const FIXTURE_ROWS: PriceRankingRow[] = [
  { code: '3105', name: '穩懋', price: 145.5, changePercent: 9.98, volume: 28_400_000, turnover: 4_132_000 },
  { code: '2408', name: '南亞科', price: 82.3, changePercent: 8.76, volume: 65_200_000, turnover: 5_310_000 },
  { code: '2603', name: '長榮', price: 198.0, changePercent: -6.34, volume: 41_800_000, turnover: 8_120_000 },
  { code: '2330', name: '台積電', price: 998.0, changePercent: 1.22, volume: 22_600_000, turnover: 22_450_000 },
  { code: '2317', name: '鴻海', price: 198.5, changePercent: 0.51, volume: 38_900_000, turnover: 7_680_000 }
]

const sortKey: Record<PriceRankingMetric, keyof PriceRankingRow> = {
  change: 'changePercent',
  volume: 'volume',
  turnover: 'turnover'
}

const sortedRows = computed(() => [...FIXTURE_ROWS].sort((a, b) => Math.abs(b[sortKey[metric.value]] as number) - Math.abs(a[sortKey[metric.value]] as number)))

function formatVolume(shares: number): string {
  return `${(shares / 1000).toLocaleString('zh-TW')} 張`
}

function formatTurnover(thousands: number): string {
  return `${(thousands / 100_000).toFixed(1)} 億`
}
</script>

<template>
  <el-card class="price-ranking-card" shadow="never">
    <template #header>
      <div class="price-ranking-card__header">
        <span>股價排行</span>
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
          <div class="price-ranking-card__stock">
            <span class="price-ranking-card__name">{{ row.name }}</span>
            <span class="price-ranking-card__code">{{ row.code }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="股價" align="right" min-width="70">
        <template #default="{ row }">{{ row.price.toFixed(2) }}</template>
      </el-table-column>
      <el-table-column v-if="metric === 'change'" label="漲跌幅" align="right" min-width="80">
        <template #default="{ row }">
          <span :class="row.changePercent >= 0 ? 'is-buy' : 'is-sell'">
            {{ row.changePercent > 0 ? '+' : '' }}{{ row.changePercent.toFixed(2) }}%
          </span>
        </template>
      </el-table-column>
      <el-table-column v-if="metric === 'volume'" label="成交量" align="right" min-width="90">
        <template #default="{ row }">{{ formatVolume(row.volume) }}</template>
      </el-table-column>
      <el-table-column v-if="metric === 'turnover'" label="成交值" align="right" min-width="90">
        <template #default="{ row }">{{ formatTurnover(row.turnover) }}</template>
      </el-table-column>
    </el-table>

    <p class="price-ranking-card__note">示意資料，尚未串接 /api/rankings/price</p>
  </el-card>
</template>

<style scoped>
.price-ranking-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.price-ranking-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.price-ranking-card__code {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.is-buy {
  color: var(--price-up-color);
}

.is-sell {
  color: var(--price-down-color);
}

.price-ranking-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
