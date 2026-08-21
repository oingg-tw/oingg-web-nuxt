<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'

const { keyword, fetchSuggestions, handleSelect, handleEnter } = useStockSearch()
</script>

<template>
  <div class="stock-search-bar">
    <el-autocomplete
      v-model="keyword"
      class="stock-search-bar__input"
      :fetch-suggestions="fetchSuggestions"
      placeholder="搜尋股票代號或名稱，例如 2330 或 台積電"
      clearable
      @select="handleSelect"
      @keyup.enter="handleEnter"
    >
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
      <template #default="{ item }">
        <div class="stock-search-bar__option">
          <span class="stock-search-bar__option-name">{{ item.name }}</span>
          <span class="stock-search-bar__option-code">{{ item.code }}</span>
        </div>
      </template>
    </el-autocomplete>
    <div class="stock-search-bar__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.stock-search-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 2px 8px rgb(0 0 0 / 40%);
}

.stock-search-bar__input {
  flex: 1;
  min-width: 0;
}

.stock-search-bar__actions {
  display: none;
  align-items: center;
  gap: 8px;
}

@media (min-width: 768px) {
  .stock-search-bar__actions {
    display: flex;
  }
}

.stock-search-bar__option {
  display: flex;
  justify-content: space-between;
}

.stock-search-bar__option-code {
  color: var(--el-text-color-secondary);
}
</style>
