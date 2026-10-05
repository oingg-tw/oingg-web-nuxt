<script setup lang="ts">
import type { RiskDrawdown, RiskOutcome } from '~/composables/stock/useHoldings'

// 持股的風險指標（2026-10-05）：使用者在 bff-ts 那邊要了組合的風險指標，選「用現在的持股回推」——拿現在每一檔
// 的市值比例，套用過去的股價（GET /holdings/risk，bff-ts 23b7b09）。放在側欄第四項而不是交易績效頁：它描述
// 的是「現在這組持股」，不是已實現的交易結果。
//
// bff-ts 要求照實呈現的四件事，這頁都做到：
//   1. 沒有報酬率與夏普比率（持股是事後選的，回推的報酬會偏高；真實報酬看交易績效）。
//   2. 一併顯示用了幾個交易日（波動度約 60 天、Beta 約 120 天以上才有參考價值）。
//   3. 期間中才有股價的持股（coverage partial）照實列出。
//   4. 只陳述數字與定義，不加「風險偏高」這類評語或等級（投信投顧法）。
//
// Personal page: out of the index and the sitemap (/holdings/**).
useSeoMeta({ title: '風險', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const { open: openLogin } = useLoginDialog()
const { fetchRisk } = useHoldings()
const { data: companies } = useCompanyIndex()
const companyByCode = computed(() => new Map(companies.value.map(entry => [entry.code, entry])))

// 見 holdings/index.vue：登入狀態只在瀏覽器裡才知道，掛載前一律當成還不知道，免得 hydration 不一致。
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

const range = ref<[string, string]>([holdingsTaipeiDate(-1), holdingsTaipeiDate()])
const outcome = ref<RiskOutcome | null>(null)
const pending = ref(false)

async function loadRisk() {
  pending.value = true
  outcome.value = await fetchRisk(range.value[0], range.value[1])
  pending.value = false
}

const report = computed(() => (outcome.value?.ok ? outcome.value.result : null))

function pct(value: string | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '－'
  return `${(Number(value) * 100).toFixed(digits)}%`
}

function plain(value: string | null | undefined, digits = 2): string {
  return value === null || value === undefined ? '－' : Number(value).toFixed(digits)
}

function drawdownText(drawdown: RiskDrawdown | null): string {
  if (!drawdown) return '－'
  return pct(drawdown.depth)
}

function drawdownDates(drawdown: RiskDrawdown | null): string {
  if (!drawdown?.peakDate || !drawdown.troughDate) return ''
  return `${drawdown.peakDate} 高點 → ${drawdown.troughDate} 低點，${drawdown.recoveryDate ? `${drawdown.recoveryDate} 回到前高` : '期間結束時尚未回到前高'}`
}

// 統計天數不足時照實說，不下結論
const fewDays = computed(() => (report.value ? report.value.tradingDays : 0))

const partialHoldings = computed(() => (report.value?.holdings ?? [])
  .filter(holding => holding.coverage !== 'full')
  .map((holding) => {
    const entry = companyByCode.value.get(holding.symbol)
    return { label: entry ? `${entry.name} ${holding.symbol}` : holding.symbol, coverage: holding.coverage, firstPriceDate: holding.firstPriceDate }
  }))

watch([authResolved, () => currentUser.value?.uid, range], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) loadRisk()
  else outcome.value = null
}, { immediate: true })
</script>

