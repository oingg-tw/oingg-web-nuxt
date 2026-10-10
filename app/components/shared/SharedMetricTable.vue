<script setup lang="ts">
import { Close, Loading, Plus } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import type { ScreenerResultRow } from '~/composables/screener/useFilterSearch'
import type { MetricCategory } from '~/composables/screener/useFilterSchema'
// 篩選器結果表，2026-10-06 搬到 shared 讓觀察清單共用（「這個 table 請抽成共用元件」，使用者選「跟篩選器
// 共用一個表格」）。下面標「共用時加的」那幾個 prop 的預設值都是篩選器原本的行為，篩選器不用改任何呼叫。
export interface ScreenerResultTableColumn {
  field: string
  label: string
  // 共用時加的：內容比表頭長的欄位（觀察清單的「漲跌」「下次除權息」）自己指定最小寬度
  minWidth?: number
}

const props = withDefaults(defineProps<{
  // Server-side infinite scroll now (bff-ts /screener and /screener/presets/{id}/run both
  // take page/pageSize) — `rows` is every batch fetched so far for the current search,
  // already accumulated by useScreenerTabs.ts's handleSearch, not just one page's worth.
  rows: ScreenerResultRow[]
  columns: ScreenerResultTableColumn[]
  // Whether there's a further page to fetch (tab.page < tab.totalPages) — drives the
  // #append slot's sentinel/end-of-list state.
  hasMore?: boolean
  // True only while fetching the NEXT batch (useScreenerTabs.ts's tab.loadingMore) —
  // separate from the table's own v-loading overlay (tab.loading, applied by the parent),
  // which is for a real search/reset instead.
  loadingMore?: boolean
  // Full-result-set sort, confirmed live on symbol/metric fields (see useScreenerTabs.ts's
  // changeSort) — el-table's own vocabulary (not bff-ts's asc/desc) since this is purely
  // used to drive el-table's :default-sort, keeping the ascending/descending<->asc/desc
  // translation at the composable boundary instead of inside this component.
  sortField?: string | null
  sortOrder?: 'ascending' | 'descending' | null
  // /filters schema (not the result columns themselves — those don't carry unit) — used
  // purely to look up each displayed field's unit (see unitFor below) so percent metrics
  // can show a % suffix. column.field already matches the schema's own
  // "<metricKey>.<fieldKey>" id format (see locateFieldInSchema).
  categories: MetricCategory[]
  // True for useGuestScreener.ts's own read-only result view (see screener.vue) — a signed-out
  // visitor has no owned column-preset to edit, so the "+" add-column control, each column's
  // remove icon, and drag-reorder are all hidden/disabled rather than wired to handlers that
  // would silently no-op. Defaults to false (every signed-in tab keeps full editing).
  readonly?: boolean
  // ---- 共用時加的（2026-10-06，觀察清單）----
  // server：點表頭只回報給父層去打後端（篩選器）；client：el-table 自己排已經在手上的列（觀察清單）
  sortMode?: 'server' | 'client'
  // true：撐滿父層高度、表頭固定（篩選器的資料夾面板）；false：跟著內容長高（一般頁面）
  fillHeight?: boolean
  // 無限捲動的哨兵列與「已顯示全部」那一句
  paginated?: boolean
  // 不傳就跟篩選器的「顯示期間」開關走；傳了就固定
  showPeriod?: boolean
  // 每格下面要不要印資料日期（篩選器跟著 showPeriod；觀察清單只要表頭的期間、不要每格日期）
  cellDates?: boolean
  nameWidth?: number
  actionsLabel?: string
  // 欄位順序以父層為準（父層主動換順序時表格跟著換）。見下面 orderedColumns 的 watcher 為什麼篩選器不開。
  followColumnOrder?: boolean
  // ---- 2026-10-07 篩選器重新設計（mobile first、a11y）----
  // 窄的時候改成一檔一張卡片（表格在手機上只看得到一個指標欄）。觀察清單有自己的卡片，傳 false。
  cards?: boolean
  // 表格上方的「排序」選單與「欄位設定」。欄位設定是拖曳表頭換欄的鍵盤替代（WCAG 2.5.7），各寬度都在。排序選單只在
  // 卡片模式出現（cards 且容器 <720px）：卡片沒有表頭；表格模式的排序箭頭本身就是可聚焦的 button＋aria-sort，再放一個
  // 選單只是重複（2026-10-08 使用者同意拿掉，原本的註解說箭頭不能聚焦是錯的）。
  toolbar?: boolean
}>(), {
  hasMore: false,
  loadingMore: false,
  sortField: null,
  sortOrder: null,
  readonly: false,
  sortMode: 'server',
  fillHeight: true,
  paginated: true,
  showPeriod: undefined,
  cellDates: undefined,
  nameWidth: 110,
  actionsLabel: '操作',
  followColumnOrder: false,
  cards: true,
  toolbar: true
})

// Per direct request 2026-09-11 ("排序第一下按下去時，原則上是從大到小排。例外：代號，還有股價是
// 分子的指標 PER/PBR/PEG 等等") — first-click sort direction. 代號 needs no override at all: it's
// a plain, non-dynamic `<el-table-column>` (see prop="symbol" below) that never gets this
// function's `sort-orders` binding, so it just keeps Element Plus's own default
// (['ascending','descending',null]) — smallest ticker first. Every dynamic metric column instead
// defaults to descending-first (largest value first, e.g. ROE/殖利率/營收成長率), EXCEPT
// valuation multiples where the stock's own price/market value is the numerator — for those,
// a LOWER number is what a value-oriented reader is actually looking for, so ascending-first
// (cheapest first) matches user intent better than "biggest PER first." earningsYield is
// deliberately NOT here even though it's a valuation multiple — it's the inverse (Earnings ÷
// Price, not Price ÷ Earnings), so a higher number is still "better/cheaper" there, same as
// every other descending-first metric.
const ASCENDING_FIRST_METRICS = new Set(['peRatio', 'pbRatio', 'pegRatio', 'psr', 'evEbitda'])

