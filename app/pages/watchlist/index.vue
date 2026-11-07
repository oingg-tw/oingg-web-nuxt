<script setup lang="ts">
import type { ColumnDraft } from '~/components/shared/SharedColumnSettings.vue'
import type { WatchlistKind, WatchlistRow } from '~/composables/watchlist/useWatchlistStocks'
import type { RankingPageData } from '#shared/types/hub'
// Personal/settings page (2026-09-19): nothing here is content for a crawler — keep it out of the
// index, and out of the sitemap via nuxt.config's own sitemap.exclude.
useSeoMeta({ title: '觀察清單', robots: 'noindex, nofollow' })

// 2026-10-06 重新設計（「設計觀察清單頁面」，參考 conductor docs/2_knowledge）。使用者在 AskUserQuestion
// 決定：當日漲跌維持預設顯示；除權息欄、移除可復原、備註；ETF 與特別股也收。手動排序 2026-10-08 拿掉，改成依欄位排序。
// 同日：表格比照篩選器——自己加欄位、拖表頭換欄位順序。2026-10-17 表格換成試算表手感的 SharedSheetGrid（使用者選「換成全新
// 試算表元件」，跟篩選器的 SharedMetricTable 分家）：點格子是選取、Enter 或點名稱進個股頁、框選後 Ctrl+C 貼進 Excel。
// 欄位設定面板（SharedColumnSettings）兩邊仍共用。卡片模式（1279px 以下）仍是這一頁自己的。
const { watchlistItems, activeWatchlist, activeWatchlistId, watchlistCodes, watchlistIds, watchlistNotes, addStock, removeStock, saveNote } = useStocks()

// ---- 多組清單（2026-10-19，使用者：「可以有多組 watchlist」）----
// 切換在側欄最下面（WatchlistNav 的 SharedScopeSwitch，兩組以上才有），新增、改名、排序、刪除在「清單管理」頁——同日使用者要觀察清單
//「比照持股那邊的設計辦理」，原本這裡那一列選單（ScreenerPresetSelect）拿掉。正在看的那一組記在網址 ?list=（可以分享給自己的另一台裝置、
// 重新整理還在）。欄位設定所有清單共用一套（使用者的決定）。一組都沒有時，第一次加入時 addStock 先建「我的觀察清單」
const route = useRoute()
const router = useRouter()
// 跟著網址走（2026-10-21）：側欄的每一組是 /watchlist?list=… 的連結，在這一頁點另一組只換參數、頁面不重掛
watch(() => route.query.list, (list) => {
  if (typeof list === 'string') activeWatchlistId.value = list
}, { immediate: true })
watch(() => activeWatchlist.value?.id, (id) => {
  if (id && route.query.list !== id) void router.replace({ query: { ...route.query, list: id } })
})

// ---- 欄位 ----
// 依類別分段，每一段的欄位是那一類篩選的欄位組合（useWatchlistColumns，2026-11-06）：收盤價、漲跌、除息／發放固定在前面，後面是選的那一組；
// 欄位設定、表頭的移動與移除都改那一組，篩選也跟著變。欄位設定所有清單共用一套（使用者的決定）。
const { sources, loaded: columnsLoaded, load: loadColumns, clear: clearColumns, columnsOf, activeIdOf, setItemsOf, select: selectColumnSet, saveFields, categoriesOf, basicColumns } = useWatchlistColumns()
await useFilterSchema()
const currentUser = useCurrentUser()
onMounted(() => {
  watch(currentUser, (user) => {
    if (user) void loadColumns()
    else clearColumns()
  }, { immediate: true })
})
const fieldsByKind = computed(() => ({
  common: columnsOf('common').map(column => column.field),
  etf: columnsOf('etf').map(column => column.field),
  preferred: columnsOf('preferred').map(column => column.field)
}))

