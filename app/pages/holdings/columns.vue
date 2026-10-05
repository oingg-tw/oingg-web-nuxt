<script setup lang="ts">
import type { InputInstance } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import type { HoldingColumn } from '~/composables/stock/useHoldings'
import type { FormulaValue } from '~/utils/holdings-formula'

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
const { data: companies } = useCompanyIndex()
const companyByCode = computed(() => new Map(companies.value.map(entry => [entry.code, entry])))

// 見 holdings/index.vue：登入狀態只在瀏覽器裡才知道，掛載前一律當成還不知道，免得 hydration 不一致。
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

// 內建欄位的字母是固定的——公式存的是字母，改了順序就會指錯欄。
const BUILT_IN = [
  { letter: 'A', label: '股數' },
  { letter: 'B', label: '平均成本' },
  { letter: 'C', label: '收盤價' },
  { letter: 'D', label: '市值' },
  { letter: 'E', label: '未實現損益' },
  { letter: 'F', label: '報酬率' },
  { letter: 'G', label: '預估年股利' }
] as const
const FIRST_CUSTOM_INDEX = BUILT_IN.length

// 從來沒存過的帳號看到的範例：一看就懂怎麼用，而且是有意義的數字（以目前市值計的股利率）。
const EXAMPLE_COLUMNS: HoldingColumn[] = [
  { id: 'example-yield', label: '股利率', formula: '=G/D', format: 'percent', decimals: 2 }
]

const columns = ref<HoldingColumn[]>([])
const columnsLoadFailed = ref(false)
const saving = ref(false)

async function loadColumns() {
  const saved = await fetchColumns()
  columnsLoadFailed.value = saved === undefined
  columns.value = saved === undefined ? [] : (saved ?? EXAMPLE_COLUMNS).map(column => ({ ...column }))
}

const customLetters = computed(() => columns.value.map((_, index) => columnLetter(FIRST_CUSTOM_INDEX + index)))

// 內建欄位整欄的值，給 SUM(D:D) 這類整欄範圍用（市值占比是持股表最常見的公式）
const builtInTable = computed(() => {
  const table: Record<string, (number | null)[]> = {}
  for (const row of baseRows.value) for (const [letter, value] of Object.entries(row.builtIn)) (table[letter] ??= []).push(value)
  return table
})

const baseRows = computed(() => holdings.value.map((holding) => {
  const quote = market.value[holding.symbol]
  const figures = holdingRowFigures({ quantity: holding.quantity, costUnknownQuantity: holding.costUnknownQuantity, averageCost: holding.averageCost, price: quote?.price, dividendPerShare: quote?.dividendPerShare })
  const price = quote?.price === null || quote?.price === undefined ? null : Number(quote.price)
  const builtIn: Record<string, number | null> = {
    A: holding.quantity,
    B: holding.averageCost === null ? null : Number(holding.averageCost),
    C: price !== null && price > 0 ? price : null,
    D: figures.marketValue,
    E: figures.pnl,
    // 報酬率在公式裡是比例（0.2 ＝ 20%），跟 Excel 裡格式化成百分比的儲存格一樣
    F: figures.pnlPct === null ? null : figures.pnlPct / 100,
    G: figures.annualDividend
  }
  const entry = companyByCode.value.get(holding.symbol)
  return { symbol: holding.symbol, name: entry?.name ?? holding.symbol, builtIn }
}))

const rows = computed(() => {
  // 編輯中的那一欄用草稿的公式算，打字的同時整欄就跟著變（Excel 的手感）
  const formulas = columns.value.map((column, index) => ({ letter: customLetters.value[index]!, formula: column.id === editingId.value ? draft.formula : column.formula }))
  return baseRows.value.map(row => ({ ...row, custom: evaluateRow(row.builtIn, formulas, builtInTable.value) }))
})
type ColumnRow = (typeof rows.value)[number]

function formatBuiltIn(letter: string, value: number | null): string {
  if (value === null) return '－'
  if (letter === 'F') return holdingsSignedPct(value)
  if (letter === 'E') return holdingsSignedMoney(value)
  if (letter === 'B' || letter === 'C') return groupThousands(String(Number(value.toFixed(4))))
  return holdingsMoney(value)
}

function formatCustom(value: FormulaValue | undefined, column: HoldingColumn): string {
  if (value === undefined) return ''
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
const editingLetter = computed(() => (editingIndex.value === -1 ? '' : customLetters.value[editingIndex.value]))
const parseError = computed(() => {
  if (!editingId.value) return ''
  const result = parseFormula(draft.formula)
  return result.ok ? '' : result.message
})
const labelError = computed(() => (editingId.value && !draft.label.trim() ? '請輸入欄位名稱' : ''))

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
  if (result.ok) return true
  columns.value = previous
  showErrorMessage(result.reason === 'quota' ? '已達到你的方案可用的自訂欄位數量上限' : `沒有存到帳號：${result.message ?? '暫時無法連線，請稍後再試'}`)
  return false
}