function sortOrdersFor(field: string): ('ascending' | 'descending' | null)[] {
  const metricKey = field.split('.')[0]
  return metricKey && ASCENDING_FIRST_METRICS.has(metricKey)
    ? ['ascending', 'descending', null]
    : ['descending', 'ascending', null]
}

// Only percent ('%') gets special formatting right now (the actual request) — every other unit
// ('currency', 'times', 'ratio', 'days', 'score', or an unrecognized future value) just
// falls through to the bare value, unchanged.
function unitFor(field: string): string | undefined {
  return locateFieldInSchema(props.categories, field)?.field.unit
}

// Real bug fixed 2026-09-11 (reported live: "上市櫃篩選 的 市值請保留有效數字4位元就好 不然數字
// 太多會跑版") — 市值 (marketCap) came back as a raw, un-formatted integer (e.g.
// "62108026310465"), blowing out the column width same as this app's own guru-badge chips did
// before formatSignificantDigits was written for them (see that shared util's own history).
// Reuses the same utility rather than a second one-off rounding scheme. Scoped to values whose
// magnitude actually risks this (≥1,000,000) rather than every numeric column — a per-share
// price or ratio like "23.10" should keep showing exactly what the backend returned, not get its
// trailing zero silently trimmed by toPrecision for no benefit (nothing that size ever overflows
// this column to begin with).
function formatValue(column: ScreenerResultTableColumn, raw: string | null | undefined): string {
  // 上面三段理由（市值有效數字、千分位、尾零保留）的實作在 app/utils/screener-value.ts，觀察清單共用
  return formatScreenerValue(raw, unitFor(column.field), column.field)
}

const emit = defineEmits<{
  reorder: [fields: string[]]
  removeColumn: [field: string]
  addColumnClick: [triggerEl: HTMLElement]
  rowClick: [symbol: string]
  loadMore: []
  // Only ever emitted for symbol/metric columns — see handleSortChange below. field is null
  // when the user clicks a third time to clear a column's sort.
  sortChange: [field: string | null, order: 'ascending' | 'descending' | null]
}>()

// Local display order, drag-reorderable independently of whatever order the parent's
// `columns` prop happens to be in — synced back up via `reorder` so the parent can
// persist it (this tab's backing column-preset), and kept in sync here when columns are
// added/removed upstream without losing the current drag order for the rest.
// Real bug fixed 2026-09-11 (reported live: "陌生訪客現在的表頭會變成代碼而非中文") — this used to
// keep the OLD orderedColumns entry object for any field still present in the new `next`, only
// ever reading `next` to decide WHICH fields survive, never to refresh what they're now labeled.
// Invisible for a signed-in tab (its own tab.columns starts genuinely empty, so the very first
// populated value already has correct labels — nothing stale to preserve). The guest tab
// (useScreenerTabs.ts's buildGuestTab) pre-seeds a placeholder columns array — {field, label:
// field} — before its first real search resolves, so this component mounts with real fields but
// raw-code labels; once the real search replaced tab.columns with properly-labelled entries for
// the SAME fields, this watcher kept the stale placeholder objects instead of adopting the fresh
// ones. Still preserves drag ORDER (position in the old array), just takes each field's actual
// current object from `next` rather than whatever it used to be.
//
// That alone wasn't the whole fix, though — confirmed live via a temporary debug log that
// orderedColumns.value itself DID hold the correct refreshed label right after this watcher ran,
// but the actual rendered <th> text still showed the stale one. Root cause: el-table registers
// each <el-table-column>'s header content into its own internal column store keyed off the
// column's Vue vnode key; a v-for entry whose :key stays the same (this was plain
// `column.field`, unaffected by a label-only change) gets patched in place rather than
// re-created, and el-table's own header re-render doesn't pick up new slot content through that
// patch path. Fixed at the template below by keying each <el-table-column> off field+label
// together, not field alone — see its own comment.
const orderedColumns = ref<ScreenerResultTableColumn[]>([...props.columns])

watch(
  () => props.columns,
  next => {
    const nextByField = new Map(next.map(column => [column.field, column]))
    // followColumnOrder（觀察清單）：父層的順序就是答案，父層主動換順序（「重設預設欄位」）時表格要跟著換。
    // 篩選器不能這樣做：每次搜尋都用伺服器回傳的欄位重設 tab.columns，順序可能跟使用者拖過的不同——2026-10-06
    // 試過一律跟父層，結果每次搜尋都重掛表格，股價的前端排序被清掉、無限捲動也斷了（check-screener-operations
    // 兩項失敗）。所以篩選器維持原本的做法：保留自己的拖曳順序，只把新欄位接在最後。
    const ordered = props.followColumnOrder
      ? [...next]
      : [
          ...orderedColumns.value.filter(column => nextByField.has(column.field)).map(column => nextByField.get(column.field)!),
          ...next.filter(column => !orderedColumns.value.some(existing => existing.field === column.field))
        ]
    // 相對順序真的變了才重掛：el-table 的內部欄位表不會跟著 keyed v-for 換順序（見下面 tableKey 的註解）。
    // 拖曳放開時那邊已經自己重掛過，父層回傳的順序跟現在一樣，不會再掛一次。
    const before = orderedColumns.value.map(column => column.field).filter(field => nextByField.has(field))
    const after = ordered.map(column => column.field).filter(field => before.includes(field))
    orderedColumns.value = ordered
    if (before.join('|') !== after.join('|')) tableKey.value++
  }
)

