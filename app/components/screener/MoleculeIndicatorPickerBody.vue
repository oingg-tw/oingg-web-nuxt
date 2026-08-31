<script setup lang="ts">
import { Coin, Folder, InfoFilled, Lock, Money, PieChart, Refresh, Search, TrendCharts, Trophy } from '@element-plus/icons-vue'
import type { Component } from 'vue'
import { formatFieldLabel, periodSortRank, type FilterCategory, type FilterField, type FilterMetric } from '~/composables/useFilterSchema'

// The 大/中/小 (category/metric/field) navigation itself — pulled out of
// OrganismIndicatorPicker so that component can mount this identical body inside either a
// fullscreen dialog (mobile) or an anchored popover (desktop) without duplicating the whole
// three-column UI and its state in two places.
const props = defineProps<{
  categories: FilterCategory[]
  // The field already on the slot being edited, if any — lets this jump straight to that
  // field's own 大/中/小 location once opened, instead of always resetting to the first
  // category. Null for a fresh empty slot or the column picker, neither of which has a
  // "current" field to jump to.
  currentFieldId?: string | null
  // Toggled by the parent (dialog/popover open state) — resets the search box and
  // re-positions to currentFieldId's own category/metric every time this flips true.
  active: boolean
  // Condition-picking (true) collapses period variants of the same metric into one row —
  // picking a condition's field is now just "which metric", period is a refinement made
  // afterward in the range editor (see periodSiblingsOf in useFilterSchema.ts). Column-
  // picking (false) has no range editor to move period into, so it keeps showing every
  // period variant as its own row, same as before this redesign.
  hidePeriod: boolean
}>()

const emit = defineEmits<{
  select: [fieldId: string, fieldLabel: string]
}>()

interface IndicatorEntry {
  // The field actually assigned on click — in hidePeriod mode, whichever period-variant
  // ranks best (see periodSortRank), since the row itself no longer says which one.
  fieldId: string
  fieldLabel: string
  // Every period-variant fieldId this row stands in for — just [fieldId] outside hidePeriod
  // mode. Used only to decide the row's own active-highlight state (see the template below),
  // so a condition already set to a non-default period (chosen later in the range editor)
  // still highlights the right row instead of none at all.
  fieldIds: string[]
  // From whichever field the row's own fieldId points at — a cryptic name (Altman Z-Score's
  // "X1") is exactly the case this exists for. Its presence alone decides whether the row
  // shows an ⓘ affordance at all (see the template), no separate flag needed.
  description?: string
}

const searchQuery = ref('')
const activeCategoryKey = ref<string | undefined>(props.categories[0]?.key)
const activeMetricKey = ref<string | undefined>(props.categories[0]?.metrics[0]?.key)

const activeCategory = computed(() => props.categories.find(category => category.key === activeCategoryKey.value))
const activeMetrics = computed(() => activeCategory.value?.metrics ?? [])
const activeMetric = computed(() => activeMetrics.value.find(metric => metric.key === activeMetricKey.value))

watch(
  () => props.categories,
  categories => {
    if (!categories.some(category => category.key === activeCategoryKey.value)) {
      activeCategoryKey.value = categories[0]?.key
    }
  },
  { immediate: true }
)

// Metrics (中分類) are scoped to whichever category (大分類) is active — re-picks the first
// one whenever that category changes (including the reset above) so the middle column
// never sits pointed at a metric that belongs to some other category.
watch(
  activeMetrics,
  metrics => {
    if (!metrics.some(metric => metric.key === activeMetricKey.value)) {
      activeMetricKey.value = metrics[0]?.key
    }
  },
  { immediate: true }
)

// fieldId is "<metricKey>.<fieldKey>" — walk the tree rather than splitting the string, so
// a field key that happened to contain its own "." can't be misread.
function locateField(fieldId: string): { categoryKey: string; metricKey: string } | null {
  for (const category of props.categories) {
    for (const metric of category.metrics) {
      if (metric.fields.some(field => `${metric.key}.${field.key}` === fieldId)) {
        return { categoryKey: category.key, metricKey: metric.key }
      }
    }
  }
  return null
}

