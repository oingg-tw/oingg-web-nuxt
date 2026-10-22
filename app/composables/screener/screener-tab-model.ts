import type { MetricCategory } from '~/composables/screener/useFilterSchema'
import type { ScreenerResultColumn, ScreenerResultRow } from '~/composables/screener/useFilterSearch'
import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'
import type { ColumnPresetTemplate } from '~/composables/screener/useScreenerColumnPresets'
import type { PresetSelectItem } from '~/components/screener/ScreenerPresetSelect.vue'

// 篩選器頁籤的**資料模型**：型別，加上幾支只讀參數、不閉包任何狀態的純函式。
// 2026-10-02 從 useScreenerTabs.ts 抽出來（拆檔的最後一步，前三刀是條件編輯／欄位組合／頁籤增刪改）。
//
// 為什麼值得獨立一個檔案：這些型別的註解**就是**這份資料模型的文件——為什麼有 columnViewCache、
// 為什麼 sectorMode 是一個模式而不是第二個清單、為什麼 loadingMore 要跟 loading 分開——而它們被
// 四個 composable 與兩個元件共用。夾在核心的實作前面，讀起來像是核心的內部細節，它們不是。
//
// 計畫原本把檔名寫成 screener-tab-types.ts；這裡叫 model 是因為它不只有型別。那幾支純函式
// （`columnViewCacheKey`、`sectorScopeFor`、兩個 sector setter）本來就不該住在 composable 的閉包裡，
// 它們只是 `(tab, …) => …`。
// Each tab is an independent, backend-persisted preset (POST /screener/presets on
// creation) — switching tabs never re-fetches, since every tab keeps its own last-run
// results until its own filters change again.
//
// "新增條件" doesn't append anything here directly — it opens the field picker
// (ScreenerConditionPanel), then once a field's picked, the value editor
// (ScreenerRangeEditor), and only once the user actually sets a value does a
// real slot get pushed here (see closeRangeEditor). Picking a field but abandoning the value
// editor without setting anything never creates a slot at all — per explicit feedback that
// the old "add first, ask questions later" flow left a visible empty filter on screen before
// the user had chosen anything. Reassigning an already-filled slot's field goes through the
// same two dialogs, just against a real slot instead of a still-being-built one.
export interface TabFilterSlot {
  id: number
  fieldId: string | null
  fieldLabel: string | null
  min: number | null
  max: number | null
  exclude: boolean
  // 類別型條件選了哪些項目（2026-10-15）；數字型條件不帶。exclude 對類別型的意思是「排除這些」
  values?: (string | number)[]
}

// 條件編輯（useScreenerConditionEditor）只碰頁籤的這三個欄位——普通股、特別股、ETF 三組的頁籤都滿足它，共用同一套條件流程
export interface ConditionTab {
  slots: TabFilterSlot[]
  columns: ResultColumnChoice[]
  searched: boolean
}

// 三組篩選共用的畫面（ScreenerPageShell）看得到的頁籤：普通股的 ScreenerTab 與特別股／ETF 的頁籤（useUniverseScreener）都滿足它
export interface WorkspaceTab extends ConditionTab {
  id: string
  name: string
  results: ScreenerResultRow[]
  page: number
  totalPages: number
  total: number
  sortField: string | null
  sortOrder: 'asc' | 'desc' | null
  loading: boolean
  loadingMore: boolean
}

// 新增篩選對話框列出的範本：普通股來自 GET /screener/templates，特別股與 ETF 是本地的幾組起點
export type ScreenerTemplateOption = Pick<ScreenerTemplate, 'id' | 'name' | 'category' | 'description' | 'status' | 'pendingReason'>

// ScreenerPageShell 從這裡拿到它畫的每一樣東西（2026-10-15 三組篩選重新設計，「三組最後使用 UIUX 要接近」）。
// 三組的差異只在實作：普通股是 useScreenerTabs，特別股與 ETF 是 useUniverseScreener。畫面只有 ScreenerPageShell 一份，
// 改一個控制項三組一起改，不會有哪一頁漏接。頁面傳 reactive(...) 進來，裡面的 ref 會自動解開。
//
// 方法用「方法」語法宣告（不是箭頭屬性）：普通股的實作吃 ScreenerTab，比 WorkspaceTab 多欄位，方法語法讓它可以直接放進來。
export interface ScreenerWorkspace {
  // 登入狀態與清單都讀到了才畫（沒登入的那一瞬間不要閃一個空的）
  ready: boolean
  categories: MetricCategory[]
  activeTab: WorkspaceTab | null
  // 結果表的排序：server＝點表頭打後端（普通股、ETF），client＝在手上的列自己排（特別股，全部一次讀進來）
  sortMode: 'server' | 'client'
  rowLink(symbol: string): string
  // true：欄名的期別與每格的資料日期跟著「顯示資料時間」開關（普通股）；false：欄名照原樣、不印每格日期（特別股、ETF 沒有期別）
  periodToggle: boolean
  // 整份結果的資料日期（特別股是最新收盤日）；沒有就不顯示
  dataDate: string | null

