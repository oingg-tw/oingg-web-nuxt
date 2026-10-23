<script setup lang="ts">
import { Delete, Plus } from '@element-plus/icons-vue'
import type { HoldingColumn } from '~/composables/holdings/holdings-model'
import type { FormulaValue, RowFields } from '~/utils/holdings-formula'
import type { SheetColumn } from '~/components/shared/SharedSheetGrid.vue'

// 持股的自訂欄位（2026-10-05）。使用者：「讓用戶可以自己定義，比如第二欄數值除以第一欄數值，UIUX 體感也
// 盡可能比照 Excel」「可以指定用持股表的欄位」「存進帳號」。
//
// 比照 Excel 的地方：表頭有欄位字母；公式以 = 開頭、用字母參照欄位；上方是公式列；**編輯公式時點任何一欄
// 的表頭，會把那一欄的字母插進游標位置**（Excel 點儲存格的手感）；錯誤值顯示 #DIV/0!、#N/A 等；刪除欄位
// 時，其他公式的參照像 Excel 一樣自動改寫。
// 2026-10-17 表格換成 SharedSheetGrid（試算表手感：框選、Ctrl+C 貼進 Excel、方向鍵、欄寬）：編輯公式時點任一格也會插入那一欄的
// 字母；在格子上按 F2 或雙擊就改那一欄的公式；公式裡的每個參照照 Excel 上色，表格上那一欄框同一個顏色。
//
// 計算全在瀏覽器（app/utils/holdings-formula.ts，不 eval）：持股最多一兩百列，而且是使用者自己的資料。
// 公式存進帳號（GET/PUT /users/me/holding-columns）。
// 2026-10-20 加「新增指標」（使用者：「我要怎麼任意自行加上我要的指標 比如 ROE…能跟篩選那邊一樣可以自由選擇嗎」，選了「兩顆按鈕」）：
// 從指標目錄挑（SharedMetricColumnPicker，觀察清單同一個），挑到的就是一欄 =METRIC("roe.TTM")——跟其他欄一樣是公式欄，有字母、
// 可以被別的公式引用。上游把公式當純文字存，所以不用改後端。
//
// Personal page: out of the index and the sitemap (/holdings/**).
useSeoMeta({ title: '自訂欄位', robots: 'noindex, nofollow' })

const authResolved = useAuthResolved()
const { holdings, pending, loadFailed, market, load, ensureLoaded, clear, fetchColumns, saveColumns } = useHoldings()
// 欄位數上限讀共用的方案狀態（useEntitlement，2026-10-06）。使用者 2026-10-05 定價「免費 3 個、付費無上限」；
// 業務中台 數的是整份清單（含預設 7 欄），所以免費方案是 10。null ＝ 不限；undefined ＝ 讀不到（不在前端擋）。
const { quotaOf } = useEntitlement()
const companyByCode = useCompanyLookup(() => holdings.value.map(holding => holding.symbol))
// 指標目錄：METRIC 欄的單位（百分比要換成比例）與「認不認得這個代碼」。挑選器本身也讀同一份（共用 key 的請求在頁面這層等一次）
const { data: schema } = await useFilterSchema()
const fieldOf = (id: string) => locateFieldInSchema(schema.value.categories, id)?.field

// **每一欄都能自由刪改**（使用者 2026-10-05：「ABCD 啥的預設欄位都可以自由刪改」）。像 Excel 一樣沒有內建欄：
// 預設的「股數」「收盤價」只是 =SHARES()、=PRICE() 這種資料函數的公式欄（見 holdings-formula.ts 的
// FIELD_FUNCTIONS），所以改名、改公式、刪掉都一樣。欄位字母依目前的位置排。
//
// 分工（2026-10-15 使用者同意）：持股總覽是固定的「我現在怎麼樣」，這一頁是自己的試算表。所以預設只放**基本積木**——
// 算其他數字要用的原始資料——加一個總覽沒有的範例，不再一打開就是總覽那張表的複本（原本前 7 欄就是總覽的欄位）。
// 只影響還沒存過欄位的人；存過的照舊。
const DEFAULT_COLUMNS: HoldingColumn[] = [
  { id: 'shares', label: '股數', formula: '=SHARES()', format: 'number', decimals: 0 },
  { id: 'avgcost', label: '平均成本', formula: '=AVGCOST()', format: 'number', decimals: 2 },
  { id: 'price', label: '收盤價', formula: '=PRICE()', format: 'number', decimals: 2 },
  { id: 'dividend', label: '預估年股利', formula: '=DIVIDEND()', format: 'money', decimals: 0 },
  // 範例：積木怎麼組合、而且是總覽上沒有的數字——以買進成本計的股利率（成本殖利率）
  { id: 'example-yield-on-cost', label: '成本殖利率', formula: '=D/(A*B)', format: 'percent', decimals: 2 }
]

