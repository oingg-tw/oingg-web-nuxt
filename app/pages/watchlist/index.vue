<script setup lang="ts">
import type { ScreenerResultTableColumn } from '~/components/shared/SharedMetricTable.vue'
import type { WatchlistRow } from '~/composables/watchlist/useWatchlistStocks'
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
// 跟篩選器同一個模型：一份有順序的 {field, label} 清單，全部可以拖、可以移除。field 是型錄 id
// （metricCode.basis）；「漲跌」「下次除權息」是這一頁自己算的假欄位（見 useWatchlistStocks）。
// 預設就是 2026-09 以來那幾欄，加上下次除權息；漲跌金額與幅度合一欄，讓預設維持 7 欄（1920 寬放大 200%
// 還放得下）。殖利率是內建但預設不開的那一欄，用 ＋ 從型錄加回來（dividendYield.EOD）。
const BUILTIN_COLUMNS: ScreenerResultTableColumn[] = [
  { field: 'stock.price', label: '收盤價' },
  { field: WATCHLIST_CHANGE, label: '漲跌' },
  { field: 'exchangePeRatio.EOD', label: '本益比' },
  { field: 'exchangePbRatio.EOD', label: '股價淨值比' },
  { field: WATCHLIST_EX_DIVIDEND, label: '除息／發放' },
  { field: 'dividendYield.EOD', label: '殖利率' }
]
const DEFAULT_FIELDS = BUILTIN_COLUMNS.slice(0, 5).map(column => column.field)
const defaultColumns = () => BUILTIN_COLUMNS.filter(column => DEFAULT_FIELDS.includes(column.field))

// 欄位存在帳號裡（GET／PUT /users/me/watchlist-columns，業務中台 9a2eeff）。存的是整張表、照顯示順序；null ＝
// 從沒存過，用預設。免費方案上限 8 欄（預設 5＋自己的 3），付費無上限，每個方案硬上限 20（使用者 2026-10-06
// 的決定，業務中台 執行）。超過時 PUT 回 quota，這裡把欄位退回上次存的樣子並說明——存檔不先查額度再擋，因為
// 「重排」「刪欄」在降級後也必須能存，那個判斷 業務中台 已經做了（只有清單變長才擋）。只有「新增」在開挑選器前先擋（openPicker）。
const { fetchColumns, saveColumns } = useUserWatchlist()
const currentUser = useCurrentUser()
const serializeColumns = (list: ScreenerResultTableColumn[]) => JSON.stringify(list.map(({ field, label }) => ({ field, label })))
// 內建欄位用程式裡的定義（標籤之後改了也跟得上），自訂欄位照存的
const fromSaved = (saved: { field: string; label: string }[]) =>
  saved.map(item => BUILTIN_COLUMNS.find(column => column.field === item.field) ?? { field: item.field, label: item.label })
// 欄位的副本放在 cookie（2026-10-20，使用者：「然後不要閃動」）：帳號裡那份要等登入還原才讀得到，原本重新整理先畫預設的欄位、讀到才換成
// 自己的；有副本時伺服器的第一個畫面就是自己的欄位。只在這台瀏覽器登入過（auth-hint）時用；讀到帳號裡的那份照樣以它為準
const columnsHint = useCookie<{ field: string; label: string }[] | null>('watchlist-columns-hint', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
const authHint = useCookie<boolean | null>('auth-hint')
const columns = useState<ScreenerResultTableColumn[]>('watchlist-columns', () => (authHint.value && columnsHint.value?.length ? fromSaved(columnsHint.value) : defaultColumns()))
watch(columns, (value) => {
  columnsHint.value = value.map(({ field, label }) => ({ field, label }))
}, { deep: true })
let lastSaved = serializeColumns(columns.value)
let saveTimer: ReturnType<typeof setTimeout> | undefined

async function loadColumns() {
  const saved = await fetchColumns()
  if (saved === undefined) return
  const next = saved === null ? defaultColumns() : fromSaved(saved)
  lastSaved = serializeColumns(next)
  columns.value = next
}

onMounted(() => {
  watch(currentUser, user => { if (user) void loadColumns() }, { immediate: true })
  // 拖、加、刪、重設都只改 columns；停手 600ms 後整份送一次。跟上次存的一樣就不送（含剛載入的那一次）。
  watch(columns, value => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      const serialized = serializeColumns(value)
      if (!currentUser.value || serialized === lastSaved) return
      const result = await saveColumns(JSON.parse(serialized))
      if (result === 'ok') {
        lastSaved = serialized
        return
      }
      columns.value = fromSaved(JSON.parse(lastSaved))
      if (result === 'quota') showQuotaReached('觀察清單欄位')
      else showErrorMessage('欄位設定沒有存到，已回到上次存的樣子')
    }, 600)
  }, { deep: true })
})
// 送去 /screener/values 的型錄欄位（濾掉假欄位與型錄裡已經沒有的，見 watchlistCatalogFields）
const catalogFields = computed(() => watchlistCatalogFields(columns.value, schema.value.categories))

