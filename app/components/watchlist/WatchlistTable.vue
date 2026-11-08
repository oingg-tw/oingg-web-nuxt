<script setup lang="ts">
import type { ScreenerResultTableColumn } from '~/components/shared/SharedMetricTable.vue'
import type { SheetColumn } from '~/components/shared/SharedSheetGrid.vue'
import type { SortableColumn } from '~/components/shared/SharedSortableTable.vue'
import type { WatchlistRow } from '~/composables/watchlist/useWatchlistStocks'

// 觀察清單的表格（2026-10-19 從 pages/watchlist/index.vue 抽出來，/watchlist 與分享頁 /share/[token] 共用，
// 兩邊長一樣）。電腦版是 SharedSheetGrid（試算表手感：點格子是選取、Enter 或點名稱進個股頁、框選後 Ctrl+C），
// 1279px 以下是對齊的四欄表。資料（rows）由呼叫端用 useWatchlistStocks 抓，這裡只管怎麼畫。
// 操作欄（備註、移除）：actions 為 true 才有那一欄（/watchlist 按「編輯」才有），按鈕由呼叫端的 #actions 給。
const props = withDefaults(defineProps<{
  rows: WatchlistRow[]
  columns: ScreenerResultTableColumn[]
  // 代號 → 備註，有才畫在名稱下面
  notes?: Record<string, string>
  // 欄寬存在瀏覽器裡的鍵（SharedSheetGrid）；分享頁另用一個，不動到自己清單的欄寬
  storageKey?: string
  // 表格的可及名稱（分段時每張表要分得開）
  label?: string
  // 拖表頭換欄位順序（emit reorder，呼叫端決定存不存）
  movable?: boolean
  actions?: boolean
  // 資料還沒到（2026-10-20，使用者：「載入之前，可以讓用戶看的出來畫面結構」「然後不要閃動」）：rows 是呼叫端給的空列（列數照上次），
  // 表頭照畫，名稱與數字是骨架；操作鈕由呼叫端依 slot 的 loading 停用
  loading?: boolean
}>(), { notes: () => ({}), storageKey: 'watchlist', label: '觀察清單', movable: false, actions: false, loading: false })
const emit = defineEmits<{ reorder: [fields: string[]], removeColumn: [field: string] }>()
defineSlots<{
  toolbar?: () => unknown
  actions?: (props: { row: WatchlistRow; loading: boolean }) => unknown
}>()

const { data: schema } = useFilterSchema()
const { routeFor } = useStockSearch()

const KIND_TAG = { etf: 'ETF', preferred: '特別股', common: null } as const
const ACTIONS = '__actions'
const linkOf = (row: WatchlistRow) => routeFor({ code: row.code, name: row.name, kind: row.kind })
const isFixed = (field: string) => WATCHLIST_FIXED_COLUMNS.some(fixed => fixed.field === field)

const signed = (value: number, text: string) => minusSign(`${value > 0 ? '+' : ''}${text}`)
const changeText = (row: WatchlistRow) =>
  row.change === null || row.changePercent === null ? '－' : `${signed(row.change, row.change.toFixed(2))} (${signed(row.changePercent, row.changePercent.toFixed(2))}%)`
const changePercentText = (row: WatchlistRow) => (row.changePercent === null ? '－' : `${signed(row.changePercent, row.changePercent.toFixed(2))}%`)
const exDividendText = (row: WatchlistRow) => {
  const event = row.nextDividendEvent
  if (!event) return '－'
  const amount = dividendEventAmount(event)
  return `${event.date.slice(5).replace('-', '/')} ${dividendEventLabel(event)}${amount ? ` ${amount}` : ''}`
}
// 表格與手機同一套格式化：ETF、特別股的欄位帶自己的 format（來源同篩選），普通股走 formatScreenerValue
function cellText(row: WatchlistRow, { field, format }: ScreenerResultTableColumn): string {
  if (field === WATCHLIST_CHANGE) return changeText(row)
  if (field === WATCHLIST_EX_DIVIDEND) return exDividendText(row)
  if (format) return format(row.values[field]?.value)
  const located = locateFieldInSchema(schema.value.categories, field)
  return formatScreenerValue(row.values[field]?.value, located?.field.unit, field, located?.metric.options)
}
const rawNumber = (row: WatchlistRow, field: string) => numericValue(row.values[field]?.value)
// 排序用的值，試算表與手機共用：漲跌照漲跌幅、除息／發放照日期，其餘有數字照數字
const sortValueOf = (field: string) => (row: WatchlistRow) =>
  field === WATCHLIST_CHANGE ? row.changePercent : field === WATCHLIST_EX_DIVIDEND ? row.nextDividendEvent?.date ?? null : rawNumber(row, field) ?? row.values[field]?.value ?? null

