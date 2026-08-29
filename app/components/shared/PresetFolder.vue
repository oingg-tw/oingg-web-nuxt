<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'

// A saved-preset switcher drawn as a folder: the active preset is a real, bordered tab
// attached to the folder body below it (see .stock-preset-folder__body's margin-top
// overlap trick); the presets immediately before/after it peek in, dimmed, at each edge —
// their own tail/lead-in text, not swipeable (see prev/next buttons below), just a button
// tap. Used for both the filter-preset switcher and the column-preset switcher so the two
// share one visual language.
export interface PresetFolderItem {
  id: string
  name: string
  // false for a sentinel that isn't a real saved resource (the guest tab, or the "預設"
  // column-preset standing in for columnPresetId = null) — long-press/double-click on one
  // of these is a no-op since there's nothing server-side to rename or delete.
  editable?: boolean
}

const props = defineProps<{
  items: PresetFolderItem[]
}>()

const activeId = defineModel<string>('activeId', { required: true })

const emit = defineEmits<{
  add: []
  rename: [id: string, name: string]
  remove: [id: string]
}>()

const activeIndex = computed(() => props.items.findIndex(item => item.id === activeId.value))
const activeItem = computed(() => props.items[activeIndex.value] ?? null)
const prevItem = computed(() => (activeIndex.value > 0 ? props.items[activeIndex.value - 1] : null))
const nextItem = computed(() =>
  activeIndex.value >= 0 && activeIndex.value < props.items.length - 1 ? props.items[activeIndex.value + 1] : null
)

const editVisible = ref(false)
const editTarget = ref<PresetFolderItem | null>(null)
const editDraft = ref('')

function openEdit(item: PresetFolderItem | null) {
  if (!item || item.editable === false) return
  editTarget.value = item
  editDraft.value = item.name
  editVisible.value = true
}

function confirmRename() {
  const trimmed = editDraft.value.trim()
  if (editTarget.value && trimmed && trimmed !== editTarget.value.name) {
    emit('rename', editTarget.value.id, trimmed)
  }
  editVisible.value = false
}

