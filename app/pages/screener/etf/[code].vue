<script setup lang="ts">
import type { LineChartEntry, LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { FactItem } from '~/components/shared/SharedFactList.vue'
import type { EtfDistributionComposition, EtfDistributionEvent, EtfPageResponse } from '#shared/types/screener-detail'
import type { Stock } from '~/composables/stock/useStocks'

// ETF 個別頁（2026-10-15 三組篩選重新設計，使用者選「做 ETF 個別頁」）。原本 ETF 篩選的結果點進去是 /stock/{代號}——那是給普通股看的
// 本益比、EPS 頁。骨架跟個股頁同一個（StockPageShell），導覽換成篩選區的。兩段問答：這檔 ETF 是什麼（基本資料）、配息多少與從哪裡來
// （一圖一表）。資料在伺服器端讀（/api/etf/:code），標題與內容在 SSR 就有。原本結果表每列的「配息組成」彈窗搬到這裡。
const route = useRoute()
const code = computed(() => String(route.params.code).toUpperCase())

const { data, pending, error, refresh } = await useFetch<EtfPageResponse>(() => `/api/etf/${code.value.toLowerCase()}`, {
  key: () => `etf-page-${code.value}`
})
const notFound = computed(() => error.value?.statusCode === 404 || error.value?.statusCode === 400)
// 404 以外的讀取失敗交給全站彈窗、頁面停在載入中，不掉進「找不到這檔 ETF」
watchLoadFailure('etf-page', () => (error.value && !notFound.value ? error.value : null), () => refresh())

const etf = computed(() => data.value?.etf ?? null)
const values = computed(() => etf.value?.values ?? {})
const stock = computed<Stock | null>(() => (etf.value
  ? { code: etf.value.symbol, name: etf.value.shortName, price: data.value?.quote?.price ?? null, change: data.value?.quote?.change ?? null, changePercent: data.value?.quote?.changePercent ?? null }
  : null))
const shortName = computed(() => etf.value?.shortName ?? code.value)
const { isFavorite, toggleFavorite } = useWatchlistToggle(() => etf.value?.symbol)

// ---- 這檔 ETF 是什麼 ----
const num = (field: string): number | null => (typeof values.value[field] === 'number' ? values.value[field] as number : null)
const text = (field: string): string | null => (typeof values.value[field] === 'string' ? values.value[field] as string : null)
const isActive = computed(() => values.value.isActive === true)
const pct = (value: number | null) => (value === null ? '尚無資料' : `${value}%`)
const MARKETS: Record<string, string> = { sii: '上市', otc: '上櫃' }

// 管理方式：被動式寫出追蹤的指數；主動式沒有指數（上游給 null）
const style = computed(() => {
  if (etf.value?.trackingIndex) return `被動式，追蹤「${etf.value.trackingIndex}」`
  return isActive.value ? '主動式，由經理人選股、不追蹤指數' : '尚無資料'
})

const facts = computed<FactItem[]>(() => {
  if (!etf.value) return []
  const established = text('establishedDate')
  const years = num('yearsSinceEstablished')
  const aum = num('aum')
  const threshold = num('statutoryAumThreshold')
  const below = values.value.belowStatutoryThreshold === true
  return [
    { label: '基金全名', value: etf.value.fundName },
    { label: '發行投信', value: etf.value.issuerName },
    { label: '管理方式', value: style.value },
    { label: '資產類型', value: text('assetClass') ?? '尚無資料' },
    { label: '市場', value: MARKETS[text('market') ?? ''] ?? '尚無資料' },
    { label: '成立日', value: established ?? '尚無資料', note: years !== null ? `成立 ${years} 年` : undefined },
    { label: '配息頻率', value: text('distributionFrequency') ?? '尚無資料' },
    { label: '規模', value: aum !== null ? formatMoney(aum) : '尚無資料', note: below && threshold !== null ? `低於法定下市門檻 ${formatMoney(threshold)}` : undefined, warning: below },
    { label: '受益人數', value: num('holders') !== null ? `${groupThousands(num('holders')!)} 人` : '尚無資料' },
    { label: '淨值', value: num('nav') !== null ? `${groupThousands(num('nav')!.toFixed(2))} 元` : '尚無資料' },
    { label: '折溢價率', value: pct(num('premiumDiscountPct')) },
    { label: '總費用率', value: pct(num('expenseRatio')) }
  ]
})

const overviewAnswer = computed(() => {
  if (!etf.value) return null
  const assetClass = text('assetClass')
  const aum = num('aum')
  const expense = num('expenseRatio')
  return [
    `${shortName.value}（${code.value}）是${etf.value.issuerName}發行的${etf.value.trackingIndex ? `被動式 ETF，追蹤「${etf.value.trackingIndex}」` : isActive.value ? '主動式 ETF' : ' ETF'}`,
    assetClass ? `，資產類型為${assetClass}` : '',
    aum !== null ? `；規模 ${formatMoney(aum)}` : '',
    expense !== null ? `，總費用率 ${expense}%` : '',
    '。'
  ].join('')
})

// ---- 配息多少、從哪裡來 ----
const PARTS = [
  { key: 'dividendIncomePct', name: '股利所得' },
  { key: 'interestIncomePct', name: '利息所得' },
  { key: 'incomeEqualizationPct', name: '收益平準金' },
  { key: 'realizedCapitalGainPct', name: '已實現資本利得' },
  { key: 'otherIncomePct', name: '其他' }
] as const

const distributions = computed(() => data.value?.distributions ?? null)
const events = computed(() => [...(distributions.value?.events ?? [])].sort((a, b) => a.exDividendDate.localeCompare(b.exDividendDate)))
const newestFirst = computed(() => [...events.value].reverse())
const hasComposition = (composition: EtfDistributionComposition | null) => !!composition && PARTS.some(part => composition[part.key] !== null)
const money = (value: number | null) => (value === null ? '尚未公布' : `${formatSignificantDigits(value, 4)} 元`)
const share = (value: number | null) => (value === null ? '未揭露' : `${value.toFixed(2)}%`)

function undisclosed(composition: EtfDistributionComposition): string {
  const gap = 100 - PARTS.reduce((total, part) => total + (composition[part.key] ?? 0), 0)
  return gap > 0.05 ? `${gap.toFixed(2)}%` : '—'
}

const distributionAnswer = computed(() => {
  if (!events.value.length) {
    return text('distributionFrequency') === '不分配' ? '這檔 ETF 不配息，收益留在基金裡、反映在淨值上。' : '目前沒有這檔 ETF 的配息紀錄。'
  }
  const window = distributions.value?.trailing12MonthWindow
  const total = distributions.value?.trailing12MonthDistributionPerUnit ?? null
  const trailing = window && total !== null ? `近 12 個月（${window.start}～${window.end}）每單位配息合計 ${formatSignificantDigits(total, 4)} 元。` : ''
  const latest = newestFirst.value.find(event => hasComposition(event.composition))
  const composition = latest?.composition
  const source = composition
    ? `最近一次有公告組成的是 ${latest.exDividendDate} 除息的那一次：股利所得 ${share(composition.dividendIncomePct)}、收益平準金 ${share(composition.incomeEqualizationPct)}、已實現資本利得 ${share(composition.realizedCapitalGainPct)}（投信公告的預估比例）。`
    : '投信還沒有公告過配息的組成。'
  return `${trailing}${source}`
})

// 圖：每個月一格（12 格＝一年），有除息的月份畫每單位配息的柱子。用月份而不是「第幾次配息」當橫軸，近N年才會是真的 N 年——
// 配息頻率會改（年配改季配），用次數算年數會錯
const DISTRIBUTION_CODE = 'distribution'
const SERIES: LineSeriesSpec[] = [{ code: DISTRIBUTION_CODE, name: '每單位配息', type: 'bar', lineType: 'solid', symbol: 'rect', format: money }]

function nextMonth(month: string): string {
  const [year, value] = month.split('-').map(Number) as [number, number]
  return value === 12 ? `${year + 1}-01` : `${year}-${String(value + 1).padStart(2, '0')}`
}

const chartEntries = computed<LineChartEntry[]>(() => {
  if (!events.value.length) return []
  const byMonth = new Map<string, number>()
  for (const event of events.value) {
    if (event.distributionPerUnit === null) continue
    const month = event.exDividendDate.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + event.distributionPerUnit)
  }
  const first = events.value[0]!.exDividendDate.slice(0, 7)
  const windowEnd = distributions.value?.trailing12MonthWindow?.end.slice(0, 7) ?? ''
  const lastEvent = events.value.at(-1)!.exDividendDate.slice(0, 7)
  const last = windowEnd > lastEvent ? windowEnd : lastEvent
  const entries: LineChartEntry[] = []
  for (let month = first; month <= last; month = nextMonth(month)) {
    entries.push({ label: month, values: { [DISTRIBUTION_CODE]: { value: byMonth.get(month) ?? null } } })
  }
  return entries
})
const { period, shown } = useChartPeriod({ all: chartEntries, keyOf: entry => entry.label ?? '', perYear: 12 })

