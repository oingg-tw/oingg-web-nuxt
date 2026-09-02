<script setup lang="ts">
import { FirstAidKit, Search } from '@element-plus/icons-vue'
import type { Stock } from '~/composables/stock/useStocks'
import type { ScreenerFieldValue } from '~/composables/screener/useFilterSearch'

// 個股健檢 — conductor's suggestion 2026-09-02: unlike the ranking cards elsewhere on this
// dashboard, guru scores (Piotroski F-Score, Altman Z-Score) only exist as per-company lookups
// (POST /screener/values, see useStockHealthCheck.ts), not a cross-market ranking bff-ts/
// analysis-ts haven't built. A search-driven card fits that shape naturally — browse vs.
// look-up are different tasks, not competing with the ranking cards for the same job.
//
// Named 個股健檢 (not 個股快查/"quick lookup") per the user's own feedback 2026-09-02 — a
// generic "lookup" name read as redundant with the top-pinned StockSearchBar (which also lets
// you type a code and jump to a stock), even though what this card actually does is different
// (an inline guru-score/valuation snapshot without leaving the page, not navigation). The more
// specific name makes that distinction legible at a glance instead of relying on the reader to
// notice the behavioral difference themselves.
const { searchUniverse } = useStocks()
const { data, pending, notFound, lookup, reset } = useStockHealthCheck()

const keyword = ref('')

function fetchSuggestions(query: string, callback: (results: Stock[]) => void) {
  callback(searchUniverse(query))
}

function handleSelect(stock: Stock) {
  keyword.value = `${stock.code} ${stock.name}`
  lookup(stock.code)
}

function handleEnter() {
  const matches = searchUniverse(keyword.value)
  if (matches.length > 0) handleSelect(matches[0]!)
}

function handleClear() {
  keyword.value = ''
  reset()
}

interface FieldDef {
  field: string
  label: string
}

// Raw values only, no interpretive zone/verdict labels (e.g. Altman's own published
// "safe/grey/distress" zones) — same neutral-tone standard as ValuationRankingCard/
// EtfRankingCard: show the number, let the reader draw their own conclusion.
const FIELD_DEFS: FieldDef[] = [
  { field: 'piotroskiFScore.score', label: 'Piotroski F-Score' },
  { field: 'altmanZScore.zScore', label: 'Altman Z-Score' },
  { field: 'per.peRatio', label: '本益比' },
  { field: 'pbr.pbRatio', label: '淨值比' },
  { field: 'dividendYield.dividendYieldPct', label: '殖利率' }
]

const PERCENT_FIELDS = new Set(['dividendYield.dividendYieldPct'])

function fieldValue(row: NonNullable<typeof data.value>, field: string): ScreenerFieldValue | null {
  return row.values[field] ?? null
}

// entry itself can exist with a null .value (confirmed live: a symbol with no computable
// Piotroski F-Score comes back as {value: null, asOfDate: "26Q2"}, not an absent entry) — see
// useFilterSearch.ts's own comment on this. Both states render the same "—" here.
function formatValue(field: string, entry: ScreenerFieldValue | null): string {
  if (!entry || entry.value === null) return '—'
  return PERCENT_FIELDS.has(field) ? `${entry.value}%` : entry.value
}
</script>

<template>
  <el-card class="stock-health-check-card" shadow="never">
    <template #header>
      <div class="stock-health-check-card__title">
        <el-icon><FirstAidKit /></el-icon>
        <span>個股健檢</span>
      </div>
    </template>

    <el-autocomplete
      v-model="keyword"
      class="stock-health-check-card__search"
      :fetch-suggestions="fetchSuggestions"
      placeholder="輸入股票代號或名稱，例如 2330 或 台積電"
      clearable
      @select="handleSelect"
      @keyup.enter="handleEnter"
      @clear="handleClear"
    >
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
      <template #default="{ item }">
        <div class="stock-health-check-card__option">
          <span>{{ item.name }}</span>
          <span class="stock-health-check-card__option-code">{{ item.code }}</span>
        </div>
      </template>
    </el-autocomplete>

    <div v-loading="pending" class="stock-health-check-card__body">
      <el-empty v-if="!data && !pending && !notFound" description="輸入股票代號或名稱查詢" :image-size="64" />
      <el-empty v-else-if="notFound" description="查無資料" :image-size="64" />
      <template v-else-if="data">
        <div class="stock-health-check-card__stock">
          <span class="stock-health-check-card__code">{{ data.symbol }}</span>
          <span class="stock-health-check-card__name">{{ data.name }}</span>
        </div>
        <div class="stock-health-check-card__grid">
          <div v-for="def in FIELD_DEFS" :key="def.field" class="stock-health-check-card__field">
            <span class="stock-health-check-card__label">{{ def.label }}</span>
            <span class="stock-health-check-card__value">{{ formatValue(def.field, fieldValue(data, def.field)) }}</span>
            <span v-if="fieldValue(data, def.field)?.value !== null" class="stock-health-check-card__as-of">
              {{ fieldValue(data, def.field)?.asOfDate }}
            </span>
          </div>
        </div>
        <p class="stock-health-check-card__note">Piotroski F-Score／Altman Z-Score 目前資料覆蓋率有限，非所有個股皆有數據</p>
      </template>
    </div>
  </el-card>
</template>

<style scoped>
.stock-health-check-card__title {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stock-health-check-card__title .el-icon {
  color: var(--el-color-primary);
}

.stock-health-check-card__search {
  width: 100%;
}

.stock-health-check-card__option {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.stock-health-check-card__option-code {
  color: var(--el-text-color-secondary);
}

.stock-health-check-card__body {
  margin-top: 16px;
  min-height: 160px;
}

.stock-health-check-card__stock {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 16px;
}

.stock-health-check-card__code {
  font-size: 18px;
  font-weight: 600;
}

.stock-health-check-card__name {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.stock-health-check-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

.stock-health-check-card__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stock-health-check-card__label {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.stock-health-check-card__value {
  font-size: 20px;
  font-weight: 600;
}

.stock-health-check-card__as-of {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
}

.stock-health-check-card__note {
  margin: 16px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
