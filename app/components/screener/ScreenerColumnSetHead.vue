<script setup lang="ts">
import type { PresetDraftRow } from '~/utils/preset-changes'
import type { PresetSelectItem } from './ScreenerPresetSelect.vue'

// 欄位設定彈窗最上面的「這一組」（2026-10-22 欄位設定改成彈窗）：目前這一組欄位組合的名稱、上移、下移、刪除。2026-10-21 使用者把
// 顯示欄位的「管理」併進欄位設定（「管理與欄位設定是否可以合併」），所以這幾個動作在這裡、只動目前這一組。
// 跟「我的篩選」的管理彈窗同一套草稿（preset-changes.ts）：按「儲存」時 ScreenerPageShell 讀 validate／changes 依序套用，取消就作廢。
// 彈窗是 destroy-on-close，每次打開這個元件都重新建立，草稿從目前的清單重來
const props = defineProps<{ items: PresetSelectItem[], activeId: string }>()

const uid = useId()
const rows = ref<PresetDraftRow[]>(props.items.map(item => ({ id: item.id, name: item.name, original: item.name, editable: item.editable !== false, removed: false })))
const index = computed(() => rows.value.findIndex(row => row.id === props.activeId))
const row = computed(() => rows.value[index.value] ?? null)
const standing = computed(() => rows.value.filter(item => !item.removed).length)
const error = ref('')
const status = ref('')
const rootRef = ref<HTMLElement | null>(null)

function canMove(offset: -1 | 1): boolean {
  const neighbor = rows.value[index.value + offset]
  return !!row.value?.editable && !row.value.removed && !!neighbor && neighbor.editable
}

async function focusAction(...actions: string[]) {
  await nextTick()
  for (const action of actions) {
    const target = rootRef.value?.querySelector<HTMLElement>(`[data-action="${action}"]:not(:disabled)`)
    if (target) return target.focus()
  }
}

function move(offset: -1 | 1) {
  if (!canMove(offset)) return
  const list = [...rows.value]
  const [moved] = list.splice(index.value, 1)
  list.splice(index.value + offset, 0, moved!)
  rows.value = list
  status.value = `這一組移到第 ${index.value + 1} 組`
  focusAction(offset < 0 ? 'up' : 'down', offset < 0 ? 'down' : 'up')
}

function setRemoved(removed: boolean) {
  if (!row.value) return
  row.value.removed = removed
  status.value = removed ? `「${row.value.original}」會在儲存後刪除` : `已復原「${row.value.original}」`
  focusAction(removed ? 'restore' : 'remove')
}

function validate(): boolean {
  error.value = presetNameErrors(rows.value)[props.activeId] ?? ''
  if (error.value) document.getElementById(`${uid}-name`)?.focus()
  return !error.value
}

defineExpose({
  validate,
  changes: () => presetChanges(props.items.map(item => item.id), rows.value),
  activeRemoved: () => !!row.value?.removed
})
</script>

<template>
  <div ref="rootRef" class="column-set-head" role="group" :aria-labelledby="`${uid}-title`">
    <p :id="`${uid}-title`" class="column-set-head__title">
      這一組<span v-if="row?.editable && !row.removed" class="column-set-head__position">（第 {{ index + 1 }} 組，共 {{ rows.length }} 組）</span>
    </p>
    <template v-if="row?.removed">
      <p class="column-set-head__note">「{{ row.original }}」儲存後刪除；這一組的欄位修改不會存。</p>
      <el-button link type="primary" data-action="restore" :aria-label="`復原「${row.original}」`" @click="setRemoved(false)">復原</el-button>
    </template>
    <template v-else-if="row?.editable">
      <label :for="`${uid}-name`" class="visually-hidden">這一組的名稱</label>
      <el-input
        :id="`${uid}-name`"
        v-model="row.name"
        class="column-set-head__input"
        :maxlength="20"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? `${uid}-error` : undefined"
      />
      <span class="column-set-head__actions">
        <el-button link data-action="up" :disabled="!canMove(-1)" aria-label="把這一組上移" @click="move(-1)">上移</el-button>
        <el-button link data-action="down" :disabled="!canMove(1)" aria-label="把這一組下移" @click="move(1)">下移</el-button>
        <el-button link type="danger" data-action="remove" :disabled="standing <= 1" @click="setRemoved(true)">刪除這一組</el-button>
      </span>
      <p v-if="error" :id="`${uid}-error`" class="column-set-head__error">{{ error }}</p>
    </template>
    <p v-else class="column-set-head__note">{{ row?.name }}：這一組不能改名、移動或刪除；按「＋新增」建一組自己的。</p>
    <p class="visually-hidden" role="status">{{ status }}</p>
  </div>
</template>

<style scoped>
.column-set-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color);
}

.column-set-head__title {
  flex-basis: 100%;
  margin: 0;
  font-weight: 600;
}

.column-set-head__position {
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.column-set-head__input {
  flex: 1 1 12em;
  min-width: 0;
}

.column-set-head__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
}

/* 觸控高度 44px（全站規則），el-button 相鄰時的 margin-left 由 gap 取代 */
.column-set-head .el-button {
  min-height: 44px;
  margin: 0;
}

.column-set-head__note {
  flex: 1 1 12em;
  margin: 0;
  color: var(--el-text-color-regular);
}

.column-set-head__error {
  flex-basis: 100%;
  margin: 0;
  color: var(--el-color-danger);
}
</style>
