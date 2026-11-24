<script setup lang="ts">
import type { ReceivablesAging } from '~/utils/receivables-aging'

// 應收帳款帳齡（2026-11-22，數據中台 B 批第 7 項；使用者「按照建議執行」，設計 https://claude.ai/artifact/BffXAybhLkibJSNAcRTDkz 的 7）：
// 每季一根 100% 堆疊長條（落在標準段的照五段，跨段的照申報的分段），表格照申報的分段列最新一季、總額扣掉備抵損失就是資產負債表上的
// 應收帳款。銀行、金控、保險沒有這張附註（periods 是 []）：說一句、不收錄。金額千元
const route = useRoute()
const code = computed(() => String(route.params.code))

const TOPIC = '應收帳款帳齡'

const { stock, profile, stockShortName, stockPending, summary } = useStockDetailSummary(code)
// 等它到了才換頁（Nitro 快取一天）：頁面沒有讀取中的樣子，資料晚到不會把版面往下推
const { data, error, refresh } = await useFetch<ReceivablesAging>(() => `/api/cached/stocks/${code.value}/receivables-aging`, { key: () => `stock-receivables-aging-${code.value}`, watch: [code] })
// 404（不在名單）是沒有資料，不是讀不到
watchLoadFailure(() => `stock-receivables-aging:${code.value}`, () => (error.value?.statusCode === 404 ? null : error.value), refresh)

const money = (thousand: number) => formatMoney(thousand * 1000)
const latest = computed(() => data.value?.periods[0] ?? null)
const ascending = computed(() => [...(data.value?.periods ?? [])].reverse().map(period => ({ label: agingPeriodLabel(period), period })))
// 近N年（全站同一組選項；47 季的資料，近 8 年都選得到）
const { period, shown } = useChartPeriod({ all: ascending, keyOf: row => row.label, perYear: 4 })
// 圖只畫逾期的部分（使用者選「只畫逾期部分」）：各逾期天數占未逾期加逾期，加起來就是逾期占比；整段都沒有逾期占比的（發票日、信用風險階段口徑）
// 畫 100% 的分布。沒有逾期占比的那幾季（換過揭露方式的公司，2201 有四種）留白，提示框寫原因
const overdueChart = computed(() => hasOverdueRatio(shown.value.map(row => row.period)))
const layers = computed(() => (overdueChart.value
  ? agingLayerNames(shown.value.map(row => row.period).filter(period => period.overdueRatio !== null), ['overdue'])
      .map(name => ({ name, values: shown.value.map(row => (row.period.overdueRatio === null ? null : agingOverdueShares(row.period)[name] ?? 0)) }))
  : agingLayerNames(shown.value.map(row => row.period)).map(name => ({ name, values: shown.value.map(row => agingShares(row.period)[name] ?? 0) }))))
const tooltipHeader = (index: number) => {
  const row = shown.value[index]
  if (!row) return ''
  if (!overdueChart.value) return `${row.label}　應收帳款總額 ${money(row.period.total ?? 0)}`
  return row.period.overdueRatio === null ? `${row.label}　沒有逾期占比` : `${row.label}　逾期占比 ${row.period.overdueRatio.toFixed(2)}%`
}
const tooltipNote = (index: number) => {
  const period = shown.value[index]?.period
  return overdueChart.value && period?.overdueRatio === null ? NULL_REASON_LABELS[period.overdueRatioNullReason ?? ''] ?? '' : ''
}

const answer = computed(() => (latest.value ? agingAnswer(latest.value, money) : null))
// 金融保險業（類股 17）沒有應收帳款帳齡這張附註
const emptyAnswer = computed(() => (profile.value?.sectorCode === '17'
  ? `${stockShortName.value}屬金融保險業，財報沒有應收帳款帳齡。`
  : `目前沒有${stockShortName.value}的應收帳款帳齡資料。`))

// 照信用風險階段揭露的那一季，表頭與問句不寫「帳齡」
const rowHeader = computed(() => (latest.value?.agingBasis === 'credit_stage' ? '信用風險階段' : '帳齡'))
const tableRows = computed(() => {
  const period = latest.value
  if (!period?.total) return []
  const pct = (thousand: number) => `${minusSign((thousand / period.total! * 100).toFixed(2))}%`
  return [
    ...period.buckets.map(bucket => ({ label: agingRowLabel(bucket), amount: bucket.amount === null ? '－' : money(bucket.amount), share: bucket.amount === null ? '－' : pct(bucket.amount), strong: false })),
    { label: '總額', amount: money(period.total), share: '100.00%', strong: true },
    ...(period.allowance ? [
      { label: '備抵損失', amount: money(period.allowance), share: pct(period.allowance), strong: false },
      { label: '淨額', amount: money(period.total + period.allowance), share: '', strong: true }
    ] : [])
  ]
})
// 沒有逾期占比的那一季，表格底下寫原因（數據中台的 overdueRatioNullReason）
const noRatioNote = computed(() => (latest.value && latest.value.overdueRatio === null && latest.value.overdueRatioNullReason
  ? NULL_REASON_LABELS[latest.value.overdueRatioNullReason] ?? null
  : null))

