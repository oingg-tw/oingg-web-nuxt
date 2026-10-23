<script setup lang="ts">
import type { DividendHistoryEntry } from '#shared/types/dividend-history'

// 歷年股利發放紀錄 — the server-rendered table behind「{短名}歷年配了多少股利？」on the 配股配息
// page (2026-09-19, the SEO build), from 業務中台's GET /stocks/:symbol/dividend-history (shipped the
// same day on this app's request; see shared/types/dividend-history.ts for the semantics). One row
// per 股利所屬年度, newest first. Columns that are null for every row（除息前殖利率 for most
// companies — twse-ts only has prices from 2026-06）are left out rather than shown as a column of
// dashes. A quarterly payer's four resolutions are summed into the year row（配息次數 says so）.
// 殖利率 2026-10-23 起除以除息前最後一個交易日的收盤價（使用者拿 6741 跟券商比：「改成除以除息前一天的收盤價」；原本除以除息
// 當天、已除息的收盤價，會偏高）

const props = defineProps<{
  entries: DividendHistoryEntry[]
  // 表名：<caption>（visually-hidden）與捲動區的 accessible name 共用（2026-10-13 統一）
  label: string
}>()

const rows = computed(() => [...props.entries].sort((a, b) => b.fiscalYear - a.fiscalYear))
const showYield = computed(() => rows.value.some(row => row.yieldOnPreviousClose != null))
const showStock = computed(() => rows.value.some(row => row.stockDividend !== null && row.stockDividend !== 0))
// 配股發放日（2026-10-20 起才有、不回補）：有一列有值才多一欄，「發放日」那一欄同時改叫「現金發放日」——paymentDate 只代表現金
const showStockDistribution = computed(() => rows.value.some(row => row.stockDividendDistributionDate))

function money(value: number | null): string {
  return value === null ? '－' : value.toFixed(2)
}

function date(value: string | null): string {
  return value ?? '－'
}
</script>

<template>
  <SharedTable v-if="rows.length" :label="label" table-class="dividend-history-table">
    <thead>
      <tr>
        <th scope="col">股利所屬年度</th>
        <th scope="col" class="seo-table__num">現金股利（元）</th>
        <th v-if="showStock" scope="col" class="seo-table__num">股票股利（元）</th>
        <!-- 沒有股票股利時「合計」逐列等於「現金股利」，是一模一樣的一欄（2026-09-28「dividend 這一頁
             表格的資訊太多，請刪減」）。用的是既有的 showStock，不是新旗標——它本來就在管股票股利與除權日
             這兩欄，而合計會不會多出東西問的是同一件事。 -->
        <th v-if="showStock" scope="col" class="seo-table__num">合計（元）</th>
        <th scope="col" class="seo-table__num">現金股利發放率（%）</th>
        <th v-if="showYield" scope="col" class="seo-table__num">除息前殖利率（%）</th>
        <th scope="col">除息日</th>
        <th v-if="showStock" scope="col">除權日</th>
        <th scope="col">{{ showStockDistribution ? '現金發放日' : '發放日' }}</th>
        <th v-if="showStockDistribution" scope="col">配股發放日</th>
        <th scope="col" class="seo-table__num">配息次數</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.fiscalYear">
        <th scope="row">{{ row.fiscalYear }} 年</th>
        <td class="seo-table__num">{{ money(row.cashDividend) }}</td>
        <td v-if="showStock" class="seo-table__num">{{ money(row.stockDividend) }}</td>
        <td v-if="showStock" class="seo-table__num">{{ money(row.totalDividend) }}</td>
        <td class="seo-table__num">{{ money(row.payoutRatio) }}</td>
        <td v-if="showYield" class="seo-table__num">{{ money(row.yieldOnPreviousClose ?? null) }}</td>
        <td>{{ date(row.exDividendDate) }}</td>
        <td v-if="showStock">{{ date(row.exRightsDate) }}</td>
        <td>{{ date(row.paymentDate) }}</td>
        <td v-if="showStockDistribution">{{ date(row.stockDividendDistributionDate ?? null) }}</td>
        <td class="seo-table__num">{{ row.distributionCount }}</td>
      </tr>
    </tbody>
  </SharedTable>
</template>

