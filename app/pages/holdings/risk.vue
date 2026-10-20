<script setup lang="ts">
import type { RiskDrawdown, RiskOutcome, RiskReport } from '~/composables/holdings/holdings-model'
// 持股的風險指標（2026-10-05）：使用者在 業務中台 那邊要了組合的風險指標，選「用現在的持股回推」——拿現在每一檔
// 的市值比例，套用過去的股價（GET /holdings/risk，業務中台 23b7b09）。放在側欄第四項而不是交易績效頁：它描述
// 的是「現在這組持股」，不是已實現的交易結果。
//
// 業務中台 要求照實呈現的四件事，這頁都做到：
//   1. 沒有報酬率與夏普比率（持股是事後選的，回推的報酬會偏高；真實報酬看交易績效）。
//   2. 一併顯示用了幾個交易日（波動度約 60 天、波動占比與相關係數約 120 天以上才有參考價值）。
//   3. 期間中才有股價的持股（coverage partial）照實列出。
//   4. 只陳述數字與定義，不加「風險偏高」這類評語或等級（投信投顧法）。
//
// Personal page: out of the index and the sitemap (/holdings/**).
useSeoMeta({ title: '風險', robots: 'noindex, nofollow' })

const currentUser = useCurrentUser()
const authResolved = useAuthResolved()
const { fetchRisk } = useHoldings()

// 跟報酬與大盤、已實現損益、績效統計共用同一段期間（useHoldingsRange），切頁不重設
const range = useHoldingsRange()
const outcome = ref<RiskOutcome | null>(null)
const pending = ref(false)

// 讀取失敗交給全站彈窗（2026-10-11）；只有「開始日期早於歷史價格」這種可行動的失敗留在頁面上的提示框
watchLoadFailure('holdings-risk', () => (outcome.value && !outcome.value.ok ? outcome.value.error ?? null : null), () => loadRisk())

async function loadRisk() {
  pending.value = true
  outcome.value = await fetchRisk(range.value[0], range.value[1])
  pending.value = false
}

