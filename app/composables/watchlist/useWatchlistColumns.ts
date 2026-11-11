import type { ScreenerResultTableColumn } from '~/components/shared/SharedMetricTable.vue'
import type { MetricCategory } from '~/composables/screener/useFilterSchema'
import type { ScreenerColumnPreset } from '~/composables/screener/useScreenerColumnPresets'
import type { WatchlistKind, WatchlistSources } from '~/composables/watchlist/useWatchlistStocks'
import type { PresetSelectItem } from '~/components/screener/ScreenerPresetSelect.vue'

// 觀察清單依類別分段，每一段的欄位就是那一類篩選的欄位組合（2026-11-06，使用者：「這樣就可以跟篩選那邊的欄位設定共用一套，簡化管理」）。
// 原本一份欄位給全部類別，全來自普通股型錄，ETF、特別股整排空白，折溢價率、票面利率也加不進來。
//   - 型錄、欄名、格式、取值都是篩選的（useEtfSource、usePreferredSource）；組合是 /screener/column-presets，在這裡改，篩選也跟著變
//   - 每一類用哪一組記在組合的 isDefault（業務中台每個 universe 各一組），所有清單共用（2026-10-19 的決定不變），不另外存
//   - 改名、刪除、複製只在篩選做，這裡只選與設定欄位：沒有組合時設定欄位會新增一組
//   - 收盤價、漲跌、除息／發放固定在前面、不能移動或移除：後兩欄不是型錄的欄位，篩選沒有

export const WATCHLIST_KINDS = ['common', 'etf', 'preferred'] as const
export const WATCHLIST_KIND_LABELS: Record<WatchlistKind, string> = { common: '普通股', etf: 'ETF', preferred: '特別股' }

export const WATCHLIST_FIXED_COLUMNS: ScreenerResultTableColumn[] = [
  { field: 'stock.price', label: '收盤價', pinned: true },
  { field: WATCHLIST_CHANGE, label: '漲跌', pinned: true },
  { field: WATCHLIST_EX_DIVIDEND, label: '除息／發放', pinned: true }
]
const isFixed = (field: string) => WATCHLIST_FIXED_COLUMNS.some(column => column.field === field)
// 組合裡的收盤價跟固定欄重複，不畫第二次
const PRICE_FIELDS: Record<WatchlistKind, string> = { common: 'stock.price', etf: 'close.snapshot', preferred: 'latestClosePrice.snapshot' }

// 內建的基本欄位沒有 id（同篩選），選單上用這個代表。普通股的是 2026-09 以來的那兩欄
const BASIC_SET_ID = 'basic'
const COMMON_BASIC: ScreenerResultTableColumn[] = [
  { field: 'exchangePeRatio.EOD', label: '本益比' },
  { field: 'livePbRatio.EOD', label: '股價淨值比' }
]
const NEW_SET_NAME = '觀察清單欄位'

const withoutHeld = (categories: MetricCategory[]) => categories
  .map(category => ({ ...category, metrics: category.metrics.filter(metric => metric.key !== HELD_FIELD_ID) }))
  .filter(category => category.metrics.length)

// 型錄這一層：/watchlist 與分享頁共用
export function useWatchlistColumnCatalog() {
  const { data: schema } = useFilterSchema()
  const sources: WatchlistSources = { etf: useEtfSource(), preferred: usePreferredSource() }

  function columnOf(kind: WatchlistKind, field: string): ScreenerResultTableColumn {
    if (kind !== 'common') return sources[kind].column(field)
    if (field === SECTOR_FIELD_ID) return { field, label: '類股' }
    const located = locateFieldInSchema(schema.value.categories, field)
    return COMMON_BASIC.find(column => column.field === field) ?? { field, label: located ? columnLabelFrom(metricDisplayName(located.metric), located.field.name) : field }
  }

  // 這個欄位是不是這一類的：ETF、特別股的 id 帶 .snapshot，普通股的不帶。上游拿掉的欄位不畫（同篩選），
  // 已經持有是私人資料，也讀不到別人的，不放進清單與分享
  function belongsTo(kind: WatchlistKind, field: string): boolean {
    if (isFixed(field) || field === PRICE_FIELDS[kind]) return false
    if (snapshotField(field) === HELD_FIELD_ID) return false
    const snapshot = snapshotField(field) !== field
    if (kind !== 'common') return snapshot && sources[kind].knownField(field)
    const { categories } = schema.value
    return !snapshot && (field === SECTOR_FIELD_ID || field.startsWith('stock.') || !categories.length || !!locateFieldInSchema(categories, field))
  }

  const categoriesOf = (kind: WatchlistKind) => withoutHeld(kind === 'common' ? withSectorCondition(schema.value.categories, []) : sources[kind].categories.value)
  const basicColumns = (kind: WatchlistKind) => (kind === 'common' ? COMMON_BASIC : sources[kind].defaultColumns.filter(field => belongsTo(kind, field)).map(field => columnOf(kind, field)))
  // 名稱與格子連去哪裡，同那一類的篩選（2026-11-11 改用篩選的結果表）
  const linksOf = (kind: WatchlistKind) => (kind === 'common'
    ? { rowLink: (symbol: string) => `/stock/${symbol}`, cellLink: stockMetricPath }
    : { rowLink: sources[kind].rowLink, cellLink: sources[kind].cellLink })

  return { sources, columnOf, belongsTo, categoriesOf, basicColumns, linksOf }
}

type ColumnHint = { id: string, name: string, columns: { field: string, label: string }[] }