// Symbol and every metric field are real backend sorts now (bff-ts, confirmed live
// 2026-09-01) — el-table just needs to tell the parent what was clicked, not reorder
// anything itself, so every such column stays sortable="custom" (see the template). "name"
// is the one exception: company name isn't part of analysis-ts's queryable screener data
// (bff-ts stitches it in per-request from a separate endpoint), so a full-result-set sort
// by name isn't something the backend can do without fetching every matching row first —
// scoped out for now. Its column is plain `sortable` instead, which el-table already
// handles entirely on its own (a real, working client-side sort of whatever page is
// currently loaded) — nothing for this handler to do for that column at all.
// **但不是每一個動態欄位都是指標欄位。** `stock.price`（股價）是指標型錄之外的特例
//（useScreenerColumnPresets.ts 的註解已經這樣記錄它），而 bff-ts 是跑完 screener 查詢之後才打
// getLatestClosePrices 把股價併進每一列的——所以它的 sortField 驗證看不到這個欄位。實測
// 2026-10-02：送 `sortField: "stock.price"` 回 400，訊息是
//「"sortField" must be "symbol" or one of this request's own columns — "stock.price" isn't in
// "columns"」，**即使它確實在我們送出的 columns 裡**。對使用者的症狀是：點「股價」表頭，整張表
// 變空，沒有任何說明。直打 bff-ts 逐欄驗過，只有 stock.price 會 400，其他欄位都 200。
//
// 處理方式跟「名稱」那一欄完全一樣（見下面它自己的註解）：改成普通 sortable，由 el-table 自己做
// 目前這一頁的 client 端排序。那是一個已經被接受過的折衷——排的只有已載入的那些列——而不是一個
// 按下去就把結果清空的控制項。
//
// ponytail: 用前綴判斷而不是查型錄。`stock.` 目前只有 price 一個成員，而這個元件手上沒有型錄可
// 以查；哪天多一個型錄外的欄位、或者 bff-ts 讓股價可以排序，改這一行就好。
const BACKEND_UNSORTABLE = /^stock\./

// **普通 `sortable` 單獨用是不夠的，必須配 `sort-method`。** el-table 預設拿 `prop` 當物件的鍵去
// 讀值，而這些動態欄位的值不在 row 的頂層、在 `row.values[field].value`——所以
// `prop="stock.price"` 讀到的是 undefined，排出來的順序是亂的（實測：表頭標著 descending，
// 股價卻是 66.8 / 47.1 / 68 / 168.5）。「名稱」那一欄不需要這個，因為 `row.name` 真的在頂層。
//
// 那個亂序比原本的空表格更糟：空表格至少看得出不對，亂序看起來像排好了。我第一版只改了 sortable
// 就以為修好了，是量了單調性才發現。
//
// `sort-method` 而不是 `sort-by`：後者的型別是回傳 **string**，拿它排數字就是字典序
//（"168.5" 會排在 "25.5" 前面）。sort-method 收兩列回一個數，才是數值比較。
//
// 讀不出數字的列一律沉到最底（-Infinity）：NaN 參與比較會讓順序變成未定義的，而「沒有股價」是
// 真的會發生的（興櫃、暫停交易、ingest 落後）。
function sortMethodFor(field: string) {
  // client 模式：每一欄都由 el-table 自己排。數字比數字；讀不出數字的（例如日期字串）照字串比；
  // 沒有值的一律沉底。
  if (props.sortMode === 'client') {
    return (a: ScreenerResultRow, b: ScreenerResultRow) => {
      const x = a.values[field]?.value ?? null
      const y = b.values[field]?.value ?? null
      if (x === null || y === null) return x === y ? 0 : x === null ? -1 : 1
      return compareFieldValues(x, y)
    }
  }
  if (!BACKEND_UNSORTABLE.test(field)) return undefined
  const numberOf = (row: ScreenerResultRow) => {
    const value = Number(row.values[field]?.value)
    return Number.isFinite(value) ? value : -Infinity
  }
  return (a: ScreenerResultRow, b: ScreenerResultRow) => numberOf(a) - numberOf(b)
}

// el-table's own Sort type wants a non-null `order`, while this component models「no sort」as
// null — so the undefined-vs-null distinction is made here once instead of inline in the template,
// where the union leaked into the prop.
const defaultSort = computed(() =>
  props.sortField && props.sortOrder ? { prop: props.sortField, order: props.sortOrder } : undefined
)

function handleSortChange({ prop, order }: { prop: string | null; order: 'ascending' | 'descending' | null }) {
  activeSort.value = { field: order ? prop : null, order }
  if (programmaticSort) return
  if (props.sortMode === 'client') return
  if (prop === 'name' || (prop && BACKEND_UNSORTABLE.test(prop))) return
  // el-table's third click (clearing a column's sort) still reports that column as `prop`
  // even though `order` comes back null — null out field too so "cleared" is a clean,
  // single null/null state throughout (changeSort, the tab, and default-sort below all key
  // off field+order agreeing on that).
  emit('sortChange', order ? prop : null, order)
}

const tableRef = ref<TableInstance>()

