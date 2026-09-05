<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import { NO_MATCH_SENTINEL } from '~/composables/stock/useStockSearch'

// Reuses useStockSearch() wholesale (same composable StockSearchBar.vue's app-shell header
// uses) rather than re-implementing the code/name matching or navigation-on-select logic here
// — this component only owns its own visual shell, not the search behavior.
const { keyword, fetchSuggestions, handleSelect, handleEnter } = useStockSearch()
</script>

<template>
  <div class="landing-stock-search">
    <!-- ClientOnly + fallback: el-autocomplete's popper renders a different node shape
         server-side vs. on first client paint (Element Plus's own SSR quirk, not this app's
         markup) — see StockSearchBar.vue's own comment for the confirmed hydration-mismatch
         this avoids. Same fix here since it's the same underlying component. -->
    <ClientOnly>
      <el-autocomplete
        v-model="keyword"
        class="landing-stock-search__input"
        :fetch-suggestions="fetchSuggestions"
        popper-class="landing-stock-search__popper"
        placeholder="輸入股票代號或名稱，例如 2330 或 台積電"
        aria-label="輸入股票代號或名稱"
        clearable
        @select="handleSelect"
        @keyup.enter="handleEnter"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
        <template #default="{ item }">
          <p v-if="item.code === NO_MATCH_SENTINEL" class="landing-stock-search__no-match">{{ item.name }}</p>
          <div v-else class="landing-stock-search__option">
            <span class="landing-stock-search__option-name">{{ item.name }}</span>
            <span class="landing-stock-search__option-code">{{ item.code }}</span>
          </div>
        </template>
      </el-autocomplete>

      <template #fallback>
        <el-input
          class="landing-stock-search__input"
          placeholder="輸入股票代號或名稱，例如 2330 或 台積電"
          aria-label="輸入股票代號或名稱"
          disabled
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </template>
    </ClientOnly>

    <el-button type="primary" class="landing-stock-search__submit" @click="handleEnter">
      立即查詢
    </el-button>
  </div>
</template>

<style scoped>
.landing-stock-search {
  display: flex;
  width: 100%;
  gap: 8px;
}

.landing-stock-search__input {
  flex: 1;
  min-width: 0;
  height: 44px;
}

.landing-stock-search__submit {
  height: 44px;
  padding: 0 20px;
  font-size: 16px;
}

.landing-stock-search__option {
  display: flex;
  justify-content: space-between;
}

.landing-stock-search__option-code {
  color: var(--el-text-color-secondary);
}

.landing-stock-search__no-match {
  margin: 0;
  text-align: center;
  color: var(--el-text-color-placeholder);
  cursor: default;
}
</style>

<style>
/* Unscoped for the same reason as StockSearchBar.vue's own identical rule — el-autocomplete
   forwards the class onto its internal el-input root, but that root doesn't carry this
   component's scoped data-v-* attribute, so a scoped :deep() rule here would silently never
   match. 16px matches this app's global input-text floor (see feedback_16px_font_floor
   memory) rather than Element Plus's 14px default. */
.landing-stock-search__input .el-input__inner {
  font-size: 16px;
}
</style>
