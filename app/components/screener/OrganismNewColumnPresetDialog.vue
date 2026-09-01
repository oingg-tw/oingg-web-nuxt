<script setup lang="ts">
import { ArrowLeft, Edit, Trophy } from '@element-plus/icons-vue'
import type { ColumnPresetTemplate } from '~/composables/screener/useScreenerColumnPresets'

const props = defineProps<{
  modelValue: boolean
  templates: ColumnPresetTemplate[]
  templatesLoading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  custom: []
  template: [key: string]
}>()

const isDesktop = useIsDesktop()

// Same choose/browse two-step pattern as ScreenerOrganismNewPresetDialog (filter presets) —
// "choose type" then "browse official options" reads as one continuous decision, and a back
// button beats closing one dialog and reopening another. Reset to the first step every time
// this reopens, same reasoning as that dialog.
const step = ref<'choose' | 'browse'>('choose')

watch(
  () => props.modelValue,
  visible => {
    if (visible) step.value = 'choose'
  }
)

function close() {
  emit('update:modelValue', false)
}

function chooseCustom() {
  emit('custom')
  close()
}

function chooseTemplate(template: ColumnPresetTemplate) {
  emit('template', template.key)
  close()
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="step === 'choose' ? '新增欄位組合' : '官方精選欄位組合'"
    :width="isDesktop ? '560px' : '92%'"
    align-center
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="step === 'choose'" class="new-column-preset-dialog__choices">
      <button type="button" class="new-column-preset-dialog__choice" @click="step = 'browse'">
        <el-icon class="new-column-preset-dialog__choice-icon"><Trophy /></el-icon>
        <span class="new-column-preset-dialog__choice-title">官方精選欄位組合</span>
        <span class="new-column-preset-dialog__choice-desc">套用我們整理好的常用欄位組合，一鍵開始</span>
      </button>
      <button type="button" class="new-column-preset-dialog__choice" @click="chooseCustom">
        <el-icon class="new-column-preset-dialog__choice-icon"><Edit /></el-icon>
        <span class="new-column-preset-dialog__choice-title">自訂欄位</span>
        <span class="new-column-preset-dialog__choice-desc">從空白開始，自由挑選要顯示的欄位</span>
      </button>
    </div>

    <!-- Flat list, not grouped like ScreenerOrganismNewPresetDialog's filter templates —
         GET /screener/column-preset-templates has no category/tier/status fields, just
         key/name/description/fieldKeys (confirmed live with bff-ts 2026-09-01). -->
    <div v-else class="new-column-preset-dialog__browse">
      <button type="button" class="new-column-preset-dialog__back" @click="step = 'choose'">
        <el-icon><ArrowLeft /></el-icon>返回
      </button>

      <div v-if="templatesLoading" class="new-column-preset-dialog__status">載入中…</div>
      <div v-else-if="!templates.length" class="new-column-preset-dialog__status">目前沒有可用的欄位組合</div>
      <div v-else class="new-column-preset-dialog__templates">
        <button
          v-for="template in templates"
          :key="template.key"
          type="button"
          class="new-column-preset-dialog__template"
          @click="chooseTemplate(template)"
        >
          <span class="new-column-preset-dialog__template-name">{{ template.name }}</span>
          <p class="new-column-preset-dialog__template-desc">{{ template.description }}</p>
        </button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.new-column-preset-dialog__choices {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.new-column-preset-dialog__choice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.new-column-preset-dialog__choice:hover {
  border-color: var(--el-color-primary-light-5);
}

.new-column-preset-dialog__choice-icon {
  font-size: 22px;
  color: var(--el-color-primary);
  margin-bottom: 4px;
}

.new-column-preset-dialog__choice-title {
  font-size: 16px;
  font-weight: 600;
}

.new-column-preset-dialog__choice-desc {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.new-column-preset-dialog__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 16px;
  cursor: pointer;
}

.new-column-preset-dialog__back:hover {
  color: var(--el-color-primary);
}

.new-column-preset-dialog__status {
  padding: 24px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 16px;
}

.new-column-preset-dialog__templates {
  max-height: 60vh;
  overflow-y: auto;
}

/* Whole card is the click target now (was just a small "套用" button pinned top-right,
   inconsistent with the choose-step cards above and awkward once a longer description
   wrapped to 2-3 lines) — same real <button> + hover-border pattern as
   .new-column-preset-dialog__choice, just left-aligned block layout instead of that one's
   flex-column, since name+description here read better as a plain stacked paragraph. */
.new-column-preset-dialog__template {
  display: block;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.new-column-preset-dialog__template:hover {
  border-color: var(--el-color-primary-light-5);
}

.new-column-preset-dialog__template + .new-column-preset-dialog__template {
  margin-top: 8px;
}

.new-column-preset-dialog__template-name {
  font-size: 16px;
  font-weight: 600;
}

.new-column-preset-dialog__template-desc {
  margin: 6px 0 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
</style>
