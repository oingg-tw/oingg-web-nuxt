<script setup lang="ts">
import type { PresetChanges, PresetDraftRow } from '~/utils/preset-changes'
import type { PresetSelectItem } from './ScreenerPresetSelect.vue'

// 「我的篩選」的「管理」（2026-10-22，使用者在三個做法裡選 B 彈窗，方案頁 claude.ai/artifact/Jqhk3ntFqsVKt8fs8Wkdgw；同日：「如果用彈窗
// 改名 就 不用倒數了」）。彈窗裡改的是草稿：按「儲存」才一起套用，按「取消」、Esc 或關掉就全部作廢。
//   - 刪除不用 10 秒倒數：那一列留在原位寫「儲存後刪除」，旁邊有「復原」。全站的復原提示在彈窗外面，焦點鎖住時鍵盤按不到（方案頁實測）
//   - 名稱直接在列上改，不另開改名對話框（不疊彈窗）
//   - 上移、下移是真按鈕（WCAG 2.5.7），移動後焦點跟著那一列
//   - 內建、未儲存的那幾組固定在最前面、不能改；最後一組不能刪
//   - 名稱框按 Enter 就是「儲存」（2026-10-24，使用者：「管理我的篩選 連續按下enter 要視同儲存」）：清單是一個表單，「儲存」是它的送出鈕，
//     交給瀏覽器的隱式送出——注音、倉頡選字確認的那一下 Enter 瀏覽器不會拿來送出，選完再按一次才存
//   - 「複製」（copyable，只有我的篩選；2026-11-02，使用者：「管理我的篩選 彈跳視窗 要多一個 複製 按鈕」）：原本那一組下面多一列副本、
//     名稱可以先改，同樣按「儲存」才建立；副本的「刪除」直接拿掉那一列（還沒建立，沒有東西要復原）
// 套用順序（改名 → 複製 → 刪除 → 排序）由 ScreenerPageShell 負責
// 手機從下延展、桌機置中（2026-11-02，.condition-panel）：手機置中的彈窗裡有名稱框，鍵盤一彈起就把彈窗往上擠
interface Row extends PresetDraftRow {
  unsaved: boolean
}

const props = defineProps<{ label: string, items: PresetSelectItem[], copyable?: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ save: [changes: PresetChanges] }>()

const uid = useId()
const rows = ref<Row[]>([])
const errors = ref<Record<string, string>>({})
const status = ref('')
const listRef = ref<HTMLElement | null>(null)
// 第一次打開才建立對話框（同 SharedMetricColumnPicker）：關著的 el-dialog 在伺服器也會畫出遮罩、配一個 z-index，跟同頁其他對話框的
// 順序在伺服器與瀏覽器對不上（hydration 不一致）
const everOpened = ref(open.value)

// 每次打開都從目前的清單重來（上次沒儲存的草稿不留）
watch(open, (value) => {
  if (!value) return
  everOpened.value = true
  rows.value = props.items.map(item => ({
    id: item.id,
    name: item.name,
    original: item.name,
    editable: item.editable !== false,
    removed: false,
    unsaved: !!item.unsaved
  }))
  errors.value = {}
  status.value = ''
})

const standing = computed(() => rows.value.filter(row => !row.removed).length)

function canMove(index: number, offset: -1 | 1): boolean {
  const row = rows.value[index]
  const neighbor = rows.value[index + offset]
  return !!row && row.editable && !row.removed && !!neighbor && neighbor.editable
}

// 列重排、換成另一個樣子之後，焦點放回那一列（被 Vue 換掉或搬動的按鈕會把焦點丟到 <body>，也就是彈窗後面）
async function focusRow(id: string, ...actions: string[]) {
  await nextTick()
  for (const action of actions) {
    const target = listRef.value?.querySelector<HTMLElement>(`[data-id="${id}"] [data-action="${action}"]:not(:disabled)`)
    if (target) return target.focus()
  }
}

function move(index: number, offset: -1 | 1) {
  if (!canMove(index, offset)) return
  const list = [...rows.value]
  const [row] = list.splice(index, 1)
  list.splice(index + offset, 0, row!)
  rows.value = list
  status.value = `「${row!.name.trim() || row!.original}」移到第 ${index + offset + 1} 個`
  focusRow(row!.id, offset < 0 ? 'up' : 'down', offset < 0 ? 'down' : 'up')
}

function setRemoved(row: Row, removed: boolean) {
  row.removed = removed
  status.value = removed ? `「${row.original}」會在儲存後刪除` : `已復原「${row.original}」`
  focusRow(row.id, removed ? 'restore' : 'remove')
}

