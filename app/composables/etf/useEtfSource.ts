import type { FilterCriterion, ScreenerResultRow } from '~/composables/screener/useFilterSearch'
import type { ColumnPresetTemplate } from '~/composables/screener/useScreenerColumnPresets'
import type { UniverseQuery, UniverseResult, UniverseSource, UniverseTemplate } from '~/composables/screener/useUniverseScreener'
import type { ScreenerResultTableColumn } from '~/components/shared/SharedMetricTable.vue'

// ETF 篩選的資料來源（2026-10-15 三組篩選重新設計）。型錄 GET /etf-screener/filters、查詢 POST /etf-screener，都是 業務中台。
// 畫面與「我的篩選」的儲存跟另外兩組共用（ScreenerPageShell、useUniverseScreener），這裡只放 ETF 自己的部分。
//
// 2026-09-07 起只存在這次瀏覽的兩組本地預設（useEtfFilterPresets／useEtfColumnPresets）拿掉了：業務中台 加了 universe 之後存進帳號。
// 原本的種子變成「新增篩選」「新增欄位組合」對話框裡的範本；「費用歷史」那一組是使用者 2026-09-08 直接要的，保留成範本。

interface EtfFilterField {
  field: string
  label: string
  // date（成立日）這一版的條件面板還不能設，不放進型錄；「成立年數」數字欄位涵蓋同樣的需求（業務中台 045159d）
  kind: 'numeric' | 'categorical' | 'date'
  values?: string[]
  unit?: string
}

interface EtfFilterCategory {
  categoryKey: string
  categoryDisplayName: string
  fields: EtfFilterField[]
}

type EtfValue = string | number | boolean | null

interface EtfScreenerRow {
  symbol: string
  fundName: string
  shortName: string
  issuerName: string
  category: string
  values: Record<string, EtfValue>
}

interface EtfScreenerResponse {
  count: number
  page: number
  pageSize: number
  totalPages: number
  results: EtfScreenerRow[]
}

// 類別值的中文（上游給的是代碼或布林字串）
const VALUE_LABELS: Record<string, Record<string, string>> = {
  market: { sii: '上市', otc: '上櫃' },
  isActive: { true: '主動式', false: '被動式（追蹤指數）' },
  belowStatutoryThreshold: { true: '是', false: '否' }
}

// 畫面上的名稱（欄位名照上游，不改）：「主動式ETF：包含 被動式」讀不通
const LABEL_OVERRIDES: Record<string, string> = { isActive: '主動或被動' }

// 第一下由小到大：費用類，越低越是多數人要找的（同普通股的本益比）
const ASCENDING_FIRST = /^(expenseRatio\d*|managementFeeRate|custodianFeeRate|guaranteeFeeRate|otherFeeRate|commissionRate|transactionTaxRate|etfTradingFeeRate)$/

// 歷年總費用率（expenseRatio2001…2026）不放進挑選面板（26 個同名欄位會淹掉其他），只用在「費用歷史」欄位組合
const EXPENSE_RATIO_YEAR = /^expenseRatio(\d{4})$/
const EXPENSE_RATIO_YEARS = Array.from({ length: 26 }, (_, index) => 2026 - index)

const ASSET_CLASSES = ['債券成分', '反向型', '國內成分證券', '國外成分證券', '多資產', '槓桿型', '連結式']

const FILTER_TEMPLATES: UniverseTemplate[] = [
  ...ASSET_CLASSES.map(assetClass => ({
    id: `asset-${assetClass}`,
    name: assetClass,
    category: '資產類型',
    description: `資產類型為「${assetClass}」的 ETF`,
    status: 'AVAILABLE' as const,
    pendingReason: null,
    filters: [{ field: 'assetClass', min: null, max: null, exclude: false, values: [assetClass] }]
  })),
  { id: 'passive', name: '被動式', category: '主動或被動', description: '追蹤指數的被動式 ETF', status: 'AVAILABLE', pendingReason: null, filters: [{ field: 'isActive', min: null, max: null, exclude: false, values: ['false'] }] },
  { id: 'active', name: '主動式', category: '主動或被動', description: '由經理人選股的主動式 ETF', status: 'AVAILABLE', pendingReason: null, filters: [{ field: 'isActive', min: null, max: null, exclude: false, values: ['true'] }] }
]

const DEFAULT_COLUMNS = ['aum', 'return1y', 'expenseRatio', 'nav', 'market', 'assetClass'].map(snapshotFieldId)

const COLUMN_TEMPLATES: ColumnPresetTemplate[] = [
  { key: 'performance', name: '績效表現', description: '近 3 月到近 10 年的報酬率', fieldKeys: ['return3m', 'return6m', 'returnYtd', 'return1y', 'return2y', 'return3y', 'return5y', 'return10y'].map(snapshotFieldId) },
  { key: 'size', name: '規模與資金', description: '規模、受益人數、淨申購、定期定額與市占率', fieldKeys: ['aum', 'holders', 'netFlow', 'dcaAmount', 'marketShareRate'].map(snapshotFieldId) },
  { key: 'cost', name: '費用歷史', description: '2026 年到 2001 年每一年的總費用率', fieldKeys: EXPENSE_RATIO_YEARS.map(year => snapshotFieldId(`expenseRatio${year}`)) }
]

