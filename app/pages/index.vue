<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'

const { keyword, fetchSuggestions, handleSelect, handleEnter } = useStockSearch()
</script>

<template>
  <div class="home-page">
    <el-autocomplete
      v-model="keyword"
      class="home-page__search"
      size="large"
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
        <div class="home-page__option">
          <span class="home-page__option-name">{{ item.name }}</span>
          <span class="home-page__option-code">{{ item.code }}</span>
        </div>
      </template>
    </el-autocomplete>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.home-page__search {
  width: 100%;
  max-width: 480px;
}

.home-page__option {
  display: flex;
  justify-content: space-between;
}

.home-page__option-code {
  color: var(--el-text-color-secondary);
}
</style>
