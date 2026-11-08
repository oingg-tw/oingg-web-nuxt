<script setup lang="ts">
import type { RiskDrawdown, RiskOutcome, RiskReport } from '~/composables/holdings/holdings-model'
import type { ChartLegendGroup } from '~/components/shared/SharedChartLegend.vue'
// 持股的風險指標（2026-10-05）：使用者在 業務中台 那邊要了組合的風險指標，選「用現在的持股回推」——拿現在每一檔
// 的市值比例，套用過去的股價（GET /holdings/risk，業務中台 23b7b09）。放在側欄第四項而不是交易績效頁：它描述
// 的是「現在這組持股」，不是已實現的交易結果。
//
// 2026-10-21 加過實際經歷的跌幅（每天真的持股，從報酬與大盤搬來的四列），2026-11-08 整段刪掉（使用者：「實際經歷多大跌幅這個卡片刪掉」），
// 這頁從此只有回推、只讀 GET /holdings/risk。同一天潰瘍指數自成一段、放最上面（「潰瘍指數卡片放上面」，見下面的方案 C）
//
// 業務中台 要求照實呈現的四件事，這頁都做到：
//   1. 沒有報酬率與夏普比率（持股是事後選的，回推的報酬會偏高；真實報酬看交易績效）。
//   2. 一併顯示用了幾個交易日（波動度約 60 天、波動占比與相關係數約 120 天以上才有參考價值）。
//   3. 期間中才有股價的持股（coverage partial）照實列出。
//   4. 只陳述數字與定義，不加「風險偏高」這類評語或等級（投信投顧法）。
//
// Personal page: out of the index and the sitemap (/holdings/**).
useSeoMeta({ title: '風險', robots: 'noindex, nofollow' })

const authResolved = useAuthResolved()
const { fetchRisk, ledgerVersion } = useHoldings()

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

function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '－'
  return minusSign(`${(value * 100).toFixed(digits)}%`)
}

function plain(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined ? '－' : minusSign(value.toFixed(digits))
}

function drawdownText(drawdown: RiskDrawdown | null): string {
  if (!drawdown) return '－'
  return pct(drawdown.depth)
}