const report = computed(() => (outcome.value?.ok ? outcome.value.result : null))
const companyByCode = useCompanyLookup(() => report.value?.holdings.map(holding => holding.symbol) ?? [])

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
// 2026-10-19 簡化（使用者：「holdings/risk 版面太複雜請簡化」）：預設只列 core 的幾項，波動、跌幅、最差的日子各一項，
// 加上潰瘍指數（使用者同日：「潰瘍指數很重要呢 希望他不要預設被隱藏」）；
// 其餘連同原本自成一張表的分散化比率，按「顯示全部指標」才列在同一張表、欄位對齊（同財報頁的「顯示全部科目」）。
// 原本表格下面那句 VaR／ES 換成金額，寫進這兩列的「意思」。
// 2026-10-20 Beta 拿掉（使用者：「holdings/analysis holdings/risk 做好資訊分工 避免重複」，選「Beta 歸持股特色」）：持股分析的
// 持股特色是同一支、同一段近一年的數字，還會跟著分享帶出去。這頁只講價格起伏：波動、跌幅、哪幾檔占了波動
// （現在持有的「是什麼」在持股分析，「漲跌起伏多大」在這裡）。
const showAllMetrics = ref(false)
const metricsTableId = useId()
// 讀的時候（2026-10-20）：用一份空的報告算出同樣的列（名稱與意思），數值清空，表格畫成骨架（HoldingsMetricTable loading）。
// 空報告的欄位都是 undefined，pct／plain／holdingsMetricText／drawdownText 都當成沒有值
const BLANK_REPORT = { tradingDays: 0, marketValue: null, portfolio: {}, benchmark: {}, diversificationRatio: null } as unknown as RiskReport
const metricRows = computed(() => {
  if (!report.value) return outcome.value ? [] : metricRowsOf(BLANK_REPORT).map(row => ({ ...row, value: '', market: '' }))
  return metricRowsOf(report.value)
})
function metricRowsOf(r: RiskReport) {
  const tailMissing = firstReason(sampleShortfall(r.tradingDays, TAIL_MIN_DAYS))
  // 以現在的市值，最差 5% 的日子單日會少多少（業務中台 已乘好，通常 ≤ 0，這裡寫成「少 N 元」）
  const loss = (value: string | null | undefined) => (r.marketValue && value != null ? holdingsMetricText(String(Math.abs(Number(value))), 'money') : null)
  const varLoss = loss(r.portfolio.valueAtRisk95Amount)
  const esLoss = loss(r.portfolio.expectedShortfall95Amount)
  return [
    { core: true, name: '年化波動度', value: pct(r.portfolio.annualizedVolatility), market: pct(r.benchmark.annualizedVolatility), meaning: '每天漲跌幅度的大小，換算成一年' },
    { core: false, name: '下行標準差（年化）', value: holdingsMetricText(r.portfolio.downsideDeviation, 'pct'), market: holdingsMetricText(r.benchmark.downsideDeviation, 'pct'), meaning: '只算下跌那幾天的波動，換算成一年' },
    { core: true, name: '最大回撤', value: drawdownText(r.portfolio.maxDrawdown), market: drawdownText(r.benchmark.maxDrawdown), meaning: '期間內從高點到之後低點的最大跌幅' },
    { core: true, name: '潰瘍指數', value: holdingsMetricText(r.portfolio.ulcerIndex, 'pct'), market: holdingsMetricText(r.benchmark.ulcerIndex, 'pct'), meaning: '每天距離前高跌了多少的平均，跌得越深、越久，數字越大' },
    { core: true, name: '單日 VaR（95%）', value: holdingsMetricText(r.portfolio.valueAtRisk95, 'pct', tailMissing, 2), market: holdingsMetricText(r.benchmark.valueAtRisk95, 'pct', tailMissing, 2), meaning: varLoss ? `以現在市值 ${holdingsMetricText(r.marketValue, 'money')}計，最差 5% 的日子單日約少 ${varLoss}` : '把期間內每天的漲跌排序，最差 5% 的那個門檻' },
    { core: false, name: '單日 ES（95%）', value: holdingsMetricText(r.portfolio.expectedShortfall95, 'pct', tailMissing, 2), market: holdingsMetricText(r.benchmark.expectedShortfall95, 'pct', tailMissing, 2), meaning: esLoss ? `最差 5% 的那些天，以現在市值平均約少 ${esLoss}` : '最差 5% 的那些天，平均跌多少' },
    { core: false, name: '與大盤的相關係數', value: plain(r.portfolio.correlation), market: '1.00', meaning: '漲跌方向跟大盤一致的程度，介於 −1 到 1' },
    // 有效持股數、前三大權重 2026-10-07 搬到持股分析頁（那是占比的事實，不需要股價歷史）；這裡只留要用股價回推的
    { core: false, name: '分散化比率', value: holdingsMetricText(r.diversificationRatio, 'ratio', firstReason(sampleShortfall(r.tradingDays, COVARIANCE_MIN_DAYS))), meaning: '各檔波動度依權重平均 ÷ 組合的波動度（≥ 1），數字越大，各檔漲跌互相抵銷的部分越多' }
  ]
}
const shownMetricRows = computed(() => metricRows.value.filter(row => row.core || showAllMetrics.value))

// ---- 各檔的市值占比與波動占比 ----
const holdingLabel = (symbol: string) => {
  const entry = companyByCode.value.get(symbol)
  return entry ? `${entry.name} ${symbol}` : symbol
}

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