// 每一欄的 sortable 值：client 模式全部交給 el-table（配 sortMethodFor）；server 模式
// 照篩選器原本的規則（型錄外的 stock.* 例外，見 BACKEND_UNSORTABLE）。
function sortableFor(field: string): boolean | 'custom' {
  if (props.sortMode === 'client' || BACKEND_UNSORTABLE.test(field)) return true
  return 'custom'
}

// 表頭不折行（2026-10-06「我不希望看到有欄位的文字 UI 換行」）：最小寬度跟著標題字數走——每字 16px，
// 加上排序箭頭、移除鈕與左右內距約 72px。內容比表頭長的欄位自己帶 minWidth。
function minWidthFor(column: ScreenerResultTableColumn): number {
  return column.minWidth ?? Math.max(120, displayLabel(column).length * 16 + 72)
}
// el-table 的表身從內部欄位表讀欄位順序，keyed v-for 重排不會重新登記——表頭跟著拖、表身不跟；所以重排後要靠 tableKey 整表重掛。
const tableKey = ref(0)

// 表頭拖曳換順序在 useElTableColumnDrag（Pragmatic DnD、插入縫發亮、放手才換）；放手後整表重掛（tableKey）並把新順序交給父層
const { headerClassFor } = useElTableColumnDrag({
  table: tableRef,
  columns: orderedColumns,
  readonly: () => props.readonly,
  headerClass: 'screener-result-table__draggable-header',
  onReorder: updated => {
    orderedColumns.value = updated
    tableKey.value++
    emit('reorder', updated.map(column => column.field))
  }
})

// el-table's own height="100%" (see the template below) resolves against its flex-fill
// ancestor chain (PresetFolder.vue's fillHeight body -> ScreenerResultBody.vue's
// .screener-result-body -> this component's own .screener-result-table-wrap). Element Plus
// attaches its own window-resize listener to recompute layout when the height prop demands
// it, but that alone doesn't cover this table's own box changing size for a reason OTHER
// than the window itself resizing — e.g. the filter-condition area above it (in the same
// flex column) growing/shrinking as conditions are added/removed, which shrinks or grows
// how much height is actually left for this table without any window resize event firing
// at all. A ResizeObserver on el-table's own root re-runs doLayout() (already used
// elsewhere in this file for a different el-table layout-timing quirk, the column-width
// "flying right" one) whenever its real resolved box size changes, independent of what
// caused that change.
let resizeObserver: ResizeObserver | null = null

function attachResizeObserver() {
  resizeObserver?.disconnect()
  const rootEl = tableRef.value?.$el as HTMLElement | undefined
  if (!rootEl) return
  resizeObserver = new ResizeObserver(() => tableRef.value?.doLayout())
  resizeObserver.observe(rootEl)
}

onMounted(() => nextTick(attachResizeObserver))
onUnmounted(() => resizeObserver?.disconnect())

// Infinite scroll: a sentinel row in el-table's own #append slot (rendered inside its
// internal scrollable body, after the last data row — not outside the table) that emits
// loadMore once it scrolls into view. `root` is explicitly el-table's own internal scroll
// element rather than left as the default viewport.
//
// Confirmed live (DOM dump) that the ACTUAL native-overflow element is nested two levels
// deeper than ".el-table__body-wrapper" itself: el-table wraps its body in its own
// <ElScrollbar> component, and body-wrapper is just `overflow: hidden` — the real
const sentinelRef = ref<HTMLElement>()

// 重掛條件有兩個：`tableKey` 變動代表整個表格 remount（欄位重排時，理由見上面 tableKey 的註解），`hasMore` 翻轉會把哨兵換成「沒有更多結果」那句靜態文字——是另一個元素。
// observer 的 root 為什麼必須是 `.el-scrollbar__wrap` 而不是 body-wrapper，見 useElTableLoadMore
// 的註解——那是踩過的坑，而且跟 useElTableColumnDrag 用 header-wrapper 才對這件事剛好相反。
useElTableLoadMore({
  table: tableRef,
  sentinel: sentinelRef,
  loadMore: () => emit('loadMore'),
  reattachOn: [tableKey, () => props.hasMore]
})

// "table欄位寬度在tab切分時會左右跳動...都是欄位往右邊飛 再左彈歸位" — el-table doesn't always
// re-run its own internal column-width calculation promptly after `data`/columns change (its
// automatic recalculation appears to be debounced/delayed rather than synchronous), so there
// was a real frame where columns briefly rendered at their un-constrained natural width
// (wider, reading as "flying right") before el-table's own later recalculation snapped them
// back to the actual table width. doLayout() is el-table's own public method for forcing
// that recalculation immediately — calling it explicitly after data/columns settle (post
// nextTick, so the DOM already reflects the new content) skips waiting on whatever internal
// schedule it would otherwise run on.
watch([orderedColumns, () => props.rows], () => nextTick(() => tableRef.value?.doLayout()))

// column.label already carries its period baked in as "名稱（期間）" (see formatFieldLabel
// in useFilterSchema.ts, the one place that ever assembles this) — a global toggle rather
// than fetching/storing period separately, since that exact suffix format is the only thing
// that needs stripping, not a real second data field. The switch itself lives in screener.vue,
// outside any column-preset tab — see useScreenerShowPeriod.ts for why.
const screenerShowPeriod = useScreenerShowPeriod()
const showPeriod = computed(() => props.showPeriod ?? screenerShowPeriod.value)
const showCellDates = computed(() => props.cellDates ?? showPeriod.value)

function displayLabel(column: ScreenerResultTableColumn) {
  return showPeriod.value ? column.label : column.label.replace(/（[^（）]*）$/, '')
}