  // 我的篩選
  presetItems: PresetSelectItem[]
  activeTabId: string
  selectTab(id: string): void
  openNewTabDialog(): void
  renamePreset(id: string, name: string): void
  removePreset(id: string): void
  reorderTabs(ids: string[]): void
  saveActiveTab(): void

  // 顯示欄位
  columnSetItems: PresetSelectItem[]
  activeColumnSetId: string
  selectColumnSet(id: string): void
  openNewColumnPresetDialog(tab: WorkspaceTab): void
  renameColumnSet(id: string, name: string): void
  removeColumnSet(id: string): void
  reorderColumnSets(ids: string[]): void
  saveColumnSet(): void

  // 條件（useScreenerConditionEditor）
  pickerVisible: boolean
  pickerMode: 'condition' | 'column'
  pickerCurrentFieldId: string | null
  rangeEditorVisible: boolean
  rangeEditorSlot: TabFilterSlot | null
  addConditionAndOpenPicker(tab: WorkspaceTab, triggerEl: HTMLElement): void
  openFieldPicker(tab: WorkspaceTab, slotId: number | null, triggerEl: HTMLElement): void
  openRangeEditor(tab: WorkspaceTab, slotId: number, triggerEl: HTMLElement): void
  openColumnPicker(tab: WorkspaceTab, triggerEl: HTMLElement): void
  removeSlot(tab: WorkspaceTab, slotId: number): void
  handleSelect(fieldId: string, fieldLabel: string): void
  changeRangeEditorPeriod(fieldId: string): void
  backToPicker(): void
  closePanel(): void

  // 結果表
  loadMoreResults(tab: WorkspaceTab): void
  changeSort(tab: WorkspaceTab, field: string | null, order: 'asc' | 'desc' | null): void
  handleReorderColumns(tab: WorkspaceTab, fields: string[]): void
  handleRemoveColumn(tab: WorkspaceTab, field: string): void

  // 新增篩選／新增欄位組合的對話框
  newTabDialogVisible: boolean
  templates: ScreenerTemplateOption[]
  templatesLoading: boolean
  addTab(): void
  addTemplateTab(id: string): void
  copyActiveTab(): void
  newColumnPresetDialogVisible: boolean
  columnPresetTemplates: ColumnPresetTemplate[]
  columnPresetTemplatesLoading: boolean
  confirmCustomColumnPreset(): void
  applyColumnPresetTemplate(key: string): void
}

// Display columns are their own saved resource (/screener/column-presets), separate from
// filter presets. Each screener tab gets its own backing column-preset, created lazily
// the first time the tab has any columns to show — `columnPresetId` tracks it so later
// edits PATCH the same one instead of creating duplicates. The server also remembers a
// preset's last-viewed columnPresetId on its own, so after any run this gets reconciled
// to whatever the server says was actually applied (which may already be set from a
// previous session, even before this tab has been searched here).
export interface ResultColumnChoice {
  field: string
  label: string
}

// One fetched column view — this tab's results/columns as seen through one particular
// column-preset. Cached per tab so flipping back and forth between column-preset tabs
// re-displays instantly instead of re-hitting the API every time. Page/pageSize/totalPages
// travel with it too, so returning to a column-preset you'd paged into earlier restores
// that same page instead of silently resetting to page 1.
interface ScreenerColumnView {
  results: ScreenerResultRow[]
  resultColumns: ScreenerResultColumn[]
  columns: ResultColumnChoice[]
  page: number
  pageSize: number
  totalPages: number
  // 符合條件的總檔數（業務中台 回應的 count；2026-10-07 實測是整個結果集的總數、不是這一頁的筆數）
  total: number
  // Scoped to the column view (not the tab as a whole) because a metric sortField only
  // makes sense against the fields that column-preset actually shows — carrying it over to
  // a different column-preset's fetch risks asking 業務中台 to sort by a field that request's
  // columns don't include. Reset to null rather than carried forward on a switch to an
  // uncached view (see switchColumnPreset).
  sortField: string | null
  sortOrder: 'asc' | 'desc' | null
}

