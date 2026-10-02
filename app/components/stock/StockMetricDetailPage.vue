<script setup lang="ts">
import type { StockMetricPageResponse } from '#shared/types/stock-metric-page'
import type { MetricsHistoryTimeframe } from '#shared/types/metrics-history'
// Explicit, not auto-imported: a newly added file under shared/ isn't picked up until the dev
// server restarts, which showed up here as a live「findMetricCopy is not defined」500. The rest of
// this component's own helpers are imported explicitly too.
import { findMetricCopy } from '#shared/utils/metric-copy'
import { resolveRelatedPages } from '#shared/utils/hub-slugs'
import { clampDescription, findMetricInSchema } from '~/utils/stock-digest'
import { joinClauses, joinSentences } from '~/utils/stock-answers'
import { formatSignificantDigits } from '~/utils/format-significant-digits'
import { metricHistoryPoints, metricHistoryAnswer, metricCellText, periodLabelOf, TIMEFRAME_LABEL } from '~/utils/metric-history-points'
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
      devWarn('stock-metric', `GET /api/stock/${code.value}/metric?slug=${slug.value} unavailable`, error)
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

// 說明文案：前端優先，後端墊底（2026-09-22,「這個部分的文案我想改為放在前端」）.
//
// The three prose fields are the frontend's now (shared/utils/metric-copy.ts has the reasoning and
// the measured examples of why); everything else about a metric — formula, unit, periods, sources,
// reference links, badge thresholds — still comes from GET /metrics and always will.
//
// The fallback is what lets that file grow one metric at a time: a metric with no entry keeps
// rendering analysis-ts's own strings, so no page can lose a section mid-migration. It also covers
// the reverse case, a page added before its copy is written.
//
// limitations/misreadings are ARRAYS here and a single long string on the backend. That is the
// point rather than a format accident — the backend's are semicolon-joined walls (deRatio's was one
// sentence, four clauses, ~150 characters) and this audience gets bullets. A fallback string is
// wrapped into a one-item array so the template has one shape to render either way.
// 相關指標（2026-09-22,「分開總覺得哪裡怪怪的，資訊散落」）— set per entry in the registry, never
// here, and resolved to the destination's own topic so a rename can't strand a stale label. Empty
// for most pages on purpose: a page that links to everything adjacent links to nothing.
const related = resolveRelatedPages(metricPage.related)

const copy = computed(() => findMetricCopy(metricPage.metricCode))

// 成分的顯示名稱從型錄取，前端不放第二份中文（2026-09-28）。順序跟 partMetricCodes 一一對應，圖那邊
// 只認索引。
// 一起畫的第二支指標的顯示名稱。配對本身是 registry 的策展決定（compareMetricCode），
// 讀者沒有選單可改——2026-09-29 做過一版讓讀者自選，型錄裡同單位的候選多到 33–41 支，
// 使用者的判斷是「很混淆難用」。名字仍然從型錄讀，這樣上游改名時不用動我們。
const compareName = computed(() => {
  const code = metricPage.compareMetricCode
  if (!code) return undefined
  const metric = findMetricInSchema(filterSchema.value?.categories ?? [], code)?.metric
  if (!metric) return undefined
  return metric.nameSuffix ? `${metric.nameSuffix} ${metric.name}` : metric.name
})

// 對照指標自己支援的期別，從同一份型錄取（見 StockMetricHistoryChartInteractive 的 compareTimeframes
// 註解：不給的話，切到對照指標沒有的期別會讓整個請求 400、連主指標都畫不出來）。
const compareTimeframes = computed<MetricsHistoryTimeframe[]>(() => {
  const code = metricPage.compareMetricCode
  if (!code) return []
  const periods = findMetricInSchema(filterSchema.value?.categories ?? [], code)?.metric.fields.map(field => field.period) ?? []
  return (['TTM', 'Q', 'FY'] as const).filter(tf => periods.includes(tf))
})

const partNames = computed(() =>
  (metricPage.partMetricCodes ?? []).map(code =>
    findMetricInSchema(filterSchema.value?.categories ?? [], code)?.metric.name ?? code)
)
const definition = computed(() => copy.value?.definition ?? metricEntry.value?.description ?? null)
// 標題隨內容變（2026-09-30）：13 個指標頁沒有前端文案、因此沒有「跟誰比」那一句，標題若照寫
// 「要跟誰比、什麼時候會看錯？」就是承諾了一個段落裡沒有的東西（實測 /operating-expense、
// /cost-of-goods-sold 就是這種）。有 compare 才把它寫進標題。
const notesQuestion = computed(() =>
  copy.value?.reading?.compare
    ? `${metricPage.topic}要跟誰比、什麼時候會看錯？`
    : `${metricPage.topic}什麼時候會看錯？`
)