async function applyDraft() {
  if (parseError.value || labelError.value || editingIndex.value === -1) return
  const previous = columns.value
  const formula = draft.formula.trim().startsWith('=') ? draft.formula.trim() : `=${draft.formula.trim()}`
  const next = columns.value.map(column => (column.id === editingId.value ? { ...draft, label: draft.label.trim(), formula } : column))
  columns.value = next
  if (await persist(next, previous)) editingId.value = null
}

function cancelEditing() {
  // 新增後還沒套用就取消：那一欄本來就不存在
  const saved = columns.value.find(column => column.id === editingId.value)
  if (saved && saved.formula === '=') columns.value = columns.value.filter(column => column.id !== editingId.value)
  editingId.value = null
}

async function deleteColumn() {
  const index = editingIndex.value
  if (index === -1) return
  const deletedLetter = customLetters.value[index]!
  const previous = columns.value
  // 像 Excel：參照被刪那一欄的變成 #REF!，後面的欄位字母往前移
  const next = columns.value
    .filter((_, i) => i !== index)
    .map(column => ({ ...column, formula: rewriteAfterDelete(column.formula, deletedLetter) }))
  columns.value = next
  editingId.value = null
  await persist(next, previous)
}

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

    <el-alert v-else-if="loadFailed" type="error" :closable="false" show-icon title="持股資料暫時無法載入">
      <el-button class="columns-page__retry" @click="load">重新載入</el-button>
    </el-alert>

    <div v-else-if="pending && !holdings.length" v-loading="true" class="columns-page__placeholder" />

    <el-empty v-else-if="!holdings.length" description="還沒有記錄任何持股，先到持股總覽記一筆交易或匯入成交明細" :image-size="64" />

    <template v-else>
      <el-alert v-if="columnsLoadFailed" type="warning" :closable="false" show-icon title="自訂欄位暫時無法載入，現在的修改可能存不進帳號" />

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
          <el-input-number v-model="draft.decimals" class="formula-bar__decimals" :min="0" :max="4" :precision="0" controls-position="right" aria-label="小數位數" />
          <div class="formula-bar__actions">
            <el-button type="primary" :loading="saving" :disabled="!!parseError || !!labelError" @click="applyDraft">套用</el-button>
            <el-button @click="cancelEditing">取消</el-button>
            <el-button :icon="Delete" :aria-label="`刪除欄位 ${editingLetter} ${draft.label}`" @click="deleteColumn">刪除欄位</el-button>
          </div>
          <p id="formula-help" class="formula-bar__help" :class="{ 'is-error': parseError || labelError }" role="status">
            {{ labelError || parseError || '點任一欄的表頭可以把它的字母插進公式。可用 + − × ÷ ^ %、ROUND、ABS、MIN、MAX、SUM、AVERAGE、IF、IFERROR；整欄寫成 D:D，例如市值占比 =D/SUM(D:D)。' }}
          </p>
        </template>
        <template v-else>
          <el-button type="primary" :icon="Plus" @click="addColumn">新增欄位</el-button>
          <p class="formula-bar__help">點自訂欄位的表頭可以修改公式。</p>
        </template>
      </div>

      <el-table :data="rows" row-key="symbol" class="columns-table" border>
        <el-table-column label="股票" min-width="140" fixed>
          <template #default="{ row }">{{ tableRow<ColumnRow>(row).name }} <span class="columns-page__code">{{ tableRow<ColumnRow>(row).symbol }}</span></template>
        </el-table-column>
        <el-table-column v-for="column in BUILT_IN" :key="column.letter" align="right" min-width="120">
          <template #header>
            <button type="button" class="column-header" :class="{ 'is-pickable': editingId }" :aria-label="editingId ? `把 ${column.letter}（${column.label}）插進公式` : `${column.letter} ${column.label}`" @click="headerClicked(column.letter)">
              <span class="column-header__letter">{{ column.letter }}</span>{{ column.label }}
            </button>
          </template>
          <template #default="{ row }">{{ formatBuiltIn(column.letter, tableRow<ColumnRow>(row).builtIn[column.letter] ?? null) }}</template>
        </el-table-column>
        <el-table-column v-for="(column, index) in columns" :key="column.id" align="right" min-width="130">
          <template #header>
            <button
              type="button"
              class="column-header is-custom"
              :class="{ 'is-editing': column.id === editingId, 'is-pickable': editingId && column.id !== editingId }"
              :aria-pressed="column.id === editingId"
              :aria-label="editingId ? `把 ${customLetters[index]}（${column.label}）插進公式` : `修改 ${customLetters[index]} ${column.label} 的公式`"
              @click="headerClicked(customLetters[index]!, column)"
            >
              <span class="column-header__letter">{{ customLetters[index] }}</span>{{ column.id === editingId ? draft.label : column.label }}
            </button>
          </template>
          <template #default="{ row }">
            {{ formatCustom(tableRow<ColumnRow>(row).custom[customLetters[index]!], column.id === editingId ? draft : column) }}
          </template>
        </el-table-column>
      </el-table>

      <p class="columns-page__footnote">
        F 報酬率在公式裡是比例（0.2 代表 20%），跟 Excel 裡格式化成百分比的儲存格一樣。沒有報價或成本不明的格子是 #N/A；除以 0 是 #DIV/0!。
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

.columns-page__retry {
  margin-top: 8px;
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
