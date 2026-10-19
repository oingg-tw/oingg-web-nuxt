<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { Delete, Edit, Plus, Upload } from '@element-plus/icons-vue'
import type { StockSuggestion } from '~/composables/stock/useStockSearch'
import type { Holding, OpeningPosition, Transaction } from '~/composables/holdings/holdings-model'
import type { ImportedTrade } from '~/utils/broker-trade-csv'
import type { HoldingsSymbolColumn } from '~/components/holdings/HoldingsSymbolTable.vue'

// 持股管理（2026-10-05）。**持股是交易紀錄的唯讀投影**（業務中台 4467c44，使用者決定）：這一頁能做的
// 寫入只有「記一筆交易」「改／刪一筆交易」「刪除一檔（＝它的所有交易）」，股數與成本（先進先出）由
// 業務中台 重算。很久以前買、記不得每一筆的部位，就用最早的日期記一筆買進、價格填平均成本（期初部位）；
// 配股記成價格 0 的買進。
//
// 總市值、損益、預估股利在 app/utils/holdings-summary.ts 算——持股是個資，不送去任何新的伺服器路由。
//
// 刻意沒有的東西（投信投顧法、釋字 634）：買賣點、目標價、停損、健康燈號、開發者預設門檻的提醒；記一筆交易成功也只給中性提示。
// 「今日漲跌」原本也列在這裡（2026-10-05 我依反遊戲化的設計原則拿掉），2026-10-15 使用者要求加上（「holdings 要加上今日漲跌幅」）：
// 總覽一格、明細一欄，口徑跟觀察清單的「漲跌」相同。
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
const {
  holdings, pending, loadFailed, market, quotesFailed, etfWindow, transactions, marketYield,
  load, ensureLoaded, clear, loadQuotes, loadTransactions, saveTransaction, removeHolding, removeTransaction, importTrades, clearAll
} = useHoldings()
const importVisible = ref(false)
// 讀不到時交給全站的讀取失敗彈窗（AppLoadFailureDialog，2026-10-08），畫面上不再各自出訊息
watchLoadFailure('holdings', () => loadFailed.value, load)
// 報價：整批重讀（loadQuotes 只補還沒有價格的代號，失敗時一個都沒寫進去）
watchLoadFailure('holdings-quotes', () => quotesFailed.value, () => loadQuotes(holdings.value.map(holding => holding.symbol)), { scope: 'section' })
usePostLoginLoader().registerPending(pending)

// ---- 交易紀錄（一次看一檔） ----

// 展開了交易紀錄的代號（可以同時展開好幾檔）。桌機用 el-table 的展開列、手機就在卡片裡。
const expanded = ref<string[]>([])

// 依使用者身分而不是只看 currentUser：登出要清空，換一個人登入要重新載入。
// 誰＋哪個帳戶（2026-10-19）：換帳戶就跟換人一樣重新載入
const { holdingsScope } = useHoldingsPortfolios()
watch([authResolved, holdingsScope], ([resolved, uid]) => {
  if (!resolved) return
  expanded.value = []
  if (uid) ensureLoaded()
  else clear()
}, { immediate: true })