// 欄位設定（SharedColumnSettings，篩選共用）：改的是草稿、按「儲存」才換。挑指標的那一頁是那一類的型錄，普通股多一個類股
const settingsKind = ref<WatchlistKind>('common')
const columnSettingsOpen = ref(false)
function openColumnSettings(kind: WatchlistKind) {
  if (!member.value) {
    openLogin('免費註冊或登入後，就能設定觀察清單的欄位。')
    return
  }
  settingsKind.value = kind
  columnSettingsOpen.value = true
}
async function saveColumnSettings(drafts: ColumnDraft[], close: () => void) {
  if (await saveFields(settingsKind.value, drafts.map(draft => draft.field))) close()
}
// 表頭拖曳與表頭的欄位選單（SharedSheetGrid）照樣直接換順序；固定欄不在組合裡
function reorderColumns(kind: WatchlistKind, fields: string[]) {
  void saveFields(kind, fields.filter(field => !WATCHLIST_FIXED_COLUMNS.some(column => column.field === field)))
}
// 表頭的欄位選單「移除這一欄」：馬上拿掉、10 秒內可以復原（全站「可以復原的動作不先確認」）
function removeColumn(kind: WatchlistKind, field: string) {
  const previous = columnsOf(kind)
  void saveFields(kind, previous.map(column => column.field).filter(item => item !== field))
  undoToast(`已移除「${previous.find(column => column.field === field)?.label ?? field}」欄`, () => { void saveFields(kind, previous.map(column => column.field)) }, () => {})
}

// 訪客（確定沒登入）先看市值最大的 10 家（2026-10-16 使用者：「未註冊用戶看到的觀察清單可不可以就選市場上最知名的幾間公司?」，
// 選了「市值前 10 大（自動）」；「2330 一定有」——它的市值是第二名的 9 倍（2026-10-14 收盤的市值排行），依市值一定排第一）。用客觀規則、不人工挑選：跟 /rank 的
// 市值排行同一份資料（伺服器每日快取）。訪客不能編輯這份清單，所以不顯示移除與備註。
// 是不是訪客照 useMemberGate（2026-10-21 修 hydration 不一致）：原本是「authResolved 而且沒登入」，伺服器那時還不知道、畫的是會員的版本
//（有備註／移除欄、排序選單寫「加入順序」），訪客的瀏覽器在 hydration 前就確定沒登入、第一次渲染卻是訪客版本，欄數、表格寬度、選單文字
// 都對不上。現在還不確定時看這台瀏覽器有沒有登入過（auth-hint），伺服器與瀏覽器的第一次渲染一樣；登入過的人也不會先閃這份清單
const { open: openLogin } = useLoginDialog()
const authResolved = useAuthResolved()
const { member } = useMemberGate()
const isGuest = computed(() => !member.value)
const GUEST_LIST_SIZE = 10
const { data: marketCapRanking, status: marketCapStatus, execute: loadMarketCapRanking } = useFetch<RankingPageData>('/api/hub/rank/market-cap', { server: false, lazy: true, immediate: false })
watch(isGuest, guest => { if (guest && !marketCapRanking.value) void loadMarketCapRanking() }, { immediate: true })
const guestListLoading = computed(() => isGuest.value && !marketCapRanking.value && marketCapStatus.value !== 'error')
const listCodes = computed(() => (isGuest.value ? (marketCapRanking.value?.rows ?? []).slice(0, GUEST_LIST_SIZE).map(row => row.symbol) : watchlistCodes.value))

const { rows, pending, priceDate, kindsReady } = useWatchlistStocks(listCodes, fieldsByKind, sources)
// 清單、報價到齊才一起畫，之前是轉圈（2026-10-20，使用者：「重新整理的時候會閃動，好像其他畫面也有」）：伺服器不知道是誰，原本先畫
//「還沒有追蹤任何股票」，登入還原、清單讀到後換成只有名稱的表格，報價到了數字才補上——重新整理一次換三種畫面。清單是 app.vue 的
// useWatchlistSync 讀的：synced 在開始讀時就是 true，讀完要看 sync-pending；讀不到時 synced 退回 false，轉圈留在全站彈窗底下等重試
const hasHydrated = useHasHydrated()
const synced = useState('watchlist-synced-from-server', () => false)
const syncPending = useState('watchlist-sync-pending', () => false)
const firstPaintPending = computed(() => !hasHydrated.value || !authResolved.value
  || (currentUser.value ? !synced.value || syncPending.value || !columnsLoaded.value : guestListLoading.value)
  || (pending.value && !priceDate.value)
  || (listCodes.value.length > 0 && !kindsReady.value))