// ---- 試算表的欄位（SharedSheetGrid）----
// 代號與名稱凍結在左邊；型錄欄位畫面上照 formatScreenerValue，複製出去的是原始數字（百分比換成比例並帶 Excel 的 0.00% 格式，
// 貼進 Excel 是真的數字）。漲跌一格裡有金額與漲跌幅兩個數，複製照畫面上的字。操作欄不複製。
const sheetColumns = computed<SheetColumn<WatchlistRow>[]>(() => [
  // 這三欄的 widthSample：骨架沒有內容，欄寬只看欄名，資料到了才撐開會讓後面整排左右移；每一段的固定欄也才對得齊
  { key: 'code', label: '代號', frozen: true, text: row => row.code, widthSample: '00631L', sortValue: row => row.code },
  { key: 'name', label: '名稱', frozen: true, rowHeader: true, width: 190, text: row => row.name, sortValue: row => row.name },
  ...props.columns.map((column): SheetColumn<WatchlistRow> => {
    // 收盤價、漲跌、除息／發放是固定欄（2026-11-06）：排在最前面、不能移動或移除，後面才是選的欄位組合。不凍結：左邊只凍結代號與名稱，
    // 五欄都凍結的話 1440 寬只剩 440px 捲動，移除鈕要捲很遠
    const pinned = isFixed(column.field)
    // 表頭的欄位選單（2026-10-22）：自己的清單（movable）從選單移除；分享頁只能排序
    const removable = props.movable && !pinned
    const sortValue = sortValueOf(column.field)
    // 複製給漲跌幅的比例（Excel 是真的數字、格式 0.00%）：畫面上那串「+85.00 (+2.04%)」開頭是正負號，貼進 Excel 會被當成公式
    if (column.field === WATCHLIST_CHANGE) return { key: column.field, label: column.label, pinned, removable, numeric: true, text: changeText, widthSample: '-000.00 (-0.00%)', value: row => (row.changePercent === null ? null : row.changePercent / 100), excelFormat: '0.00%', sortValue }
    if (column.field === WATCHLIST_EX_DIVIDEND) return { key: column.field, label: column.label, pinned, removable, text: exDividendText, widthSample: '00/00 除息 0.0000 元', sortValue, sortFirst: 'ascending' }
    const located = locateFieldInSchema(schema.value.categories, column.field)
    const percent = located?.field.unit === '%'
    return {
      key: column.field,
      label: column.label,
      pinned,
      removable,
      description: located?.field.description || located?.metric.description || undefined,
      numeric: props.rows.some(row => rawNumber(row, column.field) !== null),
      text: row => cellText(row, column),
      value: (row) => {
        const value = rawNumber(row, column.field)
        return value === null ? null : percent ? value / 100 : value
      },
      excelFormat: percent ? '0.00%' : undefined,
      sortValue
    }
  }),
  ...(props.actions ? [{ key: ACTIONS, label: '操作', text: () => '', copyable: false, width: 150 }] : [])
])
// 表頭拖曳回傳整列 key（含凍結欄與操作欄），只留真的欄位
const reorderFromSheet = (keys: string[]) => emit('reorder', keys.filter(key => props.columns.some(column => column.field === key)))

// ---- 1279px 以下：對齊的四欄（2026-11-07，使用者看過觀察清單改版方案頁，選 A）----
// 原本一檔一張卡片、欄名一列一項（10/22 方案頁 4B），每張卡片重複同一組欄名，5 檔就 2,787px 高；11/04 使用者說這種排法「亂亂的」。
// 現在同 /industries/dividend 的手機表（IndustryQuadrantTables）：名稱｜收盤價｜漲跌｜一欄可以換，欄名只在表頭；點表頭排序（SharedSortableTable，
// 取代原本的排序選單）。可以換的是這一類的欄位組合，除息／發放排最後：預設的那一欄要每列都有值，除息／發放只有已公告、還沒到的才有，其他列是「－」（11-08 上面那塊「接下來」拿掉時重看過，順序不動）
const picks = computed(() => [...props.columns.filter(column => !isFixed(column.field)), ...props.columns.filter(column => column.field === WATCHLIST_EX_DIVIDEND)])
const pickedField = ref('')
const picked = computed(() => picks.value.find(column => column.field === pickedField.value) ?? picks.value[0])
const compactColumns = computed<SortableColumn<WatchlistRow>[]>(() => [
  { key: 'name', label: '名稱' },
  // 漲跌只寫漲跌幅：金額放不下，正負號與 % 看得出是哪一個。編輯時讓出位子給備註、移除，名稱才不會被擠成一欄三個字
  ...props.columns.filter(column => column.field === 'stock.price' || (column.field === WATCHLIST_CHANGE && !props.actions))
    .map(column => ({ key: column.field, label: column.label, num: true, sortValue: sortValueOf(column.field) })),
  ...(props.actions
    ? [{ key: ACTIONS, label: '操作', num: true }]
    : picked.value ? [{ key: picked.value.field, label: picked.value.label, num: true, sortValue: sortValueOf(picked.value.field) }] : [])
])
</script>

