<script setup lang="ts">
import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'
import { guestSelectableTemplates } from '~/composables/screener/useGuestScreener'
import { filterTemplateIcon } from '~/utils/screener-template-icons'

// In-page replacement for the signed-out onboarding DIALOG this used to be (2026-09-19,
// interface-complexity review) — see useGuestScreener.ts's own top comment for why a modal that
// opened itself on every fresh visit was removed. Same content (a strategy tile grid + a
// registration nudge), now rendered directly in the page's own document flow where the empty
// state used to sit, so a signed-out visitor sees "here's how to start" instead of nothing.
//
// Every description is now PERMANENT body text on its own tile (was a hover/focus el-tooltip
// behind a small ⓘ icon) — the reference doc lists hover-triggered content as a barrier for the
// target audience, and a tile this size has room for two lines of description without needing to
// hide them behind an icon at all.
const props = defineProps<{
  templates: ScreenerTemplate[]
  templatesLoading: boolean
  selectedTemplateId: string | null
}>()

const emit = defineEmits<{
  'update:selectedTemplateId': [id: string | null]
  confirm: []
  register: []
}>()

const selectableTemplates = computed(() => guestSelectableTemplates(props.templates))
const canConfirm = computed(() => props.selectedTemplateId !== null)

function pickTemplate(id: string) {
  emit('update:selectedTemplateId', id)
}

function confirm() {
  if (!canConfirm.value) return
  emit('confirm')
}
</script>

<template>
  <section class="guest-picker" aria-labelledby="guest-picker-heading">
    <h2 id="guest-picker-heading" class="guest-picker__heading">先選一組篩選條件</h2>
    <p class="guest-picker__intro">先選一組篩選策略，馬上看到符合條件的股票清單（顯示欄位固定套用官方「總覽」組合）。不需要登入。</p>

    <div v-if="templatesLoading" class="guest-picker__status">載入中…</div>
    <div v-else class="guest-picker__grid">
      <button
        v-for="template in selectableTemplates"
        :key="template.id"
        type="button"
        class="guest-picker__tile"
        :aria-pressed="selectedTemplateId === template.id"
        :class="{ 'is-selected': selectedTemplateId === template.id }"
        @click="pickTemplate(template.id)"
      >
        <span class="guest-picker__tile-head">
          <el-icon class="guest-picker__tile-icon" aria-hidden="true"><component :is="filterTemplateIcon(template)" /></el-icon>
          <span class="guest-picker__tile-name">{{ template.name }}</span>
        </span>
        <span class="guest-picker__tile-desc">{{ template.description }}</span>
      </button>
    </div>

    <div class="guest-picker__footer">
      <el-button type="primary" :disabled="!canConfirm" class="guest-picker__confirm" @click="confirm">套用這組條件</el-button>
      <!-- Registration funnel per direct request — the copy is deliberately framed as a benefit
           (saved presets), not a requirement: confirm still works with zero account, this is
           only an invitation. -->
      <el-button class="guest-picker__register" @click="emit('register')">不想每次都重新選嗎？現在就註冊</el-button>
    </div>
  </section>
</template>

<style scoped>
.guest-picker {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.guest-picker__heading {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.guest-picker__intro {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.guest-picker__status {
  padding: 16px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 1rem;
}

/* 1 column by default, 2 from 600px, 3 from 960px (2026-09-19) — same step progression as the
   homepage's own highlights grid (Phase C), matching the reference doc's card-grid guidance. */
.guest-picker__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @media (min-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 960px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.guest-picker__tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-height: 64px;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: transparent;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.guest-picker__tile:hover {
  border-color: var(--el-color-primary-light-5);
}

/* border width (not colour alone) + bold name marks the selected state — same "don't rely on
   colour alone" discipline as this app's guru-badge shape system. */
.guest-picker__tile.is-selected {
  border: 2px solid var(--el-color-primary-dark-2);
  background: var(--el-color-primary-light-9);
}

.guest-picker__tile.is-selected .guest-picker__tile-name {
  font-weight: 700;
}

.guest-picker__tile-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.guest-picker__tile-icon {
  flex-shrink: 0;
  font-size: 1.25rem;
  color: var(--el-color-primary);
}

.guest-picker__tile-name {
  font-size: 1rem;
  font-weight: 600;
}

.guest-picker__tile-desc {
  font-size: 1rem;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.guest-picker__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.guest-picker__confirm,
.guest-picker__register {
  min-height: 48px;
  padding: 0 16px;
  font-size: 1rem;
}
</style>
