<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import type { Directive } from 'vue'
import type { InputInstance } from 'element-plus'
import { GUEST_TAB_ID, type ScreenerTab } from '~/composables/useScreenerTabs'

const props = defineProps<{
  tabs: ScreenerTab[]
}>()

const activeTabId = defineModel<string>('activeTabId', { required: true })

const emit = defineEmits<{
  addTab: []
  removeTab: [id: number]
  addCondition: [tab: ScreenerTab]
  removeSlot: [tab: ScreenerTab, slotId: number]
}>()

function labelNewTabButton(el: HTMLElement, label: string) {
  const button = el.querySelector<HTMLElement>('.el-tabs__new-tab')
  if (!button) return
  button.setAttribute('role', 'button')
  button.setAttribute('aria-label', label)
}

// El Plus's "+" new-tab control renders as a bare, unlabeled <div> (tabindex + click/Enter
// handlers only) — there's no prop or slot to attach role/aria-label to that wrapper, so
// patch it in imperatively instead. Vue's patcher only diffs attributes it's tracking, so
// an attribute set outside that stays put across re-renders as long as the node persists
// (it does here — `editable` never toggles, so the button is never torn down and rebuilt).
const vNewTabA11y: Directive<HTMLElement, string> = {
  mounted: (el, binding) => labelNewTabButton(el, binding.value),
  updated: (el, binding) => labelNewTabButton(el, binding.value)
}

function handleTabEdit(targetName: string | number | undefined, action: 'add' | 'remove') {
  if (action === 'add') {
    emit('addTab')
    return
  }
  if (targetName !== undefined) emit('removeTab', Number(targetName))
}

function isGuestTab(tab: ScreenerTab) {
  return tab.id === GUEST_TAB_ID
}

const { update: updatePreset } = useScreenerPresets()

// Collected by Vue into an array since it's bound inside the tabs v-for — at most one
// entry exists at a time (see the exclusivity guard below), so [0] is always the input
// currently being edited, if any.
const renameInputRef = ref<InputInstance[]>([])

function startRename(tab: ScreenerTab) {
  // The guest tab isn't a saved preset — there's nothing server-side to rename.
  if (isGuestTab(tab)) return

  // Only one tab can be renaming at once, otherwise this ref would collect more than one
  // input and .focus() below wouldn't know which to target.
  for (const other of props.tabs) {
    if (other !== tab) other.renaming = false
  }
  tab.renameDraft = tab.name
  tab.renaming = true
  // `autofocus` on a v-if-toggled el-input isn't reliably applied by the browser, and
  // without real focus the @blur below never fires on an outside click — leaving rename
  // mode stuck open. Focus it explicitly once it's actually mounted.
  nextTick(() => renameInputRef.value[0]?.focus())
}

async function commitRename(tab: ScreenerTab) {
  const trimmed = tab.renameDraft.trim()
  tab.renaming = false
  if (!trimmed || trimmed === tab.name) return
  const updated = await updatePreset(tab.id, { name: trimmed })
  tab.name = updated?.name ?? trimmed
}
</script>

<template>
  <el-tabs
    v-model="activeTabId"
    type="card"
    editable
    class="screener-preset-tabs"
    v-new-tab-a11y="'新增分頁'"
    @edit="handleTabEdit"
  >
    <el-tab-pane
      v-for="tab in tabs"
      :key="tab.id"
      :name="String(tab.id)"
      :closable="tabs.length > 1 && !tab.renaming"
    >
      <template #label>
        <span class="screener-preset-tabs__tab-label" @dblclick.stop="startRename(tab)">
          <el-input
            v-if="tab.renaming"
            ref="renameInputRef"
            v-model="tab.renameDraft"
            size="small"
            class="screener-preset-tabs__rename-input"
            @click.stop
            @keyup.enter="commitRename(tab)"
            @blur="commitRename(tab)"
          />
          <span v-else>{{ tab.name }}</span>
        </span>
      </template>

      <div class="screener-preset-tabs__grid">
        <StockFilterSlotCard
          v-for="slot in tab.slots"
          :key="slot.id"
          v-model:min="slot.min"
          v-model:max="slot.max"
          v-model:exclude="slot.exclude"
          :field-label="slot.fieldLabel"
          @remove="emit('removeSlot', tab, slot.id)"
        />

        <button type="button" class="screener-preset-tabs__add-slot" @click="emit('addCondition', tab)">
          <el-icon><Plus /></el-icon>
          <span>新增條件</span>
        </button>
      </div>

      <slot name="result" :tab="tab" />
    </el-tab-pane>
  </el-tabs>
