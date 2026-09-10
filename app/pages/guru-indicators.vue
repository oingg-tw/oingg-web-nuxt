<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import { GURU_BADGE_CATEGORIES, GURU_CATEGORY_ICON, METRIC_CATEGORY_KEY_TO_DISPLAY, buildGuruBadges } from '~/utils/guru-badges'
import type { GuruBadge, GuruBadgeCategory } from '~/utils/guru-badges'
import { bySort } from '~/composables/screener/useFilterSchema'
import type { FilterMetric } from '~/composables/screener/useFilterSchema'

// 徽章與指標 (renamed same day from 徽章系統, then again from 大師指標 — see app-features.ts's
// own comment history) — REBUILT 2026-09-10 per direct request ("徽章與指標頁面，會用來介紹各種
// 徽章與指標，應用剛才接上的metrics內容，請設計一個版本來呈現") once GET /metrics (renamed same
// day from GET /filters, see useFilterSchema.ts's own comment) confirmed a much bigger real
// catalog than this page previously showed: 84 real metrics across 7 categories, 74 of which now
// carry a real formulaLatex (analysis-ts backfilled far beyond the original 4-metric pilot the
// day this was first wired in). This page now shows BOTH tiers on one page:
//   1. 徽章 (GuruBadgeCard) — the curated badge subset with a real, literature-sourced pass/fail
//      threshold (data now read live from GET /metrics' own `badge` field, see
//      guru-badges.ts's own buildGuruBadges() comment for the 2026-09-10 migration).
//   2. 其他指標 (GuruIndicatorRow) — every other real metric in GET /metrics that has no badge
//      yet: just a name/unit/period list and, where backfilled, a real formula. These are NOT
//      evaluated against any threshold — analysis-ts hasn't backfilled description/source text
//      for any of them yet (confirmed live, every metric's own `description`/`source` is still
//      null), so there's nothing to interpret, only the definition itself to reference.
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

// This page has no "current symbol" of its own (it's a pure reference manual, not a per-stock
// view) — but the 3 Piotroski sub-badges' own name/summary/detail/denominator now live on
// GET /stocks/:symbol/piotroski-breakdown's own `groupMetadata` field (see guru-badges.ts's own
// buildPiotroskiBadges() comment), which is a per-symbol endpoint. analysis-ts's own guarantee
// is that groupMetadata/signalLabels are STATIC — they don't vary by symbol or period, and are
// present even when `found: false` — so querying with any real, always-listed symbol works just
// to harvest that static metadata; 2330 is picked only because it's this app's own de facto
// "reference stock" already used elsewhere for the same reason (e.g. this session's own
// Playwright verification runs). This never reads groupMetadata's SYMBOL-SPECIFIC sibling data
// (groups/totalScore/etc.) — only the static part.
const { data: piotroskiReferenceBreakdown } = usePiotroskiBreakdown(computed(() => '2330'))

interface CategoryGroup {
  category: GuruBadgeCategory
  anchor: string
  badges: GuruBadge[]
  indicatorMetrics: FilterMetric[]
}

// Ordered by GURU_BADGE_CATEGORIES (this app's own preferred display order), not GET /metrics'
// own category array order — matches every other place in this app that treats backend order as
// a data concern, not a display one (see financial-analysis-dimensions.ts's own comment).
const categoryGroups = computed<CategoryGroup[]>(() => {
  const categories = filterSchema.value?.categories ?? []
  const allBadges = buildGuruBadges(categories, piotroskiReferenceBreakdown.value?.groupMetadata)
  const metricsByDisplayCategory = new Map<string, FilterMetric[]>()
  for (const backendCategory of categories) {
    const displayCategory = METRIC_CATEGORY_KEY_TO_DISPLAY[backendCategory.key]
    if (displayCategory) metricsByDisplayCategory.set(displayCategory, bySort(backendCategory.metrics))
  }

  return GURU_BADGE_CATEGORIES.map(category => {
    const badges = allBadges.filter(badge => badge.category === category)
    const metrics = metricsByDisplayCategory.get(category) ?? []
    // A metric already covered by a badge (matched on the metric-key part of the badge's own
    // fieldId, e.g. "sue.Q" -> "sue") doesn't need a second, redundant plain-indicator row right
    // below its own badge card.
    const badgeMetricKeys = new Set(badges.map(badge => badge.fieldId.split('.')[0]))
    const indicatorMetrics = metrics.filter(metric => !badgeMetricKeys.has(metric.key))
    return { category, anchor: `guru-cat-${category}`, badges, indicatorMetrics }
  }).filter(group => group.badges.length > 0 || group.indicatorMetrics.length > 0)
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
      ),
      indicatorMetrics: group.indicatorMetrics.filter(metric => matchesQuery(metric.name, query))
    }))
    .filter(group => group.badges.length > 0 || group.indicatorMetrics.length > 0)
})
</script>

