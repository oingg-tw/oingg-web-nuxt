<script setup lang="ts">
import { Loading, Plus } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import type { ScreenerResultRow } from '~/composables/screener/useFilterSearch'
import type { MetricCategory } from '~/composables/screener/useFilterSchema'
import type { ColumnDraft } from './SharedColumnSettings.vue'
import type { ColumnMenuAction } from './SharedColumnMenu.vue'
// 篩選器結果表（普通股、特別股、ETF 三組共用）。2026-10-06 搬到 shared 讓觀察清單共用，觀察清單後來改用 SharedSheetGrid，
// 當時為它加的 prop 與 slot 2026-10-23 拿掉。
export interface ScreenerResultTableColumn {
  field: string
  label: string
  // ---- 2026-10-15 三組篩選（普通股、特別股、ETF）共用這張表 ----
  // 這一欄自己的格式；不給就照型錄的單位（formatScreenerValue）。ETF 的規模、特別股的發行價這類要自己決定
  format?: (raw: string | null | undefined) => string
  // 這一欄怎麼排：'server' 交給父層打後端、'client' 只排已載入的列、false 不能排。不給就照原本的規則（見 sortableFor）
  sortable?: 'server' | 'client' | false
  // 第一下由小到大（溢價率、費用率這類「越小越符合多數人要找的」）；不給就照 ASCENDING_FIRST_METRICS
  ascendingFirst?: boolean
}

