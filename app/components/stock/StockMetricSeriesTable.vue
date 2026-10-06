<script setup lang="ts">
import type { MetricsHistorySeries } from '#shared/types/metrics-history'
import type { SeriesTableColumn, SeriesTableOptions } from '~/utils/stock-series-table'
import { buildSeriesTableRows, columnHeading } from '~/utils/stock-series-table'

// A server-rendered <table> of metric history (2026-09-19, the SEO build) — the document-style
// counterpart to the per-metric chart cards: one table per page section, every number a crawler
// can read and a screen reader can navigate by row/column header. Rows are periods（newest first）
// or, in `periods-as-columns` layout, metrics（the 逐年 table on 指標歷史）. Depth is whatever the
// data has（「近 23 季」for 2330, 6 for a company backfilled since 2025Q1）— never a fixed number.
//
// Values come from the page's series payload（useStockPageDigest's `series`）through the pure
// builders in stock-series-table.ts, so the SSR text equals the hydrated text（the check scripts'
// `tables stable` assertion）. Nulls read「－」with the reason in the cell's title, or「不適用」
// when the metric's model excludes the company's industry.
const props = withDefaults(
  defineProps<{
    // Visible <caption>（the「近 N 季」suffix is added here）.
    caption: string
    // The scroll region's accessible name（SharedTableScroll adds「，可左右捲動」）.
    label?: string
    columns: SeriesTableColumn[]
    groups: Record<string, MetricsHistorySeries | null>
    layout?: 'periods-as-rows' | 'periods-as-columns'
    annual?: boolean
    latestFirst?: boolean
    maxPeriods?: number
  }>(),
  { label: undefined, layout: 'periods-as-rows', annual: false, latestFirst: true, maxPeriods: undefined }
)

const rows = computed(() => {
  const options: SeriesTableOptions = { annual: props.annual, latestFirst: props.layout === 'periods-as-rows' ? props.latestFirst : false, maxPeriods: props.maxPeriods }
  return buildSeriesTableRows(props.groups, props.columns, options)
})

// 「近 23 季」for quarterly rows;「6 個年度＋最新一季」in 逐年 mode（the trailing non-Q4 column is
// a quarter, not a seventh year）; plain「N 年」for an all-annual（FY）series.
const captionText = computed(() => {
  const count = rows.value.length
  if (props.annual) {
    const years = rows.value.filter(row => row.fiscalQuarter === 4).length
    return `${props.caption}（${years} 個年度${count > years ? '＋最新一季' : ''}）`
  }
  const unit = props.columns.every(column => column.timeframe === 'FY') ? '年' : '季'
  return `${props.caption}（近 ${count} ${unit}）`
})
</script>

<template>
  <SharedTableScroll v-if="rows.length" :label="label ?? caption">
    <table class="seo-table stock-series-table" data-ssr-table>
      <caption class="stock-series-table__caption">{{ captionText }}</caption>
      <thead v-if="layout === 'periods-as-rows'">
        <tr>
          <th scope="col">期別</th>
          <th v-for="column in columns" :key="column.code" scope="col" class="seo-table__num">{{ columnHeading(column) }}</th>
        </tr>
      </thead>
      <thead v-else>
        <tr>
          <th scope="col">指標</th>
          <th v-for="row in rows" :key="row.key" scope="col" class="seo-table__num" :class="{ 'is-latest': row.isLatest }">{{ row.label }}</th>
        </tr>
      </thead>
      <tbody v-if="layout === 'periods-as-rows'">
        <tr v-for="row in rows" :key="row.key" :class="{ 'is-latest': row.isLatest }">
          <th scope="row">{{ row.label }}</th>
          <td v-for="cell in row.cells" :key="cell.code" class="seo-table__num" :title="cell.title">{{ cell.text }}</td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="(column, index) in columns" :key="column.code">
          <th scope="row">{{ columnHeading(column) }}</th>
          <td v-for="row in rows" :key="row.key" class="seo-table__num" :class="{ 'is-latest': row.isLatest }" :title="row.cells[index]?.title">{{ row.cells[index]?.text ?? '－' }}</td>
        </tr>
      </tbody>
    </table>
  </SharedTableScroll>
</template>

<style scoped>
.stock-series-table__caption {
  padding: 0 0 8px;
  text-align: left;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  caption-side: top;
}
</style>
