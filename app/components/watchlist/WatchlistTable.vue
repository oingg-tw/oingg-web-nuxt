<script setup lang="ts">
import type { ScreenerResultTableColumn } from '~/components/shared/SharedMetricTable.vue'
import type { SheetColumn } from '~/components/shared/SharedSheetGrid.vue'
import type { WatchlistRow } from '~/composables/watchlist/useWatchlistStocks'

// 觀察清單的表格與卡片（2026-10-19 從 pages/watchlist/index.vue 抽出來，/watchlist 與分享頁 /share/[token] 共用，
// 兩邊長一樣）。電腦版是 SharedSheetGrid（試算表手感：點格子是選取、Enter 或點名稱進個股頁、框選後 Ctrl+C），
// 1279px 以下是卡片加排序選單。資料（rows）由呼叫端用 useWatchlistStocks 抓，這裡只管怎麼畫。
// 操作欄（備註、移除）：actions 為 true 才有那一欄，按鈕由呼叫端的 #actions 給（view 是 table 或 card，兩種版面的按鈕樣式不同）。
const props = withDefaults(defineProps<{
  rows: WatchlistRow[]
  columns: ScreenerResultTableColumn[]
  // 代號 → 備註，有才畫在名稱下面
  notes?: Record<string, string>
  // 卡片排序選單第一項（清單本身的順序）的名稱，例如「加入順序」
  orderLabel: string
  // 欄寬存在瀏覽器裡的鍵（SharedSheetGrid）；分享頁另用一個，不動到自己清單的欄寬
  storageKey?: string
  // 拖表頭換欄位順序（emit reorder，呼叫端決定存不存）
  movable?: boolean
  actions?: boolean
  // 給了就在工具列放下載（檔名前半段）
  downloadName?: string
  // 資料還沒到（2026-10-20，使用者：「載入之前，可以讓用戶看的出來畫面結構」「然後不要閃動」）：rows 是呼叫端給的空列（列數照上次），
  // 表頭、卡片上的欄名照畫，名稱與數字是骨架；操作鈕由呼叫端依 slot 的 loading 停用，不能下載
  loading?: boolean
}>(), { notes: () => ({}), storageKey: 'watchlist', movable: false, actions: false, downloadName: undefined, loading: false })
const emit = defineEmits<{ reorder: [fields: string[]] }>()
defineSlots<{
  toolbar?: () => unknown
  settings?: () => unknown
  actions?: (props: { row: WatchlistRow; view: 'table' | 'card'; loading: boolean }) => unknown
}>()

const { data: schema } = useFilterSchema()
const { routeFor } = useStockSearch()

const KIND_TAG = { etf: 'ETF', preferred: '特別股', common: null } as const
const linkOf = (row: WatchlistRow) => routeFor({ code: row.code, name: row.name, kind: row.kind })

const changeText = (row: WatchlistRow) =>
  row.change === null || row.changePercent === null
    ? '—'
    : `${row.change > 0 ? '+' : ''}${row.change.toFixed(2)} (${row.changePercent > 0 ? '+' : ''}${row.changePercent.toFixed(2)}%)`
