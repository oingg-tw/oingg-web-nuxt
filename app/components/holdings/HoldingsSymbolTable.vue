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
  // 排序選單的字；預設「欄名（大到小）」
  sortLabel?: string
  // 下載（SharedDownloadButton）：value＝下載的值（數字給數字、百分比給比例），不給就下載 text；sensitive＝會透露部位大小，預設不下載
  value?: (row: T) => string | number | null
  sensitive?: boolean
}
</script>

<script setup lang="ts" generic="T extends HoldingsSymbolRow">
import { ArrowDown } from '@element-plus/icons-vue'

// 持股的「一檔一列、可展開明細」表格（2026-10-08 從持股總覽抽出來，使用者：「持股總覽的 Table 做得很好，
// 已經實現損益的頁面不能用嗎? 我希望可以設計共用元件」）。持股總覽與已實現損益共用。
//
// 寬螢幕 el-table、窄的是卡片——兩份 DOM、CSS 決定哪個顯示（不在渲染時看寬度，見 layouts/default.vue）。
// 寬螢幕點表頭排序：Element Plus 2.14 的排序箭頭是 <button>（可 Tab、Enter），<th> 帶 aria-sort；按鈕的中文名稱
// 在 app.vue 的語系覆寫（2026-10-07 曾誤以為不能用鍵盤而拿掉，10-08 查原始碼後恢復）。卡片沒有表頭，
// 用「排序」選單，只跟卡片一起出現；點表頭也會同步選單。
// 選單：數字大到小、代號小到大；沒有值的一律排最後（表頭升冪時排最前，el-table 只會把同一個比較反過來）。
//
// 展開的狀態放在頁面（v-model:expanded）：登出、清空時頁面要能一次收起；第一次展開某檔時 emit open，頁面去載交易紀錄。
// 沒給 #detail（分享出去的持股，2026-10-19）就沒有展開：沒有「明細」欄、展開列、卡片上的按鈕。
// #toolbar：工具列右邊的按鈕（持股總覽的分享）。有給時工具列先保留一個按鈕高：桌機的工具列平常是空的，按鈕晚一點才出現的話
// 會把整張表往下推
const props = withDefaults(defineProps<{
  rows: T[]
  columns: HoldingsSymbolColumn<T>[]
  defaultSort: string
  // [收合時, 展開時]
  toggleLabels?: [string, string]
  // 給了就在表格上方放「下載」（檔名前半段，例如「持股明細」）。下載的是目前的排序
  downloadName?: string
  // 資料還沒到：畫這麼多列骨架（useLayoutHint 記住的列數），0＝資料到了（2026-10-20，使用者：「載入之前，可以讓用戶看的出來畫面結構」
  //「然後不要閃動」）。表頭、卡片上的欄名、「明細」照畫，數字是骨架，大小跟資料到了一樣
  skeletonRows?: number
}>(), { toggleLabels: () => ['明細', '收合'], downloadName: undefined, skeletonRows: 0 })
const emit = defineEmits<{ open: [symbol: string] }>()
const expanded = defineModel<string[]>('expanded', { default: () => [] })
// variant：明細畫在桌機的展開列（table）還是手機卡片裡（card）——卡片裡的排法不同（見 HoldingsDetailPanel）
const slots = defineSlots<{ detail?: (props: { row: T; variant: 'table' | 'card' }) => unknown; toolbar?: () => unknown }>()

// 名稱欄與明細欄的 min-width：el-table 與骨架表共用。el-table 把多出來的寬度照 min-width 的比例分給各欄，骨架表用同樣的比例
const NAME_MIN_WIDTH = 170
const DETAIL_MIN_WIDTH = 110
const skeletonShare = (minWidth: number) => {
  const total = NAME_MIN_WIDTH + props.columns.reduce((sum, column) => sum + column.minWidth, 0) + (slots.detail ? DETAIL_MIN_WIDTH : 0)
  return `${(minWidth / total) * 100}%`
}

const sortKey = ref(props.defaultSort)
const sortOptions = computed(() => [
  ...props.columns.map(column => ({ value: column.key, label: column.sortLabel ?? `${column.label}（大到小）` })),
  { value: 'symbol', label: '代號' }
])

// 升冪比較，沒有值當最小。選單與表頭共用。
function compareBy(key: string) {
  const column = props.columns.find(item => item.key === key)
  const pick = column ? column.sortValue : (row: T) => row.symbol
  return (a: T, b: T) => {
    const x = pick(a)
    const y = pick(b)
    if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y)
    if (x === null || y === null) return x === y ? 0 : x === null ? -1 : 1
    return (x as number) - (y as number)
  }
}