function statusText(event: EtfDistributionEvent): string | null {
  if (event.distributionPerUnit === null) return '金額未公布'
  if (!hasComposition(event.composition)) return '組成未公告'
  return null
}

const latestWarning = computed(() => newestFirst.value.find(event => event.distributionWarning)?.distributionWarning ?? null)

// ---- 頁面 ----
const breadcrumbs = computed(() => [
  { label: '首頁', to: '/' },
  { label: 'ETF 篩選', to: SCREENER_PATHS.etf },
  { label: `${shortName.value} ${code.value}`, to: etfPath(code.value) }
])

useHubPageSeo({
  title: () => (etf.value ? `${shortName.value} ${code.value} ETF 基本資料與配息` : '找不到這檔 ETF'),
  description: () => overviewAnswer.value ?? `${code.value} ETF 的基本資料與配息紀錄。`,
  path: () => etfPath(code.value),
  breadcrumbs,
  noindex: () => !etf.value
})

const footer = computed(() => ({
  sources: ['證交所、櫃買中心', '投信投顧公會基金月報', '投信公告的配息組成'],
  freshness: etf.value?.yearMonth ? `基金月報 ${etf.value.yearMonth.slice(0, 4)} 年 ${Number(etf.value.yearMonth.slice(4))} 月` : null,
  links: [{ to: SCREENER_PATHS.etf, label: 'ETF 篩選' }]
}))
</script>

