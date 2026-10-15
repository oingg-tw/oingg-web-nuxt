<script setup lang="ts">
import type { ScreenerWorkspace } from '~/composables/screener/screener-tab-model'
import type { ScreenerUniverse } from '~/utils/screener-zone'
// 三組篩選（普通股、特別股、ETF）共用的整頁（2026-10-15 三組篩選重新設計）。使用者：「三組最後使用UIUX要接近，降低用戶負擔」。
// 每一個控制項都只在這裡接一次，三頁只給「資料」（screener：useScreenerTabs 或 useUniverseScreener 包成的 ScreenerWorkspace）
// 與自己的標題、說明——改一個控制項三組一起改，不會有哪一頁漏接（同個股頁的 StockPageShell）。
//
// 順序：標題 → 側欄導覽 → 一句說明 → 設定區（我的篩選＋條件）→ 結果區（標題、符合幾檔、顯示欄位、結果表）。
//
// 版面：整頁自然往下捲，**不鎖在一個螢幕高**。原本三頁各自用 height: calc(100vh - …) 把整頁鎖住，上面的分頁與條件吃掉高度後，
// 結果表只剩小小的內捲框（2026-10-15 在 1440×800 量到 ETF 273px、特別股 317px）。現在結果表自己限高一個螢幕
//（SharedMetricTable 的 viewportHeight），手機是卡片、跟著頁面捲。
const props = defineProps<{
  // 標題、說明、主詞都從 SCREENER_ZONE_ITEMS 讀（側欄與 /screener 首頁也讀它），三處的名稱不會分家
  universe: ScreenerUniverse
  screener: ScreenerWorkspace
}>()

const zone = computed(() => SCREENER_ZONE_ITEMS.find(item => item.key === props.universe)!)
const uid = useId()
const hasHydrated = useHasHydrated()
const tab = computed(() => props.screener.activeTab)
const hasConditions = computed(() => !!tab.value?.slots.some(slot => slot.fieldId !== null))

// 「全部」還是「符合上述條件」看的是這個數字查到的時候有沒有條件，不是現在：改條件到自動查詢之間的 0.6 秒，數字還是上一次的，
// 跟著現在的條件換字首會讓 live region 先念一個錯的數字（2026-10-15 量到「符合上述條件 339 檔」接著才「322 檔」）
const countedWithConditions = ref(false)
watch(() => [tab.value?.id, tab.value?.loading] as const, () => {
  if (tab.value && !tab.value.loading) countedWithConditions.value = hasConditions.value
}, { immediate: true })

// 「符合上述條件 N 檔」：條件一變就念出來；還沒查過、查詢中不念數字。個位數時加一句中性提醒（知識庫「分層篩選的樣本衰減」）
const countText = computed(() => {
  const current = tab.value
  if (!current?.searched) return ''
  if (current.loading) return '搜尋中…'
  if (!countedWithConditions.value) return `全部 ${groupThousands(current.total)} 檔`
  const count = `符合上述條件 ${groupThousands(current.total)} 檔`
  return current.total > 0 && current.total < 10 ? `${count}；檔數少，條件稍微變動結果就可能不同` : count
})

const empty = computed(() => !!tab.value?.searched && !tab.value.loading && tab.value.total === 0 && hasConditions.value)
const lastSlotId = computed(() => tab.value?.slots.at(-1)?.id ?? null)

// 新增條件按「完成」之後焦點落在新膠囊的值上，不是回到「新增條件」：鍵盤使用者接著要改值或移除，不必再找一次。
// 等面板的 closed（關閉動畫結束）才移：Element Plus 的對話框在那之前會把焦點還給打開它的按鈕
const setupRef = ref<HTMLElement>()
let slotCountAtOpen = 0
watch(() => props.screener.pickerVisible || props.screener.rangeEditorVisible, (open, wasOpen) => {
  if (open && !wasOpen) slotCountAtOpen = tab.value?.slots.length ?? 0
})
function focusNewCondition() {
  const slots = tab.value?.slots ?? []
  if (slots.length <= slotCountAtOpen) return
  setupRef.value?.querySelector<HTMLElement>(`[data-slot-id="${slots.at(-1)!.id}"] .condition-pill__value`)?.focus()
}

function openRow(symbol: string) {
  navigateTo(props.screener.rowLink(symbol))
}

function toElOrder(order: 'asc' | 'desc' | null): 'ascending' | 'descending' | null {
  return order === 'asc' ? 'ascending' : order === 'desc' ? 'descending' : null
}

function fromElOrder(order: 'ascending' | 'descending' | null): 'asc' | 'desc' | null {
  return order === 'ascending' ? 'asc' : order === 'descending' ? 'desc' : null
}
</script>