// 分享鈕從第一個畫面就在（登入過的瀏覽器）：它在工具列裡，手機上晚出現會多長一行（member 見上面的 useMemberGate）
// 骨架的段數與列數＝上次看到的（useLayoutHint）；0＝上次是空的
const rowHints: Record<WatchlistKind, WritableComputedRef<number>> = {
  common: useLayoutHint('watchlist-rows', 5),
  etf: useLayoutHint('watchlist-rows-etf', 0),
  preferred: useLayoutHint('watchlist-rows-preferred', 0)
}
const rowCountHint = computed(() => WATCHLIST_KINDS.reduce((total, kind) => total + rowHints[kind].value, 0))
// 有備註的列多一行，高 8px：骨架沒有的話，資料到了下面一段被推下去（2026-11-07，/watchlist 位移 0.019）。畫在哪幾列不重要，總高度對就好
const noteHints: Record<WatchlistKind, WritableComputedRef<number>> = {
  common: useLayoutHint('watchlist-notes', 0),
  etf: useLayoutHint('watchlist-notes-etf', 0),
  preferred: useLayoutHint('watchlist-notes-preferred', 0)
}
watch(() => (firstPaintPending.value ? null : rows.value), (list) => {
  if (!list) return
  for (const kind of WATCHLIST_KINDS) {
    const ofKind = list.filter(row => row.kind === kind)
    rowHints[kind].value = ofKind.length
    noteHints[kind].value = ofKind.filter(row => watchlistNotes.value[row.code]).length
  }
})
// 骨架列的代號要跟真的一樣短：表格拿它估欄寬（原本 skeleton-common-0，第一欄撐到 194px，資料到了整張表左移 118px，2026-11-07）
const skeletonCode = (kind: WatchlistKind, index: number) => `${kind[0]}${index}`
const skeletonNotes = computed<Record<string, string>>(() => Object.fromEntries(WATCHLIST_KINDS.flatMap(kind => Array.from({ length: noteHints[kind].value }, (_, index) => [skeletonCode(kind, index), '為什麼想追蹤這一檔']))))
const skeletonRowsOf = (kind: WatchlistKind) => Array.from({ length: rowHints[kind].value }, (_, index): WatchlistRow => ({
  code: skeletonCode(kind, index), name: '', kind, values: {}, change: null, changePercent: null, nextDividendEvent: null
}))
// 只有這一類有列才有這一段；只有一段時不寫標題，就是一張表
const sections = computed(() => WATCHLIST_KINDS.flatMap((kind) => {
  const sectionRows = firstPaintPending.value ? skeletonRowsOf(kind) : rows.value.filter(row => row.kind === kind)
  return sectionRows.length ? [{ kind, label: WATCHLIST_KIND_LABELS[kind], rows: sectionRows, columns: [...WATCHLIST_FIXED_COLUMNS, ...columnsOf(kind)] }] : []
}))
const { keyword, fetchSuggestions, firstMatch } = useStockSearch()
// el-autocomplete 在沒有反白項目時把 aria-activedescendant 指到不存在的 "…-item--1"（axe critical），同頁首搜尋的處理
const addInputRef = ref<{ $el?: Node, close?: () => void } | null>(null)
useAutocompleteActiveDescendantFix(addInputRef)


// 這一頁自己要能加股票（2026-09-28）。加在頁首而不是只放進空狀態，是因為連續加好幾檔是這一頁最常見的
// 動作，塞進空狀態的話第一檔加完它就消失了。三種都收（2026-10-06 起；之前只收普通股）。
function handleSelect(item: Record<string, unknown>) {
  const code = String(item.code ?? '')
  if (!code || code === '__no_match__') return
  addStock(code)
  keyword.value = ''
}

// 直接按 Enter：跟頁首搜尋一樣帶入第一個吻合的選項，省下點選。焦點留在輸入框（連續加好幾檔是常態），
// 所以不 blur，改關掉下拉——清掉 keyword 不會讓 el-autocomplete 自己收起建議清單。
function handleAddEnter() {
  const match = firstMatch()
  if (!match) return
  addStock(match.code)
  keyword.value = ''
  addInputRef.value?.close?.()
}

