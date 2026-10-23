<script setup lang="ts">
import { Bottom, Check, Delete, Plus, Top } from '@element-plus/icons-vue'
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import type { StockDividendYieldHistoryResponse } from '#shared/types/stock-dividend-yield-history'
import type { StockMonthlyRevenuePageResponse } from '#shared/types/stock-monthly-revenue-page'
import type { StockDupontPageResponse } from '#shared/types/stock-dupont-page'
import type { StockBalanceCompositionResponse } from '#shared/types/stock-balance-composition'
import type { StockCashFlowCompositionResponse } from '#shared/types/stock-cash-flow-composition'
import type { StockBookValueBreakdownResponse } from '#shared/types/stock-equity-composition'
import type { StockMarginsPageResponse } from '#shared/types/stock-margins-page'
import type { StockSolvencyPageResponse } from '#shared/types/stock-solvency-page'
import type { StockSeriesResponse } from '#shared/types/stock-series'
import type { BalanceCompositionKind } from '#shared/utils/balance-composition'
import type { QuickViewChart } from '#shared/utils/metric-pages'
import type { StockNavNode } from '~/utils/stock-page-nav'
// 指標速覽（2026-10-07「我想增加一個功能，自選指標的速覽」→「指標速覽請放在配息從哪來的下面」）。
// 側邊欄釘選的每一支指標，這檔股票的最新數值一頁看完；點名稱進該指標頁看歷史。
//
// 文件型一張表，不做卡片牆（使用者 2026-09「card-per-metric＝畫面髒亂」）。只陳述數字與期別，不比高低。
// 2026-10-18 起是個股首頁 /stock/{code}（「亮點與風險拿掉…讓指標速覽作為個股的新的首頁」；舊網址 /quick-view 301 過來，
// 見 server/middleware/legacy-redirects.ts）。要被收錄（使用者選「收錄，SSR 畫預設釘選」）：伺服器端用預設釘選畫表格與數值，
// 登入後換成帳號裡的釘選；meta description 照舊由 useStockPageDigest 的 index 摘要給。
const TOPIC = '指標速覽'

const route = useRoute()
const code = computed(() => String(route.params.code))
const { stock, profile, stockShortName, stockPending, summary } = useStockDetailSummary(code)
// 型錄跟摘要同時抓（序列資料不依賴型錄）；型錄只在這裡 await 一次（shared-key race）
const [, { description }] = await Promise.all([
  useFilterSchema(),
  useStockPageDigest(code, 'index', { shortName: stockShortName })
])
const { data: schema } = useNuxtData<{ categories: Parameters<typeof locateFieldInSchema>[0] }>('filter-schema')

const { pinnedSlugs, isPinned, isFull, toggle, move } = useStockPinnedMetrics()