// Every time this opens, jump straight to wherever currentFieldId actually lives in the
// 大/中/小 hierarchy — a fresh empty slot or the column picker (currentFieldId null) just
// falls through to the first category/metric, same as before. Clearing the search box here
// matters too: a leftover query from last time would otherwise show the flat search-filtered
// list regardless of the category/metric this just selected.
//
// Also watches currentFieldId itself, not just active — clicking a different condition
// pill's field button while this is already open (never closes in between, e.g. the desktop
// popover re-anchoring straight to the new trigger) sets pickerVisible to `true` again, which
// is a no-op for Vue's reactivity since it was already `true`; only currentFieldId actually
// changes in that case. Watching active alone left the dialog positioned wherever it was last
// browsed to instead of jumping to the newly-targeted slot's real field (reported: clicking
// 營業利益率 opened the dialog still sitting on 資產負債率 from a previous pill).
watch(
  [() => props.active, () => props.currentFieldId],
  async ([active]) => {
    if (!active) return
    searchQuery.value = ''
    const location = props.currentFieldId ? locateField(props.currentFieldId) : null
    activeCategoryKey.value = location?.categoryKey ?? props.categories[0]?.key
    activeMetricKey.value = location?.metricKey ?? props.categories[0]?.metrics[0]?.key

    // "Positioned to" means visible, not just marked active-and-possibly-off-screen below
    // the 3.5-row fold each column is capped to (see the height comments further down) —
    // scroll the matched row into view in each of the three columns once the picked field's
    // metric has actually rendered its own field list.
    await nextTick()
    for (const selector of ['.indicator-dialog__category.is-active', '.indicator-dialog__metric.is-active', '.indicator-dialog__item.is-active']) {
      document.querySelector(selector)?.scrollIntoView({ block: 'nearest' })
    }
  },
  { immediate: true }
)

// Sorted by name first — a metric can bundle genuinely different fields (e.g. Altman
// Z-Score's Z 分數/X1/X2/X3/X4/X5, each with its own unrelated period), and sorting those
// by period alone scrambles them since period carries no meaningful order across different
// names. periodSortRank only breaks ties between fields that share a name — the case that
// actually is just period variants of the same field (EPS TTM/單季/單季年化) — so TTM still
// sorts first there.
function sortedFieldsOf(metric: FilterMetric) {
  return [...metric.fields].sort(
    (a, b) => a.name.localeCompare(b.name, 'zh-Hant') || periodSortRank(a.period) - periodSortRank(b.period)
  )
}

// One row per field, full "name（period）" label — column-picking mode (hidePeriod false),
// unchanged from before this redesign since there's no range editor downstream to move
// period into for a column.
function expandFields(fields: FilterField[], metricKey: string): IndicatorEntry[] {
  return fields.map(field => ({
    fieldId: `${metricKey}.${field.key}`,
    fieldLabel: formatFieldLabel(field),
    fieldIds: [`${metricKey}.${field.key}`],
    description: field.description
  }))
}

// One row per distinct NAME, collapsing every period variant into it — condition-picking
// mode (hidePeriod true). The row's own fieldId is whichever period ranks best
// (periodSortRank), so clicking it assigns a sensible default; the range editor is where
// that gets refined afterward (see periodSiblingsOf in useFilterSchema.ts).
function collapseByName(fields: FilterField[], metricKey: string): IndicatorEntry[] {
  const byName = new Map<string, FilterField[]>()
  for (const field of fields) {
    const variants = byName.get(field.name) ?? []
    variants.push(field)
    byName.set(field.name, variants)
  }
  return [...byName.entries()].map(([name, variants]) => {
    const best = [...variants].sort((a, b) => periodSortRank(a.period) - periodSortRank(b.period))[0]!
    return {
      fieldId: `${metricKey}.${best.key}`,
      fieldLabel: name,
      fieldIds: variants.map(field => `${metricKey}.${field.key}`),
      // The best-ranked period's own description — every period variant of one concept
      // describes the same underlying thing, so this doesn't need to track which variant is
      // currently assigned the way fieldId does.
      description: best.description
    }
  })
}

function entriesOf(fields: FilterField[], metricKey: string): IndicatorEntry[] {
  return props.hidePeriod ? collapseByName(fields, metricKey) : expandFields(fields, metricKey)
}

function browseFieldsOf(metric: FilterMetric): IndicatorEntry[] {
  return entriesOf(sortedFieldsOf(metric), metric.key)
}

