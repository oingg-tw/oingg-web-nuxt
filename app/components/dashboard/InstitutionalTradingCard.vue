<script setup lang="ts">
// Card shell for 三大法人合計買賣超 (institutional_trading / TWSE's own T86 report) — one of
// the most common blocks on any TW stock market homepage: today's top net-buy/net-sell
// stocks by foreign investors + investment trusts + dealers combined. No backend source
// wired up yet (bff-ts's own publish-time detection for this report is still polling every
// 10 minutes to find out when TWSE actually publishes it each day, per the user's own
// description) — this renders fixture data purely to prove out the card's layout, not as
// real trading figures. Real company names since T86 rankings are always real, well-known
// large-cap stocks in practice (foreign/trust net-buy activity concentrates there), not
// something fixture data could mislead about the way a fabricated 興櫃/ETF name would.
export interface InstitutionalTradingRow {
  code: string
  name: string
  // All three in NT$ thousand, net (positive = net buy, negative = net sell) — T86's own
  // unit convention, so a real API response can map straight into these without conversion.
  foreignNet: number
  trustNet: number
  dealerNet: number
}

function total(row: InstitutionalTradingRow): number {
  return row.foreignNet + row.trustNet + row.dealerNet
}

const direction = ref<'buy' | 'sell'>('buy')

const FIXTURE_ROWS: InstitutionalTradingRow[] = [
  { code: '2330', name: '台積電', foreignNet: 4823000, trustNet: 312000, dealerNet: -85000 },
  { code: '2317', name: '鴻海', foreignNet: 1560000, trustNet: 98000, dealerNet: 42000 },
  { code: '2454', name: '聯發科', foreignNet: 987000, trustNet: -120000, dealerNet: 15000 },
  { code: '2603', name: '長榮', foreignNet: -650000, trustNet: 45000, dealerNet: -30000 },
  { code: '2882', name: '國泰金', foreignNet: -420000, trustNet: -88000, dealerNet: 12000 }
]

const sortedRows = computed(() =>
  [...FIXTURE_ROWS].sort((a, b) => (direction.value === 'buy' ? total(b) - total(a) : total(a) - total(b)))
)

function formatNet(value: number): string {
  const abs = (Math.abs(value) / 1000).toFixed(0)
  return value >= 0 ? `+${abs}` : `-${abs}`
}
</script>

<template>
  <el-card class="institutional-trading-card" shadow="never">
    <template #header>
      <div class="institutional-trading-card__header">
        <span>三大法人買賣超</span>
        <el-radio-group v-model="direction" size="small">
          <el-radio-button value="buy">買超</el-radio-button>
          <el-radio-button value="sell">賣超</el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <el-table :data="sortedRows" row-key="code" size="small">
      <el-table-column prop="name" label="股票" min-width="90">
        <template #default="{ row }">
          <div class="institutional-trading-card__stock">
            <span class="institutional-trading-card__name">{{ row.name }}</span>
            <span class="institutional-trading-card__code">{{ row.code }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="外資" align="right" min-width="70">
        <template #default="{ row }">
          <span :class="row.foreignNet >= 0 ? 'is-buy' : 'is-sell'">{{ formatNet(row.foreignNet) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="投信" align="right" min-width="70">
        <template #default="{ row }">
          <span :class="row.trustNet >= 0 ? 'is-buy' : 'is-sell'">{{ formatNet(row.trustNet) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="自營商" align="right" min-width="70">
        <template #default="{ row }">
          <span :class="row.dealerNet >= 0 ? 'is-buy' : 'is-sell'">{{ formatNet(row.dealerNet) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="合計（張）" align="right" min-width="90">
        <template #default="{ row }">
          <span class="institutional-trading-card__total" :class="total(row) >= 0 ? 'is-buy' : 'is-sell'">
            {{ formatNet(total(row)) }}
          </span>
        </template>
      </el-table-column>
    </el-table>

    <p class="institutional-trading-card__note">示意資料，尚未串接即時三大法人買賣超</p>
  </el-card>
</template>

<style scoped>
.institutional-trading-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.institutional-trading-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.institutional-trading-card__code {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.institutional-trading-card__total {
  font-weight: 600;
}

.is-buy {
  color: var(--price-up-color);
}

.is-sell {
  color: var(--price-down-color);
}

.institutional-trading-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