// 釘選的是「頁面」（slug），不是指標欄位。對應成 /screener/values 的欄位：
//   - 指標頁：METRIC_PAGES 的 metricCode＋timeframe
//   - 徽章頁：BADGE_PAGES 的 metricCode＋chartTimeframe（沒寫就近四季）
//   - 配股配息：交易所公布的殖利率（那一頁回答的就是「領多少」）
//   - 月營收年增率：近三個月累計營收年增率（型錄裡月頻率的那一支；單月年增率不在型錄）。月營收（金額）型錄沒有，只畫圖、不給數值
//   - 杜邦分析：近四季 ROE（三項乘出來的那個數）
//   - 淨值從哪來：每股淨值；股東回饋組成、營業費用組成：組成的母項
//   - 資產負債表的四張組成：那一塊占總資產的比率（淨值組成是股東權益比率），同 StockBalanceCompositionPage 的 metricCode
//   - 安全韌性的組成：流動比率（那一頁的主線）；現金循環的組成：現金轉換循環（時間軸最後算出來的那一段）
//   - 財報三率的關係是三個數並列，沒有單一數值，只給連結
const SPECIAL_FIELDS: Record<string, string> = {
  'dividend': 'dividendYield.EOD',
  'monthly-revenue-growth': 'revenueYoy3m.M',
  'dupont': 'roe.TTM',
  'equity-source': 'bvps.Q',
  'shareholder-yield-composition': 'shareholderYield.FY',
  'operating-expense-composition': 'operatingExpensePerShare.TTM',
  'equity-composition': 'equityRatio.Q',
  'cash-flow-composition': 'ocfPerShare.TTM',
  'current-asset-composition': 'currentAssetsToAssets.Q',
  'non-current-asset-composition': 'nonCurrentAssetsToAssets.Q',
  'intangible-assets': 'intangibleAssetsToAssets.Q',
  'debt-composition': 'debtRatio.Q',
  'solvency': 'currentRatio.Q',
  'cash-cycle': 'cashConversionCycle.TTM'
}
function fieldOf(slug: string): string | null {
  if (SPECIAL_FIELDS[slug]) return SPECIAL_FIELDS[slug]!
  const metricPage = METRIC_PAGES.find(page => page.slug === slug)
  if (metricPage) return `${metricPage.metricCode}.${metricPage.timeframe}`
  const badgePage = BADGE_PAGES.find(page => page.slug === slug)
  if (badgePage) return `${badgePage.metricCode}.${badgePage.chartTimeframe ?? 'TTM'}`
  return null
}
// 數值跟列名不是同一件事時，數值前面說清楚是什麼（「月營收 139.32%」會被讀成營收本身）
// 依頁面（slug）而不是欄位：杜邦分析與 ROE 頁是同一個欄位 roe.TTM，只有杜邦那一列要說明它是 ROE
const VALUE_PREFIX: Record<string, string> = {
  'monthly-revenue-growth': '近三個月年增率 ',
  'dupont': 'ROE ',
  'equity-source': '每股淨值 ',
  'shareholder-yield-composition': '股東總回饋率 ',
  'operating-expense-composition': '每股營業費用 ',
  'equity-composition': '股東權益比率 ',
  'cash-flow-composition': '每股營業現金流 ',
  'current-asset-composition': '流動資產占總資產比 ',
  'non-current-asset-composition': '非流動資產占總資產比 ',
  'intangible-assets': '無形資產占總資產比 ',
  'debt-composition': '負債比率 ',
  'solvency': '流動比率 ',
  'cash-cycle': '現金轉換循環 '
}
// 型錄裡查不到的欄位不送：一個未知欄位會讓整個請求 400
const isKnownField = (field: string) => !!locateFieldInSchema(schema.value?.categories ?? [], field)

// 每一列帶自己的 slug，不靠索引跟 pinnedSlugs 對齊：清單裡有已下架的 slug 時（目錄查不到、這裡濾掉）
// 索引會錯位，上移／下移就會動到別支。
const rows = computed(() =>
  pinnedSlugs.value.flatMap(slug => {
    const node = METRIC_INDEX_BY_SLUG.get(slug)
    if (!node) return []
    const field = fieldOf(slug)
    return [{ slug, label: node.label, to: node.to!(code.value), field: field && isKnownField(field) ? field : null }]
  })
)
const fields = computed(() => [...new Set(rows.value.map(row => row.field).filter((field): field is string => !!field))])
// 頁尾的資料來源（2026-10-11 補上）：釘選的那幾個欄位各自的型錄來源
const dataSources = computed(() => collectMetricSources(schema.value?.categories ?? [], fields.value.map(field => field.split('.')[0]!)))

interface ScreenerValue { value: string | null; knowledgeDate: string | null; fiscalPeriod?: string | null }
const { data: values, status: valuesStatus, error: valuesError, refresh: refreshValues } = useAsyncData(
  () => `quick-view-${code.value}-${fields.value.join(',')}`,
  async () => {
    if (!fields.value.length) return {}
    const response = await fetchScreenerValues<ScreenerValue>([code.value], fields.value)
    return response.results[0]?.values ?? {}
  },
  // 伺服器端算的是預設釘選（給搜尋引擎）；登入後同步成帳號的釘選，fields 變了再抓一次
  { watch: [fields], default: () => ({}) as Record<string, ScreenerValue | undefined> }
)
// 讀不到時交給全站的讀取失敗彈窗（AppLoadFailureDialog），畫面上不再各自出訊息
watchLoadFailure(() => `quick-view-values:${code.value}`, () => valuesError.value, refreshValues)

