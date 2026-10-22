<script setup lang="ts">
// 表頭的欄位選單（2026-10-22，使用者：「點擊 表頭 欄位時 參考，要可以展開選單」附一張欄位選單的圖；選了篩選結果表與觀察清單都要）。
// 點表頭不再直接排序，打開這個選單：最上面是欄名與指標說明（名字很像的兩支看得出是哪一支，例如即時與季資料的本益成長比），
// 下面是排序、移動、移除。篩選結果表（SharedMetricTable，貼在表頭按鈕旁）與觀察清單（SharedSheetGrid，貼在表頭格旁）共用。
// 開關由呼叫端控制（open），選單貼在 anchor 旁邊。鍵盤照 APG 的選單：打開時焦點到目前的排序或第一項、↑↓ Home End 移動、
// Esc 或 Tab 關掉並回到表頭；點選單外面也會關。
export type ColumnMenuAction = 'ascending' | 'descending' | 'clear' | 'left' | 'right' | 'start' | 'end' | 'remove'

const props = defineProps<{
  anchor: HTMLElement | null
  label: string
  // 指標說明（型錄的 description）；沒有就不畫
  description?: string
  // 這一欄目前的排序；undefined＝不能排序
  sort?: 'ascending' | 'descending' | null
  // 能不能往左、往右移；undefined＝不能移動（代號、名稱這種固定在左邊的欄）
  moves?: { left: boolean, right: boolean }
  removable?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ action: [action: ColumnMenuAction] }>()

interface Item {
  action: ColumnMenuAction
  icon: string
  text: string
  disabled?: boolean
  current?: boolean
  danger?: boolean
  divided?: boolean
}
const items = computed<Item[]>(() => [
  ...(props.sort === undefined
    ? []
    : [
        { action: 'ascending' as const, icon: '↑', text: '由小到大', current: props.sort === 'ascending' },
        { action: 'descending' as const, icon: '↓', text: '由大到小', current: props.sort === 'descending' },
        ...(props.sort ? [{ action: 'clear' as const, icon: '', text: '取消排序' }] : [])
      ]),
  ...(props.moves
    ? [
        { action: 'left' as const, icon: '←', text: '往左移', disabled: !props.moves.left, divided: props.sort !== undefined },
        { action: 'right' as const, icon: '→', text: '往右移', disabled: !props.moves.right },
        { action: 'start' as const, icon: '⇤', text: '移到最前面', disabled: !props.moves.left },
        { action: 'end' as const, icon: '⇥', text: '移到最後面', disabled: !props.moves.right }
      ]
    : []),
  ...(props.removable ? [{ action: 'remove' as const, icon: '✕', text: '移除這一欄', danger: true, divided: true }] : [])
])

const uid = useId()
const menuRef = ref<HTMLElement | null>(null)
// 第一次打開才建立（同 SharedMetricColumnPicker）：關著的 el-popover 在伺服器也會配一個 z-index，觀察清單同頁還有備註對話框，
// 兩個的順序在伺服器與瀏覽器對調（2002／2003），hydration 不一致（2026-10-22 check-hydration 量到）
const everOpened = ref(open.value)
const buttons = () => [...(menuRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])]

function close(returnFocus: boolean) {
  open.value = false
  if (returnFocus) props.anchor?.focus()
}

function choose(item: Item) {
  if (item.disabled) return
  close(true)
  emit('action', item.action)
}

function onKeydown(event: KeyboardEvent) {
  const list = buttons()
  const index = list.indexOf(document.activeElement as HTMLElement)
  let next: HTMLElement | undefined
  if (event.key === 'ArrowDown') next = list[(index + 1) % list.length]
  else if (event.key === 'ArrowUp') next = list[(index - 1 + list.length) % list.length]
  else if (event.key === 'Home') next = list[0]
  else if (event.key === 'End') next = list.at(-1)
  else if (event.key === 'Escape' || event.key === 'Tab') {
    event.preventDefault()
    close(true)
    return
  } else return
  event.preventDefault()
  next?.focus()
}

// 點選單外面就關（不搶焦點：人已經點到別的地方了）；點的是表頭本身交給表頭自己（它會再開或換一欄）
function onPointerdown(event: PointerEvent) {
  const target = event.target as Node
  if (menuRef.value?.closest('.column-menu')?.contains(target) || props.anchor?.contains(target)) return
  close(false)
}

watch(open, async (value) => {
  if (!value) {
    document.removeEventListener('pointerdown', onPointerdown, true)
    return
  }
  everOpened.value = true
  document.addEventListener('pointerdown', onPointerdown, true)
  await nextTick()
  // 定位跟淡入要一拍；焦點落在目前的排序（有的話），沒有就第一項
  requestAnimationFrame(() => {
    const list = buttons()
    ;(list.find(button => button.classList.contains('is-current')) ?? list[0])?.focus()
  })
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerdown, true))
</script>

<template>
  <el-popover
    v-if="everOpened"
    :visible="open"
    :virtual-ref="anchor ?? undefined"
    virtual-triggering
    placement="bottom-start"
    :width="280"
    :show-arrow="false"
    popper-class="column-menu"
  >
    <div class="column-menu__head">
      <p :id="`${uid}-title`" class="column-menu__title">{{ label }}</p>
      <p v-if="description" class="column-menu__description">{{ description }}</p>
    </div>
    <div ref="menuRef" role="menu" :aria-labelledby="`${uid}-title`" class="column-menu__list" @keydown="onKeydown">
      <template v-for="item in items" :key="item.action">
        <div v-if="item.divided" role="separator" class="column-menu__divider" />
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          class="column-menu__item"
          :class="{ 'is-current': item.current, 'is-danger': item.danger }"
          :aria-disabled="item.disabled ? 'true' : undefined"
          @click="choose(item)"
        >
          <span class="column-menu__icon" aria-hidden="true">{{ item.icon }}</span>{{ item.text }}<span v-if="item.current" class="visually-hidden">（目前）</span>
        </button>
      </template>
    </div>
  </el-popover>
</template>

<style>
/* 不加 scoped：el-popover teleport 到 body */
.el-popover.column-menu {
  padding: 8px 0;
}

.column-menu__head {
  padding: 4px 16px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.column-menu__title {
  margin: 0;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* 長的說明（市值有八行）會把選項推到很下面：畫面上最多三行，螢幕閱讀器照樣念全文 */
.column-menu__description {
  display: -webkit-box;
  margin: 4px 0 0;
  overflow: hidden;
  color: var(--el-text-color-regular);
  line-height: 1.5;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
}

.column-menu__list {
  display: flex;
  flex-direction: column;
  padding-top: 4px;
}

.column-menu__divider {
  margin: 4px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.column-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 16px;
  font: inherit;
  text-align: left;
  color: var(--el-text-color-primary);
  background: none;
  border: 0;
  cursor: pointer;
}

.column-menu__item:hover:not([aria-disabled='true']),
.column-menu__item:focus-visible {
  background: var(--el-fill-color-light);
}

.column-menu__item:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

.column-menu__item.is-current {
  font-weight: 600;
  color: var(--el-color-primary-dark-2);
}

.column-menu__item.is-danger {
  color: var(--el-color-danger);
}

.column-menu__item[aria-disabled='true'] {
  color: var(--el-text-color-placeholder);
  cursor: not-allowed;
}

.column-menu__icon {
  width: 1.25em;
  text-align: center;
}

@media (pointer: coarse) {
  .column-menu__item {
    min-height: 44px;
  }
}
</style>
