<script setup lang="ts" generic="T">
// 可以點表頭排序的伺服器渲染資料表（2026-10-21，使用者：「台股產業索引 表格欄位要可以排序 這邊請抽成共用元件 盤點整個專案是否有可以
// 共用的地方」）。用在「一列一個對象、欄位可以互相比」的表：產業索引、景氣敏感度、類股頁的公司表、大盤歷次修正。按時間排的歷史表
// 與加減算式的分解表不用它——那些的列順序本身就是內容。
//
// - 伺服器照 rows 原本的順序輸出（搜尋引擎看到的不變），排序只在瀏覽器做、不進網址，所以不會多出網址變體
// - 點一下：數字欄由大到小、文字欄由小到大；再點反過來；第三下回到原本的順序。沒有值的一律排最後
// - 無障礙照 ARIA 的可排序表格模式：表頭裡是真的 <button>，排序中的那一欄 <th> 帶 aria-sort，換排序時念一句
// - 每一列的格子由呼叫端的 #row 畫（連結、格式各頁自己決定），順序要跟 columns 一致；第一格照慣例用 <th scope="row">
export interface SortableColumn<Row> {
  key: string
  label: string
  // 靠右對齊的數字欄
  num?: boolean
  // 排序用的值；不給就不能排序。回傳數字的欄位第一下由大到小
  sortValue?: (row: Row) => number | string | null | undefined
}

const props = defineProps<{
  rows: T[]
  columns: SortableColumn<T>[]
  rowKey: (row: T) => string
  // 捲動區的名稱（SharedTableScroll）
  label: string
  // 表格說明；要藏起來（畫面上已有同義的句子）用 captionHidden
  caption?: string
  captionHidden?: boolean
}>()

defineSlots<{ row: (props: { row: T }) => unknown }>()

const sort = ref<{ key: string; dir: 'ascending' | 'descending' } | null>(null)
const status = ref('')

const isNumeric = (column: SortableColumn<T>) => props.rows.some(row => typeof column.sortValue?.(row) === 'number')

function toggle(column: SortableColumn<T>) {
  const first = isNumeric(column) ? 'descending' : 'ascending'
  const current = sort.value?.key === column.key ? sort.value.dir : null
  const next = current === null ? first : current === first ? (first === 'ascending' ? 'descending' : 'ascending') : null
  sort.value = next ? { key: column.key, dir: next } : null
  status.value = next
    ? `依${column.label}${isNumeric(column) ? (next === 'descending' ? '由大到小' : '由小到大') : (next === 'ascending' ? '遞增' : '遞減')}排序`
    : '回到原本的順序'
}

const sortedRows = computed(() => {
  const active = sort.value
  const column = active && props.columns.find(item => item.key === active.key)
  if (!active || !column?.sortValue) return props.rows
  const value = column.sortValue
  const sign = active.dir === 'ascending' ? 1 : -1
  return [...props.rows].sort((a, b) => {
    const x = value(a)
    const y = value(b)
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1
    return sign * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'zh-Hant'))
  })
})
</script>

<template>
  <SharedTableScroll :label="label">
    <table class="seo-table" data-ssr-table>
      <caption v-if="caption" :class="{ 'visually-hidden': captionHidden }">{{ caption }}</caption>
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            :class="{ 'seo-table__num': column.num }"
            :aria-sort="sort?.key === column.key ? sort.dir : undefined"
          >
            <button v-if="column.sortValue" type="button" class="sortable-table__button" @click="toggle(column)">
              {{ column.label }}<SharedSortIcon :state="sort?.key === column.key ? sort.dir : null" />
            </button>
            <template v-else>{{ column.label }}</template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in sortedRows" :key="rowKey(row)">
          <slot name="row" :row="row" />
        </tr>
      </tbody>
    </table>
  </SharedTableScroll>
  <p class="visually-hidden" role="status">{{ status }}</p>
</template>

<style scoped>
/* 表頭的字就是按鈕：樣子跟其他表頭一樣，只多排序圖示（SharedSortIcon） */
.sortable-table__button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}

.sortable-table__button:hover {
  color: var(--el-color-primary-dark-2);
}
</style>