<template>
  <div class="risk-page">
    <div class="risk-page__heading">
      <h1 class="risk-page__title">風險</h1>
      <p class="risk-page__subtitle">用現在的持股比例回推過去的股價，看這組持股的波動和跌幅，並跟同期加權指數並列</p>
    </div>

    <HoldingsNav />

    <div v-if="!mounted || !authResolved" v-loading="true" class="risk-page__placeholder" />

    <section v-else-if="!currentUser" class="risk-guest">
      <h2 class="risk-guest__title">登入後查看你的持股風險指標</h2>
      <p class="risk-guest__text">持股資料存在你的帳號裡，只有你看得到。</p>
      <el-button type="primary" size="large" @click="openLogin">登入／註冊</el-button>
    </section>

    <template v-else>
      <div class="risk-range">
        <span id="risk-range-label" class="risk-range__label">期間</span>
        <el-date-picker
          v-model="range"
          type="daterange"
          value-format="YYYY-MM-DD"
          format="YYYY/MM/DD"
          start-placeholder="開始日期"
          end-placeholder="結束日期"
          range-separator="～"
          unlink-panels
          :clearable="false"
          :shortcuts="HOLDINGS_RANGE_SHORTCUTS"
          :disabled-date="holdingsIsFutureDate"
          aria-labelledby="risk-range-label"
          size="large"
        />
      </div>

      <section v-loading="pending" aria-labelledby="risk-metrics-title">
        <h2 id="risk-metrics-title" class="risk-page__section-title">風險指標</h2>

        <el-alert v-if="outcome && !outcome.ok" type="error" :closable="false" show-icon :title="outcome.message">
          <el-button class="risk-page__retry" @click="loadRisk">重新載入</el-button>
        </el-alert>

        <template v-else-if="report">
          <p class="risk-page__note">
            依 {{ report.tradingDays }} 個交易日計算<template v-if="report.weightsAsOf">，持股比例以 {{ report.weightsAsOf }} 的收盤價為準</template>。
            <template v-if="fewDays < 60">交易日少於 60 天，波動度的統計誤差較大。</template>
            <template v-else-if="fewDays < 120">交易日少於 120 天，Beta 的統計誤差較大。</template>
          </p>

          <el-table :data="[
            { name: '年化波動度', ours: pct(report.portfolio.annualizedVolatility), market: pct(report.benchmark.annualizedVolatility), meaning: '每天漲跌幅度的大小，換算成一年' },
            { name: '最大回撤', ours: drawdownText(report.portfolio.maxDrawdown), market: drawdownText(report.benchmark.maxDrawdown), meaning: '期間內從高點到之後低點的最大跌幅' },
            { name: 'Beta', ours: plain(report.portfolio.beta), market: '1.00', meaning: '大盤漲跌 1% 時，這組持股平均跟著漲跌幾 %' },
            { name: '與大盤的相關係數', ours: plain(report.portfolio.correlation), market: '1.00', meaning: '漲跌方向跟大盤一致的程度，介於 −1 到 1' }
          ]" class="risk-table">
            <el-table-column label="指標" prop="name" min-width="140" />
            <el-table-column label="你的持股" prop="ours" align="right" min-width="110" />
            <el-table-column label="同期加權指數" prop="market" align="right" min-width="120" />
            <el-table-column label="意思" prop="meaning" min-width="260" />
          </el-table>

          <ul class="risk-page__notes">
            <li v-if="drawdownDates(report.portfolio.maxDrawdown)">你的持股最大回撤：{{ drawdownDates(report.portfolio.maxDrawdown) }}</li>
            <li v-if="drawdownDates(report.benchmark.maxDrawdown)">加權指數最大回撤：{{ drawdownDates(report.benchmark.maxDrawdown) }}</li>
          </ul>

          <section v-if="partialHoldings.length" aria-labelledby="risk-partial-title">
            <h3 id="risk-partial-title" class="risk-page__subsection-title">期間中才有股價的持股（{{ partialHoldings.length }} 檔）</h3>
            <p class="risk-page__note">這幾檔在有股價之前沒有算進去，那段期間的比例分給其他持股。</p>
            <ul class="risk-page__notes">
              <li v-for="item in partialHoldings" :key="item.label">
                {{ item.label }}：{{ item.coverage === 'none' ? '這段期間沒有股價' : `${item.firstPriceDate} 起才有股價` }}
              </li>
            </ul>
          </section>

          <p class="risk-page__footnote">
            用「現在每一檔的市值比例」套用過去每天的股價算出，描述的是現在這組持股，不是你過去實際的持股。因為持股是事後選的，回推會高估報酬，所以這裡不顯示報酬率；真實的期間報酬請看「交易績效」。除權配股的股價下跌已還原，現金股利未還原，跟價格型加權指數口徑一致。數字只陳述過去的統計，不代表未來，也不構成任何買賣建議。
          </p>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
.risk-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.risk-page__heading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.risk-page__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.risk-page__subtitle {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.risk-page__placeholder {
  min-height: 200px;
}

.risk-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.risk-page__subsection-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 16px 0 8px;
}

.risk-page__retry {
  margin-top: 8px;
}

.risk-page__note {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}

.risk-page__notes {
  margin: 12px 0 0;
  padding-left: 20px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.risk-page__footnote {
  margin: 16px 0 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.risk-table :deep(td) {
  font-variant-numeric: tabular-nums;
}

.risk-guest {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 24px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.risk-guest__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.risk-guest__text {
  margin: 0;
  color: var(--el-text-color-regular);
}

.risk-range {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.risk-range__label {
  font-weight: 600;
}
</style>