export function useWatchlistColumns() {
  const catalog = useWatchlistColumnCatalog()
  const { columnOf, belongsTo, basicColumns } = catalog
  const presets: Record<WatchlistKind, ReturnType<typeof useScreenerColumnPresets>> = {
    common: useScreenerColumnPresets('common'),
    etf: useScreenerColumnPresets('etf'),
    preferred: useScreenerColumnPresets('preferred')
  }
  const sets = useState<Record<WatchlistKind, ScreenerColumnPreset[]>>('watchlist-column-sets', () => ({ common: [], etf: [], preferred: [] }))
  const loaded = useState('watchlist-column-sets-loaded', () => false)

  // 副本放在 cookie：帳號裡的組合要等登入還原才讀得到，重新整理的第一個畫面就要是自己的欄位（2026-10-20，使用者：「然後不要閃動」）。
  // 一類一個 cookie，三類擠一個會超過 4KB
  const authHint = useCookie<boolean | null>('auth-hint')
  const hints: Record<WatchlistKind, Ref<ColumnHint | null | undefined>> = {
    common: useCookie<ColumnHint | null>('watchlist-columns-common', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' }),
    etf: useCookie<ColumnHint | null>('watchlist-columns-etf', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' }),
    preferred: useCookie<ColumnHint | null>('watchlist-columns-preferred', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  }
  const hintOf = (kind: WatchlistKind) => (!loaded.value && authHint.value ? hints[kind].value ?? null : null)

  const activeSet = (kind: WatchlistKind) => sets.value[kind].find(set => set.isDefault) ?? null

  function columnsOf(kind: WatchlistKind): ScreenerResultTableColumn[] {
    const hint = hintOf(kind)
    if (hint) return hint.columns.map(column => ({ ...columnOf(kind, column.field), label: column.label }))
    const fields = replacedFields(activeSet(kind)?.columns.map(column => column.field) ?? []).filter(field => belongsTo(kind, field))
    // 一欄都不剩（組合裡的全被上游拿掉、或空白的一組）：畫基本欄位，選單上照舊是那一組，同篩選
    return fields.length ? fields.map(field => columnOf(kind, field)) : basicColumns(kind)
  }

  const activeIdOf = (kind: WatchlistKind) => hintOf(kind)?.id ?? activeSet(kind)?.id ?? BASIC_SET_ID
  function setItemsOf(kind: WatchlistKind): PresetSelectItem[] {
    const hint = hintOf(kind)
    if (hint) return [{ id: hint.id, name: hint.name, editable: false }]
    return [{ id: BASIC_SET_ID, name: '基本欄位', editable: false }, ...sets.value[kind].map(set => ({ id: set.id, name: set.name, editable: false }))]
  }

  async function load() {
    const [common, etf, preferred] = await Promise.all(WATCHLIST_KINDS.map(kind => presets[kind].list()))
    sets.value = { common: common!, etf: etf!, preferred: preferred! }
    loaded.value = true
  }
  function clear() {
    sets.value = { common: [], etf: [], preferred: [] }
    loaded.value = false
  }

  watch(() => (loaded.value ? WATCHLIST_KINDS.map(kind => ({ kind, id: activeIdOf(kind), name: setItemsOf(kind).find(item => item.id === activeIdOf(kind))?.name ?? '', columns: columnsOf(kind).slice(0, 20).map(({ field, label }) => ({ field, label })) })) : []), (list) => {
    for (const { kind, ...hint } of list) hints[kind].value = hint
  })

  // 選內建的基本欄位＝清掉這一類的預設
  async function select(kind: WatchlistKind, id: string) {
    const previous = sets.value[kind]
    const current = activeSet(kind)
    if ((current?.id ?? BASIC_SET_ID) === id) return
    sets.value = { ...sets.value, [kind]: previous.map(set => ({ ...set, isDefault: set.id === id })) }
    const saved = id === BASIC_SET_ID ? await presets[kind].update(current!.id, { isDefault: false }) : await presets[kind].update(id, { isDefault: true })
    if (saved) return
    sets.value = { ...sets.value, [kind]: previous }
    showErrorMessage('顯示欄位沒有存到，已回到原本的那一組')
  }

  function unusedName(kind: WatchlistKind) {
    const names = new Set(sets.value[kind].map(set => set.name))
    let suffix = 1
    while (names.has(suffix === 1 ? NEW_SET_NAME : `${NEW_SET_NAME} ${suffix}`)) suffix++
    return suffix === 1 ? NEW_SET_NAME : `${NEW_SET_NAME} ${suffix}`
  }

  // 改的是目前這一組；還在內建的基本欄位時新增一組並設成這一類的預設，會用掉一組欄位組合的額度
  async function saveFields(kind: WatchlistKind, fields: string[]): Promise<boolean> {
    const previous = sets.value[kind]
    const current = activeSet(kind)
    if (current) {
      sets.value = { ...sets.value, [kind]: previous.map(set => (set.id === current.id ? { ...set, columns: fields.map(field => ({ field })) } : set)) }
      if (await presets[kind].update(current.id, { fields })) return true
      sets.value = { ...sets.value, [kind]: previous }
      showErrorMessage('欄位設定沒有存到，已回到上次存的樣子')
      return false
    }
    const created = await presets[kind].create(unusedName(kind), fields)
    const saved = created && await presets[kind].update(created.id, { isDefault: true })
    if (saved) {
      sets.value = { ...sets.value, [kind]: [...previous, saved] }
      return true
    }
    if (presets[kind].lastErrorCode.value === 'quota_exceeded') showQuotaReached('columnPresets')
    else showErrorMessage('欄位設定沒有存到，已回到上次存的樣子')
    return false
  }

  return { ...catalog, loaded, load, clear, columnsOf, activeIdOf, setItemsOf, select, saveFields }
}