// A field counts as matching the query on its own name alone in hidePeriod mode (period
// isn't shown, so searching for one wouldn't make sense to support), or the full
// name+period label otherwise — matches whatever's actually on screen either way. Also
// matches against aliases (e.g. "股東權益報酬率" finding ROE) even though those are never
// shown — search should find a field by a name the user knows it by, without the row itself
// needing to display every alternate name.
function fieldMatchesQuery(field: FilterField, query: string): boolean {
  const label = props.hidePeriod ? field.name : formatFieldLabel(field)
  return label.toLowerCase().includes(query) || (field.aliases?.some(alias => alias.toLowerCase().includes(query)) ?? false)
}

// Whether a metric (中分類) counts as matching the current search — its own name, or any
// field underneath it, so a metric like "杜邦分析" whose own fields (ROE/淨利率/週轉率...)
// don't individually contain the query still surfaces when the query matches the metric's
// name itself.
function metricMatchesQuery(metric: FilterMetric, query: string): boolean {
  return metric.name.toLowerCase().includes(query) || metric.fields.some(field => fieldMatchesQuery(field, query))
}

// Metrics (中分類), flattened across every category — mirrors how the field list below
// already flattens while searching, so a match under a category other than whichever one
// happens to be active still surfaces instead of being silently hidden.
const displayedMetrics = computed<FilterMetric[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return activeMetrics.value
  return props.categories.flatMap(category => category.metrics).filter(metric => metricMatchesQuery(metric, query))
})

const displayedIndicators = computed<IndicatorEntry[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (query) {
    // A metric-name match (e.g. "杜" matching "杜邦分析") pulls in all of that metric's
    // fields, not just the ones whose own label happens to contain the query too — search
    // is meant to land you on the right metric, not just the right field.
    return props.categories.flatMap(category => category.metrics).flatMap(metric => {
      const metricNameMatches = metric.name.toLowerCase().includes(query)
      const matchingFields = metric.fields.filter(field => metricNameMatches || fieldMatchesQuery(field, query))
      return entriesOf(matchingFields, metric.key)
    })
  }
  return activeMetric.value ? browseFieldsOf(activeMetric.value) : []
})

// Categories don't carry their own icon from the API — this maps the real /filters
// category keys to one, matched by key first (covers every category the live backend
// actually returns) and falling back to keyword matching against the Chinese name so a
// category the backend renames or adds still lands on a reasonable icon instead of none at
// all. Anything that matches neither gets a generic default, logged in dev so it's easy to
// notice and give a proper icon later — same pattern as formatPeriodLabel above.
const CATEGORY_ICONS_BY_KEY: Record<string, Component> = {
  profitability: TrendCharts,
  cashFlow: Coin,
  solvency: Lock,
  turnover: Refresh,
  valuation: Money,
  guru: Trophy,
  portfolio: PieChart
}

const CATEGORY_ICON_KEYWORDS: { pattern: RegExp; icon: Component }[] = [
  { pattern: /獲利|資本配置/, icon: TrendCharts },
  { pattern: /現金流/, icon: Coin },
  { pattern: /財務結構|償債|破產/, icon: Lock },
  { pattern: /營運|週轉|資產效率/, icon: Refresh },
  { pattern: /估值|評價/, icon: Money },
  { pattern: /大師|量化/, icon: Trophy },
  { pattern: /投資組合|持股/, icon: PieChart }
]

function iconForCategory(category: FilterCategory): Component {
  const byKey = CATEGORY_ICONS_BY_KEY[category.key]
  if (byKey) return byKey
  const byKeyword = CATEGORY_ICON_KEYWORDS.find(({ pattern }) => pattern.test(category.name))
  if (byKeyword) return byKeyword.icon
  if (import.meta.dev) {
    console.warn(`[filters] no icon mapped for category "${category.name}" (key: ${category.key}) — add one in MoleculeIndicatorPickerBody.vue`)
  }
  return Folder
}

function selectCategory(key: string) {
  activeCategoryKey.value = key
  searchQuery.value = ''
}

function selectMetric(key: string) {
  // Search results now flatten metrics across every category (see displayedMetrics above),
  // so the metric just clicked may not belong to whichever category happens to still be
  // active — reposition to its real owning category too, or activeMetric below would look
  // it up under the wrong one and come back empty.
  const owningCategory = props.categories.find(category => category.metrics.some(metric => metric.key === key))
  if (owningCategory) activeCategoryKey.value = owningCategory.key
  activeMetricKey.value = key
  searchQuery.value = ''
}