// 每支指標各自的圖（2026-10-07「quick-view 加上圖表」→「圖表就是該指標各自的圖表」）：跟它自己那一頁畫的是同一張。哪一頁畫哪張
// 由 metric-pages.ts 的 quickViewChartOf 決定，hasPinnableChart 讀同一份，所以能釘的都畫得出來、格子跟釘選清單一對一。
const categories = computed(() => schema.value?.categories ?? [])
const timeframesOf = (metricCode: string) => {
  const periods = findMetricInSchema(categories.value, metricCode)?.metric.fields.map(field => field.period) ?? []
  return (['TTM', 'Q', 'FY'] as const).filter(tf => periods.includes(tf))
}
const nameOf = (metricCode: string) => {
  const metric = findMetricInSchema(categories.value, metricCode)?.metric
  return metric ? (metric.nameSuffix ? `${metric.nameSuffix} ${metric.name}` : metric.name) : undefined
}
// 標題後面接最新數值（2026-10-07「速覽 卡片 左上角的 後面 請放上數值」），跟表格同一份 /screener/values
const charts = computed(() => rows.value.flatMap(row => {
  const spec = quickViewChartOf(row.slug)
  return spec ? [{ ...row, spec }] : []
}))

// 上移／下移在表格最後一欄（2026-10-07「把上移／下移做進速覽 表格中」）。按鈕不是拖曳：拖曳要另補
// 一套鍵盤操作（WCAG 2.5.7）。移動後焦點跟著那一列；移到頭／尾時那一顆會 disabled，改落到另一顆。
const orderAnnouncement = ref('')

// 刪除（2026-10-07「也要加上刪除喔」）：立刻拿掉，10 秒內可復原（undoToast，持股頁／觀察清單同一套）。
// 復原放回原位；那 10 秒裡清單若又被動過，插回同一個索引、已經在清單裡就不重複加。
function removeRow(slug: string, label: string) {
  const position = pinnedSlugs.value.indexOf(slug)
  toggle(slug)
  undoToast(`已從自選指標刪除 ${label}`, () => {
    if (pinnedSlugs.value.includes(slug)) return
    const next = [...pinnedSlugs.value]
    next.splice(Math.min(position, next.length), 0, slug)
    pinnedSlugs.value = next
  }, () => {})
}
async function moveRow(slug: string, offset: -1 | 1, label: string) {
  move(slug, offset)
  const position = rows.value.findIndex(row => row.slug === slug)
  orderAnnouncement.value = `${label} 移到第 ${position + 1} 個`
  await nextTick()
  const atEdge = offset < 0 ? position === 0 : position === rows.value.length - 1
  document.getElementById(`quick-view-${atEdge ? (offset < 0 ? 'down' : 'up') : (offset < 0 ? 'up' : 'down')}-${slug}`)?.focus()
}

// 格子最後一格固定是「加入指標」（2026-10-07「grid最後一個欄位永遠是個placeholder，按下以後打開彈窗，
// 這個彈窗可以選要加入的指標」）。彈窗列的是全部指標頁同一份目錄、同一個分組；按一下就釘／取消，
// 跟側邊欄共用同一份清單，所以沒有「確定」鈕——關掉就是完成。
const pickerOpen = ref(false)
const slugOf = (node: StockNavNode) => node.to!('_').split('/').pop()!
const pickerGroups = STOCK_METRIC_INDEX
  .map(group => ({ label: group.label, children: (group.children ?? []).filter(link => hasPinnableChart(slugOf(link))) }))
  .filter(group => group.children.length)

