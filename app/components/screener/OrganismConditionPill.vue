<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'

// Two halves, two distinct jobs, each reachable exactly one way — no overlap:
// - Front half (the field name) opens the shared field-picker dialog. Same dialog whether
//   this is a brand-new empty placeholder pill getting its first field, or an existing
//   pill having its field swapped for a different one — one dialog, one entry point,
//   never two ways to reach the same outcome.
// - Back half (the value) opens the range-editor popover. Only shown once a field is set —
//   there's nothing to edit a range against before that.
const props = defineProps<{
  fieldLabel: string | null
}>()

const emit = defineEmits<{
  changeField: []
  remove: []
}>()

const min = defineModel<number | null>('min', { default: null })
const max = defineModel<number | null>('max', { default: null })
const exclude = defineModel<boolean>('exclude', { default: false })

const valueText = computed(() => {
  if (min.value === null && max.value === null) return '設定範圍'
  if (min.value !== null && max.value !== null) {
    if (min.value === max.value) return `= ${min.value}`
    return exclude.value ? `不在 ${min.value}～${max.value}` : `${min.value}～${max.value}`
  }
  if (min.value !== null) return `≥ ${min.value}`
  return `≤ ${max.value}`
})

const rangeDialogVisible = ref(false)
</script>

<template>
  <div class="condition-pill" :class="{ 'condition-pill--empty': !fieldLabel }">
    <button
      type="button"
      class="condition-pill__field"
      :title="fieldLabel ? '變更篩選項目' : '選擇篩選項目'"
      @click="emit('changeField')"
    >{{ fieldLabel ?? '請選擇篩選項目' }}</button>

    <button
      v-if="fieldLabel"
      type="button"
      class="condition-pill__value"
      @click="rangeDialogVisible = true"
    >{{ valueText }}</button>

    <!-- A centered dialog rather than an anchored popover — same reasoning as the
         field-picker: a popover's position is relative to its trigger button, which on a
         narrow screen can land the whole editor half off-screen or hard to reach one-
         handed; a dialog is always predictably centered and locks the background. -->
    <el-dialog
      v-if="fieldLabel"
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
        @reset="rangeDialogVisible = false"
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
}

.condition-pill__remove:hover {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
</style>