function selectIndicator(entry: IndicatorEntry) {
  emit('select', entry.fieldId, entry.fieldLabel)
}
</script>

<template>
  <div class="indicator-dialog">
    <el-input v-model="searchQuery" placeholder="搜尋指標名稱" clearable class="indicator-dialog__search">
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
    </el-input>

    <!-- 大分類（category）→ 中分類（metric）→ 小分類（field）: three tiers, each its own
         scrollable list. Desktop lays them out side by side; the mobile media query below
         stacks them top to bottom instead. Every list is sized to exactly 3.5 rows tall
         (see the row-height comments below) so a row sitting half cut-off at the bottom
         does the job of hinting "scroll for more" on its own — no separate scrollbar or
         label needed to notice there's more underneath. -->
    <div class="indicator-dialog__body">
      <div class="indicator-dialog__categories">
        <div
          v-for="category in categories"
          :key="category.key"
          class="indicator-dialog__category"
          :class="{ 'is-active': !searchQuery && activeCategoryKey === category.key }"
          :title="category.name"
          @click="selectCategory(category.key)"
        >
          <el-icon class="indicator-dialog__category-icon"><component :is="iconForCategory(category)" /></el-icon>
          <span class="indicator-dialog__category-label">{{ category.name }}</span>
        </div>
      </div>

      <div class="indicator-dialog__metrics">
        <div
          v-for="metric in displayedMetrics"
          :key="metric.key"
          class="indicator-dialog__metric"
          :class="{ 'is-active': !searchQuery && activeMetricKey === metric.key }"
          :title="metric.name"
          @click="selectMetric(metric.key)"
        >
          {{ metric.name }}
        </div>
      </div>

      <div class="indicator-dialog__items">
        <div
          v-for="entry in displayedIndicators"
          :key="entry.fieldId"
          class="indicator-dialog__item"
          :class="{ 'is-active': !searchQuery && !!currentFieldId && entry.fieldIds.includes(currentFieldId) }"
          @click="selectIndicator(entry)"
        >
          <span class="indicator-dialog__item-label" :title="entry.fieldLabel">{{ entry.fieldLabel }}</span>
          <el-tooltip v-if="entry.description" :content="entry.description" placement="top" trigger="click" :popper-style="{ maxWidth: '260px' }">
            <el-icon class="indicator-dialog__item-info" @click.stop><InfoFilled /></el-icon>
          </el-tooltip>
        </div>
        <el-empty v-if="!displayedIndicators.length" description="沒有符合的指標" :image-size="60" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Capped and centered so a wide layout (the dialog's fullscreen frame on mobile, or the
   popover's own width on desktop) doesn't stretch this into uncomfortably wide, hard-to-scan
   columns — same reasoning as AppFeatureMenu's fullscreen nav grid. */
.indicator-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 720px;
  margin: 0 auto;
  --indicator-row-height: 44px;
  /* Mobile (fullscreen dialog) shows 3.5 rows — enough of a 4th peeks in at the bottom to
     hint "scroll for more" without eating too much of a small screen. Desktop (the popover,
     see the media query below) has room to spare, so it shows 5.5 instead. */
  --indicator-rows: 3.5;
}

@media (min-width: 768px) {
  .indicator-dialog {
    --indicator-rows: 5.5;
  }
}

.indicator-dialog__search {
  flex-shrink: 0;
}

/* Same reasoning as StockSearchBar's own override: Element Plus's 14px default is an
   accepted exception for dense table/form cells, not for a primary, always-reachable search
   input like this one (see docs/accessibility-guidelines.md §1.1). */
.indicator-dialog__search :deep(.el-input__inner) {
  font-size: 16px;
}

