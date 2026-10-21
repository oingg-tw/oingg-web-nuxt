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

// 畫面上的名稱（欄位名照上游，不改）：「主動式ETF：包含 被動式」讀不通。近 12 個月總費用率是估算（analysis-ts 803f6cd9：分母用
// 月底淨資產平均，官方用每日平均；2025 年 254 檔驗收，131 檔等於官方全年值、98 檔差 0.01、25 檔差 0.02～0.06），上游要求標「估算」
const LABEL_OVERRIDES: Record<string, string> = {
  isActive: '主動或被動',
  trailing12MonthExpenseRatioPct: '近12個月總費用率估算',
  trailing12MonthExpenseRatioMonths: '費用率涵蓋月數'
}

// 第一下由小到大：費用類，越低越是多數人要找的（同普通股的本益比）
const ASCENDING_FIRST = /^(expenseRatio\d*|trailing12MonthExpenseRatioPct|managementFeeRate|custodianFeeRate|guaranteeFeeRate|otherFeeRate|commissionRate|transactionTaxRate|etfTradingFeeRate)$/

// 歷年總費用率（expenseRatio2001…）不放進挑選面板（二十幾個同名欄位會淹掉其他），只用在「費用歷史」欄位組合。
// 2026 不列：sitca 改了「完整年度」的定義，今年要到 2026 年 12 月公布才有值，現在 339 檔全是 null（業務中台 2026-10-15）；
// 今年的費用看近 12 個月。ponytail: 年份寫死，2026 全年值公布後把 2026 加回來
const EXPENSE_RATIO_YEAR = /^expenseRatio(\d{4})$/
const EXPENSE_RATIO_YEARS = Array.from({ length: 25 }, (_, index) => 2025 - index)
const TRAILING_EXPENSE = ['trailing12MonthExpenseRatioPct', 'trailing12MonthExpenseRatioMonths']

// 基金類型（2026-10-21 起用上游 fundType：投信投顧公會基金類型的第二層，analysis-ts 8dad5785）。原本是 assetClass——那是上市／上櫃的
// 掛牌分類，上市的 9 檔債券 ETF 被歸在「國外成分證券」（使用者：「請業務中台提供真正的資產類型欄位」）
const FUND_TYPES = ['股票型', '債券型', '槓桿型／反向型', '平衡型', '不動產證券化／其他']

const FILTER_TEMPLATES: UniverseTemplate[] = [
  ...FUND_TYPES.map(fundType => ({
    id: `fund-type-${fundType}`,
    name: fundType,
    category: '基金類型',
    description: `基金類型為「${fundType}」的 ETF`,
    status: 'AVAILABLE' as const,
    pendingReason: null,
    filters: [{ field: 'fundType', min: null, max: null, exclude: false, values: [fundType] }]
  })),
  { id: 'passive', name: '被動式', category: '主動或被動', description: '追蹤指數的被動式 ETF', status: 'AVAILABLE', pendingReason: null, filters: [{ field: 'isActive', min: null, max: null, exclude: false, values: ['false'] }] },
  { id: 'active', name: '主動式', category: '主動或被動', description: '由經理人選股的主動式 ETF', status: 'AVAILABLE', pendingReason: null, filters: [{ field: 'isActive', min: null, max: null, exclude: false, values: ['true'] }] }
]

// 總費用率（最近完整年度，官方值）旁邊放近 12 個月估算：今年才成立的 ETF 沒有完整年度，只有後者（使用者 2026-10-15「新增近 12 個月總費用率欄位」）
const DEFAULT_COLUMNS = ['aum', 'return1y', 'expenseRatio', 'trailing12MonthExpenseRatioPct', 'nav', 'market', 'fundType'].map(snapshotFieldId)

const COLUMN_TEMPLATES: ColumnPresetTemplate[] = [
  { key: 'performance', name: '績效表現', description: '近 3 月到近 10 年的報酬率', fieldKeys: ['return3m', 'return6m', 'returnYtd', 'return1y', 'return2y', 'return3y', 'return5y', 'return10y'].map(snapshotFieldId) },
  { key: 'size', name: '規模與資金', description: '規模、受益人數、淨申購、定期定額與市占率', fieldKeys: ['aum', 'holders', 'netFlow', 'dcaAmount', 'marketShareRate'].map(snapshotFieldId) },
  { key: 'cost', name: '費用歷史', description: '近 12 個月總費用率估算與涵蓋月數，加上 2025 年到 2001 年每一年的總費用率', fieldKeys: [...TRAILING_EXPENSE, ...EXPENSE_RATIO_YEARS.map(year => `expenseRatio${year}`)].map(snapshotFieldId) }
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
      catalog.value = (await apiFetch<{ categories: EtfFilterCategory[] }>('/etf-screener/filters', { baseURL: BUSINESS_CACHED_BASE })).categories
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
      label: year ? `總費用率 ${year}` : meta ? displayLabel(meta) : LABEL_OVERRIDES[field] ?? field,
      format: raw => formatValue(meta ?? (year ? { field, label: '', kind: 'numeric', unit: '%' } : undefined), raw),
      sortable: 'server',
      ascendingFirst: ASCENDING_FIRST.test(field)
    }
  }

  // 排除（exclude）兩種都直接送（analysis-ts 17079ab，本機與 DEV 2026-10-15 都上線）。對 null 的處理不同，照上游：類別型排除保留 null
  // （2026-10-15 量：排除掛牌分類「槓桿型」＝322 檔＝339−17，含 40 檔沒有分類的），數字型排除 null 一律不留（不知道 null 在不在範圍外）
  // 存起來的篩選還寫 assetClass 的（2026-10-21 以前的「資產類型」範本），送出時換成改名後的 listingCategory：值一模一樣，上游 2026-11-04
  // 移除 assetClass 之後照樣能用。ponytail: 存的篩選不改寫；確定沒有人還存著 assetClass 時拿掉這一行
  const RENAMED_FIELDS: Record<string, string> = { assetClass: 'listingCategory' }
  function toEtfFilter(filter: FilterCriterion) {
    const exclude = filter.exclude ? { exclude: true } : {}
    const field = RENAMED_FIELDS[filter.field] ?? filter.field
    return filter.values
      ? { field, values: filter.values, ...exclude }
      : { field, min: filter.min, max: filter.max, ...exclude }
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
    // 型錄沒有的欄位不送：業務中台對不認得的欄位整個查詢回 400（例如存起來的欄位組合用到上游已拿掉的欄位，或新欄位還沒上到這個環境）。
    // 濾完一欄都不剩（存了空的欄位組合、或組合裡的欄位上游全拿掉了）就改用預設欄位：沒有條件又沒有欄位，業務中台回 400
    //「"filters" or "columns" must have at least one item」，一進頁面就跳錯誤（2026-10-18）
    const known = (fields: string[]) => fields.filter(field => !catalog.value || fieldsByKey.value.has(field))
    const columns = known(query.columns)
    const body: Record<string, unknown> = {
      columns: (columns.length ? columns : known(DEFAULT_COLUMNS.map(snapshotField))).map(field => ({ field })),
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
