<script setup lang="ts">
// Card shell for 融資融券餘額 (margin_balance) — ranked by day-over-day change, often read
// as a retail-sentiment signal (financing/融資 skews retail-bullish, short-selling/融券
// skews retail-bearish). No backend source wired up yet — fixture data only.
export interface MarginBalanceRow {
  code: string
  name: string
  marginBalance: number // 融資餘額（張）
  marginChange: number // 融資增減（張）— signed
  shortBalance: number // 融券餘額（張）
  shortChange: number // 融券增減（張）— signed
}

const FIXTURE_ROWS: MarginBalanceRow[] = [
  { code: '2618', name: '長榮航', marginBalance: 82_400, marginChange: 6_200, shortBalance: 12_100, shortChange: -800 },
  { code: '3231', name: '緯創', marginBalance: 45_600, marginChange: 4_100, shortBalance: 3_200, shortChange: 350 },
  { code: '2603', name: '長榮', marginBalance: 38_900, marginChange: -3_500, shortBalance: 8_600, shortChange: 1_200 },
  { code: '6462', name: '神盾', marginBalance: 12_300, marginChange: 2_800, shortBalance: 5_100, shortChange: 900 },
  { code: '3037', name: '欣興', marginBalance: 28_700, marginChange: -1_900, shortBalance: 4_400, shortChange: -300 }
]

const sortedRows = computed(() => [...FIXTURE_ROWS].sort((a, b) => Math.abs(b.marginChange) - Math.abs(a.marginChange)))

function formatChange(value: number): string {
  return value > 0 ? `+${value.toLocaleString('zh-TW')}` : value.toLocaleString('zh-TW')
}
</script>

<template>
  <el-card class="margin-balance-card" shadow="never">
    <template #header>
      <span>融資融券餘額日增減</span>
    </template>

    <el-table :data="sortedRows" row-key="code" size="small">
      <el-table-column prop="name" label="股票" min-width="90">
        <template #default="{ row }">
          <div class="margin-balance-card__stock">
            <span class="margin-balance-card__name">{{ row.name }}</span>
            <span class="margin-balance-card__code">{{ row.code }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="融資餘額" align="right" min-width="80">
        <template #default="{ row }">{{ row.marginBalance.toLocaleString('zh-TW') }}</template>
      </el-table-column>
      <el-table-column label="融資增減" align="right" min-width="80">
        <template #default="{ row }">
          <span :class="row.marginChange >= 0 ? 'is-buy' : 'is-sell'">{{ formatChange(row.marginChange) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="融券餘額" align="right" min-width="80">
        <template #default="{ row }">{{ row.shortBalance.toLocaleString('zh-TW') }}</template>
      </el-table-column>
      <el-table-column label="融券增減" align="right" min-width="80">
        <template #default="{ row }">
          <span :class="row.shortChange >= 0 ? 'is-buy' : 'is-sell'">{{ formatChange(row.shortChange) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <p class="margin-balance-card__note">示意資料，尚未串接融資融券餘額</p>
  </el-card>
</template>

<style scoped>
.margin-balance-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.margin-balance-card__code {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.is-buy {
  color: var(--price-up-color);
}

.is-sell {
  color: var(--price-down-color);
}

.margin-balance-card__note {
  margin: 12px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
