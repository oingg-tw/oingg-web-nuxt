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
// card's header at narrow widths. Both options show real, differentiated content now (see
// [code].vue's `experienceMode === 'ACCOUNTING'` branch) — no "開發中" placeholder needed.
const { mode: experienceMode } = useStockExperienceMode()

// Real bug fixed 2026-09-10 (reported live: "這裡選項多到不能單純用下拉了，要改成彈窗") — this
// used to be a fixed 280px-wide el-popover, sized fine back when 顯示卡片 only had a handful of
// cards. After today's build-out (30+ cards across 8 categories, see useStockCards.ts's own
// STOCK_CARD_DEFS) the same content in that same small anchored popover was cramped and required
// its own internal scroll inside an already-small box. Promoted to a real el-dialog instead —
// same gear-icon trigger, just opens a properly-sized modal with room to breathe, matching how
// this app already escalates other overflowing pickers from popover to dialog once their content
// outgrows a small anchored box.
const settingsVisible = ref(false)
</script>

<template>
  <el-button :icon="Setting" circle title="顯示設定" @click="settingsVisible = true" />

  <el-dialog v-model="settingsVisible" title="顯示設定" width="min(480px, 92vw)" align-center>
    <div class="stock-detail-actions__picker">
      <p class="stock-detail-actions__picker-title">顯示模式</p>
      <el-radio-group v-model="experienceMode" size="small" class="stock-detail-actions__mode">
        <el-radio-button value="CARD">卡片</el-radio-button>
        <el-radio-button value="ACCOUNTING">會計</el-radio-button>
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
  </el-dialog>
</template>

<style scoped>
/* Content now genuinely tall (30+ checkboxes across 8 categories) now that this is a real
   dialog instead of a small anchored popover — caps its own height and scrolls internally
   rather than letting the dialog grow taller than the viewport. */
.stock-detail-actions__picker {
  max-height: 60vh;
  overflow-y: auto;
}

.stock-detail-actions__picker-title {
  margin: 0 0 8px;
  font-size: 16px;
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
  font-size: 16px;
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
