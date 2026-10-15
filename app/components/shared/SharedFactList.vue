<script setup lang="ts">
// 個別頁的「基本資料」（2026-10-15，ETF 與特別股個別頁）：一串「名稱：值」用定義清單，不用表格——它們不是同一種東西的多筆紀錄，
// 沒有欄可以比；也不是一格一張的卡片（使用者：卡片一張一個指標＝畫面髒亂）。窄的時候一欄、寬的時候兩欄。
export interface FactItem {
  label: string
  value: string
  // 值後面的一句補充（例如「成立 23 年」「規模低於法定下市門檻」）
  note?: string
  // 需要留意的（規模低於法定下市門檻）：用文字說清楚，顏色只是加強
  warning?: boolean
}

defineProps<{
  items: FactItem[]
  label: string
}>()
</script>

<template>
  <dl class="fact-list" :aria-label="label">
    <div v-for="item in items" :key="item.label" class="fact-list__item">
      <dt class="fact-list__label">{{ item.label }}</dt>
      <dd class="fact-list__value" :class="{ 'fact-list__value--warning': item.warning }">
        {{ item.value }}
        <span v-if="item.note" class="fact-list__note">{{ item.note }}</span>
      </dd>
    </div>
  </dl>
</template>

<style scoped>
.fact-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0 32px;
  margin: 0;
}

@media (min-width: 768px) {
  .fact-list {
    grid-template-columns: 1fr 1fr;
  }
}

.fact-list__item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.fact-list__label {
  flex: 0 0 7em;
  color: var(--el-text-color-secondary);
}

.fact-list__value {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.fact-list__value--warning {
  color: var(--el-color-danger);
  font-weight: 600;
}

.fact-list__note {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-weight: 400;
}
</style>
