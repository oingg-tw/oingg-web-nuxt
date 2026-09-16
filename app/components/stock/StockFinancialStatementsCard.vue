<script setup lang="ts">
// 會計模式's three-statement tables. Line-item labels/structure match how TWSE-listed
// companies' 資產負債表/損益表/現金流量表 actually lay out on MOPS; each row's `key` is the
// real bff-ts field name (GET /stocks/:symbol/financial-statement). A row with no `key` is a
// pure section header (流動資產/流動負債/...) that never carries its own value in a real
// statement either — only its "XX合計" subtotal line does — so it renders blank value cells,
// not "－" (that's reserved for a real field that came back null, per bff-ts's "amounts can be
// null" contract).
//
// Real bug fixed 2026-09-10 (reported live: "會計模式損益表看不到內容") — every `key` below used
// to be a guessed camelCase name (operatingRevenue/grossProfit/...) that never matched anything
// bff-ts actually returns. Confirmed live via curl against all 3 statementTypes for 2330: the
// real payload keys are the raw XBRL/MOPS field names, snake_case (revenue/gross_profit/
// operating_costs/...), not a camelCase rename bff-ts never did. Every row's `key` below was
// re-derived directly off a real response instead of assumed — this was silently broken for
// every row on every statement, not just 損益表 (the user just happened to notice it there
// first). A handful of subtotal rows (特別股負債, income statement's OCI lines, cash flow's
// 稅前淨利/其他調整項目合計) have no single matching field in the real payload — rather than
// guess or hand-sum components into a number bff-ts never actually vouches for, those keep
// `key` unset and render blank, same as this file's own section-header convention above.
const props = defineProps<{
  symbol: string
}>()

interface StatementRow {
  label: string
  key?: string
  indent?: boolean
  emphasis?: boolean
}

const BALANCE_SHEET: StatementRow[] = [
  { label: '流動資產', emphasis: true },
  { label: '現金及約當現金', key: 'cash_and_cash_equivalents', indent: true },
  { label: '應收帳款', key: 'accounts_receivable_net', indent: true },
  { label: '存貨', key: 'inventories', indent: true },
  { label: '流動資產合計', key: 'current_assets', emphasis: true },
  { label: '非流動資產', emphasis: true },
  { label: '不動產、廠房及設備', key: 'property_plant_and_equipment', indent: true },
  { label: '採用權益法之投資', key: 'investment_using_equity_method', indent: true },
  { label: '無形資產', key: 'intangible_assets_and_goodwill', indent: true },
  { label: '非流動資產合計', key: 'noncurrent_assets', emphasis: true },
  { label: '資產總計', key: 'assets', emphasis: true },
  { label: '流動負債', emphasis: true },
  { label: '短期借款', key: 'shortterm_borrowings', indent: true },
  // No combined "accounts_payable" field in the real payload — only split by counterparty
  // (trade_payables_to_trade_suppliers / _to_related_parties). Suppliers is the dominant figure.
  { label: '應付帳款', key: 'trade_payables_to_trade_suppliers', indent: true },
  { label: '流動負債合計', key: 'current_liabilities', emphasis: true },
  { label: '非流動負債', emphasis: true },
  { label: '應付公司債', key: 'noncurrent_portion_of_bonds_issued', indent: true },
  { label: '長期借款', key: 'longterm_borrowings', indent: true },
  { label: '非流動負債合計', key: 'noncurrent_liabilities', emphasis: true },
  { label: '負債總計', key: 'liabilities', emphasis: true },
  { label: '股本', key: 'ordinary_share', indent: true },
  { label: '特別股股本', key: 'preference_share', indent: true },
  { label: '資本公積', key: 'capital_reserve', indent: true },
  { label: '保留盈餘', key: 'retained_earnings', indent: true },
  { label: '其他權益', key: 'other_equity_interest', indent: true },
  { label: '庫藏股', key: 'treasury_shares', indent: true },
  { label: '歸屬於母公司業主之權益合計', key: 'equity_attributable_to_owners_of_parent', emphasis: true },
  { label: '非控制權益', key: 'noncontrolling_interests', indent: true },
  { label: '權益總計', key: 'equity', emphasis: true },
  // No separate "assets = liabilities + equity" field either — reuses `assets` itself, a real
  // accounting identity (this line always equals total assets), not a guess.
  { label: '負債及權益總計', key: 'assets', emphasis: true }
]

