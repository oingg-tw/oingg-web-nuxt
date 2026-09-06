<script setup lang="ts">
// 會計模式's three-statement tables. Line-item labels/structure match how TWSE-listed
// companies' 資產負債表/損益表/現金流量表 actually lay out on MOPS; each row's `key` is the
// real bff-ts field name (GET /stocks/:symbol/financial-statement, confirmed live 2026-09-06 —
// see useFinancialStatement.ts's own comment). A row with no `key` is a pure section header
// (流動資產/流動負債/...) that never carries its own value in a real statement either — only
// its "XX合計" subtotal line does — so it renders blank value cells, not "－" (that's reserved
// for a real field that came back null, per bff-ts's "amounts can be null" contract).
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
  { label: '現金及約當現金', key: 'cashAndEquivalents', indent: true },
  { label: '應收帳款', key: 'accountsReceivable', indent: true },
  { label: '存貨', key: 'inventory', indent: true },
  { label: '流動資產合計', key: 'currentAssets', emphasis: true },
  { label: '非流動資產', emphasis: true },
  { label: '不動產、廠房及設備', key: 'propertyPlantEquipment', indent: true },
  { label: '採用權益法之投資', key: 'investmentsUnderEquityMethod', indent: true },
  { label: '無形資產', key: 'intangibleAssets', indent: true },
  { label: '非流動資產合計', key: 'nonCurrentAssets', emphasis: true },
  { label: '資產總計', key: 'totalAssets', emphasis: true },
  { label: '流動負債', emphasis: true },
  { label: '短期借款', key: 'shortTermBorrowings', indent: true },
  { label: '應付帳款', key: 'accountsPayable', indent: true },
  { label: '流動負債合計', key: 'currentLiabilities', emphasis: true },
  { label: '非流動負債', emphasis: true },
  { label: '應付公司債', key: 'bondsPayable', indent: true },
  { label: '長期借款', key: 'longTermBorrowings', indent: true },
  { label: '非流動負債合計', key: 'nonCurrentLiabilities', emphasis: true },
  { label: '負債總計', key: 'totalLiabilities', emphasis: true },
  { label: '股本', key: 'capitalStock', indent: true },
  { label: '特別股股本', key: 'preferredStockCapital', indent: true },
  { label: '特別股負債', key: 'preferredStockLiability', indent: true },
  { label: '資本公積', key: 'capitalSurplus', indent: true },
  { label: '保留盈餘', key: 'retainedEarnings', indent: true },
  { label: '其他權益', key: 'otherEquity', indent: true },
  { label: '庫藏股', key: 'treasuryStock', indent: true },
  { label: '歸屬於母公司業主之權益合計', key: 'equityAttributableToParent', emphasis: true },
  { label: '非控制權益', key: 'nonControllingInterest', indent: true },
  { label: '權益總計', key: 'totalEquity', emphasis: true },
  { label: '負債及權益總計', key: 'totalLiabilitiesAndEquity', emphasis: true }
]

