<script setup lang="ts">
import type { ScreenerResultTableColumn } from '~/components/shared/SharedMetricTable.vue'
import type { ColumnDraft } from '~/components/shared/SharedColumnSettings.vue'
import type { ScreenerResultRow } from '~/composables/screener/useFilterSearch'
import type { MetricCategory } from '~/composables/screener/useFilterSchema'
import type { WatchlistRow } from '~/composables/watchlist/useWatchlistStocks'

// 觀察清單的一段（一類），/watchlist 與分享頁 /share/[token] 共用。表格是篩選的結果表 SharedMetricTable（2026-11-11，使用者：「以篩選
// 那邊的表格為主」，電腦版「拿掉，跟篩選一樣」、手機「改成篩選的卡片」）：河道位置的軌道、年增率的漲跌色、格子連到指標頁、表頭選單、
// 窄的時候是卡片，都跟篩選一樣。這裡只管觀察清單自己的：漲跌與除息／發放怎麼寫、名稱下面的備註、骨架。2026-10-17 到這天電腦版是
// SharedSheetGrid（試算表），11-07 起 1279px 以下是對齊的四欄表。資料（rows）由呼叫端用 useWatchlistStocks 抓。
const props = withDefaults(defineProps<{
  rows: WatchlistRow[]
  // 固定欄（WATCHLIST_FIXED_COLUMNS）加這一類的欄位組合
  columns: ScreenerResultTableColumn[]
  // 這一類的型錄：格式化與欄位設定挑指標都用它（useWatchlistColumnCatalog 的 categoriesOf）
  categories: MetricCategory[]
  // 名稱與格子連去哪裡，同那一類的篩選（linksOf）
  links: { rowLink: (symbol: string) => string, cellLink: (symbol: string, field: string) => string | null }
  // 骨架的名稱欄寬與表頭高記在 cookie 的鍵；分享頁另用一個，不跟自己的清單混
  layoutKey: string
  // 表格的可及名稱（分段時每張表要分得開）
  label: string
  // 代號 → 備註
  notes?: Record<string, string>
  // false：分享頁、訪客，表頭選單只能排序
  editable?: boolean
  // 欄位設定的「重設預設欄位」
  columnDefaults?: ColumnDraft[]
  // rows 是骨架列（列數照上次）
  skeleton?: boolean
  // 存這一類的欄位組合（不含固定欄）：欄位設定、表頭選單的移動與移除、拖曳。回 false＝沒存到
  save?: (fields: string[]) => Promise<boolean>
}>(), { notes: () => ({}), editable: false, columnDefaults: undefined, skeleton: false, save: undefined })
const slots = defineSlots<{
  toolbar?: () => unknown
  actions?: (props: { row: WatchlistRow }) => unknown
}>()

const byCode = computed(() => new Map(props.rows.map(row => [row.code, row])))
const tableRows = computed<ScreenerResultRow[]>(() => props.rows.map(row => ({ symbol: row.code, name: row.name, values: row.values })))

const signed = (value: number, text: string) => minusSign(`${value > 0 ? '+' : ''}${text}`)
const changeText = (row: WatchlistRow | undefined) =>
  !row || row.change === null || row.changePercent === null ? '－' : `${signed(row.change, row.change.toFixed(2))} (${signed(row.changePercent, row.changePercent.toFixed(2))}%)`
