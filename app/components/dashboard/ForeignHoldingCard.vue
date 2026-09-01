<script setup lang="ts">
// Card shell for 外資持股比率 (foreign_holding) — ranked by day-over-day change in
// percentage points. No backend source wired up yet — fixture data only.
export interface ForeignHoldingRow {
  code: string
  name: string
  holdingPercent: number // 外資持股比率 %
  changePoints: number // 日變動（百分點）— signed
}

const FIXTURE_ROWS: ForeignHoldingRow[] = [
  { code: '2330', name: '台積電', holdingPercent: 71.2, changePoints: 0.15 },
  { code: '2454', name: '聯發科', holdingPercent: 55.8, changePoints: 0.32 },
  { code: '3231', name: '緯創', holdingPercent: 48.6, changePoints: -0.28 },
  { code: '2603', name: '長榮', holdingPercent: 22.4, changePoints: -0.41 },
  { code: '2317', name: '鴻海', holdingPercent: 44.1, changePoints: 0.08 }
]

const sortedRows = computed(() => [...FIXTURE_ROWS].sort((a, b) => Math.abs(b.changePoints) - Math.abs(a.changePoints)))
</script>

<template>
  <el-card class="foreign-holding-card" shadow="never">
    <template #header>
      <span>外資持股比率日變動</span>
    </template>

    <el-table :data="sortedRows" row-key="code" size="small">
      <el-table-column prop="name" label="股票" min-width="90">
        <template #default="{ row }">
          <div class="foreign-holding-card__stock">
            <span class="foreign-holding-card__name">{{ row.name }}</span>
            <span class="foreign-holding-card__code">{{ row.code }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="持股比率" align="right" min-width="80">
        <template #default="{ row }">{{ row.holdingPercent.toFixed(2) }}%</template>
      </el-table-column>
      <el-table-column label="日變動" align="right" min-width="80">
        <template #default="{ row }">
          <span :class="row.changePoints >= 0 ? 'is-buy' : 'is-sell'">
            {{ row.changePoints > 0 ? '+' : '' }}{{ row.changePoints.toFixed(2) }}pp
          </span>
        </template>
      </el-table-column>
    </el-table>

    <p class="foreign-holding-card__note">示意資料，尚未串接外資持股比率</p>
  </el-card>
</template>

<style scoped>
.foreign-holding-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.foreign-holding-card__code {
  font-size: 16px;
  color: var(--el-text-color-secondary);
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
