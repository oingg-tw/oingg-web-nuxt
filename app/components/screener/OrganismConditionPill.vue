<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'
import { periodSiblingsOf, type FilterCategory } from '~/composables/useFilterSchema'

// Two halves, two distinct jobs, each reachable exactly one way — no overlap:
// - Front half (the field name) opens the shared field-picker dialog. Same dialog whether
//   this is a brand-new empty placeholder pill getting its first field, or an existing
//   pill having its field swapped for a different one — one dialog, one entry point,
//   never two ways to reach the same outcome.
// - Back half (the value) opens the range-editor popover. Only shown once a field is set —
//   there's nothing to edit a range against before that.
const props = defineProps<{
  fieldLabel: string | null
  fieldId: string | null
  categories: FilterCategory[]
}>()

const emit = defineEmits<{
  changeField: [triggerEl: HTMLElement]
  changePeriod: [fieldId: string]
  remove: []
}>()

const min = defineModel<number | null>('min', { default: null })
const max = defineModel<number | null>('max', { default: null })
const exclude = defineModel<boolean>('exclude', { default: false })

// Empty (nothing to switch to) for a field with no real period variants — see
// MoleculeRangeEditor, which only renders the switcher once there's an actual choice.
const periods = computed(() => periodSiblingsOf(props.categories, props.fieldId))
const currentPeriodLabel = computed(() => periods.value.find(option => option.fieldId === props.fieldId)?.label ?? null)

const rangeText = computed(() => {
  if (min.value === null && max.value === null) return '設定範圍'
  if (min.value !== null && max.value !== null) {
    if (min.value === max.value) return `= ${min.value}`
    return exclude.value ? `不在 ${min.value}～${max.value}` : `${min.value}～${max.value}`
  }
  if (min.value !== null) return `≥ ${min.value}`
  return `≤ ${max.value}`
})

// Period now surfaces here rather than on the field-name half — picking a condition's field
// no longer asks for a period up front (see MoleculeIndicatorPickerBody's hidePeriod prop),
// so this is the only place left where it's visible without opening the range editor.
const valueText = computed(() => (currentPeriodLabel.value ? `${currentPeriodLabel.value} · ${rangeText.value}` : rangeText.value))

const rangeDialogVisible = ref(false)

// Same desktop-popover-vs-mobile-dialog split as the field picker (OrganismIndicatorPicker),
// and the same reasoning for why: an anchored dropdown reads naturally as "attached to the
// button that opened it" on a screen with room to spare, but risks landing off-screen or
// hard to reach one-handed on a narrow phone, where a centered dialog is more predictable.
const isDesktop = useIsDesktop()
const valueTriggerEl = ref<HTMLElement | null>(null)

function openRangeEditor(triggerEl: HTMLElement) {
  valueTriggerEl.value = triggerEl
  rangeDialogVisible.value = true
}

// Same reasoning as the field picker: el-popover's own click/Escape/outside-click handling
// only engages while left "uncontrolled" (a plain two-way v-model), but that also
// re-enables its own click listener on virtual-ref, which would race with the click handler
// above that opens this. Passing `visible` as a one-way prop keeps it fully controlled, at
// the cost of closing it ourselves here.
const rangePopoverPanelRef = ref<HTMLElement | null>(null)

function isOutsideRangePopoverClick(event: MouseEvent): boolean {
  const target = event.target as Node
  if (rangePopoverPanelRef.value?.contains(target)) return false
  if (valueTriggerEl.value?.contains(target)) return false
  return true
}

function handleOutsideRangePopoverClick(event: MouseEvent) {
  if (isOutsideRangePopoverClick(event)) rangeDialogVisible.value = false
}

function handleRangePopoverEscapeKey(event: KeyboardEvent) {
  if (event.key === 'Escape') rangeDialogVisible.value = false
}

watch(
  () => rangeDialogVisible.value && isDesktop.value,
  active => {
    if (active) {
      document.addEventListener('click', handleOutsideRangePopoverClick)
      document.addEventListener('keydown', handleRangePopoverEscapeKey)
    } else {
      document.removeEventListener('click', handleOutsideRangePopoverClick)
      document.removeEventListener('keydown', handleRangePopoverEscapeKey)
    }
  }
)

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideRangePopoverClick)
  document.removeEventListener('keydown', handleRangePopoverEscapeKey)
})
</script>