function valueLabel(field: string, value: string): string {
  return VALUE_LABELS[field]?.[value] ?? value
}

function displayLabel(field: EtfFilterField): string {
  return LABEL_OVERRIDES[field.field] ?? field.label
}

function formatValue(field: EtfFilterField | undefined, raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '—'
  if (field?.kind === 'categorical') return valueLabel(field.field, raw)
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  if (field?.unit === '元') return field.field === 'nav' ? groupThousands(value.toFixed(2)) : formatMoney(value)
  if (field?.unit === '%') return `${raw}%`
  return field?.unit && field.unit !== '無單位' ? `${groupThousands(raw)} ${field.unit}` : groupThousands(raw)
}

export function useEtfSource(): UniverseSource {
  const catalog = useState<EtfFilterCategory[] | null>('etf-screener-catalog', () => null)
  const catalogFailure = shallowRef<unknown>(null)

  async function loadCatalog() {
    try {
      catalog.value = (await apiFetch<{ categories: EtfFilterCategory[] }>('/etf-screener/filters')).categories
      catalogFailure.value = null
    } catch (error) {
      catalogFailure.value = error
      devWarn('etf-screener', `GET ${BUSINESS_BASE}/etf-screener/filters unavailable`, error)
    }
  }
  if (import.meta.client && catalog.value === null) loadCatalog()
  watchLoadFailure('etf-screener-catalog', () => catalogFailure.value, loadCatalog, { scope: 'section' })

  const fieldsByKey = computed(() => new Map((catalog.value ?? []).flatMap(category => category.fields).map(field => [field.field, field])))

  const categories = computed(() => (catalog.value ?? []).map((category, index) => snapshotCategory(
    category.categoryKey,
    category.categoryDisplayName,
    index,
    category.fields
      .filter(field => field.kind !== 'date' && !EXPENSE_RATIO_YEAR.test(field.field))
      .map(field => ({
        field: field.field,
        name: displayLabel(field),
        unit: field.unit,
        kind: field.kind === 'categorical' ? 'categorical' as const : 'numeric' as const,
        options: field.values?.map(value => ({ value, label: valueLabel(field.field, value) }))
      }))
  )))

  function column(fieldId: string): ScreenerResultTableColumn {
    const field = snapshotField(fieldId)
    const year = EXPENSE_RATIO_YEAR.exec(field)?.[1]
    const meta = fieldsByKey.value.get(field)
    return {
      field: fieldId,
      // 不用「（2025）」：表格在「顯示資料時間」關閉時會拿掉結尾的括號（那是普通股的期別）
      label: year ? `總費用率 ${year}` : meta ? displayLabel(meta) : field,
      format: raw => formatValue(meta ?? (year ? { field, label: '', kind: 'numeric', unit: '%' } : undefined), raw),
      sortable: 'server',
      ascendingFirst: ASCENDING_FIRST.test(field)
    }
  }

  // 排除（exclude）兩種都直接送（analysis-ts 17079ab，本機與 DEV 2026-10-15 都上線）。對 null 的處理不同，照上游：類別型排除保留 null
  // （排除槓桿型＝322 檔＝339−17，含 40 檔沒有資產類型的），數字型排除 null 一律不留（不知道 null 在不在範圍外）
  function toEtfFilter(filter: FilterCriterion) {
    const exclude = filter.exclude ? { exclude: true } : {}
    return filter.values
      ? { field: filter.field, values: filter.values, ...exclude }
      : { field: filter.field, min: filter.min, max: filter.max, ...exclude }
  }

  function toRow(row: EtfScreenerRow): ScreenerResultRow {
    return {
      symbol: row.symbol,
      name: row.shortName,
      values: Object.fromEntries(Object.entries(row.values).map(([field, value]) => [
        snapshotFieldId(field),
        { value: value === null ? null : String(value), knowledgeDate: '', nullReason: null }
      ]))
    }
  }

  async function run(query: UniverseQuery): Promise<UniverseResult> {
    const body: Record<string, unknown> = {
      columns: query.columns.map(field => ({ field })),
      page: query.page,
      pageSize: query.pageSize
    }
    if (query.filters.length) body.filters = query.filters.map(toEtfFilter)
    if (query.sort) {
      body.sortField = query.sort.field
      body.order = query.sort.order
    }
    const response = await apiFetch<EtfScreenerResponse>('/etf-screener', { method: 'POST', body })
    return { rows: response.results.map(toRow), total: response.count, totalPages: response.totalPages }
  }

  return {
    universe: 'etf',
    allName: '全部 ETF',
    categories,
    ready: computed(() => catalog.value !== null || catalogFailure.value !== null),
    defaultColumns: DEFAULT_COLUMNS,
    filterTemplates: FILTER_TEMPLATES,
    columnTemplates: COLUMN_TEMPLATES,
    column,
    run,
    rowLink: etfPath,
    sortMode: 'server'
  }
}
