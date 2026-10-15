<script setup lang="ts">
// 「我的篩選」與「顯示欄位」共用的一列：下拉選單＋「＋新增」＋「管理」（2026-10-15 三組篩選重新設計，使用者選「一個選單＋欄位選單」）。
// 取代原本的兩排分頁標籤（PresetFolder）：標籤一多，手機上整列超出畫面（ETF 那一列量到 1386px 寬），切換時標籤列與內容高度也會跳。
// 下拉選單不論有幾組都只佔一行。
//
// 管理選單裡是真的按鈕：改名、上移、下移、刪除，不靠拖曳也不靠「再點一次」（WCAG 2.1.1／2.5.7）。刪除先藏起來、10 秒內可復原，
// 時間到才真的通知父層刪（同原本 PresetFolder 的做法，父層不用自己做復原）。最後一組不能刪。
export interface PresetSelectItem {
  id: string
  name: string
  // false＝不能改名、移動、刪除（內建的「全部 ETF」「基本欄位」、訪客那一組）
  editable?: boolean
  // 還沒存進帳號：名稱後面標「未儲存」，旁邊出現「存成…」按鈕（訪客按下去是登入）
  unsaved?: boolean
}

const props = defineProps<{
  // 看得見的標籤，也是這一組控制項的名稱：「我的篩選」「顯示欄位」
  label: string
  items: PresetSelectItem[]
  // 「＋新增」的可及名稱：「新增篩選」「新增欄位組合」
  addLabel: string
  // 沒有「＋新增」（例如訪客的欄位組合只有一組）
  hideAdd?: boolean
  // 目前這一組未儲存時的按鈕文字：「存成我的篩選」「存成我的欄位組合」
  saveLabel: string
}>()

const activeId = defineModel<string>('activeId', { required: true })

const emit = defineEmits<{
  add: [triggerEl: HTMLElement]
  rename: [id: string, name: string]
  remove: [id: string]
  reorder: [ids: string[]]
  save: []
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
  return item.unsaved ? `${item.name}（未儲存）` : item.name
}

async function rename() {
  const item = activeItem.value
  if (!item) return
  const name = await promptPresetName(`幫「${item.name}」改名`, item.name, '改名')
  if (name && name !== item.name) {
    emit('rename', item.id, name)
    status.value = `已改名為「${name}」`
  }
}

// 內建、未儲存的那幾組固定在最前面：已存的不能移到它們前面（不然選單看起來動了、存回帳號的順序卻沒變）
function canMove(offset: -1 | 1): boolean {
  const neighbor = visibleItems.value[activeIndex.value + offset]
  return editable.value && activeIndex.value >= 0 && !!neighbor && neighbor.editable !== false
}

function move(offset: -1 | 1) {
  if (!canMove(offset)) return
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
    <!-- aria-label（不是 aria-labelledby）：Element Plus 只把 aria-label 轉給裡面真正的輸入框，aria-labelledby 留在外框（2026-10-15 axe 量到） -->
    <el-select
      :model-value="activeItem?.id ?? ''"
      class="screener-preset-select__select"
      :aria-label="label"
      @update:model-value="(id: string) => { activeId = id }"
    >
      <el-option v-for="item in visibleItems" :key="item.id" :label="optionLabel(item)" :value="item.id" />
    </el-select>
    <el-button v-if="activeItem?.unsaved" type="primary" class="screener-preset-select__button" @click="emit('save')">{{ saveLabel }}</el-button>
    <el-button v-if="!hideAdd" class="screener-preset-select__button" :aria-label="addLabel" @click="emit('add', $event.currentTarget as HTMLElement)">＋新增</el-button>
    <el-dropdown trigger="click" popper-class="screener-preset-select__menu" @command="onCommand">
      <el-button class="screener-preset-select__button" :aria-label="`管理${label}`">管理</el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="rename" :disabled="!editable">改名</el-dropdown-item>
          <el-dropdown-item command="up" :disabled="!canMove(-1)">上移</el-dropdown-item>
          <el-dropdown-item command="down" :disabled="!canMove(1)">下移</el-dropdown-item>
          <el-dropdown-item command="remove" :disabled="!editable || visibleItems.length <= 1" divided>刪除</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <p class="visually-hidden" role="status">{{ status }}</p>
  </div>
</template>

<style scoped>
/* 手機：標籤、選單、按鈕各一行；560px 起排成一行 */
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

/* 手機：選單獨佔一行（名稱不會被按鈕擠掉），按鈕排在下一行。高度跟全站規則走：滑鼠 32px、觸控 44px（main.css 的 pointer: coarse） */
.screener-preset-select__select {
  flex: 1 1 100%;
  min-width: 0;
}

.screener-preset-select__button {
  margin: 0;
  font-size: 1rem;
}

@media (min-width: 560px) {
  /* 一行就不換行（選單會縮）：這一組放在別人的同一列裡時（設定區、結果表工具列）寬度看內容，而 Chrome 算「會換行」的 flex 容器
     的內容寬度只取最寬的一個子項、不是加總，整組會被擠成標籤／選單／按鈕三行（2026-10-15 量到 276px 寬） */
  .screener-preset-select {
    flex-wrap: nowrap;
  }

  .screener-preset-select__label {
    flex-basis: auto;
    /* 中文可以在任何字之間斷：不換行之後要縮的是選單，不是把標籤擠成直排 */
    flex-shrink: 0;
  }

  /* width 要寫死：只有 flex-basis 的話，整組靠內容決定寬度時選單只算到它最窄的寬度（箭頭加內距），名稱整個不見（2026-10-15 量到）。
     窄的時候還是可以縮，但不小於 160px */
  .screener-preset-select__select {
    flex: 0 1 280px;
    width: 280px;
    min-width: 160px;
  }
}
</style>

<!-- 不加 scoped：下拉選單 teleport 到 body。觸控時每一項 ≥44px（全站的觸控規則沒有涵蓋選單項目） -->
<style>
.screener-preset-select__menu .el-dropdown-menu__item {
  font-size: 1rem;
}

@media (pointer: coarse) {
  .screener-preset-select__menu .el-dropdown-menu__item {
    min-height: 44px;
  }
}
</style>