// 「除息／發放」：還沒除息的寫除息日，已除息、還沒發放的寫發放日（2026-10-06 上游補上 realized 那幾筆之後
// 才寫得出來）——除息日與發放日分開標，現金大約在除息後 3～4 週才入帳（conductor 知識庫「配息月曆結算時序」）。
// 金額最多四位小數：上游的浮點數會帶雜訊（2330 回 7.00000137，MOPS 原值未四捨五入）。
const exDividendText = (row: WatchlistRow) => {
  const event = row.nextDividendEvent
  if (!event) return '—'
  const date = event.date.slice(5).replace('-', '/')
  const label = event.kind === 'stock' ? '配股發放' : event.kind === 'pay' ? '發放' : EX_TYPE_LABELS[event.exType] ?? event.exType
  return `${date} ${label}${event.amount !== null ? ` ${Number(event.amount.toFixed(4))} 元` : ''}`
}
// 卡片用：同一套格式化（型錄欄位走 formatScreenerValue，跟表格一致）
function cellText(row: WatchlistRow, field: string): string {
  if (field === WATCHLIST_CHANGE) return changeText(row)
  if (field === WATCHLIST_EX_DIVIDEND) return exDividendText(row)
  const located = locateFieldInSchema(schema.value.categories, field)
  return formatScreenerValue(row.values[field]?.value, located?.field.unit, field, located?.metric.options)
}
// ---- 試算表的欄位（SharedSheetGrid）----
// 代號與名稱凍結在左邊；型錄欄位畫面上照 formatScreenerValue，複製出去的是原始數字（百分比換成比例並帶 Excel 的 0.00% 格式，
// 貼進 Excel 是真的數字）。漲跌一格裡有金額與漲跌幅兩個數，複製照畫面上的字。操作欄不複製。
const rawNumber = (row: WatchlistRow, field: string) => {
  const raw = row.values[field]?.value
  const value = Number(raw)
  return raw == null || raw === '' || !Number.isFinite(value) ? null : value
}
const sheetColumns = computed<SheetColumn<WatchlistRow>[]>(() => [
  { key: 'code', label: '代號', frozen: true, text: row => row.code, sortValue: row => row.code },
  { key: 'name', label: '名稱', frozen: true, rowHeader: true, width: 190, text: row => row.name, sortValue: row => row.name },
  ...props.columns.map((column): SheetColumn<WatchlistRow> => {
    // 複製與下載給漲跌幅的比例（Excel 是真的數字、格式 0.00%）：畫面上那串「+85.00 (+2.04%)」開頭是正負號，下載時會被當成公式擋掉（toCsv）
    if (column.field === WATCHLIST_CHANGE) return { key: column.field, label: column.label, numeric: true, text: changeText, widthSample: '-00.00 (-0.00%)', value: row => (row.changePercent === null ? null : row.changePercent / 100), excelFormat: '0.00%', sortValue: row => row.changePercent }
    if (column.field === WATCHLIST_EX_DIVIDEND) return { key: column.field, label: column.label, text: exDividendText, sortValue: row => row.nextDividendEvent?.date ?? null, sortFirst: 'ascending' }
    const located = locateFieldInSchema(schema.value.categories, column.field)
    const unit = located?.field.unit
    const percent = unit === '%'
    return {
      key: column.field,
      label: column.label,
      numeric: props.rows.some(row => rawNumber(row, column.field) !== null),
      text: row => formatScreenerValue(row.values[column.field]?.value, unit, column.field, located?.metric.options),
      value: (row) => {
        const value = rawNumber(row, column.field)
        return value === null ? null : percent ? value / 100 : value
      },
      excelFormat: percent ? '0.00%' : undefined,
      sortValue: row => rawNumber(row, column.field) ?? row.values[column.field]?.value ?? null
    }
  }),
  ...(props.actions ? [{ key: '__actions', label: '操作', text: () => '', copyable: false, width: 150 }] : [])
])
// 表頭拖曳回傳整列 key（含凍結欄與操作欄），只留真的欄位
const reorderFromSheet = (keys: string[]) => emit('reorder', keys.filter(key => props.columns.some(column => column.field === key)))

// ---- 手機卡片的排序（2026-10-08「與其說調整順序，不如說調整排序」）----
// 手動上移／下移整個拿掉：電腦版點表頭排序（SharedSheetGrid），手機卡片沒有表頭，用這兩個選單排
// 同一組欄位。沒有值的一律排最後，不管方向；預設是清單本身的順序。
const cardSortField = ref('')
const cardSortOrder = ref<'descending' | 'ascending'>('descending')
const sortedCards = computed(() => {
  const field = cardSortField.value
  if (!field) return props.rows
  const sign = cardSortOrder.value === 'ascending' ? 1 : -1
  return [...props.rows].sort((a, b) => {
    const x = a.values[field]?.value ?? null
    const y = b.values[field]?.value ?? null
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
    return sign * compareFieldValues(x, y)
  })
})
</script>

