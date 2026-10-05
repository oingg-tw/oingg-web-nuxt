<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { Delete, Edit, Plus } from '@element-plus/icons-vue'
import type { StockSuggestion } from '~/composables/stock/useStockSearch'
import type { Holding } from '~/composables/stock/useHoldings'

// 持股管理（2026-10-05）。bff-ts 的 /holdings 自 2026-08-30 就是完整的 CRUD，只是前端一直沒接；
// 它**沒有彙總端點**（2026-09-06 決定彙總在前端算），所以總市值、損益、預估股利都在
// app/utils/holdings-summary.ts 算——持股是個資，不送去任何新的伺服器路由。
//
// 刻意沒有的東西（投信投顧法、釋字 634）：買賣點、目標價、停損、健康燈號、開發者預設門檻的提醒，
// 以及「今日漲跌」——反遊戲化，主視覺是持有的結果，不是當天的波動。
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
const { holdings, pending, loadFailed, market, quotesFailed, etfWindow, load, clear, add, update, remove } = useHoldings()
usePostLoginLoader().registerPending(pending)

// 登入狀態只在瀏覽器裡才知道，而 Firebase 可能在 hydration 之前就解析完——那時 client 的第一次渲染
// 會跟 SSR 的「還不知道」不同（實測 2026-10-05：Hydration node mismatch）。掛載前一律當成還不知道。
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

// 依使用者身分而不是只看 currentUser：登出要清空，換一個人登入要重新載入。
watch([authResolved, () => currentUser.value?.uid], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) load()
  else clear()
}, { immediate: true })

const { data: companies } = useCompanyIndex()
const { keyword, fetchSuggestions, isCompanyEntry, routeFor } = useStockSearch()
const companyByCode = computed(() => new Map(companies.value.map(entry => [entry.code, entry])))

const rows = computed(() => holdings.value.map((holding) => {
  const quote = market.value[holding.symbol]
  const entry = companyByCode.value.get(holding.symbol)
  const input = { quantity: holding.quantity, averageCost: holding.averageCost, price: quote?.price, dividendPerShare: quote?.dividendPerShare }
  return {
    holding,
    name: entry?.name ?? holding.symbol,
    kind: entry?.kind ?? 'common',
    link: entry ? routeFor(entry) : `/stock/${holding.symbol}`,
    input,
    figures: holdingRowFigures(input)
  }
}))
type HoldingRow = (typeof rows.value)[number]

const totals = computed(() => summarizeHoldings(rows.value.map(row => row.input)))

// 各檔的報價日期可能不同（暫停交易的那一檔停在舊日期）；註腳寫最新的那一天。
const priceDates = computed(() => [...new Set(Object.values(market.value).map(quote => quote.priceDate).filter(Boolean))].sort() as string[])

function money(value: number): string {
  return groupThousands(Math.round(value))
}

function signedMoney(value: number | null): string {
  if (value === null) return '－'
  const rounded = Math.round(value)
  if (rounded === 0) return '0 元'
  return `${rounded > 0 ? '▲ +' : '▼ '}${groupThousands(rounded)} 元`
}

function signedPct(value: number | null): string {
  if (value === null) return ''
  const fixed = value.toFixed(2)
  if (Number(fixed) === 0) return '0.00%'
  return `${value > 0 ? '+' : ''}${fixed}%`
}

function plainNumber(value: string | number): string {
  return groupThousands(String(Number(value)))
}

function rowLabel(row: HoldingRow): string {
  return `${row.name} ${row.holding.symbol}`
}

// ---- 新增／編輯對話框 ----

const dialogVisible = ref(false)
const editing = ref<Holding | null>(null)
const saving = ref(false)
const notice = ref('')
const formRef = ref<FormInstance>()
const form = reactive({ symbol: '', quantity: undefined as number | undefined, averageCost: undefined as number | undefined, note: '' })
let selectedLabel = ''