// ---- 排序選單（2026-10-07 篩選器 mobile first／a11y）----
// 跟表頭點擊共用同一個狀態：點表頭時 handleSortChange 會更新它，選單改變時用 tableRef.sort() 讓表頭箭頭跟著動。
// 程式觸發的 sort 也會讓 el-table 送出 sort-change，用 programmaticSort 擋掉那一次，改由這裡自己 emit 一次。
const activeSort = ref<{ field: string | null; order: 'ascending' | 'descending' | null }>({ field: props.sortField, order: props.sortOrder })
watch(() => [props.sortField, props.sortOrder] as const, ([field, order]) => {
  if (props.sortMode === 'server' && (field === null || !isLocalSort(field))) activeSort.value = { field, order }
})
let programmaticSort = false

// 只排已載入的列（名稱、型錄外的 stock.*、觀察清單的 client 模式）；其他欄位由後端排整個結果集
function isLocalSort(field: string): boolean {
  return props.sortMode === 'client' || field === 'name' || BACKEND_UNSORTABLE.test(field)
}

const sortFieldOptions = computed(() => [
  { value: 'symbol', label: '代號' },
  { value: 'name', label: '名稱' },
  ...orderedColumns.value.map(column => ({ value: column.field, label: displayLabel(column) }))
])

function applySort(field: string | null, order: 'ascending' | 'descending' | null) {
  activeSort.value = { field: order ? field : null, order: field ? order : null }
  programmaticSort = true
  if (field && order) tableRef.value?.sort(field, order)
  else tableRef.value?.clearSort()
  programmaticSort = false
  if (props.sortMode === 'server' && (!field || !isLocalSort(field))) emit('sortChange', field && order ? field : null, field ? order : null)
}

function onSortFieldChange(value: string) {
  if (!value) return applySort(null, null)
  // 第一次選一個欄位用它自己的「第一下」方向（估值倍數小到大，其他大到小），同 sortOrdersFor
  applySort(value, value === 'symbol' || value === 'name' ? 'ascending' : sortOrdersFor(value)[0]!)
}

// 卡片的順序：後端排的欄位照收到的順序；本地排的照 activeSort 自己排
const cardRows = computed(() => {
  const { field, order } = activeSort.value
  if (!field || !order || !isLocalSort(field)) return props.rows
  const compare = field === 'name'
    ? (a: ScreenerResultRow, b: ScreenerResultRow) => (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hant')
    : field === 'symbol'
      ? (a: ScreenerResultRow, b: ScreenerResultRow) => a.symbol.localeCompare(b.symbol)
      : sortMethodFor(field)
  if (!compare) return props.rows
  const sorted = [...props.rows].sort(compare)
  return order === 'descending' ? sorted.reverse() : sorted
})

// ---- 欄位設定：拖曳表頭與表頭小 × 的替代（WCAG 2.1.1／2.5.7）。不是對話框，就地展開 ----
const columnSettingsOpen = ref(false)
const columnSettingsId = useId()
const settingsStatus = ref('')

function moveColumn(index: number, offset: -1 | 1) {
  const target = index + offset
  if (target < 0 || target >= orderedColumns.value.length) return
  const next = [...orderedColumns.value]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  orderedColumns.value = next
  tableKey.value++
  emit('reorder', next.map(column => column.field))
  settingsStatus.value = `${displayLabel(next[target]!)} 移到第 ${target + 1} 欄`
  nextTick(() => document.getElementById(`${columnSettingsId}-${offset < 0 ? 'up' : 'down'}-${next[target]!.field}`)?.focus())
}

function removeColumnFromSettings(column: ScreenerResultTableColumn) {
  settingsStatus.value = `已移除 ${displayLabel(column)} 欄`
  emit('removeColumn', column.field)
}

// ---- 卡片的無限捲動：哨兵進到畫面就載下一批。root 用 viewport——卡片在固定高度的框裡捲動時，
// IntersectionObserver 也會算上祖先的裁切，所以兩種情況（整頁捲、框內捲）都適用。
// 載完一批哨兵還在畫面裡時不會再觸發，所以列數變了就重新觀察一次。
const cardSentinelRef = ref<HTMLElement>()
let cardObserver: IntersectionObserver | null = null
watch(cardSentinelRef, (element) => {
  cardObserver?.disconnect()
  cardObserver = null
  if (!element) return
  cardObserver = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting) && props.hasMore && !props.loadingMore) emit('loadMore')
  }, { rootMargin: '200px 0px' })
  cardObserver.observe(element)
})
watch(() => props.rows.length, () => {
  const element = cardSentinelRef.value
  if (cardObserver && element) {
    cardObserver.unobserve(element)
    cardObserver.observe(element)
  }
})
onUnmounted(() => cardObserver?.disconnect())
</script>

