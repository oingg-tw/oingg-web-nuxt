<script setup lang="ts">
import type { LineSeriesSpec } from '~/components/stock/StockMultiSeriesLineChart.vue'
import type { LookbackWindow } from '~/utils/lookback-window'
import { DUPONT_METRIC_CODES, type StockDupontPageResponse } from '#shared/types/stock-dupont-page'
import type { MetricsHistoryEntry } from '#shared/types/metrics-history'
import { clampDescription, collectMetricSources } from '~/utils/stock-digest'
import { joinClauses, joinSentences } from '~/utils/stock-answers'

// /stock/:code/dupont — 杜邦分析, the first child of the nav's 獲利能力 group.
//
// Built from「杜邦分析該怎麼呈現 放在哪個分類下?」. Its three factors live in three different
// catalog categories（淨利率-side in 獲利能力, 資產週轉 in 營運效率, 權益乘數 in 安全韌性）and that
// spread IS the subject: ROE is not a profitability number on its own, it is profitability × asset
// efficiency × leverage. The page is filed under 獲利能力 because ROE is what it decomposes and
// that is where ROE sits in the catalog; the cross-group nature is content, stated and linked, not
// a taxonomy problem to solve by inventing a fourth top-level group for one page.
//
// See shared/types/stock-dupont-page.ts for the measured identities, and for the two wrong
// measurements that nearly killed this page.
//
// WHAT THIS PAGE DELIBERATELY WILL NOT DO is attribute a CHANGE in ROE to a particular factor. The
// arithmetic supports「these three multiply to this」and nothing more; a log-change decomposition of
// ΔROE would be a frontend-invented analytic, and the same compliance line that keeps the rank and
// screener pages descriptive applies here. The table puts the five columns side by side and the
// reader draws their own conclusion — which is also the traditional way DuPont is taught.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))

const TOPIC = '杜邦分析'

// All four lines（2026-09-22,「線圖怎麼只剩下一條？請給我稅後淨利率 總資產周轉 權益乘數 ROE」）.
//
// This chart carried ROE ALONE until then, and the reason recorded here was that the factors carry
// three different units（%, 次, 倍）so they「cannot share an axis」, with indexing to a common base
// rejected as the way out — correctly, because 淨利率 legitimately goes negative on a loss-making
// year and a negative base flips the sign of every point after it.
//
// What that reasoning missed is that they don't have to share ONE axis. Percentages go left,
// multiples right. 次 and 倍 sit together on the right because both are dimensionless ratios in
// the same 0–2 band; each line still names its own unit in the tooltip, so nothing reads 0.55 次
// as 0.55 倍. No base period, no transform, every point still its own filed number — which is why
// this answers the request without reopening the indexing problem.
//
// Four distinct (lineType, symbol) pairs, so the lines stay separable without colour（WCAG 1.4.1）
// and, more practically here, so a reader can tell which axis a line belongs to.
//
// Still deliberately absent: attributing a MOVE in ROE to one factor. See the top comment — the
// arithmetic supports「these three multiply to that one」and nothing further. Four lines on one
// time axis let a reader see which factor moved; they do not let this page say it caused the rest.
const rateText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)}%`)
const timesText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)} 次`)
const multipleText = (value: number | null): string => (value === null ? '尚無資料' : `${value.toFixed(2)} 倍`)

// Each name carries its own unit, which is what tells a reader WHICH AXIS a line is measured
// against — the standing trap of a dual-axis chart. 權益乘數 tracks near 1.5 on the right axis and
// crosses the left axis's gridlines around 54; without「（倍）」on the legend entry, reading it as
// 54% is the obvious mistake, and it is the chart's job to prevent it, not the reader's to avoid it.
const ROE_SERIES = [
  { code: 'roe', name: '股東權益報酬率（%）', lineType: 'solid', symbol: 'circle' },
  { code: 'netProfitMargin', name: '稅後淨利率（%）', lineType: 'dashed', symbol: 'triangle' },
  { code: 'assetTurnover', name: '資產週轉率（次）', lineType: 'dotted', symbol: 'rect', axis: 'right', format: timesText },
  { code: 'equityMultiplier', name: '權益乘數（倍）', lineType: 'solid', symbol: 'diamond', axis: 'right', format: multipleText }
] as const satisfies readonly LineSeriesSpec[]

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

