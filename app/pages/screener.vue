<script setup lang="ts">
import type { PresetFolderItem } from '~/components/shared/PresetFolder.vue'

const router = useRouter()
const hasHydrated = useHasHydrated()
const showPeriod = useScreenerShowPeriod()

// 證券類型 switcher — per direct request ("普通股篩選記得改成 證券的分類" → clarified to "要新增
// 一個真正的『證券類型』篩選"). This page's own screening engine (POST /screener, analysis-ts)
// only ever queries GET /metrics, which is 普通股-only — 特別股/ETF have no metric data at all
// (confirmed live with analysis-ts), so there's no way to run the same numeric-condition
// screening against them here. Per direct confirmation ("他們都會有各自的檢視畫面"), 特別股/ETF
// each already have their own real page (preferred-stocks/index.vue, etf-zone.vue) — selecting
// either just navigates there immediately rather than attempting to rebuild a second screening
// engine on this page for data that can't support it. 普通股 is this page itself, so it's the
// only option that doesn't navigate anywhere.
type SecurityKind = 'common' | 'preferred' | 'etf'
const securityKind = ref<SecurityKind>('common')
const SECURITY_KIND_ROUTES: Record<Exclude<SecurityKind, 'common'>, string> = {
  preferred: '/preferred-stocks',
  etf: '/etf-zone'
}

function handleSecurityKindChange(kind: SecurityKind) {
  if (kind === 'common') return
  router.push(SECURITY_KIND_ROUTES[kind])
}
// Awaited (not just destructured) so this always resolves to the same settled value on
// the server and on the client — addTab's own default condition bakes a fixed ROE field
// label in the moment it's created, and reading schema.value before the real /filters fetch
// has settled would let the server capture the mock fallback's label while client hydration
// (which restores the already-resolved real data from the SSR payload) captures the real one
// instead, producing a hydration mismatch.
const { data: schema } = await useFilterSchema()
const {
  tabsReady,
  displayedTabs,
  activeTabId,
  activeTab,
  columnPresetOptions,
  pickerVisible,
  pickerMode,
  pickerCurrentFieldId,
  pickerTriggerEl,
  addTab,
  newTabDialogVisible,
  openNewTabDialog,
  addTemplateTab,
  templates,
  templatesLoading,
  removeTab,
  renameTab,
  reorderTabs,
  removeSlot,
  addConditionAndOpenPicker,
  rangeEditorVisible,
  rangeEditorSlot,
  rangeEditorTriggerEl,
  openRangeEditor,
  closeRangeEditor,
  changeRangeEditorPeriod,
  openFieldPicker,
  openColumnPicker,
  handleSelect,
  handleColumnTabChange,
  newColumnPresetDialogVisible,
  openNewColumnPresetDialog,
  confirmCustomColumnPreset,
  columnPresetTemplates,
  columnPresetTemplatesLoading,
  applyColumnPresetTemplate,
  renameColumnPreset,
  reorderColumnPresets,
  removeColumnPresetOption,
  handleReorderColumns,
  handleRemoveColumn,
  loadMoreResults,
  changeSort,
  setSectorCodes
} = useScreenerTabs()

// 類股篩選 — "證交所類股" (bff-ts, confirmed live 2026-09-11), a different classification system
// from the metric fields above (see useSecuritiesSectors.ts's own comment). Public/guest-usable,
// fetched once regardless of login state (same as the filter schema above).
const { data: sectors } = await useSecuritiesSectors()

function handleSectorCodesChange(codes: string[]) {
  if (activeTab.value) setSectorCodes(activeTab.value, codes)
}

// Signed-out visitor flow (see useGuestScreener.ts's own comment) — activeTab is only ever
// null once tabsReady is true for a genuinely resolved sign-out (see useScreenerTabs.ts's own
// authResolved-gated watcher), never during the brief "haven't checked auth yet" window, so
// this condition alone is enough to distinguish "definitely a guest" without importing
// authResolved/currentUser directly here too.
const {
  onboarded: guestOnboarded,
  dialogVisible: guestDialogVisible,
  selectedTemplateId: guestSelectedTemplateId,
  selectedColumnTemplateKey: guestSelectedColumnTemplateKey,
  templates: guestTemplates,
  templatesLoading: guestTemplatesLoading,
  columnTemplates: guestColumnTemplates,
  columnTemplatesLoading: guestColumnTemplatesLoading,
  guestTab,
  openDialog: openGuestDialog,
  confirmOnboarding: confirmGuestOnboarding,
  loadMoreGuestResults,
  changeGuestSort
} = useGuestScreener()
const { open: openLogin } = useLoginDialog()

