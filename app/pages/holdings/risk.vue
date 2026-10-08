<script setup lang="ts">
import type { RiskDrawdown, RiskOutcome } from '~/composables/stock/useHoldings'
import { getAccentColor, getChartInk } from '~/utils/chart-palette'

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
const { fetchRisk } = useHoldings()
const { data: companies } = useCompanyIndex()
const companyByCode = computed(() => new Map(companies.value.map(entry => [entry.code, entry])))

// 跟報酬與大盤、已實現損益、績效統計共用同一段期間（useHoldingsRange），切頁不重設
const range = useHoldingsRange()
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

// ---- 2026-10-07 加的指標（使用者確認的設計：分佈型風險補進同一張表、VaR／ES 換成金額、新增「集中與分散」）。
// 缺值的原因分開命名，邏輯與檢查在 utils/holdings-metrics.ts。
const metricRows = computed(() => {
  const r = report.value
  if (!r) return []
  const tailMissing = firstReason(sampleShortfall(r.tradingDays, TAIL_MIN_DAYS))
  return [
    { name: '年化波動度', value: pct(r.portfolio.annualizedVolatility), market: pct(r.benchmark.annualizedVolatility), meaning: '每天漲跌幅度的大小，換算成一年' },
    { name: '下行標準差（年化）', value: holdingsMetricText(r.portfolio.downsideDeviation, 'pct'), market: holdingsMetricText(r.benchmark.downsideDeviation, 'pct'), meaning: '只算下跌那幾天的波動，換算成一年' },
    { name: '最大回撤', value: drawdownText(r.portfolio.maxDrawdown), market: drawdownText(r.benchmark.maxDrawdown), meaning: '期間內從高點到之後低點的最大跌幅' },
    { name: '潰瘍指數', value: holdingsMetricText(r.portfolio.ulcerIndex, 'pct'), market: holdingsMetricText(r.benchmark.ulcerIndex, 'pct'), meaning: '每天距離前高跌了多少的平均，跌得越深、越久，數字越大' },
    { name: '單日 VaR（95%）', value: holdingsMetricText(r.portfolio.valueAtRisk95, 'pct', tailMissing, 2), market: holdingsMetricText(r.benchmark.valueAtRisk95, 'pct', tailMissing, 2), meaning: '把期間內每天的漲跌排序，最差 5% 的那個門檻' },
    { name: '單日 ES（95%）', value: holdingsMetricText(r.portfolio.expectedShortfall95, 'pct', tailMissing, 2), market: holdingsMetricText(r.benchmark.expectedShortfall95, 'pct', tailMissing, 2), meaning: '最差 5% 的那些天，平均跌多少' },
    { name: 'Beta（回推）', value: plain(r.portfolio.beta), market: '1.00', meaning: '用現在持股回推：大盤漲跌 1% 時，這組持股平均跟著漲跌幾 %。跟「績效統計」頁用實際報酬算的 Beta 不同' },
    { name: '與大盤的相關係數', value: plain(r.portfolio.correlation), market: '1.00', meaning: '漲跌方向跟大盤一致的程度，介於 −1 到 1' }
  ]
})

// VaR／ES 換成金額：以現在的市值，最差 5% 的日子單日會少多少（bff-ts 已乘好，通常 ≤ 0，這裡寫成「少 N 元」）
const lossAmountText = computed(() => {
  const r = report.value
  const var95 = r?.portfolio.valueAtRisk95Amount
  if (!r?.marketValue || var95 == null) return ''
  const es = r.portfolio.expectedShortfall95Amount
  const loss = (value: string) => holdingsMetricText(String(Math.abs(Number(value))), 'money')
  return `以現在市值 ${holdingsMetricText(r.marketValue, 'money')} 計，最差 5% 的日子單日約少 ${loss(var95)}${es == null ? '' : `，平均少 ${loss(es)}`}。`
})

// ---- 集中與分散 ----
const holdingLabel = (symbol: string) => {
  const entry = companyByCode.value.get(symbol)
  return entry ? `${entry.name} ${symbol}` : symbol
}