// 河流圖與互動卡片自己讀資料；其餘的圖跟它那一頁讀同一支端點（Nitro 快取的同一份），有釘那一種才抓。以 kind 為鍵：
// metric-pages.ts 新增一種 kind 而這裡漏接，typecheck 會報。配股配息 2026-10-15 起畫這檔自己的殖利率走勢（全市場分布留在那一頁）
const PAGE_DATA: Record<Exclude<QuickViewChart['kind'], 'river' | 'metric'>, string> = {
  'dividend': 'dividend-yield-history',
  'monthly-revenue': 'monthly-revenue',
  'monthly-revenue-growth': 'monthly-revenue',
  'dupont': 'dupont',
  'balance': 'balance-composition',
  'cash-flow': 'cash-flow-composition',
  'book-value-flow': 'book-value-breakdown',
  'margins': 'margins',
  'solvency': 'solvency',
  'cash-cycle': 'series?page=cash-cycle'
}
const pinnedKinds = computed(() => new Set(pinnedSlugs.value.map(slug => quickViewChartOf(slug)?.kind)))
const pageData = new Map<string, Ref<unknown>>()
function usePageData<T>(kind: keyof typeof PAGE_DATA) {
  const { data } = useAsyncData(
    () => `quick-view-${kind}-${code.value}`,
    async () => {
      if (!pinnedKinds.value.has(kind)) return null
      const response = await $fetch<T>(`/api/stock/${code.value}/${PAGE_DATA[kind]}`, { retry: 0, timeout: BUSINESS_REQUEST_TIMEOUT_MS }).catch(() => null)
      // 上游讀不到時伺服器回 200、series 或某個群組是 null（各頁當讀取失敗處理，見 margins.vue 的 readFailed）：這裡同樣當成沒讀到
      const partial = response as { series?: unknown; groups?: Record<string, unknown> } | null
      return partial?.series === null || Object.values(partial?.groups ?? {}).includes(null) ? null : response
    },
    { server: false, watch: [pinnedSlugs], default: () => null }
  )
  pageData.set(kind, data)
  return data
}
// 讀到了卻沒有可以畫的（金融業不分流動與非流動、沒有存貨與應收帳款…）說一句，不要只留標題；讀取中與讀不到（null）留空，
// 照全站「讀不到不說沒有資料」的慣例
const loadedEmpty = (kind: QuickViewChart['kind']) => pageData.get(kind)?.value != null
const dividendYieldHistory = usePageData<StockDividendYieldHistoryResponse>('dividend')
const monthlyRevenue = usePageData<StockMonthlyRevenuePageResponse>('monthly-revenue')
const monthlyRevenueGrowth = usePageData<StockMonthlyRevenuePageResponse>('monthly-revenue-growth')
const dupont = usePageData<StockDupontPageResponse>('dupont')
const balanceComposition = usePageData<StockBalanceCompositionResponse>('balance')
const cashFlowComposition = usePageData<StockCashFlowCompositionResponse>('cash-flow')
const bookValueFlow = usePageData<StockBookValueBreakdownResponse>('book-value-flow')
const marginsData = usePageData<StockMarginsPageResponse>('margins')
const solvencyData = usePageData<StockSolvencyPageResponse>('solvency')
const cashCycleSeries = usePageData<StockSeriesResponse>('cash-cycle')
// 金融業的資產負債表不分流動與非流動，那兩塊沒有可畫的期別：落到下面的空卡，不要整格消失
const hasBalanceRows = (part: BalanceCompositionKind) => !!balanceComposition.value?.periods.some(period => pickBalanceComposition(part, period))
const cashCycleEntry = computed(() => latestCashCycleEntry(cashCycleSeries.value?.groups?.TTM_CYCLE_20?.entries ?? []))

// 沒有單一數值的頁（財報三率的關係）是空字串：圖卡標題後面不接東西，表格那一格自己印「－」
function valueText(field: string | null, slug?: string): string {
  if (!field) return ''
  const cell = values.value[field]
  // 還沒讀完就是「…」。看 status 不看 pending（2026-10-08 server: false 時量到 hydration 警告 ×5；現在伺服器端也抓，仍照這個判斷）
  if (valuesStatus.value !== 'success' && valuesStatus.value !== 'error' && !cell) return '…'
  if (cell?.value == null) return '－'
  const located = locateFieldInSchema(schema.value?.categories ?? [], field)
  return `${(slug && VALUE_PREFIX[slug]) ?? ''}${formatScreenerValue(cell.value, located?.field.unit, field, located?.metric.options)}`
}
function periodText(field: string | null): string {
  if (!field) return '整頁內容'
  const basis = field.split('.')[1] as MetricsHistoryTimeframe | 'EOD'
  const cell = values.value[field]
  return `${(TIMEFRAME_LABELS as Record<string, string | undefined>)[basis] ?? basis}${cell?.knowledgeDate ? `（${cellPeriodText(cell)}）` : ''}`
}

const sectorCode = computed(() => profile.value?.sectorCode ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: TOPIC, titleKeywords: '本益比、殖利率、EPS 指標速覽', pathSuffix: '', stock, summary, description, sectorCode })
</script>

