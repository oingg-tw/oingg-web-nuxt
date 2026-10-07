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
}
</script>

<script setup lang="ts" generic="T extends HoldingsSymbolRow">
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
const props = defineProps<{
  rows: T[]
  columns: HoldingsSymbolColumn<T>[]
  defaultSort: string
  // [收合時, 展開時]
  toggleLabels: [string, string]
}>()
const emit = defineEmits<{ open: [symbol: string] }>()
const expanded = defineModel<string[]>('expanded', { required: true })
defineSlots<{ detail: (props: { row: T }) => unknown }>()

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

const summaryColumns = computed(() => props.columns.filter(column => column.card === 'summary'))
const detailColumns = computed(() => props.columns.filter(column => column.card === 'detail'))

function toneClass(column: HoldingsSymbolColumn<T>, row: T) {
  return column.tone ? priceDirectionClass(column.tone(row)) : ''
}

function toggle(symbol: string) {
  if (expanded.value.includes(symbol)) {
    expanded.value = expanded.value.filter(item => item !== symbol)
    return
  }
  expanded.value = [...expanded.value, symbol]
  emit('open', symbol)
}
</script>

<template>
  <div>
    <!-- view-card：選單只跟卡片一起出現（寬螢幕用表頭） -->
    <label class="symbol-table__sort view-card">
      <span>排序</span>
      <select v-model="sortKey" class="symbol-table__select">
        <option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </label>

    <el-table class="view-table" :data="sortedRows" row-key="symbol" :expand-row-keys="expanded" @sort-change="onSortChange">
      <!-- 展開列只拿來放明細；開關是「明細」那顆按鈕（aria-expanded）。el-table 自己的展開箭頭藏起來，
           免得同一件事有兩個開關 -->
      <el-table-column type="expand" label="交易紀錄" width="1" class-name="symbol-table__expand-col" label-class-name="symbol-table__expand-col">
        <template #default="{ row }">
          <slot name="detail" :row="tableRow<T>(row)" />
        </template>
      </el-table-column>
      <el-table-column label="名稱" prop="symbol" min-width="170" sortable :sort-method="compareBy('symbol')">
        <template #default="{ row }">
          <div class="symbol-table__name">
            <NuxtLink :to="tableRow<T>(row).link">{{ tableRow<T>(row).name }}</NuxtLink>
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
      <el-table-column label="明細" min-width="110">
        <template #default="{ row }">
          <!-- 念出來的名稱＝看得到的字＋股票名（WCAG 2.5.3），狀態交給 aria-expanded -->
          <el-button :aria-expanded="expanded.includes(tableRow<T>(row).symbol)" @click="toggle(tableRow<T>(row).symbol)">
            {{ expanded.includes(tableRow<T>(row).symbol) ? toggleLabels[1] : toggleLabels[0] }}<span class="visually-hidden">：{{ tableRow<T>(row).label }}</span>
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <ul class="view-card symbol-table__cards">
      <li v-for="row in sortedRows" :key="row.symbol" class="symbol-table__card holdings-card">
        <div class="symbol-table__name">
          <NuxtLink :to="row.link">{{ row.name }}</NuxtLink>
          <span class="symbol-table__code">{{ row.symbol }}</span>
          <el-tag v-if="row.kind === 'etf'" size="small" effect="plain">ETF</el-tag>
          <el-tag v-else-if="row.kind === 'preferred'" size="small" effect="plain">特別股</el-tag>
        </div>
        <dl v-if="summaryColumns.length" class="symbol-table__figures">
          <div v-for="column in summaryColumns" :key="column.key">
            <dt>{{ column.label }}</dt>
            <dd :class="toneClass(column, row)">{{ (column.cardText ?? column.text)(row) }}</dd>
          </div>
        </dl>
        <el-button class="symbol-table__toggle" :aria-expanded="expanded.includes(row.symbol)" @click="toggle(row.symbol)">
          {{ expanded.includes(row.symbol) ? toggleLabels[1] : toggleLabels[0] }}<span class="visually-hidden">：{{ row.label }}</span>
        </el-button>
        <template v-if="expanded.includes(row.symbol)">
          <dl v-if="detailColumns.length" class="symbol-table__figures">
            <div v-for="column in detailColumns" :key="column.key">
              <dt>{{ column.label }}</dt>
              <dd :class="toneClass(column, row)">{{ (column.cardText ?? column.text)(row) }}</dd>
            </div>
          </dl>
          <slot name="detail" :row="row" />
        </template>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.symbol-table__sort {
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.symbol-table__select {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font: inherit;
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
  gap: 8px;
}

/* 展開的明細可能有自己的表格，不能把卡片撐寬 */
.symbol-table__card > * {
  min-width: 0;
}

/* 手機卡片裡不再包第二層底色：明細直接接在卡片裡，用一條分隔線分開（HoldingsDetailPanel 的根元素） */
.symbol-table__card :deep(.detail) {
  padding: 12px 0 0;
  border-top: 1px solid var(--el-border-color-lighter);
  background: none;
}

.symbol-table__figures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin: 0;
}

.symbol-table__figures dt {
  color: var(--el-text-color-regular);
}

.symbol-table__figures dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.symbol-table__toggle {
  min-height: 44px;
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
