<script setup lang="ts">
import { CircleClose } from '@element-plus/icons-vue'
import type { Component } from 'vue'

const props = defineProps<{
  fieldLabel: string
}>()

const emit = defineEmits<{
  reset: []
}>()

const min = defineModel<number | null>('min', { default: null })
const max = defineModel<number | null>('max', { default: null })
const exclude = defineModel<boolean>('exclude', { default: false })

type RangeMode = 'above' | 'below' | 'between' | 'outside' | 'equal'

// Math symbols for the four modes that have an exact one (>, <, ↔, =) — "outside" doesn't
// really have a clean single-glyph equivalent (≠ reads as "not equal to one value", not
// "outside a range"), so that one uses an icon instead. Rendered in a fixed-width column
// (see .range-editor__mode-glyph) so the label text after it lines up row to row — a
// plain string like "↔ 之間" left that to each glyph's own natural character width,
// which is exactly why the text was coming out staggered.
const MODE_OPTIONS: { value: RangeMode; label: string; symbol?: string; icon?: Component }[] = [
  { value: 'above', label: '大於', symbol: '>' },
  { value: 'below', label: '小於', symbol: '<' },
  { value: 'between', label: '之間', symbol: '↔' },
  { value: 'outside', label: '之外', icon: CircleClose },
  { value: 'equal', label: '等於', symbol: '=' }
]

function deriveMode(): RangeMode {
  if (min.value !== null && max.value !== null) {
    if (min.value === max.value) return 'equal'
    return exclude.value ? 'outside' : 'between'
  }
  if (max.value !== null) return 'below'
  return 'above'
}

// Initialized once from whatever min/max/exclude already are (this component is
// recreated fresh each time the popover opens, since it isn't persistent), so reopening
// for an already-configured condition starts on the right mode.
const mode = ref<RangeMode>(deriveMode())
const activeOption = computed(() => MODE_OPTIONS.find(option => option.value === mode.value))

watch(mode, next => {
  if (next === 'above') {
    max.value = null
    exclude.value = false
  } else if (next === 'below') {
    min.value = null
    exclude.value = false
  } else if (next === 'between') {
    exclude.value = false
  } else if (next === 'outside') {
    exclude.value = true
  } else {
    // 'equal': both sides collapse to whichever value already exists (or null).
    exclude.value = false
    const value = min.value ?? max.value
    min.value = value
    max.value = value
  }
})

// 'equal' shows one input that writes the same value into both min and max at once.
const equalValue = computed<number | null>({
  get: () => min.value,
  set: value => {
    min.value = value
    max.value = value
  }
})

function reset() {
  min.value = null
  max.value = null
  exclude.value = false
  mode.value = 'between'
  emit('reset')
}
</script>

<template>
  <div class="range-editor">
    <div class="range-editor__header">
      <span class="range-editor__title">{{ props.fieldLabel }}</span>
      <button type="button" class="range-editor__reset" @click="reset">重置</button>
    </div>
    <div class="range-editor__divider" />
    <div class="range-editor__body">
      <el-select v-model="mode" class="range-editor__mode" popper-class="range-editor__mode-dropdown">
        <template #prefix>
          <span class="range-editor__mode-glyph">
            <el-icon v-if="activeOption?.icon"><component :is="activeOption.icon" /></el-icon>
            <span v-else>{{ activeOption?.symbol }}</span>
          </span>
        </template>
        <el-option v-for="option in MODE_OPTIONS" :key="option.value" :value="option.value" :label="option.label">
          <div class="range-editor__mode-option">
            <span class="range-editor__mode-glyph">
              <el-icon v-if="option.icon"><component :is="option.icon" /></el-icon>
              <span v-else>{{ option.symbol }}</span>
            </span>
            <span>{{ option.label }}</span>
          </div>
        </el-option>
      </el-select>

      <div v-if="mode === 'equal'" class="range-editor__values">
        <el-input-number v-model="equalValue" placeholder="數值" class="range-editor__input" />
      </div>
      <div v-else class="range-editor__values">
        <el-input-number v-if="mode !== 'below'" v-model="min" placeholder="起" class="range-editor__input" />
        <span v-if="mode === 'between' || mode === 'outside'" class="range-editor__sep">～</span>
        <el-input-number v-if="mode !== 'above'" v-model="max" placeholder="迄" class="range-editor__input" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Sets the floor for everything in here that doesn't have its own more specific
   font-size — el-dialog's body itself doesn't otherwise guarantee 16px. Fills the dialog's
   own width (set on the el-dialog in OrganismConditionPill.vue) rather than the fixed
   260px this used when it lived in an el-popover instead. */
.range-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  font-size: 16px;
}

.range-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.range-editor__title {
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.range-editor__reset {
  flex-shrink: 0;
  border: none;
  background: transparent;
  padding: 4px 8px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  border-radius: 4px;
}

.range-editor__reset:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.range-editor__divider {
  height: 1px;
  background: var(--el-border-color-lighter);
}

.range-editor__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.range-editor__mode {
  width: 100%;
}

/* el-select's own "default" size still renders at 14px — not teleported, so reachable
   with :deep(). Its dropdown IS teleported to <body>, out of this component's scoped
   styles entirely; that's what popper-class + the matching global rule below is for. */
.range-editor__mode :deep(.el-select__wrapper),
.range-editor__mode :deep(.el-select__placeholder) {
  font-size: 16px;
}

/* Fixed-width column so the label text starts at the same x position on every row,
   regardless of whether that row's glyph is a narrow symbol like "<" or a wider one
   like "↔", or an icon instead of text at all. */
.range-editor__mode-glyph {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 20px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.range-editor__mode-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-editor__values {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-editor__input {
  flex: 1;
  min-width: 0;
}

.range-editor__input :deep(.el-input__inner) {
  font-size: 16px;
}

.range-editor__sep {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}
</style>

<style>
/* Unscoped on purpose — el-select teleports its dropdown to <body>, so a scoped (or
   :deep()) selector rooted in this component can never reach it. */
.range-editor__mode-dropdown .el-select-dropdown__item {
  font-size: 16px;
}
</style>