const { data: dupontData } = await useAsyncData<StockDupontPageResponse | null>(
  () => `stock-dupont-${code.value}`,
  async () => {
    try {
      return await $fetch<StockDupontPageResponse>(`/api/stock/${code.value}/dupont`, { retry: 0, timeout: 15_000 })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[stock-dupont] GET /api/stock/${code.value}/dupont unavailable (${reason})`)
      }
      return null
    }
  },
  { watch: [code], default: () => null }
)

// THREE factors, with 權益乘數 as one of them（2026-09-22,「杜邦分析 用三部分，權益成數 要是其中
// 一個因子」）. The page shipped hours earlier on the five-factor version, and the measurements that
// justified five no longer hold after analysis-ts's average-denominator recompute:
//
//                       恆等式（±0.05pp）        完整覆蓋（15 檔抽樣）
//   三項 近四季          109/109                  13/15
//   三項 單季            115/115                  15/15
//   五項 近四季          101/101                  12/15
//
// Five was chosen because three measured 82/83（98.8%）at the time — that gap is gone, so five now
// buys nothing in precision and COSTS coverage: the symbols it drops are exactly those whose three
// profit-stage factors come back `insufficient_history`（2207 和泰車 is one）, and those are the
// factors only the五項 version needs.
//
// The five-factor expansion is not deleted — it sits in a closed <details> below, because「淨利率
// 為什麼動了」is the next question and the data arrives in the same request. What changed is which
// one the page leads with.
const REQUIRED = ['roe', 'netProfitMargin', 'assetTurnover', 'equityMultiplier']
const activeSeries = computed(() => (basis.value === 'Q' ? dupontData.value?.quarterlySeries : dupontData.value?.series))

// EVERY period, including ones missing a factor — they are NOT filtered out（fixed 2026-09-23）.
//
// They were, and it produced a chart that lied about time. A category x-axis only knows the rows
// it is given, so dropping an incomplete quarter made its neighbours adjacent: 2330's TTM series
// rendered「2021 Q3, 2021 Q4, 2024 Q1」as three consecutive ticks with one unbroken line through
// them, compressing two and a half years into a single step. Caught in a screenshot, not by a
// check — every assertion still passed, because nothing was wrong except what the picture said.
//
// StockMultiSeriesLineChart already sets `connectNulls: false` precisely so「a period with no
// filed figure leaves a real gap in the line rather than a straight segment implying a value that
// was never reported」. Filtering here defeated that at the source: ECharts never saw a null, so it
// had nothing to break on. Keeping the row and letting the value be null is what makes that
// setting work.
//
// The table shows those rows too, where the formatters already print 尚無資料. Only `latest` still
// skips them — a headline sentence has to quote a period that actually decomposes.
//
// LEADING AND TRAILING blanks ARE trimmed, though, and only those: an axis should span the range
// the data actually covers, while a hole inside that range is a fact about it. The two differ in
// what they tell a reader, so they are treated differently rather than uniformly.
//
// This is not hypothetical tidying — it is the normal case. bff-ts, 2026-09-23: an ordinary
// company's TTM series first carries a value at 2021Q4 and its Q series at 2021Q3, because 109Q4's
// XBRL income statement exists for only ~51 companies market-wide and every four-quarter window
// containing it is therefore incomplete. Verified here on 1101, 2317 and 1216 — all three have
// exactly one leading null quarter on TTM. Without this trim every one of them would open on an
// empty tick and close the 逐期 table with a row of four 尚無資料.
//
// 2330 does NOT show this（it has values from 2020Q3 on both bases）, which is precisely why
// bff-ts warned against using it as the development sample: it is the exception, and every
// screenshot and spot-check on this page had been taken against it.
const isComplete = (entry: MetricsHistoryEntry) => REQUIRED.every(metricCode => entry.values[metricCode]?.value != null)
const ascending = computed<MetricsHistoryEntry[]>(() => {
  const all = activeSeries.value?.entries ?? []
  const first = all.findIndex(isComplete)
  if (first < 0) return []
  let last = all.length - 1
  while (last > first && !isComplete(all[last]!)) last--
  return all.slice(first, last + 1)
})
const periods = computed(() => [...ascending.value].reverse())
const latest = computed(() => periods.value.find(isComplete) ?? null)

// 期別（2026-09-22,「杜邦分析 圖表要可以選單季 與近四季」）. Both series arrive in the page's one
// request, so switching is a swap, not a refetch — no loading state, no second round trip.
//
// TTM stays the DEFAULT because the reason it was once the only option still stands: a single
// quarter's ROE is a quarterly return, and 9.71% read as an annual figure overstates it roughly
// fourfold. What changed is that withholding the basis is not the only way to prevent that
// misreading — saying which basis every number is on does it too, and leaves the reader the view
// they asked for. So `basisLabel` is threaded through every sentence, caption and gloss on this
// page rather than 近四季 being written into any of them.
const basis = ref<'TTM' | 'Q'>('TTM')
const BASIS_LABEL: Record<'TTM' | 'Q', string> = { TTM: '近四季', Q: '單季' }
const basisLabel = computed(() => BASIS_LABEL[basis.value])
// 資產週轉率's plain-language gloss is the quiet half of the same trap: 0.14 次 is a QUARTER's
// turnover, and the table said「一年」unconditionally.
const turnoverPeriodWord = computed(() => (basis.value === 'Q' ? '一季' : '一年'))

// 圖表區間（2026-09-22,「圖表要 要可以選 1235年」）— the site-wide 近1/2/3/5/8年 scale every other
// stock-detail chart card uses, via the same SharedLookbackWindowSelect, so this page's control
// behaves identically to the ones beside it in the nav.
//
// Sliced from what is already loaded rather than refetched: the page's one request brings 20
// periods per basis（5 years）, so every window up to 近5年 is a slice and costs nothing.
//
// DISABLED WINDOWS ARE MEASURED, not a constant. This was `[8]`, on the reasoning that the fetch
// stops at 5 years so an 8-year label would silently show 5 — the same defect the macro chart's
// 35年 option was held back for. That was right about 近8年 and wrong to stop there: what this page
// can draw is not what the fetch RETURNS but what survives the REQUIRED filter, and those differ.
// Measured on 2330 the day this changed: 20 TTM periods come back, but `equityMultiplier` is null
// for all ten before 2024Q1（analysis-ts's average-denominator recompute reaches back only that
// far; their fourteen-quarter backfill closes it）, so 近5年 was drawing 2.5 years under a 5-year
// label. Q is unaffected, 20/20.
//
// So the rule the select's own comment asks each caller to apply — disable the windows this
// caller's data cannot fill — is applied to the FILTERED count, per basis. It needs no cleanup
// when the backfill lands（the options re-enable themselves）and it is not a workaround for that
// seam either: any symbol with shallow history hits the same thing.
// `number[]`, not the narrow union LOOKBACK_YEARS' filter infers — the select takes number[] and
// the watcher below compares against a plain number.
const DISABLED_WINDOW_YEARS = computed<number[]>(() => LOOKBACK_YEARS.filter(years => ascending.value.length < years * 4))

// A page-local ref, not useMetricHistoryChartWindow(): that composable's own comment says its key
// is dedicated so one page's window never silently moves another's, and this page is a different
// one.
//
// This holds what the READER ASKED FOR and is never written to by this page. What gets drawn is
// `effectiveWindow` below. Keeping the two apart matters because the available depth changes under
// the reader when they flip basis（2330: 近四季 reaches 2.5 years today, 單季 reaches 5）— clamping
// the ref itself would turn our narrowing into their choice, so flipping to 單季 and back would
// leave them stuck at the narrower window they never picked.
const chartWindow = ref<LookbackWindow>('近5年')

// The widest window at or below the requested one that the data can actually fill. Equal to
// `chartWindow` whenever that is available, which is the normal case.
const effectiveWindow = computed<LookbackWindow>(() => {
  const disabled = DISABLED_WINDOW_YEARS.value
  if (!disabled.includes(LOOKBACK_WINDOW_YEARS[chartWindow.value])) return chartWindow.value
  const widest = [...LOOKBACK_YEARS].reverse().find(years => !disabled.includes(years))
  return widest ? (`近${widest}年` as LookbackWindow) : chartWindow.value
})

const windowedAscending = computed<MetricsHistoryEntry[]>(() => {
  const years = LOOKBACK_WINDOW_YEARS[effectiveWindow.value] ?? 5
  return ascending.value.slice(-years * 4)
})

const valueOf = (metricCode: string): number | null => latest.value?.values[metricCode]?.value ?? null

const roe = computed(() => valueOf('roe'))
const netProfitMargin = computed(() => valueOf('netProfitMargin'))
const taxBurden = computed(() => valueOf('dupontTaxBurden'))
const interestBurden = computed(() => valueOf('dupontInterestBurden'))
const ebitMargin = computed(() => valueOf('dupontEbitMargin'))
const assetTurnover = computed(() => valueOf('assetTurnover'))
const equityMultiplier = computed(() => valueOf('equityMultiplier'))

const hasFactors = computed(() => latest.value !== null)

// WHY a symbol has no decomposition, which is two different answers and was one wrong one until
// 2026-09-22. The empty state used to say「銀行、保險與金控的資產是放款和保單」unconditionally,
// because when this page was designed every symbol without data WAS a financial — measured, 8 of 25
// sampled, all of them banks or insurers, none of anything else.
//
// analysis-ts's recompute then widened coverage from 8/15 to 12/15 in the same sample and left one
// holdout that is not a financial at all: 2207 和泰車 has 資產週轉 0.5776 and 權益乘數 6.516 but
// its three dupont factors come back null with nullReason `insufficient_history`. A 和泰車 reader
// would have been told something false about their own company.
//
// So the reason is read off the DATA rather than assumed: a financial has no 資產週轉率 at all,
// while a short-history company has it and is missing only the three profit-stage factors. A symbol
// with neither is the ordinary「沒有資料」case and gets the plainest sentence.
const latestRaw = computed(() => {
  const entries = dupontData.value?.series?.entries ?? []
  return entries[entries.length - 1] ?? null
})
const emptyReason = computed<'financial' | 'history' | 'none'>(() => {
  const entry = latestRaw.value
  if (!entry) return 'none'
  if (entry.values.assetTurnover?.value == null) return 'financial'
  return 'history'
})

const periodLabel = (entry: { fiscalYear: number; fiscalQuarter: number }): string => `${entry.fiscalYear} Q${entry.fiscalQuarter}`
const latestPeriodText = computed(() => (latest.value ? periodLabel(latest.value) : ''))

const dataSources = computed(() => collectMetricSources(filterSchema.value?.categories ?? [], DUPONT_METRIC_CODES))

// 2 decimals to read, and an explicit note that the chain is rounded — NOT the「make the arithmetic
// close exactly」treatment margins.vue and solvency.vue use, because this identity is a PRODUCT and
// theirs are sums. Relative rounding errors compound across five factors instead of cancelling.
//
// Measured on 2330: the backend publishes the three percentage factors at 2dp already（83.85 /
// 99.56 / 60.35）but 資產週轉 and 權益乘數 at 4（0.5505 / 1.4761）. Printing those two at 2dp as well
// takes the chain from 0.001pp off to 0.070pp off — the page printed「… ＝ 40.94%」while the numbers
// beside it multiplied to 41.01, which a reader with a calculator would catch.
//
// Showing 4 decimals would close it（0.5505 次）and is the wrong trade for this audience. Saying so
// is the honest fix, and the one financial statements themselves use. The alternative — dropping
// the chain entirely — would cost the page its point, since watching the five multiply IS what
// DuPont teaches.
// The three value formatters live up by ROE_SERIES, which references two of them.

// The five-factor expansion only renders when all three profit-stage factors are there. They are
// the ones that come back `insufficient_history` on a short-history company, so this is checked
// separately from hasFactors rather than folded into it — the three-factor page must stand up
// without them.
const hasExpansion = computed(() =>
  taxBurden.value !== null && interestBurden.value !== null && ebitMargin.value !== null
)

const valueAnswer = computed(() => {
  if (!hasFactors.value) return null
  return joinClauses([
    `${stockShortName.value}（${code.value}）${latestPeriodText.value} 的股東權益報酬率（${basisLabel.value}）為 ${rateText(roe.value)}`,
    `稅後淨利率 ${rateText(netProfitMargin.value)}`,
    `資產週轉率 ${timesText(assetTurnover.value)}`,
    `權益乘數 ${multipleText(equityMultiplier.value)}`
  ])
})

const chainAnswer = computed(() => {
  if (!hasFactors.value) return null
  return `這三個數字相乘就會得到 ROE：${rateText(netProfitMargin.value)} × ${timesText(assetTurnover.value)} × ${multipleText(equityMultiplier.value)}，約為 ${rateText(roe.value)}。三項各自回答一個不同的問題：賣東西賺不賺錢、資產用得有沒有效率、以及動用了多少槓桿。`
})

const expansionAnswer = computed(() => {
  if (!hasExpansion.value) return null
  return `稅後淨利率還可以再拆成三段：${rateText(taxBurden.value)} × ${rateText(interestBurden.value)} × ${rateText(ebitMargin.value)}，約為 ${rateText(netProfitMargin.value)}。`
})

const historyAnswer = computed(() => {
  const list = periods.value
  if (list.length < 2) return null
  return `以下為 ${stockShortName.value} 由新到舊的杜邦三項拆解（${basisLabel.value}），共 ${list.length} 期，涵蓋 ${periodLabel(list[list.length - 1]!)} 至 ${periodLabel(list[0]!)}。`
})

const description = computed(() => {
  if (!hasFactors.value) return null
  return clampDescription(joinSentences([valueAnswer.value, historyAnswer.value]) ?? '')
})

const noindex = computed(() => !hasFactors.value)

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: TOPIC,
  titleKeywords: '杜邦分析三項拆解 ROE',
  pathSuffix: '/dupont',
  stock,
  summary,
  description,
  noindex,
  sectorCode: computed(() => profile.value?.industry ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="stock-dupont-page">
    <template v-if="stockPending" />
    <el-result v-else-if="!stock" icon="warning" sub-title="請確認股票代號是否正確">
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <StockSummaryCard :stock="stock" :is-favorite="isFavorite" :short-name="stockShortName" :topic="TOPIC" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-dupont-value" :question="`${stockShortName}（${code}）的 ROE 由哪三個部分組成？`" :answer="valueAnswer">
        <el-card shadow="never" class="stock-dupont-page__card stock-dupont-page__chart-card">
          <!-- 期別 to the LEFT of the window select inside one corner group, the arrangement
               StockMetricHistoryChartInteractive.vue already established site-wide（「每個卡片
               近五年的左邊要有選項選擇 TTM 或是 單季」）. -->
          <div v-if="hasFactors" class="stock-dupont-page__corner">
            <el-radio-group v-model="basis" aria-label="期別（單季或近四季）">
              <el-radio-button value="TTM">近四季</el-radio-button>
              <el-radio-button value="Q">單季</el-radio-button>
            </el-radio-group>
            <SharedLookbackWindowSelect :model-value="effectiveWindow" :disabled-years="DISABLED_WINDOW_YEARS" @update:model-value="chartWindow = $event" />
          </div>
          <StockMultiSeriesLineChart v-if="hasFactors" :entries="windowedAscending" :series="ROE_SERIES" unit="%" unit-right="倍 / 次" :format="rateText" />
          <p v-else-if="emptyReason === 'financial'" class="stock-dupont-page__line">
            銀行、保險與金控沒有杜邦拆解。這三項裡的資產週轉率要用「營收 ÷ 總資產」，而金融業的資產是放款和保單，不是用來生產營收的設備，這個比率對它們沒有意義。
          </p>
          <p v-else-if="emptyReason === 'history'" class="stock-dupont-page__line">
            這檔股票的財報年數還不夠做完整的杜邦拆解。完整拆解需要的稅後淨利率、資產週轉率與權益乘數，有一項還算不出來；等財報累積夠了就會出現。
          </p>
          <p v-else class="stock-dupont-page__line">
            目前沒有這檔股票的杜邦拆解資料。
          </p>
        </el-card>
      </StockQuestionSection>

      <StockQuestionSection v-if="chainAnswer" id="stock-dupont-chain" question="這三項是怎麼乘成 ROE 的？" :answer="chainAnswer">
        <SharedTableScroll :label="`${stockShortName} ${code} 的杜邦三項拆解`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} {{ latestPeriodText }} 的 ROE 三項拆解（{{ basisLabel }}）</caption>
            <thead>
              <tr>
                <th scope="col">項目</th>
                <th scope="col">數值</th>
                <th scope="col">這一項在問什麼</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">稅後淨利率</th>
                <td>{{ rateText(netProfitMargin) }}</td>
                <td>每賣 100 元的東西，扣完所有成本、利息和稅之後留下多少</td>
              </tr>
              <tr>
                <th scope="row">資產週轉率</th>
                <td>{{ timesText(assetTurnover) }}</td>
                <td>公司的資產{{ turnoverPeriodWord }}可以做出幾倍的營收</td>
              </tr>
              <tr>
                <th scope="row">權益乘數</th>
                <td>{{ multipleText(equityMultiplier) }}</td>
                <td>總資產是股東自有資本的幾倍，也就是動用了多少槓桿</td>
              </tr>
              <tr>
                <th scope="row">三項相乘＝ROE</th>
                <td>{{ rateText(roe) }}</td>
                <td>股東每投入 1 元，一年賺回多少</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>

        <p class="stock-answer stock-dupont-page__note">
          為什麼要拆開看：ROE 上升可能是東西賣得比較賺錢、資產用得比較有效率，或者只是借了更多錢——這是三個完全不同的結論。
          尤其是權益乘數，它變大代表同樣的自有資本撐起更多資產，ROE 會跟著變好看，但那不是本業變強。
        </p>

        <!-- Stated rather than engineered away: rounded factors multiplied together drift from the
             rounded ROE beside them, and a reader who checks with a calculator should find the
             reason on the page instead of finding a contradiction. Smaller with three factors than
             it was with five, but not zero. -->
        <p class="stock-answer stock-dupont-page__rounding">
          畫面上每個數字都四捨五入到小數點後兩位，方便閱讀。三個數字連乘會把這些微小的差距放大，所以自己按計算機乘出來，可能和上面的 ROE 差個零點零幾，那是進位造成的，不是哪一邊算錯。
        </p>

        <!-- The five-factor version, demoted to a closed details on 2026-09-22 rather than deleted:
             it answers the follow-up（「淨利率為什麼動了」）and its data arrives in the same request,
             but it needs three factors that a short-history company doesn't have, so it must never
             be what the page depends on. -->
        <details v-if="expansionAnswer" class="stock-dupont-page__details">
          <summary>再往下拆：稅後淨利率的三個來源</summary>
          <p class="stock-answer">{{ expansionAnswer }}</p>
          <SharedTableScroll :label="`${stockShortName} ${code} 的稅後淨利率拆解`">
            <table class="seo-table" data-ssr-table>
              <caption>{{ stockShortName }} {{ code }} {{ latestPeriodText }} 的稅後淨利率拆解（{{ basisLabel }}）</caption>
              <thead>
                <tr>
                  <th scope="col">項目</th>
                  <th scope="col">數值</th>
                  <th scope="col">這一項在問什麼</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">稅務負擔</th>
                  <td>{{ rateText(taxBurden) }}</td>
                  <td>稅前賺的錢，繳完稅後留下幾成</td>
                </tr>
                <tr>
                  <th scope="row">利息負擔</th>
                  <td>{{ rateText(interestBurden) }}</td>
                  <td>本業賺的錢，付完利息後留下幾成</td>
                </tr>
                <tr>
                  <th scope="row">EBIT 利潤率</th>
                  <td>{{ rateText(ebitMargin) }}</td>
                  <td>每 100 元營收，本業賺到多少（還沒扣利息和稅）</td>
                </tr>
                <tr>
                  <th scope="row">三項相乘＝稅後淨利率</th>
                  <td>{{ rateText(netProfitMargin) }}</td>
                  <td>每賣 100 元的東西，最後留下多少</td>
                </tr>
              </tbody>
            </table>
          </SharedTableScroll>
        </details>

        <p class="stock-answer stock-dupont-page__links">
          其中幾項各自的定義、限制與逐期數據：
          <NuxtLink :to="`/stock/${code}/roe`">股東權益報酬率</NuxtLink>、
          <NuxtLink :to="`/stock/${code}/net-profit-margin`">稅後淨利率</NuxtLink>。
          本業獲利的上游拆解見<NuxtLink :to="`/stock/${code}/margins`">財報三率</NuxtLink>，
          槓桿的另一面見<NuxtLink :to="`/stock/${code}/solvency`">安全韌性的組成</NuxtLink>。
          原始金額見<NuxtLink :to="`/stock/${code}/income-statement`">損益表</NuxtLink>與<NuxtLink :to="`/stock/${code}/balance-sheet`">資產負債表</NuxtLink>。
        </p>
      </StockQuestionSection>

      <StockQuestionSection v-if="historyAnswer" id="stock-dupont-history" :question="`${stockShortName}的杜邦三項歷年變化如何？`" :answer="historyAnswer">
        <SharedTableScroll :label="`${stockShortName} ${code} 的杜邦三項逐期數據`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} 逐期的杜邦三項拆解（{{ basisLabel }}，由新到舊）</caption>
            <thead>
              <tr>
                <th scope="col">期別</th>
                <th scope="col">稅後淨利率</th>
                <th scope="col">資產週轉率</th>
                <th scope="col">權益乘數</th>
                <th scope="col">ROE</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in periods" :key="`${entry.fiscalYear}-${entry.fiscalQuarter}`">
                <th scope="row">{{ periodLabel(entry) }}</th>
                <td>{{ rateText(entry.values.netProfitMargin?.value ?? null) }}</td>
                <td>{{ timesText(entry.values.assetTurnover?.value ?? null) }}</td>
                <td>{{ multipleText(entry.values.equityMultiplier?.value ?? null) }}</td>
                <td>{{ rateText(entry.values.roe?.value ?? null) }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>

      <StockQuestionSection id="stock-dupont-method" question="杜邦分析是什麼？" >
        <el-card shadow="never" class="stock-dupont-page__card">
          <p class="stock-dupont-page__line">
            杜邦分析把股東權益報酬率（ROE）拆成幾個可以分別觀察的部分，因為同樣的 ROE 可能來自完全不同的經營方式。
            名稱來自杜邦公司在 1920 年代發展出來的內部管理方法。
          </p>
          <p class="stock-dupont-page__line">
            這裡採最常見的三項版本：稅後淨利率 × 資產週轉率 × 權益乘數。稅後淨利率本身還能再往下拆成稅、利息與本業三段，那放在上面的摺疊區塊裡。
          </p>
          <p class="stock-dupont-page__line">
            銀行、保險與金控沒有這組數字：資產週轉率要用「營收 ÷ 總資產」，而金融業的資產是放款與保單，不是用來生產營收的設備，這個比率對它們沒有意義。
          </p>
          <p v-if="dataSources.length" class="stock-dupont-page__line">資料來源：{{ dataSources.join('、') }}</p>
        </el-card>
      </StockQuestionSection>
    </template>
  </div>
</template>

<style scoped>
.stock-dupont-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-dupont-page__card {
  border-radius: 12px;
}

/* Same top-right placement every stock-detail chart card uses（「請放在卡片右上角」）. */
.stock-dupont-page__chart-card {
  position: relative;
}

.stock-dupont-page__corner {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

/* Out of the overlay and into normal flow at phone width（2026-09-22）. Floating it over the
   chart's top-right corner only works while nothing else is up there; with four legend entries
   the legend wraps and its first row runs underneath the select, which was covering
  「股東權益報酬率（%）」outright. Same element, same markup — a CSS placement swap, not a second
   tree（see the cookie-less layout note in layouts/default.vue）. */
@media (max-width: 600px) {
  .stock-dupont-page__corner {
    position: static;
    margin-bottom: 8px;
  }
}

.stock-dupont-page__line {
  margin: 0 0 8px;
  font-size: 1rem;
  line-height: 1.7;
}

.stock-dupont-page__line:last-child {
  margin-bottom: 0;
}

.stock-dupont-page__note,
.stock-dupont-page__links {
  margin-top: 12px;
}

.stock-dupont-page__rounding {
  margin-top: 12px;
  color: var(--el-text-color-secondary);
}
</style>