const sortedRows = computed(() => {
  const compare = compareBy(sortKey.value)
  return [...props.rows].sort(sortKey.value === 'symbol' ? compare : (a, b) => compare(b, a))
})

function onSortChange({ prop }: { prop: string | null }) {
  if (prop) sortKey.value = prop
}

// 下載的欄：代號、名稱分兩欄（表格裡是同一格），後面接數字欄
const downloadColumns = computed(() => [
  { key: 'symbol', label: '代號', text: (row: T) => row.symbol },
  { key: 'name', label: '名稱', text: (row: T) => row.name },
  ...props.columns
])

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
  <div>
    <div class="symbol-table__toolbar" :class="{ 'symbol-table__toolbar--reserved': slots.toolbar }">
      <!-- view-card：選單只跟卡片一起出現（寬螢幕用表頭） -->
      <label class="symbol-table__sort view-card">
        <span>排序</span>
        <select v-model="sortKey" class="app-select symbol-table__select">
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <SharedDownloadButton v-if="downloadName" class="symbol-table__download" :rows="sortedRows" :columns="downloadColumns" :filename="downloadName" />
      <slot name="toolbar" />
    </div>

    <!-- 骨架表：el-table 在伺服器不畫列（欄位要 mount 才登記），所以自己畫一張。欄寬照 el-table 的分法、表頭與列高照它的樣式，
         列高靠同一顆「明細」按鈕撐出來（觸控裝置按鈕 44px 時一起變高） -->
    <table v-if="skeletonRows" class="view-table symbol-table__skeleton" aria-hidden="true">
      <thead>
        <tr>
          <!-- 排序欄的表頭後面留 el-table 排序箭頭的寬（24px），靠右的欄名才在同一個位置 -->
          <th :style="{ width: skeletonShare(NAME_MIN_WIDTH) }">名稱<span class="symbol-table__skeleton-caret" /></th>
          <th v-for="column in columns" :key="column.key" class="symbol-table__skeleton-num" :style="{ width: skeletonShare(column.minWidth) }">{{ column.label }}<span class="symbol-table__skeleton-caret" /></th>
          <th v-if="slots.detail" :style="{ width: skeletonShare(DETAIL_MIN_WIDTH) }">明細</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="index in skeletonRows" :key="index">
          <td><span class="app-skeleton app-skeleton--inline symbol-table__skeleton-name" /></td>
          <td v-for="column in columns" :key="column.key" class="symbol-table__skeleton-num"><span class="app-skeleton app-skeleton--inline symbol-table__skeleton-value" /></td>
          <td v-if="slots.detail"><el-button disabled tabindex="-1">{{ toggleLabels[0] }}</el-button></td>
        </tr>
      </tbody>
    </table>

    <el-table v-else class="view-table" :data="sortedRows" row-key="symbol" :expand-row-keys="expanded" @sort-change="onSortChange">
      <!-- 展開列只拿來放明細；開關是「明細」那顆按鈕（aria-expanded）。el-table 自己的展開箭頭藏起來，
           免得同一件事有兩個開關 -->
      <el-table-column v-if="slots.detail" type="expand" label="交易紀錄" width="1" class-name="symbol-table__expand-col" label-class-name="symbol-table__expand-col">
        <template #default="{ row }">
          <slot name="detail" :row="tableRow<T>(row)" :variant="'table'" />
        </template>
      </el-table-column>
      <el-table-column label="名稱" prop="symbol" :min-width="NAME_MIN_WIDTH" sortable :sort-method="compareBy('symbol')">
        <template #default="{ row }">
          <div class="symbol-table__name">
            <NuxtLink :to="tableRow<T>(row).link" class="stock-name-link">{{ tableRow<T>(row).name }}</NuxtLink>
            <span class="symbol-table__code">{{ tableRow<T>(row).symbol }}</span>
            <el-tag v-if="tableRow<T>(row).kind === 'etf'" size="small" effect="plain">ETF</el-tag>
            <el-tag v-else-if="tableRow<T>(row).kind === 'preferred'" size="small" effect="plain">特別股</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        v-for="column in columns"
        :key="column.key"
        :label="column.label"
        :prop="column.key"
        align="right"
        :min-width="column.minWidth"
        sortable
        :sort-method="compareBy(column.key)"
      >
        <template #default="{ row }">
          <span :class="toneClass(column, tableRow<T>(row))">{{ column.text(tableRow<T>(row)) }}</span>
        </template>
      </el-table-column>
      <!-- 每列只留一顆「明細」（2026-10-05 UI 盤點：原本每列三顆按鈕，26 檔就是 78 顆，比數字還搶眼）。 -->
      <el-table-column v-if="slots.detail" label="明細" :min-width="DETAIL_MIN_WIDTH">
        <template #default="{ row }">
          <!-- 念出來的名稱＝看得到的字＋股票名（WCAG 2.5.3），狀態交給 aria-expanded -->
          <el-button :aria-expanded="expanded.includes(tableRow<T>(row).symbol)" @click="toggle(tableRow<T>(row).symbol)">
            {{ expanded.includes(tableRow<T>(row).symbol) ? toggleLabels[1] : toggleLabels[0] }}<span class="visually-hidden">：{{ tableRow<T>(row).label }}</span>
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 手機卡片（2026-10-20 重新設計，使用者：「不展開還好，一展開看起來有夠髒」）：所有數字一種排法——名稱靠左、數字靠右，
         一列一項；展開後接著列下去，交易紀錄與動作在最後（HoldingsDetailPanel 的 card）。開關是卡片的頁尾（「明細按鈕放在右上角不太順，
         放在下面反而比較合理」）：字加箭頭、整張卡片寬，展開的內容長在它上面 -->
    <ul class="view-card symbol-table__cards">
      <!-- 骨架卡片：跟下面同一套排法，欄名與「明細」照畫，名稱與數字是骨架 -->
      <template v-if="skeletonRows">
        <li v-for="index in skeletonRows" :key="index" class="symbol-table__card holdings-card" aria-hidden="true">
          <div class="symbol-table__name"><span class="app-skeleton app-skeleton--inline symbol-table__skeleton-name" /></div>
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
      <li v-for="row in sortedRows" v-else :key="row.symbol" class="symbol-table__card holdings-card">
        <div class="symbol-table__name">
          <NuxtLink :to="row.link" class="stock-name-link">{{ row.name }}</NuxtLink>
          <span class="symbol-table__code">{{ row.symbol }}</span>
          <el-tag v-if="row.kind === 'etf'" size="small" effect="plain">ETF</el-tag>
          <el-tag v-else-if="row.kind === 'preferred'" size="small" effect="plain">特別股</el-tag>
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
/* 排序選單（只在卡片模式）與下載鈕同一列，下載靠右 */
.symbol-table__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.symbol-table__toolbar:empty {
  display: none;
}

