import type { MetricCategory } from '~/composables/screener/useFilterSchema'
import type { FilterCriterion, ScreenerResultRow } from '~/composables/screener/useFilterSearch'
import type { ScreenerPreset } from '~/composables/screener/useScreenerPresets'
import type { ColumnPresetTemplate, ScreenerColumnPreset } from '~/composables/screener/useScreenerColumnPresets'
import type { ScreenerTemplateOption, TabFilterSlot, WorkspaceTab } from '~/composables/screener/screener-tab-model'
import type { PresetSelectItem } from '~/components/screener/ScreenerPresetSelect.vue'
import type { ScreenerResultTableColumn } from '~/components/shared/SharedMetricTable.vue'
import type { ScreenerUniverse } from '~/utils/screener-zone'

// 特別股與 ETF 的篩選狀態（2026-10-15 三組篩選重新設計）。畫面是 ScreenerPageShell，跟普通股同一份；這裡是另一個實作。
//
// 為什麼不用普通股的 useScreenerTabs：那一族是圍著普通股的後端長的——查詢走 /screener/presets/{id}/run、欄位由伺服器解析、
// 訪客走另一條路。這兩組的「我的篩選」「欄位組合」存在同一個後端資源（universe 分開，業務中台 84112d8），查詢卻是各自的
// （ETF 打 POST /etf-screener，特別股 28 檔一次讀進來自己篩），所以共用儲存與畫面，不共用查詢流程。
//
// 跟普通股一樣的（學一組就會用另外兩組）：改條件 0.6 秒後自動查、已存的那一組同時存回帳號；新增、改名、上下移、刪除。
// 只有這兩組有的：最前面一組內建的「全部」（進來就列出全部，使用者決定）與內建的「基本欄位」。內建的改了就標「未儲存」，
// 按「存成…」才存進帳號——免費額度是三組合計 3 組（業務中台 2026-10-15），不能一進來就替使用者建一組。

// 這兩組的欄位沒有期別。型錄轉成普通股的形狀（類別 → 指標 → 欄位）時每個指標只有一個 snapshot 欄位，條件膠囊、挑選面板、
// 結果表都直接能用。畫面上的欄位 id 是「欄位.snapshot」；存進帳號、送給查詢的是原本的欄位名，在這裡的邊界轉換。
const SNAPSHOT_SUFFIX = '.snapshot'

export function snapshotFieldId(field: string): string {
  return `${field}${SNAPSHOT_SUFFIX}`
}

export function snapshotField(fieldId: string): string {
  return fieldId.endsWith(SNAPSHOT_SUFFIX) ? fieldId.slice(0, -SNAPSHOT_SUFFIX.length) : fieldId
}

export interface SnapshotMetric {
  field: string
  name: string
  unit?: string
  kind?: 'numeric' | 'categorical'
  options?: { value: string | number; label: string }[]
  description?: string
}

export function snapshotCategory(key: string, name: string, sort: number, metrics: SnapshotMetric[]): MetricCategory {
  return {
    key,
    name,
    sort,
    metrics: metrics.map((metric, index) => ({
      key: metric.field,
      name: metric.name,
      path: metric.field,
      unit: metric.unit ?? '',
      sort: index,
      kind: metric.kind ?? 'numeric',
      options: metric.options,
      description: metric.description ?? null,
      fields: [{ key: 'snapshot', name: metric.name, period: 'snapshot', unit: metric.unit ?? '', sort: 0, description: metric.description }]
    }))
  }
}

// 查詢用的是原本的欄位名（不帶 .snapshot）；回來的列要用畫面的欄位 id 當 values 的鍵
export interface UniverseQuery {
  filters: FilterCriterion[]
  columns: string[]
  sort: { field: string; order: 'asc' | 'desc' } | null
  page: number
  pageSize: number
}

export interface UniverseResult {
  rows: ScreenerResultRow[]
  total: number
  totalPages: number
}

export interface UniverseTemplate extends ScreenerTemplateOption {
  filters: FilterCriterion[]
}

