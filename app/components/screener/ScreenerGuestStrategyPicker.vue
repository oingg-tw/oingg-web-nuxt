<script setup lang="ts">
import type { ScreenerTemplate } from '~/composables/screener/useScreenerTemplates'
// In-page replacement for the signed-out onboarding DIALOG this used to be (2026-09-19,
// interface-complexity review) — see useGuestScreener.ts's own top comment for why a modal that
// opened itself on every fresh visit was removed. Same content (a strategy tile grid + a
// registration nudge), now rendered directly in the page's own document flow where the empty
// state used to sit, so a signed-out visitor sees "here's how to start" instead of nothing.
//
// 2026-11-27：格子只有圖示與名稱，說明都在選股策略頁（/screener/strategies），格子下面一行連過去。使用者：「這個範本頁變的
// 太肥了，可以把選擇範本與範本詳細說明拆開嗎？我印象中我們已經有了範本詳細說明區」。原本每格把說明整段寫出來（2026-09-19 從
// 滑過才出現的提示改成常駐文字），範本變 12 組、說明都帶學術出處之後，手機上是 3,980px，「套用」在最底下
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
        class="app-card guest-picker__tile"
        :aria-pressed="selectedTemplateId === template.id"
        :class="{ 'is-selected': selectedTemplateId === template.id }"
        @click="pickTemplate(template.id)"
      >
        <el-icon class="guest-picker__tile-icon" aria-hidden="true"><component :is="filterTemplateIcon(template)" /></el-icon>
        <span class="guest-picker__tile-name">{{ template.name }}</span>
      </button>
    </div>

    <p v-if="!templatesLoading" class="guest-picker__strategies">
      <NuxtLink :to="STRATEGIES_PATH" class="hub-inline-link">看每組選股策略的介紹 ›</NuxtLink>
    </p>

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
   homepage's own highlights grid (Phase C), matching the reference doc's card-grid guidance.
   2026-11-14：看頁面寬（.screener-shell，視窗減左右邊距 32），不看視窗：1024 橫放有側欄時頁面只剩約 750，原本照視窗排三欄擠在一起 */
.guest-picker__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@container (min-width: 568px) {
  .guest-picker__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@container (min-width: 928px) {
  .guest-picker__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.guest-picker__tile {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 56px;
  padding: 12px 16px;
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

.guest-picker__tile-icon {
  flex-shrink: 0;
  font-size: 1.25rem;
  color: var(--el-color-primary);
}

.guest-picker__tile-name {
  font-size: 1rem;
  font-weight: 600;
}

/* 連結本身至少 44px 高（觸控目標），同新增篩選彈窗的那一行 */
.guest-picker__strategies {
  margin: 0;
}

.guest-picker__strategies a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
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