const props = withDefaults(defineProps<{
  // Server-side infinite scroll now (業務中台 /screener and /screener/presets/{id}/run both
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
  // changeSort) — el-table's own vocabulary (not 業務中台's asc/desc) since this is purely
  // used to drive el-table's :default-sort, keeping the ascending/descending<->asc/desc
  // translation at the composable boundary instead of inside this component.
  sortField?: string | null
  sortOrder?: 'ascending' | 'descending' | null
  // /filters schema (not the result columns themselves — those don't carry unit) — used
  // purely to look up each displayed field's unit (see formatValue below) so percent metrics
  // can show a % suffix. column.field already matches the schema's own
  // "<metricKey>.<fieldKey>" id format (see locateFieldInSchema).
  categories: MetricCategory[]
  // server：點表頭只回報給父層去打後端（普通股、ETF）；client：el-table 自己排已經在手上的列（特別股）
  sortMode?: 'server' | 'client'
  // 不傳就跟篩選器的「顯示期間」開關走；傳了就固定
  showPeriod?: boolean
  // 每格下面要不要印資料日期（不傳就跟著 showPeriod）
  cellDates?: boolean
  // ---- 2026-10-15 三組篩選共用 ----
  // 代號／名稱連去哪裡：普通股 /stock/{代號}、特別股與 ETF 是各自的個別頁
  rowLink?: (symbol: string) => string
  // 符合條件的總檔數：最後一列寫「已顯示全部 N 檔」
  total?: number
  // 表格跟著整頁捲：表頭黏在頁首下面、橫向捲軸黏在畫面底部（2026-10-15 使用者：「我希望橫向scrollbar可以呈現在第一個畫面…才可以
  // 把卷軸用滑鼠往右邊拉動」）。原本表格限高一個螢幕、自己上下捲，捲軸在表格底部、第一個畫面看不到，滑鼠在表格上滾輪只捲框裡
  sticky?: boolean
  // 查詢中：遮罩只蓋結果（表格或卡片），不蓋工具列裡的控制項
  loading?: boolean
}>(), {
  hasMore: false,
  loadingMore: false,
  sortField: null,
  sortOrder: null,
  sortMode: 'server',
  showPeriod: undefined,
  cellDates: undefined,
  rowLink: (symbol: string) => securityPath(symbol),
  total: undefined,
  sticky: false,
  loading: false
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
// 挑選器只留交易所／即時那一支之後（2026-10-21，ScreenerIndicatorPickerBody 的 PICKER_HIDDEN_METRICS），留下的那幾支也要在這裡
const ASCENDING_FIRST_METRICS = new Set(['peRatio', 'pbRatio', 'pegRatio', 'psr', 'evEbitda', 'exchangePeRatio', 'livePeRatio', 'exchangePbRatio', 'livePbRatio', 'livePegRatio', 'grahamNumber', 'liveGrahamNumber'])

function sortOrdersFor(field: string): ('ascending' | 'descending' | null)[] {
  const metricKey = field.split('.')[0]
  const override = orderedColumns.value.find(column => column.field === field)?.ascendingFirst
  return override ?? (metricKey && ASCENDING_FIRST_METRICS.has(metricKey))
    ? ['ascending', 'descending', null]
    : ['descending', 'ascending', null]
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
  if (column.format) return column.format(raw)
  // 上面三段理由（市值有效數字、千分位、尾零保留）的實作在 app/utils/screener-value.ts，觀察清單共用
  const located = locateFieldInSchema(props.categories, column.field)
  return formatScreenerValue(raw, located?.field.unit, column.field, located?.metric.options)
}

// 河道位置的格子（2026-10-21，使用者：「淨值比河道位置 要上色 破頂 要用紅色 破底要用綠色 比照 河流圖顏色」「剛才說的是篩選的欄位值的
// 部分」）：顏色跟河流圖一樣——破底是最下面那條線（跌色）、破頂是最上面那條線（漲色）、中間五層是河道的填色，跟著使用者的漲跌色慣例。
// 破頂、破底的字再用漲跌色；中間幾層是黃綠、黃，當字色過不了 4.5:1，不上字色。
// 2026-10-22 前面的色塊換成七格位置軌道（使用者：「我的視覺變色能力沒這麼強 設計上有辦法 更顯眼嗎」，方案頁選 2B）：亮在第幾格就是第幾層，
// 越右邊越高——看位置不看顏色也讀得出來，顏色與文字照舊
const { resolvedMode, market } = useAppTheme()
const riverPalette = computed(() => {
  const colors = getPriceColors(resolvedMode.value, market.value)
  return riverColors(colors.up, colors.down, RIVER_ZONE_NAMES.length - 2)
})
function riverZoneOf(column: ScreenerResultTableColumn, raw: string | null | undefined): { zone: number; color: string; textClass: string } | null {
  const metric = locateFieldInSchema(props.categories, column.field)?.metric
  if (raw == null || metric?.kind !== 'categorical' || !metric.key.endsWith('RiverBand')) return null
  const zone = Number(raw)
  const last = RIVER_ZONE_NAMES.length - 1
  if (!Number.isInteger(zone) || zone < 0 || zone > last) return null
  const { lines, fills } = riverPalette.value
  return {
    zone,
    color: zone === 0 ? lines[0]! : zone === last ? lines.at(-1)! : fills[zone - 1]!,
    textClass: zone === 0 ? priceDirectionClass(-1) : zone === last ? priceDirectionClass(1) : ''
  }
}

// 年增率、年減率的格子用漲跌色（2026-10-22，使用者：「篩選 表格 舉凡 年增率 年減率 數字 都用 漲跌色」）：指標名稱以年增率／年減率結尾
// （可以再接「變化」）才算。「營收年增率波動」是標準差、永遠是正的，不是增減，所以不上色
const YOY_NAME = /(年增率|年減率)(變化)?$/
function directionClassOf(column: ScreenerResultTableColumn, raw: string | null | undefined): string {
  const metric = locateFieldInSchema(props.categories, column.field)?.metric
  return metric && YOY_NAME.test(metric.name) ? priceDirectionClass(raw) : ''
}

const emit = defineEmits<{
  reorder: [fields: string[]]
  removeColumn: [field: string]
  addColumnClick: []
  // 欄位設定彈窗按「儲存」（saveFromSettings）：done(false)＝父層不套用這份欄位（例如這一組要刪掉），只關彈窗
  saveColumns: [columns: ColumnDraft[], done: (apply?: boolean) => void]
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
    // 保留自己的拖曳順序，只把新欄位接在最後。不能一律照父層：每次搜尋都用伺服器回傳的欄位重設 tab.columns，順序可能跟使用者
    // 拖過的不同——2026-10-06 試過一律跟父層，結果每次搜尋都重掛表格，股價的前端排序被清掉、無限捲動也斷了
    // （check-screener-operations 兩項失敗）
    const ordered = [
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

// Symbol and every metric field are real backend sorts now (業務中台, confirmed live
// 2026-09-01) — el-table just needs to tell the parent what was clicked, not reorder
// anything itself, so every such column stays sortable="custom" (see the template). "name"
// is the one exception: company name isn't part of analysis-ts's queryable screener data
// (業務中台 stitches it in per-request from a separate endpoint), so a full-result-set sort
// by name isn't something the backend can do without fetching every matching row first —
// scoped out for now. Its column is plain `sortable` instead, which el-table already
// handles entirely on its own (a real, working client-side sort of whatever page is
// currently loaded) — nothing for this handler to do for that column at all.
// **但不是每一個動態欄位都是指標欄位。** `stock.price`（股價）是指標型錄之外的特例
//（useScreenerColumnPresets.ts 的註解已經這樣記錄它），而 業務中台 是跑完 screener 查詢之後才打
// getLatestClosePrices 把股價併進每一列的——所以它的 sortField 驗證看不到這個欄位。實測
// 2026-10-02：送 `sortField: "stock.price"` 回 400，訊息是
//「"sortField" must be "symbol" or one of this request's own columns — "stock.price" isn't in
// "columns"」，**即使它確實在我們送出的 columns 裡**。對使用者的症狀是：點「股價」表頭，整張表
// 變空，沒有任何說明。直打 業務中台 逐欄驗過，只有 stock.price 會 400，其他欄位都 200。
//
// 處理方式跟「名稱」那一欄完全一樣（見下面它自己的註解）：改成普通 sortable，由 el-table 自己做
// 目前這一頁的 client 端排序。那是一個已經被接受過的折衷——排的只有已載入的那些列——而不是一個
// 按下去就把結果清空的控制項。
//
// ponytail: 用前綴判斷而不是查型錄。`stock.` 目前只有 price 一個成員，而這個元件手上沒有型錄可
// 以查；哪天多一個型錄外的欄位、或者 業務中台 讓股價可以排序，改這一行就好。
// `holding.`：已經持有的帳戶名稱；`sector.`：類股名稱（都是 2026-10-22，業務中台 不能排序，sortField 給它們回 400）
const BACKEND_UNSORTABLE = /^(stock|holding|sector)\./

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
// 數字比數字；讀不出數字的（日期、帳戶名稱、類股）照字串比；沒有值的算最小，降冪時在最底（「沒有股價」是真的會發生的：
// 興櫃、暫停交易、ingest 落後）。業務中台 不能排的欄位原本只比數字，文字欄每一列都是 NaN，點表頭順序不動（2026-10-22 改成同一套）
function sortMethodFor(field: string) {
  // client 模式、欄位自己標 'client' 的（特別股全部 28 檔一次讀進來，2026-10-15）、業務中台 不能排的：都由 el-table 排已載入的列
  if (props.sortMode !== 'client' && columnSortable(field) !== 'client' && !BACKEND_UNSORTABLE.test(field)) return undefined
  return (a: ScreenerResultRow, b: ScreenerResultRow) => {
    const x = a.values[field]?.value ?? null
    const y = b.values[field]?.value ?? null
    if (x === null || y === null) return x === y ? 0 : x === null ? -1 : 1
    return compareFieldValues(x, y)
  }
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
  if (prop === 'name' || (prop && (BACKEND_UNSORTABLE.test(prop) || columnSortable(prop) === 'client'))) return
  // el-table's third click (clearing a column's sort) still reports that column as `prop`
  // even though `order` comes back null — null out field too so "cleared" is a clean,
  // single null/null state throughout (changeSort, the tab, and default-sort below all key
  // off field+order agreeing on that).
  emit('sortChange', order ? prop : null, order)
}

const tableRef = ref<TableInstance>()

// 每一欄的 sortable 值：client 模式全部交給 el-table（配 sortMethodFor）；server 模式
// 照篩選器原本的規則（型錄外的 stock.* 例外，見 BACKEND_UNSORTABLE）。
function columnSortable(field: string): ScreenerResultTableColumn['sortable'] {
  return orderedColumns.value.find(column => column.field === field)?.sortable
}

function sortableFor(field: string): boolean | 'custom' {
  const own = columnSortable(field)
  if (own === false) return false
  if (own === 'client') return true
  if (own === 'server') return props.sortMode === 'client' ? true : 'custom'
  if (props.sortMode === 'client' || BACKEND_UNSORTABLE.test(field)) return true
  return 'custom'
}

// 欄寬照「值」估、表頭在欄寬裡折行（2026-10-22，使用者在方案頁選 1B：「希望 screener 表頭寬度 受限於 值寬度去折行 這樣才能在單位寬度內
// 看到更多數值」——推翻 2026-10-06 的「我不希望看到有欄位的文字 UI 換行」，值本身照舊不折行）。照欄位型別估、不量載入的列：載入更多、
// 換排序時欄寬才不會跳。數字（百分比、千分位、負號，例如 -123.45%）104px，表頭一行約三個字；類別照最長的選項，河道位置多一條七格軌道；
//「顯示資料時間」開著時至少放得下日期（10 碼）
const NUMBER_COLUMN_WIDTH = 104
const RIVER_TRACK_WIDTH = 60
function minWidthFor(column: ScreenerResultTableColumn): number {
  const metric = locateFieldInSchema(props.categories, column.field)?.metric
  const labels = (metric?.options ?? []).map(option => option.label)
  // 一格可能列好幾個選項（已經持有的帳戶名稱）：照全部串起來估，最多 20 個字
  const chars = metric?.joinedOptions ? Math.min(20, labels.join('、').length) : Math.max(0, ...labels.map(label => label.length))
  const value = metric?.kind === 'categorical'
    ? chars * 16 + (metric.key.endsWith('RiverBand') ? RIVER_TRACK_WIDTH : 0) + 24
    : NUMBER_COLUMN_WIDTH
  return Math.max(NUMBER_COLUMN_WIDTH, value, showCellDates.value ? 112 : 0)
}
// el-table 的表身從內部欄位表讀欄位順序，keyed v-for 重排不會重新登記——表頭跟著拖、表身不跟；所以重排後要靠 tableKey 整表重掛。
const tableKey = ref(0)

// 欄位多的時候表格要左右捲：捲動區要能用鍵盤聚焦、有名稱，方向鍵才捲得動（axe scrollable-region-focusable）。整表重掛會換掉捲動區，要再補
useFocusableTableScroll(tableRef, '股票清單，可左右捲動', () => tableKey.value)

// 表頭拖曳換順序在 useColumnDrag（Pragmatic DnD、插入縫發亮、放手才換）；放手後整表重掛（tableKey）並把新順序交給父層
const { headerClassFor } = useColumnDrag({
  headerCells: () => {
    // 有 fixed 欄位時 header-wrapper 會有多個，要排除 .el-table__fixed 底下的
    const rootEl = tableRef.value?.$el as HTMLElement | undefined
    const headerWrapper = Array.from(rootEl?.querySelectorAll<HTMLElement>('.el-table__header-wrapper') ?? []).find(
      wrapper => !wrapper.closest('.el-table__fixed, .el-table__fixed-right')
    )
    return Array.from(headerWrapper?.querySelectorAll<HTMLElement>('thead tr th.screener-result-table__draggable-header') ?? [])
  },
  columns: orderedColumns,
  readonly: () => false,
  headerClass: 'screener-result-table__draggable-header',
  onReorder: updated => {
    orderedColumns.value = updated
    tableKey.value++
    emit('reorder', updated.map(column => column.field))
  }
})

// 表格自己的尺寸變了（不是視窗，例如內容寬度切換置中／滿版）不用另外處理（2026-10-16 刪掉這裡的 ResizeObserver）：el-table 2.14
// 在 fit（預設 true）時自己用 ResizeObserver 看根元素與內層容器，尺寸真的變了才 doLayout() 並更新捲軸（table/style-helper.mjs）。
// 這裡原本再掛一個、每次無條件 doLayout()，表格有固定欄，每次還多量一輪高度；篩選頁桌機的長任務裡就有這些強制重排

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
  return props.sortMode === 'client' || field === 'name' || BACKEND_UNSORTABLE.test(field) || columnSortable(field) === 'client'
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

// 名稱欄跟著資料寬（2026-10-22，使用者：「screener 名稱 的 欄位 寬度 符合資料寬度就好」）：目前載入的列裡最長的名稱，用表格的字型量，
// 加格子左右內距 24px；不窄於表頭（「名稱」兩個字＋排序圖示＋按鈕內距）。原本三組固定 160px（ETF 簡稱常有 8 個字），普通股兩三個字的
// 名稱右邊空一大塊。結果只在瀏覽器查，伺服器端不會畫到這張表
let measureContext: CanvasRenderingContext2D | null = null
const nameWidth = computed(() => {
  if (!import.meta.client) return 0
  measureContext ??= document.createElement('canvas').getContext('2d')
  if (!measureContext) return 0
  measureContext.font = `${getComputedStyle(document.documentElement).fontSize} ${getComputedStyle(document.body).fontFamily}`
  const widest = Math.max(measureContext.measureText('名稱').width + 22, ...props.rows.map(row => measureContext!.measureText(row.name ?? '').width))
  return Math.ceil(widest) + 24
})

// 最後一列：知道總數就寫出來（三組篩選共用，2026-10-15；原本寫死「…的股票」，ETF 不是股票）
const endText = computed(() => (props.total !== undefined ? `已顯示全部 ${groupThousands(props.total)} 檔` : '已顯示全部符合條件的結果'))

// ---- 欄位設定：拖曳表頭與表頭小 × 的替代（WCAG 2.1.1／2.5.7），彈窗在 SharedColumnSettings（觀察清單共用）----
const columnSettingsOpen = ref(false)

// 彈窗按「儲存」：整份交給父層（saveColumns），父層檢查完自己的部分（篩選頁的「這一組」）再呼叫 done。done(true) 時表格先照新順序排——
// 這張表保留自己的拖曳順序、不跟父層換順序（見 orderedColumns 的 watch），所以要在這裡換；新增的欄位先放名稱，父層的資料到了再補上
function saveFromSettings(columns: ColumnDraft[], close: () => void) {
  emit('saveColumns', columns, (apply = true) => {
    if (apply) applyLocalOrder(columns)
    close()
  })
}
function applyLocalOrder(columns: ColumnDraft[]) {
  orderedColumns.value = columns.map(draft => orderedColumns.value.find(column => column.field === draft.field) ?? { field: draft.field, label: draft.label })
  tableKey.value++
}

// ---- 表頭的欄位選單（SharedColumnMenu，2026-10-22）：點表頭打開，不直接排序 ----
// 表頭格裡任何地方點到都算（按鈕蓋不滿整格，格子的留白也要），在 el-table 自己的表頭點擊（會直接排序）之前就攔下來；
// 鍵盤在表頭按鈕上按 Enter／空白鍵也是一個 click。「＋ 新增欄位」那一欄沒有表頭按鈕，照舊
const menu = reactive<{ open: boolean, field: string | null, anchor: HTMLElement | null }>({ open: false, field: null, anchor: null })
const menuStatus = ref('')
function onTableClickCapture(event: MouseEvent) {
  const head = (event.target as HTMLElement).closest('th')?.querySelector<HTMLElement>('.screener-result-table__head')
  if (!head) return
  event.stopPropagation()
  const field = head.dataset.field!
  // 開在這一欄時再點一下是關；換一欄要先關再開，焦點才會進到新的選單
  const wasOpenHere = menu.open && menu.field === field
  menu.open = false
  if (wasOpenHere) return
  nextTick(() => {
    menu.field = field
    menu.anchor = head
    menu.open = true
  })
}
// el-table 的表頭沒有 aria-sort，排序狀態寫在表頭按鈕裡給螢幕閱讀器（SharedSortIcon 是裝飾）
const sortStateText = (field: string) => (activeSort.value.field === field && activeSort.value.order ? `，${activeSort.value.order === 'ascending' ? '由小到大' : '由大到小'}排序中` : '')
const menuColumn = computed(() => orderedColumns.value.find(column => column.field === menu.field) ?? null)
// 選單上面只寫欄名、不放指標說明（2026-10-22，使用者：「篩選 的 表頭選單 移除說明」）
const menuLabel = computed(() => (menu.field === 'symbol' ? '代號' : menu.field === 'name' ? '名稱' : menuColumn.value ? displayLabel(menuColumn.value) : ''))
const menuSort = computed(() => {
  const sortable = menu.field === 'symbol' || menu.field === 'name' || (!!menuColumn.value && sortableFor(menuColumn.value.field) !== false)
  return sortable ? (activeSort.value.field === menu.field ? activeSort.value.order : null) : undefined
})
const menuMoves = computed(() => {
  if (!menuColumn.value) return undefined
  const index = orderedColumns.value.indexOf(menuColumn.value)
  return { left: index > 0, right: index < orderedColumns.value.length - 1 }
})
// 整表重掛（tableKey）之後，el-table 要再畫一兩個畫面表頭才出來：等到那一欄的按鈕出現再放焦點，最多等十個畫面
function focusHead(field: string, tries = 10) {
  requestAnimationFrame(() => {
    const head = (tableRef.value?.$el as HTMLElement | undefined)?.querySelector<HTMLElement>(`.screener-result-table__head[data-field="${field}"]`)
    if (head?.isConnected) head.focus()
    else if (tries > 0) focusHead(field, tries - 1)
  })
}

function onColumnMenu(action: ColumnMenuAction) {
  const field = menu.field
  if (!field) return
  if (action === 'ascending' || action === 'descending') {
    applySort(field, action)
    menuStatus.value = `依「${menuLabel.value}」${action === 'ascending' ? '由小到大' : '由大到小'}排序`
    return
  }
  if (action === 'clear') {
    applySort(null, null)
    menuStatus.value = '取消排序'
    return
  }
  const columns = orderedColumns.value
  const index = columns.findIndex(column => column.field === field)
  if (index < 0) return
  if (action === 'remove') return removeFromMenu(columns[index]!)
  const target = action === 'left' ? index - 1 : action === 'right' ? index + 1 : action === 'start' ? 0 : columns.length - 1
  if (target === index || target < 0 || target >= columns.length) return
  const next = [...columns]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)
  orderedColumns.value = next
  tableKey.value++
  emit('reorder', next.map(column => column.field))
  menuStatus.value = `「${menuLabel.value}」移到第 ${target + 1} 欄`
  // 整表重掛換掉了表頭按鈕：焦點放回搬過去的那一欄
  focusHead(field)
}

// 移除這一欄：馬上拿掉、10 秒內可以復原（全站「可以復原的動作不先確認」；選單不是對話框，復原提示按得到）。整份欄位交給父層，
// 跟欄位設定彈窗同一條路（saveColumns）
function removeFromMenu(column: ScreenerResultTableColumn) {
  const previous = orderedColumns.value.map(({ field, label }) => ({ field, label }))
  const next = previous.filter(item => item.field !== column.field)
  const label = displayLabel(column)
  emit('saveColumns', next, apply => { if (apply !== false) applyLocalOrder(next) })
  undoToast(`已移除「${label}」欄`, () => {
    emit('saveColumns', previous, apply => { if (apply !== false) applyLocalOrder(previous) })
  }, () => {})
}

// ---- 無限捲動：哨兵（表格 #append 那一列、卡片清單最後）進到畫面附近就載下一批 ----
// root 一律用 viewport：IntersectionObserver 會算上祖先的裁切，所以整頁捲、框內捲都適用。表格 2026-10-15 改成跟著整頁捲（sticky）
// 之後表身不再是捲動框，舊做法（useElTableLoadMore，以表身的捲動框為 root，已刪）會把哨兵一直當成看得到、一口氣載完全部頁數。
// 整表重掛（tableKey）與 hasMore 翻轉都會換掉哨兵元素，所以看的是 ref 本身；載完一批哨兵還在畫面裡時不會再觸發，列數變了就重新觀察。
function observeSentinel(sentinel: Ref<HTMLElement | undefined>) {
  let observer: IntersectionObserver | null = null
  watch(sentinel, (element) => {
    observer?.disconnect()
    observer = null
    if (!element) return
    observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting) && props.hasMore && !props.loadingMore) emit('loadMore')
    }, { rootMargin: '200px 0px' })
    observer.observe(element)
  })
  watch(() => props.rows.length, () => {
    const element = sentinel.value
    if (observer && element) {
      observer.unobserve(element)
      observer.observe(element)
    }
  })
  onUnmounted(() => observer?.disconnect())
}
const sentinelRef = ref<HTMLElement>()
const cardSentinelRef = ref<HTMLElement>()
observeSentinel(sentinelRef)
observeSentinel(cardSentinelRef)