// 一組篩選的資料來源：三組的差異只寫在這裡（型錄、查詢、欄位格式、範本、點進去的頁面）
export interface UniverseSource {
  universe: Exclude<ScreenerUniverse, 'common'>
  // 內建的那一組「我的篩選」：沒有條件、列出全部
  allName: string
  categories: Readonly<Ref<MetricCategory[]>>
  // 型錄讀到了才開始（條件膠囊要用型錄的名稱）
  ready: Readonly<Ref<boolean>>
  // 內建「基本欄位」的欄位 id
  defaultColumns: string[]
  filterTemplates: UniverseTemplate[]
  // fieldKeys 是畫面的欄位 id
  columnTemplates: ColumnPresetTemplate[]
  column(fieldId: string): ScreenerResultTableColumn
  run(query: UniverseQuery): Promise<UniverseResult>
  rowLink(symbol: string): string
  sortMode: 'server' | 'client'
  // 整份資料的日期（特別股：最新的收盤日）；ETF 各欄位的時間不同，不給
  dataDate?: Readonly<Ref<string | null>>
}

interface UniverseTab extends WorkspaceTab {
  columns: ScreenerResultTableColumn[]
  // 存在帳號裡；false＝內建的「全部」
  saved: boolean
}

interface ColumnSet {
  id: string
  name: string
  fields: string[]
  saved: boolean
}

const AUTO_SEARCH_DELAY_MS = 600
const PAGE_SIZE = 20
const BUILT_IN_ID = 'built-in'

