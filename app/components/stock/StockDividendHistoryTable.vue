<script setup lang="ts">
import type { DividendHistoryEntry } from '#shared/types/dividend-history'

// 歷年股利發放紀錄 — the server-rendered table behind「{短名}歷年配了多少股利？」on the 配股配息
// page (2026-09-19, the SEO build), from bff-ts's GET /stocks/:symbol/dividend-history (shipped the
// same day on this app's request; see shared/types/dividend-history.ts for the semantics). One row
// per 股利所屬年度, newest first. Columns that are null for every row（除息日殖利率 for most
// companies — twse-ts only has prices from 2026-06）are left out rather than shown as a column of
// dashes. A quarterly payer's four resolutions are summed into the year row（配息次數 says so）.
const props = defineProps<{
  entries: DividendHistoryEntry[]
  caption: string
  label?: string
}>()

const rows = computed(() => [...props.entries].sort((a, b) => b.fiscalYear - a.fiscalYear))
const showYield = computed(() => rows.value.some(row => row.yieldAtExDate !== null))
const showStock = computed(() => rows.value.some(row => row.stockDividend !== null && row.stockDividend !== 0))

function money(value: number | null): string {
  return value === null ? '－' : value.toFixed(2)
}

function date(value: string | null): string {
  return value ?? '－'
}
</script>

<template>
  <SharedTableScroll v-if="rows.length" :label="label ?? caption">
    <table class="seo-table dividend-history-table" data-ssr-table>
      <caption class="dividend-history-table__caption">{{ caption }}（{{ rows[rows.length - 1]!.fiscalYear }}–{{ rows[0]!.fiscalYear }} 年，共 {{ rows.length }} 個年度）</caption>
      <thead>
        <tr>
          <th scope="col">股利所屬年度</th>
          <th scope="col" class="seo-table__num">現金股利（元）</th>
          <th v-if="showStock" scope="col" class="seo-table__num">股票股利（元）</th>
          <th scope="col" class="seo-table__num">合計（元）</th>
          <th scope="col" class="seo-table__num">現金股利發放率（%）</th>
          <th v-if="showYield" scope="col" class="seo-table__num">除息日殖利率（%）</th>
          <th scope="col">除息日</th>
          <th v-if="showStock" scope="col">除權日</th>
          <th scope="col">發放日</th>
          <th scope="col" class="seo-table__num">配息次數</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.fiscalYear">
          <th scope="row">{{ row.fiscalYear }} 年</th>
          <td class="seo-table__num">{{ money(row.cashDividend) }}</td>
          <td v-if="showStock" class="seo-table__num">{{ money(row.stockDividend) }}</td>
          <td class="seo-table__num">{{ money(row.totalDividend) }}</td>
          <td class="seo-table__num">{{ money(row.payoutRatio) }}</td>
          <td v-if="showYield" class="seo-table__num">{{ money(row.yieldAtExDate) }}</td>
          <td>{{ date(row.exDividendDate) }}</td>
          <td v-if="showStock">{{ date(row.exRightsDate) }}</td>
          <td>{{ date(row.paymentDate) }}</td>
          <td class="seo-table__num">{{ row.distributionCount }}</td>
        </tr>
      </tbody>
    </table>
  </SharedTableScroll>
</template>

<style scoped>
.dividend-history-table__caption {
  padding: 0 0 8px;
  text-align: left;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  caption-side: top;
}
</style>