// 清單滿了先說（2026-10-06「完善付費方案」）：不停用輸入框——重複加入、降級後的重排都還要能動，真的擋
// 由 業務中台 的 403 負責；這裡只是讓人在按下去之前就知道。
const { quotaOf } = useEntitlement()
const watchlistLimit = computed(() => quotaOf('watchlistItems'))
// 檔數算所有清單的總列數（同一檔在兩組算 2）
const watchlistFull = computed(() => typeof watchlistLimit.value === 'number' && watchlistItems.value.length >= watchlistLimit.value)

// 表格與卡片怎麼畫在 WatchlistTable（2026-10-19 抽出來，分享頁 /share/[token] 也用）；這一頁留資料、欄位設定、備註與移除。
// 操作欄（備註、移除）只有登入後才有

// 分享連結（2026-10-19，SharedShareButton）：可以一起分享的是表格上現在的欄位；備註原本「只有你自己看得到」，預設不分享。
// 多段時欄名前面寫類別：普通股與特別股都有「殖利率」，勾選時要分得開（分享頁的表頭照型錄，看不到這個前綴）
const shareColumns = computed(() => [
  ...WATCHLIST_FIXED_COLUMNS.map(column => ({ key: column.field, label: column.label })),
  ...sections.value.flatMap(({ kind, label }) => columnsOf(kind).map(column => ({ key: column.field, label: sections.value.length > 1 ? `${label}・${column.label}` : column.label }))),
  { key: 'note', label: '備註', sensitive: true }
])

// 收盤日放在標題的檔數後面，不放表頭：「收盤價（10/05）」會讓那一欄的表頭折成兩行。
const priceDateText = computed(() => (priceDate.value ? `${priceDate.value.slice(5).replace('-', '/')} 收盤` : null))

// ---- 備註 ----
const noteTarget = ref<WatchlistRow | null>(null)
const noteDraft = ref('')
const noteSaving = ref(false)
// 200 是 業務中台 的上限（f39f811，POST 與 PATCH 都是；zod 數 UTF-16 code unit，跟 maxlength 同一個單位）。
const NOTE_MAX = 200
function openNote(row: WatchlistRow) {
  noteTarget.value = row
  noteDraft.value = watchlistNotes.value[row.code] ?? ''
}
async function submitNote() {
  if (!noteTarget.value) return
  noteSaving.value = true
  const saved = await saveNote(noteTarget.value.code, noteDraft.value)
  noteSaving.value = false
  if (!saved) {
    showErrorMessage('備註沒有存到，請稍後再試；你打的字還在')
    return
  }
  noteTarget.value = null
}
</script>

