<script setup lang="ts">
import { Bottom, Check, Delete, Plus, Search, Top } from '@element-plus/icons-vue'
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
import type { ShareholdingDistribution } from '#shared/types/screener-detail'
import type { StockNewsResponse } from '#shared/types/stock-news'
import type { RadarBreakdown } from '~/utils/six-dimensions'
import type { CyclicalityBreakdown } from '~/utils/cyclicality'
import type { RiverCellsByTimeframe, RiverLatest, RiverMissing } from '#shared/types/stock-metric-page'
import type { RiverKind } from '#shared/utils/metric-pages'
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
// 摘要只拿來寫 meta description：瀏覽器裡換頁不等它（lazy，2026-10-23 換頁延遲）
const [, { description }] = await Promise.all([
  useFilterSchema(),
  useStockPageDigest(code, 'index', { shortName: stockShortName, lazy: true })
])
const { data: schema } = useNuxtData<{ categories: Parameters<typeof locateFieldInSchema>[0] }>('filter-schema')

const { pinnedSlugs, isPinned, isFull, toggle, move } = useStockPinnedMetrics()

// 基本資料卡（2026-11-08，使用者：「這個卡片要跟指標一樣 可以自選」）：釘了才讀公司資料的完整那份；格子裡是 8 列的表格卡片。
// 「今天」從伺服器帶到瀏覽器（同基本資料頁），上市櫃幾年在 hydration 時不會差一天
const { data: profileDetail, status: profileStatus } = useCompanyProfileDetail(code, () => pinnedSlugs.value.includes('profile'))
const taipeiToday = useState('taipei-today', () => holdingsTaipeiDate())
const profileFacts = computed(() => (profileDetail.value ? profileCardFacts(profileDetail.value, taipeiToday.value) : []))
const profileDateText = computed(() => (profileDetail.value?.generatedDate ? `出表日 ${profileDetail.value.generatedDate}` : '整頁內容'))

