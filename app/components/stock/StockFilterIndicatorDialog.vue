<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import type { FilterCategory } from '~/composables/useFilterSchema'

const props = defineProps<{
  modelValue: boolean
  categories: FilterCategory[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [fieldId: string, fieldLabel: string]
}>()

interface IndicatorEntry {
  fieldId: string
  fieldLabel: string
  metricName: string
  period: string
}

const searchQuery = ref('')
const activeCategoryKey = ref<string | undefined>(props.categories[0]?.key)

watch(
  () => props.categories,
  categories => {
    if (!categories.some(category => category.key === activeCategoryKey.value)) {
      activeCategoryKey.value = categories[0]?.key
    }
  },
  { immediate: true }
)

function entriesOf(category: FilterCategory): IndicatorEntry[] {
  return category.metrics.flatMap(metric =>
    metric.fields.map(field => ({
      fieldId: `${metric.key}.${field.key}`,
      fieldLabel: field.name,
      metricName: metric.name,
      period: field.period
    }))
  )
}

const displayedIndicators = computed<IndicatorEntry[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (query) {
    return props.categories.flatMap(entriesOf).filter(entry => entry.fieldLabel.toLowerCase().includes(query))
  }
  const activeCategory = props.categories.find(category => category.key === activeCategoryKey.value)
  return activeCategory ? entriesOf(activeCategory) : []
})

function selectCategory(key: string) {
  activeCategoryKey.value = key
  searchQuery.value = ''
}

function selectIndicator(entry: IndicatorEntry) {
  emit('select', entry.fieldId, entry.fieldLabel)
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="請選擇篩選項目"
    width="90%"
    style="max-width: 560px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="indicator-dialog">
      <el-input v-model="searchQuery" placeholder="搜尋指標名稱" clearable class="indicator-dialog__search">
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <!-- Desktop: side-by-side category/item panes sharing one fixed-height box.
           Mobile (see the media query below): stacked top-to-bottom instead — category
           list, then its items once one's picked — each capped to about three rows tall
           with its own scroll rather than the desktop panes' shared fixed-height box. -->
      <div class="indicator-dialog__body">
        <div class="indicator-dialog__categories">
          <div
            v-for="category in categories"
            :key="category.key"
            class="indicator-dialog__category"
            :class="{ 'is-active': !searchQuery && activeCategoryKey === category.key }"
            @click="selectCategory(category.key)"
          >
            {{ category.name }}
          </div>
        </div>

        <div class="indicator-dialog__items">
          <div
            v-for="entry in displayedIndicators"
            :key="entry.fieldId"
            class="indicator-dialog__item"
            @click="selectIndicator(entry)"
          >
            <span class="indicator-dialog__item-name">{{ entry.fieldLabel }}</span>
            <span class="indicator-dialog__item-meta">{{ entry.metricName }} · {{ entry.period }}</span>
          </div>
          <el-empty v-if="!displayedIndicators.length" description="沒有符合的指標" :image-size="60" />
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.indicator-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.indicator-dialog__search {
  flex-shrink: 0;
}

.indicator-dialog__body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 8px;
  height: 60vh;
  max-height: 420px;
}

.indicator-dialog__categories {
  flex: 0 0 38%;
  overflow-y: auto;
  border-right: 1px solid var(--el-border-color-lighter);
  padding-right: 8px;
}

.indicator-dialog__category {
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.indicator-dialog__category:hover {
  background: var(--el-fill-color-light);
}

.indicator-dialog__category.is-active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.indicator-dialog__items {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

.indicator-dialog__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
}

.indicator-dialog__item:hover {
  background: var(--el-fill-color-light);
}

.indicator-dialog__item-name {
  font-size: 16px;
  color: var(--el-color-primary);
}

.indicator-dialog__item-meta {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

/* Mobile: two-tier vertical stack instead of the two-pane layout — category list, then
   its items once one's picked. Each list gets its own ~3-row cap and scroll instead of
   the desktop panes' shared fixed-height box, since there's no room to show two side by side. */
@media (max-width: 767px) {
  .indicator-dialog__body {
    flex-direction: column;
    height: auto;
    max-height: none;
  }

  .indicator-dialog__categories {
    flex: none;
    max-height: 132px;
    border-right: none;
    border-bottom: 1px solid var(--el-border-color-lighter);
    padding-right: 0;
    padding-bottom: 8px;
  }

  .indicator-dialog__items {
    flex: none;
    max-height: 210px;
  }
}
</style>