// 「權重小、風險大」一眼看出來：每檔兩根橫條，權重用中性墨色、風險貢獻用強調色——兩根是不同的量，不是好壞。
// 2026-10-19：圖例改叫「市值占比／波動占比」，不必再配一句說明；橫條上已有數字，數值軸拿掉（375 寬時刻度字會疊在一起）
const { resolvedMode, color: accentColorName } = useAppTheme()
const hasContribution = computed(() => contributionHoldings.value.some(holding => holding.riskContribution !== null))
// 一檔一列兩根橫條：高度跟著檔數。讀的時候照上次的檔數畫同樣高的骨架（useLayoutHint）
const chartHeightFor = (count: number) => `${Math.max(200, count * 44 + 80)}px`
const contributionChartHeight = computed(() => chartHeightFor(contributionHoldings.value.length))
const contributionCountHint = useLayoutHint('holdings-risk-holdings', 5)
watch(contributionHoldings, (list) => {
  if (report.value) contributionCountHint.value = list.length
})
const contributionOption = computed(() => {
  const ink = getChartInk(resolvedMode.value)
  // ECharts 的類別軸由下往上排，反過來才是最大的在最上面
  const holdings = [...contributionHoldings.value].reverse()
  const toPct = (value: string | null) => (value === null ? null : Number((Number(value) * 100).toFixed(1)))
  // 一律一位小數：「{c}%」會把 54.0 印成「54%」，跟旁邊的「53.3%」對不齊
  const label = (color: string) => ({ show: true, position: 'right', color, fontSize: 16, formatter: ({ value }: { value: number | null }) => (value === null ? '' : `${value.toFixed(1)}%`) })
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
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'category', data: holdings.map(holding => holdingLabel(holding.symbol)), axisLabel: { color: ink.primary } },
    series: [
      { name: '市值占比', type: 'bar', barMaxWidth: 14, data: holdings.map(holding => toPct(holding.weight)), label: label(ink.muted) },
      { name: '波動占比', type: 'bar', barMaxWidth: 14, data: holdings.map(holding => toPct(holding.riskContribution)), label: label(ink.primary) }
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

// 誰＋哪個帳戶（2026-10-19）：換帳戶就跟換人一樣重新載入
const { holdingsScope } = useHoldingsPortfolios()
watch([authResolved, holdingsScope, range], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) loadRisk()
  else outcome.value = null
}, { immediate: true })
</script>