const INCOME_STATEMENT: StatementRow[] = [
  { label: '營業收入', key: 'revenue' },
  { label: '營業成本', key: 'operating_costs' },
  { label: '營業毛利', key: 'gross_profit', emphasis: true },
  { label: '推銷費用', key: 'selling_expense', indent: true },
  { label: '管理費用', key: 'administrative_expense', indent: true },
  { label: '研究發展費用', key: 'research_and_development_expense', indent: true },
  { label: '營業費用合計', key: 'operating_expense', emphasis: true },
  { label: '營業利益', key: 'profit_loss_from_operating_activities', emphasis: true },
  { label: '利息收入', key: 'revenue_from_interest', indent: true },
  { label: '財務成本', key: 'finance_costs', indent: true },
  { label: '其他收入', key: 'other_revenue', indent: true },
  { label: '採用權益法認列關聯企業損益之份額', key: 'share_of_profit_loss_of_associates_and_jvs', indent: true },
  { label: '其他營業外損益', key: 'other_gains_losses', indent: true },
  { label: '營業外收支合計', key: 'nonoperating_income_and_expenses', emphasis: true },
  { label: '稅前淨利', key: 'profit_loss_before_tax', emphasis: true },
  { label: '所得稅費用', key: 'income_tax_expense_continuing_operations', indent: true },
  { label: '本期淨利', key: 'profit_loss', emphasis: true },
  { label: '歸屬於母公司業主淨利', key: 'profit_loss_attributable_to_owners_of_parent', indent: true },
  { label: '歸屬於非控制權益淨利', key: 'profit_loss_attributable_to_noncontrolling_interests', indent: true },
  // No single "OCI total" field in the real payload, only its components
  // (oci_will_be_reclassified_net_of_tax / oci_will_not_be_reclassified_net_of_tax) — left
  // unmapped rather than hand-summed into a number bff-ts never itself vouches for.
  { label: '其他綜合損益', indent: true },
  { label: '本期綜合損益總額', emphasis: true },
  { label: '基本每股盈餘（元）', key: 'basic_earnings_loss_per_share', emphasis: true },
  { label: '稀釋每股盈餘（元）', key: 'diluted_earnings_loss_per_share', indent: true }
]

const CASH_FLOW_STATEMENT: StatementRow[] = [
  // No standalone "稅前淨利"/"其他調整項目合計" fields in the real cash-flow payload (it starts
  // straight from the reconciling adjustment line items themselves) — left unmapped rather than
  // guessed or hand-summed.
  { label: '稅前淨利', indent: true },
  { label: '折舊費用', key: 'adj_depreciation_expense', indent: true },
  { label: '攤銷費用', key: 'adj_amortisation_expense', indent: true },
  { label: '其他調整項目合計', indent: true },
  { label: '營業活動產生之現金', key: 'cash_flows_from_used_in_operations', indent: true },
  { label: '支付所得稅', key: 'income_taxes_paid_refund_operating', indent: true },
  { label: '營業活動之淨現金流入（出）', key: 'cash_flows_from_used_in_operating_activities', emphasis: true },
  { label: '取得不動產、廠房及設備', key: 'purchase_of_ppe_investing', indent: true },
  { label: '處分不動產、廠房及設備價款', key: 'proceeds_from_sales_of_ppe_investing', indent: true },
  { label: '取得無形資產', key: 'purchase_of_intangible_assets_investing', indent: true },
  { label: '收取利息', key: 'interest_received_investing', indent: true },
  { label: '收取股利', key: 'dividends_received_investing', indent: true },
  { label: '投資活動之淨現金流入（出）', key: 'net_cash_flows_from_used_in_investing_activities', emphasis: true },
  { label: '發行公司債', key: 'proceeds_from_issuing_bonds', indent: true },
  { label: '償還公司債', key: 'repayments_of_bonds', indent: true },
  { label: '舉借長期借款', key: 'proceeds_from_long_term_debt', indent: true },
  { label: '償還長期借款', key: 'repayments_of_long_term_debt', indent: true },
  { label: '發放現金股利', key: 'dividends_paid_financing', indent: true },
  { label: '支付利息', key: 'interest_paid_financing', indent: true },
  { label: '籌資活動之淨現金流入（出）', key: 'cash_flows_from_used_in_financing_activities', emphasis: true },
  { label: '匯率變動影響數', key: 'effect_of_exchange_rate_changes_on_cash_and_cash_equivalents', indent: true },
  { label: '本期現金及約當現金增加（減少）數', key: 'increase_decrease_in_cash_and_cash_equivalents', emphasis: true },
  { label: '期初現金及約當現金餘額', key: 'cash_and_cash_equivalents_at_beginning_of_period' },
  { label: '期末現金及約當現金餘額', key: 'cash_and_cash_equivalents_at_end_of_period', emphasis: true }
]

