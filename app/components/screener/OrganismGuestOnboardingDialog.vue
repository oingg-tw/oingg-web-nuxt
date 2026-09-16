<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'
import { guestSelectableTemplates } from '~/composables/screener/useGuestScreener'
import { filterTemplateIcon } from '~/utils/screener-template-icons'

// First-visit dialog for a signed-out /screener visitor (see useGuestScreener.ts's own
// comment for the full flow) — per direct request ("陌生用戶造訪時就先跳彈窗...選兩個選項...
// 用戶點下確定再帶入欄位篩選股票清單") this originally asked for 2 choices; simplified 2026-09-11
// per direct follow-up ("我換個做法 陌生用戶選擇篩選策略就好 我們顯示欄位幫選總覽") down to just
// the one — display columns are always the official 總覽 set now, resolved inside
// useGuestScreener.ts itself rather than asked of the visitor. The registration nudge lives in
// this same dialog's own footer (not a second dialog stacked on top) — clicking 現在就註冊 closes
// this dialog first, then opens the shared login dialog, so the two never overlap on screen at
// once (this app's standing "no stacked dialogs" rule).
//
// Icon-over-label tile grid per direct follow-up ("介面太亂了，用 grid 呈現" then "不是這樣，而是
// icon 在上 文字在下那種 主題式呈現") — same tile language as OrganismNewPresetDialog.vue's own
// category grid / AppFeatureMenu.vue's mobile nav grid, reusing this app's already-established
// per-template icon vocabulary (screener-template-icons.ts, shared with those 2 existing
// dialogs). Each description is still available, just moved to an ⓘ tooltip (hover/focus,
// matching GuruIndicatorRow.vue's own formula-tooltip trigger) rather than always-visible body
// text.
const props = defineProps<{
  modelValue: boolean
  templates: ScreenerTemplate[]
  templatesLoading: boolean
  selectedTemplateId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  'update:selectedTemplateId': [id: string | null]
  confirm: []
  register: []
}>()

const isDesktop = useIsDesktop()

const selectableTemplates = computed(() => guestSelectableTemplates(props.templates))

const canConfirm = computed(() => props.selectedTemplateId !== null)

function pickTemplate(id: string) {
  emit('update:selectedTemplateId', id)
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
    :width="isDesktop ? '600px' : '92%'"
    align-center
    append-to-body
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="guest-onboarding-dialog__intro">先選一組篩選策略，馬上看到符合條件的股票清單（顯示欄位固定套用官方「總覽」組合）——不需要登入。</p>

    <div class="guest-onboarding-dialog__section">
      <div v-if="templatesLoading" class="guest-onboarding-dialog__status">載入中…</div>
      <div v-else class="guest-onboarding-dialog__grid">
        <button
          v-for="template in selectableTemplates"
          :key="template.id"
          type="button"
          class="guest-onboarding-dialog__tile"
          :class="{ 'is-selected': selectedTemplateId === template.id }"
          @click="pickTemplate(template.id)"
        >
          <!-- Real bug fixed 2026-09-11 (reported live: "tooltip要可以換行") — el-tooltip's own
               popper has no width constraint by default, so a long single-line description (most
               of these strategy summaries are 60-100+ characters, e.g. citing a paper's own
               threshold formula) rendered as one unbroken line wide enough to spill past this
               560-600px dialog's own edge instead of wrapping. white-space:normal is already
               el-tooltip's own default; it just had nothing to wrap AGAINST without a max-width. -->
          <el-tooltip
            :content="template.description"
            placement="top"
            :trigger="['hover', 'focus']"
            :popper-style="{ maxWidth: '280px', whiteSpace: 'normal' }"
          >
            <el-icon class="guest-onboarding-dialog__tile-info" @click.stop><InfoFilled /></el-icon>
          </el-tooltip>
          <el-icon class="guest-onboarding-dialog__tile-icon"><component :is="filterTemplateIcon(template)" /></el-icon>
          <span class="guest-onboarding-dialog__tile-label">{{ template.name }}</span>
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
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.guest-onboarding-dialog__status {
  padding: 16px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 1rem;
}

/* Icon-over-label tile grid, per direct feedback ("icon 在上 文字在下那種 主題式呈現") — same
   3-column tile language as OrganismNewPresetDialog.vue's own category grid, capped at a max
   height with its own scroll for a section with more entries than fit in view at once. */
.guest-onboarding-dialog__grid {
  max-height: 360px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: min-content;
  gap: 12px;
  padding: 4px 4px 4px 0;
}

.guest-onboarding-dialog__tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: transparent;
  color: var(--el-text-color-primary);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.guest-onboarding-dialog__tile:hover {
  border-color: var(--el-color-primary-light-5);
}

.guest-onboarding-dialog__tile.is-selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.guest-onboarding-dialog__tile-icon {
  font-size: 1.5rem;
  color: var(--el-color-primary);
}

.guest-onboarding-dialog__tile-label {
  font-size: 1rem;
  text-align: center;
  line-height: 1.3;
}

/* Real <button> (not a bare el-icon), keyboard-focusable, trigger includes focus — same AA
   discipline as GuruIndicatorRow.vue's own formula-info icon. @click.stop on both this and the
   tooltip trigger keeps a tap on the ⓘ from also selecting the tile underneath it. */
.guest-onboarding-dialog__tile-info {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 0.875rem;
  color: var(--el-text-color-placeholder);
  cursor: help;
}

.guest-onboarding-dialog__tile-info:hover {
  color: var(--el-color-primary);
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
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.guest-onboarding-dialog__nudge-link {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--el-color-primary);
  font-size: 1rem;
  text-decoration: underline;
  cursor: pointer;
}
</style>
