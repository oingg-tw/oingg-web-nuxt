<script setup lang="ts">
import { Edit } from '@element-plus/icons-vue'
import type { ColumnPresetTemplate } from '~/composables/screener/useScreenerColumnPresets'
defineProps<{
  templates: ColumnPresetTemplate[]
  templatesLoading: boolean
}>()
const visible = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  custom: []
  template: [key: string]
}>()

// 同「新增篩選」的格子（2026-11-09，使用者：「電腦版的新增，現在有篩選的新增 與欄位的新增兩個版本。請統一採用篩選的那個模板，也就是icon在上，
// 文字在下的grid排版」）：原本先在「官方精選欄位組合／自訂欄位」兩張大卡裡選，再看範本清單；現在一格一個官方範本，按了就建立，空白開始放最後。
// 範本沒有分類（GET /screener/column-preset-templates 只有 key/name/description/fields），所以沒有第二頁；說明在格子的 title
function chooseCustom() {
  emit('custom')
  visible.value = false
}

function chooseTemplate(template: ColumnPresetTemplate) {
  emit('template', template.key)
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="新增欄位組合"
    class="condition-panel condition-panel--narrow"
    modal-class="condition-panel-overlay"
    append-to-body
  >
    <div class="app-tile-grid">
      <button
        v-for="template in templates"
        :key="template.key"
        type="button"
        class="app-card app-tile"
        :title="template.description"
        @click="chooseTemplate(template)"
      >
        <el-icon class="app-tile__icon"><component :is="columnPresetTemplateIcon(template)" /></el-icon>
        <span class="app-tile__label">{{ template.name }}</span>
        <span class="app-tile__count">{{ template.fieldKeys.length }}<span class="visually-hidden"> 個欄位</span></span>
      </button>
      <button type="button" class="app-card app-tile" @click="chooseCustom">
        <el-icon class="app-tile__icon"><Edit /></el-icon>
        <span class="app-tile__label">空白開始</span>
      </button>
      <div v-if="templatesLoading" class="app-tile-grid__status">載入中…</div>
    </div>
  </el-dialog>
</template>
