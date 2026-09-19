<script setup lang="ts">
import type { PeerValuesResponse } from '#shared/types/stock-context'
import { columnLabelFrom } from '~/composables/screener/useFilterSchema'

// 同業比較表 — the company and its supply-chain peers side by side on five objective fields
// (2026-09-19, the SEO build; data from /api/stock/:code/context, one cached POST /screener/values).
// The company's own row leads and is bold; the rest sort by 代號. Every peer's 代號 links to its
// own stock page — the strongest unique content on the index page, and the internal links that
// tie a sector's stock pages together. Values are bff-ts's decimal strings parsed once, two
// decimals, null →「－」.
const props = defineProps<{
  symbol: string
  values: PeerValuesResponse | null
  caption: string
}>()

const columns = computed(() => props.values?.columns ?? [])

const rows = computed(() => {
  const results = props.values?.results ?? []
  const self = results.filter(row => row.symbol === props.symbol)
  const peers = results.filter(row => row.symbol !== props.symbol).sort((a, b) => a.symbol.localeCompare(b.symbol))
  return [...self, ...peers]
})

function cell(row: PeerValuesResponse['results'][number], field: string): string {
  const raw = row.values[field]?.value
  if (raw === null || raw === undefined) return '－'
  const number = Number(raw)
  return Number.isFinite(number) ? number.toFixed(2) : raw
}

function heading(column: PeerValuesResponse['columns'][number]): string {
  const label = columnLabelFrom(column.metricName, column.fieldName)
  return column.unit ? `${label.replace(/）$/, `，${column.unit}）`)}` : label
}
</script>

<template>
  <SharedTableScroll v-if="rows.length && columns.length" :label="caption">
    <table class="seo-table" data-ssr-table>
      <caption class="peer-table__caption">{{ caption }}（{{ rows.length }} 家）</caption>
      <thead>
        <tr>
          <th scope="col">代號</th>
          <th scope="col">名稱</th>
          <th v-for="column in columns" :key="column.field" scope="col" class="seo-table__num">{{ heading(column) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.symbol" :class="{ 'is-latest': row.symbol === symbol }">
          <th scope="row">
            <NuxtLink v-if="row.symbol !== symbol" :to="`/stock/${row.symbol}`" class="seo-table__link">{{ row.symbol }}</NuxtLink>
            <template v-else>{{ row.symbol }}</template>
          </th>
          <td>{{ row.name }}</td>
          <td v-for="column in columns" :key="column.field" class="seo-table__num">{{ cell(row, column.field) }}</td>
        </tr>
      </tbody>
    </table>
  </SharedTableScroll>
</template>

<style scoped>
.peer-table__caption {
  padding: 0 0 8px;
  text-align: left;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  caption-side: top;
}
</style>
