<script setup lang="ts">
const router = useRouter()
// Awaited (not just destructured) so this always resolves to the same settled value on
// the server and on the client — useScreenerTabs' guest tab bakes a fixed ROE field label
// into its default condition the moment it's created, and reading schema.value before the
// real /filters fetch has settled would let the server capture the mock fallback's label
// while client hydration (which restores the already-resolved real data from the SSR
// payload) captures the real one instead, producing a hydration mismatch.
const { data: schema } = await useFilterSchema()
const { open: openLogin } = useLoginDialog()
const {
  displayedTabs,
  activeTabId,
  columnPresetOptions,
  pickerVisible,
  addTab,
  removeTab,
  removeSlot,
  openAddConditionPicker,
  openColumnPicker,
  handleSelect,
  handleColumnTabChange,
  addColumnPresetOption,
  removeColumnPresetOption,
  handleReorderColumns,
  handleRemoveColumn,
  isGuestTab
} = useScreenerTabs()
</script>

<template>
  <div class="screener-page">
    <h1 class="screener-page__title">選股篩選</h1>

    <!-- Tabs come first: the workflow is filter once per tab, then use tabs mainly to
         switch which columns you're viewing the resulting list through. -->
    <StockScreenerPresetTabs
      :tabs="displayedTabs"
      v-model:active-tab-id="activeTabId"
      @add-tab="addTab"
      @remove-tab="removeTab"
      @add-condition="openAddConditionPicker"
      @remove-slot="removeSlot"
    >
      <template #result="{ tab }">
        <StockScreenerResultPanel
          :tab="tab"
          :column-preset-options="columnPresetOptions"
          :is-guest="isGuestTab(tab)"
          @column-tab-change="name => handleColumnTabChange(tab, name)"
          @add-column-preset="addColumnPresetOption(tab)"
          @remove-column-preset="name => removeColumnPresetOption(tab, name)"
          @reorder-columns="fields => handleReorderColumns(tab, fields)"
          @remove-column="field => handleRemoveColumn(tab, field)"
          @add-column-click="isGuestTab(tab) ? openLogin() : openColumnPicker(tab)"
          @row-click="symbol => router.push(`/stock/${symbol}`)"
        />
      </template>
    </StockScreenerPresetTabs>

    <StockFilterIndicatorDialog
      v-if="schema"
      v-model="pickerVisible"
      :categories="schema.categories"
      @select="handleSelect"
    />
  </div>
</template>

<style scoped>
.screener-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.screener-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}
</style>