.indicator-dialog__body {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.indicator-dialog__categories,
.indicator-dialog__metrics {
  /* See --indicator-rows below — a fractional row peeks in at the bottom to read as "cut
     off, scroll me" rather than "that's everything." */
  height: calc(var(--indicator-row-height) * var(--indicator-rows));
  overflow-y: auto;
  /* Without this, a touch-scroll that runs past this list's own top/bottom edge "chains"
     into scrolling whatever's behind it (the page behind a fullscreen dialog, or the
     popover's own positioning) — this contains that momentum at this list's own edge. */
  overscroll-behavior: contain;
  border-right: 1px solid var(--el-border-color-lighter);
  padding-right: 8px;
}

/* Categories (大分類) keep their original share — it was already sized right for the
   consistently-short (4 Chinese character) category names. Metrics (中分類) routinely run
   much longer ("毛利率 營業利益率 稅後淨利率", "股東權益報酬率 ROE") and were cramped at the
   same width, so they get more room — taken from the flexible fields column (小分類, which
   is usually just a short term like "EPS" or "ROE" and doesn't need as much), not from
   categories. */
.indicator-dialog__categories {
  flex: 0 0 27%;
}

.indicator-dialog__metrics {
  flex: 0 0 38%;
}

/* All three tiers are single-line rows now that a field's period lives inside its own
   label (see formatFieldLabel) instead of a second caption line — one shared 44px row
   height across categories, metrics, and fields, so the "3.5 rows" scroll-hint math is
   the same everywhere instead of two different row heights to keep in sync. */
.indicator-dialog__category,
.indicator-dialog__metric,
.indicator-dialog__item {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

/* Metrics stay plain single-line text — only categories (大分類) get a leading icon, per the
   request that scoped it to that tier alone. Fields (小分類) can now also get a trailing ⓘ
   (see .indicator-dialog__item-info below), so truncation lives on the label span instead of
   the row itself — an icon sibling needs to stay fixed-width, not get squeezed by ellipsis
   truncation meant for the text alone. */
.indicator-dialog__metric {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.indicator-dialog__item {
  gap: 4px;
}

.indicator-dialog__item-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Only rendered when entry.description exists (see MoleculeIndicatorPickerBody's script) —
   its own presence is already the full "does this need explaining" signal, nothing else
   gates it. trigger="click" (not hover) so this works the same on the mobile fullscreen
   dialog as the desktop popover, where there's no hover at all. */
.indicator-dialog__item-info {
  flex-shrink: 0;
  font-size: 15px;
  color: var(--el-text-color-placeholder);
}

.indicator-dialog__item-info:hover {
  color: var(--el-color-primary);
}

.indicator-dialog__category {
  gap: 8px;
}

.indicator-dialog__category-icon {
  flex-shrink: 0;
  font-size: 18px;
  /* Always the accent color regardless of active state — matches AppPinnedSidebar's own
     icon+label rows, where only the label (below) shifts color/weight for the active item. */
  color: var(--el-color-primary);
}

.indicator-dialog__category-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.indicator-dialog__category:hover,
.indicator-dialog__metric:hover,
.indicator-dialog__item:hover {
  background: var(--el-fill-color-light);
}

.indicator-dialog__category.is-active,
.indicator-dialog__metric.is-active,
.indicator-dialog__item.is-active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.indicator-dialog__items {
  flex: 1;
  min-width: 0;
  height: calc(var(--indicator-row-height) * var(--indicator-rows));
  overflow-y: auto;
  /* See the matching comment on .indicator-dialog__categories — stops this list's own
     scroll from chaining into whatever's behind it once it hits its end. */
  overscroll-behavior: contain;
}

/* Mobile (this only ever mounts inside the fullscreen dialog at this width — the desktop
   popover branch never gets this narrow): three-tier vertical stack instead of three
   side-by-side columns — category list, then its metrics, then that metric's fields. Each
   keeps its own 3.5-row height from above; only the layout direction and dividers (bottom
   instead of right) change. */
@media (max-width: 767px) {
  .indicator-dialog__body {
    flex-direction: column;
  }

  .indicator-dialog__categories,
  .indicator-dialog__metrics {
    flex: none;
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--el-border-color-lighter);
    padding-right: 0;
    padding-bottom: 8px;
  }

  /* .indicator-dialog__items keeps the desktop rule's `flex: 1` otherwise — harmless in
     row mode (grows to fill the remaining WIDTH once the other two columns take their
     fixed 27% each), but in this column-stacked layout the main axis is now height, so
     that same `flex: 1` (flex-basis: 0%, flex-grow: 1) would win over the explicit
     `height: 154px` and let the list grow to fit however many fields are in the active
     metric instead of capping and scrolling — exactly the "跑版" a metric with more than
     ~3 fields produced before this override. `flex: none` here (matching the other two
     columns) makes the fixed height hold in both layouts. */
  .indicator-dialog__items {
    flex: none;
    width: 100%;
  }
}
</style>
