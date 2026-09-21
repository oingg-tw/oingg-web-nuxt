<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
import type { FilterSchema } from '~/composables/screener/useFilterSchema'

// The one header-row component every stock-detail card uses (2026-09-19, the stock-page a11y/SEO
// redesign). Before this, ~36 cards each had their own copy of the same block — a
// `<span class="x__title">` holding the title text plus an `<el-tooltip>` whose trigger was a bare
// `<el-icon>` — and the same two scoped CSS rules. Three things were wrong with that block
// everywhere at once, which is why it's one component now rather than 36 edits:
//
// 1. Outline: a <span> is not a heading. Every stock page now has one <h1> (StockSummaryCard) and
//    an <h2> per section, so each card's title is the <h3> under it — a screen reader's heading
//    list (and a crawler's outline) finally sees the 24 cards on 公司健檢 as 24 titled things.
//    The heading holds ONLY the title text: the info button and the badge link sit beside it in
//    the same row, never inside it, so the heading's accessible name stays「ROE」not「ROE ROE 說明
//    這是什麼指標？」.
// 2. Keyboard: an <el-icon> can't take focus, so the tooltip's explanation was hover-only
//    (WCAG 2.1.1 / 1.4.13). It's a real <button> now, named「{title} 說明」.
// 3. Internal links: a card whose metric has a guru badge shows a visible「這是什麼指標？」link to
//    that badge's anchor on /guru-indicators — crawlable and focusable, unlike anything inside a
//    tooltip. Whether a badge exists is read from the already-fetched GET /metrics catalog via
//    useNuxtData (never a fetch of its own: 24 sibling cards calling useFilterSchema() at once is
//    exactly the shared-key race in feedback_useasyncdata_shared_key_race), so a page that hasn't
//    awaited the catalog simply shows no link.
//
// Info button switched from a hover/focus el-tooltip to a click-to-toggle, persistent <p> below
// the title row on 2026-09-19 (interface-complexity review) — the reference doc lists hover-
// triggered content as a real barrier for the target audience (imprecise pointing devices, no
// hover at all on touch, easy to dismiss by accident), and a tooltip's floating popper also can't
// be reached by a screen reader's normal reading order the way in-flow text can. The button now
// carries visible "說明" text (an icon alone failed the reference doc's own icon+text rule) and
// toggles `aria-expanded`/`aria-controls` on a real element instead of Element Plus's own
// popper — `useId()` (Nuxt's SSR-safe id generator) ties the two together without the id-drift
// problems this app has hit with other Element Plus components that call useId() internally.
const props = withDefaults(
  defineProps<{
    title: string
    infoText?: string | null
    // The card's primary metric (GET /metrics `key`); only used to look up a badge for the link.
    metricCode?: string | null
    level?: 'h2' | 'h3'
  }>(),
  { infoText: null, metricCode: null, level: 'h3' }
)

const { data: schema } = useNuxtData<FilterSchema>('filter-schema')
const badgeLink = computed(() => {
  const code = props.metricCode
  const categories = schema.value?.categories
  if (!code || !categories) return null
  const hasBadge = categories.some(category => category.metrics.some(metric => metric.key === code && metric.badge))
  return hasBadge ? `/guru-indicators#guru-badge-${code}` : null
})

const infoOpen = ref(false)
const infoId = useId()
</script>

<template>
  <div class="stock-card-title">
    <div class="stock-card-title__row">
      <component :is="level" class="stock-card-title__heading">{{ title }}</component>
      <button
        v-if="infoText"
        type="button"
        class="stock-card-title__info"
        :aria-expanded="infoOpen"
        :aria-controls="infoId"
        @click="infoOpen = !infoOpen"
      >
        <el-icon aria-hidden="true"><InfoFilled /></el-icon><span>說明</span>
      </button>
      <NuxtLink v-if="badgeLink" :to="badgeLink" class="stock-card-title__badge-link">這是什麼指標？</NuxtLink>
    </div>
    <p v-if="infoText && infoOpen" :id="infoId" class="stock-card-title__info-text">{{ infoText }}</p>
  </div>
</template>

<style scoped>
.stock-card-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stock-card-title__row {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
}

/* Same 600-weight, 1rem look the old <span> titles had — an <h3>'s default size/margins would
   otherwise change every card header. */
.stock-card-title__heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
  color: var(--el-text-color-primary);
}

/* Icon + visible "說明" text, ≥44px tall (2026-09-19, replacing the old icon-only hover trigger —
   see this file's own top comment). --el-text-color-regular / dark-2 border both clear WCAG's
   3:1 non-text-contrast bar against the card background. */
.stock-card-title__info {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 0 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: none;
  color: var(--el-color-primary-dark-2);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

.stock-card-title__info-text {
  margin: 8px 0 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

/* --el-color-primary-dark-2, not --el-color-primary: the light-mode accents were tuned to the
   3:1 UI-component bar (main.css's own light-mode accent comment — GOLD measures 4.34:1 on a
   card), which is fine for a filled button but under the 4.5:1 that 16px TEXT needs. dark-2 is
   6.2:1 for GOLD and clears 4.5:1 for every accent, in both modes (dark mode's dark-2 lightens). */
.stock-card-title__badge-link {
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;
}
</style>