watch(
  () => hasHydrated.value && tabsReady.value && !activeTab.value,
  isGuestState => {
    if (isGuestState && !guestOnboarded.value) openGuestDialog()
  },
  { immediate: true }
)

function registerFromGuestDialog() {
  openLogin()
}

// --- Filter-preset folder (screener preset itself) ---

// Every displayed tab is now always a real, backend-persisted preset — see removeTab/addTab
// below, and the no-guest-tab bootstrap in useScreenerTabs.ts — so every one is renameable/
// deletable (editable defaults to true when omitted, see PresetFolder.vue).
const presetItems = computed<PresetFolderItem[]>(() => displayedTabs.value.map(tab => ({ id: String(tab.id), name: tab.name })))

function findTab(id: string) {
  return displayedTabs.value.find(tab => String(tab.id) === id) ?? null
}

function handleRenamePreset(id: string, name: string) {
  const tab = findTab(id)
  if (tab) renameTab(tab, name)
}

function handleRemovePreset(id: string) {
  removeTab(id)
}

function handleReorderPresets(ids: string[]) {
  reorderTabs(ids)
}

// --- Column-preset folder (which columns the result table shows) ---
// No more "預設" sentinel leading the list (removed 2026-09-01 — see the removal commit for
// the full reasoning) — every item here is now a real, owned, renameable/deletable
// ColumnPreset; isDefault (see useScreenerTabs.ts's resolveDefaultColumnPresetId) decides
// what a tab opens to instead of a permanent placeholder tab competing with real ones for
// the same job. Column presets are a login-gated resource, so this folder is only ever
// shown once activeTab exists — see the template below.

const columnFolderItems = computed<PresetFolderItem[]>(() =>
  columnPresetOptions.value.map(option => ({ id: String(option.id), name: option.name }))
)

const activeColumnId = computed<string>({
  // Empty string (matches el-tabs's own "nothing selected" convention) rather than a
  // fallback id — activeTab.columnPresetId should only ever be genuinely null for the true
  // zero-column-preset case now (see resolveDefaultColumnPresetId), which has no tab to
  // highlight anyway since columnFolderItems is empty in that state too.
  get: () => activeTab.value?.columnPresetId ?? '',
  set: value => {
    if (activeTab.value) handleColumnTabChange(activeTab.value, value)
  }
})

function handleRenameColumnPreset(id: string, name: string) {
  renameColumnPreset(id, name)
}

function handleRemoveColumnPreset(id: string) {
  if (activeTab.value) removeColumnPresetOption(activeTab.value, id)
}

function handleReorderColumnPresets(ids: string[]) {
  reorderColumnPresets(ids)
}
</script>

