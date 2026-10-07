<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { Delete, Edit, Plus, Upload } from '@element-plus/icons-vue'
import type { StockSuggestion } from '~/composables/stock/useStockSearch'
import type { Holding, Transaction } from '~/composables/stock/useHoldings'

// 持股管理（2026-10-05）。**持股是交易紀錄的唯讀投影**（bff-ts 4467c44，使用者決定）：這一頁能做的
// 寫入只有「記一筆交易」「改／刪一筆交易」「刪除一檔（＝它的所有交易）」，股數與成本（先進先出）由
// bff-ts 重算。很久以前買、記不得每一筆的部位，就用最早的日期記一筆買進、價格填平均成本（期初部位）；
// 配股記成價格 0 的買進。
//
// 總市值、損益、預估股利在 app/utils/holdings-summary.ts 算——持股是個資，不送去任何新的伺服器路由。
//
// 刻意沒有的東西（投信投顧法、釋字 634）：買賣點、目標價、停損、健康燈號、開發者預設門檻的提醒，
// 以及「今日漲跌」——反遊戲化，主視覺是持有的結果，不是當天的波動；記一筆交易成功也只給中性提示。
//
// 之後的「稅後現金流試算」要注意：ETF 的配息組成（export.fundclear_etf_dividend 的 composition_*）
// 是發行人公告前的「預估」值，每列都帶 distribution_warning（sitca-ts 經 analysis-ts 轉告
// 2026-09-22）。拆解畫面必須標示為預估——收益平準金佔比正是投資人判斷「是不是配到自己本金」的數字。
//
// Personal/settings page: nothing here is content for a crawler — out of the index, and out of the
// sitemap via nuxt.config's own sitemap.exclude.
useSeoMeta({ title: '持股管理', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const { open: openLogin } = useLoginDialog()
const {
  holdings, pending, loadFailed, market, quotesFailed, etfWindow, transactions, marketYield,
  load, ensureLoaded, clear, loadTransactions, saveTransaction, removeHolding, removeTransaction, importTrades, clearAll
} = useHoldings()
const importVisible = ref(false)
usePostLoginLoader().registerPending(pending)

// 登入狀態只在瀏覽器裡才知道，而 Firebase 可能在 hydration 之前就解析完——那時 client 的第一次渲染
// 會跟 SSR 的「還不知道」不同（實測 2026-10-05：Hydration node mismatch）。掛載前一律當成還不知道。
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

// ---- 交易紀錄（一次看一檔） ----

// 展開了交易紀錄的代號（可以同時展開好幾檔）。桌機用 el-table 的展開列、手機就在卡片裡。
const expanded = ref<string[]>([])

// 依使用者身分而不是只看 currentUser：登出要清空，換一個人登入要重新載入。
watch([authResolved, () => currentUser.value?.uid], ([resolved, uid]) => {
  if (!resolved) return
  expanded.value = []
  if (uid) ensureLoaded()
  else clear()
}, { immediate: true })

const { data: companies } = useCompanyIndex()
const { keyword, fetchSuggestions, isCompanyEntry, routeFor } = useStockSearch()
const companyByCode = computed(() => new Map(companies.value.map(entry => [entry.code, entry])))

function symbolLabel(symbol: string): string {
  const entry = companyByCode.value.get(symbol)
  return entry ? `${entry.name} ${symbol}` : symbol
}

const baseRows = computed(() => holdings.value.map((holding) => {
  const quote = market.value[holding.symbol]
  const entry = companyByCode.value.get(holding.symbol)
  const input = { quantity: holding.quantity, costUnknownQuantity: holding.costUnknownQuantity, averageCost: holding.averageCost, price: quote?.price, dividendPerShare: quote?.dividendPerShare }
  return {
    holding,
    name: entry?.name ?? holding.symbol,
    label: symbolLabel(holding.symbol),
    kind: entry?.kind ?? 'common',
    link: entry ? routeFor(entry) : `/stock/${holding.symbol}`,
    input,
    figures: holdingRowFigures(input)
  }
}))
const totals = computed(() => summarizeHoldings(baseRows.value.map(row => row.input)))

// 預設依市值由大到小（2026-10-05 UI 盤點：「哪幾檔最大」是看持股的第一個問題），表頭可以再點選排序。
// 占比、圓餅圖、產業占比都在「持股分析」頁（使用者 2026-10-05：「持股總覽那邊就可以簡化」）。
// 寬螢幕點表頭排序；手機卡片沒有表頭，用「排序」選單（只跟卡片一起出現）。
// 2026-10-07 曾把表頭排序拿掉、桌機也改用選單，理由是「表頭不能用鍵盤排」——錯的：Element Plus 2.14 的排序箭頭
// 本來就是 <button>（可 Tab、Enter），<th> 也帶 aria-sort（使用者 2026-10-08 問「為什麼不直接點表頭」後查原始碼確認）。
// 排序按鈕的中文名稱在 app.vue 的語系覆寫。
// 選單：數字大到小、代號小到大；沒有值的一律排最後（表頭升冪時排最前，el-table 只會把同一個比較反過來）。
type BaseRow = (typeof baseRows.value)[number]
const SORT_OPTIONS: { value: string; label: string; pick: (row: BaseRow) => number | string | null }[] = [
  { value: 'marketValue', label: '市值（大到小）', pick: row => row.figures.marketValue },
  { value: 'pnl', label: '未實現損益（大到小）', pick: row => row.figures.pnl },
  { value: 'pnlPct', label: '報酬率（高到低）', pick: row => row.figures.pnlPct },
  { value: 'annualDividend', label: '預估年股利（大到小）', pick: row => row.figures.annualDividend },
  { value: 'quantity', label: '股數（多到少）', pick: row => row.holding.quantity },
  { value: 'symbol', label: '代號', pick: row => row.holding.symbol }
]
const sortKey = ref('marketValue')
// 升冪比較，沒有值當最小。選單與表頭共用。
function compareBy(key: string) {
  const pick = (SORT_OPTIONS.find(option => option.value === key) ?? SORT_OPTIONS[0]!).pick
  return (a: BaseRow, b: BaseRow) => {
    const x = pick(a)
    const y = pick(b)
    if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y)
    if (x === null || y === null) return x === y ? 0 : x === null ? -1 : 1
    return (x as number) - (y as number)
  }
}
const rows = computed(() => {
  const compare = compareBy(sortKey.value)
  return [...baseRows.value].sort(sortKey.value === 'symbol' ? compare : (a, b) => compare(b, a))
})
type HoldingRow = (typeof rows.value)[number]


// 沒算進總覽的部分，合成一行（只在有的時候出現）。寫出是哪幾檔（2026-10-07「未計入：1 檔無報價 是哪一檔」）：
// 只有數字的話，使用者得逐列掃明細表找那一檔。判斷條件跟 summarizeHoldings 的三個計數一致；名單超過 5 檔
// 只列前 5 檔加「等」，免得這一行比總覽還長。
function excludedClause(count: number, label: string, pick: (row: (typeof baseRows.value)[number]) => boolean): string {
  if (!count) return ''
  const names = baseRows.value.filter(pick).map(row => row.label)
  const shown = names.slice(0, 5).join('、')
  return `${count} 檔${label}（${shown}${names.length > 5 ? ' 等' : ''}）`
}
const excludedText = computed(() => [
  excludedClause(totals.value.unpricedCount, '無報價', row => row.figures.marketValue === null),
  excludedClause(totals.value.dividendMissingCount, '無股利資料', row => row.figures.annualDividend === null),
  excludedClause(totals.value.costUnknownCount, '有成本不明的股數', row => (row.input.costUnknownQuantity ?? 0) > 0)
].filter(Boolean).join('；'))

// 組合殖利率 vs 大盤（使用者 2026-10-05 在 bff-ts 問「殖利率跟大盤比呢」）：同一個來源（交易所公布的殖利率）、
// 依市值加權。只陳述，不評論——殖利率高也可能是股價跌下來的。
const portfolioYield = computed(() => weightedDividendYield(rows.value.map(row => ({ marketValue: row.figures.marketValue, yieldPct: market.value[row.holding.symbol]?.dividendYield ?? null }))))
const yieldDates = computed(() => {
  const dates = [...new Set(rows.value.map(row => market.value[row.holding.symbol]?.yieldDate).filter((date): date is string => !!date))].sort()
  if (!dates.length) return ''
  return dates.length === 1 ? dates[0]! : `${dates[0]}～${dates.at(-1)}`
})


// 各檔的報價日期可能不同（暫停交易的那一檔停在舊日期）；註腳寫最新的那一天。
// 那一天沒有收盤價、改用較早一筆的持股（見 useHoldings 的 loadQuotes），照實寫出用的是哪一天
const olderPriceText = computed(() => {
  const latest = priceDates.value.at(-1)
  if (!latest) return ''
  return baseRows.value
    .flatMap(row => {
      const date = market.value[row.holding.symbol]?.priceDate
      return date && date < latest ? [`${row.label} 用 ${date} 的收盤價`] : []
    })
    .join('、')
})
const priceDates = computed(() => [...new Set(Object.values(market.value).map(quote => quote.priceDate).filter(Boolean))].sort() as string[])

const money = holdingsMoney
const signedMoney = holdingsSignedMoney

function signedPct(value: number | null): string {
  if (value === null) return ''
  const fixed = value.toFixed(2)
  if (Number(fixed) === 0) return '0.00%'
  return `${value > 0 ? '+' : ''}${fixed}%`
}

function plainNumber(value: string | number): string {
  return groupThousands(String(Number(value)))
}

// 平均成本只算成本已知的股數；有成本不明的股數時照實寫出來，不讓人以為均價涵蓋全部股數
function averageCostText(holding: Holding): string {
  if (holding.averageCost === null) return '成本不明'
  const text = plainNumber(holding.averageCost)
  return holding.costUnknownQuantity > 0 ? `${text}（另 ${groupThousands(holding.costUnknownQuantity)} 股成本不明）` : text
}

// 交易日期以台北時間為準：使用者在國外時，每天前 8 小時會差一天。
function todayInTaipei(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
}

function clearEverything() {
  expanded.value = []
  clearAll()
}

function toggleLedger(symbol: string) {
  if (expanded.value.includes(symbol)) {
    expanded.value = expanded.value.filter(item => item !== symbol)
    return
  }
  expanded.value = [...expanded.value, symbol]
  loadTransactions(symbol)
}

// ---- 記一筆交易／編輯交易 ----

const dialogVisible = ref(false)
const editing = ref<Transaction | null>(null)
// 從某一檔的列上打開時，股票已經決定好了
const lockedSymbol = ref<string | null>(null)
const saving = ref(false)
const notice = ref('')
const formRef = ref<FormInstance>()
const form = reactive({
  symbol: '',
  action: 'BUY' as 'BUY' | 'SELL',
  tradeDate: '',
  quantity: undefined as number | undefined,
  price: undefined as number | undefined,
  fee: 0,
  tax: 0,
  note: '',
  // 「不知道成本」（例如很久以前買的、券商紀錄已過期）：庫存照算、損益不計入。只限買進。
  costUnknown: false
})
let selectedLabel = ''

const dialogSymbol = computed(() => editing.value?.symbol ?? lockedSymbol.value)
const heldQuantity = computed(() => holdings.value.find(holding => holding.symbol === form.symbol)?.quantity ?? 0)

const rules: FormRules = {
  symbol: [{ validator: (_rule, _value, callback) => (form.symbol ? callback() : callback(new Error('請從清單中選擇一檔股票'))) }],
  tradeDate: [{ required: true, message: '請選擇交易日期' }],
  quantity: [{ required: true, message: '請輸入股數' }],
  price: [{ validator: (_rule, _value, callback) => (form.price != null || (form.action === 'BUY' && form.costUnknown) ? callback() : callback(new Error('請輸入成交價'))) }]
}

// el-date-picker 給的是本地午夜的 Date；用本地日期比，不要 toISOString（UTC+8 會倒退一天）。
function disabledFutureDate(date: Date): boolean {
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return local > todayInTaipei()
}

// 選好之後又改了文字＝那個選擇已經不算數
watch(keyword, (value) => {
  if (!dialogSymbol.value && value !== selectedLabel) form.symbol = ''
})

function selectStock(item: Record<string, unknown>) {
  const suggestion = item as unknown as StockSuggestion
  if (!isCompanyEntry(suggestion)) return
  selectedLabel = `${suggestion.code} ${suggestion.name}`
  form.symbol = suggestion.code
  keyword.value = selectedLabel
}

function openRecord(symbol: string | null = null) {
  editing.value = null
  lockedSymbol.value = symbol
  Object.assign(form, { symbol: symbol ?? '', action: 'BUY', tradeDate: todayInTaipei(), quantity: undefined, price: undefined, fee: 0, tax: 0, note: '', costUnknown: false })
  selectedLabel = ''
  keyword.value = ''
  notice.value = ''
  dialogVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

function openEditTransaction(transaction: Transaction) {
  editing.value = transaction
  lockedSymbol.value = null
  Object.assign(form, {
    symbol: transaction.symbol,
    action: transaction.action,
    tradeDate: transaction.tradeDate,
    quantity: transaction.quantity,
    price: transaction.costUnknown ? undefined : Number(transaction.price),
    fee: Number(transaction.fee),
    tax: Number(transaction.tax),
    note: transaction.note ?? '',
    costUnknown: transaction.costUnknown
  })
  notice.value = ''
  dialogVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

async function submit() {
  if (!(await formRef.value?.validate().catch(() => false))) return
  saving.value = true
  notice.value = ''
  const result = await saveTransaction(editing.value?.id ?? null, {
    symbol: form.symbol,
    action: form.action,
    quantity: form.quantity!,
    price: form.price ?? 0,
    fee: form.fee ?? 0,
    tax: form.tax ?? 0,
    tradeDate: form.tradeDate,
    note: form.note,
    costUnknown: form.action === 'BUY' && form.costUnknown
  })
  saving.value = false
  if (result.ok) {
    dialogVisible.value = false
    ElMessage.success(editing.value ? '已更新這筆交易' : '已記錄')
    return
  }
  // 對話框不關、輸入保留——除了「那一筆已經不在了」
  if (result.reason === 'oversold') notice.value = oversoldMessage(result.message)
  else if (result.reason === 'unknown') notice.value = `系統目前無法確認代號 ${form.symbol}，暫時無法記錄。`
  else if (result.reason === 'gone') {
    dialogVisible.value = false
    ElMessage.warning('這筆交易已經不存在，可能已在其他裝置刪除')
  } else showErrorMessage(result.message ?? '儲存失敗，請稍後再試')
}
</script>

<template>
  <div class="holdings-page">
    <div class="holdings-page__header">
      <div class="holdings-page__heading">
        <h1 class="holdings-page__title">持股管理</h1>
      </div>
      <div v-if="mounted && currentUser && !loadFailed && holdings.length" class="holding-actions">
        <el-button size="large" :icon="Upload" @click="importVisible = true">匯入成交明細</el-button>
        <el-button type="primary" size="large" :icon="Plus" @click="openRecord()">記一筆交易</el-button>
      </div>
    </div>

    <HoldingsNav />

    <!-- 登入狀態還沒確定：不畫訪客卡片也不畫持股骨架，免得重新整理時先閃一下錯的那一個 -->
    <div v-if="!mounted || !authResolved" v-loading="true" class="holdings-page__placeholder" />

    <section v-else-if="!currentUser" class="holdings-guest">
      <h2 class="holdings-guest__title">登入後開始記錄持股</h2>
      <p class="holdings-guest__text">持股資料存在你的帳號裡，只有你看得到。</p>
      <el-button type="primary" size="large" @click="openLogin">登入／註冊</el-button>
    </section>

    <el-alert v-else-if="loadFailed" type="error" :closable="false" show-icon title="持股資料暫時無法載入">
      <el-button class="holdings-page__retry" @click="load">重新載入</el-button>
    </el-alert>

    <div v-else-if="pending && !holdings.length" v-loading="true" class="holdings-page__placeholder" />

    <el-empty v-else-if="!holdings.length" description="還沒有記錄任何持股" :image-size="64">
      <p class="holdings-page__empty-hint">可以匯入券商的成交明細 CSV，或一筆一筆記。很久以前買的股票，用最早的日期記一筆買進、價格填平均成本即可。</p>
      <div class="holding-actions holding-actions--center">
        <el-button size="large" :icon="Upload" @click="importVisible = true">匯入成交明細</el-button>
        <el-button type="primary" size="large" :icon="Plus" @click="openRecord()">記一筆交易</el-button>
      </div>
    </el-empty>

    <template v-else>
      <section aria-labelledby="holdings-summary-title">
        <h2 id="holdings-summary-title" class="holdings-page__section-title">總覽</h2>
        <dl class="holdings-summary">
          <div class="holdings-summary__item">
            <dt>總市值<template v-if="priceDates.length">（{{ priceDates.at(-1)!.slice(5).replace('-', '/') }} 收盤）</template></dt>
            <dd>{{ totals.marketValue === null ? '－' : `${money(totals.marketValue)} 元` }}</dd>
          </div>
          <div class="holdings-summary__item">
            <dt>未實現損益</dt>
            <dd :class="priceDirectionClass(totals.pnl === null ? null : Math.round(totals.pnl))">
              {{ signedMoney(totals.pnl) }}
              <span v-if="totals.pnlPct !== null" class="holdings-summary__pct">（{{ signedPct(totals.pnlPct) }}）</span>
            </dd>
          </div>
          <div class="holdings-summary__item">
            <dt>預估年度股利</dt>
            <dd>{{ totals.annualDividend === null ? '－' : `${money(totals.annualDividend)} 元` }}</dd>
          </div>
          <div class="holdings-summary__item">
            <dt>殖利率（市值加權）</dt>
            <dd>
              {{ portfolioYield.value === null ? '－' : `${portfolioYield.value.toFixed(2)}%` }}
              <span v-if="marketYield" class="holdings-summary__compare">大盤 {{ marketYield.value.toFixed(2) }}%</span>
            </dd>
          </div>
        </dl>
        <!-- 使用者 2026-10-05：「holdings 希望減少不必要的說明，避免注意力分散」。只在真的有東西沒算進去時出一行；
             計算口徑全部收進最下面的「計算方式」。 -->
        <el-alert v-if="quotesFailed" type="warning" :closable="false" show-icon title="報價暫時無法取得，市值與損益暫不顯示" class="holdings-page__quote-alert" />
        <p v-else-if="excludedText" class="holdings-page__excluded">未計入：{{ excludedText }}</p>
      </section>

      <section aria-labelledby="holdings-list-title">
        <h2 id="holdings-list-title" class="holdings-page__section-title">持股明細（{{ holdings.length }} 檔）</h2>
        <!-- view-card：選單只跟卡片一起出現（寬螢幕用表頭） -->
        <label class="holdings-sort view-card">
          <span>排序</span>
          <select v-model="sortKey" class="holdings-sort__select">
            <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>

        <el-table class="view-table" :data="rows" row-key="holding.symbol" :expand-row-keys="expanded" @sort-change="({ prop }: { prop: string | null }) => { if (prop) sortKey = prop }">
          <!-- 展開列只拿來放交易紀錄；開關是「明細」那顆按鈕（aria-expanded）。el-table 自己的展開箭頭藏起來，
               免得同一件事有兩個開關 -->
          <el-table-column type="expand" label="交易紀錄" width="1" class-name="holdings-expand-col" label-class-name="holdings-expand-col">
            <template #default="{ row }">
              <HoldingsDetailPanel
                :holding="tableRow<HoldingRow>(row).holding"
                :average-cost="averageCostText(tableRow<HoldingRow>(row).holding)"
                :price="tableRow<HoldingRow>(row).figures.marketValue === null ? '－' : plainNumber(tableRow<HoldingRow>(row).input.price!)"
                :label="tableRow<HoldingRow>(row).label"
                :entries="transactions[tableRow<HoldingRow>(row).holding.symbol]"
                :symbol-label="symbolLabel"
                @record="openRecord(tableRow<HoldingRow>(row).holding.symbol)"
                @remove-holding="removeHolding(tableRow<HoldingRow>(row).holding, tableRow<HoldingRow>(row).label)"
                @retry="loadTransactions(tableRow<HoldingRow>(row).holding.symbol)"
                @edit="openEditTransaction"
                @remove-transaction="removeTransaction"
              />
            </template>
          </el-table-column>
          <el-table-column label="名稱" prop="symbol" min-width="170" sortable :sort-method="compareBy('symbol')">
            <template #default="{ row }">
              <div class="holding-name">
                <NuxtLink :to="tableRow<HoldingRow>(row).link">{{ tableRow<HoldingRow>(row).name }}</NuxtLink>
                <span class="holding-name__code">{{ tableRow<HoldingRow>(row).holding.symbol }}</span>
                <el-tag v-if="tableRow<HoldingRow>(row).kind === 'etf'" size="small" effect="plain">ETF</el-tag>
                <el-tag v-else-if="tableRow<HoldingRow>(row).kind === 'preferred'" size="small" effect="plain">特別股</el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="股數" prop="quantity" align="right" min-width="100" sortable :sort-method="compareBy('quantity')">
            <template #default="{ row }">{{ groupThousands(tableRow<HoldingRow>(row).holding.quantity) }}</template>
          </el-table-column>
          <el-table-column label="市值" prop="marketValue" align="right" min-width="120" sortable :sort-method="compareBy('marketValue')">
            <template #default="{ row }">{{ tableRow<HoldingRow>(row).figures.marketValue === null ? '－' : money(tableRow<HoldingRow>(row).figures.marketValue!) }}</template>
          </el-table-column>
          <el-table-column label="未實現損益" prop="pnl" align="right" min-width="140" sortable :sort-method="compareBy('pnl')">
            <template #default="{ row }">
              <span :class="priceDirectionClass(tableRow<HoldingRow>(row).figures.pnl === null ? null : Math.round(tableRow<HoldingRow>(row).figures.pnl!))">
                {{ signedMoney(tableRow<HoldingRow>(row).figures.pnl) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="報酬率" prop="pnlPct" align="right" min-width="110" sortable :sort-method="compareBy('pnlPct')">
            <template #default="{ row }">
              <span :class="priceDirectionClass(tableRow<HoldingRow>(row).figures.pnlPct === null ? null : Number(tableRow<HoldingRow>(row).figures.pnlPct!.toFixed(2)))">
                {{ signedPct(tableRow<HoldingRow>(row).figures.pnlPct) || '－' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="預估年股利" prop="annualDividend" align="right" min-width="120" sortable :sort-method="compareBy('annualDividend')">
            <template #default="{ row }">{{ tableRow<HoldingRow>(row).figures.annualDividend === null ? '－' : money(tableRow<HoldingRow>(row).figures.annualDividend!) }}</template>
          </el-table-column>
          <!-- 每列只留一顆「明細」（2026-10-05 UI 盤點：原本每列三顆按鈕，26 檔就是 78 顆，比數字還搶眼）。
               記一筆、刪除這檔移進展開的明細裡。 -->
          <el-table-column label="明細" min-width="110">
            <template #default="{ row }">
              <!-- 念出來的名稱＝看得到的字＋股票名（WCAG 2.5.3），狀態交給 aria-expanded -->
              <el-button
                :aria-expanded="expanded.includes(tableRow<HoldingRow>(row).holding.symbol)"
                @click="toggleLedger(tableRow<HoldingRow>(row).holding.symbol)"
              >
                {{ expanded.includes(tableRow<HoldingRow>(row).holding.symbol) ? '收合' : '明細' }}<span class="visually-hidden">：{{ tableRow<HoldingRow>(row).label }}</span>
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <ul class="view-card holding-cards">
          <li v-for="row in rows" :key="row.holding.symbol" class="holding-card holdings-card">
            <div class="holding-name">
              <NuxtLink :to="row.link">{{ row.name }}</NuxtLink>
              <span class="holding-name__code">{{ row.holding.symbol }}</span>
              <el-tag v-if="row.kind === 'etf'" size="small" effect="plain">ETF</el-tag>
              <el-tag v-else-if="row.kind === 'preferred'" size="small" effect="plain">特別股</el-tag>
            </div>
            <dl class="holding-card__figures">
              <div><dt>市值</dt><dd>{{ row.figures.marketValue === null ? '－' : money(row.figures.marketValue) }}</dd></div>
              <div>
                <dt>未實現損益</dt>
                <dd :class="priceDirectionClass(row.figures.pnl === null ? null : Math.round(row.figures.pnl))">
                  {{ signedMoney(row.figures.pnl) }} {{ signedPct(row.figures.pnlPct) }}
                </dd>
              </div>
            </dl>
            <el-button class="holding-card__toggle" :aria-expanded="expanded.includes(row.holding.symbol)" @click="toggleLedger(row.holding.symbol)">
              {{ expanded.includes(row.holding.symbol) ? '收合' : '明細' }}<span class="visually-hidden">：{{ row.label }}</span>
            </el-button>
            <template v-if="expanded.includes(row.holding.symbol)">
              <dl class="holding-card__figures">
                <div><dt>股數</dt><dd>{{ groupThousands(row.holding.quantity) }}</dd></div>
                <div><dt>預估年股利</dt><dd>{{ row.figures.annualDividend === null ? '－' : money(row.figures.annualDividend) }}</dd></div>
              </dl>
              <HoldingsDetailPanel
                :holding="row.holding"
                :average-cost="averageCostText(row.holding)"
                :price="row.figures.marketValue === null ? '－' : plainNumber(row.input.price!)"
                :label="row.label"
                :entries="transactions[row.holding.symbol]"
                :symbol-label="symbolLabel"
                @record="openRecord(row.holding.symbol)"
                @remove-holding="removeHolding(row.holding, row.label)"
                @retry="loadTransactions(row.holding.symbol)"
                @edit="openEditTransaction"
                @remove-transaction="removeTransaction"
              />
            </template>
          </li>
        </ul>

        <div class="holding-actions holdings-page__clear">
          <el-button type="danger" plain :icon="Delete" @click="clearEverything">清除全部持股與交易紀錄</el-button>
        </div>

        <details class="holdings-page__method holdings-details">
          <summary>計算方式</summary>
          <ul>
            <li>股數與成本由交易紀錄以先進先出（跟券商相同）算出，買進手續費計入成本；平均成本是目前還持有的那幾批的平均。成本不明的股數市值照算，未實現損益只算成本已知的部分。</li>
            <li v-if="priceDates.length">市值以 {{ priceDates.at(-1) }} 收盤價計算<template v-if="olderPriceText">；{{ olderPriceText }}</template>。</li>
            <li>預估年度股利＝持有股數 × 每股現金股利：普通股與 ETF 都採近 12 個月已除息的現金股利（普通股已換算配股後的股數<template v-if="etfWindow">；ETF 的區間是 {{ etfWindow.from }}～{{ etfWindow.to }}</template>）；特別股採發行條件所訂年股息。只反映過去實際配發，不代表未來配息金額。</li>
            <li>殖利率是交易所公布的每檔殖利率，依市值加權<template v-if="yieldDates">（{{ yieldDates }}）</template><template v-if="portfolioYield.coverage < 0.995">，涵蓋 {{ (portfolioYield.coverage * 100).toFixed(0) }}% 的市值（ETF 等沒有公布殖利率的不計入）</template>。<template v-if="marketYield">大盤是上市公司依市值加權<template v-if="marketYield.date">（{{ marketYield.date }}）</template>，不含上櫃，台積電等權值股的占比很大。</template>殖利率是股利除以股價，股價下跌也會讓它變高，不是報酬率。</li>
          </ul>
        </details>
      </section>

    </template>

    <HoldingsImportDialog v-model="importVisible" :import-trades="importTrades" :symbol-label="symbolLabel" />

    <el-dialog v-model="dialogVisible" :title="editing ? '編輯交易' : dialogSymbol ? `記一筆交易：${symbolLabel(dialogSymbol)}` : '記一筆交易'" width="min(520px, 92vw)">
      <el-alert v-if="notice" type="warning" :closable="false" :title="notice" class="holdings-form__notice" />
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="submit">
        <el-form-item v-if="!dialogSymbol" label="股票" prop="symbol">
          <el-autocomplete
            v-model="keyword"
            :fetch-suggestions="fetchSuggestions"
            class="holdings-form__full"
            placeholder="輸入代號或名稱，例如 2330 或 台積電"
            clearable
            @select="selectStock"
          >
            <template #default="{ item }">
              <span>{{ item.code }}</span>
              <span class="holdings-form__suggestion-name">{{ item.name }}</span>
              <el-tag v-if="isCompanyEntry(item) && item.kind === 'etf'" size="small" effect="plain">ETF</el-tag>
              <el-tag v-else-if="isCompanyEntry(item) && item.kind === 'preferred'" size="small" effect="plain">特別股</el-tag>
            </template>
          </el-autocomplete>
        </el-form-item>
        <p v-else class="holdings-form__fixed">股票：{{ symbolLabel(dialogSymbol) }}</p>
        <el-form-item label="買賣" prop="action">
          <el-radio-group v-model="form.action" size="large">
            <el-radio-button value="BUY">買進</el-radio-button>
            <el-radio-button value="SELL">賣出</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="交易日期" prop="tradeDate">
          <el-date-picker v-model="form.tradeDate" type="date" value-format="YYYY-MM-DD" format="YYYY/MM/DD" :disabled-date="disabledFutureDate" :clearable="false" class="holdings-form__full" />
          <p v-if="form.action === 'BUY' && !editing" class="holdings-form__hint">很久以前買、記不得每一筆？用最早的日期記一筆，價格填平均成本即可。</p>
        </el-form-item>
        <el-form-item label="股數（股）" prop="quantity">
          <el-input-number v-model="form.quantity" class="holdings-form__full" :min="1" :max="2147483647" :precision="0" :controls="false" />
          <p class="holdings-form__hint">
            1 張＝1,000 股；零股請直接輸入股數<template v-if="form.action === 'SELL' && form.symbol">。目前持有 {{ groupThousands(heldQuantity) }} 股</template>
          </p>
        </el-form-item>
        <el-form-item label="成交價（元／股）" prop="price">
          <el-input-number v-model="form.price" class="holdings-form__full" :min="0" :controls="false" :disabled="form.action === 'BUY' && form.costUnknown" />
          <el-checkbox v-if="form.action === 'BUY'" v-model="form.costUnknown" size="large" class="holdings-form__cost-unknown">不知道成本（例如很久以前買的）</el-checkbox>
          <p v-if="form.action === 'BUY'" class="holdings-form__hint">
            <template v-if="form.costUnknown">庫存照算，這批股票賣出時的損益不計入績效。</template>
            <template v-else>除權配股會自動入帳，不用自己記。</template>
          </p>
        </el-form-item>
        <el-form-item v-if="!(form.action === 'BUY' && form.costUnknown)" label="手續費（元）" prop="fee">
          <el-input-number v-model="form.fee" class="holdings-form__full" :min="0" :controls="false" />
        </el-form-item>
        <el-form-item v-if="form.action === 'SELL'" label="交易稅（元）" prop="tax">
          <el-input-number v-model="form.tax" class="holdings-form__full" :min="0" :controls="false" />
        </el-form-item>
        <el-form-item label="備註（選填）" prop="note">
          <el-input v-model="form.note" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="large" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" size="large" :loading="saving" @click="submit">儲存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.holdings-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.holdings-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

/* Real bug fixed 2026-09-16 ("全站嚴禁出現 負 margin 負 padding") — title + subtitle get their own
   8px gap block instead of pulling the subtitle up with a negative margin. */
.holdings-page__heading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.holdings-page__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}


.holdings-page__placeholder {
  min-height: 200px;
}

.holdings-sort {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.holdings-sort__select {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font: inherit;
}

.holding-card__toggle {
  min-height: 44px;
}

.holdings-page__retry {
  margin-top: 8px;
}

.holdings-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.holdings-guest {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.holdings-guest__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.holdings-guest__text {
  margin: 0;
  color: var(--el-text-color-regular);
}

.holdings-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin: 0;
}

.holdings-summary__item {
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.holdings-summary__item dt {
  color: var(--el-text-color-regular);
}

.holdings-summary__item dd {
  margin: 4px 0 0;
  font-size: 1.5rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* 跟在殖利率後面同一行（使用者 2026-10-05：「大盤的部分放在後面，不要放在下面，更善用版面空間」） */
.holdings-summary__compare {
  margin-left: 8px;
  white-space: nowrap;
  font-size: 1rem;
  font-weight: 400;
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.holdings-page__excluded {
  margin: 12px 0 0;
  color: var(--el-text-color-regular);
}

.holdings-page__quote-alert {
  margin-top: 12px;
}

.holdings-page__method {
  margin-top: 16px;
  color: var(--el-text-color-regular);
}

.holdings-page__method ul {
  margin: 0;
  padding-left: 20px;
  line-height: 1.7;
}


.holdings-summary__pct {
  font-size: 1rem;
}


.holding-name {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.holding-name__code {
  color: var(--el-text-color-regular);
  font-variant-numeric: tabular-nums;
}

.holding-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.holdings-page__clear {
  margin-top: 16px;
}

/* 數字欄用等寬數字，同一欄上下比較時位數對齊 */
.view-table :deep(td) {
  font-variant-numeric: tabular-nums;
}

/* 展開列貼齊整列（使用者 2026-10-05：「展開後總感覺四周邊框有空隙」）。Element Plus 的展開格自帶 20px／50px
   的內距，加上明細區塊自己的圓角與底色，看起來像表格裡又浮著一個盒子。內距歸零，由明細區塊自己決定留白。 */
.view-table :deep(.el-table__expanded-cell) {
  padding: 0;
}

/* 手機卡片裡不再包第二層底色：明細直接接在卡片裡，用一條分隔線分開 */
.holding-card :deep(.detail) {
  padding: 12px 0 0;
  border-top: 1px solid var(--el-border-color-lighter);
  background: none;
}

.holding-actions--center {
  justify-content: center;
}

.holding-actions :deep(.el-button) {
  min-height: 44px;
  margin: 0;
}

.holding-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  flex-direction: column;
  gap: 12px;
}

.holding-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.holding-card__figures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin: 0;
}

.holding-card__figures dt {
  color: var(--el-text-color-regular);
}

.holding-card__figures dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}


.holdings-form__notice {
  margin-bottom: 16px;
}

.holdings-form__full {
  width: 100%;
}

.holdings-form__cost-unknown {
  margin-top: 8px;
}

.holdings-form__hint {
  margin: 4px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.holdings-form__suggestion-name {
  margin: 0 8px;
  color: var(--el-text-color-secondary);
}

.holdings-page__empty-hint {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}





.holdings-form__fixed {
  margin: 0 0 16px;
  font-weight: 600;
}

.view-table :deep(td.holdings-expand-col .cell) {
  display: none;
}

/* 表頭留著名稱給螢幕閱讀器（空白表頭會被念成沒有名字的欄，axe empty-table-header），畫面上不佔位 */
.view-table :deep(th.holdings-expand-col .cell) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.view-card {
  display: none;
}

@media (max-width: 767px) {
  .holdings-summary {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* 表格／卡片的切換點設在 1279px，不是全站的 767px（使用者 2026-10-05：「a11y 要求放大 200% 也不可以跑版」）。
   量過：1920 寬放大 200%（=960px）溢出 148px；1024px 橫向螢幕會出現左側導覽欄，內容只剩約 750px，7 欄表格
   至少要約 870px，溢出 142px。1280px 以上（含字型 120%）量到 0。 */
@media (max-width: 1279px) {
  .view-table {
    display: none;
  }

  .view-card {
    display: flex;
  }
}
</style>
