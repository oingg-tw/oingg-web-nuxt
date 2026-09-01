<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'
import type { DashboardCardDef } from '~/composables/dashboard/useDashboardCards'

defineProps<{
  cardDefs: DashboardCardDef[]
  categories: readonly string[]
}>()

const visibleCardIds = defineModel<string[]>('visibleCardIds', { required: true })
</script>

<template>
  <el-popover placement="bottom-end" width="200" trigger="click">
    <template #reference>
      <el-button :icon="Setting" circle title="自訂卡片" />
    </template>
    <div class="dashboard-card-picker">
      <p class="dashboard-card-picker__title">顯示卡片</p>
      <el-checkbox-group v-model="visibleCardIds">
        <div v-for="category in categories" :key="category" class="dashboard-card-picker__group">
          <p class="dashboard-card-picker__group-title">{{ category }}</p>
          <el-checkbox
            v-for="card in cardDefs.filter(c => c.category === category)"
            :key="card.id"
            :value="card.id"
            :label="card.label"
          />
        </div>
      </el-checkbox-group>
    </div>
  </el-popover>
</template>

<style scoped>
.dashboard-card-picker__title {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.dashboard-card-picker__group + .dashboard-card-picker__group {
  margin-top: 12px;
}

.dashboard-card-picker__group-title {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dashboard-card-picker :deep(.el-checkbox-group) {
  display: flex;
  flex-direction: column;
}

.dashboard-card-picker :deep(.el-checkbox) {
  height: 26px;
}
</style>