const { keyword, fetchSuggestions, isCompanyEntry, routeFor } = useStockSearch()
// el-autocomplete 在沒有反白項目時把 aria-activedescendant 指到不存在的 "…-item--1"（axe critical），同頁首搜尋的處理
const symbolInputRef = ref<{ $el?: Node } | null>(null)
useAutocompleteActiveDescendantFix(symbolInputRef)
const companyByCode = useCompanyLookup(() => holdings.value.map(holding => holding.symbol))

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
    symbol: holding.symbol,
    name: entry?.name ?? holding.symbol,
    label: symbolLabel(holding.symbol),
    kind: entry?.kind ?? 'common',
    link: entry ? routeFor(entry) : `/stock/${holding.symbol}`,
    input,
    figures: holdingRowFigures(input),
    dayInput: { quantity: holding.quantity, price: quote?.dayPrice, previousClose: quote?.previousClose, date: quote?.dayPriceDate }
  }
}))
const totals = computed(() => summarizeHoldings(baseRows.value.map(row => row.input)))
// 今日漲跌是哪一天的：各檔收盤日期最新的那天。總覽只加總那一天的——上市隔天早上才更新、上櫃當天傍晚就有
// （2026-10-15 twse-ts／tpex-ts 確認），晚上兩邊差一天，加在一起只標一個日期是錯的
const dayDate = computed(() => Object.values(market.value).map(quote => quote.dayPriceDate).filter((date): date is string => !!date).sort().at(-1) ?? null)
const dayTotals = computed(() => summarizeDayChange(baseRows.value.map(row => row.dayInput), dayDate.value))
const shortDate = (date: string) => date.slice(5).replace('-', '/')
// 收盤還停在更早那一天的那一檔：漲跌照樣顯示，但標出是哪一天，不讓人當成今天
function dayChangeText(row: HoldingRow, withAmount: boolean): string {
  const change = dayChange(row.dayInput)
  if (change.pct === null) return '－'
  const text = withAmount ? `${signedMoney(change.amount)} ${signedPct(change.pct)}` : signedPct(change.pct)
  const date = row.dayInput.date
  return date && dayDate.value && date < dayDate.value ? `${text}（${shortDate(date)}）` : text
}

// 明細表（寬螢幕表格、窄的是卡片、排序、展開）在 HoldingsSymbolTable.vue，已實現損益頁共用。
// 預設依市值由大到小（2026-10-05 UI 盤點：「哪幾檔最大」是看持股的第一個問題）。
// 占比、圓餅圖、產業占比都在「持股分析」頁（使用者 2026-10-05：「持股總覽那邊就可以簡化」）。
type HoldingRow = (typeof baseRows.value)[number]

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
  excludedClause(totals.value.costUnknownCount, '有成本不明的股數', row => (row.input.costUnknownQuantity ?? 0) > 0),
  // 收盤還停在前一個交易日的（上市隔天早上才更新），不算進總覽的今日漲跌
  excludedClause(dayTotals.value.staleCount, '今日漲跌尚未更新', row => !!row.dayInput.date && !!dayDate.value && row.dayInput.date < dayDate.value && dayChange(row.dayInput).pct !== null)
].filter(Boolean).join('；'))