<template>
  <StockPageShell
    class="app-page app-page--compact stock-quick-view-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :is-emerging="profile?.isEmerging ?? null"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="{ sources: dataSources }"
  >
    <StockQuestionSection id="stock-quick-view" :question="`${stockShortName}的自選指標最新是多少？`" answer="側邊欄「自選指標」裡的每一項，這檔股票最新一期的數字。點名稱可以看它的歷年變化。">
      <!-- 圖在表前（2026-09-27 規則）。釘選清單只在瀏覽器裡，所以圖也只在瀏覽器畫 -->
      <ClientOnly>
        <div class="stock-quick-view-page__grid">
        <!-- 每張圖自己就是圖卡（SharedChartCard，2026-10-14 起個股頁的圖一律由它包），標題從 #header 傳進去；資料還沒到的先放只有標題的空卡 -->
        <template v-for="item in charts" :key="item.slug">
        <StockDividendYieldHistoryChart v-if="item.spec.kind === 'dividend' && dividendYieldHistory?.entries?.length" :entries="dividendYieldHistory.entries" :cash-dividends="dividendYieldHistory.cashDividends">
          <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
        </StockDividendYieldHistoryChart>
        <StockValuationRiverChart v-else-if="item.spec.kind === 'river'" :symbol="code" :kind="item.spec.river">
          <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
        </StockValuationRiverChart>
        <StockMonthlyRevenueChart v-else-if="item.spec.kind === 'monthly-revenue' && monthlyRevenue?.entries?.length" measure="amount" :entries="monthlyRevenue.entries" :monthly-prices="monthlyRevenue.monthlyPrices" :price-break-months="monthlyRevenue.priceBreakMonths">
          <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
        </StockMonthlyRevenueChart>
        <StockMonthlyRevenueChart v-else-if="item.spec.kind === 'monthly-revenue-growth' && monthlyRevenueGrowth?.entries?.length" measure="yoy" :entries="monthlyRevenueGrowth.entries" :monthly-prices="monthlyRevenueGrowth.monthlyPrices" :price-break-months="monthlyRevenueGrowth.priceBreakMonths">
          <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
        </StockMonthlyRevenueChart>
        <StockDupontChart v-else-if="item.spec.kind === 'dupont' && dupont?.series" :data="dupont">
          <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
        </StockDupontChart>
        <StockBalanceCompositionChart
          v-else-if="item.spec.kind === 'balance' && balanceComposition && hasBalanceRows(item.spec.part)"
          :periods="balanceComposition.periods"
          :kind="item.spec.part"
          :short-name="stockShortName"
          :code="code"
          :table-section-id="`quick-view-${item.slug}-table`"
          chart-only
        >
          <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
        </StockBalanceCompositionChart>
        <StockBalanceCompositionChart
          v-else-if="item.spec.kind === 'cash-flow' && cashFlowComposition?.periods.some(period => period.cashFlow)"
          :periods="cashFlowComposition.periods"
          kind="cashFlow"
          :short-name="stockShortName"
          :code="code"
          :table-section-id="`quick-view-${item.slug}-table`"
          chart-only
        >
          <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
        </StockBalanceCompositionChart>
        <StockBookValueFlowChart v-else-if="item.spec.kind === 'book-value-flow' && bookValueFlow?.entries?.length" :entries="bookValueFlow.entries">
          <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
        </StockBookValueFlowChart>
        <StockRatioLinesChart v-else-if="item.spec.kind === 'margins' && marginsData?.series" page="margins" :entries="marginsData.series.entries">
          <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
        </StockRatioLinesChart>
        <StockRatioLinesChart v-else-if="item.spec.kind === 'solvency' && solvencyData?.series" page="solvency" :entries="solvencyData.series.entries">
          <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
        </StockRatioLinesChart>
        <StockCashCycleTimeline v-else-if="item.spec.kind === 'cash-cycle' && cashCycleEntry" :entry="cashCycleEntry">
          <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
        </StockCashCycleTimeline>
        <StockMetricHistoryChartInteractive
          v-else-if="item.spec.kind === 'metric'"
          :symbol="code"
          :metric-code="item.spec.metricCode"
          :topic="item.spec.topic"
          :unit="findMetricInSchema(categories, item.spec.metricCode)?.metric.unit ?? ''"
          :default-timeframe="item.spec.timeframe"
          :available-timeframes="timeframesOf(item.spec.metricCode)"
          :part-codes="item.spec.partCodes"
          :part-names="item.spec.partCodes?.map(partCode => findMetricInSchema(categories, partCode)?.metric.name ?? partCode)"
          :compare-metric-code="item.spec.compareMetricCode"
          :compare-name="item.spec.compareMetricCode && nameOf(item.spec.compareMetricCode)"
          :compare-timeframes="item.spec.compareMetricCode ? timeframesOf(item.spec.compareMetricCode) : undefined"
          :right-metric="item.spec.rightMetricCode ? { code: item.spec.rightMetricCode, name: findMetricInSchema(categories, item.spec.rightMetricCode)?.metric.name ?? item.spec.rightMetricCode, unit: findMetricInSchema(categories, item.spec.rightMetricCode)?.metric.unit ?? '', timeframes: timeframesOf(item.spec.rightMetricCode) } : undefined"
        >
          <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
        </StockMetricHistoryChartInteractive>
        <SharedChartCard v-else>
          <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
          <p v-if="loadedEmpty(item.spec.kind)" class="stock-quick-view-page__chart-empty">目前沒有這張圖的資料。</p>
        </SharedChartCard>
        </template>
        <button type="button" class="stock-quick-view-page__add" @click="pickerOpen = true">
          <el-icon aria-hidden="true"><Plus /></el-icon>加入指標
        </button>
        </div>
        <el-dialog v-model="pickerOpen" title="加入指標" width="min(720px, 92vw)">
          <p class="stock-quick-view-page__picker-status" aria-live="polite">
            已加入 {{ pinnedSlugs.length }} / {{ PINNED_METRIC_LIMIT }} 個{{ isFull ? '，已到上限，先取消一個才能再加' : '' }}
          </p>
          <section v-for="group in pickerGroups" :key="group.label" class="stock-quick-view-page__picker-group">
            <h3 class="stock-quick-view-page__picker-title">{{ group.label }}</h3>
            <ul class="stock-quick-view-page__picker-list">
              <li v-for="link in group.children" :key="slugOf(link)">
                <button
                  type="button"
                  class="stock-quick-view-page__picker-item"
                  :class="{ 'is-pinned': isPinned(slugOf(link)) }"
                  :aria-pressed="isPinned(slugOf(link))"
                  :disabled="!isPinned(slugOf(link)) && isFull"
                  @click="toggle(slugOf(link))"
                >
                  <el-icon aria-hidden="true"><component :is="isPinned(slugOf(link)) ? Check : Plus" /></el-icon>{{ link.label }}
                </button>
              </li>
            </ul>
          </section>
        </el-dialog>
        <!-- 接手前（伺服器輸出與 hydration 那一刻）：同一個格子、同樣大小的空卡，標題照畫。原本這裡什麼都沒有，圖到了才整片出現，
             把下面的表格推出畫面——2026-10-18 全站量測 /stock/2330 1440 寬 0.227、375 寬 0.289 -->
        <template #fallback>
          <div class="stock-quick-view-page__grid">
            <SharedChartCard v-for="item in charts" :key="item.slug">
              <template #header><h3 class="stock-quick-view-page__chart-title"><NuxtLink :to="item.to" class="hub-inline-link">{{ item.label }}</NuxtLink> <span class="stock-quick-view-page__chart-value">{{ valueText(item.field, item.slug) }}</span></h3></template>
              <div class="stock-quick-view-page__placeholder" aria-hidden="true" />
            </SharedChartCard>
            <button type="button" class="stock-quick-view-page__add">
              <el-icon aria-hidden="true"><Plus /></el-icon>加入指標
            </button>
          </div>
        </template>
      </ClientOnly>
    </StockQuestionSection>

    <!-- 表格自成一段、有自己的 h2（2026-10-07「quick-view 表格幫我加上H2」） -->
    <StockQuestionSection id="stock-quick-view-table" question="這些數字是哪一期的？" answer="每一項的期別與資料時間。每一列都可以調整順序或刪除，上面的卡片與側邊欄會跟著變。">
      <!-- 不畫捲動區（:scrollable="false"）：窄的時候是堆疊列、寬的時候四欄放得下，兩種都不需要左右捲動。
           卡片本身是窄寬切換的容器（.stock-quick-view-page__table-wrap） -->
      <SharedTable
        v-if="rows.length"
        :label="`${stockShortName} ${code} 的自選指標最新數值與期別`"
        table-class="stock-quick-view-page__table"
        :scrollable="false"
        class="stock-quick-view-page__table-wrap"
      >
        <thead>
          <tr>
            <th scope="col">指標</th>
            <th scope="col" class="seo-table__num">最新數值</th>
            <th scope="col">期別（資料時間）</th>
            <th scope="col">調整</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="row.slug">
            <th scope="row"><NuxtLink :to="row.to" class="seo-table__link">{{ row.label }}</NuxtLink></th>
            <td class="seo-table__num">{{ valueText(row.field, row.slug) || '－' }}</td>
            <td data-label="期別">{{ periodText(row.field) }}</td>
            <td class="stock-quick-view-page__order">
              <div class="stock-quick-view-page__order-buttons">
              <button :id="`quick-view-up-${row.slug}`" type="button" class="stock-quick-view-page__move" :disabled="index === 0" :aria-label="`${row.label} 上移`" @click="moveRow(row.slug, -1, row.label)">
                <el-icon aria-hidden="true"><Top /></el-icon>上移
              </button>
              <button :id="`quick-view-down-${row.slug}`" type="button" class="stock-quick-view-page__move" :disabled="index === rows.length - 1" :aria-label="`${row.label} 下移`" @click="moveRow(row.slug, 1, row.label)">
                <el-icon aria-hidden="true"><Bottom /></el-icon>下移
              </button>
              <button type="button" class="stock-quick-view-page__move" :aria-label="`從自選指標刪除 ${row.label}`" @click="removeRow(row.slug, row.label)">
                <el-icon aria-hidden="true"><Delete /></el-icon>刪除
              </button>
              </div>
            </td>
          </tr>
        </tbody>
      </SharedTable>
      <p v-else class="stock-quick-view-page__empty">
        還沒有釘選任何指標。到<NuxtLink :to="`/stock/${code}/metrics`">指標總覽</NuxtLink>把想常看的釘到側邊欄。
      </p>
      <p class="visually-hidden" aria-live="polite">{{ orderAnnouncement }}</p>
    </StockQuestionSection>
  </StockPageShell>
