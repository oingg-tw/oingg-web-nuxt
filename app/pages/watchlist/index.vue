<script setup lang="ts">
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
const { sources, loaded: columnsLoaded, load: loadColumns, clear: clearColumns, columnsOf, activeIdOf, setItemsOf, select: selectColumnSet, saveFields, categoriesOf, basicColumns, linksOf } = useWatchlistColumns()
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

// 欄位設定、表頭選單的移動與移除（10 秒復原）、拖曳都在表格裡（SharedMetricTable，同篩選），存的是這一類的欄位組合（saveFields）。
// 訪客沒有組合：工具列放一顆「欄位設定」，按了是登入
const openGuestColumnSettings = () => openLogin('免費註冊或登入後，就能設定觀察清單的欄位。')

// 每一類的「欄位」選單（2026-11-07 改版方案 A）：每一類原本一排工具——顯示欄位、欄位設定、到篩選管理，手機還有排序——收成一顆，寫著現在用哪一組。
// 2026-11-11 表格換成篩選的結果表：欄位設定回到表格自己的按鈕（電腦版「欄位設定」、卡片版面「欄位 N 個」），排序也在表頭選單與卡片的排序列，選單只剩組合與到篩選管理。
// 選單本身是 SharedColumnSetMenu（2026-11-14 抽出來，持股總覽也用）

// 備註與移除收進「編輯」（2026-11-07 方案 A）：原本每一列都有紅字「移除」，最危險的動作最搶眼；平常點名稱就進個股頁
const editing = ref(false)

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
// 分享與編輯從第一個畫面就在頁首（登入過的瀏覽器，member 見上面的 useMemberGate）：晚出現的話標題要讓位，手機上會折行
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

// 表格怎麼畫在 WatchlistTable（篩選的結果表，分享頁 /share/[token] 也用）；這一頁留資料、欄位組合、備註與移除。
// 操作欄（備註、移除）登入後按「編輯」才有