<template>
  <!-- Single root (rather than el-table/el-pagination as two siblings) so the class the
       parent passes in (screener-result-body__table) still falls through automatically —
       Vue only does that for a single-root component. -->
  <div class="screener-result-table-wrap" :class="{ 'screener-result-table-wrap--fill': fillHeight, 'screener-result-table-wrap--cards': cards }">
    <div v-if="toolbar" class="smt-toolbar">
      <label v-if="cards" class="smt-toolbar__field smt-toolbar__sort">
        <span>排序</span>
        <select class="smt-toolbar__select" :value="activeSort.field ?? ''" @change="onSortFieldChange(($event.target as HTMLSelectElement).value)">
          <option value="">預設順序</option>
          <option v-for="option in sortFieldOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <label v-if="cards && activeSort.field" class="smt-toolbar__field smt-toolbar__sort">
        <span>方向</span>
        <select class="smt-toolbar__select" :value="activeSort.order ?? 'descending'" @change="applySort(activeSort.field, ($event.target as HTMLSelectElement).value as 'ascending' | 'descending')">
          <option value="descending">大到小</option>
          <option value="ascending">小到大</option>
        </select>
      </label>
      <button
        v-if="!readonly"
        type="button"
        class="smt-toolbar__button"
        :aria-expanded="columnSettingsOpen"
        :aria-controls="columnSettingsId"
        @click="columnSettingsOpen = !columnSettingsOpen"
      >
        欄位設定
      </button>
    </div>
    <div v-if="toolbar && !readonly && columnSettingsOpen" :id="columnSettingsId" class="smt-settings">
      <ol class="smt-settings__list">
        <li v-for="(column, index) in orderedColumns" :key="column.field" class="smt-settings__row">
          <span class="smt-settings__label">{{ displayLabel(column) }}</span>
          <span class="smt-settings__actions">
            <button :id="`${columnSettingsId}-up-${column.field}`" type="button" class="smt-toolbar__button" :disabled="index === 0" @click="moveColumn(index, -1)">上移<span class="visually-hidden">：{{ displayLabel(column) }}</span></button>
            <button :id="`${columnSettingsId}-down-${column.field}`" type="button" class="smt-toolbar__button" :disabled="index === orderedColumns.length - 1" @click="moveColumn(index, 1)">下移<span class="visually-hidden">：{{ displayLabel(column) }}</span></button>
            <button type="button" class="smt-toolbar__button" @click="removeColumnFromSettings(column)">移除<span class="visually-hidden">：{{ displayLabel(column) }}</span></button>
          </span>
        </li>
      </ol>
      <button type="button" class="smt-toolbar__button smt-settings__add" @click="emit('addColumnClick', $event.currentTarget as HTMLElement)">＋ 新增欄位</button>
      <p class="visually-hidden" role="status">{{ settingsStatus }}</p>
    </div>

    <!-- 窄的時候是卡片（cards），寬的時候是表格；兩份都在 DOM 裡、由 CSS container query 切換（專案規則：不在
         渲染時用寬度選標記）。卡片沿用同一組 #name／#cell／#actions slot。 -->
    <div class="smt-table-view">
    <el-table
      :key="tableKey"
      ref="tableRef"
      class="screener-result-table"
      :data="rows"
      row-key="symbol"
      stripe
      :height="fillHeight ? '100%' : undefined"
      :default-sort="defaultSort"
      @sort-change="handleSortChange"
      @row-click="row => emit('rowClick', row.symbol)"
    >
      <!-- Real backend sort (see handleSortChange) — sortable="custom" so el-table only
           reports the click instead of trying to reorder `rows` itself, which is already in
           whatever order the server returned it in. -->
      <el-table-column prop="symbol" label="代號" width="90" fixed :sortable="sortMode === 'client' ? true : 'custom'" />
      <!-- Plain sortable: not backend-sortable (see handleSortChange's comment), so this is
           a genuine, working client-side sort of whichever page is currently loaded —
           el-table handles it entirely on its own, no comparator needed here. -->
      <!-- @row-click below navigates on mouse click for a large, convenient hit target, but
           el-table rows are plain <tr>s with no native keyboard/AT semantics — this link is
           what actually makes "open a stock from this table" reachable without a mouse
           (same /stock/{code} path the parent's own row-click handler already navigates to,
           see screener.vue). -->
      <el-table-column prop="name" label="名稱" :width="nameWidth" fixed sortable>
        <template #default="{ row }">
          <!-- 共用時加的 #name：觀察清單要放 ETF／特別股標籤與備註、連結也依種類不同 -->
          <slot name="name" :row="row">
            <NuxtLink :to="`/stock/${row.symbol}`" class="screener-result-table__name-link" @click.stop>{{ row.name }}</NuxtLink>
          </slot>
        </template>
      </el-table-column>
      <!-- Real bug fixed 2026-09-11 (reported live: "點選市值排序無反應") — this column never
           declared its own `prop`, so el-table's @sort-change fired with `prop: undefined`
           regardless of which metric column was actually clicked (and `:default-sort` above,
           which matches by `prop`, could never highlight any of these columns as the active
           sort either). Not specific to 市值 — every dynamic metric column shared this same gap,
           it just happened to be the one someone clicked and noticed. -->
      <!-- field+label composite key, not field alone — see orderedColumns' own comment above. A
           label-only change (same field) needs to actually re-create this column's vnode, not
           just patch it in place, for el-table's own internal header rendering to pick up the
           new text. -->
      <el-table-column
        v-for="(column, index) in orderedColumns"
        :key="`${column.field}::${column.label}`"
        :prop="column.field"
        align="right"
        :min-width="minWidthFor(column)"
        :sortable="sortableFor(column.field)"
        :sort-method="sortMethodFor(column.field)"
        :sort-orders="sortOrdersFor(column.field)"
        :label-class-name="headerClassFor(column, index)"
      >
        <template #header>
          <!-- Two separate flex children (not one wrapping span) so el-table's own sort
               caret — which it appends as a sibling AFTER whatever this slot renders, not
               inside it — can be visually reordered via CSS order (see
               .screener-result-table__draggable-header .cell below). Sort caret leads, then
               the label text, then remove last. -->
          <span class="screener-result-table__column-label">{{ displayLabel(column) }}</span>
          <!-- 真正的按鈕，不是 role="button" 的圖示：Enter／Space、焦點環、觸控尺寸都是免費的（2026-10-08） -->
          <el-button
            v-if="!readonly"
            class="screener-result-table__column-remove"
            :icon="Close"
            circle
            text
            :title="`移除${displayLabel(column)}欄位`"
            :aria-label="`移除${displayLabel(column)}欄位`"
            @click.stop="emit('removeColumn', column.field)"
          />
        </template>
        <template #default="{ row }">
          <!-- 共用時加的 #cell：觀察清單的「漲跌」「下次除權息」是自己算的欄位，要自己畫 -->
          <slot name="cell" :row="row" :column="column" :text="formatValue(column, row.values[column.field]?.value)">
          <div class="screener-result-table__cell">
            <span>{{ formatValue(column, row.values[column.field]?.value) }}</span>
            <!-- The actual per-row knowledgeDate this specific number describes (renamed from
                 asOfDate 2026-09-14) — different symbols can legitimately show different dates
                 for the same field (e.g. one hasn't filed this quarter's report yet), so this
                 can't be hoisted up to the column header the way the period-type suffix above is. -->
            <span v-if="showCellDates && row.values[column.field]?.knowledgeDate" class="screener-result-table__cell-date">
              {{ row.values[column.field]!.knowledgeDate }}
            </span>
          </div>
          </slot>
        </template>
      </el-table-column>
      <el-table-column v-if="!readonly" width="48" align="center">
        <template #header>
          <el-button :icon="Plus" circle text size="small" title="新增欄位" aria-label="新增欄位" @click.stop="emit('addColumnClick', $event.currentTarget as HTMLElement)" />
        </template>
      </el-table-column>
      <!-- 共用時加的 #actions：觀察清單每列的備註／移除（或調整順序時的上移／下移） -->
      <el-table-column v-if="$slots.actions" :label="actionsLabel" min-width="120" fixed="right">
        <template #default="{ row }">
          <slot name="actions" :row="row" />
        </template>
      </el-table-column>

      <!-- Renders INSIDE el-table's own scrollable body, after the last data row — not a
           sibling outside the table — so useElTableLoadMore's observer can watch it
           scrolling into view within that same internal scroll container. Only shown once
           there are any results at all (an empty table has nothing to paginate through). -->
      <template v-if="paginated && rows.length > 0" #append>
        <div v-if="hasMore" ref="sentinelRef" class="screener-result-table__load-more" role="status">
          <el-icon v-if="loadingMore" class="screener-result-table__load-more-spinner"><Loading /></el-icon>
          <span>{{ loadingMore ? '載入更多…' : '' }}</span>
        </div>
        <p v-else class="screener-result-table__load-more screener-result-table__load-more--end">
          已顯示全部符合條件的股票
        </p>
      </template>
    </el-table>
    </div>

    <div v-if="cards" class="smt-cards-view">
      <p v-if="!rows.length" class="smt-cards__empty">目前沒有資料</p>
      <ul v-else class="smt-cards" :aria-label="`共 ${rows.length} 檔已載入`">
        <li v-for="row in cardRows" :key="row.symbol" class="smt-card">
          <div class="smt-card__head">
            <slot name="name" :row="row">
              <NuxtLink :to="`/stock/${row.symbol}`" class="screener-result-table__name-link">{{ row.name }}</NuxtLink>
            </slot>
            <span class="smt-card__code">{{ row.symbol }}</span>
          </div>
          <dl v-if="orderedColumns.length" class="smt-card__values">
            <div v-for="column in orderedColumns" :key="column.field" class="smt-card__value">
              <dt>{{ displayLabel(column) }}</dt>
              <dd>
                <slot name="cell" :row="row" :column="column" :text="formatValue(column, row.values[column.field]?.value)">
                  {{ formatValue(column, row.values[column.field]?.value) }}
                  <span v-if="showCellDates && row.values[column.field]?.knowledgeDate" class="screener-result-table__cell-date">{{ row.values[column.field]!.knowledgeDate }}</span>
                </slot>
              </dd>
            </div>
          </dl>
          <div v-if="$slots.actions" class="smt-card__actions"><slot name="actions" :row="row" /></div>
        </li>
      </ul>
      <template v-if="paginated && rows.length > 0">
        <div v-if="hasMore" ref="cardSentinelRef" class="screener-result-table__load-more">
          <el-icon v-if="loadingMore" class="screener-result-table__load-more-spinner"><Loading /></el-icon>
          <span>{{ loadingMore ? '載入更多…' : '' }}</span>
        </div>
        <p v-else class="screener-result-table__load-more screener-result-table__load-more--end">已顯示全部符合條件的股票</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ---- 2026-10-07 mobile first：基本是卡片，結果區塊寬 ≥ 720px 才是表格 ---- */
.screener-result-table-wrap {
  container-type: inline-size;
}

.screener-result-table-wrap--cards .smt-table-view {
  display: none;
}

.smt-table-view {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.screener-result-table-wrap--fill .smt-table-view {
  flex: 1;
  min-height: 0;
}

/* 卡片框只在頁面固定高度時（≥768px，見 screener/index.vue 的 --has-tab）自己捲；手機整頁自然捲動，
   卡片框若也設成捲動框，高度會比內容少一截、把「載入更多」的哨兵裁掉（2026-10-07 實測：捲到底停在 20 檔）。 */
@media (min-width: 768px) {
  .screener-result-table-wrap--fill .smt-cards-view {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}

@container (min-width: 720px) {
  .screener-result-table-wrap--cards .smt-table-view {
    display: flex;
  }

  .smt-cards-view,
  /* 兩個 class：同特異性時排在後面的 .smt-toolbar__field { display: flex } 會贏 */
  .smt-toolbar .smt-toolbar__sort {
    display: none;
  }
}

.smt-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 12px;
  margin-bottom: 12px;
}

.smt-toolbar__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--el-text-color-regular);
}