<template>
  <StockPageShell
    class="app-page etf-page"
    :code="code"
    :stock="stock"
    :pending="pending || (!!error && !notFound)"
    :is-emerging="null"
    :is-favorite="isFavorite"
    :short-name="shortName"
    topic="ETF 基本資料與配息"
    subject=" ETF"
    :breadcrumbs="breadcrumbs"
    :footer="footer"
    @toggle-favorite="toggleFavorite"
  >
    <template #nav>
      <ScreenerNav :active-to="SCREENER_PATHS.etf" />
    </template>

    <StockQuestionSection id="etf-overview" :question="`${shortName}（${code}）是什麼樣的 ETF？`" :answer="overviewAnswer">
      <SharedFactList :items="facts" :label="`${shortName}的基本資料`" />
    </StockQuestionSection>

    <StockQuestionSection id="etf-distributions" question="配息多少、從哪裡來？" :answer="distributionAnswer">
      <SharedChartCard v-if="chartEntries.length" :period="period">
        <StockMultiSeriesLineChart :entries="shown" :series="SERIES" palette="accent" unit="元" :format="money" />
      </SharedChartCard>
      <SharedTableScroll v-if="newestFirst.length" :label="`${shortName}歷次配息與組成`">
        <table class="seo-table" data-ssr-table="history">
          <caption class="visually-hidden">{{ shortName }}歷次配息與組成（投信公告的預估比例，新的在上）</caption>
          <thead>
            <tr>
              <th scope="col">除息日</th>
              <th scope="col">發放日</th>
              <th scope="col" class="seo-table__num">每單位配息</th>
              <th v-for="part in PARTS" :key="part.key" scope="col" class="seo-table__num">{{ part.name }}</th>
              <th scope="col" class="seo-table__num">未揭露</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in newestFirst" :key="event.exDividendDate">
              <th scope="row">{{ event.exDividendDate }}</th>
              <td>{{ event.paymentDate ?? '—' }}</td>
              <td class="seo-table__num">{{ money(event.distributionPerUnit) }}</td>
              <td v-if="statusText(event)" :colspan="PARTS.length + 1">{{ statusText(event) }}</td>
              <template v-else>
                <td v-for="part in PARTS" :key="part.key" class="seo-table__num">{{ share(event.composition![part.key]) }}</td>
                <td class="seo-table__num">{{ undisclosed(event.composition!) }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </SharedTableScroll>
      <details v-if="latestWarning" class="hub-details">
        <summary>投信公告附註（原文）</summary>
        <blockquote class="etf-page__warning">{{ latestWarning }}</blockquote>
      </details>
    </StockQuestionSection>
  </StockPageShell>
</template>

<style scoped>
.etf-page__warning {
  margin: 8px 0 0;
  padding-left: 12px;
  border-left: 3px solid var(--el-border-color);
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
</style>