// Server-side pagination (業務中台 /screener and /screener/presets/{id}/run both take
// page/pageSize now) — page is 1-indexed. Every tab keeps its own, since each is an
// independent search against its own filters.
export const SCREENER_TAB_PAGE_SIZE = 20

// 免費額度是三組篩選合計（業務中台 84112d8：篩選 3 組、欄位組合 3 組，普通股＋特別股＋ETF 加起來）；提示要說清楚，
// 不然在 ETF 這邊被擋的人會以為自己只建了一組
export const PRESET_QUOTA_LABEL = '我的篩選（普通股、特別股、ETF 合計）'
export const COLUMN_QUOTA_LABEL = '欄位組合（普通股、特別股、ETF 合計）'

export interface ScreenerTab extends WorkspaceTab {
  // UUID (a real backend-persisted preset) — never a sequential integer.
  id: string
  name: string
  // 條件。證交所類股（2026-10-15 起）也是其中一個類別型條件（fieldId 是 SECTOR_FIELD_ID），送出時才轉成 sectorCodes／
  // excludeSectorCodes（sectorScopeFor）；原本是條件區旁邊另一組「包含／排除＋多選」，三組篩選統一之後跟其他條件同一種膠囊
  slots: TabFilterSlot[]
  // 還沒存進帳號（從 ?template／?sector 打開的、訪客的那一組）：查詢走無狀態的 POST /screener，不 PATCH 條件。
  // 原本登入的人每點一次 ?template 就新建一組、?sector 會蓋掉目前那一組已存的類股（2026-10-15 三組篩選重新設計修掉）
  unsaved?: boolean
  columns: ResultColumnChoice[]
  columnPresetId: string | null
  // Keyed by columnViewCacheKey(columnPresetId) — 'default' for null. tab.columns /
  // tab.results / tab.resultColumns always mirror whichever entry columnPresetId
  // currently points to; the cache is the source of truth for everything not currently
  // on screen, so re-selecting a previously-viewed column-preset is a pure local swap.
  columnViewCache: Record<string, ScreenerColumnView>
  results: ScreenerResultRow[]
  resultColumns: ScreenerResultColumn[]
  page: number
  pageSize: number
  totalPages: number
  // 符合條件的總檔數（業務中台 回應的 count；2026-10-07 實測是整個結果集的總數、不是這一頁的筆數）
  total: number
  // 整個結果集的排序（業務中台，2026-09-01 實測）——只能是 symbol 或指標欄位；"name" 後端不支援（見 ScreenerSortParams），
  // 在 SharedMetricTable 裡做頁內的用戶端排序。
  sortField: string | null
  sortOrder: 'asc' | 'desc' | null
  loading: boolean
  // Separate from `loading` on purpose — `loading` drives ScreenerResultBody.vue's
  // v-loading full-table overlay for a real search/reset; this drives only the small
  // append-slot indicator for an infinite-scroll "load next batch" fetch, so scrolling
  // near the bottom doesn't flash the whole table under an opaque overlay every time.
  loadingMore: boolean
  searched: boolean
  renaming: boolean
  renameDraft: string
}

// Column-presets are a global, per-user catalog with no ownership tie to any one filter
// preset — a filter preset holds only its conditions, a column-preset holds only a
// display configuration (which columns, i.e. what the table shows), and neither belongs
// to the other.
//
// No more "預設" sentinel tab standing in for columnPresetId = null — removed 2026-09-01
// per 業務中台's own read (they'd just shipped null resolving server-side to a real curated
// "overview" preset, which made the client's separate always-there empty tab redundant, not
// load-bearing): once a user has ≥1 saved ColumnPreset, isDefault on a real, owned preset
// already answers "what opens first" better than a magic tab that never actually held
// anything of its own. null now only ever flows to the API for the true zero-preset case
// (a fresh account, or briefly before the first list() resolves) — see
// resolveDefaultColumnPresetId below, which every tab-bootstrap path runs through instead of
// defaulting to null whenever the user actually has a preset to fall back to.
export interface ColumnPresetOption {
  id: string
  name: string
  isDefault: boolean
  // 這一組的欄位：未儲存的頁籤走無狀態查詢，要自己帶欄位（存過的頁籤由伺服器依 columnPresetId 解析）
  fields: string[]
}

// 業務中台 把型錄外的股價（stock.price）接在回應的最後一欄，不管送出時排第幾（2026-10-15 實測：送在第一欄、回來在最後）。
// 照送出的順序排回去，不然結果表一重畫（例如 0 檔之後回來）股價就從第一欄跳到最後。沒送過的欄位留在後面（sort 是穩定的）。
export function inRequestedOrder<T extends { field: string }>(columns: T[], requested: string[]): T[] {
  const rank = new Map(requested.map((field, index) => [field, index]))
  return [...columns].sort((a, b) => (rank.get(a.field) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.field) ?? Number.MAX_SAFE_INTEGER))
}