// ---- 2026-10-07 加的指標（使用者確認的設計：分佈型風險補進同一張表、VaR／ES 換成金額、新增「集中與分散」）。
// 缺值的原因分開命名，邏輯與檢查在 utils/holdings-metrics.ts。
// 2026-10-19 簡化（使用者：「holdings/risk 版面太複雜請簡化」）：預設只列 core 的幾項，波動、跌幅、最差的日子各一項，
// 加上潰瘍指數（使用者同日：「潰瘍指數很重要呢 希望他不要預設被隱藏」；2026-11-08 方案 C 起，年化波動度在波動占比那段的答句、
// 潰瘍指數自成一段放最上面，兩個都不在這張表裡）；
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
  // 市值明確比 null：0 用 r.marketValue && … 會被當成沒有
  const loss = (value: number | null) => (r.marketValue != null && value != null ? holdingsMetricText(Math.abs(value), 'money') : null)
  const varLoss = loss(r.portfolio.valueAtRisk95Amount)
  const esLoss = loss(r.portfolio.expectedShortfall95Amount)
  return [
    { core: false, name: '下行標準差（年化）', value: holdingsMetricText(r.portfolio.downsideDeviation, 'pct'), market: holdingsMetricText(r.benchmark.downsideDeviation, 'pct'), meaning: '只算下跌那幾天的波動，換算成一年' },
    { core: true, name: '最大回撤', value: drawdownText(r.portfolio.maxDrawdown), market: drawdownText(r.benchmark.maxDrawdown), meaning: '期間內從高點到之後低點的最大跌幅' },
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
  .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)))

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
// 一檔一列兩根橫條：高度跟著檔數。讀的時候照上次的檔數畫同樣高的骨架（useLayoutHint）。圖例在圖外（contributionLegend，
// 讀的時候也畫），所以比原本少 28px
const chartHeightFor = (count: number) => `${Math.max(172, count * 44 + 52)}px`
const contributionChartHeight = computed(() => chartHeightFor(contributionHoldings.value.length))
const contributionCountHint = useLayoutHint('holdings-risk-holdings', 5)
watch(contributionHoldings, (list) => {
  if (report.value) contributionCountHint.value = list.length
})
const contributionOption = computed(() => {
  const ink = getChartInk(resolvedMode.value)
  // ECharts 的類別軸由下往上排，反過來才是最大的在最上面
  const holdings = [...contributionHoldings.value].reverse()
  const toPct = (value: number | null) => (value === null ? null : Number((value * 100).toFixed(1)))
  // 一律一位小數：「{c}%」會把 54.0 印成「54%」，跟旁邊的「53.3%」對不齊
  const label = (color: string) => ({ show: true, position: 'right', color, fontSize: 16, formatter: ({ value }: { value: number | null }) => (value === null ? '' : `${value.toFixed(1)}%`) })
  return {
    color: [ink.muted, getAccentColor(resolvedMode.value, accentColorName.value)],
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
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

// 圖例畫在圖外（SharedChartLegend，全站同一種）；名字與顏色是固定的，讀的時候也畫，骨架與圖才一樣高
const contributionLegend = computed<ChartLegendGroup[]>(() => [{
  items: [
    { name: '市值占比', color: getChartInk(resolvedMode.value).muted, kind: 'bar' },
    { name: '波動占比', color: getAccentColor(resolvedMode.value, accentColorName.value), kind: 'bar' }
  ]
}])

// ---- 方案 C（2026-11-08，使用者看過三個方案選 C：「這才是我要的。我需要在資料完整與UIUX 易用中取得平衡。需要這樣高信噪比的設計」；
// 設計頁 https://claude.ai/artifact/6Rjz55TdsD7QhJono1yQX6）：只用現有的資料強調兩樣。潰瘍指數：自成一段、放最上面（同日「潰瘍指數
// 卡片放上面」，取代 10-07 波動占比排第一），大數字加上跟大盤比長短；波動：「哪幾檔占了大部分的波動」接在後面，卡片第一行寫年化波動度。
// 這兩個數字從下面的表拿掉，同一個數字只出現一次
// 卡片前只留問句（同日「希望卡片出現之前的文字精簡」）：年化波動度寫在波動占比卡片的第一行，潰瘍指數在自己的卡片裡
const volatilityText = computed(() => pct(report.value?.portfolio.annualizedVolatility))
const volatilityMarketText = computed(() => pct(report.value?.benchmark.annualizedVolatility))
const ulcerText = computed(() => holdingsMetricText(report.value?.portfolio.ulcerIndex, 'pct'))
// 跟大盤比長短：大的那一根畫滿，顏色同上面的長條圖（持股是強調色、大盤是中性墨色）。讀的時候兩根骨架
const ULCER_SKELETON = [{ name: '持股', width: '100%', text: '', color: '' }, { name: '大盤', width: '72%', text: '', color: '' }]
const ulcerBars = computed(() => {
  const r = report.value
  if (!r) return []
  const rows = [
    { name: '持股', value: r.portfolio.ulcerIndex, color: getAccentColor(resolvedMode.value, accentColorName.value) },
    { name: '大盤', value: r.benchmark.ulcerIndex, color: getChartInk(resolvedMode.value).muted }
  ].filter((row): row is { name: string, value: number, color: string } => row.value !== null)
  const max = Math.max(...rows.map(row => row.value))
  return rows.map(row => ({ name: row.name, color: row.color, text: holdingsMetricText(row.value, 'pct'), width: max > 0 ? `${(row.value / max) * 100}%` : '0%' }))
})

// 統計天數不足時照實說，不下結論
const fewDays = computed(() => (report.value ? report.value.tradingDays : 0))
const FEW_DAYS_NOTE = '交易日少於 60 天，波動度的統計誤差較大。'
const PARTIAL_NOTE = '期間中才有股價（之前的比例分給其他持股）：'
const { sample: fewDaysSample, remember: rememberFewDays } = useLineHint('holdings-risk-few-days')
const { sample: partialSample, remember: rememberPartial } = useLineHint('holdings-risk-partial')
const namesReady = useCompanyNamesReady()

const partialHoldings = computed(() => (report.value?.holdings ?? [])
  .filter(holding => holding.coverage !== 'full')
  .map((holding) => {
    const entry = companyByCode.value.get(holding.symbol)
    return { label: entry ? `${entry.name} ${holding.symbol}` : holding.symbol, coverage: holding.coverage, firstPriceDate: holding.firstPriceDate }
  }))

// 誰＋哪個帳戶（2026-10-19）：換帳戶就跟換人一樣重新載入
const { holdingsScope } = useHoldingsPortfolios()
// 公司名稱晚一點才到，長度跟著名稱更新
watch([report, partialHoldings, namesReady], ([value, , ready]) => {
  if (!value) return
  rememberFewDays(fewDays.value < 60 ? FEW_DAYS_NOTE : '')
  if (!ready) return
  rememberPartial(partialHoldings.value.length ? `${PARTIAL_NOTE}${partialCoverageText(partialHoldings.value)}` : '')
})

watch([authResolved, holdingsScope, range, ledgerVersion], ([resolved, uid]) => {
  if (!resolved) return
  if (uid) loadRisk()
  else outcome.value = null
}, { immediate: true })
</script>

<template>
  <HoldingsPageShell title="風險" guest-title="登入後查看你的持股風險指標" :pending="pending && !outcome">
    <template #default="{ loading }">

      <!-- 交易日數寫在期間旁邊（業務中台 要求一併顯示；兩段共用。2026-10-19 從內容上方獨立的一句搬來） -->
      <HoldingsRangePicker :pending="pending" :days="report?.tradingDays" :days-pending="loading" />

      <!-- 2026-10-19 簡化（使用者：「holdings/risk 版面太複雜請簡化」）：每段只剩問句 → 圖或表 → 一個展開。
           2026-11-08 方案 C 起潰瘍指數放最前面、波動占比接在後面（使用者：「潰瘍指數卡片放上面」，取代 10-07 的波動占比排第一）。 -->
      <!-- 遮罩只給換期間（內容已經在畫面上）；第一次讀的時候問句、指標名稱與意思、計算方式照畫，圖與數字是骨架（2026-10-20） -->
      <div v-loading="pending && !loading" class="risk-page__body" :aria-busy="loading">
        <el-alert v-if="outcome && !outcome.ok && !outcome.error" type="error" :closable="false" show-icon :title="outcome.message">
          <el-button @click="loadRisk">重新載入</el-button>
        </el-alert>

        <template v-else-if="loading || report">


          <!-- 潰瘍指數放最上面（2026-11-08 方案 C，使用者：「潰瘍指數卡片放上面」）：大數字＋跟大盤比長短，意思寫在卡片裡一行。
               卡片前只留問句（同日「希望卡片出現之前的文字精簡」）：數字都在卡片裡，假設寫在計算方式 -->
          <section aria-labelledby="risk-ulcer-title">
            <h2 id="risk-ulcer-title" class="risk-page__section-title">跌得多深、多久？</h2>
            <div class="app-card risk-ulcer">
              <p class="risk-ulcer__value">
                <span class="risk-ulcer__label">潰瘍指數</span>
                <span v-if="loading" class="risk-ulcer__number app-skeleton app-skeleton--inline" aria-hidden="true">6.8%</span>
                <span v-else class="risk-ulcer__number">{{ ulcerText }}</span>
              </p>
              <div class="risk-ulcer__compare">
                <div v-for="bar in loading ? ULCER_SKELETON : ulcerBars" :key="bar.name" class="risk-ulcer__row">
                  <span>{{ bar.name }}</span>
                  <span class="risk-ulcer__track" aria-hidden="true">
                    <span class="risk-ulcer__bar" :class="{ 'app-skeleton': loading }" :style="{ width: bar.width, background: loading ? undefined : bar.color }" />
                  </span>
                  <span class="risk-ulcer__text">
                    <span v-if="loading" class="app-skeleton app-skeleton--inline" aria-hidden="true">6.8%</span>
                    <template v-else>{{ bar.text }}</template>
                  </span>
                </div>
                <!-- 用名字的由來說（使用者：「不如跟用戶說這是衡量胃痛與壓力的指數如何？」）：說的是指數量什麼，不是對這組持股的評語；定義在計算方式 -->
                <p class="risk-ulcer__meaning">衡量下跌讓人多「胃痛」、多有壓力：跌得越深、越久，數字越大。</p>
              </div>
            </div>
          </section>

          <section v-if="loading ? contributionCountHint : contributionRows.length" aria-labelledby="risk-contribution-title">
            <h2 id="risk-contribution-title" class="risk-page__section-title">哪幾檔占了大部分的波動？</h2>
            <!-- 先圖後表（2026-10-07「risk 先圖表 再表格」，同站上指標頁的規矩） -->
            <!-- 年化波動度寫在卡片的第一行（2026-11-08，使用者：「希望卡片出現之前的文字精簡」），圖例與圖在它下面。波動占比樣本不足時
                 卡片只有這一行，各檔數字攤開在下面 -->
            <div class="app-card risk-page__chart-card">
              <p class="risk-volatility">
                <span>年化波動度</span>
                <span v-if="loading" class="risk-volatility__number app-skeleton app-skeleton--inline" aria-hidden="true">28.8%</span>
                <span v-else class="risk-volatility__number">{{ volatilityText }}</span>
                <span class="risk-volatility__market">大盤
                  <span v-if="loading" class="app-skeleton app-skeleton--inline" aria-hidden="true">27.2%</span>
                  <template v-else>{{ volatilityMarketText }}</template>
                </span>
              </p>
              <template v-if="loading || hasContribution">
                <SharedChartLegend :groups="contributionLegend" />
                <div v-if="loading" class="risk-contribution-chart app-skeleton" :style="{ height: chartHeightFor(contributionCountHint) }" aria-hidden="true" />
                <ClientOnly v-else>
                  <SharedChart
                    class="risk-contribution-chart"
                    :style="{ height: contributionChartHeight }"
                    :option="contributionOption"
                    autoresize
                    role="img"
                    aria-label="各檔持股的市值占比與波動占比"
                  />
                </ClientOnly>
              </template>
            </div>
            <!-- 有圖時表格收進 details（2026-10-08「有了圖表還需要表格嗎…可以收合精簡視覺嗎」）：圖是 canvas，
                 螢幕閱讀器念不出各檔數字，所以文字版必須在，只是預設收起來。沒有圖時直接攤開。 -->
            <details v-if="loading || hasContribution" class="app-disclosure">
              <summary>各檔數字<span v-if="loading" class="app-skeleton app-skeleton--flow" aria-hidden="true">（{{ contributionCountHint }} 檔）</span><template v-else>（{{ contributionRows.length }} 檔）</template></summary>
              <HoldingsMetricTable caption="各檔持股的市值占比與波動占比" :rows="contributionRows" value-label="市值占比" market-label="波動占比" />
            </details>
            <HoldingsMetricTable v-else caption="各檔持股的市值占比與波動占比" :rows="contributionRows" value-label="市值占比" market-label="波動占比" />
          </section>

          <section aria-labelledby="risk-metrics-title">
            <h2 id="risk-metrics-title" class="risk-page__section-title">其他風險指標跟大盤比起來如何？</h2>
            <HoldingsMetricTable :id="metricsTableId" caption="持股與同期加權報酬指數的風險指標" :rows="shownMetricRows" market-label="加權報酬指數" :loading="loading" />
            <el-button link type="primary" class="risk-page__toggle" :aria-expanded="showAllMetrics" :aria-controls="metricsTableId" @click="showAllMetrics = !showAllMetrics">
              {{ showAllMetrics ? '只看主要指標' : `顯示全部指標（另有 ${metricRows.length - shownMetricRows.length} 項）` }}
            </el-button>
            <!-- 會改變數字的缺口才留在外面，一行（2026-10-08「risk 底部的文字說明太多」：原本是 h3＋說明＋清單） -->
            <!-- 統計天數不足時照實說，不下結論；少於 120 天時，波動占比與分散化比率的格子自己寫「樣本不足」。放在表格下面
                 （2026-10-20）：資料到了才知道要不要這一行，原本在最上面，出現時把兩段一起往下推（正式建置量到 0.038） -->
            <p v-if="loading ? fewDaysSample : fewDays < 60" class="risk-page__note">
              <span v-if="loading" class="app-skeleton app-skeleton--flow" aria-hidden="true">{{ fewDaysSample }}</span>
              <template v-else>{{ FEW_DAYS_NOTE }}</template>
            </p>
            <p v-if="loading || !namesReady ? partialSample : partialHoldings.length" class="risk-page__note">
              <span v-if="loading || !namesReady" class="app-skeleton app-skeleton--flow" aria-hidden="true">{{ partialSample }}</span>
              <template v-else>{{ PARTIAL_NOTE }}{{ partialCoverageText(partialHoldings) }}</template>
            </p>
          </section>

          <!-- 口徑與回撤日期收進「計算方式」，同持股總覽（2026-10-08 同一句） -->
          <details class="app-disclosure">
            <summary>計算方式</summary>
            <ul class="risk-page__notes">
              <li>用現在每一檔的市值比例<template v-if="report?.weightsAsOf">（以 {{ report.weightsAsOf }} 的收盤價為準）</template>套用過去的股價，不是你過去實際的持股；持股是事後選的，所以不顯示報酬率，實際報酬請看「報酬與大盤」。</li>
              <li>潰瘍指數：1987 年由 Peter Martin 提出，名字來自股價下跌時讓人胃痛的壓力。它是每天距離期間內前高跌了多少的平均；最大回撤只看最深的那一次，潰瘍指數把每一天都算進去，所以跌了多久也會反映出來。</li>
              <li>波動占比（風險貢獻）：每一檔占整體波動的比例，合計約 100%。</li>
              <!-- 含息、還原減資（業務中台 5593cce，2026-10-23）：個股用還原收盤價，跟 analysis-ts 的 Beta 同一套；大盤用報酬指數 -->
              <li>股價含息：現金股利、股票股利與分割、減資退還的股款都已還原；大盤用發行量加權股價報酬指數（含息）。</li>
              <li v-if="report && drawdownDates(report.portfolio.maxDrawdown)">持股最大回撤：{{ drawdownDates(report.portfolio.maxDrawdown) }}</li>
              <li v-if="report && drawdownDates(report.benchmark.maxDrawdown)">加權報酬指數最大回撤：{{ drawdownDates(report.benchmark.maxDrawdown) }}</li>
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
}

/* 圖例與圖放進卡片（2026-11-08 方案 C）：內距同全站卡片 16px，卡片下面接「各檔數字」 */
.risk-page__chart-card {
  padding: 16px;
  margin-bottom: 16px;
}

/* 年化波動度：波動占比卡片的第一行（2026-11-08） */
.risk-volatility {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  margin: 0 0 8px;
}

.risk-volatility__number {
  font-size: 1.5rem;
  font-weight: 700;
}

.risk-volatility__market {
  color: var(--el-text-color-regular);
}

/* 潰瘍指數（2026-11-08 方案 C）：寬的時候大數字與比長短左右兩半，窄的時候上下疊 */
.risk-ulcer {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  align-items: center;
  gap: 16px 32px;
  padding: 16px;
}

.risk-ulcer__value {
  display: flex;
  flex-direction: column;
  margin: 0;
}

.risk-ulcer__label,
.risk-ulcer__meaning {
  color: var(--el-text-color-regular);
}

.risk-ulcer__number {
  align-self: flex-start;
  font-size: 3rem;
  font-weight: 700;
  line-height: 1.15;
}

.risk-ulcer__compare {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.risk-ulcer__row {
  display: grid;
  grid-template-columns: 3em minmax(0, 1fr) 4.5em;
  align-items: center;
  column-gap: 12px;
}

.risk-ulcer__track {
  height: 16px;
}

.risk-ulcer__bar {
  display: block;
  height: 100%;
  border-radius: 4px;
}

.risk-ulcer__text {
  text-align: right;
}

.risk-ulcer__meaning {
  margin: 0;
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
