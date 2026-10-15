<script setup lang="ts">
import type { BalanceCompositionPeriod } from '#shared/types/stock-balance-composition'
// 資產負債表組成的金額堆疊圖＋逐期表（2026-10-12）：流動資產、非流動資產、負債、淨值四處共用。
//
// 使用者同日三句話：「我看到的似乎年跟季混一起，這邊圖表規格沒有抽出成共用元件嗎? 似乎跟折線圖有的選項不同」「這些圖表右上角的
// 選項呢？不能選單季 四季 近五年這種嗎」「debt-composition 也改用數字而非比例」。所以：
//   - 圖卡（SharedChartCard）：期別（el-radio-group）＋近N年／自訂區間，跟指標頁的圖同一組控制項
//   - 期別只有單季與年度：資產負債表是某一天的存量快照，沒有「近四季」那種流量加總。預設單季；年度只留每年 Q4，不再年季混排
//   - 圖的單位依畫面上最大的合計自動選億元或萬元，圖層傳原值不先四捨五入；提示框與表格都用 formatMoney，所以是同一串字
//   - 表格跟著圖切（同一個期別、同一段年限）
const props = withDefaults(defineProps<{
  periods: BalanceCompositionPeriod[]
  // 從一期取出這張圖要的合計與各項（千元，庫藏股這類減項傳負值）；拆不開回 null
  pick: (period: BalanceCompositionPeriod) => { total: number; parts: Record<string, number> } | null
  labels: Record<string, string>
  totalLabel: string
  // 表格每一格附「占總資產%」（資產與負債要；淨值不要）
  shareOfAssets?: boolean
  // 表格自己一個問句段落（表格回答的是歷年變化，跟圖上那一段的問題不同），文字走 historyTableText
  shortName: string
  code: string
  // 表格的主題（流動資產／負債／淨值…），問句「X的{topic}歷年變化如何？」
  topic: string
  tableSectionId: string
  // 只畫圖卡、不帶下面的逐期表（指標速覽用，2026-10-14）
  chartOnly?: boolean
}>(), { shareOfAssets: false, chartOnly: false })

const basis = ref<'Q' | 'FY'>('Q')

const rows = computed(() =>
  props.periods
    .filter(period => basis.value === 'Q' || period.fiscalQuarter === 4)
    .flatMap((period) => {
      const picked = props.pick(period)
      return picked ? [{ label: basis.value === 'Q' ? `${period.fiscalYear} Q${period.fiscalQuarter}` : String(period.fiscalYear), totalAssets: period.totalAssets, ...picked }] : []
    })
)
// 近N年與自訂區間：useChartPeriod＋SharedChartCard，選擇是這張圖自己的。label 是「2024 Q1」或「2024」，同一種期別內可以直接比大小
const { period, shown } = useChartPeriod({ all: rows, keyOf: row => row.label, perYear: () => (basis.value === 'Q' ? 4 : 1) })

// 層的順序由最新一期的大小決定，圖與表共用；所有期別都是 0 的項目不畫也不列
const order = computed(() => {
  const last = shown.value.at(-1)
  if (!last) return []
  return Object.keys(props.labels)
    .filter(key => shown.value.some(row => (row.parts[key] ?? 0) !== 0))
    .sort((a, b) => Math.abs(last.parts[b] ?? 0) - Math.abs(last.parts[a] ?? 0))
})

const unit = computed(() => {
  const max = Math.max(0, ...shown.value.map(row => Math.abs(row.total)))
  return max >= 1e5 ? { divisor: 1e5, label: '億元' } : { divisor: 10, label: '萬元' }
})
const layers = computed(() => order.value.map(key => ({ name: props.labels[key]!, values: shown.value.map(row => (row.parts[key] ?? 0) / unit.value.divisor) })))

const money = (thousand: number) => formatMoney(thousand * 1000)
const table = computed(() => historyTableText({
  shortName: props.shortName,
  code: props.code,
  topic: props.topic,
  basis: basis.value === 'Q' ? '每季底' : '每年底',
  count: shown.value.length,
  from: shown.value[0]?.label ?? '',
  to: shown.value.at(-1)?.label ?? ''
}))
const tableAnswer = computed(() => `${table.value.answer}${props.shareOfAssets ? '金額後面括號裡是占總資產的比率。' : ''}期別與年限跟著上面的圖切換。`)
const cell = (thousand: number, totalAssets: number) => (props.shareOfAssets ? `${money(thousand)}（${((thousand / totalAssets) * 100).toFixed(1)}%）` : money(thousand))
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
        :tooltip-header="index => `${shown[index]?.label}　${totalLabel} ${money(shown[index]?.total ?? 0)}`"
      />
    </SharedChartCard>
    <StockQuestionSection v-if="!chartOnly" :id="tableSectionId" class="stock-balance-composition__table-section" :question="table.question" :answer="tableAnswer">
    <SharedTableScroll :label="table.label">
      <table class="seo-table" data-ssr-table>
        <caption class="visually-hidden">{{ table.label }}</caption>
        <thead>
          <tr>
            <th scope="col">期別</th>
            <th scope="col">{{ totalLabel }}</th>
            <th v-for="key in order" :key="key" scope="col">{{ labels[key] }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in [...shown].reverse()" :key="row.label">
            <th scope="row">{{ row.label }}</th>
            <td class="seo-table__num">{{ cell(row.total, row.totalAssets) }}</td>
            <td v-for="key in order" :key="key" class="seo-table__num">{{ cell(row.parts[key] ?? 0, row.totalAssets) }}</td>
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