// 舊版（2026-10-05 早上）寫死的七個內建欄，字母固定是 A～G
const LEGACY_DATA_COLUMNS: HoldingColumn[] = [
  { id: 'shares', label: '股數', formula: '=SHARES()', format: 'number', decimals: 0 },
  { id: 'avgcost', label: '平均成本', formula: '=AVGCOST()', format: 'number', decimals: 2 },
  { id: 'price', label: '收盤價', formula: '=PRICE()', format: 'number', decimals: 2 },
  { id: 'marketvalue', label: '市值', formula: '=MARKETVALUE()', format: 'money', decimals: 0 },
  { id: 'pnl', label: '未實現損益', formula: '=PNL()', format: 'money', decimals: 0 },
  { id: 'return', label: '報酬率', formula: '=RETURN()', format: 'percent', decimals: 2 },
  { id: 'dividend', label: '預估年股利', formula: '=DIVIDEND()', format: 'money', decimals: 0 }
]

// 舊版存的清單（2026-10-05 早上）只有 H 以後的自訂欄，A～G 是寫死的內建欄、公式用字母參照它們。清單裡完全
// 沒有資料函數（含 METRIC，見 usesDataFunction）時，就是那種舊格式：把那七個資料欄補在前面，字母剛好對回原本的 A～G，舊公式不用改。
// 用 LEGACY_DATA_COLUMNS 不用 DEFAULT_COLUMNS：預設 2026-10-15 改成基本積木之後只剩四個資料欄，字母會對錯。
function upgradeLegacy(saved: HoldingColumn[]): HoldingColumn[] {
  if (saved.length === 0 || saved.some(column => usesDataFunction(column.formula))) return saved
  return [...LEGACY_DATA_COLUMNS, ...saved]
}

const columns = ref<HoldingColumn[]>([])
const columnsLoadFailed = ref(false)
// 讀不到時交給全站的讀取失敗彈窗（AppLoadFailureDialog，2026-10-08），畫面上不再各自出訊息
// 欄位設定讀不到時原本只出一條黃色提醒「現在的修改可能存不進帳號」——會讓人白改，改成擋住
watchLoadFailure('holdings', () => loadFailed.value, load)
watchLoadFailure('holdings-columns', () => columnsLoadFailed.value, () => loadColumns())
// 方案的欄位數上限（含預設欄）。跟 業務中台 同一條規則：只有「超過上限、而且比已存的更多」才擋——降級後已經
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
  columnsReady.value = true
}
// 欄位跟持股同時讀：第一次讀完兩者都到了才畫，不然先畫只有「股票」一欄的表、欄位再一欄一欄出現（2026-10-20）
const columnsReady = ref(false)
// 讀的時候：表頭的字母照畫、欄名與格子是骨架，列數與欄數照上次（useLayoutHint；列數跟持股總覽共用同一個）
const rowCountHint = useLayoutHint('holdings-rows', 5)
const columnCountHint = useLayoutHint('holdings-columns-count', DEFAULT_COLUMNS.length)
watch(() => (columnsReady.value ? columns.value.length : null), (count) => {
  if (count !== null) columnCountHint.value = count
})
watch(() => (pending.value ? 0 : holdings.value.length), (count) => {
  if (count) rowCountHint.value = count
})

const letters = computed(() => columns.value.map((_, index) => columnLetter(index)))