</template>

<style scoped>

/* 卡片排成格狀（2026-10-07「quick-view 圖表希望grid排列」）；欄寬下限讓窄螢幕自然落回單欄。最多三欄（2026-10-17「quick-view 滿版
   的時候最多給3columns就好」）：下限取 480px 與三分之一寬（扣兩個 gap）較大的那個，再寬也排不出第四欄 */
.stock-quick-view-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(max(min(100%, 480px), (100% - 2 * 16px) / 3), 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

/* 格子的間距由 grid gap 負責，圖卡自己的下邊距在這裡不要；min-width 0 讓窄格子裡的圖可以縮 */
.stock-quick-view-page__grid > * {
  min-width: 0;
}

.stock-quick-view-page__grid :deep(.shared-chart-card) {
  margin-bottom: 0;
}

.stock-quick-view-page__chart-title {
  margin: 0;
  font-size: 18px;
}

.stock-quick-view-page__chart-empty {
  margin: 0;
}

/* 佔位卡的內容區＝圖卡的控制列＋間距＋圖（320px，全站圖表統一的高度）。控制列在窄卡片是 44px、卡片寬 ≥520px 是 32px，
   用跟 SharedChartCard 同一個容器條件切換（它的 container-type 在 .shared-chart-card 上）。量到的真卡片：1440 寬 454px、375 寬第一張 466px */
.stock-quick-view-page__placeholder {
  height: calc(44px + 8px + 320px);
}

@container (min-width: 520px) {
  .stock-quick-view-page__placeholder {
    height: calc(32px + 8px + 320px);
  }
}

.stock-quick-view-page__chart-value {
  margin-left: 8px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

/* 虛線外框＝空位，跟實心的圖表卡片一眼分得出來；同一列裡會被 grid 撐到跟旁邊的卡片一樣高 */
.stock-quick-view-page__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 88px;
  border: 2px dashed var(--el-border-color);
  border-radius: var(--el-card-border-radius, 4px);
  background: transparent;
  color: var(--el-color-primary-dark-2);
  font: inherit;
  font-size: 18px;
  cursor: pointer;
}

/* 跟旁邊的圖表卡同一列時才需要撐高 */
@media (min-width: 720px) {
  .stock-quick-view-page__add {
    min-height: 160px;
  }
}

.stock-quick-view-page__add:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.stock-quick-view-page__picker-status {
  margin: 0 0 8px;
  color: var(--el-text-color-regular);
}

.stock-quick-view-page__picker-group + .stock-quick-view-page__picker-group {
  margin-top: 16px;
}

.stock-quick-view-page__picker-title {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.stock-quick-view-page__picker-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stock-quick-view-page__picker-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font: inherit;
  cursor: pointer;
}

/* 已加入：實心底＋勾號，不只靠顏色 */
.stock-quick-view-page__picker-item.is-pinned {
  border-color: var(--el-color-primary-dark-2);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary-dark-2);
  font-weight: 600;
}

