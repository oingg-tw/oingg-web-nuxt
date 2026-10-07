<script setup lang="ts">
import type { PerformanceOutcome, RealizedResult } from '~/composables/stock/useHoldings'
import type { HoldingsSymbolColumn } from '~/components/holdings/HoldingsSymbolTable.vue'

// 已實現損益（2026-10-07 從「交易績效」拆出來，使用者：「performance 這一頁太亂了，請把指標拆去別的畫面」）。
// 跟「交易」有關的三件事：期間內賣出的損益（GET /holdings/realized，bff-ts e516d1e，含已出清的代號）、
// 賣出的統計（tradeStats）、交易成本（/holdings/performance 的 trading，跟報酬頁共用快取）。
//
// 中性呈現：不排名、不慶祝；損益用正負號與 ▲／▼，不只靠顏色。
//
// Personal page: out of the index and the sitemap (/holdings/**).
useSeoMeta({ title: '已實現損益', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const { open: openLogin } = useLoginDialog()
const { fetchRealized, fetchPerformance, transactions, loadTransactions } = useHoldings()
const { data: companies } = useCompanyIndex()
const { routeFor } = useStockSearch()
const companyByCode = computed(() => new Map(companies.value.map(entry => [entry.code, entry])))

// 見 holdings/index.vue：登入狀態只在瀏覽器裡才知道，掛載前一律當成還不知道，免得 hydration 不一致。
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

const range = useHoldingsRange()
const realized = ref<RealizedResult | null>(null)
const pending = ref(false)
const failed = ref(false)
const performance = ref<PerformanceOutcome | null>(null)

async function loadRealized() {
  pending.value = true
  failed.value = false
  const [result, outcome] = await Promise.all([fetchRealized(range.value[0], range.value[1]), fetchPerformance(range.value[0], range.value[1])])
  pending.value = false
  realized.value = result
  failed.value = result === null
  performance.value = outcome
}

watch([authResolved, () => currentUser.value?.uid, range], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) loadRealized()
  else {
    realized.value = null
    performance.value = null
  }
}, { immediate: true })

const rows = computed(() => (realized.value?.symbols ?? []).map((row) => {
  const entry = companyByCode.value.get(row.symbol)
  const name = entry?.name ?? row.symbol
  return {
    symbol: row.symbol,
    name,
    label: `${name} ${row.symbol}`,
    link: entry ? routeFor(entry) : `/stock/${row.symbol}`,
    value: Number(row.realizedProfitLoss)
  }
}))
type RealizedRow = (typeof rows.value)[number]

// 每一檔可以展開看交易紀錄（賣出價格、組成持倉的買進）。可以同時展開好幾檔。表格／卡片／排序在 HoldingsSymbolTable.vue，
// 跟持股總覽共用（2026-10-08）；預設依已實現損益由大到小，同持股總覽「最大的先看」。
const expanded = ref<string[]>([])
const columns: HoldingsSymbolColumn<RealizedRow>[] = [
  { key: 'value', label: '已實現損益', minWidth: 140, card: 'summary', text: row => holdingsSignedMoney(row.value), sortValue: row => row.value, tone: row => Math.round(row.value) }
]

function rowLabelFor(row: RealizedRow) {
  return (symbol: string) => `${row.name} ${symbol}`
}

const total = computed(() => (realized.value ? Number(realized.value.totalRealizedProfitLoss) : null))

function directionClass(value: number | null): string {
  return priceDirectionClass(value === null ? null : Math.round(value))
}

// 用「獲利筆數占比」不用「勝率」：只陳述筆數，不帶比賽的語氣
const tradeStatRows = computed(() => {
  const t = realized.value?.tradeStats
  if (!t || t.sellCount === 0) return []
  return [
    { name: '賣出筆數', value: `${t.sellCount} 筆`, meaning: `獲利 ${t.winCount} 筆、虧損 ${t.lossCount} 筆` },
    { name: '獲利筆數占比', value: holdingsMetricText(t.winRate, 'pct'), meaning: '獲利的賣出筆數 ÷ 全部賣出筆數' },
    { name: '平均每筆獲利', value: holdingsMetricText(t.averageWin, 'money', '沒有獲利的賣出'), meaning: '獲利的那幾筆，平均每筆的已實現損益' },
    { name: '平均每筆虧損', value: holdingsMetricText(t.averageLoss, 'money', '沒有虧損的賣出'), meaning: '虧損的那幾筆，平均每筆的已實現損益' },
    { name: '獲利因子', value: holdingsMetricText(t.profitFactor, 'ratio', '沒有虧損的賣出'), meaning: '獲利筆數的損益合計 ÷ 虧損筆數的損益合計（取絕對值）' },
    { name: '平均持有天數', value: t.averageHoldingDays === null ? '－' : `${Math.round(Number(t.averageHoldingDays))} 天`, meaning: '從買進到賣出的平均日曆天數' }
  ]
})