async function confirmRemove() {
  if (!editTarget.value) return
  const target = editTarget.value
  try {
    await ElMessageBox.confirm(`確定要刪除「${target.name}」嗎？`, '刪除', {
      confirmButtonText: '刪除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    })
  } catch {
    return
  }
  emit('remove', target.id)
  editVisible.value = false
}

// Swiping is out of scope for this version — switching is a plain button tap. Long-press
// (touch) or a double-click (desktop) on any of the three visible presets instead opens
// the rename/delete dialog for THAT one, without first switching to it. A short tap always
// wins over a long-press: the timer only fires openEdit after LONG_PRESS_MS, and pointerup
// cancels it and runs the tap handler if it hasn't fired yet.
const LONG_PRESS_MS = 500

function usePress(getItem: () => PresetFolderItem | null, onTap: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let firedLongPress = false
  function onPointerdown() {
    firedLongPress = false
    timer = setTimeout(() => {
      firedLongPress = true
      openEdit(getItem())
    }, LONG_PRESS_MS)
  }
  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
  function onPointerup() {
    clearTimer()
    if (!firedLongPress) onTap()
  }
  return {
    onPointerdown,
    onPointerup,
    onPointerleave: clearTimer,
    onPointercancel: clearTimer,
    onDblclick: () => openEdit(getItem()),
    // The browser's own long-press context menu / text selection would otherwise fight
    // the custom timer above, especially on mobile.
    onContextmenu: (event: Event) => event.preventDefault()
  }
}

const prevPress = usePress(
  () => prevItem.value,
  () => {
    if (prevItem.value) activeId.value = prevItem.value.id
  }
)
const activePress = usePress(() => activeItem.value, () => {})
const nextPress = usePress(
  () => nextItem.value,
  () => {
    if (nextItem.value) activeId.value = nextItem.value.id
  }
)
</script>

<template>
  <div class="stock-preset-folder">
    <div class="stock-preset-folder__switcher">
      <div class="stock-preset-folder__peek-wrap">
        <button
          v-if="prevItem"
          type="button"
          class="stock-preset-folder__peek stock-preset-folder__peek--prev"
          :aria-label="`切換到「${prevItem.name}」`"
          v-bind="prevPress"
        >{{ prevItem.name }}</button>
        <div v-if="prevItem" class="stock-preset-folder__fade stock-preset-folder__fade--left" />
      </div>

      <button
        v-if="activeItem"
        type="button"
        class="stock-preset-folder__active"
        v-bind="activePress"
      >{{ activeItem.name }}</button>

      <div class="stock-preset-folder__peek-wrap">
        <button
          v-if="nextItem"
          type="button"
          class="stock-preset-folder__peek stock-preset-folder__peek--next"
          :aria-label="`切換到「${nextItem.name}」`"
          v-bind="nextPress"
        >{{ nextItem.name }}</button>
        <div v-if="nextItem" class="stock-preset-folder__fade stock-preset-folder__fade--right" />
      </div>

      <!-- Real hit area stays 44×44 (button); the drawn circle inside is smaller so the row
           doesn't look bottom-heavy — a bigger invisible padding, not a bigger visible glyph. -->
      <button type="button" class="stock-preset-folder__add" aria-label="新增" @click="emit('add')">
        <span class="stock-preset-folder__add-visual">
          <el-icon><Plus /></el-icon>
        </span>
      </button>
    </div>

    <div class="stock-preset-folder__body">
      <slot />
    </div>

    <el-dialog v-model="editVisible" title="編輯" width="320px" append-to-body>
      <el-input
        v-model="editDraft"
        placeholder="名稱"
        maxlength="20"
        @keyup.enter="confirmRename"
      />
      <template #footer>
        <el-button type="danger" plain @click="confirmRemove">刪除</el-button>
        <el-button type="primary" @click="confirmRename">重新命名</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.stock-preset-folder {
  position: relative;
}

.stock-preset-folder__switcher {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.stock-preset-folder__peek-wrap {
  position: relative;
  flex-shrink: 0;
}

/* -webkit-touch-callout / user-select: none keep a long-press from popping the browser's
   own text-selection handles or callout menu while the custom timer is running. */
.stock-preset-folder__peek {
  display: flex;
  align-items: center;
  min-width: 44px;
  height: 44px;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: var(--el-text-color-disabled);
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.stock-preset-folder__peek--prev {
  justify-content: flex-end;
}

.stock-preset-folder__peek--next {
  justify-content: flex-start;
}

.stock-preset-folder__fade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 16px;
  pointer-events: none;
}

.stock-preset-folder__fade--left {
  left: 0;
  background: linear-gradient(to right, var(--el-bg-color), rgba(30, 30, 30, 0));
}

.stock-preset-folder__fade--right {
  right: 0;
  background: linear-gradient(to left, var(--el-bg-color), rgba(30, 30, 30, 0));
}

.stock-preset-folder__active {
  flex: 1;
  min-width: 70px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border: 1px solid var(--el-color-primary-light-5);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.stock-preset-folder__add {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.stock-preset-folder__add-visual {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--el-border-color);
  color: var(--el-text-color-secondary);
}

.stock-preset-folder__add:hover .stock-preset-folder__add-visual {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

/* The 43px offset (not 44) deliberately overlaps the body's own top border by 1px, so the
   switcher's opaque tab/peek row hides that border segment instead of leaving a hairline
   seam between the two. No padding here on purpose — the two consumers want different
   insets (StockScreenerPresetTabs pads its pills for breathing room; StockScreenerResultPanel
   runs its table flush to the edges on mobile, where every pixel of table width matters more
   than a matching margin) — so each supplies its own via the default slot's content. */
.stock-preset-folder__body {
  margin-top: 43px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