</template>

<style scoped>
.screener-preset-tabs {
  --el-tabs-header-height: 40px;
}

/* By default .el-tabs__header is `justify-content: space-between` and its nav-wrap
   stretches to fill the row, so the "+" new-tab button ends up pinned to the far right
   of the whole tab bar instead of sitting next to the last tab. Let nav-wrap size to its
   own content and left-align the two so "+" hugs the last tab. */
.screener-preset-tabs :deep(.el-tabs__header) {
  justify-content: flex-start;
  border-bottom: none;
}

.screener-preset-tabs :deep(.el-tabs__nav-wrap) {
  flex: initial;
}

/* Chrome's tab strip rather than a boxed card: drop the card type's border around the
   whole nav and the shared edges between items, and give each tab real breathing room
   from its neighbors instead of sitting flush against them — so the row reads as a
   line of flat, individually-rounded buttons with a "+" always trailing at the end. */
.screener-preset-tabs :deep(.el-tabs__nav) {
  border: none !important;
  border-radius: 0;
  gap: 6px;
}

/* Every tab keeps a real outline at rest — without one, an unselected tab is just
   floating text with no visual cue that it's a clickable button at all. */
.screener-preset-tabs :deep(.el-tabs__item) {
  margin: 0 !important;
  border: 1px solid var(--el-border-color) !important;
  border-radius: 8px;
  color: var(--el-text-color-regular);
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}

.screener-preset-tabs :deep(.el-tabs__item:hover) {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-hover);
  color: var(--el-text-color-primary);
}

.screener-preset-tabs :deep(.el-tabs__item.is-active) {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  font-weight: 600;
}

.screener-preset-tabs :deep(.el-tabs__item:focus-visible) {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 1px;
}

/* Its own bordered button (matching the tabs it sits beside), sized up from El Plus's
   default 20px so it isn't the one washed-out element in an otherwise clear row of
   buttons — and set a little apart from the last tab, the way Chrome's "+" is. */
.screener-preset-tabs :deep(.el-tabs__new-tab) {
  width: 28px;
  height: 28px;
  margin: 0 0 0 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  color: var(--el-text-color-regular);
  font-size: 16px;
}

.screener-preset-tabs :deep(.el-tabs__new-tab:hover) {
  background: var(--el-fill-color-light);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.screener-preset-tabs :deep(.el-tabs__new-tab:focus-visible) {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 1px;
}

/* El Plus's card-tab close icon defaults to width:0 (hidden) and grows to 14px on hover
   or when active, shifting the tab's width/padding as it does. Reserve that space at all
   times and only toggle opacity instead, so hovering never changes tab width. Kept dimly
   visible at rest (not opacity: 0) — fully invisible meant a double-click landing near the
   tab's right edge silently deleted it on the first click, with no visual cue for what was
   actually clicked. */
.screener-preset-tabs :deep(.el-tabs__item.is-closable) {
  padding-left: 13px !important;
  padding-right: 13px !important;
}

.screener-preset-tabs :deep(.el-tabs__item.is-closable .is-icon-close) {
  width: 14px !important;
  opacity: 0.35;
}

.screener-preset-tabs :deep(.el-tabs__item.is-closable:hover .is-icon-close),
.screener-preset-tabs :deep(.el-tabs__item.is-closable.is-active .is-icon-close) {
  opacity: 1;
}

.screener-preset-tabs__tab-label {
  display: inline-flex;
  align-items: center;
}

.screener-preset-tabs__rename-input {
  width: 100px;
}

.screener-preset-tabs__grid {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* Stacked top-to-bottom instead of wrapping chips, each pill spanning the full row
   width — see the matching filter-pill__label override in StockFilterSlotCard.vue that
   lets the label segment grow to fill that width instead of staying content-sized. */
@media (max-width: 767px) {
  .screener-preset-tabs__grid {
    flex-direction: column;
    align-items: stretch;
  }
}

.screener-preset-tabs__add-slot {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 12px;
  border: 1px dashed var(--el-border-color);
  /* Matches the filter pills' squarish rounded corners rather than a capsule shape. */
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 16px;
}

.screener-preset-tabs__add-slot:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
</style>