const limitations = computed<string[]>(() =>
  copy.value?.limitations ?? (metricEntry.value?.limitations ? [metricEntry.value.limitations] : [])
)
const misreadings = computed<string[]>(() =>
  copy.value?.misreadings ?? (metricEntry.value?.misreadings ? [metricEntry.value.misreadings] : [])
)

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
// 讀失敗 vs 真的沒資料（2026-09-30）。這兩件事在畫面上一直長得一模一樣——「目前沒有這檔股票的
// OO 資料」同時蓋掉了上游 400／502／逾時。bff-ts 2026-09-30 給了一組實測過的判準：**「沒有資料」
// 在他們那一層只會以 200 出現**（found:false、空陣列、values 裡的 null），非 2xx 永遠不代表沒資料。
//
// 而我們這一層早就有這個 bit，只是沒有用：server 的 settle() 失敗時回 null，所以 `series === null`
// 就是「讀失敗」；200 但這家公司沒有這支指標的話，entries 照樣回來、只是 values 全 null（實測
// 2881 的存貨天數：20 期、值全 null）。所以不需要改 settle，也不需要新欄位。
const readFailed = computed(() => metricData.value?.series === null)
// points／期別標籤／儲存格文字／歷年變化那一句都搬到 ~/utils/metric-history-points.ts
// （2026-10-01）：徽章頁也要那張歷年變化表，而這一頁除了表格之外還要用同一組數字算 <title>、
// meta description 與開頭那句，所以共用的是函式，不只是元件。
const points = computed(() => metricHistoryPoints(metricData.value?.series?.entries ?? [], metricPage.metricCode))

const latest = computed(() => points.value[0] ?? null)

const periodLabel = (fiscalYear: number, fiscalQuarter: number): string => periodLabelOf(metricPage.timeframe, fiscalYear, fiscalQuarter)
const cellTextOf = (point: { value: number | null; nullReason: string | null } | null | undefined): string => metricCellText(point, unit.value)
// 單季那兩句講的是一個**有值**的數字，沒有 null 的分支要處理，所以不經過 cellTextOf。
const valueTextOf = (value: number | null): string => metricCellText({ value, nullReason: null }, unit.value)

// Through cellTextOf, not valueTextOf: this string is the lead sentence, the <title> and the meta
// description, and「尚無資料」was wrong on all three for a company whose newest figure is null WITH a
// reason（1101's FCF 轉換率 since the zero-denominator guard landed）. 無法計算 is the honest word.
const latestValueText = computed(() => cellTextOf(latest.value?.point ?? null))

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

const historyAnswer = computed(() => metricHistoryAnswer(points.value, { shortName: stockShortName.value, topic: metricPage.topic, timeframe: metricPage.timeframe }))

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
  return clampDescription(joinSentences([lead, historyAnswer.value, definition.value]) ?? '')
})

