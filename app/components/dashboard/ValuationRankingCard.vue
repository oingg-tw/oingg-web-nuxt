<script setup lang="ts">
import { Coin } from '@element-plus/icons-vue'

// Fixture-only shell for design review — see the message thread with conductor 2026-09-02
// (dashboard repositioning around retirement/存股 investors). bff-ts confirmed
// GET /valuation/ranking (PER/PBR/殖利率, TWSE+TPEx merged) is live, but the exact response
// shape hasn't been confirmed yet — a guessed path 404'd, so this renders illustrative fixture
// rows instead of guessing further at field names. Metric toggle is the shell being reviewed:
// one card covering all three valuation angles instead of three separate cards, mirroring the
// existing RevenueRankingCard/EtfRankingCard metric-toggle pattern already established in this
// app. Swap to real data once bff-ts's response shape is confirmed.
type ValuationMetric = 'dividendYield' | 'per' | 'pbr'

const metric = ref<ValuationMetric>('dividendYield')

const METRIC_OPTIONS: { value: ValuationMetric; label: string }[] = [
  { value: 'dividendYield', label: '高殖利率' },
  { value: 'per', label: '低本益比' },
  { value: 'pbr', label: '低淨值比' }
]

interface FixtureRow {
  symbol: string
  name: string
  price: number
  dividendYield: number
  per: number
  pbr: number
}

const FIXTURE_ROWS: FixtureRow[] = [
  { symbol: '2412', name: '中華電', price: 128.5, dividendYield: 5.8, per: 18.2, pbr: 2.7 },
  { symbol: '2882', name: '國泰金', price: 58.2, dividendYield: 5.5, per: 9.8, pbr: 1.3 },
  { symbol: '2891', name: '中信金', price: 32.1, dividendYield: 5.2, per: 10.4, pbr: 1.5 },
  { symbol: '1101', name: '台泥', price: 33.4, dividendYield: 4.9, per: 12.6, pbr: 0.9 },
  { symbol: '2308', name: '台達電', price: 412.0, dividendYield: 2.1, per: 24.5, pbr: 5.8 },
  { symbol: '2884', name: '玉山金', price: 27.6, dividendYield: 4.7, per: 11.2, pbr: 1.6 }
]

const sortDirection: Record<ValuationMetric, 1 | -1> = { dividendYield: -1, per: 1, pbr: 1 }

const sortedRows = computed(() => [...FIXTURE_ROWS].sort((a, b) => sortDirection[metric.value] * (a[metric.value] - b[metric.value])))

function formatValue(row: FixtureRow): string {
  if (metric.value === 'dividendYield') return `${row.dividendYield.toFixed(1)}%`
  if (metric.value === 'per') return row.per.toFixed(1)
  return row.pbr.toFixed(1)
}

// Per conductor's design feedback 2026-09-02: primary sort stays purely single-metric
// (predictable, transparent — never reordered by this), but a secondary visual marker flags
// rows that ALSO rank well on the other two metrics — matches how a 存股 investor actually
// screens (high yield alone isn't enough; high yield AND reasonable valuation is the real
// candidate). Kept purely factual (a tooltip naming which other metric(s) it ranks well on),
// not a judgment call like "cheap"/"buy signal" — conductor was explicit that oingg's
// data-tool-not-advisor positioning rules out anything that reads as a recommendation.
// TOP_N=3 is a demo threshold sized for this 6-row fixture set; the real threshold (top N or
// top-quartile) needs revisiting once real data volume is known.
const TOP_N = 3

const topRankBySymbol = computed<Record<ValuationMetric, Set<string>>>(() => ({
  dividendYield: new Set([...FIXTURE_ROWS].sort((a, b) => b.dividendYield - a.dividendYield).slice(0, TOP_N).map(r => r.symbol)),
  per: new Set([...FIXTURE_ROWS].sort((a, b) => a.per - b.per).slice(0, TOP_N).map(r => r.symbol)),
  pbr: new Set([...FIXTURE_ROWS].sort((a, b) => a.pbr - b.pbr).slice(0, TOP_N).map(r => r.symbol))
}))

function otherTopMetrics(symbol: string): string[] {
  return METRIC_OPTIONS.filter(o => o.value !== metric.value && topRankBySymbol.value[o.value].has(symbol)).map(o => o.label)
}
</script>

<template>
  <el-card class="valuation-ranking-card" shadow="never">
    <template #header>
      <div class="valuation-ranking-card__header">
        <div class="valuation-ranking-card__title">
          <el-icon><Coin /></el-icon>
          <span>估值排行</span>
        </div>
        <el-radio-group v-model="metric" size="small">
          <el-radio-button v-for="option in METRIC_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <el-table :data="sortedRows" row-key="symbol" size="small" max-height="361">
      <el-table-column label="股票" min-width="120">
        <template #default="{ row }">
          <div class="valuation-ranking-card__stock">
            <span class="valuation-ranking-card__code">
              {{ row.symbol }}
              <el-tag
                v-if="otherTopMetrics(row.symbol).length"
                size="small"
                type="info"
                effect="plain"
                :title="`同時也在${otherTopMetrics(row.symbol).join('、')}前${TOP_N}名`"
              >
                ★
              </el-tag>
            </span>
            <span class="valuation-ranking-card__name">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="股價" align="right" min-width="70">
        <template #default="{ row }">{{ row.price.toFixed(2) }}</template>
      </el-table-column>
      <el-table-column :label="METRIC_OPTIONS.find(o => o.value === metric)!.label.slice(1)" align="right" min-width="80">
        <template #default="{ row }">{{ formatValue(row) }}</template>
      </el-table-column>
    </el-table>

    <p class="valuation-ranking-card__note">★ 同時位居其他估值指標前{{ TOP_N }}名</p>
    <p class="valuation-ranking-card__note">示意資料，尚未串接 /valuation/ranking</p>
  </el-card>
</template>

<style scoped>
.valuation-ranking-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.valuation-ranking-card__title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.valuation-ranking-card__title .el-icon {
  color: var(--el-color-primary);
}

.valuation-ranking-card__stock {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.valuation-ranking-card__code {
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.valuation-ranking-card__name {
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
