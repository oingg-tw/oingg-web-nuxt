<script setup lang="ts">
import type { StockMetricPageResponse } from '#shared/types/stock-metric-page'
import { clampDescription, findMetricInSchema } from '~/utils/stock-digest'
import { joinClauses, joinSentences } from '~/utils/stock-answers'
import { formatSignificantDigits } from '~/utils/format-significant-digits'

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
// 0.28元，季增-24.32%，近四季EPS為1.51元」為目標句型）. Always Q basis regardless of `timeframe`
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

const valueAnswer = computed(() => {
  if (!latest.value) return null
  // 財報狗's own shape when a real 單季 figure exists: 單季值 → 年增（財報狗原句是季增，這個目錄
  // 沒有季增率可用，改用年增，見 METRIC_PAGES 裡 eps 這筆自己的註解）→ 近四季值. Falls back to the
  // original TTM-only sentence for any metric page with no quarterlyGrowthMetricCode declared —
  // not every future metric (revenue, ROA, …) will have one the day it ships.
  const q = latestQuarterly.value
  if (q) {
    return joinClauses([
      `${stockShortName.value}${q.fiscalYear}年第${q.fiscalQuarter}季${metricPage.topic}為 ${valueTextOf(q.value)}`,
      q.growth !== null ? `年增 ${formatSignificantDigits(q.growth, 3)}%` : null,
      `近四季${metricPage.topic}為 ${latestValueText.value}`,
      latest.value.point?.knowledgeDate ? `資料時間 ${latest.value.point.knowledgeDate}` : null
    ])
  }
  return joinClauses([
    `${stockShortName.value}目前的${metricPage.topic}為 ${latestValueText.value}`,
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
  const lead = joinClauses([
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
  titleKeywords: metricPage.titleKeywords,
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
            <p class="stock-metric-page__value">{{ latestValueText }}</p>
            <StockMetricHistoryChart
              :entries="metricData?.series?.entries ?? []"
              :metric-code="metricPage.metricCode"
              :topic="metricPage.topic"
              :unit="unit"
              :timeframe="metricPage.timeframe"
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

.stock-metric-page__value {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
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
