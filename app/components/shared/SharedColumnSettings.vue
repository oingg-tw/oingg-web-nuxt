<script setup lang="ts" generic="C extends { field: string, label: string }">
import type { MetricCategory } from '~/composables/screener/useFilterSchema'

// 欄位設定：表頭拖曳與表頭小 × 的替代（WCAG 2.1.1／2.5.7），篩選（SharedMetricTable）與觀察清單共用。2026-10-22 從「就地展開」改成
// 彈窗（使用者：「篩選 欄位設定沒有彈窗」，選了篩選與觀察清單一起改），規則同「我的篩選」的管理彈窗：
//   - 改的是草稿：按「儲存」才把整份欄位交給呼叫端（save）；呼叫端檢查完自己的部分再呼叫 close。取消、Esc、× 作廢
//   - 新增欄位在同一個彈窗換一頁挑指標，挑了回到清單，不疊彈窗
//   - 方案額度、重複都寫在彈窗裡，不用彈窗外面的提示（焦點鎖住時鍵盤按不到）；「重設預設欄位」也只改草稿
//   - 篩選頁欄位組合的名稱、移動、刪除不在這裡：2026-10-21 曾併進來（#head「這一組」），11/1 使用者「希望管理 欄位設定 分開」，搬回「顯示欄位」的「管理」
// live（2026-11-01，篩選頁手機的「欄位 N 個」，使用者：「讓多條件或是多欄位的使用手感一樣」，選了立刻套用）：比照篩選條件的面板——
// 貼底面板（ScreenerConditionPanel 的 .condition-panel 樣式，篩選頁一定有掛）、每一步馬上 save、沒有儲存／取消；移除的那一列留在原位
// 寫「已移除」加「復原」，關掉面板才消失
export interface ColumnDraft {
  field: string
  label: string
}

const props = defineProps<{
  columns: C[]
  labelOf: (column: C) => string
  // 新增欄位那一頁可以挑的指標
  categories: MetricCategory[]
  // 最多幾欄（方案額度），到了就不能再加；what 是額度那句話的主詞（「觀察清單欄位」）
  limit?: { max: number, what: string } | null
  // 「重設預設欄位」重設成這一份；不給就沒有這顆
  defaults?: ColumnDraft[]
  live?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ save: [columns: ColumnDraft[], close: () => void] }>()

interface Row extends ColumnDraft {
  text: string
  // live 才有：已移除、還能復原
  removed?: boolean
}

const uid = useId()
const step = ref<'list' | 'pick'>('list')
const rows = ref<Row[]>([])
// 看得到的說明（重複、額度）；status 是唸給螢幕閱讀器的
const notice = ref<{ text: string, plan: boolean } | null>(null)
const status = ref('')
const listRef = ref<HTMLElement | null>(null)
// 第一次打開才建立對話框（同 SharedMetricColumnPicker）：關著的 el-dialog 在伺服器也會畫出遮罩、配一個 z-index，跟同頁其他對話框的
// 順序在伺服器與瀏覽器對不上（hydration 不一致）
const everOpened = ref(open.value)

watch(open, (value) => {
  if (!value) return
  everOpened.value = true
  step.value = 'list'
  rows.value = props.columns.map(column => ({ field: column.field, label: column.label, text: props.labelOf(column) }))
  notice.value = null
  status.value = ''
})

const sameAsDefaults = computed(() => rows.value.map(row => row.field).join() === (props.defaults ?? []).map(row => row.field).join())

// 列重排、刪掉之後把焦點放回去（被 Vue 換掉的按鈕會把焦點丟到 <body>，也就是彈窗後面）；找不到就落在「新增欄位」
async function focusRow(field: string | null, ...actions: string[]) {
  await nextTick()
  for (const action of actions) {
    const target = listRef.value?.querySelector<HTMLElement>(`[data-field="${field}"] [data-action="${action}"]:not(:disabled)`)
    if (target) return target.focus()
  }
  document.getElementById(`${uid}-add`)?.focus()
}

