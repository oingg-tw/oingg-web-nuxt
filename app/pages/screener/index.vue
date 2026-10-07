<script setup lang="ts">
import type { PresetFolderItem } from '~/components/shared/PresetFolder.vue'
import type { HubSector, ScreenerTemplateWithSlug } from '#shared/types/hub'

// Moved from app/pages/screener.vue to screener/index.vue on 2026-09-19 (the SEO build) so the
// /screener/{slug} condition pages can live beside it — the path is unchanged.
const route = useRoute()
const router = useRouter()
const hasHydrated = useHasHydrated()
const showPeriod = useScreenerShowPeriod()

// <head> (2026-09-19): this page had no title/description/canonical of its own. The canonical
// is the bare path — `?template=`/`?sector=` are entry points that apply a preset, not separate
// pages, and the query is dropped from the URL once applied (see the deep-link watchers below).
const requestUrl = useRequestURL()
useSeoMeta({
  title: '台股個股篩選器：依財報指標設定條件',
  description: '依 ROE、負債比率、殖利率等 144 項財報指標設定條件，篩出符合的上市櫃公司；可限定證交所類股、依任一欄位排序，未登入也能使用，登入後可儲存自己的篩選條件。',
  robots: undefined
})
useHead({ link: [{ rel: 'canonical', href: `${requestUrl.origin}/screener` }] })

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
  addTab,
  addGuestTab,
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
  openRangeEditor,
  changeRangeEditorPeriod,
  backToPicker,
  closePanel,
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
  setSectorCodes,
  setSectorMode
} = useScreenerTabs()

// 類股篩選 — 證交所類股，跟上面那些指標欄位是兩套不同的分類系統。
//
// **2026-10-01 從 useSecuritiesSectors()（直接打 bff 的 /industries/securities-sectors）改成
// /api/hub/sectors**，也就是首頁、/stock、/industries、產業頁的「其他類股」四處本來就在用的那一支。
// 原本這一頁是全站唯一讀另一個來源的，兩個後果都真的發生了：
//
//   1. 代號 13（電子工業（舊分類））：型錄說 33 家，而 `GET /stocks` 全部 2,349 筆裡是 0 筆、
//      `POST /screener` 帶 sectorCodes:['13'] 也回 total 0（2026-10-01 實測，同一次 '24' 回 160）。
//      於是這一頁的膠囊寫著「（33）」、點進去 404——check-click-depth 抓到的就是這一條。
//      getSectors() 本來就會把型錄跟真實 directory 對一次（`listed.has(sector.code)`），所以那一支
//      回的是 34 個、沒有這個洞；問題從頭到尾只是這一頁沒用它。
//      （上游 2026-10-02 把 13／19 從型錄移除、兩邊合計也對上了，所以這個洞現在不存在。改用
//      /api/hub/sectors 的理由不變——下面第 2 點跟上游對不對齊無關。）
//   2. 那是一次沒有快取的 client/SSR 直打，失敗就退成空陣列、整段類股連結無聲消失。實測過：
//      我自己對 bff 連續量測的時候 check-hub-pages 的「industry links ≥ 30」就 FAIL 了兩次，
//      手動 curl 同一頁卻是 34 條。/api/hub/sectors 有 Nitro 的 SWR，上游打嗝時供舊值。
//
// 兩個來源合成一個之後，這裡不需要再自己過濾代號。
const { data: sectors } = await useFetch<HubSector[]>('/api/hub/sectors', { key: 'hub-sectors', default: () => [] })

// The official templates with their /screener/{slug} pages — server-rendered links in the
// collapsible block under the title, so a crawler reaches every condition page and every sector
// page from here（/api/hub/screener-templates, cached 24h）.
const { data: hubTemplates } = await useFetch<ScreenerTemplateWithSlug[]>('/api/hub/screener-templates', { key: 'hub-screener-templates', default: () => [] })
const linkedTemplates = computed(() => hubTemplates.value.filter(item => item.slug && item.status === 'AVAILABLE'))
const linkedSectors = computed(() => sectors.value.filter(sector => sectorPath(sector.code)))

