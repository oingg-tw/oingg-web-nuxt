<script lang="ts">
export interface HoldingsSymbolRow {
  symbol: string
  name: string
  // 「名稱 代號」，給按鈕的可及名稱
  label: string
  link: string
  kind?: string
}

// 名稱欄固定在第一欄（連結＋代號＋ETF／特別股標籤，排序依代號），這裡只描述後面的數字欄
export interface HoldingsSymbolColumn<T> {
  key: string
  label: string
  minWidth: number
  text: (row: T) => string
  // 沒有值回 null：當成最小
  sortValue: (row: T) => number | string | null
  // 漲跌色（priceDirectionClass）
  tone?: (row: T) => number | null
  // 卡片上：summary＝一眼看到，detail＝展開後才看到，不給＝只在表格出現
  card?: 'summary' | 'detail'
  cardText?: (row: T) => string
  // 表格裡排在哪一欄的第二行（那一欄的 key；那一欄不在就自己一欄）。2026-11-14，使用者：「「損益」和「指標」我認為可以用同樣斷點，
  // 是要去調整設計來配合斷點」，選了「合併成兩行的格子」：市值下面是股數，持股總覽放得進 720 寬的表格。卡片不受影響。
  // 損益與報酬率 2026-11-19 拆回兩欄（「我主要希望把報酬率與損益拆開」）；分享出去的持股兩欄都分享時還併著（見 HoldingsSharedView）
  under?: string
}
</script>

<script setup lang="ts" generic="T extends HoldingsSymbolRow">
import { ArrowDown } from '@element-plus/icons-vue'
import type { ColumnMenuAction } from '~/components/shared/SharedColumnMenu.vue'

// 持股的「一檔一列、可展開明細」表格（2026-10-08 從持股總覽抽出來，使用者：「持股總覽的 Table 做得很好，
// 已經實現損益的頁面不能用嗎? 我希望可以設計共用元件」）。持股總覽與已實現損益共用。
//
// 寬螢幕 el-table、窄的是卡片——兩份 DOM、CSS 決定哪個顯示（不在渲染時看寬度，見 layouts/default.vue）。
// 排序（2026-11-14 方案 A）：寬螢幕點表頭打開排序選單（SharedColumnMenu，同指標檢視），卡片上是一行字的排序與方向；兩邊同一個狀態，
// 見下面的 sort。
//
// 展開的狀態放在頁面（v-model:expanded）：登出、清空時頁面要能一次收起；第一次展開某檔時 emit open，頁面去載交易紀錄。
// 沒給 #detail（分享出去的持股，2026-10-19）就沒有展開：沒有「明細」欄、展開列、卡片上的按鈕。
// 寬螢幕的名稱欄兩行、「明細」是無框的文字鈕（2026-11-14 持股明細設計圖方案 A，使用者：「A很好，請這樣做」）：代號與類別在名稱下面一行
//（不再是標籤，長名稱的 ETF 也不會把代號擠到第二行、每列一樣高），每列一顆框線按鈕太搶眼
const props = withDefaults(defineProps<{
  rows: T[]
  columns: HoldingsSymbolColumn<T>[]
  defaultSort: string
  // [收合時, 展開時]
  toggleLabels?: [string, string]
  // 資料還沒到：畫這麼多列骨架（useLayoutHint 記住的列數），0＝資料到了（2026-10-20，使用者：「載入之前，可以讓用戶看的出來畫面結構」
  //「然後不要閃動」）。表頭、卡片上的欄名、「明細」照畫，數字是骨架，大小跟資料到了一樣
  skeletonRows?: number
}>(), { toggleLabels: () => ['明細', '收合'], skeletonRows: 0 })
const emit = defineEmits<{ open: [symbol: string] }>()
const expanded = defineModel<string[]>('expanded', { default: () => [] })
// variant：明細畫在桌機的展開列（table）還是手機卡片裡（card）——卡片裡的排法不同（見 HoldingsDetailPanel）
const slots = defineSlots<{ detail?: (props: { row: T; variant: 'table' | 'card' }) => unknown }>()
const KIND_SUFFIX: Record<string, string> = { etf: '・ETF', preferred: '・特別股' }