.smt-toolbar__select,
.smt-toolbar__button {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font: inherit;
}

.smt-toolbar__button {
  cursor: pointer;
}

.smt-toolbar__button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.smt-settings {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--el-card-border-radius, 4px);
  background: var(--el-bg-color);
}

.smt-settings__list {
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}

.smt-settings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.smt-settings__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.smt-cards {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.smt-card {
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--el-card-border-radius, 4px);
  background: var(--el-bg-color);
}

.smt-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  margin-bottom: 8px;
  font-size: 1.125rem;
  font-weight: 600;
}

.smt-card__code {
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.smt-card__values {
  display: grid;
  /* 手機一列兩個數值（約 300px 寬的卡片），卡片高度減半 */
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 120px), 1fr));
  gap: 8px 16px;
  margin: 0;
}

.smt-card__value dt {
  color: var(--el-text-color-secondary);
}

.smt-card__value dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.smt-card__actions {
  margin-top: 8px;
}

.smt-cards__empty {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
}

/* Only call site is inside ScreenerResultBody.vue's .screener-result-body (itself only ever
   inside PresetFolder.vue's fillHeight body) — flex:1/min-height:0 takes whatever height
   that chain hands down, and height:100% gives <el-table height="100%"> something concrete
   to resolve its own percentage height against, which is what actually turns on its native
   sticky-header/internal-scroll mode. */