<template>
  <div class="guru-indicators-page">
    <h1 class="guru-indicators-page__title">徽章與指標</h1>
    <p class="guru-indicators-page__subtitle">
      公開學術文獻與投資實務中常見的財務評分方法論與指標定義參考手冊——不是任何一檔股票的評等或投資建議
    </p>

    <label for="guru-indicators-search" class="guru-indicators-page__search-label">搜尋徽章或指標名稱</label>
    <el-input
      id="guru-indicators-search"
      v-model="searchQuery"
      class="guru-indicators-page__search"
      placeholder="搜尋徽章或指標名稱，例如 ROE、F-Score"
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

    <el-empty v-if="!filteredGroups.length" description="找不到符合的徽章或指標" :image-size="72" />

    <section v-for="group in filteredGroups" :id="group.anchor" :key="group.anchor" class="guru-indicators-page__section">
      <!-- Per direct follow-up ("guru-indicators-page__section-title 比照辦理 顏色拿掉 換上
           icon") — same treatment as the nav row just above (see that element's own comment). -->
      <h2 class="guru-indicators-page__section-title">
        <el-icon class="guru-indicators-page__section-icon"><component :is="GURU_CATEGORY_ICON[group.category]" /></el-icon>
        {{ group.category }}
      </h2>

      <template v-if="group.badges.length">
        <h3 class="guru-indicators-page__subheading">徽章</h3>
        <div class="guru-indicators-page__grid">
          <GuruBadgeCard v-for="badge in group.badges" :key="badge.id" :badge="badge" />
        </div>
      </template>

      <template v-if="group.indicatorMetrics.length">
        <h3 :id="`${group.anchor}-indicators-heading`" class="guru-indicators-page__subheading">其他指標</h3>
        <table class="guru-indicators-page__table" :aria-labelledby="`${group.anchor}-indicators-heading`">
          <thead>
            <tr>
              <th scope="col">名稱</th>
              <th scope="col">公式</th>
              <th scope="col">可用期間</th>
              <th scope="col">資料來源</th>
              <th scope="col">單位</th>
            </tr>
          </thead>
          <tbody>
            <GuruIndicatorRow v-for="metric in group.indicatorMetrics" :key="metric.key" :metric="metric" />
          </tbody>
        </table>
      </template>
    </section>
  </div>
</template>

<style scoped>
.guru-indicators-page {
  width: 100%;
}

.guru-indicators-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
}

.guru-indicators-page__subtitle {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: -8px 0 24px;
}

/* Visually hidden but still reachable by screen readers/browser find, per WCAG 3.3.2 ("Labels
   or Instructions") — a placeholder alone isn't a real accessible name once cleared/focused. */
.guru-indicators-page__search-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
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
  font-size: 16px;
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
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
}

.guru-indicators-page__subheading {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin: 0 0 8px;
}

.guru-indicators-page__subheading + .guru-indicators-page__subheading {
  margin-top: 24px;
}

.guru-indicators-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.guru-indicators-page__grid + .guru-indicators-page__subheading {
  margin-top: 24px;
}

.guru-indicators-page__table {
  width: 100%;
  border-collapse: collapse;
}

.guru-indicators-page__table th {
  padding: 10px 12px;
  font-size: 16px;
  font-weight: 600;
  text-align: left;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

/* Stacked-card mobile fallback (see GuruIndicatorRow.vue's own comment for the per-row half of
   this) — same 600px breakpoint used app-wide. The table stops looking like a table at all here
   (no border-collapse grid to show), so the header row — which would otherwise float above the
   stack of cards with nothing to label — is hidden; each card's own data-label text carries the
   same meaning instead. */
@media (max-width: 600px) {
  /* Real bug fixed 2026-09-10 (reported live: "其他指標 表格 跑版了") — thead/tbody below were
     already switched out of table layout, but the <table> element itself was left as
     `display: table` (its own default), and stayed in the browser's table auto-layout
     algorithm regardless — which sizes a table's columns off its content's UNBREAKABLE width
     when that's wider than the table's own 100% width (width on a table under auto-layout is a
     floor, not a ceiling). One of GuruIndicatorRow.vue's own 資料來源 tags (nowrap by default,
     Element Plus's own el-tag style) is a long, unbroken Chinese phrase — this is exactly the
     kind of unbreakable content that widens a table past its own width regardless of what a
     child's display later says. Promoting the <table> itself to display: block fully exits it
     from table layout instead of leaving it half-applied, confirmed live (Playwright,
     getBoundingClientRect) — the row previously measured 504px wide inside a 375px viewport
     despite `width: 100%` and thead/tbody's own display overrides already being in place.
     GuruIndicatorRow.vue's own tag styling was hardened the same day for the general case
     (letting a single very long tag actually wrap instead of forcing width). */
  .guru-indicators-page__table {
    display: block;
  }

  .guru-indicators-page__table thead {
    display: none;
  }

  .guru-indicators-page__table tbody {
    display: block;
  }
}
</style>