<template>
  <div class="screener-page">
    <div class="screener-page__heading-row">
      <h1 class="screener-page__title">普通股篩選</h1>
      <!-- 證券類型 switcher — see script's own comment for why 特別股/ETF navigate away instead
           of screening in place. -->
      <el-radio-group
        :model-value="securityKind"
        size="small"
        class="screener-page__security-kind"
        @update:model-value="handleSecurityKindChange"
      >
        <el-radio-button value="common">普通股</el-radio-button>
        <el-radio-button value="preferred">特別股</el-radio-button>
        <el-radio-button value="etf">ETF</el-radio-button>
      </el-radio-group>
    </div>

    <!-- Gated on hasHydrated too, not just tabsReady — tabsReady itself changes between the
         SSR render and the client's first hydration pass whenever Firebase's auth check
         happens to resolve fast (it did in local testing: a plain v-if/v-else on tabsReady
         alone produced real "Hydration node mismatch" warnings). hasHydrated is false on
         both the server and the client's first render no matter what (see useHasHydrated.ts),
         so this branch is guaranteed to agree during hydration regardless of that race —
         first tried <ClientOnly> for this, which also works during the initial load but
         re-defers on every remount, including a plain client-side navigation back to an
         already-bootstrapped screener (reported: a skeleton flash switching pages into
         /screener that a fresh reload didn't have). hasHydrated only flips once per browser
         session, so a later remount renders directly from the current tabsReady value with no
         artificial delay. -->
    <template v-if="hasHydrated && tabsReady">
      <template v-if="activeTab">
        <SharedPresetFolder
          :items="presetItems"
          v-model:active-id="activeTabId"
          @add="openNewTabDialog"
          @rename="handleRenamePreset"
          @remove="handleRemovePreset"
          @reorder="handleReorderPresets"
        >
          <!-- 類股篩選 — a company-classification scope (see useSecuritiesSectors.ts's own
               comment), not a metric condition, so it's a sibling control here rather than
               threaded through ScreenerOrganismFilters' own condition-pill props/emits (that
               component's whole job is numeric field conditions; keeping this separate avoids
               widening its contract for a field that isn't one of those). Empty selection = no
               sector restriction. -->
          <div class="screener-page__sector-filter">
            <span class="screener-page__sector-filter-label">類股</span>
            <el-select
              :model-value="activeTab.sectorCodes"
              multiple
              collapse-tags
              collapse-tags-tooltip
              filterable
              clearable
              placeholder="不限類股"
              size="small"
              class="screener-page__sector-filter-select"
              @update:model-value="handleSectorCodesChange"
            >
              <el-option v-for="sector in sectors" :key="sector.code" :label="`${sector.name}（${sector.companyCount}）`" :value="sector.code" />
            </el-select>
          </div>

          <ScreenerOrganismFilters
            :tab="activeTab"
            :categories="schema.categories"
            @add-condition="triggerEl => addConditionAndOpenPicker(activeTab!, triggerEl)"
            @change-slot-field="(slotId, triggerEl) => openFieldPicker(activeTab!, slotId, triggerEl)"
            @open-value-editor="(slotId, triggerEl) => openRangeEditor(activeTab!, slotId, triggerEl)"
            @remove-slot="slotId => removeSlot(activeTab!, slotId)"
          />
        </SharedPresetFolder>

        <div class="screener-page__result-header">
          <h2 class="screener-page__result-heading">搜尋結果</h2>
          <!-- Global, not per-tab — lives outside every SharedPresetFolder/column-preset tab
               below since flipping it affects every tab's table the same way (see
               useScreenerShowPeriod.ts). -->
          <label class="screener-page__period-toggle">
            <el-switch v-model="showPeriod" size="small" />
            <span>顯示資料時間</span>
          </label>
        </div>

        <SharedPresetFolder
          fill-height
          :items="columnFolderItems"
          v-model:active-id="activeColumnId"
          @add="openNewColumnPresetDialog(activeTab!)"
          @rename="handleRenameColumnPreset"
          @remove="handleRemoveColumnPreset"
          @reorder="handleReorderColumnPresets"
        >
          <ScreenerOrganismResultBody
            :tab="activeTab"
            :categories="schema.categories"
            @reorder-columns="fields => handleReorderColumns(activeTab!, fields)"
            @remove-column="field => handleRemoveColumn(activeTab!, field)"
            @add-column-click="triggerEl => openColumnPicker(activeTab!, triggerEl)"
            @row-click="symbol => router.push(`/stock/${symbol}`)"
            @load-more="loadMoreResults(activeTab!)"
            @sort-change="(field, order) => changeSort(activeTab!, field, order)"
          />
        </SharedPresetFolder>
      </template>

      <!-- Signed-out visitor: the first-visit onboarding dialog (see useGuestScreener.ts) opens
           itself via this file's own watch() above; once confirmed, this renders a read-only
           result view built from the two chosen templates — no tab strip, no column picker
           (a guest has no owned presets to manage), just the table plus a persistent
           registration nudge. Before that first confirm, the dialog is open and this area is
           simply empty behind it. -->
      <template v-else>
        <div class="screener-page__guest-banner">
          <span class="screener-page__guest-banner-text">
            目前以訪客身分瀏覽，篩選結果不會被儲存。
          </span>
          <div class="screener-page__guest-banner-actions">
            <el-button size="small" @click="openGuestDialog">重新選擇</el-button>
            <el-button size="small" type="primary" @click="registerFromGuestDialog">現在就註冊，保留篩選條件</el-button>
          </div>
        </div>

        <div class="screener-page__result-header">
          <h2 class="screener-page__result-heading">搜尋結果</h2>
          <label class="screener-page__period-toggle">
            <el-switch v-model="showPeriod" size="small" />
            <span>顯示資料時間</span>
          </label>
        </div>

        <ScreenerOrganismResultBody
          :tab="guestTab"
          :categories="schema.categories"
          :readonly="true"
          @row-click="symbol => router.push(`/stock/${symbol}`)"
          @load-more="loadMoreGuestResults()"
          @sort-change="(field, order) => changeGuestSort(field, order)"
        />
      </template>
    </template>

    <div v-else class="screener-page__skeleton">
      <el-skeleton :rows="2" animated />
      <h2 class="screener-page__result-heading">搜尋結果</h2>
      <el-skeleton :rows="6" animated />
    </div>

    <ScreenerOrganismIndicatorPicker
      v-if="schema"
      v-model="pickerVisible"
      :categories="schema.categories"
      :current-field-id="pickerCurrentFieldId"
      :trigger-el="pickerTriggerEl"
      :hide-period="pickerMode === 'condition'"
      @select="handleSelect"
    />

    <!-- Shared across a brand-new condition (still just a draft — see useScreenerTabs.ts's
         rangeEditorSlot) and reassigning/editing an already-real one's value. Closing this
         is the only moment a new condition actually becomes a real slot (closeRangeEditor
         decides whether a value was actually set); update:model-value only ever fires false
         here (nothing else opens it), so there's no need to branch on the event's value. -->
    <ScreenerOrganismRangeEditorPopover
      v-if="schema"
      :model-value="rangeEditorVisible"
      :slot="rangeEditorSlot"
      :categories="schema.categories"
      :trigger-el="rangeEditorTriggerEl"
      @update:model-value="closeRangeEditor"
      @change-period="changeRangeEditorPeriod"
    />

    <ScreenerOrganismNewPresetDialog
      v-model="newTabDialogVisible"
      :templates="templates"
      :templates-loading="templatesLoading"
      @custom="addTab"
      @template="addTemplateTab"
    />

    <ScreenerOrganismNewColumnPresetDialog
      v-model="newColumnPresetDialogVisible"
      :templates="columnPresetTemplates"
      :templates-loading="columnPresetTemplatesLoading"
      @custom="confirmCustomColumnPreset"
      @template="applyColumnPresetTemplate"
    />

    <ScreenerOrganismGuestOnboardingDialog
      v-model="guestDialogVisible"
      :templates="guestTemplates"
      :templates-loading="guestTemplatesLoading"
      :column-templates="guestColumnTemplates"
      :column-templates-loading="guestColumnTemplatesLoading"
      v-model:selected-template-id="guestSelectedTemplateId"
      v-model:selected-column-template-key="guestSelectedColumnTemplateKey"
      @confirm="confirmGuestOnboarding"
      @register="registerFromGuestDialog"
    />
  </div>