// 釘選的是「頁面」（slug），不是指標欄位。對應成 /screener/values 的欄位：
//   - 指標頁：METRIC_PAGES 的 metricCode＋timeframe
//   - 配股配息：自算的現金殖利率（那一頁回答的就是「領多少」；2026-10-25 從交易所公布值換過來，同篩選與排行）
//   - 月營收年增率：近三個月累計營收年增率（型錄裡月頻率的那一支；單月年增率不在型錄）。月營收（金額）型錄沒有，只畫圖、不給數值
//   - 杜邦分析：近四季 ROE（三項乘出來的那個數）
//   - 淨值從哪來：每股淨值；股東回饋組成、營業費用組成：組成的母項
//   - 資產負債表的四張組成：那一塊占總資產的比率（淨值組成是股東權益比率），同 StockBalanceCompositionPage 的 metricCode
//   - 償債能力比率：流動比率（那一頁的主線）；現金循環的組成：現金轉換循環（時間軸最後算出來的那一段）
//   - 財報三率是三個數並列，沒有單一數值，只給連結
const SPECIAL_FIELDS: Record<string, string> = {
  'dividend': 'liveCashDividendYield.EOD',
  'monthly-revenue-growth': 'revenueYoy3m.M',
  'dupont': 'roe.TTM',
  'equity-source': 'bvps.Q',
  'shareholder-yield-composition': 'shareholderYield.FY',
  'operating-expense-composition': 'operatingExpensePerShare.TTM',
  'net-revenue-composition': 'bankNetRevenuePerShare.TTM',
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
  return metricPage ? `${metricPage.metricCode}.${metricPage.timeframe}` : null
}
// 數值跟列名不是同一件事時，數值前面說清楚是什麼（「月營收 139.32%」會被讀成營收本身）
// 依頁面（slug）而不是欄位：杜邦分析與 ROE 頁是同一個欄位 roe.TTM，只有杜邦那一列要說明它是 ROE
const VALUE_PREFIX: Record<string, string> = {
  'monthly-revenue-growth': '近三個月年增率 ',
  'dupont': 'ROE ',
  'equity-source': '每股淨值 ',
  'shareholder-yield-composition': '股東總回饋率 ',
  'operating-expense-composition': '每股營業費用 ',
  'net-revenue-composition': '每股淨收益 ',
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
// 金控的資本適足率（METRIC_PAGES 的 holdingMetricCode）：兩支都問，主欄位沒有值、改畫的那一支有（金控）就寫它，同卡片的圖（drawnMetricCode）
function holdingFieldOf(slug: string): string | null {
  const metricPage = METRIC_PAGES.find(page => page.slug === slug)
  return metricPage?.holdingMetricCode ? `${metricPage.holdingMetricCode}.${metricPage.timeframe}` : null
}
const knownField = (field: string | null) => (field && isKnownField(field) ? field : null)
const rows = computed(() =>
  pinnedSlugs.value.flatMap(slug => {
    const node = METRIC_INDEX_BY_SLUG.get(slug)
    if (!node) return []
    const field = knownField(fieldOf(slug))
    const holding = knownField(holdingFieldOf(slug))
    const shown = holding && values.value[field ?? '']?.value == null && values.value[holding]?.value != null ? holding : field
    return [{ slug, label: node.label, to: node.to!(code.value), field: shown }]
  })
)
// 要問的欄位跟著釘選走，不跟著上面寫了哪一支（那要等值回來，跟著它會變成值回來就重問）
const fields = computed(() => [...new Set(pinnedSlugs.value.flatMap(slug => (METRIC_INDEX_BY_SLUG.has(slug) ? [knownField(fieldOf(slug)), knownField(holdingFieldOf(slug))] : [])).filter((field): field is string => !!field))])
// 頁尾的資料來源（2026-10-11 補上）：釘選的那幾個欄位各自的型錄來源
const dataSources = computed(() => collectMetricSources(schema.value?.categories ?? [], rows.value.flatMap(row => (row.field ? [row.field.split('.')[0]!] : []))))

interface ScreenerValue { value: string | number | null; knowledgeDate: string | null; fiscalYear?: number | null; fiscalQuarter?: number | null; yearMonth?: string | null }
// 鍵用排好的欄位：調整順序不是換一批欄位，不重抓（2026-11-13 前每按一次上移／下移就重抓同一份）
const fieldsKey = computed(() => [...fields.value].sort().join(','))
const { data: values, status: valuesStatus, error: valuesError, refresh: refreshValues } = useAsyncData(
  () => `quick-view-${code.value}-${fieldsKey.value}`,
  async () => {
    if (!fields.value.length) return {}
    const response = await fetchScreenerValues<ScreenerValue>([code.value], fields.value)
    return response.results[0]?.values ?? {}
  },
  // 伺服器端算的是預設釘選（給搜尋引擎）；登入後同步成帳號的釘選，欄位換了再抓一次
  { watch: [fieldsKey], default: () => ({}) as Record<string, ScreenerValue | undefined> }
)
// 讀不到時交給全站的讀取失敗彈窗（AppLoadFailureDialog），畫面上不再各自出訊息
watchLoadFailure(() => `quick-view-values:${code.value}`, () => valuesError.value, refreshValues)

// 河流圖那幾列（本益比、股價淨值比、股價營收比）的數字是圖的最後一點（2026-11-01，使用者選「摘要用圖的最新一點」，表格也一樣）：
// 圖的預設期別那一份，伺服器端就算好（表格給搜尋引擎）。卡片標題在圖讀到之前也先用它
const riverKindOf = (slug: string): RiverKind | null => {
  const spec = quickViewChartOf(slug)
  return spec?.kind === 'river' ? spec.river : null
}
// 排好的：同上，調整順序不重抓
const riverKinds = computed(() => [...new Set(rows.value.flatMap(row => riverKindOf(row.slug) ?? []))].sort())
type RiverLatestByKind = Partial<Record<RiverKind, RiverCellsByTimeframe>>
const riverKindsKey = computed(() => riverKinds.value.join(','))
const { data: riverLatestByKind, status: riverStatus } = useAsyncData<RiverLatestByKind>(
  () => `quick-view-river-${code.value}-${riverKindsKey.value}`,
  async () => (riverKinds.value.length
    ? await $fetch<RiverLatestByKind>(`/api/stock/${code.value}/river-latest`, { query: { kinds: riverKindsKey.value }, retry: 0, timeout: BUSINESS_REQUEST_TIMEOUT_MS }).catch(() => ({}))
    : {}),
  { watch: [riverKindsKey], default: () => ({}) }
)
// undefined＝還在讀，null＝讀不到，RiverMissing＝那天沒有比值（帶數據中台的原因）
function riverLatestOfRow(slug: string): RiverLatest | RiverMissing | null | undefined {
  const kind = riverKindOf(slug)
  if (!kind || (riverStatus.value !== 'success' && riverStatus.value !== 'error')) return undefined
  return riverLatestByKind.value[kind]?.[RIVER_TIMEFRAMES[kind][0]!] ?? null
}
function riverPeriodText(slug: string): string {
  const kind = riverKindOf(slug)!
  const latest = riverLatestOfRow(slug)
  return `${TIMEFRAME_LABELS[RIVER_TIMEFRAMES[kind][0]!]}${latest && 'tradeDate' in latest ? `（${latest.tradeDate} 收盤）` : ''}`
}
// 沒有比值那格滑過去的說明，同其他表格（nullReasonTitle）
function riverTitle(slug: string): string | undefined {
  const latest = riverLatestOfRow(slug)
  return latest && 'nullReason' in latest ? nullReasonTitle({ value: null, nullReason: latest.nullReason }) : undefined
}
// 卡片標題跟圖自己的期別走：圖說沒有比值、而且表格那格（預設期別）也沒有，才寫那格的原因，否則「－」
function riverHeaderText(latest: RiverLatest | null | undefined, slug: string, field: string | null): string {
  const row = riverLatestOfRow(slug)
  return riverValueText(latest === undefined || (latest === null && row && 'nullReason' in row) ? row : latest, field)
}

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
// 興櫃沒有六面向與景氣循環度（只算上市櫃）：那兩張卡片不畫，伺服器先畫的佔位也沒有，不會先留一塊再消失
const LISTED_ONLY_KINDS: ReadonlySet<string> = new Set(['six-dimensions', 'cyclicality'])
const charts = computed(() => rows.value.flatMap(row => {
  const spec = quickViewChartOf(row.slug)
  return spec && !(LISTED_ONLY_KINDS.has(spec.kind) && profile.value?.market === 'rotc') ? [{ ...row, spec }] : []
}))

// 每張卡片讀取中的高度（2026-11-28）：佔位原本一律照「控制列 44＋間距 8＋圖 320」畫，但卡片畫好之後高矮不一（手機上控制列折成兩列、
// 折線圖的圖例另外佔位、基本資料是 8 列），2330 在 375 寬量到七張卡片各差 −20～+112px（基本資料 462→442、ROE 462→574），資料一到
// 下面整頁跟著動。畫好之後記下每張卡片內容區（.el-card__body）的高度（cookie，伺服器讀得到）：下次伺服器先畫的佔位、資料還沒到的骨架都
// 照它，重新整理不動；第一次來用下面的預設，可能動一次（同 useLayoutHint）。卡片窄（<520px，SharedChartCard 換排法的寬度）與寬的時候
// 高度不同，各記一份（n、w）；只留現在釘選的那幾張
type HeightHints = { n?: Record<string, number>, w?: Record<string, number> }
const heightHints = useCookie<HeightHints | null>('layout-hint-quick-view', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
// 預設的內容區高度（含上下內距 24；窄、寬）：圖卡是控制列 32＋間距 12＋圖 320；基本資料 8 列各 2.75rem；六面向、近期新聞與景氣循環度是它們自己的
// 最小高度（.stock-quick-view-page__six、StockNewsCard 的 .news-card、StockCyclicalityCard 的 .cycle-card）；現金殖利率的控制列下面少 4，窄卡片上圖例另外佔 80（兩個固定的圖例）。
// 其他折線圖的圖例折幾行看指標名稱，預設猜不準，第一次來會動一次、之後照記下來的
const BODY_DEFAULTS: Partial<Record<QuickViewChart['kind'], [string, string]>> = {
  'profile': ['calc(8 * 2.75rem + 24px)', 'calc(8 * 2.75rem + 24px)'],
  'six-dimensions': ['396px', '384px'],
  'cyclicality': ['396px', '384px'],
  'news': ['396px', '384px'],
  'dividend': ['464px', '384px']
}
// cookie 是瀏覽器送來的：只收合理的數字，其餘當沒有
function heightHint(key: 'n' | 'w', slug: string) {
  const value = heightHints.value?.[key]?.[slug]
  return typeof value === 'number' && value >= 24 && value <= 2000 ? `${Math.round(value)}px` : null
}
function bodyVars(item: { slug: string, spec: QuickViewChart }) {
  // 有好幾種期別的指標圖：窄卡片上期別切換折到控制列的第二列（多 40）
  const twoControlRows = item.spec.kind === 'metric' && timeframesOf(item.spec.metricCode).length > 1
  const [narrow, wide] = BODY_DEFAULTS[item.spec.kind] ?? [twoControlRows ? '428px' : '388px', '388px']
  return { '--qv-body-narrow': heightHint('n', item.slug) ?? narrow, '--qv-body-wide': heightHint('w', item.slug) ?? wide }
}
// 畫好的卡片（內容區有東西、裡面沒有骨架）拿掉上面的高度，照自己的內容；全部畫好、靜下來半秒之後量一次記下來（還有卡片在讀的時候，
// 同一列的卡片會被它的佔位撐高，量到的不是自己的高度）。讀不到的卡片內容區是空的，不算畫好：照舊佔著位置，也不會把空的記成它的高度
const grid = ref<HTMLElement | null>(null)
const drawnSlugs = ref<string[]>([])
let rememberTimer: ReturnType<typeof setTimeout> | undefined
let remembered = false
function sweepCards() {
  const cells = [...(grid.value?.querySelectorAll<HTMLElement>('.stock-quick-view-page__cell') ?? [])]
  const drawn = cells.filter(cell => cell.querySelector('.el-card__body')?.childElementCount && !cell.querySelector('.app-skeleton'))
  const slugs = drawn.map(cell => cell.dataset.slug ?? '')
  if (slugs.join() !== drawnSlugs.value.join()) drawnSlugs.value = slugs
  clearTimeout(rememberTimer)
  if (drawn.length < cells.length) remembered = false
  else if (!remembered && cells.length) rememberTimer = setTimeout(rememberHeights, 500)
}
function rememberHeights() {
  remembered = true
  const next: Required<HeightHints> = { n: {}, w: {} }
  for (const cell of grid.value?.querySelectorAll<HTMLElement>('.stock-quick-view-page__cell') ?? []) {
    const [slug, card, body] = [cell.dataset.slug ?? '', cell.firstElementChild, cell.querySelector('.el-card__body')]
    if (!card || !body) continue
    const [key, other] = card.getBoundingClientRect().width >= 520 ? ['w', 'n'] as const : ['n', 'w'] as const
    next[key][slug] = Math.round(body.getBoundingClientRect().height)
    const kept = heightHints.value?.[other]?.[slug]
    if (typeof kept === 'number') next[other][slug] = kept
  }
  if (JSON.stringify(next) !== JSON.stringify(heightHints.value)) heightHints.value = next
}
let sweepFrame = 0
const cardObserver = import.meta.client
  ? new MutationObserver(() => {
      cancelAnimationFrame(sweepFrame)
      sweepFrame = requestAnimationFrame(sweepCards)
    })
  : null
watch(grid, (element) => {
  cardObserver?.disconnect()
  if (!element) return
  cardObserver?.observe(element, { childList: true, subtree: true })
  sweepCards()
})
onBeforeUnmount(() => {
  cardObserver?.disconnect()
  clearTimeout(rememberTimer)
})

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
// 搜尋（2026-11-15，使用者：「加入指標彈窗 這邊要放搜尋欄位」）：名稱、英文縮寫或型錄別名裡有就列，沒有的分組整組不畫；比對同篩選挑指標（searchKey：全形、
// 大小寫、臺／台）。每次打開清空
const pickerQuery = ref('')
// 型錄的搜尋別名（流速動比、CR）在長文字那一份裡：打開彈窗才抓，到之前只比對名稱
const { texts: metricTexts, load: loadMetricTexts } = useMetricTexts()
const aliasesOf = (metricCode: string) => metricTexts.value?.[metricCode]?.searchAliases
const shownPickerGroups = computed(() => {
  const query = searchKey(pickerQuery.value)
  if (!query) return pickerGroups
  return pickerGroups
    .map(group => ({ ...group, children: group.children.filter(link => searchKey(link.label).includes(query) || matchesStockNavKeyword(link, query, aliasesOf)) }))
    .filter(group => group.children.length)
})
watch(pickerOpen, (open) => {
  if (!open) return
  pickerQuery.value = ''
  loadMetricTexts()
})

// 河流圖與互動卡片自己讀資料；其餘的圖跟它那一頁讀同一支端點（Nitro 快取的同一份），有釘那一種才抓。以 kind 為鍵：
// metric-pages.ts 新增一種 kind 而這裡漏接，typecheck 會報。配股配息 2026-10-15 起畫這檔自己的殖利率走勢（全市場分布留在那一頁）
const PAGE_DATA: Record<Exclude<QuickViewChart['kind'], 'river' | 'metric' | 'profile'>, string> = {
  'dividend': 'dividend-yield-history',
  'monthly-revenue': 'monthly-revenue',
  'monthly-revenue-growth': 'monthly-revenue',
  'dupont': 'dupont',
  'balance': 'balance-composition',
  'cash-flow': 'cash-flow-composition',
  'book-value-flow': 'book-value-breakdown',
  'margins': 'margins',
  'solvency': 'solvency',
  'cash-cycle': 'series?page=cash-cycle',
  'holders': 'holders',
  'news': 'news',
  // 六面向（2026-11-27）與景氣循環度（11-28）不在 /api/stock 底下：數據中台算好的個股明細經快取轉發讀，跟那一頁同一支（pageUrl）
  'six-dimensions': 'radar-breakdown',
  'cyclicality': 'cyclicality-breakdown'
}
const pageUrl = (kind: keyof typeof PAGE_DATA) => (LISTED_ONLY_KINDS.has(kind) ? `/api/cached/stocks/${code.value}/${PAGE_DATA[kind]}` : `/api/stock/${code.value}/${PAGE_DATA[kind]}`)
// 這兩張的 404 是查無資料（不在比較範圍），當成讀到了、沒有值：卡片才分得出「沒有」與讀不到（讀不到留空，見下面 loadedEmpty）
const NOT_FOUND: Partial<Record<keyof typeof PAGE_DATA, unknown>> = {
  'six-dimensions': { asOf: null, axes: [] },
  'cyclicality': { value: null, nullReason: 'not_in_universe' }
}
const pinnedKinds = computed(() => new Set(pinnedSlugs.value.map(slug => quickViewChartOf(slug)?.kind)))
const pageData = new Map<string, Ref<unknown>>()
const pageStatus = new Map<string, Ref<string>>()
function usePageData<T>(kind: keyof typeof PAGE_DATA) {
  const { data, status } = useAsyncData(
    () => `quick-view-${kind}-${code.value}`,
    async () => {
      if (!pinnedKinds.value.has(kind)) return null
      // 興櫃沒有六面向與景氣循環度（上游一律 404），卡片也不畫：不問
      if (LISTED_ONLY_KINDS.has(kind) && profile.value?.market === 'rotc') return null
      const response = await $fetch<T>(pageUrl(kind), { retry: 0, timeout: BUSINESS_REQUEST_TIMEOUT_MS })
        .catch(error => (error?.statusCode === 404 && NOT_FOUND[kind] ? NOT_FOUND[kind] as T : null))
      // 上游讀不到時伺服器回 200、series 或某個群組是 null（各頁當讀取失敗處理，見 margins.vue 的 readFailed）：這裡同樣當成沒讀到
      const partial = response as { series?: unknown; groups?: Record<string, unknown> } | null
      return partial?.series === null || Object.values(partial?.groups ?? {}).includes(null) ? null : response
    },
    { server: false, watch: [pinnedSlugs], default: () => null }
  )
  pageData.set(kind, data)
  pageStatus.set(kind, status)
  return data
}
// 讀到了卻沒有可以畫的（金融業不分流動與非流動、沒有存貨與應收帳款…）說一句，不要只留標題；讀不到（null）留空，照全站「讀不到不說
// 沒有資料」的慣例。讀取中放同尺寸的骨架（2026-10-23，使用者：「stock/1475 圖表多的時候 有時會等待 希望每張卡片加上loader」）
const loadedEmpty = (kind: QuickViewChart['kind']) => pageData.get(kind)?.value != null
const pageLoading = (kind: QuickViewChart['kind']) => ['idle', 'pending'].includes(pageStatus.get(kind)?.value ?? '')
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
const holdersData = usePageData<ShareholdingDistribution>('holders')
const newsData = usePageData<StockNewsResponse>('news')
// 六面向的雷達圖（2026-11-27，預設第二張）：六個軸照固定順序；一個都算不出來、興櫃（上游 404）或還沒有資料時卡片寫一句
const sixDimensions = usePageData<RadarBreakdown>('six-dimensions')
const sixAxes = computed(() => sixDimensionAxes(sixDimensions.value))
const sixHasValues = computed(() => sixAxes.value.some(axis => axis.value !== null))
// 景氣循環度（2026-11-28，能釘、不在預設）：標題後面接百分位（同其他指標卡片接最新數值），卡片自己畫位置條、四項與趨勢圖
const cyclicality = usePageData<CyclicalityBreakdown>('cyclicality')
const cyclicalityHead = computed(() => (typeof cyclicality.value?.value === 'number' ? `百分位 ${Math.round(cyclicality.value.value)}` : ''))
// 金融業的資產負債表不分流動與非流動，那兩塊沒有可畫的期別：落到下面的空卡，不要整格消失
const hasBalanceRows = (part: BalanceCompositionKind) => !!balanceComposition.value?.periods.some(period => pickBalanceComposition(part, period))
const cashCycleEntry = computed(() => latestCashCycleEntry(cashCycleSeries.value?.groups?.TTM_CYCLE_20?.entries ?? []))

// 沒有單一數值的頁（財報三率）是空字串：圖卡標題後面不接東西，表格那一格自己印「－」
function valueText(field: string | null, slug?: string): string {
  if (!field) return ''
  const cell = values.value[field]
  // 還沒讀完就是「…」。看 status 不看 pending（2026-10-08 server: false 時量到 hydration 警告 ×5；現在伺服器端也抓，仍照這個判斷）
  if (valuesStatus.value !== 'success' && valuesStatus.value !== 'error' && !cell) return '…'
  if (cell?.value == null) return '－'
  const located = locateFieldInSchema(schema.value?.categories ?? [], field)
  return `${(slug && VALUE_PREFIX[slug]) ?? ''}${formatScreenerValue(cell.value, located?.field.unit, field, located?.metric.options)}`
}
// 河流圖卡片的數字：圖的最後一點，格式同 valueText（同一個單位、同一支格式函式）
function riverValueText(latest: RiverLatest | RiverMissing | null | undefined, field: string | null): string {
  if (latest === undefined) return '…'
  if (latest === null) return '－'
  if ('nullReason' in latest) return nullReasonShortText(latest.nullReason)
  const located = field ? locateFieldInSchema(schema.value?.categories ?? [], field) : null
  return formatScreenerValue(latest.ratio, located?.field.unit, field ?? '', located?.metric.options)
}
function periodText(field: string | null): string {
  if (!field) return '整頁內容'
  const basis = field.split('.')[1] as MetricsHistoryTimeframe | 'EOD'
  const cell = values.value[field]
  return `${(TIMEFRAME_LABELS as Record<string, string | undefined>)[basis] ?? basis}${cell?.knowledgeDate ? `（${cellPeriodText(cell)}）` : ''}`
}

// 「這些數字是哪一期的？」的答句（2026-11-13，使用者：「改」）：財報類最新到哪一季、跟股價有關的用哪天收盤，伺服器端就算得出來。原本寫的是
// 「每一列都可以調整順序或刪除…」，是在說怎麼操作，不合卡片前文字只寫答案的規則（按鈕上已經寫了上移、下移、刪除）。
// 手上有資料就照常回答（換一批欄位重抓時也是），完全沒有資料又在讀才放骨架
const periodLoading = computed(() => (valuesStatus.value !== 'success' && valuesStatus.value !== 'error')
  || (riverKinds.value.length > 0 && riverStatus.value !== 'success' && riverStatus.value !== 'error'))
const periodAnswer = computed(() => {
  const quarters = rows.value.flatMap((row) => {
    const cell = row.field ? values.value[row.field] : undefined
    return cell?.fiscalYear && cell.fiscalQuarter ? [cell.fiscalYear * 10 + cell.fiscalQuarter] : []
  })
  const closes = rows.value.flatMap((row) => {
    const latest = riverLatestOfRow(row.slug)
    if (latest && 'tradeDate' in latest) return [latest.tradeDate]
    return row.field?.endsWith('.EOD') && values.value[row.field]?.knowledgeDate ? [values.value[row.field]!.knowledgeDate!] : []
  })
  const quarter = quarters.length ? Math.max(...quarters) : null
  const close = closes.sort().at(-1)
  const parts = [quarter ? `財報類是 ${Math.floor(quarter / 10)} 年第 ${quarter % 10} 季` : '', close ? `跟股價有關的是 ${close} 收盤` : ''].filter(Boolean)
  return parts.length ? `${parts.join('，')}。` : null
})

// 卡片區「自選指標最新是多少？」的答句（2026-11-13，使用者：「也改」）：照自選的順序取前兩個有數字的（河流圖那幾支同卡片與表格，用圖的
// 最後一點），其他幾項的數字在卡片上。原本寫「側邊欄『自選指標』裡的每一項…點名稱可以看它的歷年變化」，是在說怎麼操作。
// 資料到齊才回答（之前放骨架）：數值先到、河流圖後到時，前兩個會從別支換成本益比，句子中途改字
const latestAnswer = computed(() => {
  if (periodLoading.value) return null
  const numbers = rows.value.flatMap((row) => {
    const text = riverKindOf(row.slug) ? riverValueText(riverLatestOfRow(row.slug), row.field) : valueText(row.field, row.slug)
    return /\d/.test(text) ? [`${row.label} ${text}`] : []
  })
  if (!numbers.length) return null
  const rest = numbers.length - 2
  return `${numbers.slice(0, 2).join('、')}${rest > 0 ? `，連同其他 ${rest} 項都是最新一期` : ''}。`
})

const sectorCode = computed(() => profile.value?.sectorCode ?? null)
const { breadcrumbs } = useStockPageSeo({ code, shortName: stockShortName, topic: TOPIC, titleKeywords: '本益比、殖利率、EPS 指標速覽', pathSuffix: '', stock, summary, description, sectorCode })
</script>

<template>
  <StockPageShell
    class="app-page app-page--compact stock-quick-view-page"
    :code="code"
    :stock="stock"
    :pending="stockPending"
    :short-name="stockShortName"
    :topic="TOPIC"
    :breadcrumbs="breadcrumbs"
    :footer="{ sources: dataSources }"
  >
    <StockQuestionSection
      id="stock-quick-view"
      :question="`${stockShortName}的自選指標最新是多少？`"
      :answer="latestAnswer"
      :answer-skeleton="periodLoading ? '本益比 27.24、ROE 40.94%，連同其他 3 項都是最新一期。' : null"
    >
      <!-- 圖在表前（2026-09-27 規則）。釘選清單只在瀏覽器裡，所以圖也只在瀏覽器畫 -->
      <ClientOnly>
        <div ref="grid" class="stock-quick-view-page__grid">
        <!-- 每張圖自己就是圖卡（SharedChartCard，2026-10-14 起個股頁的圖一律由它包），標題從 #header 傳進去；資料還沒到的先放只有標題的空卡。
             外面那一格帶著這張卡片讀取中該有的高度（bodyVars），畫好就拿掉 -->
        <div v-for="item in charts" :key="item.slug" class="stock-quick-view-page__cell" :data-slug="item.slug" :style="drawnSlugs.includes(item.slug) ? undefined : bodyVars(item)">
        <StockDividendYieldHistoryChart v-if="item.spec.kind === 'dividend' && dividendYieldHistory?.entries?.length" :entries="dividendYieldHistory.entries" :cash-dividends="dividendYieldHistory.cashDividends">
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
        </StockDividendYieldHistoryChart>
        <!-- 標題的數字是圖的最後一點（2026-11-01，使用者選「摘要用圖的最新一點」），跟著圖的期別切換；圖還在讀是「…」 -->
        <StockValuationRiverChart v-else-if="item.spec.kind === 'river'" :symbol="code" :kind="item.spec.river">
          <template #header="{ latest }"><StockQuickViewChartHead :to="item.to" :label="item.label" :value="riverHeaderText(latest, item.slug, item.field)" @remove="removeRow(item.slug, item.label)" /></template>
        </StockValuationRiverChart>
        <StockMonthlyRevenueChart v-else-if="item.spec.kind === 'monthly-revenue' && monthlyRevenue?.entries?.length" measure="amount" :entries="monthlyRevenue.entries" :monthly-prices="monthlyRevenue.monthlyPrices" :price-break-months="monthlyRevenue.priceBreakMonths">
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
        </StockMonthlyRevenueChart>
        <StockMonthlyRevenueChart v-else-if="item.spec.kind === 'monthly-revenue-growth' && monthlyRevenueGrowth?.entries?.length" measure="yoy" :entries="monthlyRevenueGrowth.entries" :monthly-prices="monthlyRevenueGrowth.monthlyPrices" :price-break-months="monthlyRevenueGrowth.priceBreakMonths">
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
        </StockMonthlyRevenueChart>
        <StockDupontChart v-else-if="item.spec.kind === 'dupont' && dupont?.series" :data="dupont">
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
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
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
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
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
        </StockBalanceCompositionChart>
        <StockBookValueFlowChart v-else-if="item.spec.kind === 'book-value-flow' && bookValueFlow?.entries?.length" :entries="bookValueFlow.entries">
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
        </StockBookValueFlowChart>
        <StockRatioLinesChart v-else-if="item.spec.kind === 'margins' && marginsData?.series" page="margins" :entries="marginsData.series.entries">
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
        </StockRatioLinesChart>
        <StockRatioLinesChart v-else-if="item.spec.kind === 'solvency' && solvencyData?.series" page="solvency" :entries="solvencyData.series.entries">
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
        </StockRatioLinesChart>
        <StockCashCycleTimeline v-else-if="item.spec.kind === 'cash-cycle' && cashCycleEntry" :entry="cashCycleEntry">
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
        </StockCashCycleTimeline>
        <SharedHoldersChart v-else-if="item.spec.kind === 'holders' && holdersData?.weeks.length" :weeks="holdersData.weeks">
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
        </SharedHoldersChart>
        <StockMetricHistoryChartInteractive
          v-else-if="item.spec.kind === 'metric'"
          :symbol="code"
          :metric-code="item.spec.metricCode"
          :holding-metric-code="item.spec.holdingMetricCode"
          :holding-topic="item.spec.holdingMetricCode && nameOf(item.spec.holdingMetricCode)"
          :no-value-text="item.spec.bankOnly && `${stockShortName}沒有${item.spec.topic}：${item.spec.bankOnly}。`"
          :topic="item.spec.topic"
          :unit="findMetricInSchema(categories, item.spec.metricCode)?.metric.unit ?? ''"
          :default-timeframe="item.spec.timeframe"
          :available-timeframes="timeframesOf(item.spec.metricCode)"
          :part-codes="item.spec.partCodes"
          :part-names="item.spec.partCodes?.map(partCode => findMetricInSchema(categories, partCode)?.metric.name ?? partCode)"
          :negated-part-codes="item.spec.negatedPartCodes"
          :part-others="item.spec.partOthers"
          :compare-metric-code="item.spec.compareMetricCode"
          :compare-name="item.spec.compareMetricCode && nameOf(item.spec.compareMetricCode)"
          :compare-timeframes="item.spec.compareMetricCode ? timeframesOf(item.spec.compareMetricCode) : undefined"
          :right-metric="item.spec.rightMetricCode ? { code: item.spec.rightMetricCode, name: findMetricInSchema(categories, item.spec.rightMetricCode)?.metric.name ?? item.spec.rightMetricCode, unit: findMetricInSchema(categories, item.spec.rightMetricCode)?.metric.unit ?? '', timeframes: timeframesOf(item.spec.rightMetricCode), bar: item.spec.rightMetricBar } : undefined"
        >
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
        </StockMetricHistoryChartInteractive>
        <!-- 基本資料是表格卡片（2026-11-08）：不比圖表卡高，見 .stock-quick-view-page__facts -->
        <SharedChartCard v-else-if="item.spec.kind === 'profile'" class="stock-quick-view-page__profile">
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" value="" @remove="removeRow(item.slug, item.label)" /></template>
          <SharedFactList v-if="profileFacts.length" :items="profileFacts" :label="`${stockShortName}的基本資料`" class="stock-quick-view-page__facts" />
          <!-- 查完是 404（數據中台的公司目錄沒有這家，例如已經離開櫃買名單）：同其他卡片說沒有資料，不留一塊永遠在載入的骨架 -->
          <p v-else-if="profileStatus === 'success'" class="stock-quick-view-page__chart-empty">目前沒有這家公司的基本資料。</p>
          <div v-else-if="profileStatus !== 'error'" class="stock-quick-view-page__facts-placeholder app-skeleton" aria-hidden="true" />
        </SharedChartCard>
        <StockNewsCard v-else-if="item.spec.kind === 'news'" :news="newsData" :loading="pageLoading('news')" :short-name="stockShortName" :today="taipeiToday">
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" value="" @remove="removeRow(item.slug, item.label)" /></template>
        </StockNewsCard>
        <!-- 六面向是雷達圖（SVG），不是 ECharts：內容區跟其他卡片讀取中的佔位同高，圖載到了不會把版面推動 -->
        <SharedChartCard v-else-if="item.spec.kind === 'six-dimensions' && !pageLoading('six-dimensions')">
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="sixDimensions?.asOf ?? ''" @remove="removeRow(item.slug, item.label)" /></template>
          <!-- 沒有資料時那一句也放在同高的內容區裡：這張是預設卡片，讀取中的佔位換成一行字會把下面整頁往上拉 -->
          <div class="stock-quick-view-page__six">
            <template v-if="sixHasValues">
              <SharedChartLegend :groups="SIX_DIMENSIONS_LEGEND" />
              <StockSixDimensionsRadar :axes="sixAxes" :label="sixDimensionsAriaLabel(stockShortName, sixAxes)" />
            </template>
            <p v-else-if="sixDimensions" class="stock-quick-view-page__chart-empty">目前沒有{{ stockShortName }}的六面向資料。</p>
          </div>
        </SharedChartCard>
        <StockCyclicalityCard v-else-if="item.spec.kind === 'cyclicality' && !pageLoading('cyclicality')" :breakdown="cyclicality" :short-name="stockShortName">
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="cyclicalityHead" @remove="removeRow(item.slug, item.label)" /></template>
        </StockCyclicalityCard>
        <SharedChartCard v-else>
          <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
          <p v-if="loadedEmpty(item.spec.kind)" class="stock-quick-view-page__chart-empty">目前沒有這張圖的資料。</p>
          <div v-else-if="pageLoading(item.spec.kind)" class="stock-quick-view-page__placeholder app-skeleton" aria-hidden="true" />
        </SharedChartCard>
        </div>
        <button type="button" class="stock-quick-view-page__add" @click="pickerOpen = true">
          <el-icon aria-hidden="true"><Plus /></el-icon>加入指標
        </button>
        </div>
        <el-dialog v-model="pickerOpen" title="加入指標" width="min(720px, 92vw)">
          <!-- 搜尋框同篩選挑指標（ScreenerIndicatorPickerBody 的 .indicator-dialog__search） -->
          <el-input v-model="pickerQuery" placeholder="搜尋指標名稱" aria-label="搜尋指標名稱" clearable class="stock-quick-view-page__picker-search">
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <p class="stock-quick-view-page__picker-status" aria-live="polite">
            已加入 {{ pinnedSlugs.length }} / {{ PINNED_METRIC_LIMIT }} 個{{ isFull ? '，已到上限，先取消一個才能再加' : '' }}
          </p>
          <div v-if="!shownPickerGroups.length" role="status">
            <el-empty description="沒有符合的指標" :image-size="60" />
          </div>
          <section v-for="group in shownPickerGroups" :key="group.label" class="stock-quick-view-page__picker-group">
            <h3 class="stock-quick-view-page__picker-title">{{ group.label }}</h3>
            <ul class="stock-quick-view-page__picker-list">
              <li v-for="link in group.children" :key="slugOf(link)">
                <button
                  type="button"
                  class="hub-chip stock-quick-view-page__picker-item"
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
        <!-- 接手前（伺服器輸出與 hydration 那一刻）：同一個格子、同樣大小的空卡（每張卡片各自的高度，見 bodyVars），標題照畫。原本這裡什麼都沒有，圖到了才整片出現，
             把下面的表格推出畫面——2026-10-18 全站量測 /stock/2330 1440 寬 0.227、375 寬 0.289 -->
        <template #fallback>
          <div class="stock-quick-view-page__grid">
            <div v-for="item in charts" :key="item.slug" class="stock-quick-view-page__cell" :style="bodyVars(item)">
            <SharedChartCard>
              <!-- 河流圖那幾張的數字同畫好的卡片與表格：圖的最後一點（伺服器端算好的 river-latest）。原本這裡寫篩選器的數值，伺服器輸出的
                   本益比 27.76 跟表格的 27.24 不一樣，圖畫好後標題又跳成 27.24（2026-11-13） -->
              <template #header><StockQuickViewChartHead :to="item.to" :label="item.label" :value="riverKindOf(item.slug) ? riverHeaderText(undefined, item.slug, item.field) : valueText(item.field, item.slug)" @remove="removeRow(item.slug, item.label)" /></template>
              <div class="stock-quick-view-page__placeholder app-skeleton" aria-hidden="true" />
            </SharedChartCard>
            </div>
            <button type="button" class="stock-quick-view-page__add">
              <el-icon aria-hidden="true"><Plus /></el-icon>加入指標
            </button>
          </div>
        </template>
      </ClientOnly>
    </StockQuestionSection>

    <!-- 表格自成一段、有自己的 h2（2026-10-07「quick-view 表格幫我加上H2」） -->
    <StockQuestionSection
      id="stock-quick-view-table"
      question="這些數字是哪一期的？"
      :answer="periodAnswer"
      :answer-skeleton="periodLoading && !periodAnswer ? '財報類是 2026 年第 2 季，跟股價有關的是 2026-11-13 收盤。' : null"
    >
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
            <th scope="col">期別</th>
            <th scope="col">調整</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="row.slug">
            <th scope="row"><NuxtLink :to="row.to" class="seo-table__link">{{ row.label }}</NuxtLink></th>
            <td class="seo-table__num" :title="riverKindOf(row.slug) ? riverTitle(row.slug) : undefined">{{ riverKindOf(row.slug) ? riverValueText(riverLatestOfRow(row.slug), row.field) : valueText(row.field, row.slug) || '－' }}</td>
            <td data-label="期別">{{ row.slug === 'profile' ? profileDateText : riverKindOf(row.slug) ? riverPeriodText(row.slug) : periodText(row.field) }}</td>
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
  container-type: inline-size;
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

/* 一張卡片一格：卡片撐滿格子，同一列的卡片一樣高。格子上的 --qv-body-narrow／--qv-body-wide 是這張卡片讀取中內容區該有的高度
  （script 的 bodyVars：上次畫好的高度，沒有就用預設）；卡片畫好之後格子不再帶它們，內容區照自己的內容 */
.stock-quick-view-page__cell {
  display: grid;
}

.stock-quick-view-page__cell > * {
  min-width: 0;
}

.stock-quick-view-page__cell :deep(.el-card__body) {
  min-height: var(--qv-body-narrow, 0);
}

@container (min-width: 520px) {
  .stock-quick-view-page__cell :deep(.el-card__body) {
    min-height: var(--qv-body-wide, 0);
  }
}

.stock-quick-view-page__chart-empty {
  margin: 0;
}

/* 佔位填滿內容區：那一格給的高度扣掉卡片上下的內距（24）。沒給的時候（不在格子裡）是一般圖卡的 364＝控制列 32＋間距 12＋圖 320。
   窄與寬用跟 SharedChartCard 同一個容器條件切換（它的 container-type 在 .shared-chart-card 上） */
.stock-quick-view-page__placeholder {
  height: calc(var(--qv-body-narrow, 388px) - 24px);
}

@container (min-width: 520px) {
  .stock-quick-view-page__placeholder {
    height: calc(var(--qv-body-wide, 388px) - 24px);
  }
}

/* 六面向的雷達圖卡片：內容區最少這麼高（窄 372、寬 360；這張卡片佔位的預設照這兩個數字，見 BODY_DEFAULTS，改這裡要一起改）、圖放中間。圖最寬 11.75rem（188×214）：窄卡片圖例折成兩行（52）加軸名兩列（94）
   加圖 214 是 368，放得進 372；寬卡片圖例一行，342 放得進 360 */
.stock-quick-view-page__six {
  --six-radar-plot: 11.75rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  min-height: calc(44px + 8px + 320px);
}

@container (min-width: 520px) {
  .stock-quick-view-page__six {
    min-height: calc(32px + 8px + 320px);
  }
}

/* 基本資料卡（2026-11-08，使用者：「我比較擔心他在電腦版 會把別的圖表比例撐高」）：不比圖表卡高（454px＝標題 64＋上下 12＋框線）。
   8 列各一行、每列 44px 加分隔線，自己 450px；太長的值結尾「…」，完整的在基本資料頁。同一列時是它把 8 列平均撐開去配合圖表卡 */
.stock-quick-view-page__profile {
  display: flex;
  flex-direction: column;
}

.stock-quick-view-page__profile :deep(.el-card__body) {
  flex: 1;
  display: flex;
}

.stock-quick-view-page__facts.fact-list {
  flex: 1;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-rows: 1fr;
}

.stock-quick-view-page__facts :deep(.fact-list__item) {
  flex-wrap: nowrap;
  align-items: center;
  min-height: 2.75rem;
  padding: 0;
}

.stock-quick-view-page__facts :deep(.fact-list__value) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 跟畫好的 8 列一樣高（每列 2.75rem，分隔線算在裡面） */
.stock-quick-view-page__facts-placeholder {
  flex: 1;
  min-height: calc(8 * 2.75rem);
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

/* 格子排得出兩欄時才撐高，跟圖卡排在一起像一個空位（格子寬 ≥976：兩欄各至少 480 加一個 16 的間距）。一欄的時候它自己一列，
   88px 就夠；原本看視窗 720，720～1000 寬時自己一列卻撐高 */
@container (min-width: 976px) {
  .stock-quick-view-page__add {
    min-height: 160px;
  }
}

.stock-quick-view-page__add:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

/* 同篩選挑指標的搜尋框：16px 字（iOS 點了不放大）、44px 觸控高度 */
.stock-quick-view-page__picker-search {
  margin-bottom: 12px;
}

.stock-quick-view-page__picker-search :deep(.el-input__inner) {
  font-size: 1rem;
}

.stock-quick-view-page__picker-search :deep(.el-input__wrapper) {
  min-height: 44px;
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
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
  font: inherit;
  cursor: pointer;
}

.stock-quick-view-page__move:not(:disabled):hover {
  background: var(--el-fill-color-dark);
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