const description = computed(() => clampDescription(answer.value
  ? `${stockShortName.value}（${code.value}）的應收帳款帳齡：${answer.value}${hasOverdueRatio(data.value?.periods ?? []) ? '每季未逾期與各逾期天數的占比' : '每季各分段占總額的比率'}，資料來自財報附註。`
  : emptyAnswer.value))
const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '應收帳款帳齡：未逾期與逾期天數的占比',
  pathSuffix: '/receivables-aging',
  stock,
  summary,
  description,
  sectorCode: computed(() => profile.value?.sectorCode ?? null),
  noindex: computed(() => !answer.value)
})

const footer = computed(() => ({
  sources: ['公開資訊觀測站：財務報告附註（應收帳款帳齡）'],
  links: [
    { to: `/stock/${code.value}/receivables-days`, label: '應收帳款收現天數' },
    { to: `/stock/${code.value}/cash-cycle`, label: '現金循環的組成' },
    { to: `/stock/${code.value}/balance-sheet`, label: `${stockShortName.value} ${code.value} 最新一期的資產負債表` }
  ]
}))
const GUIDE = [
  '應收帳款帳齡是財報附註裡，把應收帳款依「逾期多久」分段的金額。逾期占比是逾期的金額除以未逾期加逾期；「個別評估」那一段（交易對象已有違約跡象）不照天數分，兩邊都不算。總額扣掉備抵損失，就是資產負債表上的應收帳款。',
  '分段的寫法有幾十種，歸成五段：未逾期、逾期 1～30 天、31～90 天、91～180 天、181 天以上；公司分得比較粗的（例如只寫「逾期 31 天以上」），照它自己的分段畫。有些公司照發票日（立帳日）算帳齡、不分有沒有逾期，這一頁寫「帳齡 N 天」；少數公司照信用風險階段揭露（12 個月預期信用損失、信用風險已顯著增加、已信用減損），這兩種都沒有逾期占比。',
  '圖畫的是逾期的部分：每一季各逾期天數占未逾期加逾期的比率，疊起來就是逾期占比；未逾期的比率寫在答句與表格裡。沒有逾期占比的那幾季留白，滑過去會寫原因；整段都沒有逾期占比的公司，圖改畫各分段占總額的比率。'
]
</script>

<template>
  <StockPageShell
    class="stock-receivables-aging-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
  >
    <template v-if="answer && latest">
      <StockQuestionSection id="stock-receivables-aging" :question="`${stockShortName}（${code}）的應收帳款收得回來嗎？`" :answer="answer">
        <SharedChartCard :period="period">
          <StockStackedBarChart
            :categories="shown.map(row => row.label)"
            :layers="layers"
            unit="%"
            :max="overdueChart ? undefined : 100"
            :total-name="overdueChart ? '逾期占比' : '應收帳款總額'"
            :value-formatter="value => `${value.toFixed(2)}%`"
            :tooltip-header="tooltipHeader"
            :tooltip-note="tooltipNote"
          />
        </SharedChartCard>
      </StockQuestionSection>
      <StockQuestionSection id="stock-receivables-aging-table" :question="`${agingPeriodLabel(latest)} 各${rowHeader}的金額是多少？`">
        <SharedTable :label="`${stockShortName}${agingPeriodLabel(latest)}的應收帳款帳齡`">
          <thead>
            <tr>
              <th scope="col">{{ rowHeader }}</th>
              <th scope="col" class="seo-table__num">金額</th>
              <th scope="col" class="seo-table__num">占總額</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in tableRows" :key="row.label" :class="{ 'is-latest': row.strong }">
              <th scope="row">{{ row.label }}</th>
              <td class="seo-table__num">{{ row.amount }}</td>
              <td class="seo-table__num">{{ row.share }}</td>
            </tr>
          </tbody>
        </SharedTable>
        <p v-if="noRatioNote" class="hub-answer">這一季沒有逾期占比：{{ noRatioNote }}。</p>
      </StockQuestionSection>
    </template>
    <StockQuestionSection v-else-if="data" id="stock-receivables-aging" :question="`${stockShortName}（${code}）的應收帳款收得回來嗎？`" :answer="emptyAnswer" />
    <template #guide>
      <StockMetricGuide id-prefix="stock-receivables-aging" :topic="TOPIC" :definition="GUIDE" />
    </template>
  </StockPageShell>
</template>