const TABS: { key: StatementType; label: string; rows: StatementRow[] }[] = [
  { key: 'balanceSheet', label: '資產負債表', rows: BALANCE_SHEET },
  { key: 'incomeStatement', label: '損益表', rows: INCOME_STATEMENT },
  { key: 'cashFlowStatement', label: '現金流量表', rows: CASH_FLOW_STATEMENT }
]

const activeTabKey = ref<StatementType>(TABS[0]!.key)
const activeTab = computed(() => TABS.find(tab => tab.key === activeTabKey.value)!)

const { year, quarter } = useStockPeriodSelection()
const priorYear = computed(() => year.value - 1)
const symbolRef = computed(() => props.symbol)

const { data: current, pending: currentPending } = useFinancialStatement(symbolRef, activeTabKey, year, quarter)
const { data: prior, pending: priorPending } = useFinancialStatement(symbolRef, activeTabKey, priorYear, quarter)

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

// Real 財報 conventions, not just "Q{n}": 資產負債表 is a snapshot AS OF the quarter-end date
// (no start date makes sense for a balance), while 損益表/現金流量表 are cumulative from the
// FISCAL YEAR START through quarter-end (累計數) — a Q3 filing's income statement covers
// Jan–Sep, not just Jul–Sep, per how every ROC-listed company's quarterly filing is actually
// structured (Q1's cumulative period happens to equal its single quarter, since the year just
// started). This is a property of the filings themselves, not a bff-ts representation choice.
function quarterEndDate(targetYear: number, targetQuarter: number): { month: number; day: number } {
  const endMonth = targetQuarter * 3
  const day = new Date(targetYear, endMonth, 0).getDate()
  return { month: endMonth, day }
}

function periodLabel(targetYear: number, targetQuarter: number, statementType: StatementType): string {
  const end = quarterEndDate(targetYear, targetQuarter)
  const endLabel = `${pad(end.month)}/${pad(end.day)}`
  if (statementType === 'balanceSheet') return `${targetYear}年${endLabel}`
  return `${targetYear}年01/01–${endLabel}`
}

const currentPeriodLabel = computed(() => periodLabel(year.value, quarter.value, activeTabKey.value))
const priorPeriodLabel = computed(() => periodLabel(priorYear.value, quarter.value, activeTabKey.value))

function formatAmount(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '－'
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  return value.toLocaleString('zh-TW')
}

function cellValue(row: StatementRow, statement: Record<string, string | null> | null | undefined): string {
  if (!row.key) return ''
  if (!statement) return '－'
  return formatAmount(statement[row.key])
}

// Receiving end of useStatementRowFocus.ts's jumpToStatementRow() — frontend groundwork for the
// "trace a badge's number back to the original filing" feature (2026-09-10 plan), built ahead
// of the still-pending provenance API from analysis-ts so the plumbing is ready the moment a
// real caller (a future badge-dialog "查看計算依據" link) exists. No caller wires into this yet.
const { focusRequest } = useStatementRowFocus()
const tableRef = ref<{ $el: HTMLElement } | null>(null)
const highlightedRowKey = ref<string | null>(null)
let highlightTimeout: ReturnType<typeof setTimeout> | null = null