const tradingRows = computed(() => {
  const trading = performance.value?.ok ? performance.value.result.trading : null
  if (!trading) return []
  const noExposure = '期間內沒有持股'
  return [
    { name: '買進金額', value: holdingsMetricText(trading.buyAmount, 'money'), meaning: '期間內實際成交的買進（不含配股與成本不明的取得）' },
    { name: '賣出金額', value: holdingsMetricText(trading.sellAmount, 'money'), meaning: '期間內實際成交的賣出' },
    { name: '手續費', value: holdingsMetricText(trading.fees, 'money'), meaning: '買進與賣出的券商手續費' },
    { name: '證交稅', value: holdingsMetricText(trading.taxes, 'money'), meaning: '賣出時的證券交易稅' },
    { name: '週轉率', value: holdingsMetricText(trading.turnover, 'pct', noExposure, 2), meaning: '買進與賣出較小的那一個 ÷ 平均市值，整段期間、不年化' },
    { name: '成本率', value: holdingsMetricText(trading.costRatio, 'pct', noExposure, 2), meaning: '（手續費＋證交稅）÷ 平均市值，整段期間、不年化' }
  ]
})
</script>

<template>
  <div class="realized-page">
    <div class="realized-page__heading">
      <h1 class="realized-page__title">已實現損益</h1>
      <p class="realized-page__subtitle">選一段期間，看賣掉的股票賺賠多少、賣出的統計與交易成本</p>
    </div>

    <HoldingsNav />

    <div v-if="!mounted || !authResolved" v-loading="true" class="realized-page__placeholder" />

    <section v-else-if="!currentUser" class="realized-guest">
      <h2 class="realized-guest__title">登入後查看你的已實現損益</h2>
      <p class="realized-guest__text">持股與交易資料存在你的帳號裡，只有你看得到。</p>
      <el-button type="primary" size="large" @click="openLogin">登入／註冊</el-button>
    </section>

    <template v-else>
      <HoldingsRangePicker :pending="pending" />

      <section v-loading="pending" aria-labelledby="realized-title">
        <h2 id="realized-title" class="realized-page__section-title">賣出的損益</h2>

        <el-alert v-if="failed" type="error" :closable="false" show-icon title="已實現損益暫時無法載入">
          <el-button class="realized-page__retry" @click="loadRealized">重新載入</el-button>
        </el-alert>

        <template v-else-if="realized">
          <dl class="realized-total">
            <dt>{{ range[0] }}～{{ range[1] }} 合計</dt>
            <dd :class="directionClass(total)">{{ holdingsSignedMoney(total) }}</dd>
          </dl>

          <p v-if="!rows.length" class="realized-page__note">這段期間沒有賣出</p>
          <HoldingsSymbolTable
            v-else
            v-model:expanded="expanded"
            :rows="rows"
            :columns="columns"
            default-sort="value"
            :toggle-labels="['交易明細', '收合明細']"
            @open="loadTransactions"
          >
            <template #detail="{ row }">
              <HoldingsLedger
                :entries="transactions[row.symbol]"
                :symbol-label="rowLabelFor(row)"
                readonly
                :range="range"
                @retry="loadTransactions(row.symbol)"
              />
            </template>
          </HoldingsSymbolTable>

          <p v-if="realized.excludedSellCount" class="realized-page__note">
            另有 {{ realized.excludedSellCount }} 筆賣出、共 {{ groupThousands(realized.excludedShares) }} 股的取得成本不明，未計入損益。
          </p>
          <p class="realized-page__footnote">
            只計賣出日落在期間內的賣出，包含已經全部賣出的股票。成本以先進先出（跟券商相同）配對，期間開始前買進的股票也照實帶入成本；賣出的手續費與交易稅已扣除，不含股利。除權配股依除權息行事曆自動入帳。
          </p>
        </template>
      </section>

      <section v-if="tradeStatRows.length" aria-labelledby="realized-stats-title">
        <h2 id="realized-stats-title" class="realized-page__section-title">賣出的統計</h2>
        <HoldingsMetricTable caption="期間內賣出的統計" :rows="tradeStatRows" value-label="數值" />
      </section>

      <section v-if="tradingRows.length" aria-labelledby="realized-cost-title">
        <h2 id="realized-cost-title" class="realized-page__section-title">交易成本</h2>
        <HoldingsMetricTable caption="期間內的交易與成本" :rows="tradingRows" value-label="數值" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.realized-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.realized-page__heading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.realized-page__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.realized-page__subtitle {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.realized-page__placeholder {
  min-height: 200px;
}

.realized-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.realized-page__retry {
  margin-top: 8px;
}

.realized-page__note {
  margin: 12px 0 0;
  color: var(--el-text-color-regular);
}

.realized-page__footnote {
  margin: 16px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.realized-guest {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.realized-guest__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.realized-guest__text {
  margin: 0;
  color: var(--el-text-color-regular);
}


.realized-total {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
  margin: 0 0 16px;
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.realized-total dt {
  color: var(--el-text-color-regular);
}

.realized-total dd {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
