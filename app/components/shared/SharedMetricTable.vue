<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import type { ScreenerResultRow } from '~/composables/screener/useFilterSearch'
import type { MetricCategory } from '~/composables/screener/useFilterSchema'
import type { ColumnDraft } from './SharedColumnSettings.vue'
import type { ColumnMenuAction } from './SharedColumnMenu.vue'
// 結果表：普通股、特別股、ETF 三組篩選，加上觀察清單與它的分享頁（2026-11-11，使用者：「以篩選那邊的表格為主…請把結果表格抽出為
// 共用元件」，桌機「拿掉，跟篩選一樣」、手機「改成篩選的卡片」：觀察清單原本是 SharedSheetGrid 與對齊的四欄表）。
export interface ScreenerResultTableColumn {
  field: string
  label: string
  // ---- 2026-10-15 三組篩選（普通股、特別股、ETF）共用這張表 ----
  // 這一欄自己的格式；不給就照型錄的單位（formatScreenerValue）。ETF 的規模、特別股的發行價這類要自己決定；觀察清單的漲跌、除息要看整列
  format?: (raw: string | number | null | undefined, row: ScreenerResultRow) => string
  // 格子的字色（觀察清單的漲跌用漲跌色），同年增率的漲跌色（textClassOf）
  cellClass?: (raw: string | number | null | undefined, row: ScreenerResultRow) => string
  // 釘在最前面（觀察清單的收盤價、漲跌、除息／發放）：不能移動、移除、拖曳，其他欄也不能移到它們前面；欄位設定只列沒釘住的
  pinned?: boolean
  // 型錄外、字比數字長的欄（觀察清單的「+85.00 (+2.04%)」）自己給最小寬度；其他照 minWidthFor
  minWidth?: number
  // 骨架裡代替值的字（跟真的值一樣長，窄卡片折行才一樣）；不給是 00.00
  sample?: string
  // 這一欄怎麼排：'server' 交給父層打後端、'client' 只排已載入的列、false 不能排。不給就照原本的規則（見 sortableFor）
  sortable?: 'server' | 'client' | false
  // 第一下由小到大（溢價率、費用率這類「越小越符合多數人要找的」）；不給就照 ASCENDING_FIRST_METRICS
  ascendingFirst?: boolean
  // 長文字欄（特別股的發行公司信用評等，2026-10-31）：靠左、約 20 個字寬、放不下換行。其他欄的值不換行、靠右（數字）
  wide?: boolean
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
  // 每一格連去哪裡（2026-10-30，普通股：那家公司這支指標的頁；ETF、特別股：那個面向的頁）；null＝這一欄沒有頁，點了照舊是整列（rowLink）
  cellLink?: (symbol: string, field: string) => string | null
  // 符合條件的總檔數：最後一列寫「已顯示全部 N 檔」
  total?: number
  // 表格跟著整頁捲：表頭黏在頁首下面、橫向捲軸黏在畫面底部（2026-10-15 使用者：「我希望橫向scrollbar可以呈現在第一個畫面…才可以
  // 把卷軸用滑鼠往右邊拉動」）。原本表格限高一個螢幕、自己上下捲，捲軸在表格底部、第一個畫面看不到，滑鼠在表格上滾輪只捲框裡
  sticky?: boolean
  // 查詢中：遮罩只蓋結果（表格或卡片），不蓋工具列裡的控制項
  loading?: boolean
  // ---- 2026-11-11 觀察清單共用 ----
  // 名稱下面一行字（觀察清單的備註）
  noteOf?: (symbol: string) => string | null | undefined
  // false：沒有欄位設定與「欄位 N 個」，表頭選單只能排序、不能拖曳（分享頁、訪客）
  editable?: boolean
  // 欄位設定的「重設預設欄位」
  columnDefaults?: ColumnDraft[]
  // 資料還沒到（會員頁的骨架，全站規則「結構先畫、資料區塊同大小」）：rows 是呼叫端給的空列（列數照上次），不畫 el-table——它在伺服器
  // 不畫列（欄位要 mount 才登記），自己畫一張骨架表與骨架卡片。同 HoldingsSymbolTable
  skeleton?: boolean
  // 骨架要跟資料到了一樣大：名稱欄寬與表頭高記在 cookie（useLayoutHint）的鍵
  layoutKey?: string
  // 這張表叫什麼（左右捲動區的名稱「…，可左右捲動」）：一頁有好幾張時要分得開（觀察清單一類一張，同名是 axe landmark-unique）
  label?: string
}>(), {
  hasMore: false,
  loadingMore: false,
  sortField: null,
  sortOrder: null,
  sortMode: 'server',
  showPeriod: undefined,
  cellDates: undefined,
  rowLink: (symbol: string) => securityPath(symbol),
  cellLink: () => null,
  total: undefined,
  sticky: false,
  loading: false,
  noteOf: undefined,
  editable: true,
  columnDefaults: undefined,
  skeleton: false,
  layoutKey: undefined,
  label: '股票清單'
})
const slots = defineSlots<{
  toolbar?: () => unknown
  // 有給才多一欄「操作」，卡片底下一列按鈕（觀察清單按「編輯」時的備註、移除）
  actions?: (props: { row: ScreenerResultRow }) => unknown
}>()

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
const ASCENDING_FIRST_METRICS = new Set(['peRatio', 'pbRatio', 'pegRatio', 'psr', 'evEbitda', 'exchangePeRatio', 'livePeRatio', 'exchangePbRatio', 'livePbRatio', 'livePegRatio', 'livePegyRatio', 'grahamNumber', 'liveGrahamNumber'])

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
// price or ratio keeps every digit the backend sent rather than being cut to 4 significant digits
// (nothing that size ever overflows this column to begin with).
function formatValue(column: ScreenerResultTableColumn, row: ScreenerResultRow): string {
  const raw = row.values[column.field]?.value
  if (column.format) return column.format(raw, row)
  // 上面的理由（市值有效數字、千分位、其他數字不截位）的實作在 app/utils/screener-value.ts，觀察清單共用
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
function riverZoneOf(column: ScreenerResultTableColumn, raw: string | number | null | undefined): { zone: number; color: string; textClass: string } | null {
  const metric = locateFieldInSchema(props.categories, column.field)?.metric
  if (raw == null || metric?.kind !== 'categorical' || !metric.key.endsWith('RiverBand')) return null
  const zone = typeof raw === 'number' ? raw : Number.NaN
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
function textClassOf(column: ScreenerResultTableColumn, row: ScreenerResultRow): string {
  const raw = row.values[column.field]?.value
  const metric = locateFieldInSchema(props.categories, column.field)?.metric
  return metric && YOY_NAME.test(metric.name) ? priceDirectionClass(numericValue(raw)) : column.cellClass?.(raw, row) ?? ''
}

// 有值、而且這一欄有頁才連（空格連過去也是空的）。格子整塊是連結：數字照原本的顏色（年增率的漲跌色、河道位置），只有滑過或聚焦時畫底線
const NuxtLink = resolveComponent('NuxtLink')
function cellHref(row: ScreenerResultRow, column: ScreenerResultTableColumn): string | null {
  return row.values[column.field]?.value == null ? null : props.cellLink(row.symbol, column.field)
}
// 點到連結（名稱、有頁的格子）由連結自己換頁、按鈕（觀察清單的操作欄）做自己的事；其他地方點整列進個股頁
function onRowClick(row: ScreenerResultRow, _column: unknown, event: MouseEvent) {
  if (!(event.target as Element).closest('a, button')) emit('rowClick', row.symbol)
}

const emit = defineEmits<{
  reorder: [fields: string[]]
  removeColumn: [field: string]
  // 欄位設定彈窗或欄位面板按「儲存」、表頭選單的移除（saveFromSettings、removeFromMenu）：整份欄位
  saveColumns: [columns: ColumnDraft[]]
  rowClick: [symbol: string]
  loadMore: []
  // Only ever emitted for symbol/metric columns — see handleSortChange below. field is null
  // when the user clicks a third time to clear a column's sort.
  sortChange: [field: string | null, order: 'ascending' | 'descending' | null]
}>()

// Local display order: a drag or the column menu moves it at once, and `reorder` hands the new
// order to the parent to persist (this tab's backing column-preset). The parent's `columns`
// always win after that.
// Real bug fixed 2026-09-11 (reported live: "陌生訪客現在的表頭會變成代碼而非中文") — this used to
// keep the OLD orderedColumns entry object for any field still present in the new `next`, only
// ever reading `next` to decide WHICH fields survive, never to refresh what they're now labeled.
// Invisible for a signed-in tab (its own tab.columns starts genuinely empty, so the very first
// populated value already has correct labels — nothing stale to preserve). The guest tab
// (useScreenerTabs.ts's buildGuestTab) pre-seeds a placeholder columns array — {field, label:
// field} — before its first real search resolves, so this component mounts with real fields but
// raw-code labels; once the real search replaced tab.columns with properly-labelled entries for
// the SAME fields, this watcher kept the stale placeholder objects instead of adopting the fresh
// ones.
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
// 釘住的欄（觀察清單的固定欄）一直在最前面；拖曳、表頭選單的移動與移除、欄位設定都只動沒釘住的
const pinnedColumns = computed(() => orderedColumns.value.filter(column => column.pinned))
const movableColumns = computed(() => orderedColumns.value.filter(column => !column.pinned))

watch(
  () => props.columns,
  next => {
    // 順序一律照父層（2026-11-05，使用者：「screener 顯示欄位重新整理以後會跑掉」）：原本保留這裡的順序、新欄位接在最後，換一組欄位組合時畫面
    // 跟存的順序不一樣，重新整理才變回來。2026-10-06 試過照父層，每次搜尋都重掛，因為那時 tab.columns 是伺服器回的順序；現在照要求的順序排
    // （inRequestedOrder），順序沒變就不重掛，股價的前端排序與無限捲動不受影響（check-screener-operations）。
    // 留下來的欄位還在最前面、順序沒變＝只是少了幾欄或最後多了幾欄，el-table 自己跟得上；其他情況要重掛（見下面 tableKey 的註解）。
    // 拖曳放開時那邊已經自己重掛過，父層回傳的順序跟現在一樣，不會再掛一次。
    const fields = new Set(next.map(column => column.field))
    const stayed = orderedColumns.value.filter(column => fields.has(column.field))
    const inPlace = stayed.every((column, index) => column.field === next[index]?.field)
    orderedColumns.value = [...next]
    if (!inPlace) tableKey.value++
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
    return compareFieldValues(x, y, locateFieldInSchema(props.categories, field)?.metric.options)
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
  // client 模式（特別股）在這裡排完，父層只是記下來：重新整理後照舊（2026-10-23「screener 也要儲存用戶上次的排序」）
  if (props.sortMode !== 'client' && (prop === 'name' || (prop && (BACKEND_UNSORTABLE.test(prop) || columnSortable(prop) === 'client')))) return
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
  if (column.minWidth) return column.minWidth
  if (column.wide) return 20 * 16
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
useFocusableTableScroll(tableRef, `${props.label}，可左右捲動`, () => tableKey.value)

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
  columns: movableColumns,
  readonly: () => !props.editable,
  headerClass: 'screener-result-table__draggable-header',
  onReorder: updated => {
    orderedColumns.value = [...pinnedColumns.value, ...updated]
    tableKey.value++
    emit('reorder', orderedColumns.value.map(column => column.field))
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
watch([orderedColumns, () => props.rows], () => nextTick(() => {
  tableRef.value?.doLayout()
  rememberLayout()
}))

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
  // client 模式換了一組：el-table 自己排，要跟著那一組的排序走（自己按的已經是這個排序，不用再排一次）
  if (props.sortMode === 'client') {
    if (field !== activeSort.value.field || order !== activeSort.value.order) sortTable(field, order)
  } else if (field === null || !isLocalSort(field)) activeSort.value = { field, order }
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

function sortTable(field: string | null, order: 'ascending' | 'descending' | null) {
  activeSort.value = { field: order ? field : null, order: field ? order : null }
  programmaticSort = true
  if (field && order) tableRef.value?.sort(field, order)
  else tableRef.value?.clearSort()
  programmaticSort = false
}

function applySort(field: string | null, order: 'ascending' | 'descending' | null) {
  sortTable(field, order)
  if (props.sortMode === 'client' || !field || !isLocalSort(field)) emit('sortChange', field && order ? field : null, field ? order : null)
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

// 骨架照上次量到的名稱欄寬與表頭高畫（layoutKey 記在 cookie，伺服器讀得到）：資料到了名稱欄不變寬、表頭不多折一行，下面的東西不被推動。
// 第一次來名稱照 6 個字寬、表頭照一行，可能動一下（同全站 useLayoutHint）。骨架表的其他欄是平分的（<col> 的 calc 混百分比 Chromium
// 當成 auto，算不出 el-table 照 min-width 比例的分法，2026-11-11 量過），表頭因此釘在記下的高度、欄名不折行
const nameHint = props.layoutKey ? useLayoutHint(`${props.layoutKey}-name`, 0) : null
const headHint = props.layoutKey ? useLayoutHint(`${props.layoutKey}-head`, 0) : null
const skeletonNameWidth = computed(() => nameHint?.value || 6 * 16 + 24)
const skeletonHeadHeight = computed(() => (headHint?.value ? `${headHint.value}px` : undefined))
// 骨架表的欄寬照 el-table 的分法估：每欄的最小寬度，加起來比容器寬就左右捲（跟 el-table 一樣寬），否則照比例放大（<col> 寫百分比；calc 混 px
// Chromium 當成 auto）。只用伺服器也知道的數字、不看型錄：ETF 的型錄伺服器端還沒有，照型錄估的話欄寬在瀏覽器接手那一刻變（2026-11-11 量到 0.0021）
const skeletonWidths = computed(() => [90, skeletonNameWidth.value, ...orderedColumns.value.map(column => column.minWidth ?? (column.wide ? 20 * 16 : NUMBER_COLUMN_WIDTH))])
const skeletonTotal = computed(() => skeletonWidths.value.reduce((sum, width) => sum + width, 0))
const skeletonShare = (index: number) => `${(skeletonWidths.value[index]! / skeletonTotal.value) * 100}%`
function rememberLayout() {
  if (nameHint && !props.skeleton && props.rows.length) nameHint.value = nameWidth.value
}
// 表頭的高：el-table 照欄寬排好、欄名折完行之後才定（doLayout 之後下一個畫面量到的還是一行的高，2026-11-11），跟著 ResizeObserver 記。
// 卡片版面時表格藏著、高是 0，不記；整表重掛（tableKey）換了一個 el-table，重新看
let headerObserver: ResizeObserver | null = null
watch(() => (props.skeleton ? undefined : tableRef.value?.$el as HTMLElement | undefined), (root) => {
  headerObserver?.disconnect()
  headerObserver = null
  const header = root?.querySelector<HTMLElement>('.el-table__header-wrapper')
  if (!header || !headHint) return
  headerObserver = new ResizeObserver(() => {
    if (header.offsetHeight && props.rows.length) headHint.value = header.offsetHeight
  })
  headerObserver.observe(header)
}, { flush: 'post' })
onUnmounted(() => headerObserver?.disconnect())

// 最後一列：寫出總數（三組篩選共用，2026-10-15；原本寫死「…的股票」，ETF 不是股票）。沒有總數（觀察清單一段就是全部）不畫這一列
const endText = computed(() => (props.total !== undefined ? `已顯示全部 ${groupThousands(props.total)} 檔` : null))

// ---- 欄位設定：拖曳表頭與表頭小 × 的替代（WCAG 2.1.1／2.5.7），彈窗在 SharedColumnSettings（觀察清單共用）----
const columnSettingsOpen = ref(false)
// 卡片版面的「欄位 N 個」打開的是貼底面板（同篩選條件的面板），表格版面的「欄位設定」是置中的彈窗；兩個一樣是草稿、按儲存才套用
// （2026-11-09，使用者：「都改成草稿+儲存」；11/01 到這天「欄位 N 個」是每一步馬上套用）
const columnSettingsSheet = ref(false)
function openColumnSettings(sheet: boolean) {
  columnSettingsSheet.value = sheet
  columnSettingsOpen.value = true
}

// 彈窗按「儲存」：整份交給父層（saveColumns），表格先照新順序排——這張表保留自己的拖曳順序、不跟父層換順序
// （見 orderedColumns 的 watch），所以要在這裡換；新增的欄位先放名稱，父層的資料到了再補上。整份是沒釘住的那些，釘住的照舊排在前面
function saveColumns(columns: ColumnDraft[]) {
  emit('saveColumns', columns)
  applyLocalOrder(columns)
}
function saveFromSettings(columns: ColumnDraft[], close: () => void) {
  saveColumns(columns)
  close()
}
function applyLocalOrder(columns: ColumnDraft[]) {
  orderedColumns.value = [...pinnedColumns.value, ...columns.map(draft => orderedColumns.value.find(column => column.field === draft.field) ?? { field: draft.field, label: draft.label })]
  tableKey.value++
}

// ---- 表頭的欄位選單（SharedColumnMenu，2026-10-22）：點表頭打開，不直接排序 ----
// 表頭格裡任何地方點到都算（按鈕蓋不滿整格，格子的留白也要），在 el-table 自己的表頭點擊（會直接排序）之前就攔下來；
// 鍵盤在表頭按鈕上按 Enter／空白鍵也是一個 click
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
  if (!menuColumn.value || menuColumn.value.pinned || !props.editable) return undefined
  const index = movableColumns.value.indexOf(menuColumn.value)
  return { left: index > 0, right: index < movableColumns.value.length - 1 }
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
  // 只在沒釘住的欄之間移動：釘住的永遠在最前面
  const columns = movableColumns.value
  const index = columns.findIndex(column => column.field === field)
  if (index < 0) return
  if (action === 'remove') return removeFromMenu(columns[index]!)
  const target = action === 'left' ? index - 1 : action === 'right' ? index + 1 : action === 'start' ? 0 : columns.length - 1
  if (target === index || target < 0 || target >= columns.length) return
  const next = [...columns]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)
  orderedColumns.value = [...pinnedColumns.value, ...next]
  tableKey.value++
  emit('reorder', orderedColumns.value.map(column => column.field))
  menuStatus.value = `「${menuLabel.value}」移到第 ${pinnedColumns.value.length + target + 1} 欄`
  // 整表重掛換掉了表頭按鈕：焦點放回搬過去的那一欄
  focusHead(field)
}

// 移除這一欄：馬上拿掉、10 秒內可以復原（全站「可以復原的動作不先確認」；選單不是對話框，復原提示按得到）。整份欄位交給父層，
// 跟欄位設定彈窗同一條路（saveColumns）
function removeFromMenu(column: ScreenerResultTableColumn) {
  const previous = movableColumns.value.map(({ field, label }) => ({ field, label }))
  const next = previous.filter(item => item.field !== column.field)
  const label = displayLabel(column)
  saveColumns(next)
  undoToast(`已移除「${label}」欄`, () => saveColumns(previous), () => {})
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
      if (entries.some(entry => entry.isIntersecting) && props.hasMore && !props.loading && !props.loadingMore) emit('loadMore')
    }, { rootMargin: '200px 0px' })
    observer.observe(element)
  })
  // 查完也要重看：查詢途中碰到底的那一次沒有算，而排序是 20 列換 20 列，列數沒變、哨兵也還在畫面裡，就再也不會載下一頁
  // （2026-11-05，scripts/check-screener-load-more.mjs）
  watch([() => props.rows.length, () => props.loading], () => {
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
    <!-- 表格版面一列：顯示欄位＋欄位設定。卡片版面三列，比照設定區的「我的篩選」＋「篩選條件 N 個」（2026-11-01，使用者：「讓多條件或是
         多欄位的使用手感一樣」；10/31 試過的「檢視」面板同日拿掉）：顯示欄位一列、「欄位 N 個」一列（打開貼底面板，2026-11-09 起按儲存才套用）、
         排序＋方向一列。兩顆都在 DOM 裡、CSS 切換。欄位設定與欄位面板都是拖曳表頭換欄的鍵盤替代（WCAG 2.5.7）。排序選單只在卡片版面
         （容器 <720px）出現：卡片沒有表頭；表格的排序箭頭本身就是可聚焦的 button＋aria-sort，再放一個選單只是重複（2026-10-08 使用者同意） -->
    <div class="smt-toolbar">
      <div class="smt-toolbar__row">
        <!-- 呼叫端放在同一列最前面的控制項（篩選頁的「顯示欄位」選單，2026-10-15 跟欄位設定併成一列，結果表往上移） -->
        <slot name="toolbar" />
        <!-- el-button：跟同一列「顯示欄位」的＋新增同高（滑鼠 32px、觸控 44px） -->
        <el-button v-if="editable" class="smt-toolbar__settings" @click="openColumnSettings(false)">欄位設定</el-button>
      </div>
      <el-button v-if="editable" class="smt-columns-open" aria-haspopup="dialog" @click="openColumnSettings(true)">
        <span>欄位 {{ movableColumns.length }} 個</span><span class="smt-columns-open__chevron" aria-hidden="true" />
      </el-button>
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
      v-if="editable"
      v-model:open="columnSettingsOpen"
      :columns="movableColumns"
      :label-of="displayLabel"
      :categories="categories"
      :defaults="columnDefaults"
      :sheet="columnSettingsSheet"
      @save="saveFromSettings"
    />

    <!-- 窄的時候是卡片，寬的時候是表格；兩份都在 DOM 裡、由 CSS container query 切換（專案規則：不在
         渲染時用寬度選標記）。 -->
    <!-- click.capture：表頭點擊在 el-table 自己排序之前攔下來，改成打開欄位選單（onTableClickCapture） -->
    <div v-loading="loading" class="smt-table-view" @click.capture="onTableClickCapture">
    <!-- 骨架表（skeleton）：伺服器與瀏覽器畫一樣的；欄名照畫，值是骨架。表頭高、名稱欄寬是上次量到的（見 rememberLayout）。
         外框是呼叫端的卡片，這裡拿掉 SharedTable 自己那一層 -->
    <SharedTable
      v-if="skeleton"
      :ssr="false"
      :scrollable="false"
      table-class="smt-skeleton"
      class="smt-skeleton-card"
      :style="{ '--smt-skeleton-width': `${skeletonTotal}px` }"
      aria-hidden="true"
    >
      <colgroup>
        <col :style="{ width: skeletonShare(0) }">
        <col :style="{ width: skeletonShare(1) }">
        <col v-for="(column, index) in orderedColumns" :key="column.field" :style="{ width: skeletonShare(index + 2) }">
      </colgroup>
      <thead>
        <tr :class="{ 'smt-skeleton__pinned': skeletonHeadHeight }" :style="{ height: skeletonHeadHeight }">
          <th><span class="smt-skeleton__head smt-skeleton__head--start"><span>代號</span><span class="smt-skeleton__caret" /></span></th>
          <th><span class="smt-skeleton__head smt-skeleton__head--start"><span>名稱</span><span class="smt-skeleton__caret" /></span></th>
          <th v-for="column in orderedColumns" :key="column.field"><span class="smt-skeleton__head"><span class="smt-skeleton__caret" /><span>{{ displayLabel(column) }}</span></span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.symbol">
          <td><span class="app-skeleton app-skeleton--flow">2330</span></td>
          <td>
            <span class="smt-skeleton__name"><span class="app-skeleton app-skeleton--flow">台積電</span></span>
            <p v-if="noteOf?.(row.symbol)" class="smt-note"><span class="app-skeleton app-skeleton--flow">{{ noteOf(row.symbol) }}</span></p>
          </td>
          <td v-for="column in orderedColumns" :key="column.field" class="smt-skeleton__num"><span class="app-skeleton app-skeleton--flow">{{ column.sample ?? '00.00' }}</span></td>
        </tr>
      </tbody>
    </SharedTable>
    <el-table
      v-else
      :key="tableKey"
      ref="tableRef"
      class="screener-result-table"
      :class="{ 'screener-result-table--sticky': sticky, 'screener-result-table--first-load': loading && !rows.length }"
      :data="rows"
      row-key="symbol"
      scrollbar-always-on
      :default-sort="defaultSort"
      @sort-change="handleSortChange"
      @row-click="onRowClick"
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
          <NuxtLink :to="rowLink(row.symbol)" class="screener-result-table__name-link">{{ row.name }}</NuxtLink>
          <p v-if="noteOf?.(row.symbol)" class="smt-note">{{ noteOf(row.symbol) }}</p>
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
        :align="column.wide ? 'left' : 'right'"
        :class-name="column.wide ? 'screener-result-table__wide' : undefined"
        :min-width="minWidthFor(column)"
        :sortable="sortableFor(column.field)"
        :sort-method="sortMethodFor(column.field)"
        :sort-orders="sortOrdersFor(column.field)"
        :label-class-name="column.pinned ? undefined : headerClassFor(column, index - pinnedColumns.length)"
      >
        <template #header>
          <!-- 點表頭打開欄位選單（2026-10-22，SharedColumnMenu）：排序、移動、移除都在選單裡；表頭上沒有直接刪除的 X
               （2026-10-21 使用者拿掉的，一按就刪）。排序的箭頭是 SharedSortIcon，el-table 自己的箭頭藏起來（見 CSS） -->
          <button type="button" class="screener-result-table__head" :class="{ 'screener-result-table__head--start': column.wide }" :data-field="column.field" aria-haspopup="menu" :aria-expanded="menu.open && menu.field === column.field">
            <SharedSortIcon :state="activeSort.field === column.field ? activeSort.order : null" /><span class="screener-result-table__column-label">{{ displayLabel(column) }}</span><span class="visually-hidden">{{ sortStateText(column.field) }}</span>
          </button>
        </template>
        <template #default="{ row }">
          <component :is="cellHref(row, column) ? NuxtLink : 'div'" :to="cellHref(row, column) ?? undefined" class="screener-result-table__cell" :class="{ 'screener-result-table__cell--link': cellHref(row, column) }">
            <span v-if="riverZoneOf(column, row.values[column.field]?.value)" class="screener-result-table__zone" :class="riverZoneOf(column, row.values[column.field]?.value)!.textClass">
              <span class="screener-result-table__zone-track" :class="`screener-result-table__zone-track--${riverZoneOf(column, row.values[column.field]?.value)!.zone}`" :style="{ '--zone-color': riverZoneOf(column, row.values[column.field]?.value)!.color }" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>{{ formatValue(column, row) }}
            </span>
            <span v-else :class="textClassOf(column, row)">{{ formatValue(column, row) }}</span>
            <!-- The actual per-row knowledgeDate this specific number describes (renamed from
                 asOfDate 2026-09-14) — different symbols can legitimately show different dates
                 for the same field (e.g. one hasn't filed this quarter's report yet), so this
                 can't be hoisted up to the column header the way the period-type suffix above is. -->
            <span v-if="showCellDates && row.values[column.field]?.knowledgeDate" class="screener-result-table__cell-date">
              {{ cellPeriodText(row.values[column.field]!) }}
            </span>
          </component>
        </template>
      </el-table-column>
      <!-- 操作欄（觀察清單按「編輯」時的備註、移除）：固定在右邊，欄位多到要左右捲時按鈕也在畫面上 -->
      <el-table-column v-if="slots.actions" label="操作" fixed="right" width="150" class-name="smt-actions-cell">
        <template #default="{ row }">
          <div class="smt-actions"><slot name="actions" :row="row as ScreenerResultRow" /></div>
        </template>
      </el-table-column>
      <!-- Renders INSIDE el-table's body, after the last data row — reads as the table's own
           last row. observeSentinel (script) watches it against the viewport. Only shown once
           there are any results at all (an empty table has nothing to paginate through). -->
      <template v-if="rows.length > 0 && (hasMore || endText)" #append>
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
      :removable="!!menuColumn && !menuColumn.pinned && editable"
      @action="onColumnMenu"
    />
    <p class="visually-hidden" role="status">{{ menuStatus }}</p>
    </div>

    <div v-loading="loading" class="smt-cards-view">
      <!-- 骨架卡片：跟真的卡片同一套結構與欄名，值是骨架（跟真的值一樣長，見 column.sample），高度就一樣 -->
      <ul v-if="skeleton" class="smt-cards" aria-hidden="true">
        <li v-for="row in rows" :key="row.symbol" class="app-card smt-card">
          <div class="smt-card__head">
            <span class="app-skeleton app-skeleton--flow">台積電</span>
            <span class="smt-card__code"><span class="app-skeleton app-skeleton--flow">2330</span></span>
          </div>
          <p v-if="noteOf?.(row.symbol)" class="smt-card__note"><span class="app-skeleton app-skeleton--flow">{{ noteOf(row.symbol) }}</span></p>
          <dl v-if="orderedColumns.length" class="smt-card__values">
            <div v-for="column in orderedColumns" :key="column.field" class="smt-card__value">
              <dt>{{ displayLabel(column) }}</dt>
              <dd><span class="app-skeleton app-skeleton--flow">{{ column.sample ?? '00.00' }}</span></dd>
            </div>
          </dl>
        </li>
      </ul>
      <p v-else-if="!rows.length" class="smt-cards__empty">目前沒有資料</p>
      <ul v-else class="smt-cards" :aria-label="`共 ${rows.length} 檔已載入`">
        <li v-for="row in cardRows" :key="row.symbol" class="app-card smt-card">
          <div class="smt-card__head">
            <NuxtLink :to="rowLink(row.symbol)" class="screener-result-table__name-link">{{ row.name }}</NuxtLink>
            <span class="smt-card__code">{{ row.symbol }}</span>
          </div>
          <p v-if="noteOf?.(row.symbol)" class="smt-card__note">{{ noteOf(row.symbol) }}</p>
          <dl v-if="orderedColumns.length" class="smt-card__values">
            <div v-for="column in orderedColumns" :key="column.field" class="smt-card__value">
              <dt>{{ displayLabel(column) }}</dt>
              <dd>
                <component :is="cellHref(row, column) ? NuxtLink : 'span'" :to="cellHref(row, column) ?? undefined" class="smt-card__cell" :class="{ 'screener-result-table__cell--link': cellHref(row, column) }">
                <span v-if="riverZoneOf(column, row.values[column.field]?.value)" class="screener-result-table__zone" :class="riverZoneOf(column, row.values[column.field]?.value)!.textClass">
                  <span class="screener-result-table__zone-track" :class="`screener-result-table__zone-track--${riverZoneOf(column, row.values[column.field]?.value)!.zone}`" :style="{ '--zone-color': riverZoneOf(column, row.values[column.field]?.value)!.color }" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>{{ formatValue(column, row) }}
                </span>
                <span v-else :class="textClassOf(column, row)">{{ formatValue(column, row) }}</span>
                <span v-if="showCellDates && row.values[column.field]?.knowledgeDate" class="screener-result-table__cell-date">{{ cellPeriodText(row.values[column.field]!) }}</span>
                </component>
              </dd>
            </div>
          </dl>
          <div v-if="slots.actions" class="smt-card__actions"><slot name="actions" :row="row" /></div>
        </li>
      </ul>
      <template v-if="!skeleton && rows.length > 0">
        <div v-if="hasMore" ref="cardSentinelRef" class="screener-result-table__load-more">
          <el-icon v-if="loadingMore" class="screener-result-table__load-more-spinner"><Loading /></el-icon>
          <span>{{ loadingMore ? '載入更多…' : '' }}</span>
        </div>
        <p v-else-if="endText" class="screener-result-table__load-more screener-result-table__load-more--end">{{ endText }}</p>
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

/* 卡片版面：「欄位設定」換成「欄位 N 個」（兩個 class：蓋過 Element 的 .el-button { display: inline-flex }） */
.smt-toolbar .smt-toolbar__settings {
  display: none;
}

@container (min-width: 720px) {
  .screener-result-table-wrap--cards .smt-table-view {
    display: flex;
  }

  .smt-toolbar .smt-toolbar__settings {
    display: inline-flex;
  }

  .smt-cards-view,
  /* 兩個 class：同特異性時排在後面的 .smt-toolbar__row { display: flex } 會贏 */
  .smt-toolbar .smt-toolbar__sort,
  .smt-toolbar .smt-columns-open {
    display: none;
  }
}

/* 「欄位 N 個」：同設定區的「篩選條件 N 個」（ScreenerPageShell 的 .screener-shell__conditions-open） */
.smt-columns-open {
  justify-content: space-between;
  width: 100%;
  min-height: 44px;
  margin: 0;
}

.smt-columns-open :deep(> span) {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
}

.smt-columns-open__chevron {
  width: 8px;
  height: 8px;
  border-right: 2px solid currentcolor;
  border-bottom: 2px solid currentcolor;
  transform: rotate(-45deg);
}

/* minmax(0, 1fr)：auto 欄寬的下限是內容的最小寬度，原生選單的最小寬度是最長的選項——欄位名一長，兩列一起撐出畫面（375 寬量到右緣 452） */
.smt-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

/* flex-start：「存成我的欄位組合」出現時顯示欄位那一組會換成兩行，欄位設定對齊第一行的選單。
   相鄰的控制項一律 8px（2026-11-02 排序／大到小，使用者：「排序與 大到小 中間的間距 要調整」；2026-11-08 管理／欄位設定原本 12px，
   使用者：「篩選 UI 組合的間距跑掉了」）：scripts/check-screener-spacing.mjs */
.smt-toolbar__row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
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

/* pretty：欄名太長要折行時不留一兩個字在第二行。ETF 的「近1年報酬率 2026-09」原本折成「…2026-」與「09」（2026-11-08 量到，
   Chrome 在中文裡會在連字號後面斷），「近12個月總費用率估算」的「算」也不再自己一行 */
.smt-card__value dt {
  color: var(--el-text-color-secondary);
  text-wrap: pretty;
}

.smt-card__value dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* 數值一行、資料時間另起一行（同表格的格子）。原本是行內的 span，「顯示資料時間」一開，日期直接黏在數字後面：38.1 跟
   2026-11-02 連成「38.12026-11-02」（2026-11-02，使用者：「打開資料時間以後整個悲劇跑版」） */
.smt-card__cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  .screener-result-table__cell-date {
    font-weight: 400;
  }
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

.screener-result-table :deep(td.screener-result-table__wide .cell) {
  white-space: normal;
}

.screener-result-table :deep(td.screener-result-table__wide .screener-result-table__cell) {
  align-items: flex-start;
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

/* 有頁的格子（cellLink）：同名稱連結，平常跟一般格子一樣，滑過或聚焦才畫底線 */
.screener-result-table__cell--link {
  color: inherit;
  text-decoration: none;
  /* 24px（WCAG 2.5.8）比一行字高：字置中，才跟旁邊沒有連結的格子對齊 */
  min-height: 24px;
  justify-content: center;
}

.screener-result-table__cell--link:hover,
.screener-result-table__cell--link:focus-visible {
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

/* 第一次讀、還沒有任何一列時表格先不畫（位置照留，遮罩照轉）：名稱欄跟著資料寬（nameWidth），列到了才知道多寬。原本先畫表頭，
   列一到名稱欄變寬、右邊的欄被擠窄、欄名多折一行，表頭長高、整個表身往下推（2026-10-24 正式建置 ETF 1440 寬量到 0.026：名稱欄
   78→152px、表頭 63→86px）。遮罩本來就是九成白，表頭讀的時候也幾乎看不到。換條件重查時舊的列留著，不會走到這裡 */
.screener-result-table--first-load {
  visibility: hidden;
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
  border-radius: var(--el-border-radius-base);
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

/* ---- 觀察清單（2026-11-11）：名稱下面的備註、操作欄、骨架 ---- */
/* 備註：表格一行、放不下用刪節號（名稱欄寬照名稱量，備註不撐寬）；卡片最多兩行 */
.smt-note {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.smt-card__note {
  display: -webkit-box;
  margin: -4px 0 8px;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* 並排的按鈕 8px（全站規則）；Element 的 .el-button + .el-button 另有 12px 左邊距 */
.smt-actions,
.smt-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* 文字按鈕也有 44px 的觸控範圍（同原本觀察清單的操作欄） */
.smt-actions :deep(.el-button),
.smt-card__actions :deep(.el-button) {
  min-width: 44px;
  min-height: 44px;
  margin: 0;
}

.smt-card__actions {
  margin-top: 8px;
}

/* 骨架表：外框是呼叫端的卡片，SharedTable 自己那一層拿掉。格子照 el-table 的高（上下 8px、23px 行高，名稱連結 24px）。欄寬照 el-table 的分法估
   （skeletonWidths），容器比欄寬加起來窄時跟 el-table 一樣寬、一樣左右捲；容器比較寬時代號、名稱也跟著放大，跟 el-table 差一點，所以值不折行。
   欄名記下表頭高之後釘住、不折行（headerObserver），第一次來照表頭按鈕的結構折行 */
.smt-skeleton-card {
  border: 0;
  border-radius: 0;
  background: none;
}

/* 線不合併（同 el-table）：合併的線一半算在上一列、一半算在下一列，釘住的表頭高與列高各差半格，整段矮 1px（2026-11-11 量到） */
.smt-skeleton-card :deep(.smt-skeleton) {
  table-layout: fixed;
  width: max(100%, var(--smt-skeleton-width));
  border-collapse: separate;
  border-spacing: 0;
}

.smt-skeleton-card th,
.smt-skeleton-card td {
  padding-block: 8px;
  line-height: 23px;
}

.smt-skeleton-card td {
  overflow: hidden;
  white-space: nowrap;
}

.smt-skeleton-card th {
  vertical-align: bottom;
}

.smt-skeleton__num {
  text-align: right;
}

/* 同表頭按鈕（.screener-result-table__head）：排序圖示一格、欄名在旁邊折行，至少 32px 高 */
.smt-skeleton__head {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-height: 32px;
  padding: 0 4px;
  text-align: right;
}

.smt-skeleton__head--start {
  justify-content: flex-start;
  text-align: left;
}

.smt-skeleton__head > span:not(.smt-skeleton__caret) {
  min-width: 0;
  overflow-wrap: anywhere;
}

.smt-skeleton__pinned .smt-skeleton__head > span:not(.smt-skeleton__caret) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smt-skeleton__caret {
  flex: none;
  width: 24px;
  height: 24px;
}

.smt-skeleton__name {
  display: block;
  min-height: 24px;
}

</style>