.stock-quick-view-page__picker-item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* 表格 mobile first：基本樣式是堆疊列，每一列三行——名稱｜數值、「期別：…」、三顆按鈕。
   表格區塊寬 ≥860px 才還原成四欄表格（1024 視窗有側邊欄時內容只剩約 729px，四欄＋三顆按鈕放不下）。
   只改 CSS 不出第二份 DOM。 */
.stock-quick-view-page__table-wrap {
  container-type: inline-size;
}

/* <table> 是 SharedTable 畫的，不帶這一頁的 scoped 屬性：直接對表格本身的規則要用 :deep（從帶著這一頁屬性的卡片往下找） */
:deep(.stock-quick-view-page__table) {
  display: block;
  background: none;
}

/* 手機：一張卡片（SharedTable）裡一列一列，列與列之間全站表格那一條淡線（2026-10-23；原本每一列自己一張小卡片，包進表格卡片之後
   會變成卡片包卡片） */
.stock-quick-view-page__table tbody {
  display: grid;
}

.stock-quick-view-page__table thead {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.stock-quick-view-page__table tbody tr {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--app-divider);
}

.stock-quick-view-page__table tbody tr:last-child {
  border-bottom: 0;
}

.stock-quick-view-page__table tbody th,
.stock-quick-view-page__table tbody td {
  position: static;
  padding: 0;
  border: 0;
  white-space: normal;
  background: none;
}

