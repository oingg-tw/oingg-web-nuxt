import type { FilterCriterion, ScreenerResultRow } from '~/composables/screener/useFilterSearch'
import type { ColumnPresetTemplate } from '~/composables/screener/useScreenerColumnPresets'
import type { UniverseQuery, UniverseResult, UniverseSource, UniverseTemplate } from '~/composables/screener/useUniverseScreener'
import type { ScreenerResultTableColumn } from '~/components/shared/SharedMetricTable.vue'

// 特別股篩選的資料來源（2026-10-15 三組篩選重新設計）。全部只有 28 檔（GET /stocks/preferred-stocks），一次讀進來、在瀏覽器裡篩與排，
// 所以結果表是 client 排序、沒有下一頁。畫面與「我的篩選」的儲存跟另外兩組共用（ScreenerPageShell、useUniverseScreener）。
//
// 欄位 id 用上游的欄位名（nominalDividendRatePct、cumulativeDividend…），存進帳號的條件與欄位組合也是這些名字，不用畫面另取的。
// 原本的三個固定分頁（全部／非累積型／累積型）變成「股息累積性」這個類別型條件；三組欄位預設變成「新增欄位組合」的範本。
// 每股淨值那些償債欄位（利息保障倍數、負債比…）上游一直是 null，不放。

// 陣列只有除權息月份（[6, 7]，analysis-ts 617ba6bb）
type PreferredValue = string | number | boolean | null | number[]

interface PreferredStockEntry {
  symbol: string
  name: string
  latestPriceDate: string | null
  [field: string]: PreferredValue
}

const yesNo = (yes: string, no: string) => [{ value: 'true', label: yes }, { value: 'false', label: no }]

const CATEGORIES = [
  snapshotCategory('yield', '股息與殖利率', 0, [
    { field: 'nominalDividendRatePct', name: '票面利率', unit: '%' },
    { field: 'currentYieldPct', name: '殖利率', unit: '%' },
    { field: 'ytwPct', name: '最差殖利率 YTW', unit: '%' },
    // 還沒到的月份看去年同月（同普通股、ETF 的上游定義，跟除權息月覽一致）
    { field: 'exDividendMonths', name: '除權息月份', kind: 'categorical', options: EX_DIVIDEND_MONTH_OPTIONS }
  ]),
  snapshotCategory('price', '價格', 1, [
    { field: 'latestClosePrice', name: '現價', unit: '元' },
    { field: 'issuePrice', name: '發行價', unit: '元' },
    { field: 'premiumRatePct', name: '溢價率', unit: '%' }
  ]),
  snapshotCategory('terms', '股東權利與條款', 2, [
    { field: 'cumulativeDividend', name: '股息累積性', kind: 'categorical', options: yesNo('累積型', '非累積型') },
    { field: 'participatingExcessDividend', name: '股息參與權', kind: 'categorical', options: yesNo('參加型', '非參加型') },
    { field: 'liquidationPreference', name: '清算優先權', kind: 'categorical', options: yesNo('具優先權', '無優先權') },
    { field: 'votingRights', name: '表決權', kind: 'categorical', options: yesNo('有表決權', '無表決權') },
    { field: 'convertible', name: '可轉換普通股', kind: 'categorical', options: yesNo('可轉換', '不可轉換') },
    { field: 'redeemable', name: '公司可收回', kind: 'categorical', options: yesNo('可收回', '不可收回') },
    { field: 'marketType', name: '市場', kind: 'categorical', options: [{ value: '上市', label: '上市' }, { value: '上櫃', label: '上櫃' }] }
  ])
]

const METRICS = new Map(CATEGORIES.flatMap(category => category.metrics).map(metric => [metric.key, metric]))

// 型錄外、只當欄位顯示的（日期這一版的條件面板還不能設）
const EXTRA_LABELS: Record<string, string> = { issueDate: '發行日' }

// 第一下由小到大：溢價率越低、離被收回的虧損越遠（舊表格的「負凸性」提示說的就是這件事）
const ASCENDING_FIRST = new Set(['premiumRatePct'])

const FILTER_TEMPLATES: UniverseTemplate[] = [
  { id: 'cumulative', name: '累積型', category: '股息', description: '當期未發的股息會累積，之後補發', status: 'AVAILABLE', pendingReason: null, filters: [{ field: 'cumulativeDividend', min: null, max: null, exclude: false, values: ['true'] }] },
  { id: 'non-cumulative', name: '非累積型', category: '股息', description: '當期未發的股息不補發，虧損年度停發要留意', status: 'AVAILABLE', pendingReason: null, filters: [{ field: 'cumulativeDividend', min: null, max: null, exclude: false, values: ['false'] }] },
  { id: 'participating', name: '參加型', category: '股息', description: '除了約定股息，還能參加普通股的盈餘分配', status: 'AVAILABLE', pendingReason: null, filters: [{ field: 'participatingExcessDividend', min: null, max: null, exclude: false, values: ['true'] }] },
  { id: 'convertible', name: '可轉換', category: '條款', description: '可以轉換成普通股', status: 'AVAILABLE', pendingReason: null, filters: [{ field: 'convertible', min: null, max: null, exclude: false, values: ['true'] }] },
  { id: 'redeemable', name: '公司可收回', category: '條款', description: '發行公司可以依條款收回', status: 'AVAILABLE', pendingReason: null, filters: [{ field: 'redeemable', min: null, max: null, exclude: false, values: ['true'] }] }
]