<template>
  <div class="watchlist-page">
    <h1 class="app-page__title watchlist-page__title">
      觀察清單
      <!-- 檔數跟在標題後面：這一頁沒有其他地方說得出「我追蹤了幾檔」，而那是使用者回到這一頁時
           第一個想知道的事。沒有任何一檔時不顯示，免得空狀態旁邊掛一個「共 0 檔」。 -->
      <span v-if="firstPaintPending ? rowCountHint : listCodes.length" class="watchlist-page__count">
        <span v-if="firstPaintPending" class="app-skeleton app-skeleton--flow" aria-hidden="true">共 {{ rowCountHint }} 檔・10/20 收盤</span>
        <template v-else>共 {{ listCodes.length }} 檔<template v-if="priceDateText">・{{ priceDateText }}</template></template>
      </span>
    </h1>

    <WatchlistNav />

    <el-autocomplete
      ref="addInputRef"
      v-model="keyword"
      :fetch-suggestions="fetchSuggestions"
      class="watchlist-page__add"
      placeholder="輸入代號或名稱，加入股票、ETF"
      aria-label="加入到觀察清單"
      clearable
      @select="handleSelect"
      @keyup.enter="handleAddEnter"
    >
      <template #default="{ item }">
        <span>{{ item.code }}</span>
        <span class="watchlist-page__add-name">{{ item.name }}</span>
      </template>
    </el-autocomplete>

    <p v-if="watchlistFull" class="watchlist-page__quota" role="status">
      目前方案最多 {{ watchlistLimit }} 檔，已經滿了。可以移除不需要的，或之後升級專業版。<NuxtLink to="/profile#plan">看方案</NuxtLink>
    </p>

    <!-- 讀的時候表頭、卡片的欄名照畫，列是骨架、列數照上次（2026-10-20）；上次是空的就直接是空狀態 -->
    <div class="watchlist-page__content" :aria-busy="firstPaintPending">
      <el-empty v-if="firstPaintPending ? !rowCountHint : !listCodes.length" description="還沒有追蹤任何股票，用上面的搜尋框加入第一檔" :image-size="64" />
      <template v-else>
        <section v-for="(section, index) in sections" :key="section.kind" class="watchlist-section" :aria-label="section.label">
          <WatchlistTable
            :loading="firstPaintPending"
            :rows="section.rows"
            :columns="section.columns"
            :label="sections.length > 1 ? `${section.label}的觀察清單` : '觀察清單'"
            :storage-key="`watchlist-${section.kind}`"
            :notes="firstPaintPending ? skeletonNotes : watchlistNotes"
            :order-label="isGuest ? '市值順序' : '加入順序'"
            :actions="!isGuest"
            :movable="member"
            @reorder="fields => reorderColumns(section.kind, fields)"
            @remove-column="field => removeColumn(section.kind, field)"
          >
            <template #toolbar>
              <h2 v-if="sections.length > 1" class="watchlist-section__title">{{ section.label }}<span class="watchlist-section__count">{{ section.rows.length }} 檔</span></h2>
              <!-- 靠右的一組：分享鈕讀到連結狀態後才出現，放在最左邊，出現時後面不會被推動。分享的是整份清單，只放在第一段 -->
              <div class="watchlist-toolbar__end">
                <SharedShareButton
                  v-if="index === 0 && member && (firstPaintPending || activeWatchlist)"
                  kind="watchlist"
                  :target-id="activeWatchlist?.id ?? ''"
                  :name="activeWatchlist?.name ?? ''"
                  :columns="shareColumns"
                  sensitive-heading="只有你看得到的，預設不分享"
                />
                <ScreenerPresetSelect
                  v-if="member"
                  pick-only
                  label="顯示欄位"
                  :items="setItemsOf(section.kind)"
                  :active-id="activeIdOf(section.kind)"
                  @update:active-id="id => selectColumnSet(section.kind, id)"
                />
                <el-button class="watchlist-toolbar__settings" :aria-label="sections.length > 1 ? `${section.label}的欄位設定` : '欄位設定'" @click="openColumnSettings(section.kind)">欄位設定</el-button>
                <NuxtLink v-if="member" :to="SCREENER_PATHS[section.kind]" class="watchlist-toolbar__manage">到{{ section.label }}篩選管理</NuxtLink>
              </div>
            </template>
            <template #actions="{ row, view, loading }">
              <!-- 卡片上是頁尾的文字鈕（2026-10-22 方案頁 4B）：沒有框，移除只用紅字 -->
              <el-button v-if="loading || watchlistIds[row.code]" :disabled="loading" :link="view === 'table'" :text="view === 'card'" type="primary" :aria-label="`${row.name} 的備註`" @click="openNote(row)">備註</el-button>
              <el-button :link="view === 'table'" :text="view === 'card'" type="danger" :aria-label="`從觀察清單移除 ${row.name}`" :disabled="loading" @click="removeStock(row.code)">移除</el-button>
            </template>
          </WatchlistTable>
        </section>
      </template>
    </div>
    <!-- 訪客說明在清單下面（2026-10-18）：要等登入狀態確定才知道該不該顯示，原本放在清單上面，出現時把清單往下推（全站量測手機 0.030）；
         反過來先顯示的話換成登入的人看到它閃一下再被收走。清單下面只剩頁尾，而頁尾一開始就在畫面外，這裡晚出現不推動任何看得到的東西。
         等清單有列了才出現：早一步出現的話，清單長出來時會把它推下去 -->
    <!-- 讀完才出現（firstPaintPending）：伺服器還沒有市值前 10 大的資料，瀏覽器接手時也要一樣不畫（2026-10-21 hydration 不一致） -->
    <p v-if="isGuest && !firstPaintPending && rows.length" class="watchlist-page__guest">
      還沒登入，先列出市值最大的 {{ GUEST_LIST_SIZE }} 家公司（依最新市值排序）。<el-button link type="primary" class="watchlist-page__guest-login" @click="openLogin">登入</el-button>後，這裡就是你自己的觀察清單。
    </p>

    <SharedColumnSettings
      v-model:open="columnSettingsOpen"
      :columns="columnsOf(settingsKind)"
      :label-of="column => column.label"
      :categories="categoriesOf(settingsKind)"
      :defaults="basicColumns(settingsKind).map(({ field, label }) => ({ field, label }))"
      @save="saveColumnSettings"
    />

    <el-dialog :model-value="noteTarget !== null" :title="noteTarget ? `${noteTarget.name} 的備註` : '備註'" width="min(480px, 92vw)" @close="noteTarget = null">
      <label for="watchlist-note-input" class="watchlist-note-dialog__label">為什麼想追蹤這一檔？只有你自己看得到。</label>
      <el-input id="watchlist-note-input" v-model="noteDraft" type="textarea" :rows="4" :maxlength="NOTE_MAX" show-word-limit />
      <template #footer>
        <el-button @click="noteTarget = null">取消</el-button>
        <el-button type="primary" :loading="noteSaving" @click="submitNote">儲存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.watchlist-page__title {
  margin-bottom: 16px;
}

