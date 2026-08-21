<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import type { FilterCategory } from '~/composables/useFilterSchema'
import type { FilterCriterion } from '~/composables/useFilterSearch'

const props = defineProps<{
  categories: FilterCategory[]
  loading?: boolean
}>()

const emit = defineEmits<{
  search: [criteria: FilterCriterion[]]
}>()

interface CriterionState {
  enabled: boolean
  min: number | null
  max: number | null
}

function fieldId(metricKey: string, fieldKey: string) {
  return `${metricKey}.${fieldKey}`
}

const state = reactive<Record<string, CriterionState>>({})

watch(
  () => props.categories,
  categories => {
    for (const category of categories) {
      for (const metric of category.metrics) {
        for (const field of metric.fields) {
          const id = fieldId(metric.key, field.key)
          if (!state[id]) state[id] = { enabled: false, min: null, max: null }
        }
      }
    }
  },
  { immediate: true }
)

const activeCategories = ref<string[]>(props.categories.map(c => c.key))

function handleSearch() {
  const criteria: FilterCriterion[] = []
  for (const category of props.categories) {
    for (const metric of category.metrics) {
      for (const field of metric.fields) {
        const id = fieldId(metric.key, field.key)
        const criterion = state[id]
        if (criterion?.enabled) {
          criteria.push({ field: id, min: criterion.min, max: criterion.max })
        }
      }
    }
  }
  emit('search', criteria)
}
</script>

<template>
  <el-card class="filter-panel" shadow="never">
    <el-collapse v-model="activeCategories">
      <el-collapse-item v-for="category in categories" :key="category.key" :title="category.name" :name="category.key">
        <div v-for="metric in category.metrics" :key="metric.key" class="filter-panel__metric">
          <p class="filter-panel__metric-name">{{ metric.name }}</p>
          <div v-for="field in metric.fields" :key="field.key" class="filter-panel__field">
            <el-checkbox v-model="state[fieldId(metric.key, field.key)]!.enabled">
              {{ field.name }}
              <span class="filter-panel__period">（{{ field.period }}）</span>
            </el-checkbox>
            <div v-if="state[fieldId(metric.key, field.key)]!.enabled" class="filter-panel__range">
              <el-input-number
                v-model="state[fieldId(metric.key, field.key)]!.min"
                placeholder="最小值"
                :controls="false"
                size="small"
              />
              <span class="filter-panel__range-sep">–</span>
              <el-input-number
                v-model="state[fieldId(metric.key, field.key)]!.max"
                placeholder="最大值"
                :controls="false"
                size="small"
              />
            </div>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>

    <div class="filter-panel__actions">
      <el-button type="primary" :icon="Search" :loading="loading" @click="handleSearch">搜尋</el-button>
    </div>
  </el-card>
</template>

<style scoped>
.filter-panel {
  border-radius: 12px;
}

.filter-panel__metric + .filter-panel__metric {
  margin-top: 16px;
}

.filter-panel__metric-name {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.filter-panel__field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}

.filter-panel__period {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.filter-panel__range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-panel__range :deep(.el-input-number) {
  width: 110px;
}

.filter-panel__range-sep {
  color: var(--el-text-color-secondary);
}

.filter-panel__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