export function toColumnPresetOption(preset: { id: string; name: string; isDefault: boolean; columns: { field: string }[] }): ColumnPresetOption {
  return { id: preset.id, name: preset.name, isDefault: preset.isDefault, fields: preset.columns.map(column => column.field) }
}

// export 給 useScreenerTabColumnPresets 用（2026-10-02 拆檔時）——兩邊都要用同一個 key 規則讀寫
// tab.columnViewCache，各寫一份就是一個等著漂移的 bug（key 算得不一樣等於快取永遠 miss）。
export function columnViewCacheKey(columnPresetId: string | null) {
  return columnPresetId === null ? 'default' : String(columnPresetId)
}

// Looked up by name/key rather than hardcoded, since the exact "<metricKey>.<fieldKey>"
// string depends on how 業務中台's /filters catalog actually names it.
const ROE_PATTERN = /roe|股東權益報酬率|權益報酬率/i

export function findRoeField(categories: MetricCategory[]) {
  for (const category of categories) {
    for (const metric of category.metrics) {
      for (const field of metric.fields) {
        if (
          ROE_PATTERN.test(field.key) ||
          ROE_PATTERN.test(field.name) ||
          ROE_PATTERN.test(metric.key) ||
          ROE_PATTERN.test(metric.name)
        ) {
          return { fieldId: `${metric.key}.${field.key}`, fieldLabel: metricDisplayName(metric) }
        }
      }
    }
  }
  return null
}

// ── 類股範圍 ───────────────────────────────────────────────────────────────────
// 證交所類股是一個類別型條件（2026-10-15）：values 是類股代碼、exclude 是「排除這些類股」。跟指標條件是兩套分類系統，
// 所以它不是上游型錄的指標，由前端加進「基本資料」（withSectorCondition），送出時從條件裡拿出來、轉成 業務中台 的 sectorCodes／excludeSectorCodes。
export const SECTOR_FIELD_ID = 'sector.code'

export function sectorSlot(id: number, codes: string[], exclude: boolean): TabFilterSlot {
  return { id, fieldId: SECTOR_FIELD_ID, fieldLabel: '類股', min: null, max: null, exclude, values: codes }
}

// The one place the sector condition turns into wire fields. Both keys are always present (never
// spread-conditionally) so a PATCH that switches modes actively CLEARS the other side rather
// than leaving the preset's stale list in place — 業務中台 400s when both arrive non-empty, and a
// request that says what it means doesn't depend on its auto-clear.
export function sectorScopeFor(tab: Pick<ScreenerTab, 'slots'>): { sectorCodes: string[]; excludeSectorCodes: string[] } {
  const slot = tab.slots.find(item => item.fieldId === SECTOR_FIELD_ID)
  // 類股代碼是字串（選項目的值也可能是數字，例如河道位置，但那不是這一格）
  const codes = (slot?.values ?? []).map(String)
  return slot?.exclude ? { sectorCodes: [], excludeSectorCodes: codes } : { sectorCodes: codes, excludeSectorCodes: [] }
}

// 挑選面板裡的「類股」：只能當條件，不能當結果表的欄位（conditionOnly）。放在型錄的「基本資料」裡、市場別後面（2026-10-22，使用者：
//「為什麼 篩選指標 類股 不放在 基本資料中? 產業不算是基本資料嗎」——原本自成一個分類排最後）；型錄沒有基本資料時才自成一類
export function withSectorCondition(categories: MetricCategory[], sectors: { code: string; name: string; companyCount: number }[]): MetricCategory[] {
  const profile = categories.find(category => category.key === 'profile')
  const metric = {
    key: 'sector',
    name: '類股',
    path: 'sector',
    unit: '',
    sort: Math.max(-1, ...(profile?.metrics ?? []).map(item => item.sort)) + 1,
    kind: 'categorical' as const,
    conditionOnly: true,
    options: sectors.map(sector => ({ value: sector.code, label: `${sector.name}（${sector.companyCount}）` })),
    fields: [{ key: 'code', name: '類股', period: 'snapshot', unit: '', sort: 0 }]
  }
  if (!profile) return [...categories, { key: 'sector', name: '類股', sort: Number.MAX_SAFE_INTEGER, metrics: [metric] }]
  return categories.map(category => (category === profile ? { ...category, metrics: [...category.metrics, metric] } : category))
}
