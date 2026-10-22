<script setup lang="ts">
import type { BalanceCompositionPeriod } from '#shared/types/stock-balance-composition'
import type { CashFlowCompositionPeriod } from '#shared/types/stock-cash-flow-composition'
// 資產負債表組成的金額堆疊圖＋逐期表（2026-10-12）：流動資產、非流動資產、負債、淨值四處共用。
//
// 使用者同日三句話：「我看到的似乎年跟季混一起，這邊圖表規格沒有抽出成共用元件嗎? 似乎跟折線圖有的選項不同」「這些圖表右上角的
// 選項呢？不能選單季 四季 近五年這種嗎」「debt-composition 也改用數字而非比例」。所以：
//   - 圖卡（SharedChartCard）：期別（el-radio-group）＋近N年／自訂區間，跟指標頁的圖同一組控制項
//   - 期別只有單季與年度：資產負債表是某一天的存量快照，沒有「近四季」那種流量加總。預設單季；年度只留每年 Q4，不再年季混排
//   - 圖的單位依畫面上最大的合計自動選億元或萬元，圖層傳原值不先四捨五入；提示框與表格都用 formatMoney，所以是同一串字
//   - 表格跟著圖切（同一個期別、同一段年限）
//
// 現金流量的組成（kind 'cashFlow'，2026-10-17）也用這一張，三處不同：年度是四季相加（伺服器加好、fiscalQuarter 為 null），不是取 Q4 的
// 時點；預設年度（單季的現金流很跳）；表格括號是「占收入／占支出」而不是占總資產。收入疊在零軸上方、支出在下方，合計線就是現金增減。
const props = withDefaults(defineProps<{
  periods: (BalanceCompositionPeriod | CashFlowCompositionPeriod)[]
  // 拆哪一塊：每期取哪些數字（庫藏股這類減項是負值）、合計與各項的名稱、表格附不附占總資產%，都在 BALANCE_COMPOSITION_KINDS
  kind: BalanceCompositionKind | 'cashFlow'
  // 表格自己一個問句段落（表格回答的是歷年變化，跟圖上那一段的問題不同），文字走 historyTableText
  shortName: string
  code: string
  tableSectionId: string
  // 只畫圖卡、不帶下面的逐期表（指標速覽用，2026-10-14）
  chartOnly?: boolean
}>(), { chartOnly: false })
const isFlow = computed(() => props.kind === 'cashFlow')
const kindDef = computed(() => (props.kind === 'cashFlow' ? CASH_FLOW_COMPOSITION_KIND : BALANCE_COMPOSITION_KINDS[props.kind]))
const labels = computed(() => kindDef.value.labels)
const totalLabel = computed(() => kindDef.value.total)
// 只有合計、沒有分項（無形資產，2026-10-23）：合計自己就是那一組柱子，表格只有一欄，提示框不再重複寫合計
const single = computed(() => Object.keys(labels.value).length === 0)
const shareOfAssets = computed(() => 'shareOfAssets' in kindDef.value && kindDef.value.shareOfAssets)

// 現金流量預設年度（單季的現金流很跳：股利、還債集中在某一季）；還沒有完整一年的公司沒有年度那一份，就從單季開始，不然整張圖不出現
const basis = ref<'Q' | 'FY'>(isFlow.value && props.periods.some(period => period.fiscalQuarter === null && 'cashFlow' in period && period.cashFlow) ? 'FY' : 'Q')

// 年度：資產負債表取 Q4 那一季的時點，現金流量取伺服器加總好的那一份（fiscalQuarter 為 null）
const inBasis = (fiscalQuarter: number | null) => (basis.value === 'Q' ? fiscalQuarter !== null : isFlow.value ? fiscalQuarter === null : fiscalQuarter === 4)
const pick = (period: BalanceCompositionPeriod | CashFlowCompositionPeriod) => {
  if ('cashFlow' in period) return period.cashFlow ? { total: period.cashFlow.netChange, parts: period.cashFlow.parts as Record<string, number> } : null
  return props.kind === 'cashFlow' ? null : pickBalanceComposition(props.kind, period)
}
const rows = computed(() =>
  props.periods
    .filter(period => inBasis(period.fiscalQuarter))
    .flatMap((period) => {
      const picked = pick(period)
      return picked ? [{ label: basis.value === 'Q' ? `${period.fiscalYear} Q${period.fiscalQuarter}` : String(period.fiscalYear), totalAssets: 'totalAssets' in period ? period.totalAssets : 0, ...picked }] : []
    })
)
// 近N年與自訂區間：useChartPeriod＋SharedChartCard，選擇是這張圖自己的。label 是「2024 Q1」或「2024」，同一種期別內可以直接比大小
const { period, shown } = useChartPeriod({ all: rows, keyOf: row => row.label, perYear: () => (basis.value === 'Q' ? 4 : 1) })

