<script setup lang="ts">
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import type { RiskDrawdown, RiskOutcome, StressOutcome } from '~/composables/stock/useHoldings'
import { getAccentColor, getChartInk, CHART_TOOLTIP, CHART_TOOLTIP_INK } from '~/utils/chart-palette'

use([SVGRenderer, BarChart, GridComponent, LegendComponent, TooltipComponent])

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
const { fetchRisk, fetchStress } = useHoldings()
const { data: companies } = useCompanyIndex()
const companyByCode = computed(() => new Map(companies.value.map(entry => [entry.code, entry])))

// 見 holdings/index.vue：登入狀態只在瀏覽器裡才知道，掛載前一律當成還不知道，免得 hydration 不一致。
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

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

function drawdownDates(drawdown: RiskDrawdown | null): string {
  if (!drawdown?.peakDate || !drawdown.troughDate) return ''
  return `${drawdown.peakDate} 高點 → ${drawdown.troughDate} 低點，${drawdown.recoveryDate ? `${drawdown.recoveryDate} 回到前高` : '期間結束時尚未回到前高'}`
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
    { name: 'Beta（回推）', value: plain(r.portfolio.beta), market: '1.00', meaning: '用現在持股回推：大盤漲跌 1% 時，這組持股平均跟著漲跌幾 %。跟「交易績效」頁用實際報酬算的 Beta 不同' },
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
  return `以現在的市值 ${holdingsMetricText(r.marketValue, 'money')} 計，最差 5% 的日子單日約少 ${loss(var95)}${es == null ? '' : `；那 5% 的日子平均少 ${loss(es)}`}。`
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
    legend: { top: 0, textStyle: { color: ink.primary, fontSize: 16 } },
    grid: { left: 8, right: 56, top: 40, bottom: 8, containLabel: true },
    tooltip: {
      ...CHART_TOOLTIP,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      textStyle: { color: CHART_TOOLTIP_INK.primary, fontSize: 16 },
      valueFormatter: (value: number | null) => (value === null ? '－' : `${value.toFixed(1)}%`)
    },
    xAxis: { type: 'value', axisLabel: { color: ink.muted, fontSize: 16, formatter: '{value}%' }, splitLine: { lineStyle: { color: ink.gridline } } },
    yAxis: { type: 'category', data: holdings.map(holding => holdingLabel(holding.symbol)), axisLabel: { color: ink.primary, fontSize: 16 }, axisLine: { lineStyle: { color: ink.baseline } } },
    series: [
      { name: '權重', type: 'bar', barMaxWidth: 14, data: holdings.map(holding => toPct(holding.weight)), label: { show: true, position: 'right', color: ink.muted, fontSize: 16, formatter: '{c}%' } },
      { name: '風險貢獻', type: 'bar', barMaxWidth: 14, data: holdings.map(holding => toPct(holding.riskContribution)), label: { show: true, position: 'right', color: ink.primary, fontSize: 16, formatter: '{c}%' } }
    ]
  }
})

// ---- 歷史壓力情境（bff-ts 9d691cd）：現在的持股權重放回四段加權指數高點→低點。沒有期間參數，跟上面的
// 期間選擇無關。每個情境下面列出貢獻最大的三檔——一檔就可能主宰整段（bff-ts 實測 2022 那段 +3.6% 幾乎全來自
// 2364），只看總數會被讀成「這組持股抗跌」。逐檔報酬 bff-ts 還沒加上時，那幾行就不出現。
const stress = ref<StressOutcome | null>(null)
async function loadStress() {
  stress.value = await fetchStress()
}

