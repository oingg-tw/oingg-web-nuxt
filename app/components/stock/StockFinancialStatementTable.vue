<script setup lang="ts">
import type { FinancialStatementResponse, StatementType } from '#shared/types/financial-statement'
// One server-rendered statement（資產負債表／損益表／現金流量表）as a plain table: 科目 ｜ 當期 ｜
// 去年同期 ｜ 增減% (2026-09-19, the SEO build). The interactive period-picker card
// (StockFinancialStatementsCard.vue) stays for browsing other quarters; this is the page's own
// readable, crawlable copy of the latest filing. Amounts are 業務中台's bigint-precise strings with
// thousands separators added deterministically（no toLocaleString）.
// 2026-10-19 起列由 buildStatementLines 依 mops 的欄位中繼資料組（預設精簡、各段加「其他」、可展開全部科目，規則寫在那支的註解）
const props = withDefaults(
  defineProps<{
    title: string
    statementType: StatementType
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

const showAll = ref(false)
const built = computed(() => buildStatementLines(STATEMENT_COLUMNS, props.statementType, currentStatement.value, priorStatement.value, showAll.value))
const tableId = useId()
</script>

<template>
  <div class="statement-table">
    <h3 v-if="showTitle" class="statement-table__title">{{ title }}</h3>
    <!-- 單位原本寫在看得見的 caption（2026-10-13 caption 一律藏起來），改寫進欄位標題與不是千元那幾列的列名 -->
    <SharedTable v-if="currentStatement" :label="title" :table-id="tableId">
      <thead>
        <tr>
          <th scope="col">科目</th>
          <th scope="col" class="seo-table__num">{{ currentLabel }}（千元）</th>
          <th scope="col" class="seo-table__num">{{ priorLabel }}（千元）</th>
          <th scope="col" class="seo-table__num">增減（%）</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in built.lines" :key="line.key" :class="{ 'is-latest': line.total }">
          <th scope="row" :class="{ 'statement-table__indent': !line.total, 'statement-table__other': line.other }">
            {{ line.label }}<template v-if="line.unit !== '千元'">（{{ line.unit }}）</template>
          </th>
          <td class="seo-table__num">{{ formatStatementAmount(line.current) }}</td>
          <td class="seo-table__num">{{ formatStatementAmount(line.prior) }}</td>
          <td class="seo-table__num">{{ statementChangePercent(line.current, line.prior) }}</td>
        </tr>
      </tbody>
    </SharedTable>
    <p v-else class="stock-answer">{{ title }}：{{ currentLabel }}查無申報資料。</p>
    <!-- 預設只列主要科目（金額門檻），其餘併進各段的「其他」；這顆展開這家公司每一個有數字的科目 -->
    <el-button
      v-if="currentStatement && (built.hidden || showAll)"
      link
      type="primary"
      class="statement-table__toggle"
      :aria-expanded="showAll"
      :aria-controls="tableId"
      @click="showAll = !showAll"
    >
      {{ showAll ? '只看主要科目' : `顯示全部科目（另有 ${built.hidden} 項）` }}
    </el-button>
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

.statement-table__indent {
  padding-left: 28px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

/* 「其他」是算出來的（合計 − 已列的科目），用斜體跟申報的科目分開，不只靠顏色 */
.statement-table__other {
  font-style: italic;
}

.statement-table__toggle {
  align-self: flex-start;
  min-height: 44px;
  margin: 0;
}
</style>