// 層的順序由最新一期的大小決定，圖與表共用；所有期別都是 0 的項目不畫也不列
const order = computed(() => {
  const last = shown.value.at(-1)
  if (!last) return []
  return Object.keys(labels.value)
    .filter(key => shown.value.some(row => (row.parts[key] ?? 0) !== 0))
    .sort((a, b) => Math.abs(last.parts[b] ?? 0) - Math.abs(last.parts[a] ?? 0))
})

// 單位看合計與各項裡最大的那個：現金流量的合計（現金增減）可能很小、各項卻很大
const unit = computed(() => {
  const max = Math.max(0, ...shown.value.flatMap(row => [Math.abs(row.total), ...Object.values(row.parts).map(Math.abs)]))
  return max >= 1e5 ? { divisor: 1e5, label: '億元' } : { divisor: 10, label: '萬元' }
})
const layers = computed(() => (single.value
  ? [{ name: totalLabel.value, values: shown.value.map(row => row.total / unit.value.divisor) }]
  : order.value.map(key => ({ name: labels.value[key]!, values: shown.value.map(row => (row.parts[key] ?? 0) / unit.value.divisor) }))))

const money = (thousand: number) => formatMoney(thousand * 1000)
const table = computed(() => historyTableText({
  shortName: props.shortName,
  code: props.code,
  topic: isFlow.value ? '現金流量的組成' : totalLabel.value,
  // 資產負債表是時點（季底、年底），現金流量是一段期間的流量
  basis: isFlow.value ? (basis.value === 'Q' ? '單季' : '年度') : basis.value === 'Q' ? '每季底' : '每年底',
  count: shown.value.length,
  from: shown.value[0]?.label ?? '',
  to: shown.value.at(-1)?.label ?? ''
}))
const tableAnswer = computed(() => `${table.value.answer}${shareOfAssets.value ? '金額後面括號裡是占總資產的比率。' : isFlow.value ? '正的是收入、負的是支出，括號裡是占這一期全部收入或全部支出的比率。' : ''}期別與年限跟著上面的圖切換。`)
type Row = (typeof rows.value)[number]
const percent = (part: number, whole: number) => `${((part / whole) * 100).toFixed(1)}%`
// 收入占全部收入、支出占全部支出（現金流量）；資產與負債占總資產
const cell = (thousand: number, row: Row) => {
  if (shareOfAssets.value) return `${money(thousand)}（${percent(thousand, row.totalAssets)}）`
  if (!isFlow.value || thousand === 0) return money(thousand)
  const side = Object.values(row.parts).filter(value => Math.sign(value) === Math.sign(thousand)).reduce((a, b) => a + b, 0)
  return `${money(thousand)}（占${thousand > 0 ? '收入' : '支出'} ${percent(thousand, side)}）`
}
</script>

<template>
  <div v-if="rows.length" class="stock-balance-composition">
    <SharedChartCard :period="period">
      <template v-if="$slots.header" #header>
        <slot name="header" />
      </template>
      <template #controls>
        <el-radio-group v-model="basis" aria-label="期別">
          <el-radio-button value="Q">單季</el-radio-button>
          <el-radio-button value="FY">年度</el-radio-button>
        </el-radio-group>
      </template>
      <StockStackedBarChart
        :categories="shown.map(row => row.label)"
        :layers="layers"
        :unit="unit.label"
        :total-name="totalLabel"
        :value-formatter="value => money(value * unit.divisor)"
        :tooltip-header="index => (single ? `${shown[index]?.label}` : `${shown[index]?.label}　${totalLabel} ${money(shown[index]?.total ?? 0)}`)"
      />
    </SharedChartCard>
    <StockQuestionSection v-if="!chartOnly" :id="tableSectionId" class="stock-balance-composition__table-section" :question="table.question" :answer="tableAnswer">
    <SharedTableScroll :label="table.label">
      <table class="seo-table" data-ssr-table>
        <caption class="visually-hidden">{{ table.label }}</caption>
        <thead>
          <tr>
            <th scope="col">期別</th>
            <!-- 數字欄的表頭跟數字一起靠右（同股利歷史表）；無形資產只有這一欄、很寬，靠左的話表頭與數字隔整張表 -->
            <th scope="col" class="seo-table__num">{{ totalLabel }}</th>
            <th v-for="key in order" :key="key" scope="col" class="seo-table__num">{{ labels[key] }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in [...shown].reverse()" :key="row.label">
            <th scope="row">{{ row.label }}</th>
            <td class="seo-table__num">{{ shareOfAssets ? cell(row.total, row) : money(row.total) }}</td>
            <td v-for="key in order" :key="key" class="seo-table__num">{{ cell(row.parts[key] ?? 0, row) }}</td>
          </tr>
        </tbody>
      </table>
    </SharedTableScroll>
    </StockQuestionSection>
  </div>
</template>

<style scoped>
/* 表格自己的問句段落接在圖例下面，留一段距離，不然標題看起來像圖例的一部分 */
.stock-balance-composition__table-section {
  margin-top: 32px;
}
</style>