// 表格的欄：排到別欄第二行的（under）不自己一欄
const tableColumns = computed(() => props.columns.filter(column => !column.under || !props.columns.some(other => other.key === column.under)))
const subOf = (column: HoldingsSymbolColumn<T>) => props.columns.find(other => other.under === column.key)
// 一格裡由上到下的欄（表頭兩顆按鈕、格子兩行）
const stackOf = (column: HoldingsSymbolColumn<T>) => [column, ...props.columns.filter(other => other.under === column.key)]

// 名稱欄與明細欄的 min-width：el-table 與骨架表共用。el-table 把多出來的寬度照 min-width 的比例分給各欄，骨架表用同樣的比例。
// 名稱欄 140（原本 170、150）：代號在第二行，名稱一行放得下七個字；持股總覽加總 709，放得進 720 寬的表格（見檔尾）
const NAME_MIN_WIDTH = 140
const DETAIL_MIN_WIDTH = 110
const skeletonShare = (minWidth: number) => {
  const total = NAME_MIN_WIDTH + tableColumns.value.reduce((sum, column) => sum + column.minWidth, 0) + (slots.detail ? DETAIL_MIN_WIDTH : 0)
  return `${(minWidth / total) * 100}%`
}

// 排序是一個狀態（欄＋方向），表格與卡片共用（2026-11-14 方案 A，使用者：「排序UI的風格請兩邊保持一致」「採用A方案」）：卡片是一行字
// 「排序：市值 ⌄」加方向，寬螢幕點表頭打開指標檢視同一個選單（SharedColumnMenu，只有排序）。換欄時方向回到那一欄的預設：數字大到小、
// 代號小到大。沒有值的一律排最後（sortRowsBy）
type SortOrder = 'ascending' | 'descending'
const naturalOrder = (key: string): SortOrder => (key === 'symbol' ? 'ascending' : 'descending')
const sort = reactive({ key: props.defaultSort, order: naturalOrder(props.defaultSort) })
const labelOf = (key: string) => (key === 'symbol' ? '代號' : props.columns.find(column => column.key === key)?.label ?? '')
const sortOptions = computed(() => [...props.columns.map(column => ({ value: column.key, label: column.label })), { value: 'symbol', label: '代號' }])
function pickSort(key: string, order = naturalOrder(key)) {
  sort.key = key
  sort.order = order
}
const sortedRows = computed(() => {
  const column = props.columns.find(item => item.key === sort.key)
  return sortRowsBy(props.rows, column ? column.sortValue : (row: T) => row.symbol, sort.order)
})
// el-table 的表頭沒有 aria-sort：排序狀態寫在表頭按鈕裡（SharedSortIcon 是裝飾）
const sortStateText = (key: string) => (sort.key === key ? `，${sort.order === 'ascending' ? '由小到大' : '由大到小'}排序中` : '')

// 表頭的選單（同 SharedMetricTable）：開在這一欄時再點一下是關；換一欄先關再開，焦點才會進到新的選單
const menu = reactive<{ open: boolean, key: string | null, anchor: HTMLElement | null }>({ open: false, key: null, anchor: null })
const menuStatus = ref('')
function openMenu(key: string, event: MouseEvent) {
  const anchor = event.currentTarget as HTMLElement
  const wasOpenHere = menu.open && menu.key === key
  menu.open = false
  if (wasOpenHere) return
  nextTick(() => {
    menu.key = key
    menu.anchor = anchor
    menu.open = true
  })
}
// 名稱欄依代號排，選單上寫表頭的字
const menuLabel = computed(() => (menu.key === 'symbol' ? '名稱' : labelOf(menu.key ?? '')))
function onMenuAction(action: ColumnMenuAction) {
  if (!menu.key) return
  if (action === 'clear') {
    pickSort(props.defaultSort)
    menuStatus.value = '取消排序'
  } else if (action === 'ascending' || action === 'descending') {
    pickSort(menu.key, action)
    menuStatus.value = `依「${menuLabel.value}」${action === 'ascending' ? '由小到大' : '由大到小'}排序`
  }
}

