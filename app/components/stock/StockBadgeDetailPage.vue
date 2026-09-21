<script setup lang="ts">
import type { StockBadgePageResponse } from '#shared/types/stock-badge-page'
import type { MetricProvenanceEntry } from '~/composables/stock/useMetricProvenance'
import type { StockQuarter } from '~/composables/stock/useStockPeriodSelection'
import { jumpToStatementRow } from '~/composables/stock/useStatementRowFocus'
import { GURU_BADGE_DISCLAIMER, buildGuruBadges } from '~/utils/guru-badges'
import { clampDescription, findMetricInSchema } from '~/utils/stock-digest'
import { joinClauses, joinSentences } from '~/utils/stock-answers'
import { formatSignificantDigits } from '~/utils/format-significant-digits'
import { STATEMENT_DEFINITIONS } from '~/utils/financial-statement-rows'

// The BADGE half of /stock/{code}/{slug} (2026-09-20), generalizing f-score.vue's per-stock ×
// per-metric template to other guru badges.
//
// Was the route file itself until later the same day, when 指標專頁 arrived and the two kinds
// were split into two templates per direct decision（「我認為把徽章與指標頁面區分成兩個模板會比較
// 容易些」）. Nuxt allows only one dynamic segment per directory, so the route file
// (app/pages/stock/[code]/[slug].vue) is now a dispatcher that mounts either this or
// StockMetricDetailPage.vue. Moved verbatim — this component still reads the route itself rather
// than taking props, which is why the body below needed no changes at all.
//
// Still a catch-all sibling of the named sub-pages (balance-sheet.vue, dividend.vue, …): Nuxt
// resolves a static route before a dynamic one, so those keep winning, and an unrecognized slug
// 404s in the dispatcher.
//
// f-score itself keeps its own dedicated route (/stock/:code/f-score, its own 9-signal
// checklist) rather than moving here — what generalizes is the data sources and page rules
// (question h2s, verbatim limitations/misreadings, a short methodology paragraph linking out
// instead of pasting badge.detail per symbol), not the URL shape. BADGE_PAGES
// (shared/utils/hub-slugs.ts) is the one registry this page, the sitemap handler, and
// StockFinancialHighlightsRisksCard's entry-point links all read.
//
// The three question sections a single-value badge needs (vs. f-score's four): 目前值 → 計算依據
// (a real SSR table, since these badges have no 9-signal checklist to fill that role) →
// 優點與限制 → 是什麼. Data comes from /api/stock/:code/badge (one same-origin round trip:
// this symbol's badge entry + its calculation-audit trail).
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.params.code))
const slug = computed(() => String(route.params.slug))

// `ownRoute` entries (f-score) are rejected as hard as an unknown slug: Nuxt resolves their
// static route file first so this branch is unreachable in practice, but rendering one with THIS
// generic template would silently drop the content its own page exists for (the 9-signal
// checklist). Better a 404 than a page that looks right and isn't.
const badgePage = findBadgePage(slug.value)
if (!badgePage || badgePage.ownRoute) throw createError({ statusCode: 404, statusMessage: 'unknown stock sub-page' })

const { stock, profile, stockShortName, stockPending, isFavorite, toggleFavorite, summary } = useStockDetailSummary(code)
const { data: filterSchema } = await useFilterSchema()

