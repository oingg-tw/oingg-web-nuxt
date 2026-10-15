<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
// 「我的篩選」與「顯示欄位」共用的一列：下拉選單＋「＋新增」＋「管理」（2026-10-15 三組篩選重新設計，使用者選「一個選單＋欄位選單」）。
// 取代原本的兩排分頁標籤（PresetFolder）：標籤一多，手機上整列超出畫面（ETF 那一列量到 1386px 寬），切換時標籤列與內容高度也會跳。
// 下拉選單不論有幾組都只佔一行。
//
// 管理選單裡是真的按鈕：改名、上移、下移、刪除，不靠拖曳也不靠「再點一次」（WCAG 2.1.1／2.5.7）。刪除先藏起來、10 秒內可復原，
// 時間到才真的通知父層刪（同原本 PresetFolder 的做法，父層不用自己做復原）。最後一組不能刪。
export interface PresetSelectItem {
  id: string
  name: string
  // false＝不能改名、移動、刪除（例如訪客那一組的欄位）
  editable?: boolean
  // 名稱後面的註記，例如「未儲存」（從網址的範本或類股打開、還沒存成自己的篩選）
  note?: string
}

const props = defineProps<{
  // 看得見的標籤，也是這一組控制項的名稱：「我的篩選」「顯示欄位」
  label: string
  items: PresetSelectItem[]
  // 「＋新增」的可及名稱：「新增篩選」「新增欄位組合」
  addLabel: string
  // 沒有「＋新增」（例如訪客的欄位組合只有一組）
  hideAdd?: boolean
}>()

const activeId = defineModel<string>('activeId', { required: true })

const emit = defineEmits<{
  add: [triggerEl: HTMLElement]
  rename: [id: string, name: string]
  remove: [id: string]
  reorder: [ids: string[]]
}>()

const uid = useId()
const labelId = `${uid}-label`

// 刪除後藏起來、等復原提示結束才真的刪
const pendingRemoval = ref<string[]>([])
const visibleItems = computed(() => props.items.filter(item => !pendingRemoval.value.includes(item.id)))
const activeItem = computed(() => visibleItems.value.find(item => item.id === activeId.value) ?? null)
const activeIndex = computed(() => visibleItems.value.findIndex(item => item.id === activeId.value))
const editable = computed(() => activeItem.value?.editable !== false)
const status = ref('')

function optionLabel(item: PresetSelectItem) {
  return item.note ? `${item.name}（${item.note}）` : item.name
}

async function rename() {
  const item = activeItem.value
  if (!item) return
  try {
    const { value } = await ElMessageBox.prompt('新的名稱', `幫「${item.name}」改名`, {
      inputValue: item.name,
      confirmButtonText: '改名',
      cancelButtonText: '取消',
      inputValidator: (input: string) => (input.trim().length > 0 && input.trim().length <= 20) || '名稱要 1 到 20 個字'
    })
    const name = String(value).trim()
    if (name && name !== item.name) {
      emit('rename', item.id, name)
      status.value = `已改名為「${name}」`
    }
  } catch {
    // 取消
  }
}

function move(offset: -1 | 1) {
  const ids = visibleItems.value.map(item => item.id)
  const index = activeIndex.value
  const target = index + offset
  if (index < 0 || target < 0 || target >= ids.length) return
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  emit('reorder', ids)
  status.value = `「${activeItem.value?.name}」移到第 ${target + 1} 個`
}

function remove() {
  const item = activeItem.value
  if (!item || visibleItems.value.length <= 1) return
  const index = activeIndex.value
  pendingRemoval.value = [...pendingRemoval.value, item.id]
  const fallback = visibleItems.value[Math.max(index - 1, 0)]
  if (fallback) activeId.value = fallback.id
  let undone = false
  undoToast(`已刪除「${item.name}」`, () => {
    undone = true
    pendingRemoval.value = pendingRemoval.value.filter(id => id !== item.id)
    activeId.value = item.id
  }, () => {
    if (undone) return
    emit('remove', item.id)
    nextTick(() => { pendingRemoval.value = pendingRemoval.value.filter(id => id !== item.id) })
  })
}

function onCommand(command: string) {
  if (command === 'rename') rename()
  else if (command === 'up') move(-1)
  else if (command === 'down') move(1)
  else if (command === 'remove') remove()
}
</script>

<template>
  <div class="screener-preset-select" role="group" :aria-labelledby="labelId">
    <span :id="labelId" class="screener-preset-select__label">{{ label }}</span>
    <el-select
      :model-value="activeItem?.id ?? ''"
      class="screener-preset-select__select"
      :aria-labelledby="labelId"
      @update:model-value="(id: string) => { activeId = id }"
    >
      <el-option v-for="item in visibleItems" :key="item.id" :label="optionLabel(item)" :value="item.id" />
    </el-select>
    <el-button v-if="!hideAdd" class="screener-preset-select__button" :aria-label="addLabel" @click="emit('add', $event.currentTarget as HTMLElement)">＋新增</el-button>
    <el-dropdown trigger="click" popper-class="screener-preset-select__menu" @command="onCommand">
      <el-button class="screener-preset-select__button" :aria-label="`管理${label}`">管理</el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="rename" :disabled="!editable">改名</el-dropdown-item>
          <el-dropdown-item command="up" :disabled="!editable || activeIndex <= 0">上移</el-dropdown-item>
          <el-dropdown-item command="down" :disabled="!editable || activeIndex === visibleItems.length - 1">下移</el-dropdown-item>
          <el-dropdown-item command="remove" :disabled="!editable || visibleItems.length <= 1" divided>刪除</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <p class="visually-hidden" role="status">{{ status }}</p>
  </div>
</template>

<style scoped>
/* 手機：標籤一行、選單與兩顆按鈕一行（選單吃剩下的寬度）；寬的時候四個排成一行 */
.screener-preset-select {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.screener-preset-select__label {
  flex-basis: 100%;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.screener-preset-select__select {
  flex: 1;
  min-width: 0;
}

.screener-preset-select__select :deep(.el-select__wrapper) {
  min-height: 44px;
  font-size: 1rem;
}

.screener-preset-select__button {
  min-height: 44px;
  margin: 0;
  font-size: 1rem;
}

@media (min-width: 560px) {
  .screener-preset-select__label {
    flex-basis: auto;
  }

  .screener-preset-select__select {
    flex: 0 1 280px;
  }
}
</style>

<!-- 不加 scoped：下拉選單 teleport 到 body。每一項 ≥44px 高，觸控好按 -->
<style>
.screener-preset-select__menu .el-dropdown-menu__item {
  min-height: 44px;
  font-size: 1rem;
}
</style>
