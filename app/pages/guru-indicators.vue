<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import { GURU_BADGE_CATEGORIES, GURU_CATEGORY_ICON, buildGuruBadges } from '~/utils/guru-badges'
import type { GuruBadge, GuruBadgeCategory } from '~/utils/guru-badges'

// 大師徽章 (renamed from 徽章與指標 2026-09-14, itself renamed same day from 徽章系統, then again
// from 大師指標 before that — see app-features.ts's own comment history) — this page used to show
// TWO tiers (badges with a real pass/fail threshold, plus a plain "其他指標" reference table for
// every other metric with no badge yet), REDUCED TO BADGES ONLY 2026-09-14 per direct request
// ("徽章與指標功能 不再顯示指標，因為表格模式取代了指標") — stock/[code].vue's own 表格模式
// (StockHistoricalStatisticsTable.vue) already shows every real metric as plain numbers now, so a
// second, symbol-less reference table of the same metrics here was redundant. GuruIndicatorRow.vue
// (the old table's own row component) was deleted the same day, now fully unused.
//
// Layout confirmed via AskUserQuestion 2026-09-10: single scrollable page (not per-category
// tabs) with a search box and an anchor-nav chip row — keeps this a real "reference manual" a
// screen reader can walk linearly, and lets a browser's own Ctrl+F still work across everything
// at once, which per-category tabs would break (only the active tab's DOM is meaningfully
// visible to in-page search).
//
// `await useFilterSchema()` (not a bare call) — same real bug already fixed in stock/[code].vue
// 2026-09-10: an un-awaited call here would let SSR serialize the mock fallback before the real
// fetch resolves, and client hydration's own cache-reuse would then never retry. Awaiting here
// (this page's own top-level setup, same pattern as screener.vue) avoids that entirely.
const { data: filterSchema } = await useFilterSchema()

interface CategoryGroup {
  category: GuruBadgeCategory
  anchor: string
  badges: GuruBadge[]
}

// Ordered by GURU_BADGE_CATEGORIES (this app's own preferred display order), not GET /metrics'
// own category array order — matches every other place in this app that treats backend order as
// a data concern, not a display one (see financial-analysis-dimensions.ts's own comment).
//
// No longer needs usePiotroskiBreakdown() for a reference symbol's static groupMetadata — that
// was only ever needed because piotroskiFScore used to be split into 3 badges here too, each
// needing its own name/summary/detail from that per-symbol endpoint (see guru-badges.ts's own
// PIOTROSKI_FIELD_ID comment for the 2026-09-19 remerge). It's a single ordinary badge now,
// fully described by GET /metrics' own `badge` field like every other one on this page.
const categoryGroups = computed<CategoryGroup[]>(() => {
  const categories = filterSchema.value?.categories ?? []
  const allBadges = buildGuruBadges(categories)

  return GURU_BADGE_CATEGORIES.map(category => {
    const badges = allBadges.filter(badge => badge.category === category)
    return { category, anchor: `guru-cat-${category}`, badges }
  }).filter(group => group.badges.length > 0)
})

const searchQuery = ref('')

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query)
}

const filteredGroups = computed<CategoryGroup[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return categoryGroups.value
  return categoryGroups.value
    .map(group => ({
      ...group,
      badges: group.badges.filter(
        badge => matchesQuery(badge.name, query) || matchesQuery(badge.nameEn, query) || matchesQuery(badge.author, query)
      )
    }))
    .filter(group => group.badges.length > 0)
})
</script>

