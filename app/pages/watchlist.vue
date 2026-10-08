<script setup lang="ts">
import { Plus, RefreshLeft } from '@element-plus/icons-vue'
import type { ScreenerResultRow } from '~/composables/screener/useFilterSearch'
import type { ScreenerResultTableColumn } from '~/components/shared/SharedMetricTable.vue'
import type { WatchlistRow } from '~/composables/watchlist/useWatchlistStocks'
// Personal/settings page (2026-09-19): nothing here is content for a crawler — keep it out of the
// index, and out of the sitemap via nuxt.config's own sitemap.exclude.
useSeoMeta({ title: '觀察清單', robots: 'noindex, nofollow' })

// 2026-10-06 重新設計（「設計觀察清單頁面」，參考 conductor docs/2_knowledge）。使用者在 AskUserQuestion
// 決定：當日漲跌維持預設顯示；除權息欄、移除可復原、備註、自訂排序；ETF 與特別股也收。
// 同日：表格比照篩選器——自己加欄位、拖表頭換欄位順序，而且**跟篩選器共用同一個表格元件**
// （SharedMetricTable，原本的 SharedMetricTable）。卡片模式（1279px 以下）仍是這一頁自己的。
const { watchlistCodes, watchlistIds, watchlistNotes, addStock, removeStock, moveStock, saveNote } = useStocks()

// ---- 欄位 ----
// 跟篩選器同一個模型：一份有順序的 {field, label} 清單，全部可以拖、可以移除。field 是型錄 id
// （metricCode.basis）；「漲跌」「下次除權息」是這一頁自己算的假欄位（見 useWatchlistStocks）。
// 預設就是 2026-09 以來那幾欄，加上下次除權息；漲跌金額與幅度合一欄，讓預設維持 7 欄（1920 寬放大 200%
// 還放得下）。殖利率是內建但預設不開的那一欄，用 ＋ 從型錄加回來（dividendYield.EOD）。
const BUILTIN_COLUMNS: ScreenerResultTableColumn[] = [
  { field: 'stock.price', label: '收盤價' },
  { field: WATCHLIST_CHANGE, label: '漲跌', minWidth: 140 },
  { field: 'exchangePeRatio.EOD', label: '本益比' },
  { field: 'exchangePbRatio.EOD', label: '股價淨值比' },
  { field: WATCHLIST_EX_DIVIDEND, label: '除息／發放', minWidth: 160 },
  { field: 'dividendYield.EOD', label: '殖利率' }
]
const DEFAULT_FIELDS = BUILTIN_COLUMNS.slice(0, 5).map(column => column.field)
const defaultColumns = () => BUILTIN_COLUMNS.filter(column => DEFAULT_FIELDS.includes(column.field))

// 欄位存在帳號裡（GET／PUT /users/me/watchlist-columns，bff-ts 9a2eeff）。存的是整張表、照顯示順序；null ＝
// 從沒存過，用預設。免費方案上限 8 欄（預設 5＋自己的 3），付費無上限，每個方案硬上限 20（使用者 2026-10-06
// 的決定，bff-ts 執行）。超過時 PUT 回 quota，這裡把欄位退回上次存的樣子並說明——不先查額度再擋，因為
// 「重排」「刪欄」在降級後也必須能存，那個判斷 bff-ts 已經做了（只有清單變長才擋）。
const columns = useState<ScreenerResultTableColumn[]>('watchlist-columns', () => defaultColumns())
const { fetchColumns, saveColumns } = useUserWatchlist()
const currentUser = useCurrentUser()
const serializeColumns = (list: ScreenerResultTableColumn[]) => JSON.stringify(list.map(({ field, label }) => ({ field, label })))
// 內建欄位用程式裡的定義（minWidth 之後改了也跟得上），自訂欄位照存的
const fromSaved = (saved: { field: string; label: string }[]) =>
  saved.map(item => BUILTIN_COLUMNS.find(column => column.field === item.field) ?? { field: item.field, label: item.label })
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
// 送去 /screener/values 的型錄欄位。型錄裡已經不存在的欄位（指標改名，bff-ts 提醒存的是 JSON、不跟型錄連動）
// 先濾掉：一個未知欄位會讓整個請求 400、整張表都沒有數字。那一欄照樣顯示，值是空的。
const catalogFields = computed(() =>
  columns.value
    .map(column => column.field)
    .filter(field => !field.startsWith('watchlist.'))
    .filter(field => field.startsWith('stock.') || !schema.value.categories.length || !!locateFieldInSchema(schema.value.categories, field))
)

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
// 「顯示欄位」勾選清單：欄位已經能拖、能 ✕、能 ＋，勾選清單只剩「把內建欄位找回來」一個用途，而「漲跌」
// 「下次除權息」不在指標型錄裡、用 ＋ 加不回來，重設就是把它們找回來的路。卡片模式（沒有表頭）也靠它清掉
// 自訂欄位。可以復原，所以不先確認（同移除股票）。
const isDefaultColumns = computed(() => columns.value.map(column => column.field).join() === DEFAULT_FIELDS.join())
function resetColumns() {
  const previous = columns.value
  columns.value = defaultColumns()
  undoToast('已重設為預設欄位', () => (columns.value = previous), () => {})
}