function addColumn(field: string, label: string) {
  if (columns.value.some(column => column.field === field)) {
    ElMessage.info(`「${label}」已經在表格裡`)
    return
  }
  columns.value = [...columns.value, BUILTIN_COLUMNS.find(column => column.field === field) ?? { field, label }]
}
function removeColumn(field: string) {
  columns.value = columns.value.filter(column => column.field !== field)
}
function reorderColumns(fields: string[]) {
  columns.value = fields.map(field => columns.value.find(column => column.field === field)!).filter(Boolean)
}

// 重設預設欄位（2026-10-06「顯示欄位就可以改成重設預設欄位，因為現在欄位可以自由調整」）。取代原本的
// 「顯示欄位」勾選清單：勾選清單只剩「把內建欄位找回來」一個用途，而「漲跌」「下次除權息」不在指標型錄裡、用 ＋ 加不回來，
// 重設就是把它們找回來的路。可以復原，所以不先確認（同移除股票）。
// 欄位的新增、移除、換順序、重設都只在「欄位設定」面板裡（2026-10-17「為什麼新增欄位有兩種方式？」：頁首原本另有「新增欄位」
// 「重設預設欄位」兩顆，跟面板重複，拿掉）。面板在表格與卡片上方，兩種版面都打得開。
const isDefaultColumns = computed(() => columns.value.map(column => column.field).join() === DEFAULT_FIELDS.join())
function resetColumns() {
  const previous = columns.value
  columns.value = defaultColumns()
  undoToast('已重設為預設欄位', () => (columns.value = previous), () => {})
}