.symbol-table__toolbar--reserved {
  min-height: 44px;
}

.symbol-table__download {
  margin-left: auto;
}

.symbol-table__sort {
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.symbol-table__name {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.symbol-table__code {
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

/* 骨架表：照 el-table 的樣子（表頭 8px 上下內距、23px 行高、次要字色；儲存格 0 12px 內距、下框線） */
.symbol-table__skeleton {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  background: var(--el-bg-color);
}

.symbol-table__skeleton th,
.symbol-table__skeleton td {
  padding: 8px 12px;
  line-height: 23px;
  text-align: left;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.symbol-table__skeleton th {
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.symbol-table__skeleton .symbol-table__skeleton-num {
  text-align: right;
}

.symbol-table__skeleton-caret {
  display: inline-block;
  width: 24px;
  height: 14px;
  vertical-align: middle;
}

.symbol-table__skeleton-name {
  width: 7em;
}

.symbol-table__skeleton-value {
  width: 4.5em;
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
.view-table :deep(th.symbol-table__expand-col .cell) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.symbol-table__cards {
  list-style: none;
  margin: 0;
  padding: 0;
  flex-direction: column;
  gap: 12px;
}

.symbol-table__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  box-shadow: inset 0 1px 0 var(--el-border-color-lighter);
}

.symbol-table__chevron {
  margin-left: 4px;
  transition: transform var(--el-transition-duration);
}

.symbol-table__chevron.is-open {
  transform: rotate(180deg);
}

/* 所有數字一種排法：名稱靠左、數字靠右，一列一項——.holdings-card__rows（main.css，觀察清單的卡片也用） */

/* 展開的部分：一條分隔線之後接著列下去（股數、預估年股利，再來是明細面板的平均成本…），列與列之間跟上面一樣 4px */
.symbol-table__more {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.view-card {
  display: none;
}

/* 表格／卡片的切換點設在 1279px，不是全站的 767px（使用者 2026-10-05：「a11y 要求放大 200% 也不可以跑版」）。
   量過（持股總覽 7 欄）：1920 寬放大 200%（=960px）溢出 148px；1024px 橫向螢幕會出現左側導覽欄，內容只剩約
   750px，7 欄表格至少要約 870px，溢出 142px。1280px 以上（含字型 120%）量到 0。欄少的頁面（已實現損益 3 欄）
   用同一個切換點，兩頁在同一個寬度長一樣。 */
@media (max-width: 1279px) {
  .view-table {
    display: none;
  }

  .view-card {
    display: flex;
  }
}
</style>