// Real bug caught live 2026-09-10: jumpToStatementRow() sets `mode` (which mounts this whole
// component for the first time, since 會計模式 replaces the card view rather than layering on
// top of it) and writes focusRequest in the same synchronous call, before Vue has had a chance
// to actually mount this component and register the watch() below — a plain (non-immediate)
// watch never sees a value that was already sitting in the ref the moment it started watching,
// so the very first jump silently landed on whatever tab happened to be default (資產負債表)
// instead of the requested one. `immediate: true` also runs the callback once on mount with
// whatever focusRequest already holds (harmless `null` on every normal, non-jump mount).
watch(focusRequest, async request => {
  if (!request) return
  activeTabKey.value = request.statementType
  await nextTick()
  const rowIndex = activeTab.value.rows.findIndex(row => row.key === request.rowKey)
  if (rowIndex === -1) {
    // Fallback for a fieldKey with no matching row in this statement's own list (shouldn't
    // happen for the current pilot metricCodes, but provenance data is backend-owned and could
    // ship a key this file hasn't added yet) — at minimum bring the accounting section itself
    // into view instead of leaving the user wherever 卡片 mode had them scrolled to, since that
    // position may now point at nothing (會計模式 replaces the whole card-view content).
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  highlightedRowKey.value = request.rowKey
  if (highlightTimeout) clearTimeout(highlightTimeout)
  // 2s, then fade back out via the transition on .statement-row--highlighted below — long enough
  // to register as "this is the row" without staying tinted indefinitely.
  highlightTimeout = setTimeout(() => { highlightedRowKey.value = null }, 2000)
  // Reaching into el-table's own rendered DOM for a specific row — same established pattern as
  // EtfResultTable.vue's own load-more sentinel (see that file's own comment), since el-table
  // exposes no "scroll to row by key" API of its own.
  // Real bug caught live 2026-09-10: calling scrollIntoView() here immediately (even after
  // nextTick, even with `behavior: 'instant'`) silently failed to move the scroll position —
  // confirmed via devtools that the exact same call on the exact same (live, connected) element
  // succeeds when fired from a separate later task. Root cause: this row-focus jump lands right
  // after several other reactive changes settle in the same rendering window (mode switch,
  // activeTabKey switch, the fetch's own loading-state flip) — some further layout shift lands
  // shortly after our own scroll, and Chromium's scroll-anchoring feature (which exists
  // specifically to counteract scroll position changing under the user when content above
  // shifts) then "corrects" the position straight back. A short delay lets that settle first.
  setTimeout(() => {
    const rowEls = tableRef.value?.$el.querySelectorAll('.el-table__body .el-table__row')
    rowEls?.[rowIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 150)
}, { immediate: true })

onBeforeUnmount(() => {
  if (highlightTimeout) clearTimeout(highlightTimeout)
})

function rowClassName({ row }: { row: StatementRow }) {
  const classes: string[] = []
  if (row.emphasis) classes.push('statement-row--emphasis')
  if (row.key && row.key === highlightedRowKey.value) classes.push('statement-row--highlighted')
  return classes.join(' ')
}
</script>

<template>
  <el-card class="financial-statements-card" shadow="never">
    <template #header>
      <div class="financial-statements-card__header">
        <span class="financial-statements-card__title">三大財務報表</span>
        <el-select v-model="activeTabKey" size="small" class="financial-statements-card__tab-select">
          <el-option v-for="tab in TABS" :key="tab.key" :value="tab.key" :label="tab.label" />
        </el-select>
      </div>
    </template>

    <el-table ref="tableRef" v-loading="currentPending || priorPending" :data="activeTab.rows" size="small" :row-class-name="rowClassName">
      <el-table-column label="科目" min-width="280">
        <template #default="{ row }">
          <span :class="{ 'financial-statements-card__indent': row.indent }">{{ row.label }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="currentPeriodLabel" align="right" min-width="200">
        <template #default="{ row }">{{ cellValue(row, current?.statement) }}</template>
      </el-table-column>
      <el-table-column :label="priorPeriodLabel" align="right" min-width="200">
        <template #default="{ row }">{{ cellValue(row, prior?.statement) }}</template>
      </el-table-column>
    </el-table>

    <p v-if="current && !current.found" class="financial-statements-card__note">
      {{ year }}年第{{ quarter }}季查無此標的申報資料
    </p>
    <p v-else-if="prior && !prior.found" class="financial-statements-card__note">
      {{ priorYear }}年第{{ quarter }}季查無此標的申報資料（前期比較欄位顯示為 －）
    </p>
  </el-card>
</template>

<style scoped>
.financial-statements-card {
  border-radius: 12px;
}

/* Pulse marking the row a useStatementRowFocus.ts jump landed on — transition lives on the
   persistent selector (not the highlight class itself) so removing the class after the 2s
   timeout in the script above fades smoothly back to normal instead of snapping off. Same
   primary-tint language as the badge formula box's own background (2026-09-10). */
.financial-statements-card :deep(.el-table__row) {
  transition: background-color 0.6s ease;
}

.financial-statements-card :deep(.statement-row--highlighted td) {
  background-color: var(--el-color-primary-light-9);
}

.financial-statements-card__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.financial-statements-card__title {
  font-weight: 600;
}

.financial-statements-card__tab-select {
  width: 140px;
}

.financial-statements-card__indent {
  padding-left: 16px;
  color: var(--el-text-color-secondary);
}

.financial-statements-card :deep(.statement-row--emphasis td) {
  font-weight: 600;
}

.financial-statements-card__note {
  margin: 12px 0 0;
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