<template>
  <div class="app-page app-page--compact screener-shell">
    <h1 class="app-page__title app-page__title--app screener-shell__title">
      {{ zone.label }}
      <slot name="title-extra" />
    </h1>
    <ScreenerNav />
    <p class="screener-shell__intro">{{ zone.description }}</p>
    <slot name="before" />

    <!-- hasHydrated 也要等：登入狀態在伺服器與瀏覽器第一次渲染時一定是「還不知道」，兩邊才畫得一樣（見 useHasHydrated） -->
    <template v-if="hasHydrated && screener.ready">
      <template v-if="tab">
        <section ref="setupRef" class="screener-shell__setup" :aria-labelledby="`${uid}-setup`">
          <h2 :id="`${uid}-setup`" class="visually-hidden">篩選條件</h2>
          <ScreenerPresetSelect
            label="我的篩選"
            add-label="新增篩選"
            save-label="存成我的篩選"
            :items="screener.presetItems"
            :active-id="screener.activeTabId"
            @update:active-id="screener.selectTab"
            @add="screener.openNewTabDialog()"
            @rename="screener.renamePreset"
            @remove="screener.removePreset"
            @reorder="screener.reorderTabs"
            @save="screener.saveActiveTab()"
          />
          <ScreenerFilters
            :slots="tab.slots"
            :categories="screener.categories"
            @add-condition="triggerEl => screener.addConditionAndOpenPicker(tab!, triggerEl)"
            @change-slot-field="(slotId, triggerEl) => screener.openFieldPicker(tab!, slotId, triggerEl)"
            @open-value-editor="(slotId, triggerEl) => screener.openRangeEditor(tab!, slotId, triggerEl)"
            @remove-slot="slotId => screener.removeSlot(tab!, slotId)"
          />
        </section>

        <section class="screener-shell__results" :aria-labelledby="`${uid}-results`">
          <div class="screener-shell__results-header">
            <h2 :id="`${uid}-results`" class="app-page__h2 screener-shell__results-title">篩選結果</h2>
            <p class="screener-shell__count" role="status">{{ countText }}</p>
            <p v-if="screener.dataDate" class="screener-shell__date">資料日期 {{ screener.dataDate }}</p>
            <slot name="result-meta" />
          </div>
          <ScreenerPresetSelect
            label="顯示欄位"
            add-label="新增欄位組合"
            save-label="存成我的欄位組合"
            :items="screener.columnSetItems"
            :active-id="screener.activeColumnSetId"
            @update:active-id="screener.selectColumnSet"
            @add="screener.openNewColumnPresetDialog(tab!)"
            @rename="screener.renameColumnSet"
            @remove="screener.removeColumnSet"
            @reorder="screener.reorderColumnSets"
            @save="screener.saveColumnSet()"
          />
          <!-- 沒有結果：說清楚是條件太嚴，給一個馬上能做的動作（三組同一段）。
               下面結果表的名稱欄 160px：ETF 簡稱常有 8 個字（主動國泰動能高息），三組同寬 -->
          <div v-if="empty" class="screener-shell__empty">
            <p class="screener-shell__empty-text">沒有符合上述條件的{{ zone.subject }}。可以放寬或移除條件。</p>
            <el-button v-if="lastSlotId !== null" class="screener-shell__empty-button" @click="screener.removeSlot(tab!, lastSlotId)">移除最後一個條件</el-button>
          </div>
          <SharedMetricTable
            v-else
            v-loading="tab.loading"
            :rows="tab.results"
            :columns="tab.columns"
            :has-more="tab.page < tab.totalPages"
            :loading-more="tab.loadingMore"
            :sort-field="tab.sortField"
            :sort-order="toElOrder(tab.sortOrder)"
            :sort-mode="screener.sortMode"
            :categories="screener.categories"
            :show-period="screener.periodToggle ? undefined : true"
            :cell-dates="screener.periodToggle ? undefined : false"
            :row-link="screener.rowLink"
            :total="tab.total"
            :name-width="160"
            viewport-height
            @reorder="fields => screener.handleReorderColumns(tab!, fields)"
            @remove-column="field => screener.handleRemoveColumn(tab!, field)"
            @add-column-click="triggerEl => screener.openColumnPicker(tab!, triggerEl)"
            @row-click="openRow"
            @load-more="screener.loadMoreResults(tab!)"
            @sort-change="(field, order) => screener.changeSort(tab!, field, fromElOrder(order))"
          />
        </section>
      </template>
      <!-- 還沒有任何一組可以顯示（普通股的訪客要先選一組範本） -->
      <slot v-else name="no-tab" />
    </template>

    <div v-else class="screener-shell__skeleton">
      <el-skeleton :rows="2" animated />
      <el-skeleton :rows="6" animated />
    </div>

    <!-- 新增／修改條件與新增欄位共用的面板：手機貼底、桌機置中（ScreenerConditionPanel） -->
    <ScreenerConditionPanel
      :picker-visible="screener.pickerVisible"
      :picker-mode="screener.pickerMode"
      :range-visible="screener.rangeEditorVisible"
      :slot="screener.rangeEditorSlot"
      :categories="screener.categories"
      :current-field-id="screener.pickerCurrentFieldId"
      @select="screener.handleSelect"
      @back="screener.backToPicker()"
      @close="screener.closePanel()"
      @closed="focusNewCondition"
      @change-period="screener.changeRangeEditorPeriod"
    />

    <ScreenerNewPresetDialog
      v-model="screener.newTabDialogVisible"
      :templates="screener.templates"
      :templates-loading="screener.templatesLoading"
      @custom="screener.addTab()"
      @copy="screener.copyActiveTab()"
      @template="screener.addTemplateTab"
    />

    <ScreenerNewColumnPresetDialog
      v-model="screener.newColumnPresetDialogVisible"
      :templates="screener.columnPresetTemplates"
      :templates-loading="screener.columnPresetTemplatesLoading"
      @custom="screener.confirmCustomColumnPreset()"
      @template="screener.applyColumnPresetTemplate"
    />

    <slot />
  </div>
</template>

<style scoped>
.screener-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.screener-shell__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.screener-shell__intro {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

/* 設定區一個框：我的篩選＋條件是同一件事（「篩什麼」），跟下面的結果分開 */
.screener-shell__setup {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-bg-color);
}

.screener-shell__results {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.screener-shell__results-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
}

.screener-shell__results-title {
  margin: 0;
}

.screener-shell__count,
.screener-shell__date {
  margin: 0;
  font-size: 1rem;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.screener-shell__date {
  color: var(--el-text-color-secondary);
}

.screener-shell__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px 16px;
  border: 1px dashed var(--el-border-color);
  border-radius: 12px;
}

.screener-shell__empty-text {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
}

.screener-shell__empty-button {
  font-size: 1rem;
}

.screener-shell__skeleton {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