.watchlist-page__count {
  margin-left: 8px;
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-regular);
}

/* :deep 從外層打進去：el-autocomplete 的根是 tooltip 觸發器，scoped 的 data-v 屬性落不到它身上，
   直接寫 .watchlist-page__add 的話 max-width 與高度都不生效（2026-10-06 量到寬 1145px、高 24px）。
   class 會同時落在外框與裡面的 .el-input 上，所以 display: block 只能寫給外框——寫到 .el-input 會拆掉它的
   inline-flex，輸入框只依內容長到 231px、提示文字被截掉（同日量到）。 */
.watchlist-page :deep(.el-autocomplete.watchlist-page__add) {
  display: block;
  width: 100%;
  max-width: 480px;
  margin-bottom: 16px;
}

.watchlist-page :deep(.watchlist-page__add .el-input) {
  width: 100%;
}

.watchlist-page :deep(.watchlist-page__add .el-input__wrapper) {
  min-height: 44px;
}

.watchlist-page__add-name {
  margin-left: 8px;
  color: var(--el-text-color-regular);
}

.watchlist-page__quota,
.watchlist-page__guest {
  margin: 16px 0 0;
  color: var(--el-text-color-regular);
}
/* 句中的「登入」：el-button 預設的左右邊距與高度會把句子撐開 */
.watchlist-page__guest-login {
  height: auto;
  padding: 0;
  font-size: inherit;
  vertical-align: baseline;
}


/* 工具列（WatchlistTable 的 #toolbar）靠右的一組：表格模式這一列只有它；卡片模式排序選單在左。這一層不產生自己的框
   （display: contents），靠右由第一顆的 margin-left: auto 做：分享鈕晚出現時，一個會往左長的外框本身就會被算成版面位移
  （2026-10-19 量到 0.0005，欄位設定其實沒動） */
.watchlist-toolbar__end {
  display: contents;
}

.watchlist-toolbar__end > :first-child {
  margin-left: auto;
}

.watchlist-toolbar__settings {
  min-height: 44px;
}

.watchlist-toolbar__manage {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--el-color-primary-dark-2);
}

.watchlist-page__content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* 分段標題跟工具列同一列 */
.watchlist-section__title {
  order: -1;
  align-self: center;
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.watchlist-section__count {
  margin-left: 8px;
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-regular);
}

.watchlist-note-dialog__label {
  display: block;
  margin-bottom: 8px;
}

/* 卡片版面（同 WatchlistTable 的切換點）：標題一行，選單與按鈕一行，選單吃掉剩下的寬度。寬度固定，分享鈕晚出現也不算位移 */
@media (max-width: 1279px) {
  .watchlist-section__title {
    flex-basis: 100%;
  }

  .watchlist-toolbar__end {
    display: flex;
    flex: 1 1 100%;
    align-items: flex-end;
    gap: 8px 12px;
  }

  .watchlist-toolbar__end > :first-child {
    margin-left: 0;
  }

  .watchlist-toolbar__end > :deep(.screener-preset-select) {
    flex: 1;
    min-width: 0;
  }
}

/* 手機放不下：組合的管理在篩選頁，從選單也走得到 */
@media (max-width: 767px) {
  .watchlist-toolbar__manage {
    display: none;
  }
}
</style>