<template>
  <div class="guru-indicators-page">
    <h1 class="guru-indicators-page__title">大師徽章</h1>
    <p class="guru-indicators-page__subtitle">
      公開學術文獻與投資實務中常見的財務評分方法論參考手冊——不是任何一檔股票的評等或投資建議
    </p>

    <label for="guru-indicators-search" class="guru-indicators-page__search-label">搜尋徽章名稱</label>
    <el-input
      id="guru-indicators-search"
      v-model="searchQuery"
      class="guru-indicators-page__search"
      placeholder="搜尋徽章名稱，例如 ROE、F-Score"
      clearable
      :prefix-icon="Search"
    />

    <!-- Per direct follow-up ("guru-indicators-page__nav 這整排都不要顏色，但是要放icon") — the
         8 fixed category colors were dropped from this row (same "reduce visual noise" reasoning
         as the badge-color unification earlier the same day), replaced with the same per-
         category icon stock/[code].vue's own tab row already uses (GURU_CATEGORY_ICON, moved to
         guru-badges.ts so both consumers share it — see that file's own comment). The section
         headings below (guru-indicators-page__section-dot) weren't asked about and keep their
         color dots unchanged. -->
    <nav v-if="filteredGroups.length" class="guru-indicators-page__nav" aria-label="分類快速跳轉">
      <a v-for="group in filteredGroups" :key="group.anchor" :href="`#${group.anchor}`" class="guru-indicators-page__nav-link">
        <el-icon class="guru-indicators-page__nav-icon"><component :is="GURU_CATEGORY_ICON[group.category]" /></el-icon>
        {{ group.category }}
      </a>
    </nav>

    <el-empty v-if="!filteredGroups.length" description="找不到符合的徽章" :image-size="72" />

    <section v-for="group in filteredGroups" :id="group.anchor" :key="group.anchor" class="guru-indicators-page__section">
      <!-- Per direct follow-up ("guru-indicators-page__section-title 比照辦理 顏色拿掉 換上
           icon") — same treatment as the nav row just above (see that element's own comment). -->
      <h2 class="guru-indicators-page__section-title">
        <el-icon class="guru-indicators-page__section-icon"><component :is="GURU_CATEGORY_ICON[group.category]" /></el-icon>
        {{ group.category }}
      </h2>

      <div class="guru-indicators-page__grid">
        <GuruBadgeCard v-for="badge in group.badges" :key="badge.id" :badge="badge" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.guru-indicators-page {
  width: 100%;
}

/* Bottom margin trimmed 16px→8px 2026-09-16 (paired with subtitle's own margin fix below) — see
   that rule's comment for why. */
.guru-indicators-page__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 8px;
}

/* Real bug fixed 2026-09-16 ("全站嚴禁出現 負 margin 負 padding") — used to pull itself up 8px
   toward the title above via `margin: -8px 0 24px`, achieving the same 8px title-to-subtitle gap
   by shrinking the TITLE's own bottom margin instead (16px→8px, see that rule) — identical visual
   result, no negative margin needed on either element. */
.guru-indicators-page__subtitle {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  margin: 0 0 24px;
}

/* Visually hidden but still reachable by screen readers/browser find, per WCAG 3.3.2 ("Labels
   or Instructions") — a placeholder alone isn't a real accessible name once cleared/focused.
   Uses `clip-path: inset(50%)` (2026-09-16, replacing the older `clip: rect(0,0,0,0)` +
   `margin: -1px` combo per "全站嚴禁出現 負 margin") — clip-path alone clips the entire 1x1px box
   to nothing, so the negative margin belt-and-suspenders (a legacy holdover from older browsers'
   own visually-hidden recipes) isn't needed to get a zero visual footprint. */
.guru-indicators-page__search-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.guru-indicators-page__search {
  max-width: 420px;
  margin-bottom: 16px;
}

.guru-indicators-page__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 32px;
}

.guru-indicators-page__nav-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--el-border-color);
  font-size: 1rem;
  color: var(--el-text-color-primary);
  text-decoration: none;
}

.guru-indicators-page__nav-link:hover {
  background: var(--el-fill-color-light);
}

.guru-indicators-page__nav-icon {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.guru-indicators-page__section-icon {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.guru-indicators-page__section {
  scroll-margin-top: 16px;
}

.guru-indicators-page__section + .guru-indicators-page__section {
  margin-top: 40px;
}

.guru-indicators-page__section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 16px;
}

.guru-indicators-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
</style>