const { data: schema } = await useFilterSchema()
// 指標目錄＋「類股」（基本資料裡、市場別後面，同篩選器；2026-10-22 使用者：「要」）。只當欄位用，不需要類股清單
const pickerCategories = computed(() => withSectorCondition(schema.value.categories, []))
// 挑選器是 SharedMetricColumnPicker（2026-10-20 跟 /holdings/columns 的「新增指標」共用）。「新增」在開挑選器之前先擋額度：
// 原本加上去約 0.6 秒後被 PUT 的 403 收回。只擋新增——重排、刪欄在降級後照樣要能存（見 columns 上面的註解）
const pickerVisible = ref(false)
function openPicker() {
  const limit = quotaOf('watchlistColumns')
  if (typeof limit === 'number' && columns.value.length >= limit) {
    showQuotaReached('觀察清單欄位')
    return
  }
  pickerVisible.value = true
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

const { rows, pending, priceDate } = useWatchlistStocks(listCodes, catalogFields)
// 清單、報價到齊才一起畫，之前是轉圈（2026-10-20，使用者：「重新整理的時候會閃動，好像其他畫面也有」）：伺服器不知道是誰，原本先畫
//「還沒有追蹤任何股票」，登入還原、清單讀到後換成只有名稱的表格，報價到了數字才補上——重新整理一次換三種畫面。清單是 app.vue 的
// useWatchlistSync 讀的：synced 在開始讀時就是 true，讀完要看 sync-pending；讀不到時 synced 退回 false，轉圈留在全站彈窗底下等重試
const hasHydrated = useHasHydrated()
const synced = useState('watchlist-synced-from-server', () => false)
const syncPending = useState('watchlist-sync-pending', () => false)
const firstPaintPending = computed(() => !hasHydrated.value || !authResolved.value
  || (currentUser.value ? !synced.value || syncPending.value : guestListLoading.value)
  || (pending.value && !priceDate.value))
// 分享鈕從第一個畫面就在（登入過的瀏覽器）：它在工具列裡，手機上晚出現會多長一行（member 見上面的 useMemberGate）
// 骨架的列數＝上次看到的檔數（useLayoutHint）；0＝上次是空的
const rowCountHint = useLayoutHint('watchlist-rows', 5)
watch(() => (firstPaintPending.value ? null : listCodes.value.length), (count) => {
  if (count !== null) rowCountHint.value = count
})
const skeletonRows = computed<WatchlistRow[]>(() => Array.from({ length: rowCountHint.value }, (_, index) => ({
  code: `skeleton-${index}`, name: '', kind: 'common', values: {}, change: null, changePercent: null, nextDividendEvent: null
})))
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
const columnSettingsOpen = ref(false)
const columnSettingsId = useId()

// 分享連結（2026-10-19，SharedShareButton）：可以一起分享的是表格上現在的欄位；備註原本「只有你自己看得到」，預設不分享
const shareColumns = computed(() => [
  ...columns.value.map(column => ({ key: column.field, label: column.label })),
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
      <WatchlistTable
        v-else
        :loading="firstPaintPending"
        :rows="firstPaintPending ? skeletonRows : rows"
        :columns="columns"
        :notes="watchlistNotes"
        :order-label="isGuest ? '市值順序' : '加入順序'"
        :actions="!isGuest"
        :download-name="activeWatchlist?.name ?? '觀察清單'"
        movable
        @reorder="reorderColumns"
      >
        <template #toolbar>
          <!-- 靠右的一組：分享鈕讀到連結狀態後才出現，放在最左邊，出現時欄位設定不會被推動 -->
          <div class="watchlist-toolbar__end">
            <SharedShareButton
              v-if="member && (firstPaintPending || activeWatchlist)"
              kind="watchlist"
              :target-id="activeWatchlist?.id ?? ''"
              :name="activeWatchlist?.name ?? ''"
              :columns="shareColumns"
              sensitive-heading="只有你看得到的，預設不分享"
            />
            <el-button class="watchlist-toolbar__settings" :aria-expanded="columnSettingsOpen" :aria-controls="columnSettingsId" @click="columnSettingsOpen = !columnSettingsOpen">欄位設定</el-button>
          </div>
        </template>
        <template #settings>
          <SharedColumnSettings
            v-if="columnSettingsOpen"
            :id="columnSettingsId"
            :columns="columns"
            :label-of="column => column.label"
            @reorder="reorderColumns"
            @remove="removeColumn"
            @add="openPicker"
          >
            <button type="button" class="column-settings__button" :disabled="isDefaultColumns" @click="resetColumns">重設預設欄位</button>
          </SharedColumnSettings>
        </template>
        <template #actions="{ row, view, loading }">
          <!-- 卡片上是頁尾的文字鈕（2026-10-22 方案頁 4B）：沒有框，移除只用紅字 -->
          <el-button v-if="loading || watchlistIds[row.code]" :disabled="loading" :link="view === 'table'" :text="view === 'card'" type="primary" :aria-label="`${row.name} 的備註`" @click="openNote(row)">備註</el-button>
          <el-button :link="view === 'table'" :text="view === 'card'" type="danger" :aria-label="`從觀察清單移除 ${row.name}`" :disabled="loading" @click="removeStock(row.code)">移除</el-button>
        </template>
      </WatchlistTable>
    </div>
    <!-- 訪客說明在清單下面（2026-10-18）：要等登入狀態確定才知道該不該顯示，原本放在清單上面，出現時把清單往下推（全站量測手機 0.030）；
         反過來先顯示的話換成登入的人看到它閃一下再被收走。清單下面只剩頁尾，而頁尾一開始就在畫面外，這裡晚出現不推動任何看得到的東西。
         等清單有列了才出現：早一步出現的話，清單長出來時會把它推下去 -->
    <!-- 讀完才出現（firstPaintPending）：伺服器還沒有市值前 10 大的資料，瀏覽器接手時也要一樣不畫（2026-10-21 hydration 不一致） -->
    <p v-if="isGuest && !firstPaintPending && rows.length" class="watchlist-page__guest">
      還沒登入，先列出市值最大的 {{ GUEST_LIST_SIZE }} 家公司（依最新市值排序）。<el-button link type="primary" class="watchlist-page__guest-login" @click="openLogin">登入</el-button>後，這裡就是你自己的觀察清單。
    </p>

    <SharedMetricColumnPicker v-model="pickerVisible" title="新增欄位" :categories="pickerCategories" @select="addColumn" />

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

.watchlist-note-dialog__label {
  display: block;
  margin-bottom: 8px;
}
</style>
