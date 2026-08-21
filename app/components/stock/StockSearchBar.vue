<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import type { Stock } from '~/composables/useStocks'

const { searchUniverse, addStock } = useStocks()

const keyword = ref('')

function fetchSuggestions(query: string, callback: (results: Stock[]) => void) {
  callback(searchUniverse(query))
}

function handleSelect(stock: Stock) {
  addStock(stock.code)
  keyword.value = ''
}
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
  </div>
</template>

<style scoped>
.stock-search-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 -2px 8px rgb(0 0 0 / 6%);
}

.stock-search-bar__input {
  width: 100%;
}

.stock-search-bar__option {
  display: flex;
  justify-content: space-between;
}

.stock-search-bar__option-code {
  color: var(--el-text-color-secondary);
}
</style>