.screener-result-table-wrap--fill {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}

/* 不折行，見 minWidthFor */
.screener-result-table :deep(.cell) {
  white-space: nowrap;
}

.screener-result-table :deep(.el-table__row) {
  cursor: pointer;
}

/* text-decoration: none only by default — per docs/ui-ux/無障礙網站色彩規範.md's G183
   guidance, an underline-free link needs SOME non-color state change to still read as a
   link rather than plain text, since color: inherit means it carries zero color difference
   from the surrounding cell text either. The row itself already affords "clickable" via
   cursor:pointer/hover highlight, so this only needs to confirm it specifically on
   hover/focus, not stand out at rest. */
.screener-result-table__name-link {
  color: inherit;
  text-decoration: none;
  display: block;
  /* 桌機的列裡這個連結只有 23px 高（2026-10-08 check-a11y-pages 量到）：WCAG 2.5.8 的 24px 下限 */
  min-height: 24px;
}

.screener-result-table__name-link:hover,
.screener-result-table__name-link:focus-visible {
  text-decoration: underline;
}

/* Sentinel/end-of-list row rendered via el-table's #append slot — inside the table's own
   scrollable body, so it needs to read as a row-like footer, not a floating block. 16px
   floor per this app's global font-size policy even though it's a secondary/status line. */
.screener-result-table__load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.screener-result-table__load-more--end {
  margin: 0;
}

.screener-result-table__load-more-spinner {
  animation: screener-result-table-spin 1s linear infinite;
}

@keyframes screener-result-table-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.screener-result-table :deep(th.screener-result-table__draggable-header) {
  cursor: grab;
}

/* 拖曳中的來源欄變淡——它的位置不會動（見 useElTableColumnDrag），這是唯一表示「正在拖它」的回饋 */
.screener-result-table :deep(th.screener-result-table__draggable-header.is-dragging) {
  opacity: 0.5;
}

/* The actual "where would this land" indicator — inset box-shadow rather than a real border
   so it doesn't add to the cell's box size and shift anything else in the row. Book-on-a-
   shelf model ("該位置左邊div的右邊border發亮且該位置右邊div的左邊border發亮"): the gap the
   drag would insert into lights up from both sides, not the whole hovered column — a column
   right before the gap gets its own right edge lit (is-insert-after), the one right after
   gets its left edge lit (is-insert-before). Only one side lights up at either end of the
   row, where there's no neighbor on that side to pair with. */
.screener-result-table :deep(th.screener-result-table__draggable-header.is-insert-before) {
  box-shadow: inset 2px 0 0 0 var(--el-color-primary);
}

.screener-result-table :deep(th.screener-result-table__draggable-header.is-insert-after) {
  box-shadow: inset -2px 0 0 0 var(--el-color-primary);
}

/* Flex row across the label, el-table's own sort caret, and the remove icon — see the
   template comment on #header for why the caret (rendered by el-table itself, not this
   component) needs an explicit `order` to land in front of the label rather than trailing
   after everything else. */
.screener-result-table :deep(th.screener-result-table__draggable-header .cell) {
  display: flex;
  align-items: center;
  /* The column itself is align="right" (matches the right-aligned number cells below), but
     that only sets text-align on .cell — flex children ignore text-align entirely, so
     without this the header content stayed packed to the left regardless, visibly
     misaligned against its own column's data. */
  justify-content: flex-end;
  gap: 4px;
}

.screener-result-table :deep(th.screener-result-table__draggable-header .caret-wrapper) {
  order: 0;
}

.screener-result-table__column-label {
  order: 1;
}

.screener-result-table__column-remove {
  order: 2;
  color: var(--el-text-color-secondary);
}

.screener-result-table__column-remove:hover {
  color: var(--el-color-danger);
}

.screener-result-table__cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.3;
}

.screener-result-table__cell-date {
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}

</style>