const summaryColumns = computed(() => props.columns.filter(column => column.card === 'summary'))
const detailColumns = computed(() => props.columns.filter(column => column.card === 'detail'))

function toneClass(column: HoldingsSymbolColumn<T>, row: T) {
  return column.tone ? priceDirectionClass(column.tone(row)) : ''
}

// 卡片的開關在最底下：看完很長的明細才按收合，卡片縮短後連同按鈕可能都已經在畫面上方——捲回到看得到這張卡片
function toggle(symbol: string, event?: MouseEvent) {
  if (expanded.value.includes(symbol)) {
    expanded.value = expanded.value.filter(item => item !== symbol)
    const card = (event?.currentTarget as HTMLElement | null)?.closest('.symbol-table__card')
    if (card) nextTick(() => card.scrollIntoView({ block: 'nearest' }))
    return
  }
  expanded.value = [...expanded.value, symbol]
  emit('open', symbol)
}
</script>

<template>
  <div class="symbol-table">
    <!-- view-card：只跟卡片一起出現（寬螢幕點表頭）。全站卡片共用的排序列（SharedSortControl，2026-11-15 使用者選 C「比照現行篩選」） -->
    <SharedSortControl
      class="symbol-table__toolbar view-card"
      :options="sortOptions"
      :field="sort.key"
      :order="sort.order"
      @field="pickSort"
      @toggle="sort.order = sort.order === 'ascending' ? 'descending' : 'ascending'"
    />

    <!-- 骨架表：el-table 在伺服器不畫列（欄位要 mount 才登記），所以自己畫一張。欄寬照 el-table 的分法、表頭與列高照它的樣式，
         列高靠同一顆「明細」按鈕撐出來（觸控裝置按鈕 44px 時一起變高）。兩張都放在全站表格的卡片裡（SharedTable） -->
    <SharedTable v-if="skeletonRows" :ssr="false" :scrollable="false" table-class="symbol-table__skeleton" class="view-table" aria-hidden="true">
      <colgroup>
        <col :style="{ width: skeletonShare(NAME_MIN_WIDTH) }">
        <col v-for="column in tableColumns" :key="column.key" :style="{ width: skeletonShare(column.minWidth) }">
        <col v-if="slots.detail" :style="{ width: skeletonShare(DETAIL_MIN_WIDTH) }">
      </colgroup>
      <thead>
        <tr>
          <!-- 表頭跟資料到了的表頭按鈕同一個樣子（圖示、欄名、折行），只是不能按 -->
          <th><span class="symbol-table__head">名稱<SharedSortIcon :state="sort.key === 'symbol' ? sort.order : null" /></span></th>
          <th v-for="column in tableColumns" :key="column.key" class="symbol-table__skeleton-num">
            <span class="symbol-table__stack"><span v-for="item in stackOf(column)" :key="item.key" class="symbol-table__head"><SharedSortIcon :state="sort.key === item.key ? sort.order : null" />{{ item.label }}</span></span>
          </th>
          <th v-if="slots.detail"><span class="visually-hidden">明細</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="index in skeletonRows" :key="index">
          <td><span class="app-skeleton app-skeleton--inline symbol-table__skeleton-name" /><span class="symbol-table__sub"><span class="app-skeleton app-skeleton--inline symbol-table__skeleton-code" /></span></td>
          <td v-for="column in tableColumns" :key="column.key" class="symbol-table__skeleton-num">
            <span class="app-skeleton app-skeleton--inline symbol-table__skeleton-value" />
            <span v-if="subOf(column)" class="symbol-table__sub"><span class="app-skeleton app-skeleton--inline symbol-table__skeleton-code" /></span>
          </td>
          <td v-if="slots.detail"><el-button text type="primary" disabled tabindex="-1">{{ toggleLabels[0] }}<el-icon class="symbol-table__chevron" aria-hidden="true"><ArrowDown /></el-icon></el-button></td>
        </tr>
      </tbody>
    </SharedTable>

    <SharedTable v-else custom class="view-table">
      <el-table :data="sortedRows" row-key="symbol" :expand-row-keys="expanded">
        <!-- 展開列只拿來放明細；開關是「明細」那顆按鈕（aria-expanded）。el-table 自己的展開箭頭藏起來，
             免得同一件事有兩個開關 -->
        <el-table-column v-if="slots.detail" type="expand" label="交易紀錄" width="1" class-name="symbol-table__expand-col" label-class-name="symbol-table__expand-col">
          <template #default="{ row }">
            <!-- el-table 沒展開的列也會畫這一格：不擋的話每一列都掛著看不見的明細（交易紀錄的讀取遮罩） -->
            <slot v-if="expanded.includes(tableRow<T>(row).symbol)" name="detail" :row="tableRow<T>(row)" :variant="'table'" />
          </template>
        </el-table-column>
        <el-table-column label="名稱" prop="symbol" :min-width="NAME_MIN_WIDTH">
          <!-- 點表頭打開排序選單（同指標檢視）；靠左的欄圖示在欄名後面 -->
          <template #header>
            <button type="button" class="symbol-table__head" aria-haspopup="menu" :aria-expanded="menu.open && menu.key === 'symbol'" @click="openMenu('symbol', $event)">
              名稱<SharedSortIcon :state="sort.key === 'symbol' ? sort.order : null" /><span class="visually-hidden">{{ sortStateText('symbol') }}</span>
            </button>
          </template>
          <template #default="{ row }">
            <NuxtLink :to="tableRow<T>(row).link" class="stock-name-link">{{ tableRow<T>(row).name }}</NuxtLink>
            <span class="symbol-table__sub">{{ tableRow<T>(row).symbol }}{{ KIND_SUFFIX[tableRow<T>(row).kind ?? ''] ?? '' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-for="column in tableColumns"
          :key="column.key"
          :label="column.label"
          :prop="column.key"
          align="right"
          :min-width="column.minWidth"
        >
          <!-- 靠右的欄圖示在前：欄名跟下面的數字對齊。併成兩行的格子，表頭也是兩顆按鈕，各排各的 -->
          <template #header>
            <span class="symbol-table__stack">
              <button v-for="item in stackOf(column)" :key="item.key" type="button" class="symbol-table__head" aria-haspopup="menu" :aria-expanded="menu.open && menu.key === item.key" @click="openMenu(item.key, $event)">
                <SharedSortIcon :state="sort.key === item.key ? sort.order : null" />{{ item.label }}<span class="visually-hidden">{{ sortStateText(item.key) }}</span>
              </button>
            </span>
          </template>
          <!-- 第二行的漲跌色寫在裡面那一層：外層的灰字（.symbol-table__sub）特異性比全站的漲跌色高 -->
          <template #default="{ row }">
            <span :class="toneClass(column, tableRow<T>(row))">{{ column.text(tableRow<T>(row)) }}</span>
            <span v-if="subOf(column)" class="symbol-table__sub"><span :class="toneClass(subOf(column)!, tableRow<T>(row))">{{ subOf(column)!.text(tableRow<T>(row)) }}</span></span>
          </template>
        </el-table-column>
        <!-- 每列只留一顆「明細」（2026-10-05 UI 盤點：原本每列三顆按鈕，26 檔就是 78 顆，比數字還搶眼）。 -->
        <el-table-column v-if="slots.detail" label="明細" :min-width="DETAIL_MIN_WIDTH" label-class-name="symbol-table__detail-head">
          <template #default="{ row }">
            <!-- 念出來的名稱＝看得到的字＋股票名（WCAG 2.5.3），狀態交給 aria-expanded -->
            <el-button text type="primary" :aria-expanded="expanded.includes(tableRow<T>(row).symbol)" @click="toggle(tableRow<T>(row).symbol)">
              {{ expanded.includes(tableRow<T>(row).symbol) ? toggleLabels[1] : toggleLabels[0] }}<span class="visually-hidden">：{{ tableRow<T>(row).label }}</span>
              <el-icon class="symbol-table__chevron" :class="{ 'is-open': expanded.includes(tableRow<T>(row).symbol) }" aria-hidden="true"><ArrowDown /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </SharedTable>
    <SharedColumnMenu v-model:open="menu.open" :anchor="menu.anchor" :label="menuLabel" :sort="sort.key === menu.key ? sort.order : null" @action="onMenuAction" />
    <p class="visually-hidden" role="status">{{ menuStatus }}</p>

    <!-- 手機卡片（2026-10-20 重新設計，使用者：「不展開還好，一展開看起來有夠髒」）：所有數字一種排法——名稱靠左、數字靠右，
         一列一項；展開後接著列下去，交易紀錄與動作在最後（HoldingsDetailPanel 的 card）。開關是卡片的頁尾（「明細按鈕放在右上角不太順，
         放在下面反而比較合理」）：字加箭頭、整張卡片寬，展開的內容長在它上面 -->
    <ul class="view-card symbol-table__cards">
      <!-- 骨架卡片：跟下面同一套排法，欄名與「明細」照畫，名稱與數字是骨架 -->
      <template v-if="skeletonRows">
        <li v-for="index in skeletonRows" :key="index" class="app-card symbol-table__card holdings-card" aria-hidden="true">
          <div class="symbol-table__name"><span class="app-skeleton app-skeleton--flow">台積電 2330</span></div>
          <dl v-if="summaryColumns.length" class="holdings-card__rows">
            <div v-for="column in summaryColumns" :key="column.key" class="holdings-card__row">
              <dt>{{ column.label }}</dt>
              <dd><span class="app-skeleton app-skeleton--inline symbol-table__skeleton-value" /></dd>
            </div>
          </dl>
          <el-button v-if="slots.detail" text type="primary" class="symbol-table__toggle" disabled tabindex="-1">
            {{ toggleLabels[0] }}<el-icon class="symbol-table__chevron" aria-hidden="true"><ArrowDown /></el-icon>
          </el-button>
        </li>
      </template>
      <li v-for="row in sortedRows" v-else :key="row.symbol" class="app-card symbol-table__card holdings-card">
        <div class="symbol-table__name">
          <NuxtLink :to="row.link" class="stock-name-link">{{ row.name }}</NuxtLink>
          <span class="symbol-table__code">{{ row.symbol }}{{ KIND_SUFFIX[row.kind ?? ''] ?? '' }}</span>
        </div>
        <dl v-if="summaryColumns.length" class="holdings-card__rows">
          <div v-for="column in summaryColumns" :key="column.key" class="holdings-card__row">
            <dt>{{ column.label }}</dt>
            <dd :class="toneClass(column, row)">{{ (column.cardText ?? column.text)(row) }}</dd>
          </div>
        </dl>
        <div v-if="slots.detail && expanded.includes(row.symbol)" class="symbol-table__more">
          <dl v-if="detailColumns.length" class="holdings-card__rows">
            <div v-for="column in detailColumns" :key="column.key" class="holdings-card__row">
              <dt>{{ column.label }}</dt>
              <dd :class="toneClass(column, row)">{{ (column.cardText ?? column.text)(row) }}</dd>
            </div>
          </dl>
          <slot name="detail" :row="row" :variant="'card'" />
        </div>
        <el-button v-if="slots.detail" text type="primary" class="symbol-table__toggle" :aria-expanded="expanded.includes(row.symbol)" @click="toggle(row.symbol, $event)">
          {{ expanded.includes(row.symbol) ? toggleLabels[1] : toggleLabels[0] }}<span class="visually-hidden">：{{ row.label }}</span>
          <el-icon class="symbol-table__chevron" :class="{ 'is-open': expanded.includes(row.symbol) }" aria-hidden="true"><ArrowDown /></el-icon>
        </el-button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* 表格或卡片看這一塊自己的寬度（見檔尾） */
.symbol-table {
  container-type: inline-size;
}

/* 排序列（只在卡片模式）跟下面的卡片隔 12px，同 SharedMetricTable 的工具列 */
.symbol-table__toolbar {
  margin-bottom: 12px;
}

.symbol-table__head:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
  border-radius: var(--el-border-radius-base);
}

/* 表頭按鈕（同 SharedMetricTable 的 .screener-result-table__head）：點了打開排序選單。24px 高＝原本 el-table 排序箭頭撐出來的表頭高。
   vertical-align: top：圖示在前的欄沒有文字基線，貼著基線排會把格子撐高 4～7px、欄名比「名稱」低一截 */
.symbol-table__head {
  display: inline-flex;
  align-items: center;
  vertical-align: top;
  gap: 4px;
  min-height: 24px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  text-align: inherit;
  /* 欄名在窄欄裡折兩行時平均分（「預估年／股利」，不是「預估年股／利」） */
  text-wrap: balance;
  cursor: pointer;
}

/* 一格裡疊兩顆表頭按鈕（市值／股數），靠右；只有一顆時跟原本一樣 */
.symbol-table__stack {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  vertical-align: top;
}

/* 卡片的標頭同指標卡片（SharedMetricTable 的 .smt-card__head，2026-11-14 卡片做法 1，使用者選的）：名稱 18px 粗體黑字，
   代號與類別灰字接在後面（00878・ETF，同寬螢幕名稱下面那一行），不再是標籤 */
.symbol-table__name {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 8px;
  font-size: 1.125rem;
  font-weight: 600;
}

.symbol-table__code {
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

/* 寬螢幕名稱下面那一行：代號與類別 */
.symbol-table__sub {
  display: block;
  font-size: 0.875rem;
  line-height: 20px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

/* 骨架表：照 el-table 的高（格子上下 8px、23px 行高）；左右內距、線、表頭底色與字色是全站表格那一套，el-table 也是同一套。
   <table> 是 SharedTable 畫的，對它本身要用 :deep */
:deep(.symbol-table__skeleton) {
  table-layout: fixed;
}

.symbol-table__skeleton th,
.symbol-table__skeleton td {
  padding-block: 8px;
  line-height: 23px;
}

/* 表頭在欄寬裡折行，同 el-table 的表頭（.cell 的 white-space、overflow-wrap）：1280 寬各欄只剩 min-width，「預估年股利」換到
   第二行，骨架照樣換，資料到的時候表頭不長高 */
.symbol-table__skeleton th {
  white-space: normal;
  overflow-wrap: break-word;
}

.symbol-table__skeleton .symbol-table__skeleton-num {
  text-align: right;
}

.symbol-table__skeleton-name {
  width: 7em;
}

.symbol-table__skeleton-value {
  width: 4.5em;
}

.symbol-table__skeleton-code {
  width: 3em;
}

/* 數字欄用等寬數字，同一欄上下比較時位數對齊 */
.view-table :deep(td) {
  font-variant-numeric: tabular-nums;
}

/* 展開列貼齊整列（使用者 2026-10-05：「展開後總感覺四周邊框有空隙」）。Element Plus 的展開格自帶 20px／50px
   的內距，加上明細區塊自己的圓角與底色，看起來像表格裡又浮著一個盒子。內距歸零，由明細區塊自己決定留白。 */
.view-table :deep(.el-table__expanded-cell) {
  padding: 0;
}

.view-table :deep(td.symbol-table__expand-col .cell) {
  display: none;
}

/* 表頭留著名稱給螢幕閱讀器（空白表頭會被念成沒有名字的欄，axe empty-table-header），畫面上不佔位 */
.view-table :deep(th.symbol-table__expand-col .cell),
.view-table :deep(th.symbol-table__detail-head .cell) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* 卡片之間、卡片裡各段之間 8px：同指標卡片（.smt-cards、.smt-card__head 的下距） */
.symbol-table__cards {
  list-style: none;
  margin: 0;
  padding: 0;
  flex-direction: column;
  gap: 8px;
}

.symbol-table__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* 收合後捲回來時不躲到固定的頁首底下 */
  scroll-margin-top: calc(var(--app-header-height) + var(--app-banner-height) + 8px);
}

/* 展開的明細可能有自己的表格，不能把卡片撐寬 */
.symbol-table__card > * {
  min-width: 0;
}

/* 卡片的頁尾：貼齊卡片左右與底邊（抵掉 .holdings-card 的 12px 16px 內距），上面一條線。線用內陰影畫：文字按鈕的框被 main.css
   的高對比模式規則（border: 1px solid transparent !important）蓋掉 */
.symbol-table__card .symbol-table__toggle {
  min-height: 44px;
  margin: 0 -16px -12px;
  border-radius: 0 0 var(--el-card-border-radius, 4px) var(--el-card-border-radius, 4px);
  box-shadow: inset 0 1px 0 var(--app-divider);
}

.symbol-table__chevron {
  margin-left: 4px;
  transition: transform var(--el-transition-duration);
}

.symbol-table__chevron.is-open {
  transform: rotate(180deg);
}

/* 所有數字一種排法：名稱靠左、數字靠右，一列一項——.holdings-card__rows（main.css）；欄名灰字、數字粗體同指標卡片 */

/* 展開的部分：一條分隔線之後接著列下去（股數、預估年股利，再來是明細面板的平均成本…），列與列之間跟上面一樣 4px */
.symbol-table__more {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--app-divider);
}

/* 表頭黏在頁首下面，同篩選與指標檢視的表格（SharedMetricTable 的 sticky；2026-11-14，使用者：「為什麼股票篩選表格可以貼頂表頭 但是
   持股明細表格沒有貼頂」）。Element 在根元素、body-wrapper、el-scrollbar 三層用 overflow: hidden，會變成捲動容器、表頭只在框裡黏；
   clip 裁切一樣但不是捲動容器（SharedTable 的卡片也是 clip）。這張表放得下才是表格、不左右捲，所以不用黏底部的橫向捲軸 */
.view-table :deep(.el-table),
.view-table :deep(.el-table__body-wrapper),
.view-table :deep(.el-table__body-wrapper > .el-scrollbar) {
  overflow: clip;
}

.view-table :deep(.el-table__header-wrapper) {
  position: sticky;
  top: calc(var(--app-header-height) + var(--app-banner-height));
  /* 蓋過捲上來的列：一般格 index、固定欄 index + 1 */
  z-index: calc(var(--el-table-index) + 2);
}

/* 表格或卡片跟全站的表格同一條斷點（使用者 2026-11-14：「「損益」和「指標」我認為可以用同樣斷點，是要去調整設計來配合斷點比較正常」）：
   這一塊寬 720 起是表格，同 SharedMetricTable 換成卡片的門檻：持股的指標檢視在這一塊同樣 720 時切（2026-11-14 量的）。
   設計配合這條：持股總覽的市值與股數併成兩行（見 under），min-width 加總 名稱 140＋市值 108＋損益 150＋報酬率 104＋預估年股利 96
  ＋明細 110＋展開欄 1＝709，720 寬扣表格框線 2 還放得下、不左右捲（使用者 2026-10-05：「a11y 要求放大 200% 也不可以跑版」）。
   2026-11-19 損益與報酬率拆成兩欄、今日漲跌拿掉（原本 140＋120＋90＋140＋100＋110＋1＝701，損益與報酬率併一格）。已實現損益、分享出去的持股用同一條。
   卡片是基本樣式：手機、不支援容器查詢的舊瀏覽器都是卡片 */
.view-table {
  display: none;
}

.view-card {
  display: flex;
}

@container (min-width: 720px) {
  .view-table {
    display: block;
  }

  .view-card {
    display: none;
  }
}
</style>