const INCOME_STATEMENT: StatementRow[] = [
  { label: '營業收入', key: 'operatingRevenue' },
  { label: '營業成本', key: 'operatingCost' },
  { label: '營業毛利', key: 'grossProfit', emphasis: true },
  { label: '推銷費用', key: 'sellingExpenses', indent: true },
  { label: '管理費用', key: 'adminExpenses', indent: true },
  { label: '研究發展費用', key: 'rdExpenses', indent: true },
  { label: '營業費用合計', key: 'operatingExpenses', emphasis: true },
  { label: '營業利益', key: 'operatingIncome', emphasis: true },
  { label: '利息收入', key: 'interestIncome', indent: true },
  { label: '財務成本', key: 'financeCosts', indent: true },
  { label: '其他收入', key: 'otherIncome', indent: true },
  { label: '採用權益法認列關聯企業損益之份額', key: 'shareOfAssociatesJvProfit', indent: true },
  { label: '其他營業外損益', key: 'otherNonOperatingGainsLosses', indent: true },
  { label: '營業外收支合計', key: 'nonOperatingIncomeExpenses', emphasis: true },
  { label: '稅前淨利', key: 'profitBeforeTax', emphasis: true },
  { label: '所得稅費用', key: 'incomeTaxExpense', indent: true },
  { label: '本期淨利', key: 'netIncome', emphasis: true },
  { label: '歸屬於母公司業主淨利', key: 'netIncomeAttributableToParent', indent: true },
  { label: '歸屬於非控制權益淨利', key: 'netIncomeAttributableToNci', indent: true },
  { label: '其他綜合損益', key: 'otherComprehensiveIncome', indent: true },
  { label: '本期綜合損益總額', key: 'totalComprehensiveIncome', emphasis: true },
  { label: '基本每股盈餘（元）', key: 'eps', emphasis: true },
  { label: '稀釋每股盈餘（元）', key: 'epsDiluted', indent: true }
]

const CASH_FLOW_STATEMENT: StatementRow[] = [
  { label: '稅前淨利', key: 'profitBeforeTax', indent: true },
  { label: '折舊費用', key: 'depreciation', indent: true },
  { label: '攤銷費用', key: 'amortization', indent: true },
  { label: '其他調整項目合計', key: 'adjustmentsTotal', indent: true },
  { label: '營業活動產生之現金', key: 'cashGeneratedFromOperations', indent: true },
  { label: '支付所得稅', key: 'incomeTaxPaid', indent: true },
  { label: '營業活動之淨現金流入（出）', key: 'netCashFromOperatingActivities', emphasis: true },
  { label: '取得不動產、廠房及設備', key: 'capitalExpenditures', indent: true },
  { label: '處分不動產、廠房及設備價款', key: 'proceedsFromDisposalOfPpe', indent: true },
  { label: '取得無形資產', key: 'acquisitionOfIntangibleAssets', indent: true },
  { label: '收取利息', key: 'interestReceived', indent: true },
  { label: '收取股利', key: 'dividendsReceived', indent: true },
  { label: '投資活動之淨現金流入（出）', key: 'netCashFromInvestingActivities', emphasis: true },
  { label: '發行公司債', key: 'proceedsFromBondsIssued', indent: true },
  { label: '償還公司債', key: 'repaymentOfBonds', indent: true },
  { label: '舉借長期借款', key: 'proceedsFromLongTermBorrowings', indent: true },
  { label: '償還長期借款', key: 'repaymentOfLongTermBorrowings', indent: true },
  { label: '發放現金股利', key: 'dividendsPaid', indent: true },
  { label: '支付利息', key: 'interestPaid', indent: true },
  { label: '籌資活動之淨現金流入（出）', key: 'netCashFromFinancingActivities', emphasis: true },
  { label: '匯率變動影響數', key: 'exchangeRateEffect', indent: true },
  { label: '本期現金及約當現金增加（減少）數', key: 'netIncreaseInCash', emphasis: true },
  { label: '期初現金及約當現金餘額', key: 'cashBeginningBalance' },
  { label: '期末現金及約當現金餘額', key: 'cashEndingBalance', emphasis: true }
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

function rowClassName({ row }: { row: StatementRow }) {
  return row.emphasis ? 'statement-row--emphasis' : ''
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

    <el-table v-loading="currentPending || priorPending" :data="activeTab.rows" size="small" :row-class-name="rowClassName" :show-header="false">
      <el-table-column>
        <template #default="{ row }">
          <span :class="{ 'financial-statements-card__indent': row.indent }">{{ row.label }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="`${year}年 Q${quarter}`" align="right" width="130">
        <template #default="{ row }">{{ cellValue(row, current?.statement) }}</template>
      </el-table-column>
      <el-table-column :label="`${priorYear}年 Q${quarter}`" align="right" width="130">
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
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
