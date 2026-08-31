<script setup lang="ts">
import type { FilterCategory } from '~/composables/useFilterSchema'

const props = defineProps<{
  modelValue: boolean
  categories: FilterCategory[]
  // The field already on the slot being edited, if any — see MoleculeIndicatorPickerBody,
  // which uses it to jump straight to that field's own 大/中/小 location on open.
  currentFieldId?: string | null
  // The button that opened this (a condition pill's field half, or the table's "+" column
  // header) — only used on desktop, to anchor the dropdown to it. Mobile ignores this and
  // stays fullscreen regardless.
  triggerEl?: HTMLElement | null
  // See MoleculeIndicatorPickerBody's own prop of the same name — true for condition-picking
  // (period moves to the range editor instead), false for column-picking (no range editor to
  // move it into, keeps showing every period variant as its own row).
  hidePeriod: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [fieldId: string, fieldLabel: string]
}>()

// Two different UI mechanisms depending on viewport, not just two different sizes of the
// same one: mobile gets a fullscreen modal (see the dialog branch below for why), desktop
// gets a dropdown anchored to whichever button opened it — a fullscreen takeover would be
// overkill on a screen with room to spare, and el-popover has no fullscreen mode to grow
// into on mobile, so this picks between two actually-different wrapper components rather
// than reskinning one via CSS.
const isDesktop = useIsDesktop()

function handleSelect(fieldId: string, fieldLabel: string) {
  emit('select', fieldId, fieldLabel)
  emit('update:modelValue', false)
}

// El-popover's own click/Escape/outside-click handling only engages while it's left
// "uncontrolled" (a plain two-way v-model) — but that also re-enables its own click
// listener on virtual-ref, which races with the click handler elsewhere that opens this in
// the first place (particularly re-clicking a trigger that's already the current one).
// Passing `visible` as a one-way prop (no `update:visible` listener) keeps it fully
// controlled and sidesteps that, at the cost of having to close it ourselves — done here
// for a click outside the panel and the trigger, and for Escape.
const popoverPanelRef = ref<HTMLElement | null>(null)

function isOutsideClick(event: MouseEvent): boolean {
  const target = event.target as Node
  if (popoverPanelRef.value?.contains(target)) return false
  if (props.triggerEl?.contains(target)) return false
  return true
}

function handleOutsideClick(event: MouseEvent) {
  if (isOutsideClick(event)) emit('update:modelValue', false)
}

function handleEscapeKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('update:modelValue', false)
}

watch(
  () => props.modelValue && isDesktop.value,
  active => {
    if (active) {
      document.addEventListener('click', handleOutsideClick)
      document.addEventListener('keydown', handleEscapeKey)
    } else {
      document.removeEventListener('click', handleOutsideClick)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }
)

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
  document.removeEventListener('keydown', handleEscapeKey)
})
</script>

<template>
  <el-popover
    v-if="isDesktop"
    :visible="modelValue"
    virtual-triggering
    :virtual-ref="triggerEl ?? undefined"
    placement="bottom-start"
    :width="600"
    popper-class="indicator-popover"
  >
    <div ref="popoverPanelRef">
      <ScreenerMoleculeIndicatorPickerBody
        :categories="categories"
        :current-field-id="currentFieldId"
        :active="modelValue"
        :hide-period="hidePeriod"
        @select="handleSelect"
      />
    </div>
  </el-popover>

  <!-- Fullscreen rather than a content-sized floating box: the dialog's own outer frame
       is then always exactly the viewport, so nothing about it (search results narrowing
       the field list, switching category/metric, an empty-state showing up) can ever
       change ITS size and cause a jump — only the fixed-height columns inside it scroll. -->
  <el-dialog
    v-else
    :model-value="modelValue"
    title="請選擇篩選項目"
    fullscreen
    lock-scroll
    class="indicator-dialog-modal"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <ScreenerMoleculeIndicatorPickerBody
      :categories="categories"
      :current-field-id="currentFieldId"
      :active="modelValue"
      :hide-period="hidePeriod"
      @select="handleSelect"
    />
  </el-dialog>
</template>

<style>
/* Both blocks below are unscoped (:deep() can't reach either el-dialog's or el-popover's
   own root, which render outside this component's DOM subtree via teleport). */

/* Matches AppFeatureMenu's fullscreen dialog, which pads its body the same way for the same
   reason (the safe-area inset only matters once content can reach the very bottom edge,
   which fullscreen does and a floating centered dialog never did). */
.indicator-dialog-modal .el-dialog__body {
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

.indicator-popover.el-popper {
  padding: 8px;
}
</style>