const { data: schema } = await useFilterSchema()
const pickerVisible = ref(false)
const pickerTriggerEl = ref<HTMLElement | null>(null)
function openPicker(triggerEl: HTMLElement) {
  pickerTriggerEl.value = triggerEl
  pickerVisible.value = true
}

const { rows, pending, priceDate } = useWatchlistStocks(watchlistCodes, catalogFields)
const { keyword, fetchSuggestions, firstMatch, routeFor } = useStockSearch()
// el-autocomplete 在沒有反白項目時把 aria-activedescendant 指到不存在的 "…-item--1"（axe critical），同頁首搜尋的處理
const addInputRef = ref<{ $el?: Node, close?: () => void } | null>(null)
useAutocompleteActiveDescendantFix(addInputRef)

// 共用表格吃篩選器的列形狀（symbol／name／values）
const tableRows = computed<ScreenerResultRow[]>(() => rows.value.map(row => ({ symbol: row.code, name: row.name, values: row.values })))
const rowByCode = computed(() => new Map(rows.value.map(row => [row.code, row])))
const rowOf = (symbol: string) => rowByCode.value.get(symbol)!

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
// 由 bff-ts 的 403 負責；這裡只是讓人在按下去之前就知道。
const { quotaOf } = useEntitlement()
const watchlistLimit = computed(() => quotaOf('watchlistItems'))
const watchlistFull = computed(() => typeof watchlistLimit.value === 'number' && watchlistCodes.value.length >= watchlistLimit.value)

const KIND_TAG = { etf: 'ETF', preferred: '特別股', common: null } as const
const linkOf = (row: WatchlistRow) => routeFor({ code: row.code, name: row.name, kind: row.kind })

const changeText = (row: WatchlistRow) =>
  row.change === null || row.changePercent === null
    ? '—'
    : `${row.change > 0 ? '+' : ''}${row.change.toFixed(2)} (${row.changePercent > 0 ? '+' : ''}${row.changePercent.toFixed(2)}%)`
const EX_LABEL = { 息: '除息', 權: '除權', 權息: '除權息' } as const
// 「除息／發放」：還沒除息的寫除息日，已除息、還沒發放的寫發放日（2026-10-06 上游補上 realized 那幾筆之後
// 才寫得出來）——除息日與發放日分開標，現金大約在除息後 3～4 週才入帳（conductor 知識庫「配息月曆結算時序」）。
// 金額最多四位小數：上游的浮點數會帶雜訊（2330 回 7.00000137，MOPS 原值未四捨五入）。
const exDividendText = (row: WatchlistRow) => {
  const event = row.nextDividendEvent
  if (!event) return '—'
  const date = event.date.slice(5).replace('-', '/')
  const label = event.kind === 'pay' ? '發放' : EX_LABEL[event.exType] ?? event.exType
  return `${date} ${label}${event.amount !== null ? ` ${Number(event.amount.toFixed(4))} 元` : ''}`
}
// 卡片用：同一套格式化（型錄欄位走 formatScreenerValue，跟表格一致）
function cellText(row: WatchlistRow, field: string): string {
  if (field === WATCHLIST_CHANGE) return changeText(row)
  if (field === WATCHLIST_EX_DIVIDEND) return exDividendText(row)
  return formatScreenerValue(row.values[field]?.value, locateFieldInSchema(schema.value.categories, field)?.field.unit, field)
}
// 收盤日放在標題的檔數後面，不放表頭：「收盤價（10/05）」會讓那一欄的表頭折成兩行。
const priceDateText = computed(() => (priceDate.value ? `${priceDate.value.slice(5).replace('-', '/')} 收盤` : null))

