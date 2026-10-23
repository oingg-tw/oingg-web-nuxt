<script setup lang="ts">
// 「勾選要哪幾欄」的清單（2026-10-19 從下載按鈕抽出來給分享連結用；下載按鈕 2026-10-23 刪了）。一般欄在上；敏感的欄（sensitive：會透露
// 部位大小的股數與金額、只有自己看得到的備註）放在下半部、自成一段（2026-10-18「部位大小相關欄位放在彈窗的下半部」），預設不勾
// 由呼叫端決定（打開時把不敏感的欄放進 v-model）。同一個 checkbox-group，勾選狀態是同一份。
const props = defineProps<{
  columns: { key: string; label: string; sensitive?: boolean }[]
  // 整組的可及名稱，例如「要分享的內容」
  label: string
  // 下半部的小標，例如「部位大小，預設不分享」
  sensitiveHeading: string
}>()
const chosen = defineModel<string[]>({ required: true })
const regularColumns = computed(() => props.columns.filter(column => !column.sensitive))
const sensitiveColumns = computed(() => props.columns.filter(column => column.sensitive))
</script>

<template>
  <el-checkbox-group v-model="chosen" :aria-label="label">
    <div class="column-checklist">
      <el-checkbox v-for="column in regularColumns" :key="column.key" :value="column.key">{{ column.label }}</el-checkbox>
    </div>
    <template v-if="sensitiveColumns.length">
      <p class="column-checklist__heading">{{ sensitiveHeading }}</p>
      <div class="column-checklist">
        <el-checkbox v-for="column in sensitiveColumns" :key="column.key" :value="column.key">{{ column.label }}</el-checkbox>
      </div>
    </template>
  </el-checkbox-group>
</template>

<style scoped>
.column-checklist {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: 4px 16px;
}

/* 勾選框整列 44px 高：年長讀者的觸控下限 */
.column-checklist :deep(.el-checkbox) {
  min-height: 44px;
  margin-right: 0;
}

/* 下半部那一段的小標：上方一條分隔線，跟上半部分開 */
.column-checklist__heading {
  margin: 12px 0 4px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-secondary);
  /* el-checkbox-group 自己是 font-size: 0（排勾選框用），小標要設回來，不然字是 0 */
  font-size: 1rem;
  line-height: 1.5;
}
</style>
