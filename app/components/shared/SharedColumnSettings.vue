<script setup lang="ts" generic="C extends { field: string }">
// 欄位設定：表頭拖曳與表頭小 × 的替代（WCAG 2.1.1／2.5.7），就地展開、不是對話框。2026-10-17 從 SharedMetricTable 抽出：
// 觀察清單換成 SharedSheetGrid 之後也用同一份——上移／下移／移除、焦點與朗讀只有這裡一份。
const props = defineProps<{
  id: string
  columns: C[]
  labelOf: (column: C) => string
}>()

const emit = defineEmits<{
  reorder: [fields: string[]]
  remove: [field: string]
  add: [triggerEl: HTMLElement]
}>()

const status = ref('')
const focusById = (id: string) => nextTick(() => document.getElementById(id)?.focus())

function move(index: number, offset: -1 | 1) {
  const target = index + offset
  if (target < 0 || target >= props.columns.length) return
  const next = [...props.columns]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  emit('reorder', next.map(column => column.field))
  status.value = `${props.labelOf(next[target]!)} 移到第 ${target + 1} 欄`
  // 焦點跟著那一欄；移到頭或尾時那一顆會 disabled，改落到另一顆
  const atEdge = offset < 0 ? target === 0 : target === props.columns.length - 1
  const button = atEdge ? (offset < 0 ? 'down' : 'up') : (offset < 0 ? 'up' : 'down')
  focusById(`${props.id}-${button}-${next[target]!.field}`)
}

// 按鈕跟著那一列消失：焦點落到下一欄的移除鈕，沒有就上一欄，都沒有就「新增欄位」，不掉到 body
function remove(index: number) {
  const column = props.columns[index]!
  const neighbour = props.columns[index + 1] ?? props.columns[index - 1]
  status.value = `已移除 ${props.labelOf(column)} 欄`
  emit('remove', column.field)
  focusById(neighbour ? `${props.id}-remove-${neighbour.field}` : `${props.id}-add`)
}
</script>

<template>
  <div :id="id" class="column-settings">
    <!-- 呼叫端放在欄位清單上面的東西（篩選頁：這一組欄位組合的改名、上移、下移、刪除） -->
    <slot name="head" />
    <ol class="column-settings__list">
      <li v-for="(column, index) in columns" :key="column.field" class="column-settings__row">
        <span class="column-settings__label">{{ labelOf(column) }}</span>
        <span class="column-settings__actions">
          <button :id="`${id}-up-${column.field}`" type="button" class="column-settings__button" :disabled="index === 0" @click="move(index, -1)">上移<span class="visually-hidden">：{{ labelOf(column) }}</span></button>
          <button :id="`${id}-down-${column.field}`" type="button" class="column-settings__button" :disabled="index === columns.length - 1" @click="move(index, 1)">下移<span class="visually-hidden">：{{ labelOf(column) }}</span></button>
          <button :id="`${id}-remove-${column.field}`" type="button" class="column-settings__button" @click="remove(index)">移除<span class="visually-hidden">：{{ labelOf(column) }}</span></button>
        </span>
      </li>
    </ol>
    <div class="column-settings__footer">
      <button :id="`${id}-add`" type="button" class="column-settings__button" @click="emit('add', $event.currentTarget as HTMLElement)">＋ 新增欄位</button>
      <!-- 呼叫端自己的欄位動作（觀察清單的「重設預設欄位」）：給它 column-settings__button，樣子跟面板一致 -->
      <slot />
    </div>
    <p class="visually-hidden" role="status">{{ status }}</p>
  </div>
</template>

<style scoped>
.column-settings {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--el-card-border-radius, 4px);
  background: var(--el-bg-color);
}

.column-settings__list {
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}

.column-settings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.column-settings__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.column-settings__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.column-settings__button,
:slotted(.column-settings__button) {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font: inherit;
  cursor: pointer;
}

.column-settings__button:disabled,
:slotted(.column-settings__button:disabled) {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
