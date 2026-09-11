<script setup lang="ts">
import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'
import type { ColumnPresetTemplate } from '~/composables/screener/useScreenerColumnPresets'
import { guestSelectableTemplates } from '~/composables/screener/useGuestScreener'

// First-visit dialog for a signed-out /screener visitor (see useGuestScreener.ts's own
// comment for the full flow) — per direct request ("陌生用戶造訪時就先跳彈窗...選兩個選項...
// 用戶點下確定再帶入欄位篩選股票清單"), two required choices (a filter strategy, a column
// set), both must be picked before 確定 is enabled. The registration nudge lives in this same
// dialog's own footer (not a second dialog stacked on top) — clicking 現在就註冊 closes this
// dialog first, then opens the shared login dialog, so the two never overlap on screen at once
// (this app's standing "no stacked dialogs" rule).
const props = defineProps<{
  modelValue: boolean
  templates: ScreenerTemplate[]
  templatesLoading: boolean
  columnTemplates: ColumnPresetTemplate[]
  columnTemplatesLoading: boolean
  selectedTemplateId: string | null
  selectedColumnTemplateKey: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  'update:selectedTemplateId': [id: string | null]
  'update:selectedColumnTemplateKey': [key: string | null]
  confirm: []
  register: []
}>()

const isDesktop = useIsDesktop()

const selectableTemplates = computed(() => guestSelectableTemplates(props.templates))

const canConfirm = computed(() => props.selectedTemplateId !== null && props.selectedColumnTemplateKey !== null)

function pickTemplate(id: string) {
  emit('update:selectedTemplateId', id)
}

function pickColumnTemplate(key: string) {
  emit('update:selectedColumnTemplateKey', key)
}

function confirm() {
  if (!canConfirm.value) return
  emit('confirm')
}

function register() {
  emit('update:modelValue', false)
  emit('register')
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="開始普通股篩選"
    :width="isDesktop ? '520px' : '92%'"
    align-center
    append-to-body
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="guest-onboarding-dialog__intro">先選一組篩選策略跟顯示欄位，馬上看到符合條件的股票清單——不需要登入。</p>

    <div class="guest-onboarding-dialog__section">
      <p class="guest-onboarding-dialog__section-title">1. 選擇篩選策略</p>
      <div v-if="templatesLoading" class="guest-onboarding-dialog__status">載入中…</div>
      <div v-else class="guest-onboarding-dialog__list">
        <button
          v-for="template in selectableTemplates"
          :key="template.id"
          type="button"
          class="guest-onboarding-dialog__item"
          :class="{ 'is-selected': selectedTemplateId === template.id }"
          @click="pickTemplate(template.id)"
        >
          <span class="guest-onboarding-dialog__item-name">{{ template.name }}</span>
          <span class="guest-onboarding-dialog__item-desc">{{ template.description }}</span>
        </button>
      </div>
    </div>

    <div class="guest-onboarding-dialog__section">
      <p class="guest-onboarding-dialog__section-title">2. 選擇顯示欄位</p>
      <div v-if="columnTemplatesLoading" class="guest-onboarding-dialog__status">載入中…</div>
      <div v-else class="guest-onboarding-dialog__list">
        <button
          v-for="columnTemplate in columnTemplates"
          :key="columnTemplate.key"
          type="button"
          class="guest-onboarding-dialog__item"
          :class="{ 'is-selected': selectedColumnTemplateKey === columnTemplate.key }"
          @click="pickColumnTemplate(columnTemplate.key)"
        >
          <span class="guest-onboarding-dialog__item-name">{{ columnTemplate.name }}</span>
          <span class="guest-onboarding-dialog__item-desc">{{ columnTemplate.description }}</span>
        </button>
      </div>
    </div>

    <template #footer>
      <div class="guest-onboarding-dialog__footer">
        <!-- Registration funnel per direct request — the copy is deliberately framed as a
             benefit (saved presets), not a requirement: confirm still works with zero account,
             this is only an invitation. -->
        <p class="guest-onboarding-dialog__nudge">
          不想每次都重新選嗎？
          <button type="button" class="guest-onboarding-dialog__nudge-link" @click="register">現在就註冊</button>
          ，保留您自訂的篩選條件。
        </p>
        <el-button type="primary" :disabled="!canConfirm" @click="confirm">確定</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.guest-onboarding-dialog__intro {
  margin: 0 0 16px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.guest-onboarding-dialog__section + .guest-onboarding-dialog__section {
  margin-top: 20px;
}

.guest-onboarding-dialog__section-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.guest-onboarding-dialog__status {
  padding: 16px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 16px;
}

.guest-onboarding-dialog__list {
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.guest-onboarding-dialog__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.guest-onboarding-dialog__item:hover {
  border-color: var(--el-color-primary-light-5);
}

.guest-onboarding-dialog__item.is-selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.guest-onboarding-dialog__item-name {
  font-size: 16px;
  font-weight: 600;
}

.guest-onboarding-dialog__item-desc {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.guest-onboarding-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.guest-onboarding-dialog__nudge {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.guest-onboarding-dialog__nudge-link {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--el-color-primary);
  font-size: 16px;
  text-decoration: underline;
  cursor: pointer;
}
</style>