function handleSectorCodesChange(codes: string[]) {
  if (activeTab.value) setSectorCodes(activeTab.value, codes)
}

// el-radio-group's model value is typed as string | number | boolean, so it's narrowed here
// rather than cast — the group only ever holds these two values.
function handleSectorModeChange(mode: string | number | boolean | undefined) {
  if (activeTab.value && (mode === 'include' || mode === 'exclude')) setSectorMode(activeTab.value, mode)
}

// Deep links (2026-09-19): `?template={slug}` from a condition page's「套用至篩選器」and
// `?sector={code}` from an industry page's「想用更多條件篩選？」. Each is applied once, then the
// query is dropped（view state never stays in the URL）.
const templateQuery = computed(() => (typeof route.query.template === 'string' ? route.query.template : null))
const sectorQuery = computed(() => (typeof route.query.sector === 'string' && linkedSectors.value.some(sector => sector.code === route.query.sector) ? route.query.sector : null))
const { list: listTemplates } = useScreenerTemplates()

async function templateIdBySlug(slug: string): Promise<string | null> {
  const name = screenerTemplateNameBySlug(slug)
  if (!name) return null
  return (await listTemplates()).find(template => template.name === name && template.status === 'AVAILABLE')?.id ?? null
}

function clearDeepLinkQuery() {
  if (templateQuery.value || route.query.sector !== undefined) router.replace({ query: {} })
}

// Signed-out visitor flow — activeTab is only ever null once tabsReady is true for a genuinely
// resolved sign-out (see useScreenerTabs.ts's own authResolved-gated watcher), never during the
// brief "haven't checked auth yet" window, so this condition alone is enough to distinguish
// "definitely a guest, no tab built yet" without importing authResolved/currentUser directly
// here too. Once addGuestTab below actually builds one, activeTab becomes truthy and this
// watcher naturally stops firing — the guest's tab then renders through the exact same
// v-if="activeTab" branch a signed-in tab does (see template), with full filter/column editing.
const {
  onboarded: guestOnboarded,
  selectedTemplateId: guestSelectedTemplateId,
  templates: guestTemplates,
  templatesLoading: guestTemplatesLoading,
  loadTemplates: loadGuestTemplates,
  resolveSelection: resolveGuestSelection,
  resolveTemplateBySlug: resolveGuestTemplateBySlug
} = useGuestScreener()
const { open: openLogin } = useLoginDialog()

// A guest arriving through `?template=` skips the in-page picker below — the condition page was
// the choice（the compliance point of that picker is that the visitor picks, which they did）.
watch(
  () => hasHydrated.value && tabsReady.value && !activeTab.value,
  async isGuestState => {
    if (!isGuestState || guestOnboarded.value) return
    if (templateQuery.value) {
      const selection = await resolveGuestTemplateBySlug(templateQuery.value)
      if (selection) {
        await addGuestTab(selection.filters, selection.fieldKeys)
        return
      }
    }
    loadGuestTemplates()
  },
  { immediate: true }
)

// Once a tab exists（a signed-in user's own, or the guest tab built above）: a signed-in user's
// `?template=` becomes a new preset tab from that template; `?sector=` scopes the active tab.
let deepLinkApplied = false
watch(
  () => hasHydrated.value && tabsReady.value && !!activeTab.value,
  async ready => {
    if (!ready || deepLinkApplied) return
    deepLinkApplied = true
    if (templateQuery.value && !guestOnboarded.value) {
      const id = await templateIdBySlug(templateQuery.value)
      if (id) await addTemplateTab(id)
    }
    // Mode forced back to include: this link comes from an industry page's「想用更多條件篩選？」,
    // which means "screen WITHIN this industry". Landing on a tab left in 排除 mode would have
    // turned that into "screen everything EXCEPT this industry" — the opposite of what was clicked.
    if (sectorQuery.value && activeTab.value) {
      setSectorMode(activeTab.value, 'include')
      setSectorCodes(activeTab.value, [sectorQuery.value])
    }
    clearDeepLinkQuery()
  },
  { immediate: true }
)