<template>
  <div class="condition-pill" :class="{ 'condition-pill--empty': !fieldLabel }">
    <button
      type="button"
      class="condition-pill__field"
      :title="fieldLabel ? '變更篩選項目' : '選擇篩選項目'"
      @click="emit('changeField', $event.currentTarget as HTMLElement)"
    >{{ fieldLabel ?? '請選擇篩選項目' }}</button>

    <button
      v-if="fieldLabel"
      type="button"
      class="condition-pill__value"
      @click="openRangeEditor($event.currentTarget as HTMLElement)"
    >{{ valueText }}</button>

    <!-- Desktop: anchored dropdown, attached right below the value button that opened it. -->
    <el-popover
      v-if="fieldLabel && isDesktop"
      :visible="rangeDialogVisible"
      virtual-triggering
      :virtual-ref="valueTriggerEl ?? undefined"
      placement="bottom-end"
      :width="280"
      popper-class="range-editor-popover"
    >
      <div ref="rangePopoverPanelRef">
        <ScreenerMoleculeRangeEditor
          v-model:min="min"
          v-model:max="max"
          v-model:exclude="exclude"
          :field-label="fieldLabel"
          :periods="periods"
          :current-field-id="fieldId"
          @reset="rangeDialogVisible = false"
          @update:field-id="id => emit('changePeriod', id)"
        />
      </div>
    </el-popover>

    <!-- Mobile: a centered dialog rather than an anchored popover — a popover's position is
         relative to its trigger button, which on a narrow screen can land the whole editor
         half off-screen or hard to reach one-handed; a dialog is always predictably
         centered and locks the background. -->
    <el-dialog
      v-if="fieldLabel && !isDesktop"
      v-model="rangeDialogVisible"
      title="設定範圍"
      width="90%"
      style="max-width: 320px"
      align-center
      lock-scroll
    >
      <ScreenerMoleculeRangeEditor
        v-model:min="min"
        v-model:max="max"
        v-model:exclude="exclude"
        :field-label="fieldLabel"
        :periods="periods"
        :current-field-id="fieldId"
        @reset="rangeDialogVisible = false"
        @update:field-id="id => emit('changePeriod', id)"
      />
    </el-dialog>

    <!-- A real sibling button, not part of either half above — removing a condition doesn't
         need the field picker or range editor to be open first. -->
    <button type="button" class="condition-pill__remove" title="移除條件" aria-label="移除條件" @click="emit('remove')">
      <el-icon><Close /></el-icon>
    </button>
  </div>
</template>

<style scoped>
/* 44px tall throughout (not the 36px this used to be) so the field half, value half, and
   remove button each clear the project's icon-button touch-target guideline on their own,
   not just the WCAG 24px floor. */
.condition-pill {
  display: inline-flex;
  align-items: stretch;
  /* The parent list (.screener-filters__conditions) is a column flex box with a fixed
     height, meant to scroll once there are more than 3 conditions — but flex items default
     to flex-shrink: 1, so without this, the browser shrinks every pill's height to cram
     them all into that fixed box instead of ever letting it overflow and scroll. */
  flex-shrink: 0;
  height: 44px;
  max-width: 100%;
  border: 1px solid var(--el-border-color);
  /* Squarish rounded corners rather than a fully-rounded capsule shape. */
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  overflow: hidden;
}

.condition-pill:hover {
  border-color: var(--el-color-primary);
}

.condition-pill--empty {
  border-style: dashed;
}

/* The pill sits in a flex column (.screener-filters__conditions) with default
   align-items: stretch, so it's always already the full row width — without the field
   segment itself growing to fill that box too, the value/remove segments were left
   floating at their natural size with dead space after them instead of the remove button
   sitting flush against the pill's actual right edge. */
@media (max-width: 767px) {
  .condition-pill {
    width: 100%;
  }
}

.condition-pill__field,
.condition-pill__value {
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border: none;
  background: transparent;
  cursor: pointer;
  /* Buttons center their content by default — matters once condition-pill__field grows to
     fill extra width (mobile, or the empty placeholder state) instead of staying
     content-sized. */
  text-align: left;
}

.condition-pill__field {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.condition-pill--empty .condition-pill__field {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

.condition-pill__value {
  flex-shrink: 0;
  color: var(--el-color-primary);
  border-left: 1px solid var(--el-border-color-lighter);
}

.condition-pill__remove {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  border: none;
  border-left: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-secondary);
  /* Without this, the Close icon renders at ~13px instead of matching the pill's own 16px
     scale — <button> doesn't inherit font-size from its ancestors like a normal element
     would (the browser's UA stylesheet gives form controls their own default ~13.3px
     control font instead), and el-icon's svg sizes itself off the button's own font-size
     via 1em. Confirmed live: this button measured font-size: 13.3333px before this rule. */
  font-size: 16px;
}

.condition-pill__remove:hover {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
</style>