const baseRows = computed(() => holdings.value.map((holding) => {
  const quote = market.value[holding.symbol]
  const figures = holdingRowFigures({ quantity: holding.quantity, costUnknownQuantity: holding.costUnknownQuantity, averageCost: holding.averageCost, price: quote?.price, dividendPerShare: quote?.dividendPerShare })
  const price = quote?.price === null || quote?.price === undefined ? null : Number(quote.price)
  // 跟持股總覽同一支（holdings-summary.ts 的 dayChange），兩頁的今日漲跌不會不一樣
  const day = dayChange({ quantity: holding.quantity, price: quote?.dayPrice, previousClose: quote?.previousClose })
  const fields: RowFields = {
    SHARES: holding.quantity,
    AVGCOST: holding.averageCost === null ? null : Number(holding.averageCost),
    PRICE: price !== null && price > 0 ? price : null,
    MARKETVALUE: figures.marketValue,
    PNL: figures.pnl,
    // 報酬率在公式裡是比例（0.2 ＝ 20%），跟 Excel 裡格式化成百分比的儲存格一樣
    RETURN: figures.pnlPct === null ? null : figures.pnlPct / 100,
    DIVIDEND: figures.annualDividend,
    DAYCHANGE: day.amount,
    DAYRETURN: day.pct === null ? null : day.pct / 100,
    // METRIC 的值：清單上用到的每個代碼都有一筆（還沒抓到、這一檔沒有都是 null →「－」）；不在清單上的代碼是 #NAME?
    metrics: new Map(metricFields.value.map(field => [field, metricValues.value.get(holding.symbol)?.get(field) ?? null]))
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
// 原生 <input> 而不是 el-input：後面要疊一層同字型、同內距的彩色鏡像（見 formulaParts），el-input 的內部結構放不進去
const formulaInput = ref<HTMLInputElement>()
const formulaMirror = ref<HTMLElement>()
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
    const header = columnId ? document.querySelector<HTMLElement>(`[data-column-id="${columnId}"]`)?.closest<HTMLElement>('th') : null
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

// 新增指標：挑到的指標直接成為一欄並存起來，不開公式列（要改名、改格式再點表頭）。格式：單位 % 的用百分比（引擎裡是比例），
// 其餘用數字；不用金額——每股的「元」不透露部位大小，用金額會被當成下載時預設不勾的敏感欄
const pickerOpen = ref(false)
async function addMetricColumn(field: string, label: string) {
  const formula = `=METRIC("${field}")`
  if (columns.value.some(column => column.formula === formula)) {
    ElMessage.info(`「${label}」已經在表格裡`)
    return
  }
  const column: HoldingColumn = { id: crypto.randomUUID(), label: label.slice(0, 20), formula, format: fieldOf(field)?.unit === '%' ? 'percent' : 'number', decimals: 2 }
  const previous = columns.value
  const next = [...previous, column]
  columns.value = next
  if (await persist(next, previous)) settleFocus(column.id, `已新增 ${columnLetter(next.length - 1)} 欄 ${column.label}`)
}

// Excel 的點選參照：編輯公式時點一欄的表頭，把它的字母插進游標位置
function headerClicked(letter: string, column?: HoldingColumn) {
  if (editingId.value) {
    const input = formulaInput.value
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
  if (result.reason === 'quota') showQuotaReached('customHoldingColumns')
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

// ---- 試算表（SharedSheetGrid）----
// 股票欄凍結在左邊（試算表在手機上維持左右捲動，使用者 2026-10-07 選定）。每一欄的表頭與格子用草稿算（編輯中那一欄打字的同時就變）。
// 複製出去的是原始值：百分比欄是比例、金額與數字欄是數字，帶 Excel 的數字格式；錯誤值照原樣（#DIV/0!、#N/A）
const STOCK_KEY = '__stock'
function excelFormatOf(column: HoldingColumn): string {
  const decimals = column.decimals > 0 ? `.${'0'.repeat(column.decimals)}` : ''
  return column.format === 'percent' ? `0${decimals}%` : `#,##0${decimals}`
}
function copyValue(value: FormulaValue | undefined): string | number | null {
  if (value === undefined) return null
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return value
}
const shownColumn = (column: HoldingColumn) => (column.id === editingId.value ? draft : column)
// 骨架：同一張 SharedSheetGrid（表頭、列高、框線都一樣），欄是「股票」加上次那麼多欄、只有字母，列是空的
const skeletonRows = computed(() => Array.from({ length: rowCountHint.value }, (_, index) => ({ symbol: `skeleton-${index}`, name: '', values: {} }) as unknown as ColumnRow))
const skeletonSheetColumns = computed<SheetColumn<ColumnRow>[]>(() => [
  { key: STOCK_KEY, label: '股票', frozen: true, rowHeader: true, text: () => '' },
  ...Array.from({ length: columnCountHint.value }, (_, index): SheetColumn<ColumnRow> => ({ key: `skeleton-${index}`, label: columnLetter(index), numeric: true, text: () => '' }))
])
const sheetColumns = computed<SheetColumn<ColumnRow>[]>(() => [
  { key: STOCK_KEY, label: '股票', frozen: true, rowHeader: true, text: row => `${row.symbol} ${row.name}`, sortValue: row => row.symbol },
  ...columns.value.map((column, index): SheetColumn<ColumnRow> => {
    const letter = letters.value[index]!
    return {
      key: column.id,
      label: `${letter} ${shownColumn(column).label}`,
      numeric: true,
      text: row => formatValue(row.values[letter], shownColumn(column)),
      value: row => copyValue(row.values[letter]),
      excelFormat: excelFormatOf(shownColumn(column)),
      // 只有數字能比大小；錯誤值（#DIV/0!）、空的、TRUE／FALSE 當成沒有值，排最後
      sortValue: (row) => {
        const value = row.values[letter]
        return typeof value === 'number' && Number.isFinite(value) ? value : null
      }
    }
  })
])
// ---- 排序工具列（2026-10-23，使用者：「holdings/columns 要有排序功能，希望能設計出來 類似 Excel 那樣的Toolbar」，方案頁選 A「一條工具列」）----
// 跟 Excel 一樣排「選取的格子所在的那一欄」：試算表回報作用中的欄（activeColumn），工具列用 v-model:sort 下排序（toolbar-sort：點表頭
// 照舊是改公式）。只改畫面上的順序；複製照排序後的順序。同一顆再按一次，或按「取消排序」，回到原本的順序
type SheetSort = { key: string; order: 'ascending' | 'descending' }
const ORDER_TEXT = { ascending: '由小到大', descending: '由大到小' } as const
const sheetSort = ref<SheetSort | null>(null)
const selectedKey = ref<string | null>(null)
const columnOf = (key: string | null | undefined) => sheetColumns.value.find(column => column.key === key) ?? null
const selectedLabel = computed(() => columnOf(selectedKey.value)?.label ?? null)
const sortedLabel = computed(() => columnOf(sheetSort.value?.key)?.label ?? null)
const isSortedBy = (order: SheetSort['order']) => !!sheetSort.value && sheetSort.value.key === selectedKey.value && sheetSort.value.order === order
function sortSelected(order: SheetSort['order']) {
  if (!selectedKey.value || !selectedLabel.value) return
  sheetSort.value = isSortedBy(order) ? null : { key: selectedKey.value, order }
  statusText.value = sheetSort.value ? `依${selectedLabel.value}${ORDER_TEXT[order]}排序` : '取消排序'
}
function clearSort() {
  sheetSort.value = null
  statusText.value = '取消排序'
}

// ---- 指標的值（METRIC）----
// 代碼從所有欄的公式收集（含正在編輯的草稿，打字時整欄就能預覽）。目錄還沒到時先全部當作認得（不會閃 #NAME?），到了只留目錄裡
// 有的——一個不認得的欄位會讓整批 /screener/values 400。百分比換成比例（跟 RETURN() 一樣），每檔存成一個 Map。
// 鍵含「目錄到了沒」：目錄到之前不抓；到了之後如果代碼都認得，欄位字串不會變，少了這一段就永遠不會去抓。
// 放在 shownColumn 之後：immediate 的 watcher 在 setup 時就會讀到它（TDZ）
const catalogReady = computed(() => schema.value.categories.length > 0)
const metricFields = computed(() => [...new Set(columns.value.flatMap(column => formulaMetrics(shownColumn(column).formula)))]
  .filter(field => !catalogReady.value || fieldOf(field))
  .sort())
const metricValues = shallowRef(new Map<string, Map<string, number | null>>())
const metricsFailed = ref(false)
const metricsKey = computed(() => `${catalogReady.value}|${holdings.value.map(holding => holding.symbol).join()}|${metricFields.value.join()}`)
async function loadMetrics() {
  const key = metricsKey.value
  // ponytail: 只送前 200 檔（/screener/values 一次的上限，跟報價同一個天花板）；第 201 檔起是「－」，真的有人持股超過 200 檔再分批
  const symbols = holdings.value.map(holding => holding.symbol).slice(0, 200)
  const fields = metricFields.value
  if (!catalogReady.value || !fields.length || !symbols.length) {
    metricsFailed.value = false
    return
  }
  try {
    const response = await fetchScreenerValues<{ value: string | null }>(symbols, fields)
    if (key !== metricsKey.value) return
    const percent = new Set(fields.filter(field => fieldOf(field)?.unit === '%'))
    metricValues.value = new Map(response.results.map(result => [result.symbol, new Map(fields.map((field) => {
      // 空字串不當 0
      const raw = result.values[field]?.value
      const value = raw ? Number(raw) : Number.NaN
      return [field, Number.isFinite(value) ? (percent.has(field) ? value / 100 : value) : null] as const
    }))]))
    metricsFailed.value = false
  } catch (error) {
    devWarn('holdings-columns', 'POST /screener/values (METRIC) failed', error)
    if (key === metricsKey.value) metricsFailed.value = true
  }
}
watch(metricsKey, () => void loadMetrics(), { immediate: true })
watchLoadFailure('holdings-metrics', () => metricsFailed.value, () => loadMetrics(), { scope: 'section' })

const columnByKey = (key: string) => columns.value.find(column => column.id === key)
function pickColumn(key: string) {
  const index = columns.value.findIndex(column => column.id === key)
  if (index !== -1) headerClicked(letters.value[index]!)
}
function editColumn(key: string) {
  const column = columnByKey(key)
  if (column) startEditing(column)
}

// ---- 公式參照上色（研究文件「公式列與畫布選區色彩雙向聯動」）：參照照出現順序配色，公式列的字與表格那一欄框同一個顏色 ----
const { resolvedMode } = useAppTheme()
const referenceColors = computed(() => {
  const palette = SHEET_REFERENCE_COLORS[resolvedMode.value === 'DARK' ? 'DARK' : 'LIGHT']
  const order: string[] = []
  for (const reference of formulaReferences(draft.formula)) {
    if (letters.value.includes(reference.letter) && !order.includes(reference.letter)) order.push(reference.letter)
  }
  return new Map(order.map((letter, index) => [letter, palette[index % palette.length]!]))
})
// 公式列的鏡像：參照的那幾段上色，其餘照常；輸入框本身的字是透明的，看到的是這一層
const formulaParts = computed(() => {
  const parts: { text: string; color?: string }[] = []
  let cursor = 0
  for (const reference of formulaReferences(draft.formula)) {
    const color = referenceColors.value.get(reference.letter)
    if (!color) continue
    if (reference.start > cursor) parts.push({ text: draft.formula.slice(cursor, reference.start) })
    parts.push({ text: draft.formula.slice(reference.start, reference.end), color })
    cursor = reference.end
  }
  parts.push({ text: draft.formula.slice(cursor) })
  return parts
})
const highlights = computed(() => (editingId.value
  ? Object.fromEntries([...referenceColors.value].map(([letter, color]) => [columns.value[letters.value.indexOf(letter)]!.id, color]))
  : {}))
// 公式長到要捲動時，鏡像跟著輸入框捲
const syncMirror = () => {
  if (formulaMirror.value && formulaInput.value) formulaMirror.value.scrollLeft = formulaInput.value.scrollLeft
}
// 輸入法選字時的 Enter／Esc 是給輸入法的，不算套用或取消
function onFormulaKey(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    void applyDraft()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEditing()
  }
}

// 放在最後：immediate 的 watcher 會立刻執行，用到的 editingId 必須已經宣告（否則 TDZ，2026-10-05 實際踩到）。
// 誰＋哪個帳戶（2026-10-19）：換帳戶就跟換人一樣重新載入
const { holdingsScope } = useHoldingsPortfolios()
watch([authResolved, holdingsScope], ([resolved, uid]) => {
  if (!resolved) return
  editingId.value = null
  if (uid) {
    ensureLoaded()
    columnsReady.value = false
    loadColumns()
  } else {
    clear()
    columns.value = []
  }
}, { immediate: true })
</script>

<template>
  <HoldingsPageShell title="自訂欄位" subtitle="像 Excel 一樣用欄位字母寫公式，例如 =A*C 就是「股數 × 收盤價」" guest-title="登入後設定你的自訂欄位" guest-text="公式存在你的帳號裡，換電腦或手機都在。" :pending="(pending && !holdings.length) || !columnsReady">
    <template #default="{ loading }">

      <!-- 讀不到：彈窗會說明並自動重讀；留空佔住這一支，免得落到下面的「還沒有持股」 -->
      <template v-if="loadFailed" />

      <el-empty v-else-if="!loading && !holdings.length" description="還沒有記錄任何持股，先到持股總覽記一筆交易或匯入成交明細" :image-size="64" />

      <template v-else>

        <!-- 工具列（2026-10-23，方案頁選 A「一條工具列」）：新增、排序（選取的格子所在的那一欄）、下載一條排開，手機上自己換行 -->
        <h2 class="visually-hidden">工具列</h2>
        <div class="columns-toolbar" role="group" aria-label="工具列">
          <!-- 讀的時候照畫、先不能按：欄位還沒讀到就加，存檔會蓋掉帳號裡的欄位。存檔還沒回來、或正在改某一欄的公式時也不能加 -->
          <el-button type="primary" :icon="Plus" :disabled="loading || atQuota || saving || !!editingId" @click="pickerOpen = true">新增指標</el-button>
          <el-button ref="addButton" :icon="Plus" :disabled="loading || atQuota || saving || !!editingId" @click="addColumn">新增公式</el-button>
          <span class="columns-toolbar__sep" aria-hidden="true" />
          <div class="columns-toolbar__sort" role="group" :aria-label="`排序：${selectedLabel ?? '選取的那一欄'}`">
            <span class="columns-toolbar__label">排序<b v-if="selectedLabel" class="columns-toolbar__target">{{ selectedLabel }}</b></span>
            <el-button :class="{ 'is-on': isSortedBy('ascending') }" :aria-pressed="isSortedBy('ascending')" :disabled="loading || !selectedLabel" @click="sortSelected('ascending')">
              <SharedSortIcon state="ascending" />由小到大
            </el-button>
            <el-button :class="{ 'is-on': isSortedBy('descending') }" :aria-pressed="isSortedBy('descending')" :disabled="loading || !selectedLabel" @click="sortSelected('descending')">
              <SharedSortIcon state="descending" />由大到小
            </el-button>
            <el-button :disabled="!sheetSort" @click="clearSort">取消排序</el-button>
            <span v-if="sheetSort && sortedLabel && sheetSort.key !== selectedKey" class="columns-toolbar__status">目前依{{ sortedLabel }}{{ ORDER_TEXT[sheetSort.order] }}</span>
          </div>
        </div>
        <p v-if="atQuota && !editingId" class="columns-toolbar__help" role="status">
          你的方案最多 {{ columnQuota }} 欄（預設的欄位也算在內）。可以刪掉不需要的欄位再新增，或之後升級專業版。<NuxtLink to="/profile#plan">看方案</NuxtLink>
        </p>
        <p v-if="!editingId" class="columns-toolbar__help">「新增指標」從指標目錄挑（例如 ROE），「新增公式」用欄位字母自己算。點任一欄的表頭可以改名、改公式或刪除；要排序就點那一欄的任一格，再按「由小到大」或「由大到小」。</p>

        <h2 v-if="editingId" class="visually-hidden">公式列</h2>
        <div v-if="editingId" class="formula-bar" role="group" aria-label="公式列">
          <span class="formula-bar__letter" aria-hidden="true">{{ editingLetter }}</span>
          <el-input v-model="draft.label" class="formula-bar__label" maxlength="20" aria-label="欄位名稱" placeholder="欄位名稱" />
          <span class="formula-bar__fx" aria-hidden="true">fx</span>
          <div class="formula-bar__formula formula-input">
            <div ref="formulaMirror" class="formula-input__mirror" aria-hidden="true"><span v-for="(part, index) in formulaParts" :key="index" :style="part.color ? { color: part.color } : undefined">{{ part.text }}</span></div>
            <input
              ref="formulaInput"
              v-model="draft.formula"
              class="formula-input__field"
              maxlength="200"
              aria-label="公式"
              aria-describedby="formula-help"
              placeholder="=A*C"
              spellcheck="false"
              autocomplete="off"
              @keydown="onFormulaKey"
              @scroll="syncMirror"
              @input="syncMirror"
              @keyup="syncMirror"
            >
          </div>
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
            {{ labelError || parseError || '點任一欄的表頭或格子可以把它的字母插進公式。可用 + − × ÷ ^ %、ROUND、ABS、MIN、MAX、SUM、AVERAGE、IF、IFERROR；整欄寫成 D:D，例如市值占比 =D/SUM(D:D)；持股資料用 SHARES()、PRICE() 等函數（見表格下方）。' }}
          </p>
        </div>

        <SharedMetricColumnPicker v-model="pickerOpen" title="新增指標" @select="addMetricColumn" />

        <p class="visually-hidden" role="status">{{ labelError || parseError || statusText }}</p>

        <!-- 試算表本來就是橫向看的：手機上維持左右捲動，股票欄固定在左邊（使用者 2026-10-07 選定） -->
        <h2 class="visually-hidden">持股表</h2>
        <!-- 表頭與格子都可以點：沒在編輯時是修改那一欄（表頭點一下、格子按 F2 或雙擊）；編輯中是把那一欄的字母插進公式 -->
        <SharedSheetGrid
          :rows="loading ? skeletonRows : rows"
          :columns="loading ? skeletonSheetColumns : sheetColumns"
          :aria-busy="loading"
          v-model:sort="sheetSort"
          :row-key="row => row.symbol"
          label="持股表"
          fit
          toolbar-sort
          @active-column="key => selectedKey = key"
          :pointing="!!editingId"
          :highlights="highlights"
          hint="方向鍵移動、Shift＋方向鍵框選、Ctrl+C 複製；表頭上按 Enter、格子上按 F2 修改那一欄的公式；股票格上按 Enter 進到連結、再按一次開啟個股頁。"
          @pick="column => !loading && pickColumn(column.key)"
          @header-activate="column => !loading && editColumn(column.key)"
          @edit="(_row, column) => !loading && editColumn(column.key)"
        >
          <template #header="{ column, index }">
            <template v-if="column.key === STOCK_KEY">股票</template>
            <span v-else-if="loading" class="column-header">
              <span class="column-header__letter">{{ column.label }}</span><span class="app-skeleton app-skeleton--inline columns-page__skeleton" aria-hidden="true" />
            </span>
            <span
              v-else
              class="column-header"
              :data-column-id="column.key"
              :class="{ 'is-editing': column.key === editingId, 'is-pickable': editingId && column.key !== editingId }"
            >
              <span class="column-header__letter" :style="referenceColors.get(letters[index - 1]!) ? { color: referenceColors.get(letters[index - 1]!) } : undefined">{{ letters[index - 1] }}</span>{{ shownColumn(columns[index - 1]!).label }}
            </span>
          </template>
          <template #cell="{ row, column, text }">
            <span v-if="loading" class="app-skeleton app-skeleton--inline columns-page__skeleton" aria-hidden="true" />
            <!-- 股票：代號在前、連到個股頁（2026-10-23，使用者：「股票的欄位要加上超連結 而且代碼要在前」）。編輯公式時（選點模式）只畫字：
                 那時點格子是插入參照，連結會把正在打的公式帶離這一頁 -->
            <template v-else-if="column.key === STOCK_KEY">
              <template v-if="editingId"><span class="columns-page__code">{{ row.symbol }}</span> {{ row.name }}</template>
              <NuxtLink v-else :to="securityPath(row.symbol)" class="stock-name-link"><span class="columns-page__code">{{ row.symbol }}</span> {{ row.name }}</NuxtLink>
            </template>
            <template v-else>{{ text }}</template>
          </template>
        </SharedSheetGrid>

        <p class="columns-page__footnote">
          每一欄都能改名、改公式或刪除。持股資料用函數取得：SHARES() 股數、AVGCOST() 平均成本、PRICE() 收盤價、MARKETVALUE() 市值、PNL() 未實現損益、RETURN() 報酬率（比例，0.2 代表 20%）、DIVIDEND() 預估年股利、DAYCHANGE() 今日漲跌、DAYRETURN() 今日漲跌幅（比例）。指標用 METRIC("roe.TTM")，「新增指標」會幫你寫好；百分比的指標在公式裡是比例（0.152 代表 15.2%）。沒有報價、成本不明，或 ETF、特別股沒有的指標，格子顯示「－」；除以 0 是 #DIV/0!。
        </p>
      </template>
    </template>
  </HoldingsPageShell>
</template>

<style scoped>
.columns-page__code {
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.columns-page__skeleton {
  width: 4em;
}

.columns-page__footnote {
  margin: 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
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

/* 公式輸入框：字是透明的，看到的是後面那層同字型、同內距的彩色鏡像（參照上色）；游標與反白照常 */
.formula-input {
  position: relative;
  min-height: 44px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base, 4px);
  background: var(--el-fill-color-blank);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 1rem;
}

.formula-input:focus-within {
  border-color: var(--el-color-primary);
}

.formula-input__mirror,
.formula-input__field {
  box-sizing: border-box;
  padding: 0 11px;
  font: inherit;
  letter-spacing: normal;
  white-space: pre;
}

.formula-input__mirror {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
  color: var(--el-text-color-primary);
  pointer-events: none;
}

.formula-input__field {
  position: relative;
  width: 100%;
  min-height: 42px;
  border: 0;
  background: transparent;
  color: transparent;
  caret-color: var(--el-text-color-primary);
}

.formula-input__field::placeholder {
  color: var(--el-text-color-placeholder);
}

.formula-input__field::selection {
  background: color-mix(in srgb, var(--el-color-primary) 30%, transparent);
}

.column-header {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-weight: 600;
}

.column-header__letter {
  color: var(--el-text-color-regular);
  font-weight: 700;
}

.column-header.is-editing {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  color: var(--el-color-primary);
}

.column-header.is-pickable {
  cursor: copy;
}

/* 下載鈕靠右，放在表格正上方 */
/* 工具列（方案 A）：一條排開、放不下就換行；按鈕 44px（觸控下限，同公式列）。下載靠右 */
.columns-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.columns-toolbar :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}

.columns-toolbar__sep {
  align-self: stretch;
  width: 1px;
  margin: 6px 4px;
  background: var(--app-divider);
}

.columns-toolbar__sort {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.columns-toolbar__label {
  color: var(--el-text-color-regular);
}

.columns-toolbar__target {
  margin-left: 6px;
  color: var(--el-text-color-primary);
  font-weight: 600;
}

/* 正在用的方向：主色最淡那一階的底、主色的框與字，同外觀設定的選中樣子 */
.columns-toolbar__sort :deep(.el-button.is-on) {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary-dark-2);
  font-weight: 600;
}

.columns-toolbar__sort :deep(.sort-icon) {
  margin-right: 4px;
}

.columns-toolbar__status {
  color: var(--el-text-color-regular);
}

.columns-toolbar__help {
  margin: 0;
  color: var(--el-text-color-regular);
}

/* 手機：分隔線不畫（換行之後它會落在行首） */
@media (max-width: 767px) {
  .columns-toolbar__sep {
    display: none;
  }
}
</style>