let copySeq = 0
function copy(index: number) {
  const source = rows.value[index]!
  const sourceName = source.name.trim() || source.original
  const name = `${sourceName} 的副本`.slice(0, 20)
  const row: Row = { id: `copy-${++copySeq}`, name, original: name, editable: true, removed: false, unsaved: false, copyOf: source.id }
  const list = [...rows.value]
  list.splice(index + 1, 0, row)
  rows.value = list
  status.value = `已複製「${sourceName}」，儲存後建立「${name}」`
  // 焦點進副本的名稱框：多半接著要改名
  nextTick(() => document.getElementById(`${uid}-${row.id}`)?.focus())
}

function dropCopy(row: Row) {
  rows.value = rows.value.filter(item => item !== row)
  status.value = `不建立「${row.name.trim() || row.original}」`
  focusRow(row.copyOf!, 'copy', 'restore')
}

function save() {
  errors.value = presetNameErrors(rows.value)
  const invalid = Object.keys(errors.value)[0]
  if (invalid) {
    document.getElementById(`${uid}-${invalid}`)?.focus()
    return
  }
  emit('save', presetChanges(props.items.map(item => item.id), rows.value))
  open.value = false
}
</script>

<template>
  <el-dialog
    v-if="everOpened"
    v-model="open"
    :title="`管理${label}`"
    class="preset-manage condition-panel condition-panel--narrow"
    modal-class="condition-panel-overlay"
  >
    <form :id="`${uid}-form`" @submit.prevent="save">
    <ul ref="listRef" class="preset-manage__list">
      <li v-for="(row, index) in rows" :key="row.id" :data-id="row.id" class="preset-manage__row">
        <template v-if="row.removed">
          <span class="preset-manage__name preset-manage__name--removed">「{{ row.original }}」儲存後刪除</span>
          <div class="preset-manage__actions">
            <el-button link type="primary" data-action="restore" :aria-label="`復原「${row.original}」`" @click="setRemoved(row, false)">復原</el-button>
          </div>
        </template>
        <template v-else-if="row.editable">
          <label :for="`${uid}-${row.id}`" class="visually-hidden">「{{ row.original }}」的名稱</label>
          <el-input
            :id="`${uid}-${row.id}`"
            v-model="row.name"
            class="preset-manage__input"
            :maxlength="20"
            :aria-invalid="errors[row.id] ? 'true' : undefined"
            :aria-describedby="errors[row.id] ? `${uid}-${row.id}-error` : undefined"
          />
          <div class="preset-manage__actions">
            <el-button link data-action="up" :disabled="!canMove(index, -1)" :aria-label="`把「${row.original}」上移`" @click="move(index, -1)">上移</el-button>
            <el-button link data-action="down" :disabled="!canMove(index, 1)" :aria-label="`把「${row.original}」下移`" @click="move(index, 1)">下移</el-button>
            <el-button v-if="copyable && !row.copyOf" link data-action="copy" :aria-label="`複製「${row.original}」`" @click="copy(index)">複製</el-button>
            <el-button link type="danger" data-action="remove" :disabled="standing <= 1" :aria-label="`刪除「${row.original}」`" @click="row.copyOf ? dropCopy(row) : setRemoved(row, true)">刪除</el-button>
          </div>
          <p v-if="row.copyOf" class="preset-manage__hint">儲存後建立</p>
          <p v-if="errors[row.id]" :id="`${uid}-${row.id}-error`" class="preset-manage__error">{{ errors[row.id] }}</p>
        </template>
        <span v-else class="preset-manage__name">
          {{ row.name }}<span class="preset-manage__note">{{ row.unsaved ? '（未儲存，存起來之後才能管理）' : '（內建，不能改）' }}</span>
        </span>
      </li>
    </ul>
    </form>
    <p class="visually-hidden" role="status">{{ status }}</p>
    <!-- 一組都不能改（訪客、只有內建那一組）就沒有東西可存 -->
    <template #footer>
      <template v-if="rows.some(row => row.editable)">
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" native-type="submit" :form="`${uid}-form`">儲存</el-button>
      </template>
      <el-button v-else @click="open = false">關閉</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.preset-manage__list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* 窄的時候名稱一行、按鈕一行；寬的時候同一行 */
.preset-manage__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  min-height: 56px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.preset-manage__input,
.preset-manage__name {
  flex: 1 1 12em;
  min-width: 0;
}

.preset-manage__name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.preset-manage__name--removed,
.preset-manage__note {
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.preset-manage__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
}

/* 觸控高度 44px（全站規則），el-button 相鄰時的 margin-left 由 gap 取代 */
.preset-manage__actions .el-button {
  min-height: 44px;
  margin: 0;
}

.preset-manage__error,
.preset-manage__hint {
  flex-basis: 100%;
  margin: 0;
}

.preset-manage__error {
  color: var(--el-color-danger);
}

.preset-manage__hint {
  color: var(--el-text-color-secondary);
}
</style>
