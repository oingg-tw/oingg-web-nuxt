<script setup lang="ts">
import type { StockMetricPageResponse } from '#shared/types/stock-metric-page'
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
import { clampDescription, findMetricInSchema } from '~/utils/stock-digest'
import { joinClauses, joinSentences } from '~/utils/stock-answers'
import { formatSignificantDigits } from '~/utils/format-significant-digits'
import { metricsHistoryCacheKey, useMetricsHistorySupersetIndex, type CachedHistory } from '~/composables/stock/useMetricsHistory'

// The METRIC half of /stock/{code}/{slug} (2026-09-20) — a metric that has NO badge, so there is
// no threshold to judge against and no 符合/未符合 anywhere on the page. Built from the direct
// request「stock/2330/eps 這樣的，我希望造訪的人除了看到 2330 EPS 多少，也可以知道甚麼是 EPS」,
// with「未來月營收等等的指標也可以比照這個模板去做」as the stated goal: adding a metric page is
// meant to be one entry in METRIC_PAGES (shared/utils/hub-slugs.ts) and nothing else.
//
// Four question sections, the same document shape the rest of /stock/:code uses (question h2 →
// short number-led answer → one table): 目前值 → 逐期數據 → 怎麼看 → 是什麼. The 逐期數據 table is
// this page's required SSR table (check-stock-pages.mjs wants ≥1 on every sub-page).
//
// This component reads the route itself rather than taking props, matching StockBadgeDetailPage —
// the dispatcher ([slug].vue) decides WHICH template renders, not what it renders with.
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))
const slug = computed(() => String(route.params.slug))

const metricPage = findMetricPage(slug.value)
if (!metricPage) throw createError({ statusCode: 404, statusMessage: 'unknown stock sub-page', fatal: true })

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