</template>

<style scoped>
/* Bounded to the viewport (minus the app-shell chrome around this page) rather than normal
   document flow, so the result table's own SharedPresetFolder (fill-height, below) can be
   the one flex child that takes up whatever's left and scrolls internally — see that
   component's own fillHeight prop comment. Not done by changing desktop.vue/mobile.vue's
   shared app-shell itself (would affect every route in the app); the numbers below are this
   page's own copy of those two layouts' current .app-shell__content padding, mobile-first,
   overridden at the same 1280px breakpoint useDeviceLayout.ts uses to pick between them.
   Mobile no longer reserves space for AppFeatureMenu.vue's floating home-button trigger — per
   direct request it now floats on top of page content instead (same change already made to
   etf-zone.vue/preferred-stocks/index.vue), so this only subtracts safe-area; desktop subtracts
   its flat 20px bottom padding. */
.screener-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: calc(100vh - var(--app-header-height) - var(--app-banner-height) - 16px - env(safe-area-inset-bottom));
}

@media (min-width: 1280px) {
  .screener-page {
    height: calc(100vh - var(--app-header-height) - var(--app-banner-height) - 16px - 20px);
  }
}

.screener-page__heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.screener-page__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.screener-page__skeleton {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.screener-page__result-heading {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.screener-page__result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.screener-page__period-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

/* Mirrors OrganismFilters.vue's own .screener-filters padding convention (16px on mobile since
   SharedPresetFolder's body is unpadded there; 0 on desktop since the folder body itself already
   adds 16px) — this sits as a sibling above that component inside the same folder slot, so it
   needs the identical responsive inset to align with it instead of double-padding or looking
   flush against the folder edge at one breakpoint. */
.screener-page__sector-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 0;
}

@media (min-width: 768px) {
  .screener-page__sector-filter {
    padding: 16px 0 0;
  }
}

.screener-page__sector-filter-label {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.screener-page__sector-filter-select {
  min-width: 240px;
  max-width: 100%;
}

/* Guest read-only result view's own persistent registration nudge — a plain bordered strip
   rather than el-alert, matching this page's own sector-filter row's visual weight instead of
   introducing a new, louder component just for this banner. */
.screener-page__guest-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.screener-page__guest-banner-text {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.screener-page__guest-banner-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