<template>
  <HoldingsPageShell title="風險" subtitle="用現在的持股比例回推過去的股價，看漲跌起伏有多大" guest-title="登入後查看你的持股風險指標" :pending="pending && !outcome">
    <template #default="{ loading }">

      <!-- 交易日數寫在期間旁邊（業務中台 要求一併顯示；兩段共用。2026-10-19 從內容上方獨立的一句搬來） -->
      <HoldingsRangePicker :pending="pending" :days="report?.tradingDays" :days-pending="loading" />

      <!-- 2026-10-19 簡化（使用者：「holdings/risk 版面太複雜請簡化」）：每段只剩問句 → 圖或表 → 一個展開。
           波動占比（風險貢獻）仍放最前面（2026-10-07「risk 我想先看到 分散化與風險貢獻」）。 -->
      <!-- 遮罩只給換期間（內容已經在畫面上）；第一次讀的時候問句、指標名稱與意思、計算方式照畫，圖與數字是骨架（2026-10-20） -->
      <div v-loading="pending && !loading" class="risk-page__body" :aria-busy="loading">
        <el-alert v-if="outcome && !outcome.ok && !outcome.error" type="error" :closable="false" show-icon :title="outcome.message">
          <el-button @click="loadRisk">重新載入</el-button>
        </el-alert>

        <template v-else-if="loading || report">

          <section v-if="loading ? contributionCountHint : contributionRows.length" aria-labelledby="risk-contribution-title">
            <h2 id="risk-contribution-title" class="risk-page__section-title">哪幾檔占了大部分的波動？</h2>
            <!-- 先圖後表（2026-10-07「risk 先圖表 再表格」，同站上指標頁的規矩） -->
            <div v-if="loading" class="risk-contribution-chart app-skeleton" :style="{ height: chartHeightFor(contributionCountHint) }" aria-hidden="true" />
            <ClientOnly v-else>
              <SharedChart
                v-if="hasContribution"
                class="risk-contribution-chart"
                :style="{ height: contributionChartHeight }"
                :option="contributionOption"
                autoresize
                role="img"
                aria-label="各檔持股的市值占比與波動占比"
              />
            </ClientOnly>
            <!-- 有圖時表格收進 details（2026-10-08「有了圖表還需要表格嗎…可以收合精簡視覺嗎」）：圖是 canvas，
                 螢幕閱讀器念不出各檔數字，所以文字版必須在，只是預設收起來。沒有圖時直接攤開。 -->
            <details v-if="loading || hasContribution" class="holdings-details">
              <summary>各檔數字<span v-if="loading" class="app-skeleton app-skeleton--flow" aria-hidden="true">（{{ contributionCountHint }} 檔）</span><template v-else>（{{ contributionRows.length }} 檔）</template></summary>
              <HoldingsMetricTable caption="各檔持股的市值占比與波動占比" :rows="contributionRows" value-label="市值占比" market-label="波動占比" />
            </details>
            <HoldingsMetricTable v-else caption="各檔持股的市值占比與波動占比" :rows="contributionRows" value-label="市值占比" market-label="波動占比" />
          </section>

          <section aria-labelledby="risk-metrics-title">
            <h2 id="risk-metrics-title" class="risk-page__section-title">波動和跌幅跟大盤比起來如何？</h2>
            <HoldingsMetricTable :id="metricsTableId" caption="持股與同期加權指數的風險指標" :rows="shownMetricRows" market-label="同期加權指數" :loading="loading" />
            <el-button link type="primary" class="risk-page__toggle" :aria-expanded="showAllMetrics" :aria-controls="metricsTableId" @click="showAllMetrics = !showAllMetrics">
              {{ showAllMetrics ? '只看主要指標' : `顯示全部指標（另有 ${metricRows.length - shownMetricRows.length} 項）` }}
            </el-button>
            <!-- 會改變數字的缺口才留在外面，一行（2026-10-08「risk 底部的文字說明太多」：原本是 h3＋說明＋清單） -->
            <!-- 統計天數不足時照實說，不下結論；少於 120 天時，波動占比與分散化比率的格子自己寫「樣本不足」。放在表格下面
                 （2026-10-20）：資料到了才知道要不要這一行，原本在最上面，出現時把兩段一起往下推（正式建置量到 0.038） -->
            <p v-if="!loading && fewDays < 60" class="risk-page__note">交易日少於 60 天，波動度的統計誤差較大。</p>
            <p v-if="partialHoldings.length" class="risk-page__note">
              期間中才有股價（之前的比例分給其他持股）：{{ partialCoverageText(partialHoldings) }}
            </p>
          </section>

          <!-- 口徑與回撤日期收進「計算方式」，同持股總覽（2026-10-08 同一句） -->
          <details class="holdings-details">
            <summary>計算方式</summary>
            <ul class="risk-page__notes">
              <li>用現在每一檔的市值比例<template v-if="report?.weightsAsOf">（以 {{ report.weightsAsOf }} 的收盤價為準）</template>套用過去的股價，不是你過去實際的持股；持股是事後選的，所以不顯示報酬率，實際報酬請看「報酬與大盤」。</li>
              <li>波動占比（風險貢獻）：每一檔占整體波動的比例，合計約 100%。</li>
              <li>除權配股已還原，現金股利未還原，與價格型加權指數相同。</li>
              <li v-if="report && drawdownDates(report.portfolio.maxDrawdown)">持股最大回撤：{{ drawdownDates(report.portfolio.maxDrawdown) }}</li>
              <li v-if="report && drawdownDates(report.benchmark.maxDrawdown)">加權指數最大回撤：{{ drawdownDates(report.benchmark.maxDrawdown) }}</li>
            </ul>
          </details>

        </template>
      </div>

    </template>
  </HoldingsPageShell>
</template>

<style scoped>
.risk-page__section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.risk-page__body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.risk-page__toggle {
  min-height: 44px;
}

.risk-contribution-chart {
  width: 100%;
  margin-bottom: 16px;
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