const { data: metricData } = await useAsyncData<StockMetricPageResponse | null>(
  () => `stock-metric-${code.value}-${slug.value}`,
  async () => {
    try {
      return await $fetch<StockMetricPageResponse>(`/api/stock/${code.value}/metric`, { query: { slug: slug.value }, retry: 0, timeout: 15_000 })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[stock-metric] GET /api/stock/${code.value}/metric?slug=${slug.value} unavailable (${reason})`)
      }
      return null
    }
  },
  { watch: [code, slug], default: () => null }
)

// The metric's own catalog entry — unit, formula, sources and (when analysis-ts has written them)
// the description/limitations/misreadings prose. Never a frontend copy of any of it: this app
// reads metric metadata from GET /metrics precisely so the two can't disagree, and `eps` shipping
// with description/limitations/misreadings all null (2026-09-20, requested from analysis-ts) is
// exactly why every one of those sections below is conditional rather than assumed present.
const metricEntry = computed(() => findMetricInSchema(filterSchema.value?.categories ?? [], metricPage.metricCode)?.metric ?? null)
const unit = computed(() => metricEntry.value?.unit ?? '')

// Which bases the 目前值 chart's toggle offers (2026-09-21, direct request「不是每個卡片都要用
// TTM，但是都要可以選擇1235年」) — read from the metric's own LIVE catalog entry (`fields`, the
// same array the screener's own field picker reads), never hardcoded per metricCode: a metric
// whose real basis set changes upstream picks that up automatically, the same reasoning every
// other "read from GET /metrics, don't keep a frontend copy" spot in this app already follows.
const availableTimeframes = computed<MetricsHistoryTimeframe[]>(() => {
  const periods = metricEntry.value?.fields.map(field => field.period) ?? []
  return (['TTM', 'Q', 'FY'] as const).filter(tf => periods.includes(tf))
})

// Pre-warms StockMetricHistoryChartInteractive's own useMetricsHistory() cache from the series
// this page already fetched server-side, so its DEFAULT state (metricPage.timeframe, 近5年) still
// renders real content in the SSR HTML instead of a loading placeholder — same prewarm()
// mechanism useStockPageDigest.ts already established for exactly this purpose (see that file's
// own comment on why this needs an explicit call right after the await, not just a watcher: SSR
// only ever runs an `immediate` watcher once, with the pre-await null data). Registers into the
// SUPERSET index rather than the exact 近5年 key directly — this page's own 40-period server fetch
// covers every window up to 近8年 (32 periods), so one registration serves all of them via
// useMetricsHistory's own projectFromSuperset(), not just the one the chart happens to open on.
const metricsHistoryCache = useState<Record<string, CachedHistory>>('metrics-history-cache', () => ({}))
const metricsHistorySupersetIndex = useMetricsHistorySupersetIndex()
function prewarmMetricHistoryChart(payload: StockMetricPageResponse | null) {
  const series = payload?.series
  if (!series) return
  const key = metricsHistoryCacheKey(code.value, series.codes, series.timeframe, series.limit)
  metricsHistoryCache.value[key] = { entries: series.entries, total: series.total }
  if (!metricsHistorySupersetIndex.value.some(entry => entry.key === key)) {
    metricsHistorySupersetIndex.value.push({ symbol: code.value, timeframe: series.timeframe, codes: series.codes, limit: series.limit, key })
  }
}
prewarmMetricHistoryChart(metricData.value)
watch(metricData, prewarmMetricHistoryChart)

// bff-ts returns oldest-first; newest-first is what both the lead sentence and the table want.
const points = computed(() => {
  const entries = metricData.value?.series?.entries ?? []
  return entries
    .map(entry => ({ ...entry, point: entry.values[metricPage.metricCode] ?? null }))
    .filter(entry => entry.point !== null)
    .reverse()
})

const latest = computed(() => points.value[0] ?? null)

// A const arrow, not a `function` declaration: a declaration is hoisted, so TypeScript cannot use
// the narrowing from the `if (!metricPage) throw` guard above and reports metricPage as possibly
// null inside it.
const periodLabel = (fiscalYear: number, fiscalQuarter: number): string =>
  metricPage.timeframe === 'FY' ? `${fiscalYear}` : `${fiscalYear} Q${fiscalQuarter}`

function valueTextOf(value: number | null): string {
  return value === null ? '尚無資料' : `${formatSignificantDigits(value, 3)}${unit.value}`
}

const latestValueText = computed(() => valueTextOf(latest.value?.point?.value ?? null))

// 近四季 vs 單季 matters for how the number reads, so the basis is stated rather than left for the
// reader to assume — the same distinction the 指標歷史 table's own toggle makes.
const TIMEFRAME_LABEL: Record<'TTM' | 'Q' | 'FY', string> = { TTM: '近四季合計', Q: '單季', FY: '會計年度' }
const timeframeLabel = computed(() => TIMEFRAME_LABEL[metricPage.timeframe])

// 單季 + YoY（2026-09-21，直接要求「eps 要可以呈現單季與YOY」，引用財報狗「XX 2026年第2季EPS為
// 0.28元，季增-24.32%，近四季EPS為1.51元」為目標句型）.
//
// The 2026-09-21 basis question landed HERE rather than on METRIC_PAGES' own `timeframe` after one
// round trip: the first instruction（「請讓指標預設只用單季數字」, reason: 用單季來搜尋的人遠勝使用
// 近四季）was applied by flipping that field to Q, which turned out to break a BADGE page's own
// headline（its threshold is evaluated at the backend's basis, so a Q chart contradicted the
// number beside it）. The settled form（「那就照樣使用TTM，但是文案上單季優先。而且要連動網頁title」）
// keeps TTM as the DATA basis everywhere and makes 單季 the thing the PROSE and the <title> lead
// with — which is the 財報狗 title shape the request cited verbatim.
//
// Always Q basis regardless of `timeframe`
// above — a growth rate only means anything against a single quarter. bff-ts returns
// oldest-first, so the LAST entry is the newest; `value` filters out a null-valued newest row
// (found() still returns the row shape even with no figure in it) rather than showing "0" or
// silently falling back to a stale prior quarter without saying so.
const latestQuarterly = computed(() => {
  const entries = metricData.value?.quarterly?.entries ?? []
  const last = entries[entries.length - 1]
  const value = last?.values[metricPage.metricCode]?.value ?? null
  if (!last || value === null) return null
  const growth = metricPage.quarterlyGrowthMetricCode ? (last.values[metricPage.quarterlyGrowthMetricCode]?.value ?? null) : null
  return { fiscalYear: last.fiscalYear, fiscalQuarter: last.fiscalQuarter, value, growth }
})

// 「台積電2026年第2季EPS為 27.3元」— the one clause the lead sentence AND the <title> both open
// with, written once so the two can't drift apart（「文案上單季優先。而且要連動網頁title」）.
const quarterlyLead = computed(() => {
  const q = latestQuarterly.value
  return q ? `${stockShortName.value}${q.fiscalYear}年第${q.fiscalQuarter}季${metricPage.topic}為 ${valueTextOf(q.value)}` : null
})

// The <title>'s own keyword phrase. useStockPageSeo prefixes「{短名} {代碼} 」and appends the brand
// suffix, so this contributes only the middle — which is why it drops the company name the lead
// sentence above repeats（財報狗's own title carries it once too:「嘉實(3158)2026年第2季EPS為1.98元,
// 季增32.0%,近四季EPS為7.19元」）.
//
// Budget: scripts/check-stock-pages.mjs holds the whole title to 32 CJK-equivalent characters, and
// this one is built from live figures, so it is MEASURED against that budget rather than assumed
// to fit. The 年增 clause 財報狗's own title carries is dropped here unconditionally（it stays in
// the page's lead sentence, which has no budget）, and the 近四季 tail is dropped too whenever the
// full form would overflow — which it does for a long topic name:「台積電 2330 2026年第2季營業利益
// 率為 60.3%，近四季 56.1%｜安盈選股」measures 32.5, over by half a character. Degrading by
// measurement rather than by shortening the wording keeps this correct for a long company name as
// well, which eats the same budget from the other end.
//
// Falls back to the static phrase before the Q figure has loaded, and on any metric with no Q
// basis at all, rather than emitting a title with a hole in it.
const TITLE_BUDGET = 32
// 「｜安盈選股」— appended by useStockPageSeo, outside what this computed returns.
const TITLE_BRAND_COST = 5

// Same full-width-counts-1 measure check-stock-pages.mjs applies, kept identical to it on purpose:
// a title that passes here must pass there.
function cjkLength(text: string): number {
  let length = 0
  for (const char of text) length += /[　-鿿＀-￯]/.test(char) ? 1 : 0.5
  return length
}

// Whether this page HAS a 近四季 figure distinct from its 單季 one. False on a Q-only metric, where
// `latest`（the timeframe series）and `latestQuarterly`（the Q fetch）are the very same period:
// without this guard such a page printed one number twice with the second labelled 近四季
//（「2026年第2季PBR為 9.66倍、近四季PBR為 9.66倍」）. pbRatio, added 2026-09-21 with the 市場估值
// group, is the first Q-only metric page — the bug did not exist before it because every entry in
// METRIC_PAGES until then was TTM.
const hasTrailingFigure = computed(() => metricPage.timeframe === 'TTM' && latest.value !== null)

const titleKeywords = computed(() => {
  const q = latestQuarterly.value
  if (!q) return metricPage.titleKeywords
  const quarterly = `${q.fiscalYear}年第${q.fiscalQuarter}季${metricPage.topic}為 ${valueTextOf(q.value)}`
  if (!hasTrailingFigure.value) return quarterly
  const full = `${quarterly}，近四季 ${latestValueText.value}`
  const prefix = cjkLength(`${stockShortName.value} ${code.value} `)
  return prefix + cjkLength(full) + TITLE_BRAND_COST <= TITLE_BUDGET ? full : quarterly
})

const valueAnswer = computed(() => {
  if (!latest.value) return null
  // 財報狗's own shape when a real 單季 figure exists: 單季值 → 年增（財報狗原句是季增，這個目錄
  // 沒有季增率可用，改用年增，見 METRIC_PAGES 裡 eps 這筆自己的註解）→ 近四季值. Falls back to the
  // original TTM-only sentence for any metric page with no quarterlyGrowthMetricCode declared —
  // not every future metric (revenue, ROA, …) will have one the day it ships.
  const q = latestQuarterly.value
  if (q) {
    return joinClauses([
      quarterlyLead.value,
      q.growth !== null ? `年增 ${formatSignificantDigits(q.growth, 3)}%` : null,
      hasTrailingFigure.value ? `近四季${metricPage.topic}為 ${latestValueText.value}` : null,
      latest.value.point?.knowledgeDate ? `資料時間 ${latest.value.point.knowledgeDate}` : null
    ])
  }
  // No「目前」in front of the figure. It was there until 2026-09-21 and was accurate enough while
  // every metric page was a filed accounting figure, but the 市場估值 group added price-based
  // ratios and analysis-ts confirmed how those are built: peRatio/pbRatio divide by the close on
  // the FILING's own knowledge date, a frozen historical price, not today's. 「目前的PER」beside
  // 「資料時間 2026-08-11」was claiming something the number does not carry. The clauses that
  // follow already state the period and the knowledge date, so deleting the word costs nothing and
  // is correct for every metric rather than just the price-based ones.
  return joinClauses([
    `${stockShortName.value}的${metricPage.topic}為 ${latestValueText.value}`,
    `期別 ${timeframeLabel.value}`,
    `資料期間 ${periodLabel(latest.value.fiscalYear, latest.value.fiscalQuarter)}`,
    latest.value.point?.knowledgeDate ? `資料時間 ${latest.value.point.knowledgeDate}` : null
  ])
})

// Span of the table, stated in the section's own answer line so the reader knows how far back the
// numbers go without counting rows — this app holds itself to a 近10年 target for fundamentals and
// most symbols fall well short of it (a market-wide 2022Q1 data floor).
const historyAnswer = computed(() => {
  const list = points.value
  if (list.length < 2) return null
  const oldest = list[list.length - 1]!
  const newest = list[0]!
  return `以下為 ${stockShortName.value} 由新到舊的 ${metricPage.topic}（${timeframeLabel.value}），共 ${list.length} 期，涵蓋 ${periodLabel(oldest.fiscalYear, oldest.fiscalQuarter)} 至 ${periodLabel(newest.fiscalYear, newest.fiscalQuarter)}。`
})

const description = computed(() => {
  if (!latest.value) return null
  // 單季 first here too（「文案上單季優先」）— this is the snippet a searcher reads under the title,
  // so it opens on the same figure the title does. The TTM value follows in the same sentence
  // rather than being dropped: the two together are what the 財報狗 shape states.
  const lead = quarterlyLead.value
    ? joinClauses([quarterlyLead.value, hasTrailingFigure.value ? `近四季${metricPage.topic}為 ${latestValueText.value}` : null])
    : joinClauses([
      `${stockShortName.value}（${code.value}）${metricPage.topic}：${latestValueText.value}`,
      `期別 ${timeframeLabel.value}`,
      `資料期間 ${periodLabel(latest.value.fiscalYear, latest.value.fiscalQuarter)}`
    ])
  return clampDescription(joinSentences([lead, historyAnswer.value, metricEntry.value?.description]) ?? '')
})

// noindex whenever the page has nothing symbol-specific to say, the same rule the badge template
// uses: no value at all, or a catalog entry so bare that the「是什麼」section can only show a
// formula and a link. Both degrade the page rather than erroring it — a visitor who followed a
// link here still gets whatever there is.
const noindex = computed(() => !latest.value || !metricEntry.value?.description)

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: metricPage.topic,
  titleKeywords,
  pathSuffix: `/${metricPage.slug}`,
  stock,
  summary,
  description,
  noindex,
  sectorCode: computed(() => profile.value?.industry ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="stock-metric-page">
    <template v-if="stockPending" />
    <el-result
      v-else-if="!stock"
      icon="warning"
      sub-title="請確認股票代號是否正確"
    >
      <template #title>
        <h1 class="stock-not-found__title">找不到這檔股票</h1>
      </template>
      <template #extra>
        <el-button type="primary" @click="router.push('/')">回首頁</el-button>
      </template>
    </el-result>

    <template v-else>
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="metricPage.topic" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-metric-value" :question="`${stockShortName}（${code}）的${metricPage.topic}是多少？`" :answer="valueAnswer">
        <!-- 期別/資料期間/資料時間 lines removed 2026-09-21（直接要求「stock-page-section
             stock-question-section 移除重複資訊」）— StockQuestionSection's own :answer prop
             (valueAnswer below) already states all three in one sentence directly above this
             card; these were the exact same three facts restated as separate lines right under
             it. The big number stays — it's a different visual role (large, scannable at a
             glance), not a duplicate of the sentence in the way plain repeated text is. -->
        <el-card shadow="never" class="stock-metric-page__card">
          <template v-if="latest">
            <!-- No big value number here. There WAS one（a bare 2rem figure until 2026-09-21,
                 then briefly a labelled stat block）, removed by direct decision after「看久了很
                 突兀，有其他方式可以優化UIUX嗎?」and a look at the labelled version. The reason it
                 read badly was never its size: the section's own answer sentence directly above
                 already states the value, its period and its knowledge date, and the chart below
                 plots the same series — so any figure here was the same fact a third time. The
                 sentence and the chart both stay; nothing was lost with it. -->
            <StockValuationRiverChart v-if="metricPage.riverKind" :symbol="code" :kind="metricPage.riverKind" />
            <StockMetricHistoryChartInteractive
              v-else
              :symbol="code"
              :metric-code="metricPage.metricCode"
              :topic="metricPage.topic"
              :unit="unit"
              :default-timeframe="metricPage.timeframe"
              :available-timeframes="availableTimeframes"
            />
          </template>
          <p v-else class="stock-metric-page__line">目前沒有這檔股票的{{ metricPage.topic }}資料。</p>
        </el-card>
      </StockQuestionSection>

      <StockQuestionSection v-if="points.length" id="stock-metric-history" :question="`${stockShortName}的${metricPage.topic}歷年變化如何？`" :answer="historyAnswer">
        <SharedTableScroll :label="`${stockShortName} ${code} 的${metricPage.topic}逐期數據`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ stockShortName }} {{ code }} 的{{ metricPage.topic }}（{{ timeframeLabel }}）</caption>
            <thead>
              <tr>
                <th scope="col">期別</th>
                <th scope="col">{{ metricPage.topic }}{{ unit ? `（${unit}）` : '' }}</th>
                <th scope="col">資料時間</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in points" :key="`${entry.fiscalYear}-${entry.fiscalQuarter}`">
                <th scope="row">{{ periodLabel(entry.fiscalYear, entry.fiscalQuarter) }}</th>
                <td>{{ valueTextOf(entry.point?.value ?? null) }}</td>
                <td>{{ entry.point?.knowledgeDate ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
      </StockQuestionSection>

      <StockQuestionSection v-if="metricEntry?.limitations || metricEntry?.misreadings" id="stock-metric-reading" :question="`看${metricPage.topic}要注意什麼？`">
        <div class="stock-metric-page__notes">
          <section v-if="metricEntry?.limitations" class="stock-metric-page__note" aria-labelledby="stock-metric-limits-heading">
            <h3 id="stock-metric-limits-heading" class="stock-metric-page__note-title">限制</h3>
            <p class="stock-answer">{{ metricEntry.limitations }}</p>
          </section>

          <section v-if="metricEntry?.misreadings" class="stock-metric-page__note" aria-labelledby="stock-metric-misreadings-heading">
            <h3 id="stock-metric-misreadings-heading" class="stock-metric-page__note-title">常見誤讀</h3>
            <p class="stock-answer">{{ metricEntry.misreadings }}</p>
          </section>
        </div>
      </StockQuestionSection>

      <StockQuestionSection id="stock-metric-definition" :question="`${metricPage.topic}是什麼？`">
        <el-card shadow="never" class="stock-metric-page__card">
          <!-- Every line here is conditional: `eps` currently ships with description null (see
               this file's own note), so this section must still stand up on formula + sources
               alone rather than rendering an empty card. -->
          <p v-if="metricEntry?.description" class="stock-metric-page__line">{{ metricEntry.description }}</p>
          <p v-if="metricEntry?.sources?.length" class="stock-metric-page__line">資料來源：{{ metricEntry.sources.join('、') }}</p>
          <p class="stock-metric-page__line">
            <NuxtLink :to="`/stock/${code}/financial-statements`">看 {{ stockShortName }} {{ code }} 的財務報表原始數字</NuxtLink>
          </p>
          <p v-if="metricEntry?.referenceUrl" class="stock-metric-page__line">
            <a :href="metricEntry.referenceUrl" target="_blank" rel="noopener noreferrer">{{ metricPage.topic }}的公開說明（另開新視窗）</a>
          </p>
        </el-card>
      </StockQuestionSection>
    </template>
  </div>
</template>

<style scoped>
.stock-metric-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

/* Top/bottom padding trimmed 20px→12px 2026-09-21, same「公司卡片先打薄」pass and same move as
   StockSummaryCard's own body-style trim — pure whitespace, no content removed. Targets BOTH
   el-card instances that share this class (目前值/是什麼 sections) via :deep() since the padding
   lives on Element Plus's own .el-card__body, not on the class this file controls directly.
   Horizontal padding (still Element Plus's default) is untouched. */
.stock-metric-page__card :deep(.el-card__body) {
  padding-top: 12px;
  padding-bottom: 12px;
}

/* Anchor for StockMetricHistoryChartInteractive's own corner-positioned lookback select（「
   lookback-window-select 請放在卡片右上角」, 2026-09-21）— same position:relative-on-the-card +
   position:absolute-on-the-corner-element technique StockSummaryCard.vue's own
   .summary-card/.summary-card__corner-right pair already establishes, so the two "float something
   in a card's own top-right corner" spots in this app use one convention, not two. Positioning
   resolves against this ancestor even though the corner element lives several DOM levels down
   inside the chart child component — CSS doesn't require it to be the direct parent. */
.stock-metric-page__card {
  position: relative;
}

.stock-metric-page__line {
  margin: 8px 0 0;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-primary);
}


.stock-metric-page__notes {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-metric-page__note-title {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
</style>