// ---- 調整順序（股票的順序；欄位的順序是拖表頭）----
// 上移／下移按鈕而不是拖曳（同 /stock/{code}/metrics 的釘選排序）：鍵盤與觸控不用另做一套。調整順序時
// 表頭排序暫停（sortDisabled）——表頭排過的畫面順序跟清單本身的順序不同，上下移會看起來移錯位置。
const ordering = ref(false)
const orderAnnouncement = ref('')
async function moveRow(row: WatchlistRow, offset: -1 | 1, view: 'table' | 'card') {
  moveStock(row.code, offset)
  const position = watchlistCodes.value.indexOf(row.code)
  orderAnnouncement.value = `${row.name} 移到第 ${position + 1} 個`
  await nextTick()
  // 焦點留在同一顆鈕；移到頭／尾時那一顆會 disabled，改落到同一列的另一顆
  const atEdge = offset < 0 ? position === 0 : position === watchlistCodes.value.length - 1
  const moved = offset < 0 ? 'up' : 'down'
  const direction = atEdge ? (moved === 'up' ? 'down' : 'up') : moved
  document.getElementById(`${view}-move-${direction}-${row.code}`)?.focus()
}

// ---- 備註 ----
const noteTarget = ref<WatchlistRow | null>(null)
const noteDraft = ref('')
const noteSaving = ref(false)
// 200 是 bff-ts 的上限（f39f811，POST 與 PATCH 都是；zod 數 UTF-16 code unit，跟 maxlength 同一個單位）。
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
    <div class="watchlist-page__header">
      <h1 class="app-page__title watchlist-page__title">
        觀察清單
        <!-- 檔數跟在標題後面：這一頁沒有其他地方說得出「我追蹤了幾檔」，而那是使用者回到這一頁時
             第一個想知道的事。沒有任何一檔時不顯示，免得空狀態旁邊掛一個「共 0 檔」。 -->
        <span v-if="watchlistCodes.length" class="watchlist-page__count">共 {{ watchlistCodes.length }} 檔<template v-if="priceDateText">・{{ priceDateText }}</template></span>
      </h1>
      <div class="watchlist-page__actions">
        <el-button v-if="watchlistCodes.length > 1" :type="ordering ? 'primary' : 'default'" :aria-pressed="ordering" @click="ordering = !ordering">
          {{ ordering ? '完成排序' : '調整順序' }}
        </el-button>
        <el-button :icon="RefreshLeft" :disabled="isDefaultColumns" @click="resetColumns">重設預設欄位</el-button>
        <el-button :icon="Plus" @click="openPicker($event.currentTarget as HTMLElement)">新增欄位</el-button>
      </div>
    </div>

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
    <p class="visually-hidden" aria-live="polite">{{ orderAnnouncement }}</p>

    <div v-loading="pending && !rows.length" class="watchlist-page__content">
      <el-empty v-if="!watchlistCodes.length" description="還沒有追蹤任何股票，用上面的搜尋框加入第一檔" :image-size="64" />
      <template v-else>
        <SharedMetricTable
          :cards="false"
          class="view-table"
          :rows="tableRows"
          :columns="columns"
          :categories="schema.categories"
          sort-mode="client"
          :sort-disabled="ordering"
          :fill-height="false"
          :paginated="false"
          follow-column-order
          :show-period="true"
          :cell-dates="false"
          :name-width="190"
          :actions-label="ordering ? '順序' : '操作'"
          @reorder="reorderColumns"
          @remove-column="removeColumn"
          @add-column-click="openPicker"
          @row-click="symbol => navigateTo(linkOf(rowOf(symbol)))"
        >
          <template #name="{ row }">
            <div class="watchlist-name">
              <NuxtLink :to="linkOf(rowOf(row.symbol))" :title="row.name" @click.stop>{{ row.name }}</NuxtLink>
              <el-tag v-if="KIND_TAG[rowOf(row.symbol).kind]" size="small" effect="plain">{{ KIND_TAG[rowOf(row.symbol).kind] }}</el-tag>
            </div>
            <p v-if="watchlistNotes[row.symbol]" class="watchlist-note">{{ watchlistNotes[row.symbol] }}</p>
          </template>
          <template #cell="{ row, column, text }">
            <span v-if="column.field === WATCHLIST_CHANGE" :class="priceDirectionClass(rowOf(row.symbol).change)">{{ changeText(rowOf(row.symbol)) }}</span>
            <span v-else-if="column.field === WATCHLIST_EX_DIVIDEND">{{ exDividendText(rowOf(row.symbol)) }}</span>
            <span v-else>{{ text }}</span>
          </template>
          <template #actions="{ row }">
            <div v-if="ordering" class="watchlist-row-actions" @click.stop>
              <el-button :id="`table-move-up-${row.symbol}`" link type="primary" :disabled="watchlistCodes[0] === row.symbol" :aria-label="`${row.name} 上移`" @click="moveRow(rowOf(row.symbol), -1, 'table')">上移</el-button>
              <el-button :id="`table-move-down-${row.symbol}`" link type="primary" :disabled="watchlistCodes.at(-1) === row.symbol" :aria-label="`${row.name} 下移`" @click="moveRow(rowOf(row.symbol), 1, 'table')">下移</el-button>
            </div>
            <div v-else class="watchlist-row-actions" @click.stop>
              <el-button v-if="watchlistIds[row.symbol]" link type="primary" :aria-label="`${row.name} 的備註`" @click="openNote(rowOf(row.symbol))">備註</el-button>
              <el-button link type="danger" :aria-label="`從觀察清單移除 ${row.name}`" @click="removeStock(row.symbol)">移除</el-button>
            </div>
          </template>
        </SharedMetricTable>

        <ul class="view-card watchlist-cards">
          <li v-for="(row, index) in rows" :key="row.code" class="watchlist-card">
            <div class="watchlist-name">
              <NuxtLink :to="linkOf(row)">{{ row.name }}</NuxtLink>
              <span class="watchlist-name__code">{{ row.code }}</span>
              <el-tag v-if="KIND_TAG[row.kind]" size="small" effect="plain">{{ KIND_TAG[row.kind] }}</el-tag>
            </div>
            <p v-if="watchlistNotes[row.code]" class="watchlist-note">{{ watchlistNotes[row.code] }}</p>
            <dl class="watchlist-card__figures">
              <div v-for="column in columns" :key="column.field" :class="{ 'watchlist-card__wide': column.label.length > 7 || column.field === WATCHLIST_EX_DIVIDEND }">
                <dt>{{ column.label }}</dt>
                <dd :class="column.field === WATCHLIST_CHANGE ? priceDirectionClass(row.change) : undefined">{{ cellText(row, column.field) }}</dd>
              </div>
            </dl>
            <div v-if="ordering" class="watchlist-row-actions">
              <el-button :id="`card-move-up-${row.code}`" :disabled="index === 0" :aria-label="`${row.name} 上移`" @click="moveRow(row, -1, 'card')">上移</el-button>
              <el-button :id="`card-move-down-${row.code}`" :disabled="index === rows.length - 1" :aria-label="`${row.name} 下移`" @click="moveRow(row, 1, 'card')">下移</el-button>
            </div>
            <div v-else class="watchlist-row-actions">
              <el-button v-if="watchlistIds[row.code]" :aria-label="`${row.name} 的備註`" @click="openNote(row)">備註</el-button>
              <el-button type="danger" plain :aria-label="`從觀察清單移除 ${row.name}`" @click="removeStock(row.code)">移除</el-button>
            </div>
          </li>
        </ul>
      </template>
    </div>

    <ScreenerIndicatorPicker
      v-if="schema.categories.length"
      v-model="pickerVisible"
      centered
      title="新增欄位"
      :categories="schema.categories"
      :trigger-el="pickerTriggerEl"
      :hide-period="false"
      @select="addColumn"
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
.watchlist-page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 16px;
}