// sticky：表頭黏住之後可以在表格中段點表頭排序。新的一批（第一頁）回來時畫面還停在原來的深度，看到的是頁尾或半張表——捲回表格頂端。
// 只在已經捲進表格時；人在上面改條件時不動
watch(() => props.loading, (loading, wasLoading) => {
  if (!props.sticky || loading || !wasLoading) return
  const root = tableRef.value?.$el as HTMLElement | undefined
  if (root && root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start' })
})
</script>

<template>
  <!-- Single root (rather than el-table/el-pagination as two siblings) so the class the
       parent passes in (screener-result-body__table) still falls through automatically —
       Vue only does that for a single-root component. -->
  <div class="screener-result-table-wrap screener-result-table-wrap--cards">
    <!-- 卡片版面時兩列（2026-10-22 使用者選操作區方案 A）：顯示欄位＋欄位設定一列，排序＋方向一列；表格版面只有第一列。
         欄位設定是拖曳表頭換欄的鍵盤替代（WCAG 2.5.7），各寬度都在。排序選單只在卡片版面（容器 <720px）出現：卡片沒有表頭；
         表格的排序箭頭本身就是可聚焦的 button＋aria-sort，再放一個選單只是重複（2026-10-08 使用者同意） -->
    <div class="smt-toolbar">
      <div class="smt-toolbar__row">
        <!-- 呼叫端放在同一列最前面的控制項（篩選頁的「顯示欄位」選單，2026-10-15 跟欄位設定併成一列，結果表往上移） -->
        <slot name="toolbar" />
        <!-- el-button：跟同一列「顯示欄位」的＋新增同高（滑鼠 32px、觸控 44px） -->
        <el-button class="smt-toolbar__settings" @click="columnSettingsOpen = true">欄位設定</el-button>
      </div>
      <div class="smt-toolbar__row smt-toolbar__sort">
        <!-- 標籤疊在選單框裡（不攔點擊），名稱照樣是「排序」 -->
        <label class="smt-sort">
          <span class="smt-sort__label">排序</span>
          <select class="app-select smt-sort__select" :value="activeSort.field ?? ''" @change="onSortFieldChange(($event.target as HTMLSelectElement).value)">
            <option value="">預設順序</option>
            <option v-for="option in sortFieldOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <!-- 方向一直在（沒選排序欄位時停用），選了欄位不會多冒出一個選單把版面推開。圖示是全站的排序圖示（沒排序兩個三角形、排序中只留
             那個方向；使用者 2026-10-21 的規範），不用文字箭頭：↑↓ 的高低跟著字型跑，跟旁邊的字對不齊 -->
        <el-button class="smt-direction" :disabled="!activeSort.field" @click="applySort(activeSort.field, activeSort.order === 'ascending' ? 'descending' : 'ascending')">
          <span class="visually-hidden">排序方向：</span><SharedSortIcon class="smt-direction__icon" :state="activeSort.field ? activeSort.order : null" />{{ activeSort.order === 'ascending' ? '小到大' : '大到小' }}
        </el-button>
      </div>
    </div>
    <SharedColumnSettings
      v-model:open="columnSettingsOpen"
      :columns="orderedColumns"
      :label-of="displayLabel"
      :categories="categories"
      @save="saveFromSettings"
    >
      <template v-if="$slots['column-settings-head']" #head><slot name="column-settings-head" /></template>
    </SharedColumnSettings>

    <!-- 窄的時候是卡片，寬的時候是表格；兩份都在 DOM 裡、由 CSS container query 切換（專案規則：不在
         渲染時用寬度選標記）。 -->
    <!-- click.capture：表頭點擊在 el-table 自己排序之前攔下來，改成打開欄位選單（onTableClickCapture） -->
    <div v-loading="loading" class="smt-table-view" @click.capture="onTableClickCapture">
    <el-table
      :key="tableKey"
      ref="tableRef"
      class="screener-result-table"
      :class="{ 'screener-result-table--sticky': sticky }"
      :data="rows"
      row-key="symbol"
      scrollbar-always-on
      :default-sort="defaultSort"
      @sort-change="handleSortChange"
      @row-click="row => emit('rowClick', row.symbol)"
    >
      <!-- Real backend sort (see handleSortChange) — sortable="custom" so el-table only
           reports the click instead of trying to reorder `rows` itself, which is already in
           whatever order the server returned it in. -->
      <el-table-column prop="symbol" label="代號" width="90" fixed class-name="screener-result-table__code" :sortable="sortMode === 'client' ? true : 'custom'">
        <template #header>
          <button type="button" class="screener-result-table__head screener-result-table__head--start" data-field="symbol" aria-haspopup="menu" :aria-expanded="menu.open && menu.field === 'symbol'">
            <span class="screener-result-table__column-label">代號</span><SharedSortIcon :state="activeSort.field === 'symbol' ? activeSort.order : null" /><span class="visually-hidden">{{ sortStateText('symbol') }}</span>
          </button>
        </template>
      </el-table-column>
      <!-- Plain sortable: not backend-sortable (see handleSortChange's comment), so this is
           a genuine, working client-side sort of whichever page is currently loaded —
           el-table handles it entirely on its own, no comparator needed here. -->
      <!-- @row-click below navigates on mouse click for a large, convenient hit target, but
           el-table rows are plain <tr>s with no native keyboard/AT semantics — this link is
           what actually makes "open a stock from this table" reachable without a mouse
           (same /stock/{code} path the parent's own row-click handler already navigates to,
           see screener.vue). -->
      <el-table-column prop="name" label="名稱" :width="nameWidth" fixed sortable>
        <template #header>
          <button type="button" class="screener-result-table__head screener-result-table__head--start" data-field="name" aria-haspopup="menu" :aria-expanded="menu.open && menu.field === 'name'">
            <span class="screener-result-table__column-label">名稱</span><SharedSortIcon :state="activeSort.field === 'name' ? activeSort.order : null" /><span class="visually-hidden">{{ sortStateText('name') }}</span>
          </button>
        </template>
        <template #default="{ row }">
          <NuxtLink :to="rowLink(row.symbol)" class="screener-result-table__name-link" @click.stop>{{ row.name }}</NuxtLink>
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
          <!-- 點表頭打開欄位選單（2026-10-22，SharedColumnMenu）：排序、移動、移除都在選單裡；表頭上沒有直接刪除的 X
               （2026-10-21 使用者拿掉的，一按就刪）。排序的箭頭是 SharedSortIcon，el-table 自己的箭頭藏起來（見 CSS） -->
          <button type="button" class="screener-result-table__head" :data-field="column.field" aria-haspopup="menu" :aria-expanded="menu.open && menu.field === column.field">
            <SharedSortIcon :state="activeSort.field === column.field ? activeSort.order : null" /><span class="screener-result-table__column-label">{{ displayLabel(column) }}</span><span class="visually-hidden">{{ sortStateText(column.field) }}</span>
          </button>
        </template>
        <template #default="{ row }">
          <div class="screener-result-table__cell">
            <span v-if="riverZoneOf(column, row.values[column.field]?.value)" class="screener-result-table__zone" :class="riverZoneOf(column, row.values[column.field]?.value)!.textClass">
              <span class="screener-result-table__zone-track" :class="`screener-result-table__zone-track--${riverZoneOf(column, row.values[column.field]?.value)!.zone}`" :style="{ '--zone-color': riverZoneOf(column, row.values[column.field]?.value)!.color }" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>{{ formatValue(column, row.values[column.field]?.value) }}
            </span>
            <span v-else :class="directionClassOf(column, row.values[column.field]?.value)">{{ formatValue(column, row.values[column.field]?.value) }}</span>
            <!-- The actual per-row knowledgeDate this specific number describes (renamed from
                 asOfDate 2026-09-14) — different symbols can legitimately show different dates
                 for the same field (e.g. one hasn't filed this quarter's report yet), so this
                 can't be hoisted up to the column header the way the period-type suffix above is. -->
            <span v-if="showCellDates && row.values[column.field]?.knowledgeDate" class="screener-result-table__cell-date">
              {{ cellPeriodText(row.values[column.field]!) }}
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column width="48" align="center">
        <template #header>
          <el-button :icon="Plus" circle text size="small" title="新增欄位" aria-label="新增欄位" @click.stop="emit('addColumnClick')" />
        </template>
      </el-table-column>

      <!-- Renders INSIDE el-table's body, after the last data row — reads as the table's own
           last row. observeSentinel (script) watches it against the viewport. Only shown once
           there are any results at all (an empty table has nothing to paginate through). -->
      <template v-if="rows.length > 0" #append>
        <div v-if="hasMore" ref="sentinelRef" class="screener-result-table__load-more" role="status">
          <el-icon v-if="loadingMore" class="screener-result-table__load-more-spinner"><Loading /></el-icon>
          <span>{{ loadingMore ? '載入更多…' : '' }}</span>
        </div>
        <p v-else class="screener-result-table__load-more screener-result-table__load-more--end">
          {{ endText }}
        </p>
      </template>
    </el-table>
    <SharedColumnMenu
      v-model:open="menu.open"
      :anchor="menu.anchor"
      :label="menuLabel"
      :sort="menuSort"
      :moves="menuMoves"
      :removable="!!menuColumn"
      @action="onColumnMenu"
    />
    <p class="visually-hidden" role="status">{{ menuStatus }}</p>
    </div>

    <div v-loading="loading" class="smt-cards-view">
      <p v-if="!rows.length" class="smt-cards__empty">目前沒有資料</p>
      <ul v-else class="smt-cards" :aria-label="`共 ${rows.length} 檔已載入`">
        <li v-for="row in cardRows" :key="row.symbol" class="smt-card">
          <div class="smt-card__head">
            <NuxtLink :to="rowLink(row.symbol)" class="screener-result-table__name-link">{{ row.name }}</NuxtLink>
            <span class="smt-card__code">{{ row.symbol }}</span>
          </div>
          <dl v-if="orderedColumns.length" class="smt-card__values">
            <div v-for="column in orderedColumns" :key="column.field" class="smt-card__value">
              <dt>{{ displayLabel(column) }}</dt>
              <dd>
                <span v-if="riverZoneOf(column, row.values[column.field]?.value)" class="screener-result-table__zone" :class="riverZoneOf(column, row.values[column.field]?.value)!.textClass">
                  <span class="screener-result-table__zone-track" :class="`screener-result-table__zone-track--${riverZoneOf(column, row.values[column.field]?.value)!.zone}`" :style="{ '--zone-color': riverZoneOf(column, row.values[column.field]?.value)!.color }" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>{{ formatValue(column, row.values[column.field]?.value) }}
                </span>
                <span v-else :class="directionClassOf(column, row.values[column.field]?.value)">{{ formatValue(column, row.values[column.field]?.value) }}</span>
                <span v-if="showCellDates && row.values[column.field]?.knowledgeDate" class="screener-result-table__cell-date">{{ cellPeriodText(row.values[column.field]!) }}</span>
              </dd>
            </div>
          </dl>
        </li>
      </ul>
      <template v-if="rows.length > 0">
        <div v-if="hasMore" ref="cardSentinelRef" class="screener-result-table__load-more">
          <el-icon v-if="loadingMore" class="screener-result-table__load-more-spinner"><Loading /></el-icon>
          <span>{{ loadingMore ? '載入更多…' : '' }}</span>
        </div>
        <p v-else class="screener-result-table__load-more screener-result-table__load-more--end">{{ endText }}</p>
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

@container (min-width: 720px) {
  .screener-result-table-wrap--cards .smt-table-view {
    display: flex;
  }

  .smt-cards-view,
  /* 兩個 class：同特異性時排在後面的 .smt-toolbar__row { display: flex } 會贏 */
  .smt-toolbar .smt-toolbar__sort {
    display: none;
  }
}

/* minmax(0, 1fr)：auto 欄寬的下限是內容的最小寬度，原生選單的最小寬度是最長的選項——欄位名一長，兩列一起撐出畫面（375 寬量到右緣 452） */
.smt-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

/* flex-start：「存成我的欄位組合」出現時顯示欄位那一組會換成兩行，欄位設定對齊第一行的選單 */
.smt-toolbar__row {
  display: flex;
  align-items: flex-start;
  gap: 8px 12px;
}

/* 同寬（「欄位設定」四個字的寬度）：兩列右邊的按鈕上下對齊 */
.smt-toolbar__row > .el-button {
  flex: none;
  min-width: 6em;
  margin: 0;
}

/* 排序列的高度跟著方向鍵（Element 的尺寸：滑鼠 32px、字級 110／120% 40px、觸控 44px）：原生選單（.app-select）本來固定 44px，
   用滑鼠看手機版面時比旁邊的按鈕高一截（2026-10-22，使用者：「手機版 排序 小到大 高度不對」）。觸控時全站規則把 select 撐到 44px */
.smt-toolbar__row.smt-toolbar__sort {
  align-items: stretch;
}

.smt-sort {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
}

.smt-sort__label {
  position: absolute;
  top: 50%;
  left: 12px;
  transform: translateY(-50%);
  color: var(--el-text-color-secondary);
  pointer-events: none;
}

/* 左邊留給疊上去的「排序」兩個字 */
.smt-sort__select {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding-left: calc(12px + 2em + 8px);
}

.smt-direction__icon {
  margin-right: 6px;
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
  border: 1px solid var(--el-card-border-color);
  border-radius: var(--el-card-border-radius);
  background: var(--el-card-bg-color);
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

.smt-cards__empty {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
}

/* 值不折行；表頭在欄寬裡折行、對齊底部（2026-10-22 方案 1B，見 minWidthFor） */
.screener-result-table :deep(.cell) {
  white-space: nowrap;
}

/* 表格的顏色、表頭、列線、左右 16px 是全站表格的規則（main.css 與 element-plus.css 的「全站表格」，2026-10-23 從這裡抽出去）。
   這裡只剩篩選結果自己的：代號是識別用的，灰一階讓名稱與數字先被看到。名稱不加粗：微軟正黑體沒有 500，中文退回一般字重、英文卻變半粗
  （「富林-KY」的 KY 比字粗） */
.screener-result-table :deep(td.screener-result-table__code) {
  color: var(--el-text-color-secondary);
}

.screener-result-table :deep(th.el-table__cell) {
  vertical-align: bottom;
}

.screener-result-table :deep(th.el-table__cell .cell) {
  white-space: normal;
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

/* 排序箭頭的大小、間距、排序中只留一個：全站一條，在 element-plus.css 的「排序箭頭」（2026-10-21 從這裡搬過去） */

/* 欄位多到超出右邊（2026-10-15 使用者：「篩選的欄位太多 破版了」）：表格本來就在自己的框裡左右捲、代號與名稱固定在左邊，但右邊
   被切一刀、捲軸只在滑鼠停留時出現（現在 scrollbar-always-on），看起來就像破版。右緣淡出＝右邊還有欄位，捲到最右就消失。
   is-scrolling-* 是 el-table 依捲動位置自己掛在根元素上的。有固定在右邊的欄（觀察清單的操作欄）時 Element 會在那欄自己畫陰影，不疊 */
.screener-result-table.is-scrolling-left:not(:has(.el-table-fixed-column--right))::after,
.screener-result-table.is-scrolling-middle:not(:has(.el-table-fixed-column--right))::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 32px;
  pointer-events: none;
  /* 儲存格與黏住的表頭（index + 2）之上、橫向捲軸（sticky 時 index + 4，否則 index + 2）之下 */
  z-index: calc(var(--el-table-index) + 3);
  background: linear-gradient(to right, transparent, var(--el-table-bg-color));
}

/* 捲動區可以用鍵盤聚焦（useFocusableTableScroll）；外面兩層 overflow: hidden／clip 會切掉往外畫的焦點環，改往內畫 */
.screener-result-table :deep(.el-scrollbar__wrap:focus-visible) {
  outline-offset: -2px;
}

/* ---- sticky：表格跟著整頁捲（2026-10-15，使用者在「黏在畫面底部／表頭上方／整張塞進第一個畫面」裡選了第一個）----
   表頭黏在頁首下面、橫向捲軸黏在畫面底部：一進來捲軸就在第一個畫面、滑鼠拖得到；往下捲整個畫面都是表格，表身不再自己上下捲
   （原本滑鼠停在表格上滾輪只捲框裡，列一直擠在畫面下半部）。
   Element 在根元素、body-wrapper、el-scrollbar 三層用 overflow: hidden——那會讓它們成為捲動容器，sticky 只相對它們黏，等於沒黏。
   clip 裁切一樣，但不是捲動容器（同 layouts/default.vue 的 .app-shell--layer-open）。 */
.screener-result-table--sticky,
.screener-result-table--sticky :deep(.el-table__body-wrapper),
.screener-result-table--sticky :deep(.el-table__body-wrapper > .el-scrollbar) {
  overflow: clip;
}

/* 排序後捲回表格頂端時（script 的 loading watcher）停在頁首下面 */
.screener-result-table--sticky {
  scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 8px);
}

/* 整頁關掉捲動錨定：列都在表身的橫向捲動框裡，瀏覽器不拿它們當錨點，改拿表格下面的東西（頁尾）——每載一頁表格長高，它就把畫面
   往下推同樣的高度，哨兵一直在畫面裡，一口氣載完全部（2026-10-15 量到：滾 700px 後 4 秒內載到 200 列、捲到 8080）。只擋頁尾沒用，
   要整頁關（量過 html／body 都可以）。這一頁的版面變動都發生在使用者正在看的上方控制項，用不到錨定 */
:global(html:has(.screener-result-table--sticky)) {
  overflow-anchor: none;
}

.screener-result-table--sticky :deep(.el-table__header-wrapper) {
  position: sticky;
  top: calc(var(--app-header-height) + var(--app-banner-height));
  /* 蓋過捲上來的列：一般格 index、固定欄 index + 1 */
  z-index: calc(var(--el-table-index) + 2);
}

/* 橫向捲軸：點擊範圍 24px 高（WCAG 2.5.8），把手看起來 12px（上下各 6px 透明邊框）；不透明的軌道，壓在列上面時看得出是捲軸。
   bottom 讓開手機與平板的底部導覽列（main.css 的 --app-bottom-nav-height，桌機是 0）與 GA 同意橫幅（AppConsentBanner 設的
   --app-consent-height，沒有橫幅時是 0）。margin 對上 el-scrollbar 算把手寬度時
   扣掉的 4px。沒有超出（is-scrolling-none）時不顯示，不留一條空白帶。 */
.screener-result-table--sticky :deep(.el-table__body-wrapper .el-scrollbar__bar.is-horizontal) {
  position: sticky;
  bottom: calc(var(--app-bottom-nav-height, 0px) + var(--app-consent-height, 0px));
  left: auto;
  right: auto;
  height: 24px;
  margin: 0 2px;
  border-radius: 0;
  background: var(--el-table-bg-color);
  box-shadow: 0 -1px 0 var(--el-border-color-lighter);
  z-index: calc(var(--el-table-index) + 4);
}

.screener-result-table--sticky :deep(.el-table__body-wrapper .el-scrollbar__bar.is-horizontal .el-scrollbar__thumb) {
  border-block: 6px solid transparent;
  border-radius: 12px;
  background-clip: padding-box;
  background-color: var(--el-text-color-secondary);
  opacity: 1;
}

.screener-result-table--sticky :deep(.el-table__body-wrapper .el-scrollbar__bar.is-horizontal .el-scrollbar__thumb:hover) {
  background-color: var(--el-text-color-regular);
}

.screener-result-table--sticky.is-scrolling-none :deep(.el-table__body-wrapper .el-scrollbar__bar.is-horizontal),
/* 表身不再自己上下捲：直向那條只剩看不見、卻會吃掉最後一欄右緣點擊的軌道 */
.screener-result-table--sticky :deep(.el-table__body-wrapper .el-scrollbar__bar.is-vertical) {
  display: none;
}

/* 鍵盤聚焦到名稱連結時瀏覽器只捲到剛好看得到——要讓開黏住的表頭（49px）與底部捲軸（24px），不然會停在它們底下（WCAG 2.4.11）。
   底部導覽列已經由 main.css 的 scroll-padding-bottom 讓開 */
.screener-result-table--sticky .screener-result-table__name-link {
  scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 57px);
  scroll-margin-bottom: 32px;
}

/* 查詢中的轉圈：結果現在可能好幾千 px 高，Element 放在遮罩正中間會跑出畫面；改成黏在畫面 40% 高的地方 */
.screener-result-table-wrap :deep(.el-loading-spinner) {
  position: sticky;
  top: 40vh;
  margin-top: 0;
}

/* 拖曳中的來源欄變淡——它的位置不會動（見 useColumnDrag），這是唯一表示「正在拖它」的回饋 */
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

/* Flex row across the label and el-table's own sort caret — see the
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

/* 表頭是打開欄位選單的按鈕（2026-10-22）：el-table 自己的排序箭頭藏起來，排序狀態畫在按鈕裡（SharedSortIcon，同自己畫表頭的表格）。
   按鈕蓋滿格子的寬：點哪裡都是這顆（留白的點擊另由 onTableClickCapture 接住） */
.screener-result-table :deep(th:has(.screener-result-table__head) .caret-wrapper) {
  display: none;
}

/* 格子的內距＝內容格的內距減掉按鈕自己的 4px，欄名才跟下面的數字切齊（一般 12px、第一欄 16px，同全站表格）。原本一律 4px，欄名比數字
   往外 4～8px（2026-10-23 量到） */
.screener-result-table :deep(th:has(.screener-result-table__head) .cell) {
  padding: 0 8px;
}

.screener-result-table :deep(th.el-table__cell:first-child:has(.screener-result-table__head) .cell) {
  padding-left: 12px;
}

.screener-result-table__head {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
  min-height: 32px;
  padding: 0 4px;
  font: inherit;
  font-weight: inherit;
  color: inherit;
  text-align: right;
  background: none;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
}

.screener-result-table__head--start {
  justify-content: flex-start;
  text-align: left;
}

.screener-result-table__head:hover {
  color: var(--el-color-primary-dark-2);
}

.screener-result-table__head:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

.screener-result-table__column-label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.screener-result-table__cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.3;
}

.screener-result-table__zone {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* 七格位置軌道（方案 2B，見 riverZoneOf）：第幾格亮就是第幾層。亮的那一格是那一層的顏色（--zone-color）而且高一截，其他是又淺又矮的灰——
   不分顏色也要看得出哪一格（第一版其他格用 --el-border-color，跟亮的那格明暗差不多，量到看不出位置） */
.screener-result-table__zone-track {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.screener-result-table__zone-track i {
  width: 6px;
  height: 8px;
  border-radius: 1.5px;
  background: var(--el-border-color-lighter);
}

.screener-result-table__zone-track--0 i:nth-child(1),
.screener-result-table__zone-track--1 i:nth-child(2),
.screener-result-table__zone-track--2 i:nth-child(3),
.screener-result-table__zone-track--3 i:nth-child(4),
.screener-result-table__zone-track--4 i:nth-child(5),
.screener-result-table__zone-track--5 i:nth-child(6),
.screener-result-table__zone-track--6 i:nth-child(7) {
  height: 16px;
  background: var(--zone-color);
}

.screener-result-table__cell-date {
  font-size: 1rem;
  color: var(--el-text-color-placeholder);
}

</style>
