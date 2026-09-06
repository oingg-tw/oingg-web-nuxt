<script setup lang="ts">
// 會計模式 shell — per direct request ("會計模式 先來三表的表格，因為我力求呈現與財報一致"),
// this renders the three statements' REAL line-item structure/labels (matching how TWSE-listed
// companies' 資產負債表/損益表/現金流量表 are actually laid out on MOPS 公開資訊觀測站), not a
// generic placeholder shape — but every value cell is still just "－", no fabricated numbers,
// since bff-ts/analysis-ts has no per-stock three-statement endpoint yet (grep confirms zero
// hits for anything resembling one, same "no real source yet" situation as StockChartShell.vue's
// river/EPS/revenue shells). Two period columns (本期/去年同期) because a real financial
// statement is always presented with a prior-period comparison, never a single bare column.
interface StatementRow {
  label: string
  indent?: boolean
  emphasis?: boolean
}

const BALANCE_SHEET: StatementRow[] = [
  { label: '流動資產', emphasis: true },
  { label: '現金及約當現金', indent: true },
  { label: '應收帳款', indent: true },
  { label: '存貨', indent: true },
  { label: '其他流動資產', indent: true },
  { label: '流動資產合計', emphasis: true },
  { label: '非流動資產', emphasis: true },
  { label: '不動產、廠房及設備', indent: true },
  { label: '無形資產', indent: true },
  { label: '其他非流動資產', indent: true },
  { label: '非流動資產合計', emphasis: true },
  { label: '資產總計', emphasis: true },
  { label: '流動負債', emphasis: true },
  { label: '短期借款', indent: true },
  { label: '應付帳款', indent: true },
  { label: '其他流動負債', indent: true },
  { label: '流動負債合計', emphasis: true },
  { label: '非流動負債', emphasis: true },
  { label: '長期借款', indent: true },
  { label: '其他非流動負債', indent: true },
  { label: '非流動負債合計', emphasis: true },
  { label: '負債總計', emphasis: true },
  { label: '股本', indent: true },
  { label: '資本公積', indent: true },
  { label: '保留盈餘', indent: true },
  { label: '其他權益', indent: true },
  { label: '權益總計', emphasis: true },
  { label: '負債及權益總計', emphasis: true }
]

const INCOME_STATEMENT: StatementRow[] = [
  { label: '營業收入' },
  { label: '營業成本' },
  { label: '營業毛利', emphasis: true },
  { label: '推銷費用', indent: true },
  { label: '管理費用', indent: true },
  { label: '研究發展費用', indent: true },
  { label: '營業費用合計', emphasis: true },
  { label: '營業利益', emphasis: true },
  { label: '利息收入', indent: true },
  { label: '利息費用', indent: true },
  { label: '其他收入', indent: true },
  { label: '稅前淨利', emphasis: true },
  { label: '所得稅費用' },
  { label: '本期淨利', emphasis: true },
  { label: '每股盈餘（元）', emphasis: true }
]

const CASH_FLOW_STATEMENT: StatementRow[] = [
  { label: '本期稅前淨利', indent: true },
  { label: '折舊費用', indent: true },
  { label: '攤銷費用', indent: true },
  { label: '營運資金變動', indent: true },
  { label: '營業活動之淨現金流入（出）', emphasis: true },
  { label: '取得不動產、廠房及設備', indent: true },
  { label: '處分不動產、廠房及設備', indent: true },
  { label: '投資活動之淨現金流入（出）', emphasis: true },
  { label: '舉借長短期借款', indent: true },
  { label: '償還長短期借款', indent: true },
  { label: '發放現金股利', indent: true },
  { label: '籌資活動之淨現金流入（出）', emphasis: true },
  { label: '本期現金及約當現金增加（減少）數', emphasis: true },
  { label: '期初現金及約當現金餘額' },
  { label: '期末現金及約當現金餘額', emphasis: true }
]

const TABS: { key: string; label: string; rows: StatementRow[] }[] = [
  { key: 'balance-sheet', label: '資產負債表', rows: BALANCE_SHEET },
  { key: 'income-statement', label: '損益表', rows: INCOME_STATEMENT },
  { key: 'cash-flow-statement', label: '現金流量表', rows: CASH_FLOW_STATEMENT }
]

const activeTab = ref(TABS[0]!.key)
const activeRows = computed(() => TABS.find(tab => tab.key === activeTab.value)!.rows)

function rowClassName({ row }: { row: StatementRow }) {
  return row.emphasis ? 'statement-row--emphasis' : ''
}
</script>

<template>
  <el-card class="financial-statements-card" shadow="never">
    <template #header>
      <div class="financial-statements-card__header">
        <span class="financial-statements-card__title">三大財務報表</span>
        <el-radio-group v-model="activeTab" size="small">
          <el-radio-button v-for="tab in TABS" :key="tab.key" :value="tab.key">{{ tab.label }}</el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <el-table :data="activeRows" size="small" :row-class-name="rowClassName" :show-header="false">
      <el-table-column>
        <template #default="{ row }">
          <span :class="{ 'financial-statements-card__indent': row.indent }">{{ row.label }}</span>
        </template>
      </el-table-column>
      <el-table-column label="本期" align="right" width="110">
        <template #default>－</template>
      </el-table-column>
      <el-table-column label="去年同期" align="right" width="110">
        <template #default>－</template>
      </el-table-column>
    </el-table>

    <p class="financial-statements-card__note">資料尚未提供</p>
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