.watchlist-page__count {
  margin-left: 8px;
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-regular);
}

.watchlist-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.watchlist-page__actions :deep(.el-button) {
  min-height: 44px;
  margin: 0;
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

.watchlist-page__quota {
  margin: -8px 0 16px;
  color: var(--el-text-color-regular);
}


.watchlist-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.watchlist-name__code {
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.watchlist-note {
  margin: 4px 0 0;
  color: var(--el-text-color-regular);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.watchlist-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.watchlist-row-actions :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}

.view-table :deep(td) {
  font-variant-numeric: tabular-nums;
}

/* 表格裡的名稱格不折行：名稱太長用刪節號（完整名稱在 title），備註只留一行。其餘欄位的不折行在 SharedMetricTable。 */
.view-table .watchlist-name {
  flex-wrap: nowrap;
}

.view-table .watchlist-name a,
.view-table .watchlist-note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.view-card {
  display: none;
}

.watchlist-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  flex-direction: column;
  gap: 12px;
}

.watchlist-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.watchlist-card__figures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin: 0;
}

.watchlist-card__wide {
  grid-column: 1 / -1;
}

.watchlist-card__figures dt {
  color: var(--el-text-color-regular);
}

.watchlist-card__figures dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.watchlist-note-dialog__label {
  display: block;
  margin-bottom: 8px;
}

/* 表格／卡片切換點 1279px，跟持股頁同一個（2026-10-05「a11y 要求放大 200% 也不可以跑版」）：1280 寬的
   左側欄會吃掉表格的寬度，1024～1279 之間 7 欄放不下。 */
@media (max-width: 1279px) {
  .view-table {
    display: none;
  }

  .view-card {
    display: flex;
  }
}
</style>