const editingLabel = computed(() => {
  if (!editing.value) return ''
  const entry = companyByCode.value.get(editing.value.symbol)
  return entry ? `${entry.name} ${entry.code}` : editing.value.symbol
})

const rules: FormRules = {
  symbol: [{ validator: (_rule, _value, callback) => (editing.value || form.symbol ? callback() : callback(new Error('請從清單中選擇一檔股票'))) }],
  quantity: [{ required: true, message: '請輸入持有股數' }],
  averageCost: [{ required: true, message: '請輸入平均成本' }]
}

// 選好之後又改了文字＝那個選擇已經不算數
watch(keyword, (value) => {
  if (value !== selectedLabel) form.symbol = ''
})

function selectStock(item: Record<string, unknown>) {
  const suggestion = item as unknown as StockSuggestion
  if (!isCompanyEntry(suggestion)) return
  selectedLabel = `${suggestion.code} ${suggestion.name}`
  form.symbol = suggestion.code
  keyword.value = selectedLabel
}

function openAdd() {
  editing.value = null
  Object.assign(form, { symbol: '', quantity: undefined, averageCost: undefined, note: '' })
  selectedLabel = ''
  keyword.value = ''
  notice.value = ''
  dialogVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

function openEdit(holding: Holding) {
  editing.value = holding
  Object.assign(form, { symbol: holding.symbol, quantity: holding.quantity, averageCost: Number(holding.averageCost), note: holding.note ?? '' })
  notice.value = ''
  dialogVisible.value = true
  nextTick(() => formRef.value?.clearValidate())
}

async function submit() {
  if (!(await formRef.value?.validate().catch(() => false))) return
  saving.value = true
  const input = { quantity: form.quantity!, averageCost: form.averageCost!, note: form.note }
  const result = editing.value ? await update(editing.value.id, input) : await add(form.symbol, input)
  saving.value = false
  if (result.ok) {
    dialogVisible.value = false
    ElMessage.success(editing.value ? '已更新持股' : '已新增持股')
    return
  }
  if (result.reason === 'duplicate') {
    // 不是錯誤：使用者想加的那一檔已經在清單上。切成編輯那一列、帶出現有的數字，讓人自己決定怎麼改。
    openEdit(result.existing)
    notice.value = `你已持有 ${editingLabel.value}，請直接修改股數與成本。`
  } else if (result.reason === 'unknown') {
    notice.value = `系統目前無法確認代號 ${form.symbol}，暫時無法新增。`
  } else if (result.reason === 'gone') {
    dialogVisible.value = false
    ElMessage.warning('這筆持股已經不存在，可能已在其他裝置刪除')
  } else {
    // 對話框不關、輸入保留
    showErrorMessage(result.message ?? '儲存失敗，請稍後再試')
  }
}
</script>

<template>
  <div class="holdings-page">
    <div class="holdings-page__header">
      <div class="holdings-page__heading">
        <h1 class="holdings-page__title">持股管理</h1>
        <p class="holdings-page__subtitle">記錄你持有的股票、ETF 與特別股，查看總市值、未實現損益與預估年度股利</p>
      </div>
      <el-button v-if="mounted && currentUser && !loadFailed && holdings.length" type="primary" size="large" :icon="Plus" @click="openAdd">新增持股</el-button>
    </div>

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
      <el-button type="primary" size="large" :icon="Plus" @click="openAdd">新增持股</el-button>
    </el-empty>

    <template v-else>
      <section aria-labelledby="holdings-summary-title">
        <h2 id="holdings-summary-title" class="holdings-page__section-title">總覽</h2>
        <dl class="holdings-summary">
          <div class="holdings-summary__item">
            <dt>總市值</dt>
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
        </dl>
        <ul v-if="quotesFailed || totals.unpricedCount || totals.dividendMissingCount" class="holdings-page__notes">
          <li v-if="quotesFailed">報價暫時無法取得，市值與損益暫不顯示</li>
          <li v-else-if="totals.unpricedCount">{{ totals.unpricedCount }} 檔目前沒有報價，未計入總市值與損益</li>
          <li v-if="totals.dividendMissingCount">{{ totals.dividendMissingCount }} 檔沒有可用的股利資料，未計入預估年度股利</li>
        </ul>
      </section>

      <section aria-labelledby="holdings-list-title">
        <h2 id="holdings-list-title" class="holdings-page__section-title">持股明細（{{ holdings.length }} 檔）</h2>

        <el-table class="view-table" :data="rows" row-key="holding.id">
          <el-table-column label="名稱" min-width="180">
            <template #default="{ row }">
              <div class="holding-name">
                <NuxtLink :to="tableRow<HoldingRow>(row).link">{{ tableRow<HoldingRow>(row).name }}</NuxtLink>
                <span class="holding-name__code">{{ tableRow<HoldingRow>(row).holding.symbol }}</span>
                <el-tag v-if="tableRow<HoldingRow>(row).kind === 'etf'" size="small" effect="plain">ETF</el-tag>
                <el-tag v-else-if="tableRow<HoldingRow>(row).kind === 'preferred'" size="small" effect="plain">特別股</el-tag>
              </div>
              <p v-if="tableRow<HoldingRow>(row).holding.note" class="holding-name__note">{{ tableRow<HoldingRow>(row).holding.note }}</p>
            </template>
          </el-table-column>
          <el-table-column label="股數" align="right" min-width="100">
            <template #default="{ row }">{{ groupThousands(tableRow<HoldingRow>(row).holding.quantity) }}</template>
          </el-table-column>
          <el-table-column label="平均成本" align="right" min-width="100">
            <template #default="{ row }">{{ plainNumber(tableRow<HoldingRow>(row).holding.averageCost) }}</template>
          </el-table-column>
          <el-table-column label="收盤價" align="right" min-width="100">
            <template #default="{ row }">{{ tableRow<HoldingRow>(row).figures.marketValue === null ? '－' : plainNumber(tableRow<HoldingRow>(row).input.price!) }}</template>
          </el-table-column>
          <el-table-column label="市值" align="right" min-width="120">
            <template #default="{ row }">{{ tableRow<HoldingRow>(row).figures.marketValue === null ? '－' : money(tableRow<HoldingRow>(row).figures.marketValue!) }}</template>
          </el-table-column>
          <el-table-column label="未實現損益" align="right" min-width="140">
            <template #default="{ row }">
              <span :class="priceDirectionClass(tableRow<HoldingRow>(row).figures.pnl === null ? null : Math.round(tableRow<HoldingRow>(row).figures.pnl!))">
                {{ signedMoney(tableRow<HoldingRow>(row).figures.pnl) }}
                <br v-if="tableRow<HoldingRow>(row).figures.pnlPct !== null">
                {{ signedPct(tableRow<HoldingRow>(row).figures.pnlPct) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="預估年股利" align="right" min-width="110">
            <template #default="{ row }">{{ tableRow<HoldingRow>(row).figures.annualDividend === null ? '－' : money(tableRow<HoldingRow>(row).figures.annualDividend!) }}</template>
          </el-table-column>
          <el-table-column label="操作" min-width="190">
            <template #default="{ row }">
              <div class="holding-actions">
                <el-button :icon="Edit" :aria-label="`編輯 ${rowLabel(tableRow<HoldingRow>(row))}`" @click="openEdit(tableRow<HoldingRow>(row).holding)">編輯</el-button>
                <el-button :icon="Delete" :aria-label="`刪除 ${rowLabel(tableRow<HoldingRow>(row))}`" @click="remove(tableRow<HoldingRow>(row).holding, rowLabel(tableRow<HoldingRow>(row)))">刪除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <ul class="view-card holding-cards">
          <li v-for="row in rows" :key="row.holding.id" class="holding-card">
            <div class="holding-name">
              <NuxtLink :to="row.link">{{ row.name }}</NuxtLink>
              <span class="holding-name__code">{{ row.holding.symbol }}</span>
              <el-tag v-if="row.kind === 'etf'" size="small" effect="plain">ETF</el-tag>
              <el-tag v-else-if="row.kind === 'preferred'" size="small" effect="plain">特別股</el-tag>
            </div>
            <p v-if="row.holding.note" class="holding-name__note">{{ row.holding.note }}</p>
            <dl class="holding-card__figures">
              <div><dt>股數</dt><dd>{{ groupThousands(row.holding.quantity) }}</dd></div>
              <div><dt>平均成本</dt><dd>{{ plainNumber(row.holding.averageCost) }}</dd></div>
              <div><dt>收盤價</dt><dd>{{ row.figures.marketValue === null ? '－' : plainNumber(row.input.price!) }}</dd></div>
              <div><dt>市值</dt><dd>{{ row.figures.marketValue === null ? '－' : money(row.figures.marketValue) }}</dd></div>
              <div>
                <dt>未實現損益</dt>
                <dd :class="priceDirectionClass(row.figures.pnl === null ? null : Math.round(row.figures.pnl))">
                  {{ signedMoney(row.figures.pnl) }} {{ signedPct(row.figures.pnlPct) }}
                </dd>
              </div>
              <div><dt>預估年股利</dt><dd>{{ row.figures.annualDividend === null ? '－' : money(row.figures.annualDividend) }}</dd></div>
            </dl>
            <div class="holding-actions">
              <el-button :icon="Edit" :aria-label="`編輯 ${rowLabel(row)}`" @click="openEdit(row.holding)">編輯</el-button>
              <el-button :icon="Delete" :aria-label="`刪除 ${rowLabel(row)}`" @click="remove(row.holding, rowLabel(row))">刪除</el-button>
            </div>
          </li>
        </ul>

        <p class="holdings-page__footnote">
          <template v-if="priceDates.length">市值以 {{ priceDates.at(-1) }} 收盤價計算。</template>
          預估年度股利＝持有股數 × 每股現金股利：普通股採截至最新財報季末的近一年每股現金股利（依除息日），可能落後約一季<template v-if="etfWindow">；ETF 採 {{ etfWindow.from }}～{{ etfWindow.to }} 已除息的每單位配息合計</template>；特別股採發行條件所訂年股息。數字只反映過去實際配發，不代表未來配息金額，也不構成任何買賣建議。
        </p>
      </section>
    </template>

    <el-dialog v-model="dialogVisible" :title="editing ? `編輯持股：${editingLabel}` : '新增持股'" width="min(480px, 92vw)">
      <el-alert v-if="notice" type="info" :closable="false" :title="notice" class="holdings-form__notice" />
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="submit">
        <el-form-item v-if="!editing" label="股票" prop="symbol">
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
        <el-form-item label="持有股數（股）" prop="quantity">
          <el-input-number v-model="form.quantity" class="holdings-form__full" :min="1" :max="2147483647" :precision="0" :controls="false" />
          <p class="holdings-form__hint">1 張＝1,000 股；零股請直接輸入股數</p>
        </el-form-item>
        <el-form-item label="平均成本（元／股）" prop="averageCost">
          <el-input-number v-model="form.averageCost" class="holdings-form__full" :min="0" :controls="false" />
          <p class="holdings-form__hint">可含小數；配股或贈與取得可填 0</p>
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

.holdings-page__subtitle {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.holdings-page__placeholder {
  min-height: 200px;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.holdings-summary__pct {
  font-size: 1rem;
}

.holdings-page__notes {
  margin: 12px 0 0;
  padding-left: 20px;
  color: var(--el-text-color-regular);
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

.holding-name__note {
  margin: 4px 0 0;
  color: var(--el-text-color-regular);
}

.holding-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
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

.holdings-page__footnote {
  margin: 16px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.holdings-form__notice {
  margin-bottom: 16px;
}

.holdings-form__full {
  width: 100%;
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

.view-card {
  display: none;
}

@media (max-width: 767px) {
  .holdings-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .view-table {
    display: none;
  }

  .view-card {
    display: flex;
  }
}
</style>