// 組合殖利率 vs 大盤（使用者 2026-10-05 在 業務中台 問「殖利率跟大盤比呢」）：同一個來源（交易所公布的殖利率）、
// 依市值加權。只陳述，不評論——殖利率高也可能是股價跌下來的。
const portfolioYield = computed(() => weightedDividendYield(baseRows.value.map(row => ({ marketValue: row.figures.marketValue, yieldPct: market.value[row.holding.symbol]?.dividendYield ?? null }))))
const yieldDates = computed(() => {
  const dates = [...new Set(baseRows.value.map(row => market.value[row.holding.symbol]?.yieldDate).filter((date): date is string => !!date))].sort()
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

const toneOf = (value: number | null) => priceDirectionClass(value === null ? null : Math.round(value))

function signedPct(value: number | null): string {
  if (value === null) return ''
  const fixed = value.toFixed(2)
  if (Number(fixed) === 0) return '0.00%'
  return `${value > 0 ? '+' : ''}${fixed}%`
}

function plainNumber(value: string | number): string {
  return groupThousands(String(Number(value)))
}

// 明細表的數字欄。卡片上一眼看到市值與未實現損益（帶報酬率），展開後才看到股數與預估年股利。
// 下載（2026-10-18）：value 是下載的值（百分比給比例，同複製到 Excel）；sensitive 是會透露部位大小的欄（股數、金額），下載時預設不勾
const columns: HoldingsSymbolColumn<HoldingRow>[] = [
  { key: 'quantity', label: '股數', minWidth: 100, card: 'detail', sortLabel: '股數（多到少）', text: row => groupThousands(row.holding.quantity), sortValue: row => row.holding.quantity, value: row => row.holding.quantity, sensitive: true },
  { key: 'marketValue', label: '市值', minWidth: 120, card: 'summary', text: row => row.figures.marketValue === null ? '－' : money(row.figures.marketValue), sortValue: row => row.figures.marketValue, value: row => row.figures.marketValue, sensitive: true },
  // 今日漲跌（2026-10-15）：卡片上也看得到（金額＋漲跌幅，同未實現損益的寫法），表格只放漲跌幅、組合的金額在總覽
  {
    key: 'dayChange', label: '今日漲跌', minWidth: 120, card: 'summary', sortLabel: '今日漲跌（高到低）',
    text: row => dayChangeText(row, false),
    cardText: row => dayChangeText(row, true),
    sortValue: row => dayChange(row.dayInput).pct,
    value: (row) => {
      const pct = dayChange(row.dayInput).pct
      return pct === null ? null : pct / 100
    },
    tone: (row) => {
      const pct = dayChange(row.dayInput).pct
      return pct === null ? null : Number(pct.toFixed(2))
    }
  },
  {
    key: 'pnl', label: '未實現損益', minWidth: 140, card: 'summary',
    text: row => signedMoney(row.figures.pnl),
    cardText: row => `${signedMoney(row.figures.pnl)} ${signedPct(row.figures.pnlPct)}`,
    sortValue: row => row.figures.pnl,
    value: row => row.figures.pnl,
    sensitive: true,
    tone: row => row.figures.pnl === null ? null : Math.round(row.figures.pnl)
  },
  {
    key: 'pnlPct', label: '報酬率', minWidth: 110, sortLabel: '報酬率（高到低）',
    text: row => signedPct(row.figures.pnlPct) || '－',
    sortValue: row => row.figures.pnlPct,
    value: row => (row.figures.pnlPct === null ? null : row.figures.pnlPct / 100),
    tone: row => row.figures.pnlPct === null ? null : Number(row.figures.pnlPct.toFixed(2))
  },
  { key: 'annualDividend', label: '預估年股利', minWidth: 120, card: 'detail', text: row => row.figures.annualDividend === null ? '－' : money(row.figures.annualDividend), sortValue: row => row.figures.annualDividend, value: row => row.figures.annualDividend, sensitive: true }
]

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

// ---- 帳戶（2026-10-19）----
// 記一筆、匯入都要知道記在哪個帳戶：預設是目前選的那個（全部帳戶時是第一個）。只有一個帳戶時不顯示欄位。
// 清除全部只清一個帳戶，所以全部帳戶又不只一個時不提供（writeTarget 是 null）
const { portfolios, selected: selectedPortfolio, writeTarget, ensurePortfolio } = useHoldingsPortfolios()
const defaultAccountId = () => selectedPortfolio.value?.id ?? portfolios.value[0]?.id ?? null
const importAccountId = ref<string | null>(null)
watch(importVisible, (open) => { if (open) importAccountId.value = defaultAccountId() })
// ---- 分享（2026-10-19 第二階段，SharedShareButton）----
// 分享的是側欄目前選的帳戶，「全部帳戶」是 null（業務中台 合併各帳戶）。可以勾的欄跟明細表一樣，加上占比（業務中台 算好送來，
// 不必露出股數就看得出分配）；會透露部位大小的四欄預設不勾（同下載）。占比與報酬率只送比例，股數任一欄勾了才會送
// 持股特色（2026-10-19）：加權的本益比、Beta、ROE…加大盤對照與標籤（持股分析頁那一段），整體數字、不露出各檔占比，預設勾
const SHARE_COLUMNS = [
  { key: 'traits', label: '持股特色' },
  { key: 'weight', label: '占比' },
  { key: 'pnlPct', label: '報酬率' },
  { key: 'dayChange', label: '今日漲跌' },
  { key: 'quantity', label: '股數', sensitive: true },
  { key: 'marketValue', label: '市值', sensitive: true },
  { key: 'unrealizedPnl', label: '未實現損益', sensitive: true },
  { key: 'annualDividend', label: '預估年股利', sensitive: true }
]
const shareName = computed(() => (portfolios.value.length > 1 ? `${selectedPortfolio.value?.name ?? '全部帳戶'}的持股` : '我的持股'))

const importIntoAccount = (source: string, trades: ImportedTrade[], openings: OpeningPosition[], dryRun: boolean) =>
  importAccountId.value
    ? importTrades(importAccountId.value, source, trades, openings, dryRun)
    : ensurePortfolio().then(id => (id ? importTrades(id, source, trades, openings, dryRun) : { kind: 'failed' as const, message: '請先選擇要匯入的帳戶' }))

// ---- 記一筆交易／編輯交易 ----

const dialogVisible = ref(false)
const editing = ref<Transaction | null>(null)
// 從某一檔的列上打開時，股票已經決定好了
const lockedSymbol = ref<string | null>(null)
const saving = ref(false)
const notice = ref('')
const formRef = ref<FormInstance>()
// 表單提示句以 aria-describedby 掛在對應的欄位上（朗讀器聚焦欄位時念出來，不只是視覺上在旁邊）
const hintId = { tradeDate: useId(), quantity: useId(), price: useId() }
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
  costUnknown: false,
  portfolioId: null as string | null
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
  Object.assign(form, { symbol: symbol ?? '', action: 'BUY', tradeDate: todayInTaipei(), quantity: undefined, price: undefined, fee: 0, tax: 0, note: '', costUnknown: false, portfolioId: defaultAccountId() })
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
    costUnknown: form.action === 'BUY' && form.costUnknown,
    portfolioId: form.portfolioId
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
  <HoldingsPageShell title="持股管理" guest-title="登入後開始記錄持股">
    <template #actions>
      <div v-if="currentUser && !loadFailed && holdings.length" class="holding-actions">
        <el-button size="large" :icon="Upload" @click="importVisible = true">匯入成交明細</el-button>
        <el-button type="primary" size="large" :icon="Plus" @click="openRecord()">記一筆交易</el-button>
      </div>
    </template>

    <!-- 讀不到：彈窗會說明並自動重讀；留空佔住這一支，免得落到下面的「還沒有持股」 -->
    <template v-if="loadFailed" />

    <div v-else-if="pending && !holdings.length" v-loading="true" class="app-loading-placeholder" />

    <el-empty v-else-if="!holdings.length" description="還沒有記錄任何持股" :image-size="64">
      <p class="holdings-page__empty-hint">可以匯入券商的成交明細 CSV，或一筆一筆記。很久以前買的股票，用最早的日期記一筆買進、價格填平均成本即可。</p>
      <div class="holding-actions holding-actions--center">
        <el-button size="large" :icon="Upload" @click="importVisible = true">匯入成交明細</el-button>
        <el-button type="primary" size="large" :icon="Plus" @click="openRecord()">記一筆交易</el-button>
      </div>
    </el-empty>

    <template v-else>
      <section class="holdings-page__overview" aria-labelledby="holdings-summary-title">
        <h2 id="holdings-summary-title" class="holdings-page__section-title">總覽</h2>
        <!-- 總覽（2026-10-16 重新設計，使用者：「今日漲跌可以與未實現損益合併，預估年度股利可以與殖利率合併，請重新設計總覽」；
             先試的三格卡片版「合併以後看起來髒髒的」——各格內容長短不一、同一格紅綠兩色、括號太多）。改成一塊、不分格：總市值是唯一的
             大數字，下面三列對齊成「名稱｜金額｜比率」，損益兩列在上、股利一列在下。每列只有一種顏色；日期只在總市值寫一次 -->
        <dl class="holdings-overview">
          <div class="holdings-overview__hero">
            <dt>總市值<template v-if="priceDates.length">（{{ shortDate(priceDates.at(-1)!) }} 收盤）</template></dt>
            <dd>{{ totals.marketValue === null ? '－' : `${money(totals.marketValue)} 元` }}</dd>
          </div>
          <div class="holdings-overview__row">
            <dt>未實現損益</dt>
            <dd :class="toneOf(totals.pnl)">{{ signedMoney(totals.pnl) }}</dd>
            <dd :class="toneOf(totals.pnl)">{{ signedPct(totals.pnlPct) }}</dd>
          </div>
          <div class="holdings-overview__row">
            <!-- 跟總市值不是同一天時才寫日期（收盤還停在前一個交易日的情況，見 dayDate） -->
            <dt>今日漲跌<template v-if="dayDate && dayDate !== priceDates.at(-1)">（{{ shortDate(dayDate) }}）</template></dt>
            <dd :class="toneOf(dayTotals.amount)">{{ signedMoney(dayTotals.amount) }}</dd>
            <dd :class="toneOf(dayTotals.amount)">{{ signedPct(dayTotals.pct) }}</dd>
          </div>
          <div class="holdings-overview__row">
            <dt>預估年度股利</dt>
            <dd>{{ totals.annualDividend === null ? '－' : `${money(totals.annualDividend)} 元` }}</dd>
            <dd>殖利率 {{ portfolioYield.value === null ? '－' : `${portfolioYield.value.toFixed(2)}%` }}<span v-if="marketYield" class="holdings-overview__compare">（大盤 {{ marketYield.value.toFixed(2) }}%）</span></dd>
          </div>
        </dl>
        <!-- 使用者 2026-10-05：「holdings 希望減少不必要的說明，避免注意力分散」。只在真的有東西沒算進去時出一行；
             計算口徑全部收進最下面的「計算方式」。 -->
        <p v-if="excludedText" class="holdings-page__excluded">未計入：{{ excludedText }}</p>
      </section>

      <section aria-labelledby="holdings-list-title">
        <h2 id="holdings-list-title" class="holdings-page__section-title">持股明細（{{ holdings.length }} 檔）</h2>
        <HoldingsSymbolTable
          v-model:expanded="expanded"
          :rows="baseRows"
          :columns="columns"
          default-sort="marketValue"
          download-name="持股明細"
          :toggle-labels="['明細', '收合']"
          @open="loadTransactions"
        >
          <template #toolbar>
            <SharedShareButton
              class="holdings-page__share"
              kind="holdings"
              :target-id="selectedPortfolio?.id ?? null"
              :name="shareName"
              :columns="SHARE_COLUMNS"
              sensitive-heading="部位大小，預設不分享"
            />
          </template>
          <template #detail="{ row }">
            <HoldingsDetailPanel
              :holding="row.holding"
              :average-cost="averageCostText(row.holding)"
              :price="row.figures.marketValue === null ? '－' : plainNumber(row.input.price!)"
              :label="row.label"
              :entries="transactions[row.symbol]"
              :symbol-label="symbolLabel"
              @record="openRecord(row.symbol)"
              @remove-holding="removeHolding(row.holding, row.label)"
              :reload="() => loadTransactions(row.symbol)"
              @edit="openEditTransaction"
              @remove-transaction="removeTransaction"
            />
          </template>
        </HoldingsSymbolTable>

        <div v-if="writeTarget" class="holding-actions holdings-page__clear">
          <el-button type="danger" plain :icon="Delete" @click="clearEverything">{{ portfolios.length > 1 ? `清除「${writeTarget.name}」的全部持股與交易紀錄` : '清除全部持股與交易紀錄' }}</el-button>
        </div>

        <details class="holdings-page__method holdings-details">
          <summary>計算方式</summary>
          <ul>
            <li>股數與成本由交易紀錄以先進先出（跟券商相同）算出，買進手續費計入成本；平均成本是目前還持有的那幾批的平均。成本不明的股數市值照算，未實現損益只算成本已知的部分。</li>
            <li v-if="priceDates.length">市值以 {{ priceDates.at(-1) }} 收盤價計算<template v-if="olderPriceText">；{{ olderPriceText }}</template>。</li>
            <li v-if="dayDate">今日漲跌是 {{ dayDate }} 的收盤價對前一個有成交日的收盤價（跟觀察清單的漲跌相同），總覽的漲跌幅依前一日市值加權；那天沒有成交的持股不計入。上櫃股票的收盤價當天傍晚就更新，上市股票目前要到隔天早上；還沒更新的那幾檔，明細標出它的日期、不計入總覽。除息當天的漲跌包含配息造成的下跌，不是對除息參考價。</li>
            <li>預估年度股利＝持有股數 × 每股現金股利：普通股與 ETF 都採近 12 個月已除息的現金股利（普通股已換算配股後的股數<template v-if="etfWindow">；ETF 的區間是 {{ etfWindow.from }}～{{ etfWindow.to }}</template>）；特別股採發行條件所訂年股息。只反映過去實際配發，不代表未來配息金額。</li>
            <li>殖利率是交易所公布的每檔殖利率，依市值加權<template v-if="yieldDates">（{{ yieldDates }}）</template><template v-if="portfolioYield.coverage < 0.995">，涵蓋 {{ (portfolioYield.coverage * 100).toFixed(0) }}% 的市值（ETF 等沒有公布殖利率的不計入）</template>。<template v-if="marketYield">大盤是上市公司依市值加權<template v-if="marketYield.date">（{{ marketYield.date }}）</template>，不含上櫃，台積電等權值股的占比很大。</template>殖利率是股利除以股價，股價下跌也會讓它變高，不是報酬率。</li>
          </ul>
        </details>
      </section>

    </template>

    <HoldingsImportDialog v-model="importVisible" v-model:account-id="importAccountId" :accounts="portfolios" :import-trades="importIntoAccount" :symbol-label="symbolLabel" />

    <el-dialog v-model="dialogVisible" :title="editing ? '編輯交易' : dialogSymbol ? `記一筆交易：${symbolLabel(dialogSymbol)}` : '記一筆交易'" width="min(520px, 92vw)">
      <el-alert v-if="notice" type="warning" :closable="false" show-icon :title="notice" class="holdings-form__notice" />
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="submit">
        <el-form-item v-if="!dialogSymbol" label="股票" prop="symbol">
          <el-autocomplete
            ref="symbolInputRef"
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
        <el-form-item v-if="!editing && portfolios.length > 1" label="帳戶" prop="portfolioId">
          <el-select v-model="form.portfolioId" size="large">
            <el-option v-for="portfolio in portfolios" :key="portfolio.id" :label="portfolio.name" :value="portfolio.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="買賣" prop="action">
          <el-radio-group v-model="form.action" size="large">
            <el-radio-button value="BUY">買進</el-radio-button>
            <el-radio-button value="SELL">賣出</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="交易日期" prop="tradeDate">
          <!-- 指令掛在外層 div：el-date-picker 的根節點不是單一元素（tooltip 包著），自訂指令掛不上去 -->
          <div class="holdings-form__full" v-describedby="form.action === 'BUY' && !editing ? hintId.tradeDate : undefined">
            <el-date-picker v-model="form.tradeDate" type="date" value-format="YYYY-MM-DD" format="YYYY/MM/DD" :disabled-date="disabledFutureDate" :clearable="false" class="holdings-form__full" />
          </div>
          <p v-if="form.action === 'BUY' && !editing" :id="hintId.tradeDate" class="holdings-form__hint">很久以前買、記不得每一筆？用最早的日期記一筆，價格填平均成本即可。</p>
        </el-form-item>
        <el-form-item label="股數（股）" prop="quantity">
          <el-input-number v-model="form.quantity" class="holdings-form__full" :min="1" :max="2147483647" :precision="0" :controls="false" v-describedby="hintId.quantity" />
          <p :id="hintId.quantity" class="holdings-form__hint">
            1 張＝1,000 股；零股請直接輸入股數<template v-if="form.action === 'SELL' && form.symbol">。目前持有 {{ groupThousands(heldQuantity) }} 股</template>
          </p>
        </el-form-item>
        <el-form-item label="成交價（元／股）" prop="price">
          <el-input-number v-model="form.price" class="holdings-form__full" :min="0" :controls="false" :disabled="form.action === 'BUY' && form.costUnknown" v-describedby="form.action === 'BUY' ? hintId.price : undefined" />
          <el-checkbox v-if="form.action === 'BUY'" v-model="form.costUnknown" size="large" class="holdings-form__cost-unknown">不知道成本（例如很久以前買的）</el-checkbox>
          <p v-if="form.action === 'BUY'" :id="hintId.price" class="holdings-form__hint">
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
  </HoldingsPageShell>
</template>

<style scoped>
.holdings-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

/* 總覽：一塊、不分格，三列用 subgrid 對齊，金額靠右（位數一眼比得出大小）。依這一段的寬度排三種（mobile first）：
   窄：總市值在上，每列「名稱｜金額」、比率在金額下面；≥480：每列「名稱｜金額｜比率」；≥720：總市值放左邊、三列放右邊 */
.holdings-page__overview {
  container-type: inline-size;
}

.holdings-overview {
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 16px;
  row-gap: 8px;
  margin: 0;
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  font-variant-numeric: tabular-nums;
}

.holdings-overview dt {
  color: var(--el-text-color-regular);
}

.holdings-overview dd {
  margin: 0;
}

.holdings-overview__hero {
  grid-column: 1 / -1;
  margin-bottom: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.holdings-overview__hero dd {
  margin-top: 4px;
  font-size: 2rem;
  font-weight: 600;
}

.holdings-overview__row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: baseline;
}

.holdings-overview__row dt {
  grid-row: span 2;
}

.holdings-overview__row dd {
  grid-column: 2;
  justify-self: end;
  text-align: right;
}

.holdings-overview__row dd:first-of-type {
  font-size: 1.125rem;
  font-weight: 600;
}

.holdings-overview__compare {
  white-space: nowrap;
  color: var(--el-text-color-regular);
}

@container (min-width: 480px) {
  .holdings-overview {
    grid-template-columns: max-content max-content 1fr;
    column-gap: 24px;
    padding: 20px 24px;
  }

  .holdings-overview__row dt {
    grid-row: auto;
  }

  .holdings-overview__row dd {
    grid-column: auto;
    text-align: left;
  }

  .holdings-overview__row dd:last-of-type {
    justify-self: start;
  }
}

@container (min-width: 720px) {
  .holdings-overview {
    grid-template-columns: max-content max-content max-content 1fr;
    align-items: center;
  }

  .holdings-overview__hero {
    grid-column: 1;
    grid-row: 1 / span 3;
    margin: 0 8px 0 0;
    padding: 0 32px 0 0;
    border-bottom: 0;
    border-right: 1px solid var(--el-border-color-lighter);
  }

  .holdings-overview__row {
    grid-column: 2 / -1;
  }
}

/* 明細表工具列的最右邊（卡片模式左邊是排序選單）。HoldingsSymbolTable 已經替它保留一個按鈕高，讀到連結狀態後才出現也不推動表格 */
.holdings-page__share {
  margin-left: auto;
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

.holding-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.holdings-page__clear {
  margin-top: 16px;
}

.holding-actions--center {
  justify-content: center;
}

.holding-actions :deep(.el-button) {
  min-height: 44px;
  margin: 0;
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

</style>