.stock-quick-view-page__table tbody th {
  font-size: 18px;
  font-weight: 600;
}

/* 數值是這一列的重點：放大、加粗、等寬數字 */
.stock-quick-view-page__table tbody td.seo-table__num {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.stock-quick-view-page__table td[data-label],
.stock-quick-view-page__order {
  grid-column: 1 / -1;
}

.stock-quick-view-page__table td[data-label] {
  color: var(--el-text-color-secondary);
}

.stock-quick-view-page__table td[data-label]::before {
  content: attr(data-label) '：';
}

.stock-quick-view-page__table tbody td.stock-quick-view-page__order {
  padding-top: 8px;
}

/* 三顆等寬、淺底無框：五列重複時比有框按鈕安靜 */
.stock-quick-view-page__order-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stock-quick-view-page__move {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  font: inherit;
  cursor: pointer;
}

.stock-quick-view-page__move:not(:disabled):hover {
  background: var(--el-fill-color);
}

.stock-quick-view-page__move:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* 表格區塊寬 ≥860px：還原成四欄表格，外觀同改版前 */
@container (min-width: 860px) {
  :deep(.stock-quick-view-page__table) {
    display: table;
    background: var(--app-card-bg);
  }

  .stock-quick-view-page__table thead {
    position: static;
    width: auto;
    height: auto;
    overflow: visible;
    clip-path: none;
  }

  .stock-quick-view-page__table tbody {
    display: table-row-group;
  }

  .stock-quick-view-page__table tbody tr {
    display: table-row;
    padding: 0;
    border: 0;
    border-radius: 0;
  }

  /* 還原全站表格的格子（main.css 的 .seo-table th/td）：內距、淡的列線、第一欄與最後一欄離卡片邊 16px；按鈕列高 44px，文字欄垂直置中 */
  .stock-quick-view-page__table tbody th,
  .stock-quick-view-page__table tbody td {
    padding: 9px 12px;
    border-bottom: 1px solid var(--app-divider);
    vertical-align: middle;
  }

  .stock-quick-view-page__table tbody th:first-child {
    padding-left: 16px;
  }

  .stock-quick-view-page__table tbody td:last-child {
    padding-right: 16px;
  }

  .stock-quick-view-page__table tbody th {
    font-size: 1rem;
    font-weight: 500;
  }

  .stock-quick-view-page__table tbody td.seo-table__num {
    font-size: 1rem;
    font-weight: 400;
  }

  .stock-quick-view-page__table td[data-label] {
    color: inherit;
  }

  .stock-quick-view-page__table td[data-label]::before {
    content: none;
  }

  .stock-quick-view-page__order-buttons {
    display: flex;
  }

  .stock-quick-view-page__move {
    padding: 0 12px;
    border: 1px solid var(--el-border-color);
    background: var(--app-card-bg);
  }
}

.stock-quick-view-page__empty {
  margin: 12px 0 0;
  color: var(--el-text-color-regular);
}
</style>
