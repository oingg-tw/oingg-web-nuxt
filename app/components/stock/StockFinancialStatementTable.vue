<script setup lang="ts">
import type { FinancialStatementResponse } from '#shared/types/financial-statement'
import type { StatementRow } from '~/utils/financial-statement-rows'
import { PER_SHARE_KEYS, formatStatementAmount, statementChangePercent } from '~/utils/financial-statement-rows'

// One server-rendered statement（資產負債表／損益表／現金流量表）as a plain table: 科目 ｜ 當期 ｜
// 去年同期 ｜ 增減% (2026-09-19, the SEO build). The interactive period-picker card
// (StockFinancialStatementsCard.vue) stays for browsing other quarters; this is the page's own
// readable, crawlable copy of the latest filing. Section-header rows（no `key`）render blank
// value cells, exactly as on the card; amounts are bff-ts's bigint-precise strings with thousands
// separators added deterministically（no toLocaleString）.
const props = withDefaults(
  defineProps<{
    title: string
    rows: StatementRow[]
    current: FinancialStatementResponse | null
    prior: FinancialStatementResponse | null
    currentLabel: string
    priorLabel: string
    // Off when the page already names the statement in its own section heading.
    showTitle?: boolean
  }>(),
  { showTitle: true }
)

const currentStatement = computed(() => (props.current?.found ? props.current.statement : null))
const priorStatement = computed(() => (props.prior?.found ? props.prior.statement : null))

function amount(row: StatementRow, statement: Record<string, string | null> | null): string {
  if (!row.key) return ''
  if (!statement) return '－'
  return formatStatementAmount(statement[row.key])
}

function change(row: StatementRow): string {
  if (!row.key || !currentStatement.value || !priorStatement.value) return row.key ? '－' : ''
  return statementChangePercent(currentStatement.value[row.key], priorStatement.value[row.key])
}

function unitOf(row: StatementRow): string {
  return row.key && PER_SHARE_KEYS.has(row.key) ? '元' : '千元'
}
</script>

<template>
  <div class="statement-table">
    <h3 v-if="showTitle" class="statement-table__title">{{ title }}</h3>
    <SharedTableScroll v-if="currentStatement" :label="title">
      <table class="seo-table" data-ssr-table>
        <caption class="statement-table__caption">{{ title }}：{{ currentLabel }} 與 {{ priorLabel }}；單位新台幣千元，每股盈餘為元</caption>
        <thead>
          <tr>
            <th scope="col">科目</th>
            <th scope="col" class="seo-table__num">{{ currentLabel }}</th>
            <th scope="col" class="seo-table__num">{{ priorLabel }}</th>
            <th scope="col" class="seo-table__num">增減（%）</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="`${row.label}-${index}`" :class="{ 'is-latest': row.emphasis }">
            <th scope="row" :class="{ 'statement-table__indent': row.indent }">{{ row.label }}<span v-if="row.key && unitOf(row) === '元'" class="visually-hidden">（元）</span></th>
            <td class="seo-table__num">{{ amount(row, currentStatement) }}</td>
            <td class="seo-table__num">{{ amount(row, priorStatement) }}</td>
            <td class="seo-table__num">{{ change(row) }}</td>
          </tr>
        </tbody>
      </table>
    </SharedTableScroll>
    <p v-else class="stock-answer">{{ title }}：{{ currentLabel }}查無申報資料。</p>
  </div>
</template>

<style scoped>
.statement-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.statement-table__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.statement-table__caption {
  padding: 0 0 8px;
  text-align: left;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  caption-side: top;
}

.statement-table__indent {
  padding-left: 28px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
</style>