async function confirmGuestOnboarding() {
  const selection = await resolveGuestSelection()
  if (!selection) return
  await addGuestTab(selection.filters, selection.fieldKeys)
}

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

// A guest has no owned ColumnPreset resource at all (columnPresetOptions stays permanently
// empty — that list only ever loads from behind login), so without this the guest's own column-
// preset strip rendered with zero tabs — just a bare "+" — even though their tab clearly has a
// real, working column set (總覽's own fields). Real gap fixed 2026-09-11 (reported live:
// "columnsPreset 要帶預設"). Synthesized, not a real switchable resource: a guest only ever has
// the one column set, so this is purely a "here's what you're looking at" label, not a second
// preset they could pick between.
const GUEST_COLUMN_PRESET_ID = 'guest-overview'

const columnFolderItems = computed<PresetFolderItem[]>(() => {
  if (guestOnboarded.value) return [{ id: GUEST_COLUMN_PRESET_ID, name: '總覽', editable: false }]
  return columnPresetOptions.value.map(option => ({ id: String(option.id), name: option.name }))
})

const activeColumnId = computed<string>({
  // Empty string (matches el-tabs's own "nothing selected" convention) rather than a
  // fallback id — activeTab.columnPresetId should only ever be genuinely null for the true
  // zero-column-preset case now (see resolveDefaultColumnPresetId), which has no tab to
  // highlight anyway since columnFolderItems is empty in that state too.
  get: () => (guestOnboarded.value ? GUEST_COLUMN_PRESET_ID : (activeTab.value?.columnPresetId ?? '')),
  set: value => {
    // Nothing to switch to for a guest — see columnFolderItems' own comment.
    if (guestOnboarded.value) return
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

// 「目前符合 N 檔」：搜尋中、還沒搜尋過都不念數字
const resultCountText = computed(() => {
  const tab = activeTab.value
  if (!tab?.searched) return ''
  if (tab.loading) return '搜尋中…'
  const count = `目前符合 ${groupThousands(tab.total)} 檔`
  return tab.total > 0 && tab.total < 10 ? `${count}；檔數少，條件稍微變動結果就可能不同` : count
})
</script>

<template>
  <div class="screener-page" :class="{ 'screener-page--has-tab': !!activeTab }">
    <h1 class="screener-page__title">普通股篩選</h1>
    <!-- Server-rendered, JavaScript-free entry points (2026-09-19, the SEO build): one sentence a
         crawler can read, then the official condition pages and the 35 sector pages in a closed
         <details> — links every /screener/{slug} and /industry/… page can be reached through
         without taking vertical space from the screener itself. -->
    <p class="screener-page__intro">依 ROE、負債比率、殖利率等財報指標設定條件，篩出符合的上市櫃公司；可限定證交所類股，結果可依任一欄位排序，未登入也能使用。</p>
    <details class="screener-page__seo">
      <summary class="screener-page__seo-summary">官方篩選條件說明與依類股瀏覽</summary>
      <div class="screener-page__seo-body">
        <h2 class="screener-page__seo-heading">官方篩選條件</h2>
        <ul class="hub-chip-list">
          <li v-for="item in linkedTemplates" :key="item.id">
            <NuxtLink :to="screenerTemplatePath(item.slug!)" class="hub-chip">{{ item.name }}</NuxtLink>
          </li>
        </ul>
        <h2 class="screener-page__seo-heading">依類股瀏覽</h2>
        <ul class="hub-chip-list">
          <li v-for="sector in linkedSectors" :key="sector.code">
            <NuxtLink :to="sectorPath(sector.code) ?? '/stock'" class="hub-chip">{{ sector.name }}（{{ sector.companyCount }}）</NuxtLink>
          </li>
        </ul>
      </div>
    </details>

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
        <!-- Persistent, not a dialog — a guest can freely edit this tab (same UI a signed-in
             tab uses), but it's never saved anywhere; this stays visible the whole time so the
             registration pitch doesn't need to interrupt them again mid-edit. guestOnboarded is
             only ever true once the guest flow's own dialog has actually been confirmed, so this
             never shows for a real signed-in session. -->
        <div v-if="guestOnboarded" class="screener-page__guest-banner">
          <span class="screener-page__guest-banner-text">目前以訪客身分瀏覽，篩選結果不會被儲存。</span>
          <div class="screener-page__guest-banner-actions">
            <el-button type="primary" @click="registerFromGuestDialog">現在就註冊，保留篩選條件</el-button>
          </div>
        </div>

        <SharedPresetFolder
          :items="presetItems"
          v-model:active-id="activeTabId"
          @add="openNewTabDialog"
          @rename="handleRenamePreset"
          @remove="handleRemovePreset"
          @reorder="handleReorderPresets"
        >
          <!-- 類股篩選 — a company-classification scope (see the `sectors` fetch's own
               comment), not a metric condition, so it's a sibling control here rather than
               threaded through ScreenerOrganismFilters' own condition-pill props/emits (that
               component's whole job is numeric field conditions; keeping this separate avoids
               widening its contract for a field that isn't one of those). Empty selection = no
               sector restriction. -->
          <div class="screener-page__sector-filter">
            <span id="screener-sector-label" class="screener-page__sector-filter-label">類股</span>
            <!-- 包含／排除 2026-09-20（「普通股篩選要有機制可以排除產業」）. One picked set of
                 sectors, two directions — the mode decides which side of the line they land on,
                 so toggling keeps the selection rather than making the user pick again. The two
                 map onto bff-ts's mutually-exclusive sectorCodes / excludeSectorCodes at request
                 time (see useScreenerTabs' sectorScopeFor). -->
            <el-radio-group
              :model-value="activeTab.sectorMode"
              aria-labelledby="screener-sector-label"
              class="screener-page__sector-filter-mode"
              @update:model-value="handleSectorModeChange"
            >
              <el-radio-button value="include">包含</el-radio-button>
              <el-radio-button value="exclude">排除</el-radio-button>
            </el-radio-group>
            <el-select
              :model-value="activeTab.sectorCodes"
              aria-label="產業"
              multiple
              collapse-tags
              collapse-tags-tooltip
              filterable
              clearable
              :placeholder="activeTab.sectorMode === 'exclude' ? '未排除任何類股' : '不限類股'"
              class="screener-page__sector-filter-select"
              @update:model-value="handleSectorCodesChange"
            >
              <el-option v-for="sector in linkedSectors" :key="sector.code" :label="`${sector.name}（${sector.companyCount}）`" :value="sector.code" />
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
          <!-- 符合檔數（2026-10-07 篩選器重新設計）：條件一變就念出來；原本全頁沒有任何 live region，總數也從沒顯示過
               （bff-ts 回應的 count 其實就是總數）。個位數時加一句中性提醒（知識庫「分層篩選的樣本衰減」）。 -->
          <p class="screener-page__count" role="status">{{ resultCountText }}</p>
          <!-- Global, not per-tab — lives outside every SharedPresetFolder/column-preset tab
               below since flipping it affects every tab's table the same way (see
               useScreenerShowPeriod.ts). -->
          <label class="screener-page__period-toggle">
            <el-switch v-model="showPeriod" />
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

      <!-- Signed-out visitor, before a strategy has been picked (see useGuestScreener.ts) — the
           in-page picker below, not a dialog since 2026-09-19 (interface-complexity review). -->
      <ScreenerOrganismGuestStrategyPicker
        v-else
        :templates="guestTemplates"
        :templates-loading="guestTemplatesLoading"
        v-model:selected-template-id="guestSelectedTemplateId"
        @confirm="confirmGuestOnboarding"
        @register="registerFromGuestDialog"
      />
    </template>

    <div v-else class="screener-page__skeleton">
      <el-skeleton :rows="2" animated />
      <h2 class="screener-page__result-heading">搜尋結果</h2>
      <el-skeleton :rows="6" animated />
    </div>

    <!-- 新增／修改條件與新增欄位共用的面板（2026-10-07 取代選指標 popover＋範圍編輯 popover 兩層）。手機貼底、
         桌機置中，只靠 CSS；見 OrganismConditionPanel.vue。 -->
    <ScreenerOrganismConditionPanel
      v-if="schema"
      :picker-visible="pickerVisible"
      :picker-mode="pickerMode"
      :range-visible="rangeEditorVisible"
      :slot="rangeEditorSlot"
      :categories="schema.categories"
      :current-field-id="pickerCurrentFieldId"
      @select="handleSelect"
      @back="backToPicker"
      @close="closePanel"
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

  </div>
</template>

<style scoped>
/* Bounded to the viewport (minus the app-shell chrome around this page) rather than normal
   document flow, so the result table's own SharedPresetFolder (fill-height, below) can be
   the one flex child that takes up whatever's left and scrolls internally — see that
   component's own fillHeight prop comment. Not done by changing desktop.vue/mobile.vue's
   shared app-shell itself (would affect every route in the app); the numbers below are this
   page's own copy of those two layouts' current .app-shell__content padding, mobile-first,
   overridden at the same 1280px breakpoint the pinned-sidebar layout uses.
   Mobile no longer reserves space for AppFeatureMenu.vue's floating home-button trigger — per
   direct request it now floats on top of page content instead (same change already made to
   etf-zone.vue/preferred-stocks/index.vue), so this only subtracts safe-area; desktop subtracts
   its flat 20px bottom padding. */
.screener-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Fixed height only once a tab exists (2026-09-19, interface-complexity review) — this bounded-
   viewport sizing exists so the result table's own SharedPresetFolder (fill-height) can be the
   one flex child that scrolls internally (see that component's own fillHeight prop comment), but
   a signed-out visitor who hasn't picked a strategy yet has no result table at all — just the
   in-page guest picker below, which should flow normally and grow with its own content instead of
   being clipped to a viewport-height box with nothing to fill it. */
/* 手機（< 768px）不固定高度：結果是卡片，整頁自然往下捲比框內捲好用（2026-10-07 mobile first）。 */
@media (min-width: 768px) {
  .screener-page--has-tab {
    height: calc(100vh - var(--app-header-height) - var(--app-banner-height) - 16px - env(safe-area-inset-bottom));
  }
}

@media (min-width: 1280px) {
  .screener-page--has-tab {
    height: calc(100vh - var(--app-header-height) - var(--app-banner-height) - 16px - 20px);
  }
}

.screener-page__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.screener-page__intro {
  margin: -12px 0 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

/* A real <details>: works without JavaScript and by keyboard; the summary is a ≥44px row. */
.screener-page__seo {
  margin-top: -12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

.screener-page__seo-summary {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 16px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
}

.screener-page__seo-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px 16px;
}

.screener-page__seo-heading {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.screener-page__skeleton {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.screener-page__result-heading {
  font-size: 1.125rem;
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

.screener-page__count {
  margin: 0;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.screener-page__period-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
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
  /* Wraps since the 包含/排除 pair landed here 2026-09-20 — label + two buttons + a 240px select
     no longer fit one phone-width line. */
  flex-wrap: wrap;
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
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.screener-page__sector-filter-select {
  min-width: 240px;
  max-width: 100%;
}

/* Element Plus runs at size="small" app-wide at 100% text scale (useTextScale.ts), which leaves
   these two buttons well under the 48px target this app holds itself to. Explicit override, same
   as the stock-page nav's own rows. */
.screener-page__sector-filter-mode :deep(.el-radio-button__inner) {
  min-height: 48px;
  padding-block: 0;
  display: inline-flex;
  align-items: center;
  font-size: 1rem;
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
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.screener-page__guest-banner-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