const { data: badgeData } = await useAsyncData<StockBadgePageResponse | null>(
  () => `stock-badge-${code.value}-${slug.value}`,
  async () => {
    try {
      return await $fetch<StockBadgePageResponse>(`/api/stock/${code.value}/badge`, { query: { slug: slug.value }, retry: 0, timeout: 15_000 })
    } catch (error) {
      if (import.meta.dev) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[stock-badge] GET /api/stock/${code.value}/badge?slug=${slug.value} unavailable (${reason})`)
      }
      return null
    }
  },
  { watch: [code, slug], default: () => null }
)

// The badge's own catalog definition (name/author/summary/threshold/source link) — same
// buildGuruBadges() every badge UI reads, so this page and the dialog never disagree.
// `undefined` when the badge has been withdrawn from the catalog (analysis-ts's ongoing badge-
// takedown rounds) — the page still renders (its own value/provenance are independent data), it
// just drops the 徽章門檻 line and the 是什麼 section's summary/author, and goes `noindex`.
const badgeDefinition = computed(() => buildGuruBadges(filterSchema.value?.categories ?? []).find(badge => badge.id === badgePage.metricCode) ?? null)
// The badge's OWN threshold source (catalog `badge.sourceUrl`, 2026-09-20) — never the metric's
// referenceUrl, which answers "what is this metric" rather than "why is the threshold ≥ 40%".
// Renders nothing when absent (毛利率 and 淨利率 are exactly that case: their threshold comes from
// a print book); see GuruBadge.sourceUrl's own comment.
const sourceUrl = computed(() => badgeDefinition.value?.sourceUrl ?? null)
const unit = computed(() => findMetricInSchema(filterSchema.value?.categories ?? [], badgePage.metricCode)?.metric.unit ?? '')
// The metricCode the 目前值 chart queries — same provenanceMetricCode substitution the
// calculation-audit table already makes (see badgePageChartMetricCode's own comment). Reusing
// `unit` above rather than a second lookup keyed on this: verified live that liveGrahamNumber and
// its provenance substitute grahamNumber share the same unit (倍), so one lookup covers both.
const chartMetricCode = badgePageChartMetricCode(badgePage)

const entry = computed(() => badgeData.value?.entry ?? null)
const provenance = computed(() => badgeData.value?.provenance ?? null)

// 不適用（產業排除）vs 尚無資料 — same distinction StockGuruBadgeDialog.vue's currentValueText()
// makes, off the same `nullReason` field.
const valueText = computed(() => {
  const value = entry.value?.value ?? null
  if (value === null) return entry.value?.nullReason === 'not_applicable_industry' ? '不適用' : '尚無資料'
  return `${formatSignificantDigits(value, 3)}${unit.value}`
})

const passedText = computed(() => {
  const passed = entry.value?.passed ?? null
  return passed === null ? '無法判定' : passed ? '符合' : '未符合'
})

const valueAnswer = computed(() => {
  if (!entry.value) return null
  return joinClauses([
    `${stockShortName.value}目前的${badgePage.topic}為 ${valueText.value}`,
    entry.value.knowledgeDate ? `資料時間 ${entry.value.knowledgeDate}` : null,
    badgeDefinition.value ? `徽章門檻「${badgeDefinition.value.threshold.description}」本期${passedText.value}` : null
  ])
})

// 計算依據（審計鏈）表 — this page's required SSR table (every /stock/:code sub-page needs at
// least one; f-score is the sole exemption, see check-stock-pages.mjs's own comment). Each row
// traces one input back to its filing; `type: 'statementField'` rows deep-link into 財務報表 at
// the exact row/period (same jumpToStatementRow() StockGuruBadgeDialog.vue uses).
const STATEMENT_LABELS = Object.fromEntries(STATEMENT_DEFINITIONS.map(def => [def.key, def.label]))

function provenanceSourceText(item: MetricProvenanceEntry): string {
  if (item.type === 'statementField' && item.statementType) return STATEMENT_LABELS[item.statementType] ?? item.statementType
  return item.sourceDescription ?? '—'
}

function formatProvenanceValue(raw: string | number): string {
  const value = Number(raw)
  return Number.isFinite(value) ? formatSignificantDigits(value, 4) : String(raw)
}

function openProvenanceEntry(item: MetricProvenanceEntry): void {
  if (item.type !== 'statementField' || !item.statementType || !item.fieldKey) return
  jumpToStatementRow({ statementType: item.statementType, rowKey: item.fieldKey, year: item.fiscalYear, quarter: item.fiscalQuarter as StockQuarter })
}

// liveGrahamNumber has no provenance breakdown of its own (hasProvenance: false — see
// BADGE_PAGES's own comment); this table then comes from the quarterly grahamNumber's provenance
// instead, which uses the last KNOWLEDGE-DATE close, not today's. The two numbers legitimately
// differ — the caption says which price the table itself used so the two are never read as a
// disagreement, and this section never restates the 目前值 section's own number.
const provenanceCaption = computed(() => {
  const priceEntry = provenance.value?.entries.find(item => item.sourceDescription?.includes('收盤價'))
  return priceEntry ? `${stockShortName.value} ${code.value} 的計算依據（${priceEntry.sourceDescription}）` : `${stockShortName.value} ${code.value} 的計算依據`
})

const metricEntry = computed(() => findMetricInSchema(filterSchema.value?.categories ?? [], badgePage.metricCode)?.metric ?? null)
const limitationsText = computed(() => metricEntry.value?.limitations ?? null)
const misreadingsText = computed(() => metricEntry.value?.misreadings ?? null)

// Same clauses as valueAnswer (value/knowledgeDate/threshold), built separately rather than
// reused verbatim so the lead reads「{短名}（{代碼}）{主題}」the way every other sub-page's
// description does — a short version dropping straight to "{topic}：{value}。" undershoots the
// 50-CJK-char floor (scripts/check-stock-pages.mjs).
const description = computed(() => {
  if (!entry.value) return null
  const lead = joinClauses([
    `${stockShortName.value}（${code.value}）${badgePage.topic}：${valueText.value}`,
    entry.value.knowledgeDate ? `資料時間 ${entry.value.knowledgeDate}` : null,
    badgeDefinition.value ? `徽章門檻「${badgeDefinition.value.threshold.description}」本期${passedText.value}` : null
  ])
  return clampDescription(joinSentences([lead, badgeDefinition.value?.summary]) ?? '')
})

// noindex whenever the page has nothing symbol-specific to say: outside the shared pilot batch
// (same codes as f-score — 2026-09-19's call to watch indexing before widening), the badge itself
// withdrawn from the catalog, or this company simply has no value for it. Each condition degrades
// the page rather than erroring it; noindex is what keeps a thin/duplicate version out of the
// index while it's still reachable and useful to a visitor who followed a link here.
const noindex = computed(() => !isFScorePilotSymbol(code.value) || !badgeDefinition.value || entry.value?.value == null)

const { breadcrumbs } = useStockPageSeo({
  code,
  shortName: stockShortName,
  topic: badgePage.topic,
  titleKeywords: badgePage.titleKeywords,
  pathSuffix: `/${badgePage.slug}`,
  stock,
  summary,
  description,
  noindex,
  sectorCode: computed(() => profile.value?.industry ?? null)
})
</script>

<template>
  <div v-loading="stockPending" class="stock-badge-page">
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
      <StockSummaryCard :stock="stock" :website="profile?.website ?? null" :is-favorite="isFavorite" :short-name="stockShortName" :topic="badgePage.topic" @toggle-favorite="toggleFavorite" />
      <StockPageNav :code="code" />
      <StockBreadcrumb :items="breadcrumbs" />

      <StockQuestionSection id="stock-badge-value" :question="`${stockShortName}（${code}）的${badgePage.topic}是多少？`" :answer="valueAnswer">
        <!-- 資料時間/徽章門檻 lines removed 2026-09-21（直接要求「stock-page-section
             stock-question-section 移除重複資訊」）— StockQuestionSection's own :answer prop
             (valueAnswer below) already states the value, knowledge date and threshold/pass-fail
             in one sentence directly above this card; these were the same facts restated as
             separate lines right under it. The big number stays — a different visual role (large,
             scannable at a glance), not a duplicate in the way plain repeated text is. -->
        <el-card shadow="never" class="stock-badge-page__card">
          <template v-if="entry">
            <p class="stock-badge-page__value">{{ valueText }}</p>
            <StockMetricHistoryChart
              v-if="badgePage.chartTimeframe"
              :entries="badgeData?.series?.entries ?? []"
              :metric-code="chartMetricCode"
              :topic="badgePage.topic"
              :unit="unit"
              :timeframe="badgePage.chartTimeframe"
            />
          </template>
          <p v-else class="stock-badge-page__line">目前沒有這檔股票的{{ badgePage.topic }}資料。</p>
        </el-card>
      </StockQuestionSection>

      <StockQuestionSection v-if="provenance?.entries.length" id="stock-badge-calculation" :question="`${badgePage.topic}是怎麼算出來的？`">
        <!-- SharedTableScroll, same as every other data-ssr-table in this app (added 2026-09-20,
             the same day this table was — it was missing at first and the page scrolled sideways
             at 375px: scrollWidth 881 against a 375 viewport, measured). Its long 用途 strings make
             this the widest table in the family. -->
        <SharedTableScroll :label="`${stockShortName} ${code} 的${badgePage.topic}計算依據`">
          <table class="seo-table" data-ssr-table>
            <caption>{{ provenanceCaption }}</caption>
            <thead>
              <tr>
                <th scope="col">用途</th>
                <th scope="col">會計期別</th>
                <th scope="col">來源</th>
                <th scope="col">數值</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in provenance.entries" :key="index">
                <td>
                  <button v-if="item.type === 'statementField'" type="button" class="stock-badge-page__provenance-link" @click="openProvenanceEntry(item)">
                    {{ item.role }}
                  </button>
                  <template v-else>{{ item.role }}</template>
                </td>
                <td>{{ item.fiscalYear }} Q{{ item.fiscalQuarter }}</td>
                <td>{{ provenanceSourceText(item) }}</td>
                <td>{{ formatProvenanceValue(item.value) }}</td>
              </tr>
            </tbody>
          </table>
        </SharedTableScroll>
        <p v-if="provenance.methodologyNote" class="stock-answer">{{ provenance.methodologyNote }}</p>
      </StockQuestionSection>

      <StockQuestionSection id="stock-badge-pros-cons" :question="`用${badgePage.topic}判斷有什麼優點與限制？`">
        <div class="stock-badge-page__pros-cons">
          <section class="stock-badge-page__pros-cons-block" aria-labelledby="stock-badge-pros-heading">
            <h3 id="stock-badge-pros-heading" class="stock-badge-page__pros-cons-title">優點</h3>
            <ul class="stock-badge-page__pros-cons-list">
              <li>門檻是公開發表的固定數字，每一家公司都用同一套標準比較，不含本站自訂的判斷。</li>
              <li>每一個輸入數字都能回溯到財報或交易所公告的原始資料，上方「怎麼算出來的？」逐項列出。</li>
            </ul>
          </section>

          <section v-if="limitationsText" class="stock-badge-page__pros-cons-block" aria-labelledby="stock-badge-limits-heading">
            <h3 id="stock-badge-limits-heading" class="stock-badge-page__pros-cons-title">限制</h3>
            <p class="stock-answer">{{ limitationsText }}</p>
          </section>

          <section v-if="misreadingsText" class="stock-badge-page__pros-cons-block" aria-labelledby="stock-badge-misreadings-heading">
            <h3 id="stock-badge-misreadings-heading" class="stock-badge-page__pros-cons-title">常見誤讀</h3>
            <p class="stock-answer">{{ misreadingsText }}</p>
          </section>
        </div>
      </StockQuestionSection>

      <StockQuestionSection id="stock-badge-method" :question="`${badgePage.topic}是什麼？`">
        <el-card shadow="never" class="stock-badge-page__card">
          <template v-if="badgeDefinition">
            <p class="stock-badge-page__line">{{ badgeDefinition.summary }}</p>
            <p class="stock-badge-page__line">
              出處：{{ badgeDefinition.author }}
              <template v-if="sourceUrl">・<a :href="sourceUrl" target="_blank" rel="noopener">原始文獻</a></template>
            </p>
          </template>
          <p class="stock-badge-page__line">
            <NuxtLink :to="metricPath(badgePage.metricCode)">看{{ badgePage.topic }}的完整說明</NuxtLink>
          </p>
          <p class="stock-badge-page__disclaimer">{{ GURU_BADGE_DISCLAIMER }}</p>
        </el-card>
      </StockQuestionSection>

      <p class="stock-page-section__link">
        <NuxtLink :to="`/stock/${code}`">回 {{ stockShortName }} {{ code }} 的財報亮點與風險</NuxtLink>
      </p>
    </template>
  </div>
</template>

<style scoped>
.stock-badge-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stock-badge-page__card {
  border-radius: 12px;
}

/* Top/bottom padding trimmed 20px→12px 2026-09-21, same「公司卡片先打薄」pass and same move as
   StockSummaryCard's own body-style trim (and StockMetricDetailPage's own copy of this rule) —
   pure whitespace, no content removed. Targets BOTH el-card instances sharing this class（目前值/
   是什麼 sections）via :deep() since the padding lives on Element Plus's own .el-card__body.
   Horizontal padding untouched. */
.stock-badge-page__card :deep(.el-card__body) {
  padding-top: 12px;
  padding-bottom: 12px;
}

.stock-badge-page__value {
  margin: 0 0 8px;
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

.stock-badge-page__line {
  margin: 0 0 8px;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.stock-badge-page__disclaimer {
  margin: 12px 0 0;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.stock-badge-page__pros-cons {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stock-badge-page__pros-cons-title {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* 40em cap removed 2026-09-20 with every other one — see main.css's .hub-answer comment. */
.stock-badge-page__pros-cons-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

/* Visible on purpose, not .visually-hidden like the directory tables' captions — it carries the
   as-of price date the 計算依據 table itself used (see provenanceCaption's own comment), which a
   sighted reader needs alongside the table, not just a screen reader. */
.stock-badge-page .seo-table caption {
  text-align: left;
  margin-bottom: 8px;
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.stock-badge-page__provenance-link {
  padding: 0;
  border: none;
  background: transparent;
  font: inherit;
  color: var(--el-color-primary-dark-2);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
</style>