// 分享連結（2026-10-19，SharedShareButton）：可以一起分享的是表格上現在的欄位；備註原本「只有你自己看得到」，預設不分享。
// 多段時欄名前面寫類別：普通股與特別股都有「殖利率」，勾選時要分得開（分享頁的表頭照型錄，看不到這個前綴）
const shareColumns = computed(() => [
  ...WATCHLIST_FIXED_COLUMNS.map(column => ({ key: column.field, label: column.label })),
  ...sections.value.flatMap(({ kind, label }) => columnsOf(kind).map(column => ({ key: column.field, label: sections.value.length > 1 ? `${label}・${column.label}` : column.label }))),
  { key: 'note', label: '備註', sensitive: true }
])

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
    <!-- 頁首：標題在左，整份清單的動作（分享、編輯）在右（2026-11-07 方案 A：分享原本在第一段的工具列裡） -->
    <div class="watchlist-page__head">
      <h1 class="app-page__title watchlist-page__title">
        <span class="watchlist-page__name">觀察清單</span>
        <!-- 檔數跟在標題後面：這一頁沒有其他地方說得出「我追蹤了幾檔」，而那是使用者回到這一頁時
             第一個想知道的事。沒有任何一檔時不顯示，免得空狀態旁邊掛一個「共 0 檔」。收盤日在下面「漲跌」那一塊的標題 -->
        <span v-if="firstPaintPending ? rowCountHint : listCodes.length" class="watchlist-page__count">
          <span v-if="firstPaintPending" class="app-skeleton app-skeleton--flow" aria-hidden="true">共 {{ rowCountHint }} 檔</span>
          <template v-else>共 {{ listCodes.length }} 檔</template>
        </span>
      </h1>
      <!-- 分享鈕讀到連結狀態後才出現，放在左邊：靠右的編輯不會被推動 -->
      <div v-if="member && (firstPaintPending ? rowCountHint : listCodes.length)" class="watchlist-page__actions">
        <SharedShareButton
          v-if="firstPaintPending || activeWatchlist"
          kind="watchlist"
          :target-id="activeWatchlist?.id ?? ''"
          :name="activeWatchlist?.name ?? ''"
          :columns="shareColumns"
          sensitive-heading="只有你看得到的，預設不分享"
        />
        <el-button class="watchlist-page__edit" :type="editing ? 'primary' : undefined" :disabled="firstPaintPending" @click="editing = !editing">{{ editing ? '完成' : '編輯' }}</el-button>
      </div>
    </div>

    <WatchlistNav />

    <el-autocomplete
      ref="addInputRef"
      v-model="keyword"
      :fetch-suggestions="fetchSuggestions"
      class="watchlist-page__add"
      placeholder="代號或名稱，加入股票、ETF"
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
        <section v-for="section in sections" :key="section.kind" class="watchlist-section" :aria-label="section.label">
          <WatchlistTable
            :rows="section.rows"
            :columns="section.columns"
            :categories="categoriesOf(section.kind)"
            :links="linksOf(section.kind)"
            :layout-key="`watchlist-${section.kind}`"
            :label="sections.length > 1 ? `${section.label}的觀察清單` : '觀察清單'"
            :notes="firstPaintPending ? skeletonNotes : watchlistNotes"
            :editable="member"
            :column-defaults="basicColumns(section.kind).map(({ field, label }) => ({ field, label }))"
            :skeleton="firstPaintPending"
            :save="fields => saveFields(section.kind, fields)"
          >
            <template #toolbar>
              <h2 v-if="sections.length > 1" class="watchlist-section__title">{{ section.label }}<span class="watchlist-section__count">{{ section.rows.length }} 檔</span></h2>
              <SharedColumnSetMenu
                v-if="member"
                :id="`watchlist-columns-${section.kind}`"
                class="watchlist-columns"
                :items="setItemsOf(section.kind)"
                :active-id="activeIdOf(section.kind)"
                :kind-label="sections.length > 1 ? section.label : undefined"
                :screener-path="SCREENER_PATHS[section.kind]"
                :screener-label="section.label"
                @select="id => selectColumnSet(section.kind, id)"
              />
              <!-- 訪客沒有欄位組合，按了是登入 -->
              <el-button v-else class="watchlist-toolbar__settings" :aria-label="sections.length > 1 ? `${section.label}的欄位設定` : '欄位設定'" @click="openGuestColumnSettings">欄位設定</el-button>
            </template>
            <!-- 備註與移除收在「編輯」（2026-11-07 方案 A）：按了才有操作欄 -->
            <template v-if="member && editing" #actions="{ row }">
              <el-button v-if="watchlistIds[row.code]" link type="primary" :aria-label="`${row.name} 的備註`" @click="openNote(row)">備註</el-button>
              <el-button link type="danger" :aria-label="`從觀察清單移除 ${row.name}`" @click="removeStock(row.code)">移除</el-button>
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
/* 標題吃掉剩下的寬，動作靠右：分享鈕從骨架換成按鈕時，靠右的編輯不動。320 寬放不下「觀察清單」與兩顆按鈕時，按鈕換到下一行 */
.watchlist-page__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 16px;
}

.watchlist-page__title {
  flex: 1 1 auto;
  margin: 0;
}

.watchlist-page__name,
.watchlist-page__count {
  white-space: nowrap;
}

.watchlist-page__count {
  margin-left: 8px;
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-regular);
}

.watchlist-page__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.watchlist-page__actions :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}

/* 手機：檔數換到標題下一行，動作留在標題右邊 */
@media (max-width: 639px) {
  .watchlist-page__count {
    display: block;
    margin: 4px 0 0;
  }
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


.watchlist-page__content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* 分段標題跟工具列同一列 */
.watchlist-section__title {
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

/* 每一類的「欄位」選單（SharedColumnSetMenu）靠右 */
.watchlist-columns {
  margin-left: auto;
}

/* 按鈕高照全站（滑鼠 32px、觸控 44px），跟同一列表格的「欄位設定」一樣高，同篩選的「顯示欄位」（2026-11-11 換成篩選的結果表） */
.watchlist-toolbar__settings {
  margin-left: auto;
}

.watchlist-note-dialog__label {
  display: block;
  margin-bottom: 8px;
}
</style>
