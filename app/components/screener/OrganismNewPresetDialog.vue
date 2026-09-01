<script setup lang="ts">
import { ArrowLeft, Edit, Trophy } from '@element-plus/icons-vue'
import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'

const props = defineProps<{
  modelValue: boolean
  templates: ScreenerTemplate[]
  templatesLoading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  custom: []
  template: [id: string]
}>()

const isDesktop = useIsDesktop()

// Two steps in one dialog rather than two dialogs — "choose type" then "browse templates"
// is one continuous decision, and a back button reads more naturally than closing one
// dialog and reopening another. Reset to the first step every time this reopens, so it
// never comes back showing wherever the user last left off.
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

function chooseTemplate(template: ScreenerTemplate) {
  if (template.status !== 'AVAILABLE') return
  emit('template', template.id)
  close()
}

// Grouped by the backend's own `category` field (大師策略／量化因子／台股籌碼面／存股主題
// as of writing) rather than a frontend-maintained list — a new category added server-side
// just shows up as its own group here with no code change needed.
const groupedTemplates = computed(() => {
  const groups = new Map<string, ScreenerTemplate[]>()
  for (const template of props.templates) {
    const list = groups.get(template.category) ?? []
    list.push(template)
    groups.set(template.category, list)
  }
  return [...groups.entries()]
})
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="step === 'choose' ? '新增分頁' : '官方精選策略'"
    :width="isDesktop ? '560px' : '92%'"
    align-center
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="step === 'choose'" class="new-preset-dialog__choices">
      <button type="button" class="new-preset-dialog__choice" @click="step = 'browse'">
        <el-icon class="new-preset-dialog__choice-icon"><Trophy /></el-icon>
        <span class="new-preset-dialog__choice-title">官方精選策略</span>
        <span class="new-preset-dialog__choice-desc">套用我們維護好的選股策略，一鍵開始</span>
      </button>
      <button type="button" class="new-preset-dialog__choice" @click="chooseCustom">
        <el-icon class="new-preset-dialog__choice-icon"><Edit /></el-icon>
        <span class="new-preset-dialog__choice-title">自訂篩選邏輯</span>
        <span class="new-preset-dialog__choice-desc">從空白條件開始，自由組合任何篩選邏輯</span>
      </button>
    </div>

    <div v-else class="new-preset-dialog__browse">
      <button type="button" class="new-preset-dialog__back" @click="step = 'choose'">
        <el-icon><ArrowLeft /></el-icon>返回
      </button>

      <div v-if="templatesLoading" class="new-preset-dialog__status">載入中…</div>
      <div v-else-if="!templates.length" class="new-preset-dialog__status">目前沒有可用的策略</div>
      <div v-else class="new-preset-dialog__groups">
        <div v-for="[category, items] in groupedTemplates" :key="category" class="new-preset-dialog__group">
          <h3 class="new-preset-dialog__group-title">{{ category }}</h3>
          <button
            v-for="template in items"
            :key="template.id"
            type="button"
            class="new-preset-dialog__template"
            :class="{ 'is-pending': template.status !== 'AVAILABLE' }"
            :disabled="template.status !== 'AVAILABLE'"
            @click="chooseTemplate(template)"
          >
            <div class="new-preset-dialog__template-head">
              <span class="new-preset-dialog__template-name">{{ template.name }}</span>
              <el-tag size="small" :type="template.tier === 'PAID' ? 'warning' : 'success'" effect="plain">
                {{ template.tier === 'PAID' ? '付費' : '免費' }}
              </el-tag>
              <el-tag v-if="template.status !== 'AVAILABLE'" size="small" type="info" effect="plain">即將推出</el-tag>
            </div>
            <p class="new-preset-dialog__template-desc">{{ template.description }}</p>
            <p v-if="template.pendingReason" class="new-preset-dialog__template-pending">{{ template.pendingReason }}</p>
          </button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.new-preset-dialog__choices {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.new-preset-dialog__choice {
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

.new-preset-dialog__choice:hover {
  border-color: var(--el-color-primary-light-5);
}

.new-preset-dialog__choice-icon {
  font-size: 22px;
  color: var(--el-color-primary);
  margin-bottom: 4px;
}

.new-preset-dialog__choice-title {
  font-size: 16px;
  font-weight: 600;
}

.new-preset-dialog__choice-desc {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.new-preset-dialog__back {
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

.new-preset-dialog__back:hover {
  color: var(--el-color-primary);
}

.new-preset-dialog__status {
  padding: 24px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 16px;
}

.new-preset-dialog__groups {
  max-height: 60vh;
  overflow-y: auto;
}

.new-preset-dialog__group + .new-preset-dialog__group {
  margin-top: 16px;
}

.new-preset-dialog__group-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

/* Whole card is the click target now (was just a small "套用" button pinned top-right,
   inconsistent with the choose-step cards above and awkward once a longer description
   wrapped to 2-3 lines) — same real <button> + hover-border pattern as
   .new-preset-dialog__choice, just left-aligned block layout instead of that one's
   flex-column, since the tag row + description here read better as stacked blocks. Pending
   templates stay disabled (native disabled, not just a visual dim) — chooseTemplate already
   no-ops for them, this is what stops the click and the hover border from firing at all. */
.new-preset-dialog__template {
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

.new-preset-dialog__template:not(:disabled):hover {
  border-color: var(--el-color-primary-light-5);
}

.new-preset-dialog__template + .new-preset-dialog__template {
  margin-top: 8px;
}

.new-preset-dialog__template.is-pending {
  opacity: 0.6;
  cursor: not-allowed;
}

.new-preset-dialog__template-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.new-preset-dialog__template-name {
  font-size: 16px;
  font-weight: 600;
}

.new-preset-dialog__template-desc {
  margin: 6px 0 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.new-preset-dialog__template-pending {
  margin: 4px 0 0;
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}
</style>
