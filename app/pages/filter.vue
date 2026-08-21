<script setup lang="ts">
import type { StockColumnKey } from '~/composables/useStocks'

const { data: schema } = useFilterSchema()
const { columns } = useStocks()
const { results, loading, searched, search } = useFilterSearch()

const RESULT_COLUMN_KEYS: StockColumnKey[] = ['price', 'per', 'dividendYield', 'pbr']
const resultColumns = computed(() => RESULT_COLUMN_KEYS.map(key => columns.find(column => column.key === key)!))
</script>

<template>
  <div class="filter-page">
    <StockSearchBar>
      <template #actions>
        <UserMenuButton />
      </template>
    </StockSearchBar>

    <AppMenuBar>
      <UserMenuButton />
    </AppMenuBar>

    <h1 class="filter-page__title">選股篩選</h1>

    <StockFilterPanel v-if="schema" :categories="schema.categories" :loading="loading" @search="search" />

    <StockTable
      v-if="searched"
      class="filter-page__table"
      :stocks="results"
      :columns="resultColumns"
      :removable="false"
    />
    <el-empty v-else description="設定篩選條件後按下搜尋" />
  </div>
</template>

<style scoped>
.filter-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: calc(76px + env(safe-area-inset-top)) 16px calc(88px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (min-width: 768px) {
  .filter-page {
    padding-bottom: 20px;
  }
}

.filter-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}
</style>