export function useUniverseScreener(source: UniverseSource) {
  const currentUser = useCurrentUser()
  const authResolved = useAuthResolved()
  const { open: openLogin } = useLoginDialog()
  const presetsApi = useScreenerPresets(source.universe)
  const columnsApi = useScreenerColumnPresets(source.universe)
  const tabKey = `oingg-screener-${source.universe}-preset`
  const columnSetKey = `oingg-screener-${source.universe}-columns`

  const tabs = ref<UniverseTab[]>([])
  const activeTabId = ref('')
  const activeTab = computed(() => tabs.value.find(tab => tab.id === activeTabId.value) ?? null)
  const columnSets = ref<ColumnSet[]>([])
  const activeColumnSetId = ref('')
  const activeColumnSet = computed(() => columnSets.value.find(set => set.id === activeColumnSetId.value) ?? columnSets.value[0] ?? null)
  const ready = ref(false)

  function labelOf(fieldId: string): string {
    return locateFieldInSchema(source.categories.value, fieldId)?.metric.name ?? source.column(fieldId).label
  }

  function columnsOf(fieldIds: string[]): ScreenerResultTableColumn[] {
    return fieldIds.map(fieldId => source.column(fieldId))
  }

  function slotsOf(filters: FilterCriterion[]): TabFilterSlot[] {
    return filters.map((filter, index) => {
      const fieldId = snapshotFieldId(filter.field)
      return {
        id: index,
        fieldId,
        fieldLabel: labelOf(fieldId),
        // 存進帳號的區間也可能是日期字串（業務中台 收），這兩組的畫面目前只產生數字
        min: typeof filter.min === 'number' ? filter.min : null,
        max: typeof filter.max === 'number' ? filter.max : null,
        exclude: filter.exclude ?? false,
        values: filter.values?.length ? [...filter.values] : undefined
      }
    })
  }

  // 只送真的條件：沒選欄位、數字型沒有上下限、類別型沒勾任何項目的都不算
  function filtersOf(tab: UniverseTab): FilterCriterion[] {
    return tab.slots.flatMap((slot): FilterCriterion[] => {
      if (slot.fieldId === null) return []
      const field = snapshotField(slot.fieldId)
      if (slot.values?.length) return [{ field, min: null, max: null, exclude: slot.exclude, values: [...slot.values] }]
      if (slot.values !== undefined || (slot.min === null && slot.max === null)) return []
      return [{ field, min: slot.min, max: slot.max, exclude: slot.exclude }]
    })
  }

  function makeTab(id: string, name: string, saved: boolean, filters: FilterCriterion[]): UniverseTab {
    return {
      id,
      name,
      saved,
      slots: slotsOf(filters),
      columns: columnsOf(activeColumnSet.value?.fields ?? source.defaultColumns),
      results: [],
      page: 1,
      totalPages: 0,
      total: 0,
      sortField: null,
      sortOrder: null,
      loading: false,
      loadingMore: false,
      searched: false
    }
  }

  function presetToTab(preset: ScreenerPreset): UniverseTab {
    return makeTab(preset.id, preset.name, true, preset.filters ?? [])
  }

  function toColumnSet(preset: ScreenerColumnPreset): ColumnSet {
    return { id: preset.id, name: preset.name, fields: preset.columns.map(column => snapshotFieldId(column.field)), saved: true }
  }

  // ---- 查詢 ----
  // 每個頁籤自己的序號：條件連續改的時候，晚回來的舊查詢不能蓋掉新的
  const requestSeq = new Map<string, number>()
  const searchFailure = shallowRef<{ tabId: string; error: unknown } | null>(null)
  watchLoadFailure(`${source.universe}-screener`, () => searchFailure.value?.error ?? null, async () => {
    const tab = tabs.value.find(item => item.id === searchFailure.value?.tabId)
    if (tab) await search(tab)
    else searchFailure.value = null
  })

  async function search(tab: UniverseTab, append = false) {
    const seq = (requestSeq.get(tab.id) ?? 0) + 1
    requestSeq.set(tab.id, seq)
    const page = append ? tab.page + 1 : 1
    if (append) tab.loadingMore = true
    else tab.loading = true
    tab.searched = true
    try {
      const result = await source.run({
        filters: filtersOf(tab),
        columns: tab.columns.map(column => snapshotField(column.field)),
        sort: tab.sortField && tab.sortOrder ? { field: snapshotField(tab.sortField), order: tab.sortOrder } : null,
        page,
        pageSize: PAGE_SIZE
      })
      if (requestSeq.get(tab.id) !== seq) return
      tab.results = append ? [...tab.results, ...result.rows] : result.rows
      tab.page = page
      tab.total = result.total
      tab.totalPages = result.totalPages
      if (searchFailure.value?.tabId === tab.id) searchFailure.value = null
    } catch (error) {
      if (requestSeq.get(tab.id) !== seq) return
      if (append) {
        showErrorMessage('載入更多失敗，請稍後再試')
        return
      }
      tab.results = []
      tab.total = 0
      tab.totalPages = 0
      // 4xx（條件不合法）是可以行動的回饋，照上游的理由提示；其他交給全站讀取失敗彈窗
      if (classifyApiError(error).kind === 'client') showErrorMessage(describeBusinessError(error) ?? '搜尋失敗，請稍後再試')
      else searchFailure.value = { tabId: tab.id, error }
    } finally {
      if (requestSeq.get(tab.id) === seq) {
        tab.loading = false
        tab.loadingMore = false
      }
    }
  }

  // 改條件：0.6 秒後查一次；已存的那一組同時存回帳號。每個頁籤自己一個計時器，改完馬上切走也不會被下一組的改動吃掉
  const pendingEdits = new Map<string, ReturnType<typeof debounce<[]>>>()

  async function applyEdit(tab: UniverseTab) {
    const saving = tab.saved && currentUser.value
      ? presetsApi.update(tab.id, { filters: filtersOf(tab) }).then((updated) => {
          if (!updated) showErrorMessage(presetsApi.lastErrorMessage.value ?? '條件沒有存進帳號，請稍後再試')
        })
      : null
    await Promise.all([saving, search(tab)])
  }

  function scheduleEdit(tabId: string) {
    let trigger = pendingEdits.get(tabId)
    if (!trigger) {
      trigger = debounce(() => {
        const tab = tabs.value.find(item => item.id === tabId)
        if (tab) applyEdit(tab)
      }, AUTO_SEARCH_DELAY_MS)
      pendingEdits.set(tabId, trigger)
    }
    trigger()
  }

  // 同一個頁籤的條件變了才算「改」；換頁籤不算（換頁籤由 selectTab 自己決定要不要查）
  watch(
    () => (activeTab.value ? { id: activeTab.value.id, filters: JSON.stringify(filtersOf(activeTab.value)) } : null),
    (next, previous) => {
      if (!ready.value || !next || !previous) return
      if (next.id === previous.id && next.filters !== previous.filters) scheduleEdit(next.id)
    }
  )

  // ---- 我的篩選 ----
  function selectTab(id: string) {
    const tab = tabs.value.find(item => item.id === id)
    if (!tab) return
    activeTabId.value = id
    rememberChoice(tabKey, id)
    if (!tab.searched) search(tab)
  }

  function registerTab(tab: UniverseTab): UniverseTab {
    tabs.value.push(tab)
    // 之後一律改 tabs 裡那一份（被 Vue 包過的），改原本的物件畫面不會更新（同 useScreenerTabCrud 的 registerTab）
    return tabs.value[tabs.value.length - 1]!
  }

  async function createPreset(filters: FilterCriterion[], name: string): Promise<UniverseTab | null> {
    const created = await presetsApi.create(filters)
    if (!created) {
      if (presetsApi.lastErrorCode.value === 'quota_exceeded') showQuotaReached(PRESET_QUOTA_LABEL)
      else showErrorMessage(presetsApi.lastErrorMessage.value ?? '新增篩選失敗，請稍後再試')
      return null
    }
    // POST 不收名稱（業務中台 自己給一個預設名），建好再改名；改名失敗（例如同名）就留預設名並說明
    const renamed = await presetsApi.update(created.id, { name })
    if (!renamed) showErrorMessage(presetsApi.lastErrorMessage.value ?? `已新增，但名稱沒有改成「${name}」`)
    return registerTab(presetToTab(renamed ?? created))
  }

  // 新的這一組接手目前的結果，不必再查一次
  function adoptResults(target: UniverseTab, from: UniverseTab) {
    target.results = from.results
    target.page = from.page
    target.total = from.total
    target.totalPages = from.totalPages
    target.sortField = from.sortField
    target.sortOrder = from.sortOrder
    target.searched = from.searched
  }

  function requireLogin(): boolean {
    if (currentUser.value) return true
    openLogin()
    return false
  }

  async function saveActiveTab() {
    const tab = activeTab.value
    if (!tab || tab.saved || !requireLogin()) return
    const name = await promptPresetName('存成我的篩選', `我的篩選 ${tabs.value.filter(item => item.saved).length + 1}`)
    if (!name) return
    const created = await createPreset(filtersOf(tab), name)
    if (!created) return
    adoptResults(created, tab)
    // 內建的回到沒有條件、列出全部，下次切回去再查
    tab.slots = []
    tab.searched = false
    selectTab(created.id)
  }

  const newTabDialogVisible = ref(false)

  function openNewTabDialog() {
    if (requireLogin()) newTabDialogVisible.value = true
  }

  async function addTab() {
    const created = await createPreset([], `未命名 ${tabs.value.length}`)
    if (created) selectTab(created.id)
  }

  async function addTemplateTab(id: string) {
    const template = source.filterTemplates.find(item => item.id === id)
    if (!template) return
    const created = await createPreset(template.filters, template.name)
    if (created) selectTab(created.id)
  }

  async function copyActiveTab() {
    const tab = activeTab.value
    if (!tab) return
    const created = await createPreset(filtersOf(tab), `${tab.name} 的副本`.slice(0, 20))
    if (!created) return
    adoptResults(created, tab)
    selectTab(created.id)
  }

  async function renamePreset(id: string, name: string) {
    const tab = tabs.value.find(item => item.id === id)
    if (!tab?.saved) return
    const previous = tab.name
    tab.name = name
    const updated = await presetsApi.update(id, { name })
    if (updated) tab.name = updated.name
    else {
      tab.name = previous
      showErrorMessage(presetsApi.lastErrorMessage.value ?? '改名失敗，請稍後再試')
    }
  }

  // 選單已經先切到旁邊那一組、10 秒復原時間也過了才會到這裡（ScreenerPresetSelect）
  async function removePreset(id: string) {
    const ok = await presetsApi.remove(id)
    if (!ok) {
      showErrorMessage(presetsApi.lastErrorMessage.value ?? '刪除失敗，請稍後再試')
      return
    }
    pendingEdits.get(id)?.cancel()
    pendingEdits.delete(id)
    tabs.value = tabs.value.filter(tab => tab.id !== id)
    if (activeTabId.value === id) selectTab(BUILT_IN_ID)
  }

  // 內建的永遠在最前面；業務中台 要這個 universe 全部已存的 id、照新順序
  async function reorderTabs(ids: string[]) {
    const previous = tabs.value
    const byId = new Map(previous.map(tab => [tab.id, tab]))
    const saved = ids.filter(id => byId.get(id)?.saved)
    tabs.value = [...previous.filter(tab => !tab.saved), ...saved.map(id => byId.get(id)!)]
    if (!saved.length) return
    const ok = await presetsApi.reorder(saved)
    if (!ok) {
      tabs.value = previous
      showErrorMessage(presetsApi.lastErrorMessage.value ?? '排序失敗，請稍後再試')
    }
  }

  // ---- 顯示欄位 ----
  function builtInColumnSet(): ColumnSet {
    return { id: BUILT_IN_ID, name: '基本欄位', fields: [...source.defaultColumns], saved: false }
  }

  // 欄位換了：每個頁籤的欄位跟著換；目前這一組要不要重查由呼叫端決定，其他組下次切過去再查（ETF 只回要的欄位）。
  // 排序的那一欄不在了（換了欄位組合、移除了那一欄）就清掉排序：ETF 的上游只接受 symbol 或 columns 裡的欄位當 sortField，其他一律 400
  // （2026-10-16「sortField "expenseRatio" 要嘛是 "symbol"，要嘛要先出現在 columns 裡才能排序」）。回傳目前這一組的排序有沒有被清掉
  function applyColumns(fieldIds: string[]): boolean {
    let activeSortCleared = false
    for (const tab of tabs.value) {
      tab.columns = columnsOf(fieldIds)
      if (tab.sortField && tab.sortField !== 'symbol' && !fieldIds.includes(tab.sortField)) {
        tab.sortField = null
        tab.sortOrder = null
        if (tab.id === activeTabId.value) activeSortCleared = true
      }
      if (tab.id !== activeTabId.value) tab.searched = false
    }
    return activeSortCleared
  }

  function setActiveColumns(fieldIds: string[]) {
    const set = activeColumnSet.value
    if (!set) return
    set.fields = fieldIds
    // 排序被清掉就從第一頁重查：不然畫面上這一頁還是照舊的順序，往下捲接的下一頁卻是預設順序
    if (applyColumns(fieldIds) && activeTab.value) search(activeTab.value)
    if (set.saved && currentUser.value) {
      columnsApi.update(set.id, { fields: fieldIds.map(snapshotField) }).then((updated) => {
        if (!updated) showErrorMessage(columnsApi.lastErrorMessage.value ?? '欄位沒有存進帳號，請稍後再試')
      })
    }
  }

  function selectColumnSet(id: string) {
    const set = columnSets.value.find(item => item.id === id)
    if (!set) return
    activeColumnSetId.value = id
    rememberChoice(columnSetKey, id)
    applyColumns(set.fields)
    if (activeTab.value) search(activeTab.value)
  }

  async function createColumnSet(name: string, fieldIds: string[]): Promise<ColumnSet | null> {
    const created = await columnsApi.create(name, fieldIds.map(snapshotField))
    if (!created) {
      if (columnsApi.lastErrorCode.value === 'quota_exceeded') showQuotaReached(COLUMN_QUOTA_LABEL)
      else showErrorMessage(columnsApi.lastErrorMessage.value ?? '新增欄位組合失敗，請稍後再試')
      return null
    }
    columnSets.value.push(toColumnSet(created))
    return columnSets.value[columnSets.value.length - 1]!
  }

  async function saveColumnSet() {
    const set = activeColumnSet.value
    if (!set || set.saved || !requireLogin()) return
    const name = await promptPresetName('存成我的欄位組合', `欄位組合 ${columnSets.value.filter(item => item.saved).length + 1}`)
    if (!name) return
    const created = await createColumnSet(name, set.fields)
    if (!created) return
    set.fields = [...source.defaultColumns]
    activeColumnSetId.value = created.id
    rememberChoice(columnSetKey, created.id)
  }

  const newColumnPresetDialogVisible = ref(false)

  function openNewColumnPresetDialog() {
    if (requireLogin()) newColumnPresetDialogVisible.value = true
  }

  async function confirmCustomColumnPreset() {
    const created = await createColumnSet(`欄位組合 ${columnSets.value.length}`, [])
    if (created) selectColumnSet(created.id)
  }

  async function applyColumnPresetTemplate(key: string) {
    const template = source.columnTemplates.find(item => item.key === key)
    if (!template) return
    const created = await createColumnSet(template.name, template.fieldKeys)
    if (created) selectColumnSet(created.id)
  }

  async function renameColumnSet(id: string, name: string) {
    const set = columnSets.value.find(item => item.id === id)
    if (!set?.saved) return
    const previous = set.name
    set.name = name
    const updated = await columnsApi.update(id, { name })
    if (updated) set.name = updated.name
    else {
      set.name = previous
      showErrorMessage(columnsApi.lastErrorMessage.value ?? '改名失敗，請稍後再試')
    }
  }

  async function removeColumnSet(id: string) {
    const ok = await columnsApi.remove(id)
    if (!ok) {
      showErrorMessage(columnsApi.lastErrorMessage.value ?? '刪除失敗，請稍後再試')
      return
    }
    columnSets.value = columnSets.value.filter(set => set.id !== id)
    if (activeColumnSetId.value === id) selectColumnSet(BUILT_IN_ID)
  }

  async function reorderColumnSets(ids: string[]) {
    const previous = columnSets.value
    const byId = new Map(previous.map(set => [set.id, set]))
    const saved = ids.filter(id => byId.get(id)?.saved)
    columnSets.value = [...previous.filter(set => !set.saved), ...saved.map(id => byId.get(id)!)]
    if (!saved.length) return
    const ok = await columnsApi.reorder(saved)
    if (!ok) {
      columnSets.value = previous
      showErrorMessage(columnsApi.lastErrorMessage.value ?? '排序失敗，請稍後再試')
    }
  }

  // ---- 條件與欄位的編輯（三組共用同一套流程）----
  const editor = useScreenerConditionEditor<UniverseTab>({
    // 從「新增欄位」挑了一欄：存成目前這一組的欄位（重新套上這一欄的格式與說明）
    syncColumnPreset: async tab => setActiveColumns(tab.columns.map(column => column.field)),
    runSearch: tab => search(tab),
    cacheColumnView: () => {}
  })

  function handleRemoveColumn(_tab: UniverseTab, field: string) {
    setActiveColumns((activeColumnSet.value?.fields ?? []).filter(item => item !== field))
  }

  function handleReorderColumns(_tab: UniverseTab, fields: string[]) {
    setActiveColumns(fields)
  }

  function loadMoreResults(tab: UniverseTab) {
    if (tab.loading || tab.loadingMore || tab.page >= tab.totalPages) return
    search(tab, true)
  }

  function changeSort(tab: UniverseTab, field: string | null, order: 'asc' | 'desc' | null) {
    if (field === tab.sortField && order === tab.sortOrder) return
    tab.sortField = field
    tab.sortOrder = order
    search(tab)
  }

  // ---- 畫面的兩個選單 ----
  const hasConditions = (tab: UniverseTab) => tab.slots.some(slot => slot.fieldId !== null)
  const presetItems = computed<PresetSelectItem[]>(() => tabs.value.map(tab => ({
    id: tab.id,
    name: tab.name,
    editable: tab.saved,
    unsaved: !tab.saved && hasConditions(tab)
  })))
  const columnSetItems = computed<PresetSelectItem[]>(() => columnSets.value.map(set => ({
    id: set.id,
    name: set.name,
    editable: set.saved,
    unsaved: !set.saved && set.fields.join('|') !== source.defaultColumns.join('|')
  })))

  // ---- 載入：登入狀態確定、型錄到了才開始。登入或登出後重讀，但內建那兩組的修改留著（訪客按「存成…」登入之後還在）----
  let bootSeq = 0
  watch(
    [authResolved, currentUser, source.ready],
    async ([resolved, user, sourceReady]) => {
      if (!resolved || !sourceReady) return
      const seq = ++bootSeq
      const [presets, columnPresets] = user ? await Promise.all([presetsApi.list(), columnsApi.list()]) : [[], []]
      if (seq !== bootSeq) return

      const builtInColumns = columnSets.value.find(set => !set.saved) ?? builtInColumnSet()
      columnSets.value = [builtInColumns, ...columnPresets.map(toColumnSet)]
      const rememberedColumns = rememberedChoice(columnSetKey)
      activeColumnSetId.value = columnSets.value.find(set => set.id === rememberedColumns)?.id
        ?? columnPresets.find(preset => preset.isDefault)?.id
        ?? BUILT_IN_ID

      const builtInTab = tabs.value.find(tab => !tab.saved) ?? makeTab(BUILT_IN_ID, source.allName, false, [])
      builtInTab.columns = columnsOf(activeColumnSet.value?.fields ?? source.defaultColumns)
      builtInTab.searched = false
      tabs.value = [builtInTab, ...presets.map(presetToTab)]
      const rememberedTab = rememberedChoice(tabKey)
      activeTabId.value = tabs.value.find(tab => tab.id === rememberedTab)?.id ?? BUILT_IN_ID
      ready.value = true
      if (activeTab.value) search(activeTab.value)
    },
    { immediate: true }
  )

  return {
    ready,
    categories: source.categories,
    activeTab,
    sortMode: source.sortMode,
    rowLink: source.rowLink,
    periodToggle: false,
    dataDate: source.dataDate ?? ref(null),
    presetItems,
    activeTabId,
    selectTab,
    openNewTabDialog,
    renamePreset,
    removePreset,
    reorderTabs,
    saveActiveTab,
    columnSetItems,
    activeColumnSetId,
    selectColumnSet,
    openNewColumnPresetDialog,
    renameColumnSet,
    removeColumnSet,
    reorderColumnSets,
    saveColumnSet,
    pickerVisible: editor.pickerVisible,
    pickerMode: editor.pickerMode,
    pickerCurrentFieldId: editor.pickerCurrentFieldId,
    rangeEditorVisible: editor.rangeEditorVisible,
    rangeEditorSlot: editor.rangeEditorSlot,
    addConditionAndOpenPicker: editor.addConditionAndOpenPicker,
    openFieldPicker: editor.openFieldPicker,
    openRangeEditor: editor.openRangeEditor,
    openColumnPicker: editor.openColumnPicker,
    removeSlot: editor.removeSlot,
    handleSelect: editor.handleSelect,
    changeRangeEditorPeriod: editor.changeRangeEditorPeriod,
    backToPicker: editor.backToPicker,
    closePanel: editor.closePanel,
    loadMoreResults,
    changeSort,
    handleReorderColumns,
    handleRemoveColumn,
    newTabDialogVisible,
    templates: source.filterTemplates,
    templatesLoading: false,
    addTab,
    addTemplateTab,
    copyActiveTab,
    newColumnPresetDialogVisible,
    columnPresetTemplates: source.columnTemplates,
    columnPresetTemplatesLoading: false,
    confirmCustomColumnPreset,
    applyColumnPresetTemplate
  }
}