const concentrationRows = computed(() => {
  const r = report.value
  if (!r?.concentration) return []
  // 有效持股數、前三大權重 2026-10-07 搬到持股分析頁（那是占比的事實，不需要股價歷史）；這裡只留要用股價回推的
  return [
    { name: '分散化比率', value: holdingsMetricText(r.diversificationRatio, 'ratio', firstReason(sampleShortfall(r.tradingDays, COVARIANCE_MIN_DAYS))), meaning: '各檔波動度依權重平均 ÷ 組合的波動度（≥ 1），數字越大，各檔漲跌互相抵銷的部分越多' }
  ]
})

// 依權重由大到小；沒參與回推的（coverage none，權重是 null）不列
const contributionHoldings = computed(() => (report.value?.holdings ?? [])
  .filter(holding => holding.weight !== null)
  .sort((a, b) => Number(b.weight) - Number(a.weight)))

const contributionRows = computed(() => {
  const r = report.value
  if (!r) return []
  const missing = firstReason(sampleShortfall(r.tradingDays, COVARIANCE_MIN_DAYS))
  return contributionHoldings.value.map(holding => ({
    name: holdingLabel(holding.symbol),
    value: holdingsMetricText(holding.weight, 'pct'),
    market: holdingsMetricText(holding.riskContribution, 'pct', holding.coverage === 'partial' ? '期間中才有股價' : missing)
  }))
})