const DEFAULT_COLUMNS = ['latestClosePrice', 'nominalDividendRatePct', 'currentYieldPct', 'ytwPct', 'cumulativeDividend', 'premiumRatePct'].map(snapshotFieldId)

const COLUMN_TEMPLATES: ColumnPresetTemplate[] = [
  { key: 'valuation', name: '估值與報酬', description: '發行價、現價、票面利率、殖利率、最差殖利率', fieldKeys: ['issuePrice', 'latestClosePrice', 'nominalDividendRatePct', 'currentYieldPct', 'ytwPct'].map(snapshotFieldId) },
  { key: 'rights', name: '股東權利', description: '股息累積性、參與權、清算優先權、表決權、可轉換', fieldKeys: ['cumulativeDividend', 'participatingExcessDividend', 'liquidationPreference', 'votingRights', 'convertible'].map(snapshotFieldId) },
  { key: 'call-risk', name: '收回資訊', description: '發行日、公司可收回、溢價率', fieldKeys: ['issueDate', 'redeemable', 'premiumRatePct'].map(snapshotFieldId) }
]

function formatValue(field: string, raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '—'
  const metric = METRICS.get(field)
  if (metric?.kind === 'categorical') return labelEachValue(raw, value => metric.options?.find(option => option.value === value)?.label)
  const value = Number(raw)
  if (!metric || !Number.isFinite(value)) return raw
  return metric.unit === '%' ? `${value.toFixed(2)}%` : groupThousands(value.toFixed(2))
}

function matches(entry: PreferredStockEntry, filter: FilterCriterion): boolean {
  const raw = entry[filter.field]
  if (filter.values) {
    // 陣列（除權息月份）任一個在選的項目裡就算有；排除＝一個都沒有，沒有除權息的也留下（同上游普通股、ETF 的語意）
    const hit = [raw].flat().some(value => value !== null && value !== undefined && filter.values!.includes(String(value)))
    return filter.exclude ? !hit : hit
  }
  if (typeof raw !== 'number') return false
  const inRange = (filter.min === null || raw >= filter.min) && (filter.max === null || raw <= filter.max)
  return filter.exclude ? !inRange : inRange
}

function toRow(entry: PreferredStockEntry): ScreenerResultRow {
  return {
    symbol: entry.symbol,
    name: entry.name,
    // 陣列寫成跟 ETF、普通股上游一樣的「6、7」，空的是 null
    values: Object.fromEntries(Object.entries(entry).map(([field, value]) => [
      snapshotFieldId(field),
      { value: Array.isArray(value) ? value.join('、') || null : value === null ? null : String(value), knowledgeDate: '', nullReason: null }
    ]))
  }
}

export function usePreferredSource(): UniverseSource & { dataDate: Readonly<Ref<string | null>> } {
  const entries = useState<PreferredStockEntry[] | null>('preferred-stock-entries', () => null)
  let inFlight: Promise<PreferredStockEntry[]> | null = null

  // 讀不到就往上丟，交給 useUniverseScreener 的全站讀取失敗彈窗；重試會再走到這裡
  function loadEntries(): Promise<PreferredStockEntry[]> {
    if (entries.value) return Promise.resolve(entries.value)
    inFlight ??= apiFetch<{ entries: PreferredStockEntry[] }>('/stocks/preferred-stocks', { baseURL: BUSINESS_CACHED_BASE })
      .then(response => (entries.value = response.entries))
      .finally(() => { inFlight = null })
    return inFlight
  }
  // 一進來就先抓清單（2026-10-16）：第一次搜尋要等登入狀態確定（hydration 之後）才會來問，那時多半已經到了。失敗在這裡吞掉，
  // 搜尋時會再試一次，讀取失敗照舊由搜尋那條路報給彈窗
  if (import.meta.client) loadEntries().catch(() => {})

  function column(fieldId: string): ScreenerResultTableColumn {
    const field = snapshotField(fieldId)
    return {
      field: fieldId,
      label: METRICS.get(field)?.name ?? EXTRA_LABELS[field] ?? field,
      format: raw => formatValue(field, raw),
      sortable: 'client',
      ascendingFirst: ASCENDING_FIRST.has(field)
    }
  }

  async function run(query: UniverseQuery): Promise<UniverseResult> {
    const rows = (await loadEntries()).filter(entry => query.filters.every(filter => matches(entry, filter)))
    return { rows: rows.map(toRow), total: rows.length, totalPages: 1 }
  }

  // 每一檔的股價、殖利率都是同一個交易日的快照，取最新的那天就夠
  const dataDate = computed(() => (entries.value ?? []).reduce<string | null>((latest, entry) => (entry.latestPriceDate && (!latest || entry.latestPriceDate > latest) ? entry.latestPriceDate : latest), null))

  return {
    universe: 'preferred',
    allName: '全部特別股',
    categories: computed(() => CATEGORIES),
    // 表頭不需要等任何資料（欄名寫在 METRICS；2026-10-16 拿掉表頭說明之前要等欄位公式），所以一進來就能建表頭
    ready: computed(() => true),
    defaultColumns: DEFAULT_COLUMNS,
    filterTemplates: FILTER_TEMPLATES,
    columnTemplates: COLUMN_TEMPLATES,
    column,
    run,
    rowLink: preferredStockPath,
    sortMode: 'client',
    dataDate
  }
}