const stressScenarios = computed(() => (stress.value?.ok ? stress.value.result.scenarios : []))
const stressRows = computed(() => stressScenarios.value.map(scenario => ({
  name: scenario.name,
  value: scenario.available ? holdingsMetricText(scenario.portfolio.periodReturn, 'signedPct') : '持股當時都還沒有股價',
  market: holdingsMetricText(scenario.benchmark.periodReturn, 'signedPct'),
  meaning: [`${scenario.peakDate} → ${scenario.troughDate}`, uncoveredText(scenario.coveredWeight)].filter(Boolean).join('；')
})))
const stressContributors = computed(() => stressScenarios.value
  .map(scenario => ({
    name: scenario.name,
    items: topContributors(scenario.holdings ?? []).map(item => `${holdingLabel(item.symbol)} ${item.points > 0 ? '+' : ''}${item.points.toFixed(1)} 個百分點`)
  }))
  .filter(scenario => scenario.items.length))

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
  if (uid) {
    loadRisk()
    loadStress()
  } else {
    outcome.value = null
    stress.value = null
  }
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
      <HoldingsRangePicker />

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

          <HoldingsMetricTable caption="持股與同期加權指數的風險指標" :rows="metricRows" market-label="同期加權指數" />
          <p v-if="lossAmountText" class="risk-page__note risk-page__note--after">{{ lossAmountText }}</p>

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

          <section v-if="concentrationRows.length" aria-labelledby="risk-concentration-title">
            <h2 id="risk-concentration-title" class="risk-page__section-title risk-page__section-title--spaced">分散化與風險貢獻</h2>
            <HoldingsMetricTable caption="持股的分散化比率" :rows="concentrationRows" value-label="數值" />

            <h3 id="risk-contribution-title" class="risk-page__subsection-title">各檔的權重與風險貢獻</h3>
            <p class="risk-page__note">風險貢獻是每一檔佔組合整體波動的比例，全部加起來約 100%；權重小的持股，風險貢獻可能比權重大。</p>
            <ClientOnly>
              <SharedChart
                v-if="hasContribution"
                class="risk-contribution-chart"
                :style="{ height: contributionChartHeight }"
                :option="contributionOption"
                autoresize
                role="img"
                aria-labelledby="risk-contribution-title"
              />
            </ClientOnly>
            <HoldingsMetricTable caption="各檔持股的權重與風險貢獻" :rows="contributionRows" value-label="權重" market-label="風險貢獻" />
          </section>

          <p class="risk-page__footnote">
            用「現在每一檔的市值比例」套用過去每天的股價算出，描述的是現在這組持股，不是你過去實際的持股。因為持股是事後選的，回推會高估報酬，所以這裡不顯示報酬率；真實的期間報酬請看「交易績效」。除權配股的股價下跌已還原，現金股利未還原，跟價格型加權指數口徑一致。數字只陳述過去的統計，不代表未來，也不構成任何買賣建議。
          </p>
        </template>
      </section>

      <section aria-labelledby="risk-stress-title">
        <h2 id="risk-stress-title" class="risk-page__section-title">歷史壓力情境（以現在持股回推）</h2>
        <el-alert v-if="stress && !stress.ok" type="error" :closable="false" show-icon :title="stress.message">
          <el-button class="risk-page__retry" @click="loadStress">重新載入</el-button>
        </el-alert>
        <template v-else-if="stressRows.length">
          <p class="risk-page__note">把現在每一檔的比例（每天維持不變）放回加權指數過去四段從高點到低點的期間，看這組持股當時的報酬。</p>
          <HoldingsMetricTable caption="現在持股在歷史下跌期間的回推報酬" :rows="stressRows" name-label="情境" value-label="你的持股" market-label="加權指數" meaning-label="期間" />
          <ul v-if="stressContributors.length" class="risk-page__notes">
            <li v-for="scenario in stressContributors" :key="scenario.name">{{ scenario.name }}，貢獻最大：{{ scenario.items.join('、') }}</li>
          </ul>
          <p class="risk-page__footnote">描述的是現在這組持股放回當時的樣子，不是你當時實際的持股；情境的日期是加權指數的高點與低點。只陳述過去的統計，不代表未來，也不構成任何買賣建議。</p>
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

.risk-page__section-title--spaced {
  margin-top: 32px;
}

.risk-page__note--after {
  margin-top: 12px;
}

.risk-contribution-chart {
  width: 100%;
  margin-bottom: 16px;
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

</style>