// 「權重小、風險大」一眼看出來：每檔兩根橫條，權重用中性墨色、風險貢獻用強調色——兩根是不同的量，不是好壞
const { resolvedMode, color: accentColorName } = useAppTheme()
const hasContribution = computed(() => contributionHoldings.value.some(holding => holding.riskContribution !== null))
const contributionChartHeight = computed(() => `${Math.max(200, contributionHoldings.value.length * 44 + 80)}px`)
const contributionOption = computed(() => {
  const ink = getChartInk(resolvedMode.value)
  // ECharts 的類別軸由下往上排，反過來才是最大的在最上面
  const holdings = [...contributionHoldings.value].reverse()
  const toPct = (value: string | null) => (value === null ? null : Number((Number(value) * 100).toFixed(1)))
  return {
    color: [ink.muted, getAccentColor(resolvedMode.value, accentColorName.value)],
    legend: { top: 0, textStyle: { color: ink.primary } },
    grid: { left: 8, right: 56, top: 40, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      textStyle: { fontSize: 16 },
      valueFormatter: (value: number | null) => (value === null ? '－' : `${value.toFixed(1)}%`)
    },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category', data: holdings.map(holding => holdingLabel(holding.symbol)), axisLabel: { color: ink.primary } },
    series: [
      { name: '權重', type: 'bar', barMaxWidth: 14, data: holdings.map(holding => toPct(holding.weight)), label: { show: true, position: 'right', color: ink.muted, fontSize: 16, formatter: '{c}%' } },
      { name: '風險貢獻', type: 'bar', barMaxWidth: 14, data: holdings.map(holding => toPct(holding.riskContribution)), label: { show: true, position: 'right', color: ink.primary, fontSize: 16, formatter: '{c}%' } }
    ]
  }
})

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
  <HoldingsPageShell title="風險" subtitle="用現在的持股比例回推過去的股價，看這組持股的波動和跌幅，並跟同期加權指數並列" guest-title="登入後查看你的持股風險指標">

      <HoldingsRangePicker :pending="pending" />

      <!-- 分散化與風險貢獻放最前面（2026-10-07「risk 我想先看到 分散化與風險貢獻」），風險指標接在後面。
           交易日數那一句兩段共用，放在最上面。 -->
      <div v-loading="pending" class="risk-page__body">
        <el-alert v-if="outcome && !outcome.ok" type="error" :closable="false" show-icon :title="outcome.message">
          <el-button class="risk-page__retry" @click="loadRisk">重新載入</el-button>
        </el-alert>

        <template v-else-if="report">
          <p class="risk-page__note">
            依 {{ report.tradingDays }} 個交易日計算<template v-if="report.weightsAsOf">，持股比例以 {{ report.weightsAsOf }} 的收盤價為準</template>。
            <template v-if="fewDays < 60">交易日少於 60 天，波動度的統計誤差較大。</template>
            <template v-else-if="fewDays < 120">交易日少於 120 天，Beta 的統計誤差較大。</template>
          </p>

          <section v-if="concentrationRows.length" aria-labelledby="risk-concentration-title">
            <h2 id="risk-concentration-title" class="risk-page__section-title">分散化與風險貢獻</h2>
            <!-- 先圖後表（2026-10-07「risk 先圖表 再表格」，同站上指標頁的規矩） -->
            <p class="risk-page__note">風險貢獻：每一檔佔整體波動的比例，合計約 100%。</p>
            <ClientOnly>
              <SharedChart
                v-if="hasContribution"
                class="risk-contribution-chart"
                :style="{ height: contributionChartHeight }"
                :option="contributionOption"
                autoresize
                role="img"
                aria-label="各檔持股的權重與風險貢獻"
              />
            </ClientOnly>
            <!-- 有圖時表格收進 details（2026-10-08「有了圖表還需要表格嗎…可以收合精簡視覺嗎」）：圖是 canvas，
                 螢幕閱讀器念不出各檔數字，所以文字版必須在，只是預設收起來。沒有圖時直接攤開。 -->
            <details v-if="hasContribution" class="holdings-details">
              <summary>各檔數字（{{ contributionRows.length }} 檔）</summary>
              <HoldingsMetricTable caption="各檔持股的權重與風險貢獻" :rows="contributionRows" value-label="權重" market-label="風險貢獻" />
            </details>
            <HoldingsMetricTable v-else caption="各檔持股的權重與風險貢獻" :rows="contributionRows" value-label="權重" market-label="風險貢獻" />
            <HoldingsMetricTable class="risk-page__after-table" caption="持股的分散化比率" :rows="concentrationRows" value-label="數值" />
          </section>

          <section aria-labelledby="risk-metrics-title">
            <h2 id="risk-metrics-title" class="risk-page__section-title">風險指標</h2>
            <HoldingsMetricTable caption="持股與同期加權指數的風險指標" :rows="metricRows" market-label="同期加權指數" />
            <p v-if="lossAmountText" class="risk-page__note risk-page__note--after">{{ lossAmountText }}</p>
            <!-- 會改變數字的缺口才留在外面，一行（2026-10-08「risk 底部的文字說明太多」：原本是 h3＋說明＋清單） -->
            <p v-if="partialHoldings.length" class="risk-page__note">
              期間中才有股價（之前的比例分給其他持股）：{{ partialCoverageText(partialHoldings) }}
            </p>
          </section>

          <!-- 口徑與回撤日期收進「計算方式」，同持股總覽（2026-10-08 同一句） -->
          <details class="holdings-details">
            <summary>計算方式</summary>
            <ul class="risk-page__notes">
              <li>用現在每一檔的市值比例套用過去的股價，不是你過去實際的持股；持股是事後選的，所以不顯示報酬率，實際報酬請看「報酬與大盤」。</li>
              <li>除權配股已還原，現金股利未還原，與價格型加權指數相同。</li>
              <li v-if="drawdownDates(report.portfolio.maxDrawdown)">持股最大回撤：{{ drawdownDates(report.portfolio.maxDrawdown) }}</li>
              <li v-if="drawdownDates(report.benchmark.maxDrawdown)">加權指數最大回撤：{{ drawdownDates(report.benchmark.maxDrawdown) }}</li>
            </ul>
          </details>

        </template>
      </div>

  </HoldingsPageShell>
</template>

<style scoped>
.risk-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.risk-page__note--after {
  margin-top: 12px;
}

.risk-page__body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.risk-page__after-table {
  margin-top: 16px;
}

.risk-contribution-chart {
  width: 100%;
  margin-bottom: 16px;
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
</style>
