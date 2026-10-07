import { metricDisplayName, type FilterCategory } from '~/composables/screener/useFilterSchema'
import type { ScreenerResultColumn, ScreenerResultRow } from '~/composables/screener/useFilterSearch'

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
// (ScreenerOrganismIndicatorPicker), then once a field's picked, the value editor
// (ScreenerOrganismRangeEditorPopover), and only once the user actually sets a value does a
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
  // 符合條件的總檔數（bff-ts 回應的 count；2026-10-07 實測是整個結果集的總數、不是這一頁的筆數）
  total: number
  // Scoped to the column view (not the tab as a whole) because a metric sortField only
  // makes sense against the fields that column-preset actually shows — carrying it over to
  // a different column-preset's fetch risks asking bff-ts to sort by a field that request's
  // columns don't include. Reset to null rather than carried forward on a switch to an
  // uncached view (see switchColumnPreset).
  sortField: string | null
  sortOrder: 'asc' | 'desc' | null
}

// Server-side pagination (bff-ts /screener and /screener/presets/{id}/run both take
// page/pageSize now) — page is 1-indexed. Every tab keeps its own, since each is an
// independent search against its own filters.
export const SCREENER_TAB_PAGE_SIZE = 20

export interface ScreenerTab {
  // UUID (a real backend-persisted preset) — never a sequential integer.
  id: string
  name: string
  slots: TabFilterSlot[]
  // "證交所類股" scope (bff-ts, confirmed live 2026-09-11) — persisted on the backing
  // ScreenerPreset alongside `slots`' own filters (see ScreenerPreset.sectorCodes), not a
  // separate resource. Empty array = no sector restriction, same "absent means unrestricted"
  // convention `filters` itself uses.
  sectorCodes: string[]
  // 'exclude' flips what `sectorCodes` means: every company EXCEPT those sectors（直接要求
  // 「普通股篩選要有機制可以排除產業」, 2026-09-20）. Modelled as one list plus a mode rather
  // than two parallel lists because the two ARE mutually exclusive server-side — bff-ts 400s
  // when both arrive non-empty — so a second list could only ever hold a state the backend
  // rejects. Mapped onto sectorCodes / excludeSectorCodes at the moment of the request, and read
  // back the same way (whichever of the two the preset carries non-empty decides the mode), which
  // means the mode survives a reload without needing any storage of its own.
  sectorMode: 'include' | 'exclude'
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
  // 符合條件的總檔數（bff-ts 回應的 count；2026-10-07 實測是整個結果集的總數、不是這一頁的筆數）
  total: number
  // 整個結果集的排序（bff-ts，2026-09-01 實測）——只能是 symbol 或指標欄位；"name" 後端不支援（見 ScreenerSortParams），
  // 在 SharedMetricTable 裡做頁內的用戶端排序。
  sortField: string | null
  sortOrder: 'asc' | 'desc' | null
  loading: boolean
  // Separate from `loading` on purpose — `loading` drives OrganismResultBody.vue's
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
// per bff-ts's own read (they'd just shipped null resolving server-side to a real curated
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
}

// export 給 useScreenerTabColumnPresets 用（2026-10-02 拆檔時）——兩邊都要用同一個 key 規則讀寫
// tab.columnViewCache，各寫一份就是一個等著漂移的 bug（key 算得不一樣等於快取永遠 miss）。
export function columnViewCacheKey(columnPresetId: string | null) {
  return columnPresetId === null ? 'default' : String(columnPresetId)
}

// Looked up by name/key rather than hardcoded, since the exact "<metricKey>.<fieldKey>"
// string depends on how the BFF's /filters catalog actually names it.
const ROE_PATTERN = /roe|股東權益報酬率|權益報酬率/i

export function findRoeField(categories: FilterCategory[]) {
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
// 這三支是模組層函式而不是某個 composable 的成員，因為它們不閉包任何東西：參數進、改參數出。
// 原本的拆分計畫把「類股範圍」列為一個要獨立成 composable 的叢集，還說要拿它「先確認聚合器的接法
// 可行」。讀完才發現它是兩行一句的 setter 加一個轉換——包一層 ctx 只是把兩行變成一個檔案，
// **那一層抽象比重複本身貴**。聚合器的接法改用條件編輯那一刀確認了。
// The one place tab.sectorMode turns into wire fields. Both keys are always present (never
// spread-conditionally) so a PATCH that switches modes actively CLEARS the other side rather
// than leaving the preset's stale list in place — bff-ts also auto-clears on its own end, but a
// request that says what it means doesn't depend on that.
export function sectorScopeFor(tab: ScreenerTab): { sectorCodes: string[]; excludeSectorCodes: string[] } {
  return tab.sectorMode === 'exclude'
    ? { sectorCodes: [], excludeSectorCodes: tab.sectorCodes }
    : { sectorCodes: tab.sectorCodes, excludeSectorCodes: [] }
}

// 類股篩選 (see ScreenerTab.sectorCodes's own comment) — the actual PATCH + re-search happens
// through watchTabForAutoSearch's own watcher (it's bundled into the same JSON blob as the
// filter slots), same as editing a numeric condition; this setter's only job is the local
// mutation that watcher is watching for.
export function setSectorCodes(tab: ScreenerTab, codes: string[]) {
  tab.sectorCodes = codes
}

// Flipping 包含/排除 keeps the picked sectors — the user's selection is "these industries", and
// the mode only decides which side of the line they fall on. Re-picking them after every toggle
// would be busywork.
export function setSectorMode(tab: ScreenerTab, mode: 'include' | 'exclude') {
  tab.sectorMode = mode
}