<template>
  <!-- 工具列：按鈕由呼叫端放進 #toolbar -->
  <div class="watchlist-toolbar">
    <slot name="toolbar" />
  </div>
  <div class="view-table">
    <SharedSheetGrid
      :rows="rows"
      :columns="sheetColumns"
      :row-key="row => row.code"
      :label="label"
      :storage-key="storageKey"
      enter-action="activate"
      :movable="movable"
      column-menu
      @activate="row => navigateTo(linkOf(row))"
      @reorder="reorderFromSheet"
      @remove-column="field => emit('removeColumn', field)"
    >
      <template #cell="{ row, column, text }">
        <div v-if="column.key === ACTIONS" class="watchlist-row-actions">
          <slot name="actions" :row="row" :loading="loading" />
        </div>
        <template v-else-if="loading">
          <span class="app-skeleton app-skeleton--inline watchlist-skeleton" aria-hidden="true" />
          <p v-if="column.key === 'name' && notes[row.code]" class="watchlist-note" aria-hidden="true"><span class="app-skeleton app-skeleton--flow">{{ notes[row.code] }}</span></p>
        </template>
        <template v-else-if="column.key === 'name'">
          <div class="watchlist-name">
            <NuxtLink :to="linkOf(row)" :title="row.name" class="stock-name-link">{{ row.name }}</NuxtLink>
            <el-tag v-if="KIND_TAG[row.kind]" size="small" effect="plain">{{ KIND_TAG[row.kind] }}</el-tag>
          </div>
          <p v-if="notes[row.code]" class="watchlist-note">{{ notes[row.code] }}</p>
        </template>
        <span v-else-if="column.key === WATCHLIST_CHANGE" :class="priceDirectionClass(row.change)">{{ text }}</span>
        <template v-else>{{ text }}</template>
      </template>
    </SharedSheetGrid>
  </div>

  <div class="view-card watchlist-compact">
    <!-- 最右欄換哪一個數字：全站的晶片，左右滑（同 /rank/[slug] 手機的換指標）；編輯時最右欄是操作，不用換 -->
    <div v-if="!actions && picks.length > 1" class="watchlist-picks" role="group" :aria-label="`${label}最右欄的數字`">
      <button v-for="column in picks" :key="column.field" type="button" class="hub-chip watchlist-picks__chip" :aria-pressed="column.field === picked?.field" @click="pickedField = column.field">{{ column.label }}</button>
    </div>
    <SharedSortableTable :rows="rows" :columns="compactColumns" :row-key="row => row.code" :label="label" table-class="watchlist-compact-table">
      <template #row="{ row }">
        <th scope="row">
          <template v-if="loading">
            <span class="watchlist-compact__name" aria-hidden="true"><span class="app-skeleton app-skeleton--flow">台積電</span></span>
            <span class="watchlist-compact__code" aria-hidden="true"><span class="app-skeleton app-skeleton--flow">2330</span></span>
            <p v-if="notes[row.code]" class="watchlist-note" aria-hidden="true"><span class="app-skeleton app-skeleton--flow">{{ notes[row.code] }}</span></p>
          </template>
          <template v-else>
            <!-- 代號也在連結裡：手指點得到的範圍是名稱加代號兩行高 -->
            <NuxtLink :to="linkOf(row)" class="stock-name-link watchlist-compact__name">{{ row.name }} <span class="watchlist-compact__code">{{ row.code }}</span></NuxtLink>
            <p v-if="notes[row.code]" class="watchlist-note">{{ notes[row.code] }}</p>
          </template>
        </th>
        <td v-for="column in compactColumns.slice(1)" :key="column.key" class="seo-table__num">
          <div v-if="column.key === ACTIONS" class="watchlist-row-actions">
            <slot name="actions" :row="row" :loading="loading" />
          </div>
          <span v-else-if="loading" class="app-skeleton app-skeleton--inline watchlist-compact__skeleton" aria-hidden="true" />
          <span v-else-if="column.key === WATCHLIST_CHANGE" :class="priceDirectionClass(row.change)">{{ changePercentText(row) }}</span>
          <!-- 除息／發放折成兩行：日期與種類一行、金額一行，欄才不會被整串字撐寬 -->
          <template v-else-if="column.key === WATCHLIST_EX_DIVIDEND && row.nextDividendEvent">
            <span class="watchlist-compact__line">{{ row.nextDividendEvent.date.slice(5).replace('-', '/') }} {{ dividendEventLabel(row.nextDividendEvent) }}</span>
            <span v-if="dividendEventAmount(row.nextDividendEvent)" class="watchlist-compact__line">{{ dividendEventAmount(row.nextDividendEvent) }}</span>
          </template>
          <template v-else>{{ cellText(row, columns.find(item => item.field === column.key)!) }}</template>
        </td>
      </template>
    </SharedSortableTable>
  </div>
