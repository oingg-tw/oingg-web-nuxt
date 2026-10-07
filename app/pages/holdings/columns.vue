<script setup lang="ts">
import type { InputInstance } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import type { HoldingColumn } from '~/composables/stock/useHoldings'
import type { FormulaValue, RowFields } from '~/utils/holdings-formula'

// 持股的自訂欄位（2026-10-05）。使用者：「讓用戶可以自己定義，比如第二欄數值除以第一欄數值，UIUX 體感也
// 盡可能比照 Excel」「可以指定用持股表的欄位」「存進帳號」。
//
// 比照 Excel 的地方：表頭有欄位字母；公式以 = 開頭、用字母參照欄位；上方是公式列；**編輯公式時點任何一欄
// 的表頭，會把那一欄的字母插進游標位置**（Excel 點儲存格的手感）；錯誤值顯示 #DIV/0!、#N/A 等；刪除欄位
// 時，其他公式的參照像 Excel 一樣自動改寫。
//
// 計算全在瀏覽器（app/utils/holdings-formula.ts，不 eval）：持股最多一兩百列，而且是使用者自己的資料。
// 公式存進帳號（GET/PUT /users/me/holding-columns）。
//
// Personal page: out of the index and the sitemap (/holdings/**).
useSeoMeta({ title: '自訂欄位', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const { open: openLogin } = useLoginDialog()
const { holdings, pending, loadFailed, market, load, ensureLoaded, clear, fetchColumns, saveColumns } = useHoldings()
// 欄位數上限讀共用的方案狀態（useEntitlement，2026-10-06）。使用者 2026-10-05 定價「免費 3 個、付費無上限」；
// bff-ts 數的是整份清單（含預設 7 欄），所以免費方案是 10。null ＝ 不限；undefined ＝ 讀不到（不在前端擋）。
const { quotaOf } = useEntitlement()
const { data: companies } = useCompanyIndex()
const companyByCode = computed(() => new Map(companies.value.map(entry => [entry.code, entry])))

// 見 holdings/index.vue：登入狀態只在瀏覽器裡才知道，掛載前一律當成還不知道，免得 hydration 不一致。
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

// **每一欄都能自由刪改**（使用者 2026-10-05：「ABCD 啥的預設欄位都可以自由刪改」）。像 Excel 一樣沒有內建欄：
// 預設的「股數」「收盤價」只是 =SHARES()、=PRICE() 這種資料函數的公式欄（見 holdings-formula.ts 的
// FIELD_FUNCTIONS），所以改名、改公式、刪掉都一樣。欄位字母依目前的位置排。
const DEFAULT_COLUMNS: HoldingColumn[] = [
  { id: 'shares', label: '股數', formula: '=SHARES()', format: 'number', decimals: 0 },
  { id: 'avgcost', label: '平均成本', formula: '=AVGCOST()', format: 'number', decimals: 2 },
  { id: 'price', label: '收盤價', formula: '=PRICE()', format: 'number', decimals: 2 },
  { id: 'marketvalue', label: '市值', formula: '=MARKETVALUE()', format: 'money', decimals: 0 },
  { id: 'pnl', label: '未實現損益', formula: '=PNL()', format: 'money', decimals: 0 },
  { id: 'return', label: '報酬率', formula: '=RETURN()', format: 'percent', decimals: 2 },
  { id: 'dividend', label: '預估年股利', formula: '=DIVIDEND()', format: 'money', decimals: 0 },
  // 範例：一看就懂怎麼用，而且是有意義的數字（以目前市值計的股利率）
  { id: 'example-yield', label: '股利率', formula: '=G/D', format: 'percent', decimals: 2 }
]

const FIELD_PATTERN = new RegExp(`\\b(${Object.keys(FIELD_FUNCTIONS).join('|')})\\s*\\(`, 'i')

// 舊版存的清單（2026-10-05 早上）只有 H 以後的自訂欄，A～G 是寫死的內建欄、公式用字母參照它們。清單裡完全
// 沒有資料函數時，就是那種舊格式：把七個資料欄補在前面，字母剛好對回原本的 A～G，舊公式不用改。
function upgradeLegacy(saved: HoldingColumn[]): HoldingColumn[] {
  if (saved.length === 0 || saved.some(column => FIELD_PATTERN.test(column.formula))) return saved
  return [...DEFAULT_COLUMNS.slice(0, 7), ...saved]
}

const columns = ref<HoldingColumn[]>([])
const columnsLoadFailed = ref(false)
// 讀不到時交給全站的讀取失敗彈窗（AppLoadFailureDialog，2026-10-08），畫面上不再各自出訊息
// 欄位設定讀不到時原本只出一條黃色提醒「現在的修改可能存不進帳號」——會讓人白改，改成擋住
watchLoadFailure('holdings', () => loadFailed.value, load)
watchLoadFailure('holdings-columns', () => columnsLoadFailed.value, () => loadColumns())
// 方案的欄位數上限（含預設欄）。跟 bff-ts 同一條規則：只有「超過上限、而且比已存的更多」才擋——降級後已經
// 超過的人仍然可以改、刪、重排，只是不能再變多。
const columnQuota = computed(() => quotaOf('customHoldingColumns'))
const savedCount = ref(0)
const atQuota = computed(() => typeof columnQuota.value === 'number' && columns.value.length >= Math.max(columnQuota.value, savedCount.value))
const saving = ref(false)

async function loadColumns() {
  const saved = await fetchColumns()
  columnsLoadFailed.value = saved === undefined
  columns.value = saved === undefined ? [] : (saved === null ? DEFAULT_COLUMNS : upgradeLegacy(saved)).map(column => ({ ...column }))
  savedCount.value = columns.value.length
}

const letters = computed(() => columns.value.map((_, index) => columnLetter(index)))

const baseRows = computed(() => holdings.value.map((holding) => {
  const quote = market.value[holding.symbol]
  const figures = holdingRowFigures({ quantity: holding.quantity, costUnknownQuantity: holding.costUnknownQuantity, averageCost: holding.averageCost, price: quote?.price, dividendPerShare: quote?.dividendPerShare })
  const price = quote?.price === null || quote?.price === undefined ? null : Number(quote.price)
  const fields: RowFields = {
    SHARES: holding.quantity,
    AVGCOST: holding.averageCost === null ? null : Number(holding.averageCost),
    PRICE: price !== null && price > 0 ? price : null,
    MARKETVALUE: figures.marketValue,
    PNL: figures.pnl,
    // 報酬率在公式裡是比例（0.2 ＝ 20%），跟 Excel 裡格式化成百分比的儲存格一樣
    RETURN: figures.pnlPct === null ? null : figures.pnlPct / 100,
    DIVIDEND: figures.annualDividend
  }
  const entry = companyByCode.value.get(holding.symbol)
  return { symbol: holding.symbol, name: entry?.name ?? holding.symbol, fields }
}))

const rows = computed(() => {
  // 編輯中的那一欄用草稿的公式算，打字的同時整欄就跟著變（Excel 的手感）
  const formulas = columns.value.map((column, index) => ({ letter: letters.value[index]!, formula: column.id === editingId.value ? draft.formula : column.formula }))
  const values = evaluateTable(baseRows.value.map(row => row.fields), formulas)
  return baseRows.value.map((row, index) => ({ symbol: row.symbol, name: row.name, values: values[index]! }))
})
type ColumnRow = (typeof rows.value)[number]

function formatValue(value: FormulaValue | undefined, column: HoldingColumn): string {
  if (value === undefined) return ''
  if (value === '#N/A') return '－'
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (column.format === 'percent') return `${(value * 100).toFixed(column.decimals)}%`
  const fixed = value.toFixed(column.decimals)
  return column.format === 'money' ? `${groupThousands(fixed)} 元` : groupThousands(fixed)
}

// ---- 公式列 ----

const editingId = ref<string | null>(null)
const draft = reactive<HoldingColumn>({ id: '', label: '', formula: '', format: 'number', decimals: 2 })
const formulaInput = ref<InputInstance>()
const editingIndex = computed(() => columns.value.findIndex(column => column.id === editingId.value))
const editingLetter = computed(() => (editingIndex.value === -1 ? '' : letters.value[editingIndex.value]))
const parseError = computed(() => {
  if (!editingId.value) return ''
  const result = parseFormula(draft.formula)
  return result.ok ? '' : result.message
})
const labelError = computed(() => (editingId.value && !draft.label.trim() ? '請輸入欄位名稱' : ''))

// 公式列收起來之後（套用、取消、刪除）焦點會掉到 <body>（2026-10-07 a11y 盤點），所以把焦點放回那一欄的表頭，
// 那一欄不在了就放回「新增欄位」；結果用 status 念出來。
const statusText = ref('')
const addButton = ref<{ $el: HTMLElement }>()
function settleFocus(columnId: string | null, message: string) {
  statusText.value = message
  nextTick(() => {
    const header = columnId ? document.querySelector<HTMLElement>(`[data-column-id="${columnId}"]`) : null
    ;(header ?? addButton.value?.$el)?.focus()
  })
}

function startEditing(column: HoldingColumn) {
  editingId.value = column.id
  Object.assign(draft, { ...column })
  nextTick(() => formulaInput.value?.focus())
}

function addColumn() {
  const column: HoldingColumn = { id: crypto.randomUUID(), label: `新欄位 ${columns.value.length + 1}`, formula: '=', format: 'number', decimals: 2 }
  columns.value = [...columns.value, column]
  startEditing(column)
}

// Excel 的點選參照：編輯公式時點一欄的表頭，把它的字母插進游標位置
function headerClicked(letter: string, column?: HoldingColumn) {
  if (editingId.value) {
    const input = formulaInput.value?.input
    const start = input?.selectionStart ?? draft.formula.length
    const end = input?.selectionEnd ?? start
    draft.formula = draft.formula.slice(0, start) + letter + draft.formula.slice(end)
    nextTick(() => {
      input?.focus()
      input?.setSelectionRange(start + letter.length, start + letter.length)
    })
    return
  }
  if (column) startEditing(column)
}

async function persist(next: HoldingColumn[], previous: HoldingColumn[]): Promise<boolean> {
  saving.value = true
  const result = await saveColumns(next)
  saving.value = false
  if (result.ok) {
    savedCount.value = next.length
    return true
  }
  columns.value = previous
  if (result.reason === 'quota') showQuotaReached('持股欄位')
  else showErrorMessage(`沒有存到帳號：${result.message ?? '暫時無法連線，請稍後再試'}`)
  return false
}

async function applyDraft() {
  if (parseError.value || labelError.value || editingIndex.value === -1) return
  const previous = columns.value
  const formula = draft.formula.trim().startsWith('=') ? draft.formula.trim() : `=${draft.formula.trim()}`
  const next = columns.value.map(column => (column.id === editingId.value ? { ...draft, label: draft.label.trim(), formula } : column))
  columns.value = next
  const id = editingId.value
  const letter = editingLetter.value
  if (await persist(next, previous)) {
    editingId.value = null
    settleFocus(id, `已套用 ${letter} 欄`)
  }
}

function cancelEditing() {
  // 新增後還沒套用就取消：那一欄本來就不存在
  const saved = columns.value.find(column => column.id === editingId.value)
  const id = editingId.value
  const removed = !!saved && saved.formula === '='
  if (removed) columns.value = columns.value.filter(column => column.id !== id)
  editingId.value = null
  settleFocus(removed ? null : id, '已取消修改')
}

async function deleteColumn() {
  const index = editingIndex.value
  if (index === -1) return
  const deletedLetter = letters.value[index]!
  const previous = columns.value
  // 像 Excel：參照被刪那一欄的變成 #REF!，後面的欄位字母往前移
  const next = columns.value
    .filter((_, i) => i !== index)
    .map(column => ({ ...column, formula: rewriteAfterDelete(column.formula, deletedLetter) }))
  columns.value = next
  editingId.value = null
  if (!(await persist(next, previous))) return
  settleFocus(null, `已刪除 ${deletedLetter} 欄`)
  // 刪除可以復原（其他刪除——持股、交易、觀察清單——都有，2026-10-07 a11y 盤點補上）。復原是把整份欄位存回去。
  undoToast(`已刪除 ${deletedLetter} 欄`, async () => {
    columns.value = previous
    if (await persist(previous, next)) settleFocus(null, `已復原 ${deletedLetter} 欄`)
  }, () => {})
}

// 試算表在手機上維持左右捲動（使用者 2026-10-07 選定），所以捲動區要能用鍵盤聚焦、有名稱，鍵盤使用者才能用方向鍵
// 左右捲（axe scrollable-region-focusable，2026-10-07 用使用者帳號實測找到）。el-table 沒有對應的 prop，捲動區是它
// 內部的 .el-scrollbar__wrap，只能掛載後補屬性；欄數變動時 el-table 不會換掉這個元素，但保險起見每次都補。
const columnsTable = ref<{ $el: HTMLElement }>()
watch([columnsTable, () => columns.value.length], () => nextTick(() => {
  const wrap = columnsTable.value?.$el.querySelector<HTMLElement>('.el-table__body-wrapper .el-scrollbar__wrap')
  if (!wrap) return
  wrap.tabIndex = 0
  wrap.setAttribute('role', 'region')
  wrap.setAttribute('aria-label', '持股表，可左右捲動')
}), { immediate: true })

// 放在最後：immediate 的 watcher 會立刻執行，用到的 editingId 必須已經宣告（否則 TDZ，2026-10-05 實際踩到）。
watch([authResolved, () => currentUser.value?.uid], ([resolved, uid]) => {
  if (!resolved) return
  editingId.value = null
  if (uid) {
    ensureLoaded()
    loadColumns()
  } else {
    clear()
    columns.value = []
  }
}, { immediate: true })
</script>

<template>
  <div class="columns-page">
    <div class="columns-page__heading">
      <h1 class="columns-page__title">自訂欄位</h1>
      <p class="columns-page__subtitle">像 Excel 一樣用欄位字母寫公式，例如 =D/A 就是「市值 ÷ 股數」</p>
    </div>

    <HoldingsNav />

    <div v-if="!mounted || !authResolved" v-loading="true" class="columns-page__placeholder" />

    <section v-else-if="!currentUser" class="columns-guest">
      <h2 class="columns-guest__title">登入後設定你的自訂欄位</h2>
      <p class="columns-guest__text">公式存在你的帳號裡，換電腦或手機都在。</p>
      <el-button type="primary" size="large" @click="openLogin">登入／註冊</el-button>
    </section>

    <!-- 讀不到：彈窗會說明並自動重讀；留空佔住這一支，免得落到下面的「還沒有持股」 -->
    <template v-else-if="loadFailed" />

    <div v-else-if="pending && !holdings.length" v-loading="true" class="columns-page__placeholder" />

    <el-empty v-else-if="!holdings.length" description="還沒有記錄任何持股，先到持股總覽記一筆交易或匯入成交明細" :image-size="64" />

    <template v-else>

      <h2 class="visually-hidden">公式列</h2>
      <div class="formula-bar" role="group" aria-label="公式列">
        <template v-if="editingId">
          <span class="formula-bar__letter" aria-hidden="true">{{ editingLetter }}</span>
          <el-input v-model="draft.label" class="formula-bar__label" maxlength="20" aria-label="欄位名稱" placeholder="欄位名稱" />
          <span class="formula-bar__fx" aria-hidden="true">fx</span>
          <el-input
            ref="formulaInput"
            v-model="draft.formula"
            class="formula-bar__formula"
            maxlength="200"
            aria-label="公式"
            aria-describedby="formula-help"
            placeholder="=D/A"
            @keydown.enter.prevent="applyDraft"
            @keydown.esc.prevent="cancelEditing"
          />
          <el-select v-model="draft.format" class="formula-bar__format" aria-label="顯示格式">
            <el-option value="number" label="數字" />
            <el-option value="percent" label="百分比" />
            <el-option value="money" label="金額（元）" />
          </el-select>
          <el-input-number v-model="draft.decimals" class="formula-bar__decimals" :min="0" :max="4" :precision="0" :controls="false" aria-label="小數位數" />
          <div class="formula-bar__actions">
            <el-button type="primary" :loading="saving" :disabled="!!parseError || !!labelError" @click="applyDraft">套用</el-button>
            <el-button @click="cancelEditing">取消</el-button>
            <el-button :icon="Delete" :aria-label="`刪除欄位 ${editingLetter} ${draft.label}`" @click="deleteColumn">刪除欄位</el-button>
          </div>
          <!-- 說明文字本身不是 live region：原本整段掛 role="status"，每打一個字就重念一次。錯誤另外念（見下方） -->
          <p id="formula-help" class="formula-bar__help" :class="{ 'is-error': parseError || labelError }">
            {{ labelError || parseError || '點任一欄的表頭可以把它的字母插進公式。可用 + − × ÷ ^ %、ROUND、ABS、MIN、MAX、SUM、AVERAGE、IF、IFERROR；整欄寫成 D:D，例如市值占比 =D/SUM(D:D)；持股資料用 SHARES()、PRICE() 等函數（見表格下方）。' }}
          </p>
        </template>
        <template v-else>
          <el-button ref="addButton" type="primary" :icon="Plus" :disabled="atQuota" @click="addColumn">新增欄位</el-button>
          <p v-if="atQuota" class="formula-bar__help" role="status">
            你的方案最多 {{ columnQuota }} 欄（預設的欄位也算在內）。可以刪掉不需要的欄位再新增，或之後升級專業版。<NuxtLink to="/profile#plan">看方案</NuxtLink>
          </p>
          <p class="formula-bar__help">點任一欄的表頭可以改名、改公式或刪除。</p>
        </template>
      </div>

      <p class="visually-hidden" role="status">{{ labelError || parseError || statusText }}</p>

      <!-- 試算表本來就是橫向看的：手機上維持左右捲動，股票欄固定在左邊（使用者 2026-10-07 選定） -->
      <h2 class="visually-hidden">持股表</h2>
      <el-table ref="columnsTable" :data="rows" row-key="symbol" class="columns-table" border>
        <el-table-column label="股票" min-width="140" fixed>
          <template #default="{ row }">{{ tableRow<ColumnRow>(row).name }} <span class="columns-page__code">{{ tableRow<ColumnRow>(row).symbol }}</span></template>
        </el-table-column>
        <el-table-column v-for="(column, index) in columns" :key="column.id" align="right" min-width="120">
          <template #header>
            <button
              type="button"
              class="column-header"
              :data-column-id="column.id"
              :class="{ 'is-editing': column.id === editingId, 'is-pickable': editingId && column.id !== editingId }"
              :aria-pressed="column.id === editingId"
              :aria-label="editingId ? `把 ${letters[index]}（${column.label}）插進公式` : `修改 ${letters[index]} ${column.label} 的公式`"
              @click="headerClicked(letters[index]!, column)"
            >
              <span class="column-header__letter">{{ letters[index] }}</span>{{ column.id === editingId ? draft.label : column.label }}
            </button>
          </template>
          <template #default="{ row }">
            {{ formatValue(tableRow<ColumnRow>(row).values[letters[index]!], column.id === editingId ? draft : column) }}
          </template>
        </el-table-column>
      </el-table>

      <p class="columns-page__footnote">
        每一欄都能改名、改公式或刪除。持股資料用函數取得：SHARES() 股數、AVGCOST() 平均成本、PRICE() 收盤價、MARKETVALUE() 市值、PNL() 未實現損益、RETURN() 報酬率（比例，0.2 代表 20%）、DIVIDEND() 預估年股利。沒有報價或成本不明的格子顯示「－」；除以 0 是 #DIV/0!。
      </p>
    </template>
  </div>
</template>

<style scoped>
.columns-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.columns-page__heading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.columns-page__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.columns-page__subtitle {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.columns-page__placeholder {
  min-height: 200px;
}


.columns-page__code {
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.columns-page__footnote {
  margin: 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.columns-guest {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.columns-guest__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.columns-guest__text {
  margin: 0;
  color: var(--el-text-color-regular);
}

.formula-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

/* 觸控目標至少 44px（2026-10-07 a11y 盤點：輸入框與按鈕原本 32px） */
.formula-bar :deep(.el-input__wrapper),
.formula-bar :deep(.el-select__wrapper),
.formula-bar :deep(.el-button) {
  min-height: 44px;
}

.formula-bar__letter {
  min-width: 2em;
  font-weight: 700;
  text-align: center;
}

.formula-bar__label {
  width: 10em;
}

.formula-bar__fx {
  font-style: italic;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.formula-bar__formula {
  flex: 1 1 240px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.formula-bar__format {
  width: 9em;
}

.formula-bar__decimals {
  width: 7em;
}

.formula-bar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.formula-bar__actions :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}

.formula-bar__help {
  flex-basis: 100%;
  margin: 0;
  color: var(--el-text-color-regular);
}

.formula-bar__help.is-error {
  color: var(--el-color-danger);
  font-weight: 600;
}

.column-header {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-height: 44px;
  padding: 0 4px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.column-header__letter {
  color: var(--el-text-color-regular);
  font-weight: 700;
}

.column-header.is-custom {
  text-decoration: underline dotted;
  text-underline-offset: 4px;
}

.column-header.is-editing {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  color: var(--el-color-primary);
}

.column-header.is-pickable:hover,
.column-header.is-pickable:focus-visible {
  background: var(--el-color-primary-light-9);
}

.columns-table :deep(td) {
  font-variant-numeric: tabular-nums;
}
</style>
