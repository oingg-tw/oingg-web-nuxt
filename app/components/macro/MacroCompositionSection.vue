<script setup lang="ts">
import type { MacroPageData } from '#shared/types/hub'

// 貨幣供給頁的 M2 組成（2026-11-24，使用者 11-23「貨幣供給加上 M2 組成」）：每月月底的餘額，六層疊起來就是 M2，單位兆元。
// 層名與順序在 M2_LAYERS（shared/utils/macro-series.ts）
const props = defineProps<{ rows: NonNullable<MacroPageData['composition']> }>()
const { period, shown } = useChartPeriod({ all: computed(() => props.rows), keyOf: row => row.period, perYear: 12 })
// 億元 → 兆元，圖上兩位小數就夠
const layers = computed(() => M2_LAYERS.map(layer => ({ name: layer.name, values: shown.value.map(row => (row.values[layer.key] ?? 0) / 10_000) })))
const latest = computed(() => props.rows.at(-1) ?? null)
const total = (row: { values: Record<string, number | null> }) => Object.values(row.values).reduce<number>((sum, value) => sum + (value ?? 0), 0)
const trillion = (yi: number) => `${(yi / 10_000).toFixed(2)} 兆元`
const answer = computed(() => {
  const row = latest.value
  if (!row) return ''
  const sum = total(row)
  const share = (key: string) => `${(((row.values[key] ?? 0) / sum) * 100).toFixed(1)}%`
  return `${row.period} 的 M2 是 ${trillion(sum)}，最大的兩塊是存款貨幣（${share('deposit_money_total')}）與定期及定期儲蓄存款（${share('time_and_savings_deposits')}）。`
})
</script>

<template>
  <section class="stock-page-section" aria-labelledby="macro-composition-heading">
    <h2 id="macro-composition-heading" class="stock-page-section__title">M2 是由哪些錢組成的？</h2>
    <p class="hub-answer">{{ answer }}</p>
    <SharedChartCard :period="period">
      <StockStackedBarChart
        :categories="shown.map(row => row.period)"
        :layers="layers"
        unit="兆元"
        total-name="M2"
        :value-formatter="value => `${value.toFixed(2)} 兆元`"
        :tooltip-header="index => `${shown[index]?.period}　M2 ${trillion(total(shown[index]!))}`"
      />
    </SharedChartCard>
  </section>
</template>
