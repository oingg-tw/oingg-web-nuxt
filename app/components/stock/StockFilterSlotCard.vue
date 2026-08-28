<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'

defineProps<{
  fieldLabel: string
}>()

const emit = defineEmits<{
  remove: []
}>()

// The field is fixed once a condition is created (picked via StockFilterIndicatorDialog
// when adding it) — this pill no longer opens that dialog to change it. The only thing
// left to edit here is the range (and its 大於/小於/之間/之外/等於 mode), in the popover below.
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

const popoverVisible = ref(false)
</script>

<template>
  <div class="filter-pill">
    <el-popover v-model:visible="popoverVisible" placement="bottom-start" trigger="click" :persistent="false" width="auto">
      <template #reference>
        <button type="button" class="filter-pill__main">
          <span class="filter-pill__label">{{ fieldLabel }}</span>
          <span class="filter-pill__value">{{ valueText }}</span>
        </button>
      </template>
      <StockFilterRangeEditor
        v-model:min="min"
        v-model:max="max"
        v-model:exclude="exclude"
        :field-label="fieldLabel"
        @reset="popoverVisible = false"
      />
    </el-popover>

    <!-- A real sibling button, not part of the popover — removing a condition doesn't
         need the range editor to be open first. -->
    <button type="button" class="filter-pill__remove" title="移除條件" aria-label="移除條件" @click="emit('remove')">
      <el-icon><Close /></el-icon>
    </button>
  </div>
</template>

<style scoped>
.filter-pill {
  display: inline-flex;
  align-items: stretch;
  height: 36px;
  max-width: 100%;
  border: 1px solid var(--el-border-color);
  /* Squarish rounded corners rather than a fully-rounded capsule shape. */
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  overflow: hidden;
}

.filter-pill:hover {
  border-color: var(--el-color-primary);
}

/* Full row width instead of a compact chip, with the label segment growing to fill it
   (the value segment stays its natural size) — matches screener-page__grid switching to
   a top-to-bottom stack at this width. */
@media (max-width: 767px) {
  .filter-pill {
    width: 100%;
  }

  .filter-pill__label {
    flex: 1;
    max-width: none;
  }
}

.filter-pill__main {
  display: flex;
  align-items: stretch;
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.filter-pill__label,
.filter-pill__value {
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* Buttons center their content by default — matters once filter-pill__label grows to
     fill extra width (mobile) instead of staying content-sized. */
  text-align: left;
}

.filter-pill__label {
  flex-shrink: 1;
  min-width: 0;
  max-width: 160px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.filter-pill__value {
  flex-shrink: 0;
  color: var(--el-color-primary);
  border-left: 1px solid var(--el-border-color-lighter);
}

.filter-pill__remove {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  border: none;
  border-left: 1px solid var(--el-border-color-lighter);
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.filter-pill__remove:hover {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}
</style>