function say(text: string, visible = false, plan = false) {
  status.value = text
  notice.value = visible ? { text, plan } : null
}

const shown = computed(() => rows.value.filter(row => !row.removed))
// live：每一步都把現在看得到的欄位交給呼叫端，不關面板
function commit() {
  if (props.live) emit('save', shown.value.map(({ field, label }) => ({ field, label })), () => {})
}

// 跳過已移除的列（live）：換位置是跟看得到的鄰居換
function neighbourIndex(index: number, offset: -1 | 1): number {
  let target = index + offset
  while (rows.value[target]?.removed) target += offset
  return rows.value[target] ? target : -1
}

function move(index: number, offset: -1 | 1) {
  const target = neighbourIndex(index, offset)
  if (target < 0) return
  const next = [...rows.value]
  const [row] = next.splice(index, 1)
  next.splice(target, 0, row!)
  rows.value = next
  say(`「${row!.text}」移到第 ${shown.value.indexOf(row!) + 1} 欄`)
  commit()
  focusRow(row!.field, offset < 0 ? 'up' : 'down', offset < 0 ? 'down' : 'up')
}

function remove(index: number) {
  if (props.live) {
    rows.value[index]!.removed = true
    say(`已移除「${rows.value[index]!.text}」`)
    commit()
    focusRow(rows.value[index]!.field, 'restore')
    return
  }
  const [row] = rows.value.splice(index, 1)
  const neighbour = rows.value[index] ?? rows.value[index - 1]
  say(`已移除「${row!.text}」`)
  focusRow(neighbour?.field ?? null, 'remove')
}

function restore(index: number) {
  rows.value[index]!.removed = false
  say(`已復原「${rows.value[index]!.text}」`)
  commit()
  focusRow(rows.value[index]!.field, 'remove')
}

function startAdd() {
  if (props.limit && shown.value.length >= props.limit.max) {
    say(quotaReachedText(props.limit.what), true, true)
    return
  }
  say('')
  step.value = 'pick'
}

function pick(field: string, label: string) {
  step.value = 'list'
  const existing = rows.value.find(row => row.field === field)
  if (existing && !existing.removed) {
    say(`「${existing.text}」已經在表格裡`, true)
    focusRow(field, 'remove')
    return
  }
  // live 裡已移除的那一列再挑一次：拿掉舊的那列、接在最後
  rows.value = [...rows.value.filter(row => row !== existing), { field, label, text: label }]
  say(`已新增「${label}」，在最後一欄`)
  commit()
  focusRow(field, 'remove')
}

function backToList() {
  step.value = 'list'
  focusRow(null)
}

function resetDefaults() {
  rows.value = (props.defaults ?? []).map(row => ({ ...row, text: row.label }))
  say(props.live ? '已重設為預設欄位' : '已重設為預設欄位，按「儲存」才會生效', true)
  commit()
}

function save() {
  emit('save', rows.value.map(({ field, label }) => ({ field, label })), () => { open.value = false })
}
</script>

