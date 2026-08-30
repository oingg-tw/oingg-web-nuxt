<script setup lang="ts">
import { Coin, Folder, Lock, Money, PieChart, Refresh, Search, TrendCharts, Trophy } from '@element-plus/icons-vue'
import type { Component } from 'vue'
import { formatFieldLabel, periodSortRank, type FilterCategory, type FilterMetric } from '~/composables/useFilterSchema'

const props = defineProps<{
  modelValue: boolean
  categories: FilterCategory[]
  // The field already on the slot being edited, if any — lets the dialog jump straight to
  // that field's own 大/中/小 location on open instead of always resetting to the first
  // category. Null for a fresh empty slot or the column picker, neither of which has a
  // "current" field to jump to.
  currentFieldId?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [fieldId: string, fieldLabel: string]
}>()

interface IndicatorEntry {
  fieldId: string
  // Already has its period folded in (e.g. "ROE（股東權益報酬率）（近四季）") via
  // formatFieldLabel — no separate meta line needed underneath it any more.
  fieldLabel: string
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

// Every time the dialog opens, jump straight to wherever currentFieldId actually lives in
// the 大/中/小 hierarchy — a fresh empty slot or the column picker (currentFieldId null)
// just falls through to the first category/metric, same as before. Clearing the search box
// here matters too: a leftover query from last time would otherwise show the flat
// search-filtered list regardless of the category/metric this just selected.
watch(
  () => props.modelValue,
  async visible => {
    if (!visible) return
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
function fieldsOf(metric: FilterMetric): IndicatorEntry[] {
  return [...metric.fields]
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant') || periodSortRank(a.period) - periodSortRank(b.period))
    .map(field => ({
      fieldId: `${metric.key}.${field.key}`,
      fieldLabel: formatFieldLabel(field)
    }))
}

function allFieldsOf(category: FilterCategory): IndicatorEntry[] {
  return category.metrics.flatMap(fieldsOf)
}

const displayedIndicators = computed<IndicatorEntry[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (query) {
    return props.categories.flatMap(allFieldsOf).filter(entry => entry.fieldLabel.toLowerCase().includes(query))
  }
  return activeMetric.value ? fieldsOf(activeMetric.value) : []
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
    console.warn(`[filters] no icon mapped for category "${category.name}" (key: ${category.key}) — add one in OrganismIndicatorPicker.vue`)
  }
  return Folder
}

function selectCategory(key: string) {
  activeCategoryKey.value = key
  searchQuery.value = ''
}

function selectMetric(key: string) {
  activeMetricKey.value = key
  searchQuery.value = ''
}

function selectIndicator(entry: IndicatorEntry) {
  emit('select', entry.fieldId, entry.fieldLabel)
  emit('update:modelValue', false)
}
</script>

<template>
  <!-- Fullscreen rather than a content-sized floating box: the dialog's own outer frame
       is then always exactly the viewport, so nothing about it (search results narrowing
       the field list, switching category/metric, an empty-state showing up) can ever
       change ITS size and cause a jump — only the fixed-height columns inside it scroll. -->
  <el-dialog
    :model-value="modelValue"
    title="請選擇篩選項目"
    fullscreen
    lock-scroll
    class="indicator-dialog-modal"
    @update:model-value="emit('update:modelValue', $event)"
  >
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
            v-for="metric in activeMetrics"
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
            :class="{ 'is-active': !searchQuery && entry.fieldId === currentFieldId }"
            :title="entry.fieldLabel"
            @click="selectIndicator(entry)"
          >
            {{ entry.fieldLabel }}
          </div>
          <el-empty v-if="!displayedIndicators.length" description="沒有符合的指標" :image-size="60" />
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
/* Capped and centered so the fullscreen dialog's own three-column list doesn't stretch
   into uncomfortably wide, hard-to-scan columns on a wide desktop screen — same reasoning
   as AppFeatureMenu's fullscreen nav grid. */
.indicator-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 720px;
  margin: 0 auto;
}

.indicator-dialog__search {
  flex-shrink: 0;
}

.indicator-dialog__body {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.indicator-dialog__categories,
.indicator-dialog__metrics {
  flex: 0 0 27%;
  /* 3.5 × the 44px row height below — enough of a 4th row peeks in at the bottom to read
     as "cut off, scroll me" rather than "that's everything." */
  height: 154px;
  overflow-y: auto;
  /* Without this, a touch-scroll that runs past this list's own top/bottom edge "chains"
     into scrolling the page behind the dialog — the background moves even though
     `lock-scroll` on the dialog itself is on, since that only blocks the page's OWN
     scroll, not momentum handed off from a child list hitting its scroll limit. */
  overscroll-behavior: contain;
  border-right: 1px solid var(--el-border-color-lighter);
  padding-right: 8px;
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

/* Metrics and fields stay plain single-line text — only categories (大分類) get an icon,
   per the request that scoped it to that tier alone. */
.indicator-dialog__metric,
.indicator-dialog__item {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  /* 3.5 × the shared 44px row height above. */
  height: 154px;
  overflow-y: auto;
  /* See the matching comment on .indicator-dialog__categories — stops this list's own
     scroll from chaining into the page behind the dialog once it hits its end. */
  overscroll-behavior: contain;
}

/* Mobile: three-tier vertical stack instead of three side-by-side columns — category list,
   then its metrics, then that metric's fields. Each keeps its own 3.5-row height from
   above; only the layout direction and dividers (bottom instead of right) change. */
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

<style>
/* Unscoped (:deep() can't reach el-dialog's own root, which renders outside this
   component's DOM subtree via teleport) — matches AppFeatureMenu's fullscreen dialog,
   which pads its body the same way for the same reason (the safe-area inset only matters
   once content can reach the very bottom edge, which fullscreen does and a floating
   centered dialog never did). */
.indicator-dialog-modal .el-dialog__body {
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
</style>
