<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'

defineProps<{
  index: number
  fieldLabel: string | null
}>()

const emit = defineEmits<{
  openPicker: []
  clear: []
}>()

const min = defineModel<number | null>('min', { default: null })
const max = defineModel<number | null>('max', { default: null })
const exclude = defineModel<boolean>('exclude', { default: false })
</script>

<template>
  <div class="filter-slot-card">
    <div class="filter-slot-card__row">
      <span class="filter-slot-card__label">條件{{ index + 1 }}</span>
      <button type="button" class="filter-slot-card__picker" :class="{ 'is-empty': !fieldLabel }" @click="emit('openPicker')">
        {{ fieldLabel ?? '---請指定過濾條件---' }}
      </button>
      <el-button :icon="Close" circle text size="small" title="清除過濾條件" @click="emit('clear')" />
    </div>

    <div class="filter-slot-card__row">
      <span class="filter-slot-card__label">範圍</span>
      <el-input-number v-model="min" :controls="false" placeholder="起" size="small" class="filter-slot-card__range" />
      <span class="filter-slot-card__sep">～</span>
      <el-input-number v-model="max" :controls="false" placeholder="迄" size="small" class="filter-slot-card__range" />
    </div>

    <el-checkbox v-model="exclude">排除符合此條件的股票</el-checkbox>
  </div>
</template>

<style scoped>
.filter-slot-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-bg-color);
}

.filter-slot-card__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-slot-card__label {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  width: 40px;
}

.filter-slot-card__picker {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 11px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  font-size: 14px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.filter-slot-card__picker:hover {
  border-color: var(--el-color-primary);
}

.filter-slot-card__picker.is-empty {
  color: var(--el-text-color-placeholder);
}

.filter-slot-card__range {
  flex: 1;
  min-width: 0;
}

.filter-slot-card__sep {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}
</style>