<template>
  <!-- 寬度與手機滿版寫在 CSS（同 SharedMetricColumnPicker）：挑指標那一頁要寬，清單那一頁窄一點 -->
  <el-dialog
    v-if="everOpened"
    v-model="open"
    :title="step === 'pick' ? '新增欄位' : live ? '欄位' : '欄位設定'"
    class="column-settings"
    :class="live ? ['column-settings--live', 'condition-panel', { 'condition-panel--narrow': step === 'list' }] : { 'column-settings--pick': step === 'pick' }"
    :modal-class="live ? 'condition-panel-overlay' : undefined"
    :align-center="false"
    destroy-on-close
    lock-scroll
  >
    <div v-show="step === 'list'">
      <ol ref="listRef" class="column-settings__list" aria-label="表格的欄位，由左到右">
        <li v-for="(row, index) in rows" :key="row.field" :data-field="row.field" class="column-settings__row">
          <template v-if="row.removed">
            <span class="column-settings__label column-settings__label--removed">已移除「{{ row.text }}」</span>
            <span class="column-settings__actions">
              <el-button link type="primary" data-action="restore" :aria-label="`復原「${row.text}」`" @click="restore(index)">復原</el-button>
            </span>
          </template>
          <template v-else>
            <span class="column-settings__label">{{ row.text }}</span>
            <span class="column-settings__actions">
              <el-button link data-action="up" :disabled="neighbourIndex(index, -1) < 0" :aria-label="`把「${row.text}」上移`" @click="move(index, -1)">上移</el-button>
              <el-button link data-action="down" :disabled="neighbourIndex(index, 1) < 0" :aria-label="`把「${row.text}」下移`" @click="move(index, 1)">下移</el-button>
              <el-button link type="danger" data-action="remove" :aria-label="`移除「${row.text}」`" @click="remove(index)">移除</el-button>
            </span>
          </template>
        </li>
      </ol>
      <div class="column-settings__footer">
        <el-button :id="`${uid}-add`" @click="startAdd">＋ 新增欄位</el-button>
        <el-button v-if="defaults" :disabled="sameAsDefaults" @click="resetDefaults">重設預設欄位</el-button>
      </div>
      <p v-if="notice" class="column-settings__notice">
        {{ notice.text }}<NuxtLink v-if="notice.plan" to="/profile#plan" class="column-settings__plan">看方案<span aria-hidden="true"> →</span></NuxtLink>
      </p>
    </div>
    <ScreenerIndicatorPickerBody v-if="step === 'pick'" :categories="categories" :active="open && step === 'pick'" :hide-period="false" @select="pick" />
    <p class="visually-hidden" role="status">{{ status }}</p>
    <!-- live 的清單那一頁沒有按鈕列（同篩選條件的清單），關掉就好 -->
    <template v-if="!live || step === 'pick'" #footer>
      <template v-if="step === 'list'">
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" @click="save">儲存</el-button>
      </template>
      <el-button v-else :size="live ? 'large' : undefined" @click="backToList">{{ live ? '上一步：欄位清單' : '上一步' }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.column-settings__list {
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--el-border-color-lighter);
}

.column-settings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0 12px;
  min-height: 56px;
  padding: 4px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.column-settings__actions,
.column-settings__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
}

.column-settings__footer {
  gap: 8px;
}

/* 觸控高度 44px（全站規則），el-button 相鄰時的 margin-left 由 gap 取代 */
.column-settings__actions .el-button,
.column-settings__footer .el-button {
  min-height: 44px;
  margin: 0;
}

.column-settings__label--removed {
  color: var(--el-text-color-secondary);
}

.column-settings__notice {
  margin: 12px 0 0;
  color: var(--el-text-color-regular);
}

.column-settings__plan {
  margin-left: 4px;
  font-weight: 600;
  color: var(--el-color-primary-dark-2);
}
</style>

<style>
/* 不加 scoped：el-dialog teleport 到 body。清單那一頁 640px；挑指標那一頁同 SharedMetricColumnPicker 的 960px、每一欄 9.5 列 */
.el-dialog.column-settings {
  --el-dialog-width: min(640px, 92vw);
}

.el-dialog.column-settings--pick {
  --el-dialog-width: min(960px, 92vw);
}

@media (min-width: 768px) {
  .el-dialog.column-settings--pick .indicator-dialog {
    max-width: none;
    --indicator-rows: 9.5;
  }
}

/* 手機滿版（同 SharedMetricColumnPicker）：外框固定是整個畫面，清單或挑指標的內容在裡面捲。live 是貼底面板（.condition-panel），不滿版 */
@media (max-width: 767px) {
  .el-dialog.column-settings:not(.column-settings--live) {
    --el-dialog-width: 100%;
    height: 100%;
    max-height: none;
    margin: 0;
    border-radius: 0;
  }
}
</style>