// noindex whenever the page has nothing symbol-specific to say, the same rule the badge template
// uses: no value at all, or a catalog entry so bare that the「是什麼」section can only show a
// formula and a link. Both degrade the page rather than erroring it — a visitor who followed a
// link here still gets whatever there is.
const noindex = computed(() => !latest.value || !definition.value)

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
    <SharedStockNotFound v-else-if="!stock" />

    <template v-else>
      <StockSummaryCard :stock="stock" :is-emerging="profile?.isEmerging ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="metricPage.topic" @toggle-favorite="toggleFavorite" />
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
              :part-codes="metricPage.partMetricCodes"
              :part-names="partNames"
              :compare-metric-code="metricPage.compareMetricCode"
              :compare-name="compareName"
              :compare-timeframes="compareTimeframes"
            />
          </template>
          <p v-else-if="readFailed" class="stock-metric-page__line">{{ metricPage.topic }}暫時讀不到，請稍後再看。</p>
          <p v-else class="stock-metric-page__line">目前沒有這檔股票的{{ metricPage.topic }}資料。</p>
        </el-card>
      </StockQuestionSection>

      <!-- 組成（2026-09-28）。只有 METRIC_PAGES 帶 partMetricCodes 的指標會有這一段，成分與母項在
           同一次 metrics-history 呼叫裡取回（metric.get.ts），所以它跟上面的圖表一樣是 SSR 內容。
           恆等式不成立或成分缺值時元件自己不渲染——判斷在那裡，不在這裡。 -->
      <!-- 拆不出來的那一面：同一個位置、同一個問句形式，答案是一段話（見 hub-slugs.ts 的
           compositionNote）。空白會被讀成「漏掉了」。 -->
      <StockQuestionSection
        v-if="metricPage.compositionNote"
        id="stock-metric-composition"
        :question="`${metricPage.topic}可以看出組成嗎？`"
        :answer="metricPage.compositionNote"
      />

      <StockMetricCompositionSection
        v-if="metricPage.partMetricCodes && metricData?.series"
        :entries="metricData.series.entries"
        :parent-code="metricPage.metricCode"
        :part-codes="metricPage.partMetricCodes"
        :timeframe="metricPage.timeframe"
        :topic="metricPage.topic"
        :short-name="stockShortName"
        :code="code"
      />

      <StockMetricHistorySection
        v-if="metricData?.series"
        :entries="metricData.series.entries"
        :metric-code="metricPage.metricCode"
        :timeframe="metricPage.timeframe"
        :topic="metricPage.topic"
        :unit="unit"
        :short-name="stockShortName"
        :code="code"
      />

      <!-- 計算依據（2026-10-01 補上）。徽章頁從 2026-09-20 就有這張表，46 個指標頁一直沒有——
           同一個端點、同一個元件。14 支損益表逐行的每股指標上游還不支援（見 metric.get.ts 的註解），
           那些頁面的 provenance 是 null，這一段不渲染。 -->
      <StockMetricProvenanceSection :symbol="code" :short-name="stockShortName" :topic="metricPage.topic" :provenance="metricData?.provenance ?? null" :expected-value="latest?.point?.value ?? null" />

      <!-- 段落分三區（2026-09-30 重排，順序 2026-10-01 調整）：前面是**這家公司自己的數字**
           （是多少／組成／歷年變化／怎麼算出來的），
           這裡開始是**任何公司都適用的通則**（是什麼／變大或變小／要跟誰比），最後是頁尾。
           分區的理由是讀者分得出哪句話是這家公司的、哪句是常識——混在一起就分不出來。

           「是什麼」從最後搬到通則區的最前面。它原本擺最後不是「定義放最後」的決定：那一段掛著
           「X 是什麼？」的標題，但五行裡有四行是出處與導航（資料來源、看原始財報、公開說明、
           接著可以看），真正答「是什麼」的只有第一行——擺最後的是頁尾，定義只是被順路帶下去。
           拆開之後定義回到它該在的位置，頁尾留在頁尾、不再假裝是一個問句段落。

           沒有搬到第 1 位（看到數字後立刻定義），是因為讀者搜的是「台積電 資產報酬率」，答案要在
           最前面——那是本站既有的立場，不為這件事翻掉；而且擠進去會把公司事實那三段切開。 -->
      <StockQuestionSection v-if="definition" id="stock-metric-definition" :question="`${metricPage.topic}是什麼？`">
        <p class="stock-answer">{{ definition }}</p>
      </StockQuestionSection>

      <!-- 標題寫它在答什麼，不寫「要怎麼看」（2026-09-30「語意上似乎可以結合，你認為呢？」）。
           「要怎麼看」跟「要注意什麼」語意重疊，讀者看不出第二段不是第一段的續集。沒有合併成一段，
           是因為量過：合併後單一段落字數中位 266、最長 559（roe），底下小標中位 5 個——本站的文件
           優先原則偏好多個短問句段而不是一個長段，而且兩個 h2 是兩個不同的長尾問題。
           改名就解掉衝突：「變大或變小代表什麼」與「要跟誰比、什麼時候會看錯」是同一件事的正反面，
           誰都不像涵蓋對方。

           兩格是固定模板（變大／變小），不是自由文字——理由見 metric-copy.ts 的型別註解。
           只有前端有文案的指標才有這一段；沒有的就跳過，不會印半截。 -->
      <StockQuestionSection v-if="copy?.reading" id="stock-metric-howto" :question="`${metricPage.topic}變大或變小代表什麼？`">
        <div class="stock-metric-page__notes">
          <section class="stock-metric-page__note" aria-labelledby="stock-metric-up-heading">
            <h3 id="stock-metric-up-heading" class="stock-metric-page__note-title">數字變大</h3>
            <p class="stock-answer">{{ copy.reading.up }}</p>
          </section>
          <section class="stock-metric-page__note" aria-labelledby="stock-metric-down-heading">
            <h3 id="stock-metric-down-heading" class="stock-metric-page__note-title">數字變小</h3>
            <p class="stock-answer">{{ copy.reading.down }}</p>
          </section>
        </div>
      </StockQuestionSection>

      <!-- 「跟誰比」從上面搬過來，當這一段的第一個小標（2026-09-30「數字變大 數字變小 跟誰比 仍是
           重要概念，放哪裡好」）。理由是量出來的：39 條 compare 逐條讀過，結構高度一致——第一句講
           跟誰比（跟同業 12、跟自己過去 16、跟另一支指標一起看 8、其他 3），第二句講哪種比法不行
           或要配什麼（38/39 條都有第二句）。那個第二句就是注意事項的內容，所以「跟誰比」實質上回答
           的是「什麼比法會看錯」，跟「什麼時候不適用」「容易看錯的地方」同一類。

           小標的名字用讀者的話而不是後端欄位名（限制／常見誤讀 → 什麼時候不適用／容易看錯的地方），
           跟文案本身重新登記過的那一套一致。 -->
      <StockQuestionSection
        v-if="copy?.reading?.compare || limitations.length || misreadings.length"
        id="stock-metric-reading"
        :question="notesQuestion"
      >
        <div class="stock-metric-page__notes">
          <section v-if="copy?.reading?.compare" class="stock-metric-page__note" aria-labelledby="stock-metric-compare-heading">
            <h3 id="stock-metric-compare-heading" class="stock-metric-page__note-title">跟誰比</h3>
            <p class="stock-answer">{{ copy.reading.compare }}</p>
          </section>

          <section v-if="limitations.length" class="stock-metric-page__note" aria-labelledby="stock-metric-limits-heading">
            <h3 id="stock-metric-limits-heading" class="stock-metric-page__note-title">什麼時候不適用</h3>
            <p v-if="limitations.length === 1" class="stock-answer">{{ limitations[0] }}</p>
            <ul v-else class="stock-metric-page__note-list">
              <li v-for="item in limitations" :key="item" class="stock-answer">{{ item }}</li>
            </ul>
          </section>

          <section v-if="misreadings.length" class="stock-metric-page__note" aria-labelledby="stock-metric-misreadings-heading">
            <h3 id="stock-metric-misreadings-heading" class="stock-metric-page__note-title">容易看錯的地方</h3>
            <p v-if="misreadings.length === 1" class="stock-answer">{{ misreadings[0] }}</p>
            <ul v-else class="stock-metric-page__note-list">
              <li v-for="item in misreadings" :key="item" class="stock-answer">{{ item }}</li>
            </ul>
          </section>
        </div>
      </StockQuestionSection>

      <!-- 頁尾：出處與去處。**刻意不是問句段落、沒有 h2**——它不回答任何問題，而掛一個問句標題會
           讓它看起來像內容。原本這四行寄生在「X 是什麼？」底下，見上面那段註解。 -->
      <div class="stock-metric-page__footer">
        <p v-if="metricEntry?.sources?.length" class="stock-metric-page__footer-line">資料來源：{{ metricEntry.sources.join('、') }}</p>
        <p class="stock-metric-page__footer-line">
          <NuxtLink :to="`/stock/${code}/financial-statements`">看 {{ stockShortName }} {{ code }} 的財務報表原始數字</NuxtLink>
          <template v-if="metricEntry?.referenceUrl">　·　<a :href="metricEntry.referenceUrl" target="_blank" rel="noopener noreferrer">{{ metricPage.topic }}的公開說明（另開新視窗）</a></template>
        </p>
        <p v-if="related.length" class="stock-metric-page__footer-line">
          接著可以看：<template v-for="(item, index) in related" :key="item.slug"><template v-if="index">、</template><NuxtLink :to="`/stock/${code}/${item.slug}`">{{ item.topic }}</NuxtLink></template>。
        </p>
      </div>
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

/* 小標比 h2 弱一階（2026-09-30「資產報酬率是什麼？以下的版面現在看起來有點髒」）。原本是
   font-weight 700 + 主要色，跟段落標題幾乎同重，掃描時像四個同級標題連著出現。
   **層級只靠字重與顏色，不靠縮字級**：本站的 16px 下限沒有例外（--el-font-size-base 全域改成
   16px 的那條規則），而這是正文不是密集的 UI 元件。一度寫成 0.9375rem，量到 15px 後改回來。 */
.stock-metric-page__note-title {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

/* 頁尾：出處與去處，字級與顏色都退一階，跟上面的內容明顯分開。沒有卡片——下半頁只剩
   「標題→文字」一種節奏，卡片留給上半頁那些帶數字的區塊。 */
.stock-metric-page__footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.stock-metric-page__footer-line {
  margin: 0;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

/* A real <ul>, not paragraphs with a bullet character: each caveat is an independent statement and
   a screen reader should announce how many there are. Generous line gap — these run 2–3 lines each
   at phone width and this audience needs the separation to see where one ends. */
.stock-metric-page__note-list {
  margin: 0;
  padding-left: 1.5em;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
