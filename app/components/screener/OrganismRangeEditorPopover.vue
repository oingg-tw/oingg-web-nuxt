<script setup lang="ts">
import { periodSiblingsOf, type FilterCategory } from '~/composables/screener/useFilterSchema'
import type { TabFilterSlot } from '~/composables/screener/useScreenerTabs'

// Shared across every condition pill (and the brand-new-condition flow, which has no pill of
// its own yet) — see useScreenerTabs.ts's rangeEditorSlot for why this moved up out of
// OrganismConditionPill.vue: a fresh condition needs the exact same value-editing UI before
// it's a real slot, which a per-pill popover has no way to represent (there's no pill to own
// it yet). `slot` may be a real TabFilterSlot already sitting in a tab's slots array, or a
// not-yet-committed draft — this component doesn't need to know or care which; it just reads
// and writes whatever object it's handed, same as MoleculeRangeEditor always has.
const props = defineProps<{
  modelValue: boolean
  slot: TabFilterSlot | null
  categories: FilterCategory[]
  triggerEl?: HTMLElement | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  changePeriod: [fieldId: string]
}>()

// Same desktop-popover-vs-mobile-dialog split as the field picker (OrganismIndicatorPicker),
// and the same reasoning for why: an anchored dropdown reads naturally as "attached to the
// button that opened it" on a screen with room to spare, but risks landing off-screen or
// hard to reach one-handed on a narrow phone, where a centered dialog is more predictable.
const isDesktop = useIsDesktop()

const periods = computed(() => periodSiblingsOf(props.categories, props.slot?.fieldId ?? null))

// Same reasoning as the field picker: el-popover's own click/Escape/outside-click handling
// only engages while left "uncontrolled" (a plain two-way v-model), but that also re-enables
// its own click listener on virtual-ref, which would race with whatever click opened this in
// the first place. Passing `visible` as a one-way prop keeps it fully controlled, at the cost
// of closing it ourselves here.
const panelRef = ref<HTMLElement | null>(null)

function isOutsideClick(event: MouseEvent): boolean {
  const target = event.target as Node
  if (panelRef.value?.contains(target)) return false
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
  <!-- Desktop: anchored dropdown, attached to whichever button opened it (a pill's own value
       button when editing an existing condition, or the "新增條件" button itself while a
       brand-new one is still just a draft — see useScreenerTabs.ts's handleSelect). -->
  <el-popover
    v-if="isDesktop && slot"
    :visible="modelValue"
    virtual-triggering
    :virtual-ref="triggerEl ?? undefined"
    placement="bottom-end"
    :width="280"
    popper-class="range-editor-popover"
  >
    <div ref="panelRef">
      <ScreenerMoleculeRangeEditor
        v-model:min="slot.min"
        v-model:max="slot.max"
        v-model:exclude="slot.exclude"
        :field-label="slot.fieldLabel ?? ''"
        :periods="periods"
        :current-field-id="slot.fieldId"
        :visible="modelValue"
        @reset="emit('update:modelValue', false)"
        @update:field-id="id => emit('changePeriod', id)"
      />
    </div>
  </el-popover>

  <!-- Mobile: a centered dialog rather than an anchored popover — a popover's position is
       relative to its trigger button, which on a narrow screen can land the whole editor
       half off-screen or hard to reach one-handed; a dialog is always predictably centered
       and locks the background. -->
  <el-dialog
    v-if="!isDesktop && slot"
    :model-value="modelValue"
    title="設定範圍"
    width="90%"
    style="max-width: 320px"
    align-center
    lock-scroll
    @update:model-value="emit('update:modelValue', $event)"
  >
    <ScreenerMoleculeRangeEditor
      v-model:min="slot.min"
      v-model:max="slot.max"
      v-model:exclude="slot.exclude"
      :field-label="slot.fieldLabel ?? ''"
      :periods="periods"
      :current-field-id="slot.fieldId"
      :visible="modelValue"
      @reset="emit('update:modelValue', false)"
      @update:field-id="id => emit('changePeriod', id)"
    />
  </el-dialog>
</template>