const exDividendText = (row: WatchlistRow | undefined) => {
  const event = row?.nextDividendEvent
  if (!event) return '－'
  const amount = dividendEventAmount(event)
  return `${event.date.slice(5).replace('-', '/')} ${dividendEventLabel(event)}${amount ? ` ${amount}` : ''}`
}
// 漲跌與除息／發放不是型錄的欄位：值是漲跌幅與日期（排序照它們），字要看整列。除息／發放最早的排前面
const tableColumns = computed<ScreenerResultTableColumn[]>(() => props.columns.map((column) => {
  if (column.field === WATCHLIST_CHANGE) {
    return { ...column, format: (_raw, row) => changeText(byCode.value.get(row.symbol)), cellClass: (_raw, row) => priceDirectionClass(byCode.value.get(row.symbol)?.change ?? null), minWidth: 150, sample: '+00.00 (+0.00%)' }
  }
  if (column.field === WATCHLIST_EX_DIVIDEND) {
    return { ...column, format: (_raw, row) => exDividendText(byCode.value.get(row.symbol)), ascendingFirst: true, minWidth: 170, sample: '00/00 除息 0.00 元' }
  }
  return column
}))

// 排序只在這一頁、不存；傳回表格：搬動欄位後表格重掛，要靠它保留排序
const sort = ref<{ field: string | null, order: 'ascending' | 'descending' | null }>({ field: null, order: null })
// 表格先照新的欄位畫（欄位設定按儲存就關），沒存到（例如欄位組合的額度滿了）要回到存過的那一組：重掛，欄位照 columns
const resetKey = ref(0)
async function save(fields: string[]) {
  if (props.save && !(await props.save(fields.filter(field => !WATCHLIST_FIXED_COLUMNS.some(column => column.field === field))))) resetKey.value++
}
</script>

<template>
  <!-- 一段一張卡片（同篩選結果的 SharedTable custom）：工具列與表格在卡片上；卡片版面（容器 722px 以下）拿掉外層，不疊卡片 -->
  <div class="watchlist-table">
    <SharedTable custom class="watchlist-table__card">
      <SharedMetricTable
        :key="resetKey"
        :rows="tableRows"
        :columns="tableColumns"
        :categories="categories"
        sort-mode="client"
        :sort-field="sort.field"
        :sort-order="sort.order"
        :show-period="true"
        :cell-dates="false"
        :row-link="links.rowLink"
        :cell-link="links.cellLink"
        :note-of="code => notes[code]"
        :editable="editable"
        :column-defaults="columnDefaults"
        :skeleton="skeleton"
        :layout-key="layoutKey"
        :label="label"
        @sort-change="(field, order) => (sort = { field, order })"
        @row-click="symbol => navigateTo(links.rowLink(symbol))"
        @reorder="save"
        @save-columns="drafts => save(drafts.map(draft => draft.field))"
      >
        <template v-if="slots.toolbar" #toolbar><slot name="toolbar" /></template>
        <template v-if="slots.actions" #actions="{ row }"><slot name="actions" :row="byCode.get(row.symbol)!" /></template>
      </SharedMetricTable>
    </SharedTable>
  </div>
</template>

<style scoped>
.watchlist-table {
  container-type: inline-size;
}

/* 同篩選結果的卡片（ScreenerPageShell 的 .screener-shell__results-card）：門檻 722＝表格換成卡片的 720 加左右框線 2px */
@container (max-width: 721px) {
  .watchlist-table__card {
    border: 0;
    border-radius: 0;
    background: none;
  }
}

@container (min-width: 722px) {
  .watchlist-table__card {
    padding-top: 16px;
  }

  .watchlist-table__card :deep(.smt-toolbar) {
    padding-inline: 16px;
  }
}
</style>

<style>
/* 工具列裡的欄位選單（SharedColumnSetMenu）打開時會長出卡片（表格只有一兩列時）：這一段疊在後面幾段上面（container-type 讓每一段自成一層），
   卡片也不裁（SharedTable 的 clip）。原本選單下半截被裁掉、被下一段的工具列蓋住（2026-11-14 持股指標檢視量到，觀察清單同一套）。
   不寫在 scoped 裡：選單是呼叫端放進來的，帶的是呼叫端的 scope */
.watchlist-table:has(.column-set-menu.is-open) {
  position: relative;
  z-index: 3;
}

.watchlist-table:has(.column-set-menu.is-open) > .watchlist-table__card {
  overflow: visible;
}
</style>