<template>
  <!-- 表格與卡片共用的工具列：卡片模式多了排序選單（卡片沒有表頭）；其他按鈕由呼叫端放進 #toolbar -->
  <div class="watchlist-toolbar">
    <div v-if="rows.length > 1" class="view-card watchlist-card-sort">
      <label class="watchlist-card-sort__field">
        <span>排序</span>
        <select v-model="cardSortField" class="app-select watchlist-card-sort__select">
          <option value="">{{ orderLabel }}</option>
          <option v-for="column in columns" :key="column.field" :value="column.field">{{ column.label }}</option>
        </select>
      </label>
      <label v-if="cardSortField" class="watchlist-card-sort__field">
        <span>方向</span>
        <select v-model="cardSortOrder" class="app-select watchlist-card-sort__select">
          <option value="descending">大到小</option>
          <option value="ascending">小到大</option>
        </select>
      </label>
    </div>
    <slot name="toolbar" />
    <SharedDownloadButton v-if="downloadName" :rows="loading ? [] : rows" :columns="sheetColumns" :filename="downloadName" />
  </div>
  <slot name="settings" />
  <div class="view-table">
    <SharedSheetGrid
      :rows="rows"
      :columns="sheetColumns"
      :row-key="row => row.code"
      label="觀察清單"
      :storage-key="storageKey"
      enter-action="activate"
      :movable="movable"
      @activate="row => navigateTo(linkOf(row))"
      @reorder="reorderFromSheet"
    >
      <template #cell="{ row, column, text }">
        <div v-if="column.key === '__actions'" class="watchlist-row-actions">
          <slot name="actions" :row="row" view="table" :loading="loading" />
        </div>
        <span v-else-if="loading" class="app-skeleton app-skeleton--inline watchlist-skeleton" aria-hidden="true" />
        <template v-else-if="column.key === 'name'">
          <div class="watchlist-name">
            <NuxtLink :to="linkOf(row)" :title="row.name">{{ row.name }}</NuxtLink>
            <el-tag v-if="KIND_TAG[row.kind]" size="small" effect="plain">{{ KIND_TAG[row.kind] }}</el-tag>
          </div>
          <p v-if="notes[row.code]" class="watchlist-note">{{ notes[row.code] }}</p>
        </template>
        <span v-else-if="column.key === WATCHLIST_CHANGE" :class="priceDirectionClass(row.change)">{{ text }}</span>
        <template v-else>{{ text }}</template>
      </template>
    </SharedSheetGrid>
  </div>

  <ul class="view-card watchlist-cards">
    <li v-for="row in sortedCards" :key="row.code" class="watchlist-card">
      <div v-if="loading" class="watchlist-name" aria-hidden="true"><span class="app-skeleton app-skeleton--inline watchlist-skeleton" /></div>
      <div v-else class="watchlist-name">
        <NuxtLink :to="linkOf(row)">{{ row.name }}</NuxtLink>
        <span class="watchlist-name__code">{{ row.code }}</span>
        <el-tag v-if="KIND_TAG[row.kind]" size="small" effect="plain">{{ KIND_TAG[row.kind] }}</el-tag>
      </div>
      <p v-if="notes[row.code]" class="watchlist-note">{{ notes[row.code] }}</p>
      <dl class="watchlist-card__figures">
        <div v-for="column in columns" :key="column.field" :class="{ 'watchlist-card__wide': column.label.length > 7 || column.field === WATCHLIST_EX_DIVIDEND }">
          <dt>{{ column.label }}</dt>
          <dd v-if="loading"><span class="app-skeleton app-skeleton--inline watchlist-skeleton" aria-hidden="true" /></dd>
          <dd v-else :class="column.field === WATCHLIST_CHANGE ? priceDirectionClass(row.change) : undefined">{{ cellText(row, column.field) }}</dd>
        </div>
      </dl>
      <div v-if="actions" class="watchlist-row-actions">
        <slot name="actions" :row="row" view="card" :loading="loading" />
      </div>
    </li>
  </ul>
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

.watchlist-name__code {
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
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
  min-height: 44px;
  margin: 0;
}

.watchlist-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 12px;
  margin-bottom: 12px;
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

.watchlist-card-sort {
  flex-wrap: wrap;
  gap: 8px 12px;
}

.watchlist-card-sort__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--el-text-color-regular);
}

.watchlist-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  flex-direction: column;
  gap: 12px;
}

.watchlist-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.watchlist-card__figures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin: 0;
}

.watchlist-card__wide {
  grid-column: 1 / -1;
}

.watchlist-card__figures dt {
  color: var(--el-text-color-regular);
}

.watchlist-card__figures dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

/* 表格／卡片切換點 1279px，跟持股頁同一個（2026-10-05「a11y 要求放大 200% 也不可以跑版」）：1280 寬的
   左側欄會吃掉表格的寬度，1024～1279 之間 7 欄放不下。 */
@media (max-width: 1279px) {
  .view-table {
    display: none;
  }

  .view-card {
    display: flex;
  }
}
</style>