</template>

<style scoped>
.watchlist-skeleton {
  width: 4.5em;
}

.watchlist-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.watchlist-note {
  margin: 4px 0 0;
  color: var(--el-text-color-regular);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.watchlist-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.watchlist-row-actions :deep(.el-button) {
  min-width: 44px;
  min-height: 44px;
  margin: 0;
}

.watchlist-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 12px;
}

.watchlist-toolbar:empty {
  display: none;
}

/* 表格裡的名稱格不折行：名稱太長用刪節號（完整名稱在 title），備註只留一行。其餘欄位的不折行在 SharedSheetGrid。 */
.view-table .watchlist-name {
  flex-wrap: nowrap;
}

.view-table .watchlist-name a,
.view-table .watchlist-note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.view-card {
  display: none;
}

/* 晶片一列左右滑；上下留 4px，焦點框才不會被捲動區裁掉 */
.watchlist-picks {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  margin: -4px -4px 8px;
  padding: 4px;
  scrollbar-width: none;
}

.watchlist-picks::-webkit-scrollbar {
  display: none;
}

.watchlist-picks__chip {
  flex-shrink: 0;
  white-space: nowrap;
}

.watchlist-compact__name,
.watchlist-compact__code,
.watchlist-compact__line {
  display: block;
}

.watchlist-compact__code {
  font-weight: 400;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

/* 連結裡的代號自己一行；inline-block 擋住名稱滑過時的底線 */
a.watchlist-compact__name .watchlist-compact__code {
  display: inline-block;
  width: 100%;
}

/* 備註在名稱欄裡最多兩行，整句在編輯的備註對話框 */
.watchlist-compact .watchlist-note {
  display: -webkit-box;
  overflow: hidden;
  font-weight: 400;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.watchlist-compact__skeleton {
  width: 3em;
}

.watchlist-compact .watchlist-row-actions {
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 8px;
}

/* 四欄要在 320px 寬放得下（同 IndustryQuadrantTables）：數字欄貼著內容靠右、名稱欄吃掉其餘的寬（至少三個字），欄與欄之間 8px（全站 24px）。
   只有名稱可以折；最右欄的欄名只在空白處折（規模 2026-09），不拆開一個詞（本益比）。欄名特別長時（近12個月總費用率估算）整張表在自己的捲動區裡左右捲 */
.watchlist-compact :deep(.watchlist-compact-table tbody th) {
  white-space: normal;
}

/* 至少三個字寬：表格格子本身的 min-width 瀏覽器不理，寫在格子裡的名稱上 */
.watchlist-compact__name {
  min-width: 3em;
}

.watchlist-compact :deep(.watchlist-compact-table :is(th, td):not(:first-child)) {
  width: 1%;
  padding-left: 8px;
}

.watchlist-compact :deep(.watchlist-compact-table :is(th, td):not(:last-child)) {
  padding-right: 0;
}

.watchlist-compact :deep(.watchlist-compact-table tbody th) {
  padding-right: 8px;
}

.watchlist-compact :deep(.watchlist-compact-table td:last-child) {
  min-width: 4.5rem;
}

.watchlist-compact :deep(.watchlist-compact-table thead th:last-child .sortable-table__button) {
  white-space: normal;
  word-break: keep-all;
  text-align: right;
}

/* 表格／手機的切換點 1279px，跟持股頁同一個（2026-10-05「a11y 要求放大 200% 也不可以跑版」）：1280 寬的
   左側欄會吃掉表格的寬度，1024～1279 之間 7 欄放不下。 */
@media (max-width: 1279px) {
  .view-table {
    display: none;
  }

  .view-card {
    display: block;
  }
}
</style>
