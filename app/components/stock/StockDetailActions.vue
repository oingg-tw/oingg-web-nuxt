<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'
import type { StockCardDef } from '~/composables/stock/useStockCards'

defineProps<{
  cardDefs: StockCardDef[]
  categories: readonly string[]
}>()

const visibleCardIds = defineModel<string[]>('visibleCardIds', { required: true })

// Tucked in here (behind the same gear icon), not its own always-visible control row — per
// direct request ("把模式選擇 塞進顯示卡片中") after the inline radio-group crowded the summary
// card's header at narrow widths. Shell only, same as every mode here so far: novice/
// accounting both just show the "開發中" toast, no differentiated content yet.
const { mode: experienceMode } = useStockExperienceMode()
function handleExperienceModeChange() {
  if (experienceMode.value === 'novice') {
    ElMessage.info('簡易模式功能開發中，敬請期待——目前顯示內容與專家模式相同')
  } else if (experienceMode.value === 'accounting') {
    ElMessage.info('會計模式功能開發中，敬請期待——目前顯示內容與專家模式相同')
  }
}
</script>

<template>
  <el-popover placement="bottom-end" width="280" trigger="click">
    <template #reference>
      <el-button :icon="Setting" circle title="顯示設定" />
    </template>
    <div class="stock-detail-actions__picker">
      <p class="stock-detail-actions__picker-title">顯示模式</p>
      <el-radio-group v-model="experienceMode" size="small" class="stock-detail-actions__mode" @change="handleExperienceModeChange">
        <el-radio-button value="novice">簡易模式</el-radio-button>
        <el-radio-button value="pro">專家模式</el-radio-button>
        <el-radio-button value="accounting">會計模式</el-radio-button>
      </el-radio-group>

      <el-divider class="stock-detail-actions__divider" />

      <p class="stock-detail-actions__picker-title">顯示卡片</p>
      <el-checkbox-group v-model="visibleCardIds">
        <div v-for="category in categories" :key="category" class="stock-detail-actions__group">
          <p class="stock-detail-actions__group-title">{{ category }}</p>
          <el-checkbox
            v-for="card in cardDefs.filter(c => c.category === category)"
            :key="card.id"
            :value="card.id"
            :label="card.required ? `${card.label}（必要）` : card.label"
            :disabled="card.required"
          />
        </div>
      </el-checkbox-group>
    </div>
  </el-popover>
</template>

<style scoped>
.stock-detail-actions__picker-title {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stock-detail-actions__mode {
  display: flex;
  flex-wrap: wrap;
}

.stock-detail-actions__divider {
  margin: 12px 0;
}

.stock-detail-actions__group + .stock-detail-actions__group {
  margin-top: 12px;
}

.stock-detail-actions__group-title {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stock-detail-actions__picker :deep(.el-checkbox-group) {
  display: flex;
  flex-direction: column;
}

.stock-detail-actions__picker :deep(.el-checkbox) {
  height: 26px;
}
</style>
